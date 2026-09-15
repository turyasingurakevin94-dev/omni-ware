#!/usr/bin/env node
'use strict';
/*
 * client.html -- what the customer's screen is allowed to say.
 *
 * The Edge Function test (client-portal.test.js) pins what may cross the
 * wire. This one pins what the page does with it, which is a different
 * failure: nothing here can leak a supplier, but everything here can tell
 * a customer something that is not true. Three such lines were caught by
 * hand before this file existed --
 *
 *   - "locked for fifteen minutes" after three wrong tries, when the
 *     function has no timed lock at all and simply stops accepting that
 *     PIN;
 *   - "Nothing has been charged to this account yet" shown to anyone at
 *     zero, including a customer of ten years who had just paid up;
 *   - a telephone number carried over from the mockups that appears in no
 *     settings table and belongs to nobody.
 *
 * Each was a sentence the shop had not earned the right to say. They are
 * cheap to reintroduce and invisible in review, so they are pinned here.
 *
 * Run: node test/client-portal-page.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('client portal page');
const src = read('client.html');

/* ---------- a DOM small enough to reason about ------------------------ */
function makeDoc(ids) {
  const nodes = {};
  ids.forEach((id) => {
    nodes[id] = {
      id, textContent: '', innerHTML: '', hidden: false, className: '',
      style: { color: '', cssText: '', transform: '' },
      setAttribute() {}, 
    };
  });
  return { getElementById: (id) => nodes[id] || null, _nodes: nodes };
}

const IDS = ['whoName', 'whoLine', 'owedLbl', 'owedCur', 'owedFig', 'owedBasis',
  'termsSheet', 'ordersSheet', 'statementSince'];

function load() {
  const document = makeDoc(IDS);
  const fns = compileScope(
    ['esc', 'money', 'plural', 'longDate', 'renderAccount'].map(n => extractFunction(src, n, 'client.html'))
      .concat([extractFunction(src, 'longDate', 'client.html')].slice(0, 0)),
    { document, MONTHS: ['January','February','March','April','May','June','July','August','September','October','November','December'] },
    ['renderAccount', 'money', 'longDate', 'esc'],
  );
  return { fns, document };
}

/* ---------- 1. a paid-up customer has a past ------------------------- */
{
  const { fns, document } = load();
  fns.renderAccount({ account: { name: 'Nakato Grace', owed: 0, orderCount: 34 }, orders: [] });
  const basis = document._nodes.owedBasis.textContent;
  t.check(!/charged to this account yet/i.test(basis),
    `a customer at zero with 34 orders is not told nothing was ever charged (got "${basis}")`);
  t.check(document._nodes.owedFig.textContent === 'Nothing outstanding',
    'and the figure is a sentence rather than a 0');
  t.check(document._nodes.owedLbl.textContent === 'Your balance',
    'the label follows the figure -- "You owe / Nothing outstanding" is a contradiction');
  t.check(document._nodes.owedCur.hidden === true, 'UGX is hidden when there is no figure to carry it');
  t.check(!/9B3A22|--owe/.test(document._nodes.owedFig.style.cssText),
    'and oxide -- the colour that means money owed -- is nowhere on the screen');
}

/* ---------- 2. a genuinely new account may be told so ---------------- */
{
  const { fns, document } = load();
  fns.renderAccount({ account: { name: 'New Buyer', owed: 0, orderCount: 0 }, orders: [] });
  t.check(/charged to this account yet/i.test(document._nodes.owedBasis.textContent),
    'an account with no orders at all IS told nothing has been charged yet');
  t.check(/Nothing here yet/.test(document._nodes.ordersSheet.innerHTML),
    'and the empty order list names itself rather than rendering blank');
}

/* ---------- 3. money owed, and the basis under it -------------------- */
{
  const { fns, document } = load();
  fns.renderAccount({
    account: { name: 'Musoke Ltd', owed: 1240000, oldestDays: 2, termsDays: 30, creditLimit: 2000000, available: 760000, orderCount: 3 },
    orders: [{ id: 1, date: '2026-09-11', items: 9, total: 1240000, invoiced: true }],
  });
  t.check(document._nodes.owedLbl.textContent === 'You owe', 'a balance owing is labelled "You owe"');
  t.check(document._nodes.owedFig.textContent === '1,240,000',
    `the figure is grouped and never rounded (got "${document._nodes.owedFig.textContent}")`);
  t.check(/var\(--owe\)/.test(document._nodes.owedFig.style.cssText), 'and wears oxide');
  t.check(document._nodes.owedBasis.textContent === 'Oldest 2 days · on 30-day terms',
    `the basis states both facts (got "${document._nodes.owedBasis.textContent}")`);
  t.check(/760,000 still available/.test(document._nodes.termsSheet.innerHTML),
    'the limit row shows what is left of it');
}

/* ---------- 4. terms nobody agreed are never printed ----------------- */
/*
 * 0096 refuses to back-fill terms_days and credit_limit: null means nobody
 * said. A portal that prints "30 days" by default has put a promise on the
 * customer's screen that the shop never made, and the customer will hold
 * them to it.
 */
{
  const { fns, document } = load();
  fns.renderAccount({ account: { name: 'Walk-in', owed: 500000, oldestDays: 4, termsDays: null, creditLimit: null, available: null, orderCount: 1 }, orders: [] });
  const html = document._nodes.termsSheet.innerHTML;
  t.check(html === '' && document._nodes.termsSheet.hidden === true,
    'with no terms and no limit agreed, the sheet renders nothing and is hidden');
  t.check(!/day/i.test(document._nodes.owedBasis.textContent.replace(/\d+ days?\b/, '')),
    'and the basis line offers no terms either');
  t.check(document._nodes.owedBasis.textContent === 'Oldest 4 days',
    `just the age of the debt (got "${document._nodes.owedBasis.textContent}")`);
}

/* ---------- 5. terms without a limit, and the reverse ---------------- */
{
  const a = load(); a.fns.renderAccount({ account: { owed: 1, termsDays: 14, creditLimit: null, orderCount: 1 }, orders: [] });
  t.check(/14 days/.test(a.document._nodes.termsSheet.innerHTML) && !/limit/i.test(a.document._nodes.termsSheet.innerHTML),
    'terms agreed but no limit renders the terms row alone');
  const b = load(); b.fns.renderAccount({ account: { owed: 1, termsDays: null, creditLimit: 900000, available: null, orderCount: 1 }, orders: [] });
  const h = b.document._nodes.termsSheet.innerHTML;
  t.check(/900,000/.test(h) && !/still available/.test(h),
    'a limit with no available figure shows the limit and claims nothing about headroom');
}

/* ---------- 6. dates, and the count line ----------------------------- */
{
  const { fns, document } = load();
  t.check(fns.longDate('2026-09-11') === '11 September', 'a date reads as a person says it');
  t.check(fns.longDate('') === 'No date', 'and a missing one says so rather than printing NaN');
  fns.renderAccount({
    account: { owed: 0, orderCount: 34 },
    orders: [1,2,3,4,5].map(i => ({ id: i, date: '2026-09-0' + i, items: i, total: 1000 * i, invoiced: i % 2 === 0 })),
  });
  const html = document._nodes.ordersSheet.innerHTML;
  /* These two pinned the opposite until the orders screen was built: the
     count was STATED as a fact, and spent no verdigris, because a row
     that does nothing when tapped is how the accent stops meaning
     anything. Both were true when written. The screen exists now, so the
     row is an action again -- and the count stays in it, because "all 34"
     is what tells a customer whether the tap is worth making. */
  t.check(/All 34 orders/.test(html),
    `the count is offered as a way in (${(html.match(/All \d+ orders|Showing the[^<]*/) || [])[0]})`);
  t.check(/id="allOrders"/.test(html), 'as a control with a handler');
  t.check(/var\(--go\)/.test(html) && /#14594A/.test(html),
    'in verdigris, which it has now earned by leading somewhere');
  t.check(!/Showing the \d+ most recent/.test(html),
    'and no longer states it as a fact with nowhere to go');
  t.check(/1 item</.test(html) && /2 items</.test(html), 'one item is not "1 items"');
}

/* ---------- 7. the page never invents a telephone number ------------- */
/*
 * The mockups carried 0772 418 900 throughout. It is in no settings table,
 * no migration and no other file in the repo -- it was a plausible-looking
 * number chosen to make a drawing read well. Printed on a live page it
 * sends a customer to a stranger.
 */
{
  // Ugandan mobile numbers are ten digits and get written 0772 418 900,
  // 0772-418-900 or 0772418900 depending on who is typing. Match any run of
  // digits and separators that normalises to a 9- or 10-digit number
  // starting 0 or 256, rather than one grouping that happens to be the one
  // the mockups used.
  const runs = src.match(/\b(?:\+?256|0)[\d\s-]{7,15}\d\b/g) || [];
  const numbers = runs.filter(r => { const d = r.replace(/\D/g, ''); return d.length >= 9 && d.length <= 12; });
  const inPlaceholder = (src.match(/placeholder="[^"]*"/g) || []).join(' ');
  const live = numbers.filter(n => !inPlaceholder.includes(n.trim()));
  t.check(live.length === 0,
    `no telephone number is printed as fact (${live.length ? live.join(' | ') : 'none'})`);
  // Proof the matcher sees the number the mockups carried, in each of the
  // three shapes -- the first version of this check matched none of them.
  const shapes = ['0772 418 900', '0772-418-900', '0772418900', '+256772418900'];
  const blind = shapes.filter(x => !(x.match(/\b(?:\+?256|0)[\d\s-]{7,15}\d\b/g) || [])
    .some(m => m.replace(/\D/g, '').length >= 9));
  t.check(blind.length === 0, `the matcher recognises a number however it is written (${blind.join(', ') || 'all four'})`);
  t.check(/placeholder="0772 418 903"/.test(src),
    'one stays as a field placeholder, where it shows the shape of a number rather than naming one to ring');
}

/* ---------- 8. the PIN copy matches what the function does ----------- */
{
  const fn = read('supabase/functions/client-portal/index.ts');
  t.check(!/lock(ed)?\s+for|minutes?\s+lock|locked out/i.test(src),
    'the page promises no timed lock-out');
  t.check(!/setTimeout|lock/i.test(fn.slice(fn.indexOf('action === "verify"'), fn.indexOf('action === "account"'))) ||
    !/fifteen|15 minutes/.test(src),
    'because verify has none to promise -- three wrong tries and the PIN is simply finished');
  t.check(/ring the shop for a new one/i.test(src),
    'and the page says what actually happens instead');
  // The specific trap: after three tries the "Ask for another" button on
  // this very screen is the one thing that will NOT help, because start
  // refuses to mint past the ceiling. The page has to KNOW it is locked,
  // or the countdown runs out and cheerfully contradicts the message
  // above it.
  t.check(/let pinLocked = false;/.test(src), 'the page tracks being locked out');
  t.check(/err\.status === 429 \|\| left === 0/.test(src),
    'set both by the ceiling already reached and by this try reaching it');
  t.check(/if\(pinLocked\)\{[\s\S]{0,120}Ring the shop for a new PIN/.test(src),
    'and the countdown says so rather than "ask for another"');
  t.check(/b\.disabled = pinLocked;/.test(src),
    'and the button that would not work is disabled, not left looking live');
  t.check(/only the shop can let you back in/i.test(src),
    'the ceiling is named before it is hit, not only after');
  t.check(/PIN_MAX_ATTEMPTS = 3;/.test(fn) && /triesLeft/.test(src),
    'the count shown to the customer comes from the server, not from a number typed into the page');
}

/* ---------- 9. nothing supplier-shaped exists to leak ---------------- */
/*
 * The whole point of the third identity: there is no code path here to add
 * a supplier to. This fails the moment one appears.
 */
{
  // Comments go first, the way agent-catalog.test.js does it: the header
  // of client.html explains at length that no supplier is anywhere in the
  // file, and a sweep that reads its own documentation as a violation
  // teaches the next person to delete the explanation. `(?<!:)` keeps
  // https:// out of it. CSS `margin:` is likewise not the trading sense of
  // the word -- stripping the declaration rather than dropping `margin`
  // from the list keeps the one that matters, a response field called
  // margin, still caught.
  const prose = src
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n')
    // A CSS margin ends at a semicolon or the close of a style attribute.
    // A JavaScript object key does not -- `{ margin: p.margin }` runs on
    // to a comma or a brace -- so requiring the terminator clears the
    // spacing declarations and leaves a leak named `margin:` exposed.
    .replace(/\bmargin(-\w+)?\s*:\s*[^;"'}\n,]*[;"']/g, 'SPACING');
  // No \b on the supplier stems. `supplierSku` and `showSupplierName` are
  // exactly how one would really arrive -- camelCase, where a word boundary
  // does not exist -- and the first version of this sweep let both through.
  // `cost` and `margin` keep their boundaries: they are ordinary English
  // and the page is allowed to contain the word "costs" in a sentence.
  /* `cost` and `margin` are ordinary English and this file is mostly
     prose: "this is what it would cost you" is a sentence to a customer,
     not the shop's cost column. Banning the bare word made the sweep
     start arguing with the copy. What must never appear is either of them
     as a VALUE the page handles — a property read, an object key, or the
     start of a camelCase name — so that is what is matched. The supplier
     stems keep their bare-word ban: none of them has an innocent use. */
  const banned = /(supplier|wholesale|markup|rival[_ ]?price|sourcing[_ ]?lead)|[.'"\[]\s*(cost|margin)\b|\b(cost|margin)\s*:|\b(cost|margin)[A-Z]/i;
  const m = banned.exec(prose);
  t.check(!m, `the page names nothing supplier-shaped${m ? ` (found "${m[0]}")` : ''}`);
  // and the narrowing above is doing no more than it claims
  const strip = (x) => x.replace(/\bmargin(-\w+)?\s*:\s*[^;"'}\n,]*[;"']/g, 'SPACING');
  [['style="margin:0 auto;"', false], ['margin-top:2px;', false], ['style="margin:0"', false]]
    .forEach(([css, want]) => t.check(banned.test(strip(css)) === want, `CSS ${css} is cleared`));
  [['{ margin: p.margin }', true], ['{ cost: x }', true], ['it.margin', true]]
    .forEach(([js, want]) => t.check(banned.test(strip(js)) === want, `but ${js} is not`));
  // The sweep has to still be reading the page. Without this, a stripper
  // that returned '' would report a clean bill of health forever.
  t.check(prose.includes('renderAccount') && prose.includes('FN_URL')
    && prose.length > src.length / 3,
    `after stripping there is still a page to search (${prose.length} of ${src.length} chars)`);
  ['supplier_sku', 'supplierName', 'showSupplierId', 'wholesalePrice',
   'markupPct', 'rivalPrice', 'sourcingLead',
   // the narrowed forms: cost and margin as things the page HANDLES
   'p.cost', 'cost: 400', 'costPrice', 'it.margin', 'margin: 1', "row['cost']"].forEach(bad => {
    t.check(banned.test(prose + ' ' + bad), `and it would fail on ${bad}`);
  });
  // ...while leaving the copy alone.
  ['what it would cost you', 'at no cost', 'the cost of waiting'].forEach(ok => {
    t.check(!banned.test(ok), `and not on the sentence "${ok}"`);
  });
  t.check(!/service_role|SERVICE_ROLE|anon[_-]?key/i.test(src),
    'and carries no key -- every request is an unauthenticated POST the function authorises by token');
  /* Was "exactly one endpoint", which stopped being true the moment
     ordering landed: the page now also posts to client-submit-order. The
     count was never the point — where the customer's data goes is. Both
     URLs are built off SUPABASE_URL, so the claim is that every request
     leaves for this shop's own functions and nowhere else, which is the
     thing that would actually matter if it broke. */
  const targets = [...src.matchAll(/fetch\(\s*([A-Za-z_$][\w$]*|['"`][^'"`]*['"`])/g)].map(m => m[1]);
  t.check(targets.length >= 1, `every fetch target is found (${targets.join(', ') || 'none'})`);
  t.check(targets.every(x => x === 'FN_URL' || x === 'SUBMIT_URL'),
    `and each is one of this shop's own functions (${targets.join(', ')})`);
  const urls = (src.match(/^const (?:FN_URL|SUBMIT_URL) = .*$/gm) || []);
  t.check(urls.length === 2 && urls.every(u => /SUPABASE_URL\.replace/.test(u)),
    `both of which are built from the one project URL (${urls.length})`);
  /* The project URL used to be a bare `const SUPABASE_URL = '...'` and was
     stripped by name. It now lives inside the OW_ENV block, which names one
     URL per environment, so what is stripped is those lines instead. The
     claim is the one it always was: outside the single block that chooses
     a project, no host appears in this page at all. */
  t.check(!/https?:\/\/(?!fonts\.(googleapis|gstatic)\.com)[^"'\s)]+/.test(
    src.replace(/^\s*url: '[^']*',$/gm, '')),
    'and no other host appears in the page at all, bar the font CDN');
}

/* ---------- 10. verdigris is THE one action -------------------------- */
{
  const style = src.slice(src.indexOf('<style>'), src.indexOf('</style>'));
  const uses = (style.match(/var\(--go\)/g) || []).length;
  t.check(/\.btn-go\{background:var\(--go\)/.test(style), 'the filled button is verdigris');
  t.check(/outline:2px solid var\(--go\)/.test(style), 'focus borrows it, which is the same promise');
  t.check(/^\s*a\{color:var\(--go\)/m.test(style), 'links carry it');
  t.check(uses === 3, `and nothing else does (${uses} uses in the stylesheet)`);
  t.check(!/\.link\{/.test(style),
    'the .link class is gone -- it dressed a telephone number that was not a link');
}

process.exit(t.done() ? 1 : 0);
