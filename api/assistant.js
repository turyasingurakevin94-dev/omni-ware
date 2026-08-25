'use strict';
/*
 * The assistant's server half — a thin, guarded proxy to the Claude API.
 *
 * Everything of substance happens in the browser: the tools below are
 * EXECUTED by index.html against the shop's own in-memory data, using the
 * same functions the buttons use. No shop data is stored here and none
 * passes through except what the browser chose to send as tool results.
 * This function exists for exactly one reason: the Anthropic API key must
 * never ship inside a public 2.7 MB static file, so the one secret lives
 * here as a Vercel environment variable and every request is signed by a
 * real logged-in user of the app before a shilling of credit is spent.
 *
 * The system prompt and the tool definitions live HERE, not in the
 * client, for two reasons that point the same way: they are byte-stable,
 * so the whole prefix caches (~90% cheaper on every question after the
 * first), and a client cannot swap the prompt out from under the shop.
 * Nothing in them may vary per request — no dates, no shop names. Today's
 * date is injected by the CLIENT inside its own user turns.
 *
 * Ships dark: with no ANTHROPIC_API_KEY set this returns a structured
 * not-configured answer that the panel renders as setup instructions.
 * The SDK client is only constructed after that check.
 */
const Anthropic = require('@anthropic-ai/sdk');

// Public by design — the same literals index.html ships to every visitor.
// The key here is the publishable one; it identifies the project, not a
// user. The USER is identified by the Authorization header we verify.
const SUPABASE_URL = 'https://hgywjaifdmgrcnwxstxg.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_KsUIBYzuZRdoPsqP4T2ULw__AsCEhzV';

const SYSTEM_PROMPT = [
  'You are the assistant inside Omni-ware, the management app of a hardware shop in Uganda. You are talking to the shop owner.',
  '',
  'Money: everything is Ugandan Shillings. Write amounts like 1,250,000 UGX. Whole shillings only.',
  '',
  'Tools first, never invent: every figure you state must come from a tool result in this conversation. If you have not looked something up, look it up. If no tool can answer it, say so plainly — never estimate, never answer from memory. When the owner asks what is known about a product, resolve it with find_product, then call product_details and answer with what matters: stock, the cheapest supplier or two, the markup rule and the suggested price — summarise, never read every supplier row aloud.',
  '',
  'Resolve before writing: before any write tool, resolve the exact customer, product, supplier or due id with the find/list tools. Never guess an id. If a search returns nothing, say so. If it returns several plausible matches, ask the owner which one — name the options (for products, by their variant names, e.g. "Normal, Gold, or Soft Close?") and wait. A misspelt name must never cause a new customer to be created.',
  '',
  'Names here are often Luganda or other local names, and a voice transcript writes them as they sound — "my long go" may mean Mulongo. When a name search finds nothing it returns the real names on file instead (all_names or product_names): pick the one that sounds like what was heard, allowing for how a transcript drifts (ky heard as ch, r and l swapping, doubled letters lost, g and j blurring). For a product, call find_product again with the exact name you picked to get its variants and prices; a customer picked from all_names already carries its id. Always say the resolved name inside your answer so a wrong pick is caught at once, and mention when a match came through the notes on a customer (matched: notes — "the one noted as Kadde"). Do not add a did-you-mean round to read-only questions — naming the record in the answer is the check, and every write already shows a confirmation card the owner must approve. If the list is truncated or nothing on it sounds right, ask the owner to spell the name.',
  '',
  'Quotes are drafts only: create_quote saves a draft. Invoicing, stock movement and order progression are done by the owner in the app — say so when it matters.',
  '',
  'Confirmation: every write shows the owner a confirmation first. Only claim an action happened after its tool result says done. A result with declined:true means the owner cancelled — acknowledge briefly and do not retry or argue.',
  '',
  'When an amount, account (cash, mobile money, or bank) or target is unclear, ask one short question instead of assuming.',
  '',
  'Out of scope: voiding or editing invoices, stock adjustments, deleting anything. Name the app screen where the owner does it (for example the Order tracking or Cash Book screen) and stop.',
  '',
  'Style: short answers — a few plain sentences, totals before detail. Your replies are often read aloud through a headset, so they must be speakable: no tables, no markdown, no bullet lists longer than three items, no headings.',
  '',
  'Language: the owner may write or speak in English or Luganda. Reply in the language of their message.',
  '',
  'The [Today is YYYY-MM-DD] line at the start of the owner’s message is authoritative — use it for "today", "this month", and date defaults.',
].join('\n');

/* Eighteen tools in FIXED order — the array is part of the cached
   prefix, so reordering it would re-bill the whole prefix for nothing.
   Every schema closes with additionalProperties:false so a drifted call
   fails loudly instead of half-working. */
const ACCOUNT_ENUM = { type: 'string', enum: ['cash', 'momo', 'bank'], description: 'Which till: cash drawer, mobile money, or bank.' };

const TOOLS = [
  {
    name: 'find_customer',
    description: 'Find a customer by name or phone. Always use this to get the exact customer_id before any customer write or statement. Returns at most 5 matches with an exact_match flag.',
    input_schema: { type: 'object', properties: { query: { type: 'string', description: 'Name or phone, as the owner said it.' } }, required: ['query'], additionalProperties: false },
  },
  {
    name: 'find_product',
    description: 'Find a product or a specific variant by any words: name, size, type, description, notes. Use before create_quote, recommended_price or add_sourcing_lead. Returns at most 5 entries with stock and price hints. Several matches for one product usually means the owner must pick a variant — ask them by the variant names.',
    input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'], additionalProperties: false },
  },
  {
    name: 'customer_statement',
    description: 'One customer’s full position: balance, open invoices oldest first, and their recent debt history (charges and payments, dated). Use for "what does X owe", "read me X’s history", and follow-up questions about their statement.',
    input_schema: { type: 'object', properties: { customer_id: { type: 'number' } }, required: ['customer_id'], additionalProperties: false },
  },
  {
    name: 'list_debtors',
    description: 'Everyone who owes the shop money, oldest debt first, with ages. Top 15 plus the overall count and total.',
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
  {
    name: 'cash_on_hand',
    description: 'Money the shop holds right now in the cash drawer, mobile money and bank, and the total.',
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
  {
    name: 'suppliers_owed',
    description: 'What the shop owes suppliers. Without supplier_id: every supplier owed, largest first. With supplier_id: that supplier’s open bills oldest first. supplier_id comes from a previous result.',
    input_schema: { type: 'object', properties: { supplier_id: { type: 'string' } }, required: [], additionalProperties: false },
  },
  {
    name: 'dues_owed',
    description: 'Wages and rent owed: the accrued totals, and which months are payable now with their due_id (needed by pay_staff_or_rent).',
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
  {
    name: 'recent_invoices',
    description: 'Recent sales invoices, newest first, optionally for one customer. Shows number, date, customer, total, paid and balance.',
    input_schema: { type: 'object', properties: { customer_id: { type: 'number' }, limit: { type: 'integer', minimum: 1, maximum: 10 } }, required: [], additionalProperties: false },
  },
  {
    name: 'financial_summary',
    description: 'The shop’s statements: income (profit and loss), balance_sheet, or cash_flow. Dates are YYYY-MM-DD; omitted dates default to this month (balance_sheet uses as_of, defaulting to today).',
    input_schema: {
      type: 'object',
      properties: {
        statement: { type: 'string', enum: ['income', 'balance_sheet', 'cash_flow'] },
        from: { type: 'string' }, to: { type: 'string' }, as_of: { type: 'string' },
      },
      required: ['statement'], additionalProperties: false,
    },
  },
  {
    name: 'recommended_price',
    description: 'The app’s own recommended selling price for one product variant, from its recorded cost and the shop’s markup rules — the same figure the quote screen suggests. Says plainly when no price is on file or no markup rule is set; never guesses. Resolve the product with find_product first, and if it has several variants confirm which one before calling.',
    input_schema: { type: 'object', properties: { product_id: { type: 'string' }, variant_index: { type: ['integer', 'null'] } }, required: ['product_id'], additionalProperties: false },
  },
  {
    name: 'product_details',
    description: 'The full picture of one product: stock on hand, every supplier and what they charge (volume tiers included), the markup rules that apply, and the suggested selling price per variant. Use it when the owner asks what is known about a product, after find_product resolves the id.',
    input_schema: { type: 'object', properties: { product_id: { type: 'string', description: 'From find_product.' } }, required: ['product_id'], additionalProperties: false },
  },
  {
    name: 'create_quote',
    description: 'Create a DRAFT quote (never invoices, never moves stock — the owner finishes it in the app). Every item must first be resolved with find_product; pass its product_id and variant_index exactly. Line prices default to the app’s own suggestions when sell_price is omitted.',
    input_schema: {
      type: 'object',
      properties: {
        customer_name: { type: 'string' },
        customer_phone: { type: 'string' },
        date: { type: 'string', description: 'YYYY-MM-DD; defaults to today.' },
        items: {
          type: 'array', minItems: 1,
          items: {
            type: 'object',
            properties: {
              product_id: { type: 'string' },
              variant_index: { type: ['integer', 'null'] },
              qty: { type: 'number', exclusiveMinimum: 0 },
              sell_price: { type: 'number', description: 'Per base unit; omit to use the app’s suggested price.' },
            },
            required: ['product_id', 'qty'], additionalProperties: false,
          },
        },
      },
      required: ['customer_name', 'items'], additionalProperties: false,
    },
  },
  {
    name: 'record_customer_payment',
    description: 'Receive money from a customer who owes. Applies to their oldest open invoices first; any remainder reduces their general balance. Needs the exact customer_id from find_customer.',
    input_schema: {
      type: 'object',
      properties: {
        customer_id: { type: 'number' }, amount: { type: 'number', exclusiveMinimum: 0 },
        account: ACCOUNT_ENUM, note: { type: 'string' }, date: { type: 'string' },
      },
      required: ['customer_id', 'amount', 'account'], additionalProperties: false,
    },
  },
  {
    name: 'pay_supplier',
    description: 'Pay a supplier the shop owes. Clamps to what is actually owed and settles their oldest bills first. supplier_id comes from suppliers_owed.',
    input_schema: {
      type: 'object',
      properties: {
        supplier_id: { type: 'string' }, amount: { type: 'number', exclusiveMinimum: 0 },
        account: ACCOUNT_ENUM, note: { type: 'string' },
      },
      required: ['supplier_id', 'amount', 'account'], additionalProperties: false,
    },
  },
  {
    name: 'pay_staff_or_rent',
    description: 'Pay a wage or rent month. due_id comes from dues_owed. Clamps to the balance of that month.',
    input_schema: {
      type: 'object',
      properties: {
        due_id: { type: 'number' }, amount: { type: 'number', exclusiveMinimum: 0 },
        account: ACCOUNT_ENUM, date: { type: 'string' },
      },
      required: ['due_id', 'amount', 'account'], additionalProperties: false,
    },
  },
  {
    name: 'add_expense',
    description: 'Record money going out that is not a supplier bill or payroll — transport, airtime, offloading, and similar running costs. category must be one of the shop’s own expense categories; an invalid one is rejected with the valid list.',
    input_schema: {
      type: 'object',
      properties: {
        account: ACCOUNT_ENUM, amount: { type: 'number', exclusiveMinimum: 0 },
        category: { type: 'string' }, description: { type: 'string' }, date: { type: 'string' },
      },
      required: ['account', 'amount', 'category', 'description'], additionalProperties: false,
    },
  },
  {
    name: 'record_other_income',
    description: 'Record money coming in that is NOT a customer paying their debt — owner investment, other income. category must be one of the shop’s own income categories.',
    input_schema: {
      type: 'object',
      properties: {
        account: ACCOUNT_ENUM, amount: { type: 'number', exclusiveMinimum: 0 },
        category: { type: 'string' }, description: { type: 'string' }, date: { type: 'string' },
      },
      required: ['account', 'amount', 'category', 'description'], additionalProperties: false,
    },
  },
  {
    name: 'add_sourcing_lead',
    description: 'Put an item on the sourcing queue — something the shop does not stock (or could not find) that should be hunted from suppliers. Repeating a name that is already on the queue revives it rather than duplicating it.',
    input_schema: {
      type: 'object',
      properties: {
        item_name: { type: 'string' },
        customer_name: { type: 'string', description: 'Who asked for it, if a customer did.' },
        note: { type: 'string' },
      },
      required: ['item_name'], additionalProperties: false,
    },
    /* The second cache breakpoint — the whole prefix up to and including
       this tool is served from cache on every question after the first. */
    cache_control: { type: 'ephemeral' },
  },
];

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { type: 'method', message: 'POST only.' } });
  }

  /* Auth before anything that can spend money. The token is the caller's
     own Supabase session JWT; auth/v1/user re-validates it server-side —
     the same gate every edge function in this repo already uses. */
  const authz = req.headers['authorization'] || '';
  if (!authz.startsWith('Bearer ')) {
    return res.status(401).json({ error: { type: 'unauthorized', message: 'Sign in to use the assistant.' } });
  }
  let who;
  try {
    who = await fetch(SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: authz },
    });
  } catch (e) {
    return res.status(502).json({ error: { type: 'network', message: 'Could not verify your login. Check the internet connection and try again.' } });
  }
  if (!who.ok) {
    return res.status(401).json({ error: { type: 'unauthorized', message: 'Your login has expired — reload the page and sign in again.' } });
  }

  /* Ships dark. The panel renders this as the setup card; nothing is
     spent and no SDK client is ever constructed. */
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(200).json({ not_configured: true });
  }

  const messages = req.body && req.body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: { type: 'bad_request', message: 'Nothing to answer.' } });
  }
  /* A hard ceiling, not a nicety: history is the one input a bug in the
     client could grow without bound, and every byte of it is billed. */
  if (messages.length > 40 || JSON.stringify(messages).length > 200000) {
    return res.status(413).json({ error: { type: 'too_long', message: 'This chat has grown too long — press New chat and continue there.' } });
  }

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5',
      max_tokens: 2000,
      /* Refusal fallbacks, current-guidance default for Opus 5: a safety
         decline re-runs on a fallback model inside this same call rather
         than dead-ending the owner's question. */
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      /* No `thinking` (adaptive is this model's default; a budget would
         400) and no sampling params (removed on this model). */
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      tools: TOOLS,
      messages,
    });
    return res.status(200).json({
      content: response.content,
      stop_reason: response.stop_reason,
      usage: response.usage,
    });
  } catch (err) {
    /* Most specific first; every branch is a sentence the owner can act
       on, because raw error JSON in a chat bubble helps nobody. */
    if (err instanceof Anthropic.AuthenticationError) {
      return res.status(502).json({ error: { type: 'bad_key', message: 'The AI key on the server was rejected. Check ANTHROPIC_API_KEY in Vercel — it may have been revoked or mistyped.' } });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: { type: 'rate_limited', message: 'The AI service is busy right now. Wait a minute and ask again.' } });
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
