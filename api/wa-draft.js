'use strict';
/*
 * The WhatsApp counter's server half — a thin, guarded proxy that DRAFTS
 * replies to CUSTOMERS. Sibling of api/assistant.js and built on the
 * same skeleton (auth before spend, ships dark, ceilings before the SDK
 * client exists), but a different creature at the fence line:
 *
 * The in-app assistant talks to the OWNER and may see everything. This
 * endpoint writes words that will be read by a CUSTOMER, so the fence is
 * structural, not just prompted: its only tools are two catalogue reads
 * whose client-side executors return name, retail price, quantity breaks
 * and a yes/no availability — never a cost, a supplier, a stock count, a
 * margin, a debt, or anything about any customer. What the model cannot
 * reach, it cannot leak. The prompt states the same fence as law so the
 * words stay inside it too.
 *
 * Nothing here sends anything. The draft lands in the inbox for the
 * owner to read, edit and send through the same wa-send path as a
 * hand-typed reply — the 24-hour window check and the "nothing sends
 * itself" contract stay exactly where they were.
 *
 * Byte-stable prompt and tools, same as the assistant: the whole prefix
 * caches, and today's date is injected by the CLIENT inside its own
 * user turn.
 */
const Anthropic = require('@anthropic-ai/sdk');

// Public by design — the same literals index.html ships to every visitor.
const SUPABASE_URL = 'https://hgywjaifdmgrcnwxstxg.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_KsUIBYzuZRdoPsqP4T2ULw__AsCEhzV';

const WA_SYSTEM_PROMPT = [
  'You draft WhatsApp replies for the counter of a wholesale hardware shop in Uganda. You are writing TO A CUSTOMER on the shop’s behalf, and the shop owner reads and approves every draft before anything is sent — write so the owner can send it untouched.',
  '',
  'The fence: you may talk about what the shop sells, its prices, quantity discounts, availability, and how to order. NEVER mention supplier names, what things cost the shop, margins, debts, other customers, or anything from the shop’s books — your tools cannot reach any of that, and your words must not pretend to.',
  '',
  'BREVITY IS THE LAW. These customers are busy traders reading on a phone between jobs. A price answer is one to three SHORT lines, total. No greeting unless the customer greeted in this exchange — and then one word, on the same line. No closing filler, no "happy to help", no restating their question. At most one question per reply. Several items asked → one line per item, nothing between the lines.',
  '',
  'Highlight what decides: WhatsApp shows *single asterisks* as bold, so wrap the product name, the price, and the pack size in them — like "*Super Stick Contact Adhesive* — *UGX 65,000* per *jerrycan* (to order)." Nothing else gets asterisks.',
  '',
  'Prices come from the tools only — never from memory, never invented, never rounded to something nicer. When a quantity discount exists and the customer sounds like a bulk buyer, add the first break on the same line.',
  '',
  'Honesty about what we sell: if the tools find nothing for an item, say plainly "We don’t have <it>." — never "let me check", never a hedge; a hedge reads as a middleman about to overcharge. If the exact size or type is missing but the tool returned its siblings, say we don’t have that size and list the sizes we do, one line. A match with price_not_set means we DO sell it and only the price is pending — say we have it and the shop will confirm the price; NEVER say we don’t have something the tool returned. Availability is two words, exactly as the tool says: in stock (come today) or to order (we bring it in).',
  '',
  'Packs: when the tool gives pack_qty and pack_unit and the customer speaks in cartons or packs, convert plainly on the same line ("*5* cartons = *100* pcs"). When they name a pack the tool shows no size for, ask which they mean — never guess a pack size.',
  '',
  'Orders: when the customer clearly commits to buying — "I need one", "nkola order", a quantity named for a priced item — call wa_take_order with the items. Then reply in ONE line ("*1* jerrycan *Super Stick* — *UGX 65,000*. Order noted — confirmation coming shortly.") — when the owner approves, the app itself sends the customer a designed receipt with the order number, so NEVER ask a customer who has already committed to confirm again. NEVER claim an order already exists, and never call wa_take_order for a question that is only asking prices.',
  '',
  'Mirror the customer’s language — English or Luganda, matching how they wrote. No markdown beyond the asterisks, no emojis unless the customer uses them.',
  '',
  'The [Today is YYYY-MM-DD] line at the start of the customer thread is authoritative for any date.',
].join('\n');

/* Two tools in FIXED order — part of the cached prefix. Executed by the
   BROWSER against the shop's own data; every schema closes itself. */
const TOOLS = [
  {
    name: 'wa_catalogue_names',
    description: 'Every product name the shop sells (names only, up to 300). Use it when the customer’s words match nothing — pick the name that sounds like what they meant, then price it with wa_product_price.',
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
  {
    name: 'wa_product_price',
    description: 'The customer price for a product: name, price per unit (the right side of the shop’s own price book), pack size when it packs, the first quantity breaks, and whether it is in stock or to order. A match may carry price_not_set — the shop sells it, the price is pending. Up to 4 matches for the query; a miss returns the real product names to pick from. This is the ONLY source of any figure you quote.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'The product as the customer said it.' } },
      required: ['query'], additionalProperties: false,
    },
  },
  {
    name: 'wa_take_order',
    description: 'Call ONLY when the customer has clearly committed to buying ("I need one", a quantity named for a priced item) — never for a question that only asks prices. Resolves the items and prices; the shop’s app then turns it into a draft order the owner approves and sends the customer a receipt carrying the order number. It creates nothing by itself, so never claim an order already exists.',
    input_schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array', minItems: 1, maxItems: 10,
          items: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'The product as the customer said it.' },
              qty: { type: 'number', exclusiveMinimum: 0 },
            },
            required: ['query', 'qty'], additionalProperties: false,
          },
        },
      },
      required: ['items'], additionalProperties: false,
    },
    /* The second cache breakpoint — the whole prefix up to and including
       this tool is served from cache on every draft after the first. */
    cache_control: { type: 'ephemeral' },
  },
];

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { type: 'method', message: 'POST only.' } });
  }

  /* Auth before anything that can spend money — the caller must hold a
     real logged-in session of the app. */
  const authz = req.headers['authorization'] || '';
  if (!authz.startsWith('Bearer ')) {
    return res.status(401).json({ error: { type: 'auth', message: 'Sign in to the app first.' } });
  }
  let who;
  try {
    who = await fetch(SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: authz },
    });
  } catch (e) {
    return res.status(502).json({ error: { type: 'auth', message: 'Could not verify the login. Try again.' } });
  }
  if (!who.ok) {
    return res.status(401).json({ error: { type: 'auth', message: 'Your login has expired — reload the page and sign in again.' } });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(200).json({ not_configured: true });
  }

  const messages = (req.body && req.body.messages) || [];
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: { type: 'bad_request', message: 'No conversation was sent.' } });
  }
  /* A customer thread is short by nature; a long one has been trimmed by
     the client. These ceilings hold BEFORE the SDK client exists. Text
     only: a WhatsApp draft never carries images through this door. */
  if (messages.length > 30) {
    return res.status(413).json({ error: { type: 'too_long', message: 'This conversation is too long to draft from — reply by hand.' } });
  }
  for (const m of messages) {
    const blocks = Array.isArray(m.content) ? m.content : [];
    for (const b of blocks) {
      if (b && (b.type === 'image' || b.type === 'document')) {
        return res.status(400).json({ error: { type: 'bad_request', message: 'Drafts are text only.' } });
      }
    }
  }
  if (JSON.stringify(messages).length > 100000) {
    return res.status(413).json({ error: { type: 'too_long', message: 'This conversation is too long to draft from — reply by hand.' } });
  }

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5',
      /* A counter reply is a few sentences; low effort keeps the turn
         fast and cheap, and the budget covers thinking too. */
      max_tokens: 1200,
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{ type: 'text', text: WA_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      tools: TOOLS,
      messages,
    });
    return res.status(200).json({
      content: response.content,
      stop_reason: response.stop_reason,
      usage: response.usage,
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return res.status(502).json({ error: { type: 'bad_key', message: 'The AI key on the server was rejected. Check ANTHROPIC_API_KEY in Vercel — it may have been revoked or mistyped.' } });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: { type: 'rate_limited', message: 'The AI service is busy right now. Wait a minute and try again.' } });
    }
    if (err instanceof Anthropic.APIConnectionError) {
      return res.status(502).json({ error: { type: 'network', message: 'Could not reach the AI service. Check the internet connection and try again.' } });
    }
    if (err instanceof Anthropic.APIError) {
      return res.status(502).json({ error: { type: 'api_error', message: 'The AI service returned an error (' + (err.status || 'unknown') + '). Try again shortly.' } });
    }
    return res.status(500).json({ error: { type: 'server_error', message: 'Something went wrong on the server. Try again.' } });
  }
};
