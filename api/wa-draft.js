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
  'Prices come from the tools only — never from memory, never invented, never rounded to something nicer. Quote a price with its unit ("UGX 45,000 per bag"). When a quantity discount exists and the customer sounds like a bulk buyer, mention the first break. If the tools find nothing for what they asked, say the shop will check and come back to them — never guess, never promise stock the tools did not confirm.',
  '',
  'Availability is yes or to-order, exactly as the tool says it: in stock means they can come today; to order means the shop can bring it in — say which, plainly.',
  '',
  'Write like a person at the counter: short, warm, plain. Mirror the customer’s language — English or Luganda, matching how they wrote. No lists longer than three lines, no markdown, no emojis unless the customer uses them. One draft, complete: greeting only if they greeted, the answer, and when a price was given, an invitation to order.',
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
    description: 'The customer price for a product: name, retail price per unit, the first quantity breaks, and whether it is in stock or to order. Up to 4 matches for the query; a miss returns the real product names to pick from. This is the ONLY source of any figure you quote.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'The product as the customer said it.' } },
      required: ['query'], additionalProperties: false,
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
