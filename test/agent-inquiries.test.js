#!/usr/bin/env node
'use strict';
/*
 * Catalogue requests in the agent app.
 *
 * catalogue-public has always written these, 0025 has always had a policy
 * letting the agent read them, and nothing ever did. The public form asks
 * "What do you need? Quantity, delivery timing, anything else useful" and
 * that text went into a table no screen looked at -- the agent got a name
 * and a phone number with no idea what was wanted.
 *
 * Everything here arrives from a form with no session behind it, so the
 * escaping is not a formality: it is the boundary between a stranger's
 * keyboard and the agent's screen.
 *
 * Run: node test/agent-inquiries.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('agent inquiries');
const src = read('agent.html');

/* ---------- a DOM small enough to assert against --------------------- */
const els = {};
const el = (id) => (els[id] = els[id] || { id, innerHTML: '' });
const catalog = [];
const myInquiries = [];
const scope = compileScope(
  ['inquiryAgoLabel', 'inquiryProductLabel', 'renderInquiries']
    .map((n) => extractFunction(src, n, 'agent.html')),
  {
    document: { getElementById: el },
    catalog, myInquiries,
    esc: (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
  },
  ['inquiryAgoLabel', 'inquiryProductLabel', 'renderInquiries'],
);
const setInquiries = (rows) => { myInquiries.length = 0; rows.forEach((r) => myInquiries.push(r)); };
const setCatalog = (rows) => { catalog.length = 0; rows.forEach((r) => catalog.push(r)); };
const render = () => { scope.renderInquiries(); return el('ag_inquiriesWrap').innerHTML; };
const ago = (mins) => new Date(Date.now() - mins * 60000).toISOString();

/* ---------- 1. how long ago, coarsely -------------------------------- */
{
  const cases = [[0, 'just now'], [1, '1 min ago'], [45, '45 min ago'], [60, '1 hour ago'],
    [60 * 5, '5 hours ago'], [60 * 24, '1 day ago'], [60 * 24 * 3, '3 days ago']];
  const wrong = cases.filter(([m, want]) => scope.inquiryAgoLabel(ago(m)) !== want);
  t.check(wrong.length === 0,
    wrong.length
      ? `elapsed labels are off: ${wrong.map(([m, w]) => `${m}m wanted "${w}" got "${scope.inquiryAgoLabel(ago(m))}"`).join('; ')}`
      : `elapsed time reads plainly at every scale (${cases.length} cases)`);
  t.check(scope.inquiryAgoLabel(null) === '' && scope.inquiryAgoLabel('not a date') === '',
    'a missing or unparseable timestamp says nothing rather than "NaN min ago"');
  t.check(scope.inquiryAgoLabel(new Date(Date.now() + 60000).toISOString()) === '',
    'and a timestamp in the future says nothing rather than a negative age');
}

/* ---------- 2. the product, only when it can be named ---------------- */
{
  setCatalog([{ productId: 'P1', variantIdx: 0, name: 'Sofa Legs', variantLabel: 'Gold / 6"' },
    { productId: 'P2', variantIdx: null, name: 'Hinges' }]);
  t.check(scope.inquiryProductLabel({ product_id: 'P1', variant_idx: '0' }) === 'Sofa Legs · Gold / 6"',
    'a variant is named with its label');
  t.check(scope.inquiryProductLabel({ product_id: 'P2', variant_idx: null }) === 'Hinges',
    'a plain product is named on its own');
  t.check(scope.inquiryProductLabel({ product_id: 'GONE', variant_idx: '3' }) === ''
    && scope.inquiryProductLabel({ product_id: null }) === '',
    'a product no longer in the catalogue, or none at all, yields nothing to show');
  // The catalogue is loaded by a different screen and may simply not be
  // there yet -- this must degrade, not throw.
  setCatalog([]);
  t.check(scope.inquiryProductLabel({ product_id: 'P1', variant_idx: '0' }) === '',
    'and an unloaded catalogue is silent rather than an error');
}

/* ---------- 3. nothing from a public form becomes markup -------------- */
/*
 * The one that matters. Name, phone and message are typed by a stranger on
 * a page with no login, and land on the agent's screen.
 */
{
  setCatalog([]);
  setInquiries([{
    id: 1, customer_name: '<img src=x onerror=alert(1)>', customer_phone: '<b>07</b>',
    message: '<script>alert("xss")</script> & "quoted"', created_at: ago(5),
  }]);
  const html = render();
  t.check(!/<img|<script|<b>/.test(html),
    'no tag from the form survives into the markup');
  t.check(/&lt;img src=x onerror=alert\(1\)&gt;/.test(html),
    'the name is shown as the literal text it is');
  t.check(/&lt;script&gt;/.test(html) && /&amp;/.test(html) && /&quot;/.test(html),
    'and so are the message\'s tags, ampersands and quotes');
}
{
  // The phone goes into a tel: href, which is a different context again.
  setInquiries([{ id: 1, customer_name: 'A', customer_phone: '0772 123 456"onmouseover="x', message: null, created_at: ago(5) }]);
  const html = render();
  const href = /href="tel:([^"]*)"/.exec(html);
  t.check(href && /^[\d+]*$/.test(href[1]),
    `the dialled number is digits and plus only, whatever was typed (got "${href ? href[1] : 'no link'}")`);
  // The phone is ALSO displayed as text, so the word "onmouseover" appears
  // in the markup legitimately -- escaped. What must not appear is a real
  // attribute, which needs an unescaped quote to close the one before it.
  t.check(/&quot;onmouseover=&quot;/.test(html),
    'the phone shown as text has its quotes escaped, so it stays text');
  t.check(!/\s+onmouseover\s*=\s*["'a-z]/i.test(html),
    'and no attribute is smuggled through the phone field');
}

/* ---------- 4. what the agent actually sees --------------------------- */
{
  setCatalog([{ productId: 'P1', variantIdx: 0, name: 'Sofa Legs', variantLabel: 'Gold / 6"' }]);
  setInquiries([
    { id: 1, customer_name: 'Grace Nakato', customer_phone: '0772123456', product_id: 'P1', variant_idx: '0',
      message: 'Need 40 by Friday', created_at: ago(25) },
    { id: 2, customer_name: 'Mustafa', customer_phone: '0700000001', message: null, created_at: ago(300) },
  ]);
  const html = render();
  t.check(/Requests from your catalogue/.test(html), 'the section is headed');
  t.check(/Need 40 by Friday/.test(html),
    'the message the customer actually typed is on screen — the whole point of this');
  t.check(/Sofa Legs · Gold \/ 6&quot;/.test(html), 'alongside what they asked about');
  t.check(/No details given/.test(html),
    'and a request with no message says so rather than showing an empty gap');
  t.check((html.match(/ag-inquiry-card/g) || []).length === 2, 'one card per request');
}
{
  setInquiries([]);
  t.check(render() === '',
    'no requests renders nothing at all — no empty-state clutter above the client list');
}
{
  // The query already caps at 50; the screen shows fewer still. A wall of
  // old requests buries the new ones.
  setInquiries(Array.from({ length: 40 }, (_, i) => ({ id: i, customer_name: 'C' + i, customer_phone: '07', message: 'm', created_at: ago(i) })));
  t.check((render().match(/ag-inquiry-card/g) || []).length === 20,
    'a long history is capped so the newest stay visible');
}

/* ---------- 5. the data actually reaches the screen ------------------- */
{
  const fetchFn = extractFunction(src, 'fetchAgentHomeRows', 'agent.html');
  t.check(/from\('catalogue_inquiries'\)/.test(fetchFn) && /\.order\('created_at', \{ ascending: false \}\)/.test(fetchFn),
    'requests are fetched newest first');
  t.check(/inquiries: inquiriesData \|\| \[\]/.test(fetchFn),
    'and returned alongside clients and orders');
  // A failure here must not take the screen down with it.
  t.check(/if\(inquiriesErr\) console\.warn/.test(fetchFn) && !/if\(inquiriesErr\) throw/.test(fetchFn),
    'a failure to load them is logged, not thrown — the client list still works without them');
  t.check(/if\(clientsErr\) throw/.test(fetchFn) && /if\(ordersErr\) throw/.test(fetchFn),
    'while clients and orders are still fatal, as before');
}
{
  const load = extractFunction(src, 'loadAgentHomeData', 'agent.html');
  t.check(/myInquiries = rows\.inquiries;/.test(load),
    'a fresh load fills them');
  t.check(/myInquiries = cached\.myInquiries \|\| \[\];/.test(load),
    'and the offline path restores them, so they do not vanish when the signal does');
  t.check(/myAgent, currentShopId, agentClients, myOrders, myInquiries, catalog/.test(src),
    'because the offline snapshot carries them');
}
{
  const screen = extractFunction(src, 'renderClientsListScreen', 'agent.html');
  t.check(/renderInquiries\(\)/.test(screen),
    'the Customers screen draws them');
  const iCat = src.indexOf('id="ag_catalogueWrap"');
  const iInq = src.indexOf('id="ag_inquiriesWrap"');
  const iList = src.indexOf('id="ag_clientsListWrap"');
  t.check(iCat > -1 && iInq > iCat && iList > iInq,
    'directly under the catalogue card that promised them, and above the client list');
}

process.exit(t.done() ? 1 : 0);
