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
// Buttons wired by renderInquiries land here so a click can be replayed.
const wired = [];
const NAMES = ['inquiryAgoLabel', 'inquiryProductLabel', 'inquiriesForDisplay', 'renderInquiries', 'toggleInquiryHandled'];
// The Clients tab shows requests two ways: the open ones on top of the
// list, and all of them (handled ones too) under the "Asked" filter.
const FILTER_SRC = "let clientFilter = 'asked'; function setClientFilter(f){ clientFilter = f; }";
const env = {
  document: {
    getElementById: (id) => Object.assign(el(id), {
      // renderInquiries queries the markup it just wrote to attach handlers.
      querySelectorAll: () => {
        wired.length = 0;
        const ids = [...String(el(id).innerHTML).matchAll(/class="ag-inquiry-done" data-inq="([^"]*)"/g)].map((m) => m[1]);
        return ids.map((v) => ({ dataset: { inq: v }, addEventListener: (_e, fn) => wired.push({ inq: v, fn }) }));
      },
    }),
  },
  catalog, myInquiries,
  currentShopId: 'shop-1',
  toast: (m) => { env.__toast = m; },
  saveOfflineCache: () => { env.__cached = (env.__cached || 0) + 1; },
  esc: (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
  sb: { from: () => ({ update: (v) => { env.__update = v; return { eq: () => ({ eq: () => Promise.resolve({ error: env.__err || null }) }) }; } }) },
  AX_ICON: { chat: '<svg></svg>', check: '<svg></svg>', phone: '<svg></svg>' },
  firstWord: (n) => String(n || '').trim().split(/\s+/)[0] || 'them',
};
const scope = compileScope([FILTER_SRC, ...NAMES.map((n) => extractFunction(src, n, 'agent.html'))], env, NAMES.concat(['setClientFilter']));
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
  t.check(/Asked through your link/.test(html), 'the section is headed');
  t.check(/Need 40 by Friday/.test(html),
    'the message the customer actually typed is on screen — the whole point of this');
  t.check(/Sofa Legs · Gold \/ 6&quot;/.test(html), 'alongside what they asked about');
  t.check(/No details given/.test(html),
    'and a request with no message says so rather than showing an empty gap');
  t.check((html.match(/ag-inquiry-card/g) || []).length === 2, 'one card per request');
}
{
  setInquiries([]);
  scope.setClientFilter('all');
  t.check(render() === '',
    'no requests renders nothing at all — no empty-state clutter above the client list');
  scope.setClientFilter('asked');
  t.check(/Nobody has asked/.test(render()),
    'while the Asked filter, chosen on purpose, says so rather than showing a blank');
  // Above the list, only what still needs a call -- the handled ones are
  // under Asked, so finished work never pushes clients down the screen.
  setInquiries([
    { id: 1, customer_name: 'A', customer_phone: '07', message: 'm', created_at: ago(1), handled_at: ago(1) },
    { id: 2, customer_name: 'B', customer_phone: '07', message: 'm', created_at: ago(2) },
    { id: 3, customer_name: 'C', customer_phone: '07', message: 'm', created_at: ago(3) },
    { id: 4, customer_name: 'D', customer_phone: '07', message: 'm', created_at: ago(4) },
  ]);
  scope.setClientFilter('all');
  const top = render();
  t.check((top.match(/ag-inquiry-card/g) || []).length === 2 && !/ag-inquiry-card handled/.test(top),
    'above the client list: the two newest open requests, and nothing handled');
  scope.setClientFilter('asked');
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
  const guard = extractFunction(src, 'wouldWipeCachedData', 'agent.html');
  t.check(/wipes\(myInquiries, prev\.myInquiries\)/.test(guard),
    'and an empty read cannot overwrite cached requests — they are never deleted, so empty-where-stored-has-rows is always a blip');
  const lost = extractFunction(src, 'readLostRows', 'agent.html');
  t.check(!/inquir/i.test(lost),
    'but their absence never escalates to the whole-screen warning, since their load is non-fatal by design');
}
{
  const screen = extractFunction(src, 'renderClientsListScreen', 'agent.html');
  t.check(/renderInquiries\(\)/.test(screen),
    'the Clients screen draws them');
  const iLink = src.indexOf('id="ag_shopLinkBtn"');
  const iInq = src.indexOf('id="ag_inquiriesWrap"');
  const iList = src.indexOf('id="ag_clientsListWrap"');
  t.check(iLink > -1 && iInq > iLink && iList > iInq,
    'under the shop link that brings them in, and above the client list');
}

/* ---------- 6. outstanding vs handled --------------------------------- */
/*
 * "Handled", not "read". A read flag set by looking at the screen clears
 * itself the moment the agent opens Customers for any other reason, so a
 * request glanced at on the bus and one actually called back would look
 * identical -- which is the distinction worth keeping.
 */
{
  setCatalog([]);
  setInquiries([
    { id: 1, customer_name: 'Old handled', customer_phone: '07', message: 'a', created_at: ago(10), handled_at: ago(5) },
    { id: 2, customer_name: 'Newest open', customer_phone: '07', message: 'b', created_at: ago(1) },
    { id: 3, customer_name: 'Older open', customer_phone: '07', message: 'c', created_at: ago(100) },
  ]);
  const { open, done, list } = scope.inquiriesForDisplay();
  t.check(open.length === 2 && done.length === 1, 'outstanding and handled are counted apart');
  t.check(list.map((r) => r.id).join(',') === '2,3,1',
    `outstanding first and newest first within each, handled last (${list.map((r) => r.id).join(',')})`);
}
{
  const html = render();
  t.check(/ag-inquiry-count">2</.test(html),
    'the heading carries the number still needing a call, not the total');
  t.check((html.match(/ag-inquiry-card handled/g) || []).length === 1,
    'a handled request is marked as such rather than removed');
  t.check(/aria-label="Done"/.test(html) && /<button[^>]*aria-label="Undo"/.test(html),
    'each offers the action that applies to it — Done when open, Undo when handled');
  t.check(/aria-pressed="true"/.test(html), 'and the tick says, to a screen reader too, which state it is in');
}
{
  setInquiries([{ id: 1, customer_name: 'A', customer_phone: '07', message: 'm', created_at: ago(1), handled_at: ago(1) }]);
  const html = render();
  t.check(!/ag-inquiry-count/.test(html),
    'with nothing outstanding the heading carries no count at all, rather than a zero');
}
{
  // Handled ones are the first to fall off the cap, so a long tail of
  // finished work can never push a live request out of sight.
  const rows = [];
  for (let i = 0; i < 30; i++) rows.push({ id: 100 + i, customer_name: 'done' + i, customer_phone: '07', message: 'm', created_at: ago(500 + i), handled_at: ago(1) });
  rows.push({ id: 1, customer_name: 'live', customer_phone: '07', message: 'm', created_at: ago(999) });
  setInquiries(rows);
  const shown = scope.inquiriesForDisplay().list;
  t.check(shown.length === 20 && shown[0].id === 1,
    `the outstanding one survives 30 handled ones and leads the list (${shown.length} shown, first ${shown[0].id})`);
}

/* ---------- 7. marking one is applied, and undone if refused ---------- */
{
  setInquiries([{ id: 7, customer_name: 'Grace', customer_phone: '07', message: 'm', created_at: ago(5) }]);
  render();
  env.__err = null; env.__update = null; env.__cached = 0;

  return (async () => {
    await scope.toggleInquiryHandled(7);
    t.check(!!myInquiries[0].handled_at, 'marking a request Done sets it handled');
    t.check(env.__update && typeof env.__update.handled_at === 'string',
      'and writes a timestamp, not just a flag, so when it happened is on record');
    t.check(env.__cached === 1, 'the offline snapshot is updated too, so it survives a reload');

    await scope.toggleInquiryHandled(7);
    t.check(myInquiries[0].handled_at === null && env.__update.handled_at === null,
      'and Undo puts it back to outstanding');

    // A refused write must not leave the screen claiming something the
    // server never accepted.
    env.__err = { message: 'offline' };
    env.__cached = 0;
    await scope.toggleInquiryHandled(7);
    t.check(myInquiries[0].handled_at === null,
      'a refused write is rolled back rather than left showing as done');
    t.check(/Could not save/.test(env.__toast || ''), 'and the agent is told');
    t.check(env.__cached === 0, 'with nothing written to the offline snapshot either');

    // Clicking a button the render wired must reach the same path.
    env.__err = null;
    setInquiries([{ id: 9, customer_name: 'B', customer_phone: '07', message: 'm', created_at: ago(2) }]);
    render();
    t.check(wired.length === 1 && wired[0].inq === '9',
      `the rendered Done button is wired to its own request (${wired.length} wired)`);
    await wired[0].fn();
    t.check(!!myInquiries[0].handled_at, 'and clicking it marks that request handled');

    /* ---------- 8. the agent may mark, and only mark ------------------ */
    const mig = read('supabase/migrations/0039_inquiry_handled_state.sql');
    t.check(/add column handled_at timestamptz/.test(mig),
      'the state is a nullable timestamp, so "never handled" is simply absent');
    t.check(/create policy "agent handles own inquiries" on catalogue_inquiries\s+for update/.test(mig),
      'the agent may update their own requests');
    // Comments stripped: the migration explains itself by contrast with
    // agent_clients' `for all`, and scanning that as SQL reports a policy
    // this file exists to argue against.
    const migSql = mig.split(/\r?\n/).filter((l) => !/^\s*--/.test(l)).join('\n');
    t.check(!/for all|for delete|for insert/.test(migSql),
      'and only update — inserts belong to the public form, and there is no reason to delete a record of what a customer asked');
    t.check(/using \(agent_id = current_agent_id\(shop_id\)\)/.test(mig)
      && /with check \(agent_id = current_agent_id\(shop_id\)\)/.test(mig),
      'scoped to their own on both sides, so one agent cannot clear another\'s');

    /* ---------- 9. the guard must be escapable ---------------------- */
    /*
     * GUARD 2 keeps cached data when a read comes back empty where the
     * snapshot has rows, because a stale token looks exactly like that.
     * Its own comment says the escape hatch is a PROVABLY FRESH session --
     * force a token refresh, and believe a second empty answer.
     *
     * The code never checked whether that refresh succeeded, so there was
     * no escape at all. A shop deleting an agent's orders left every later
     * load looking like a blip: the app served the pre-deletion snapshot
     * forever, kept showing orders that no longer existed, and -- because
     * that branch returns before the fresh rows are assigned -- could never
     * show anything new either. A catalogue request that arrived after the
     * deletion was unreachable no matter how many times the agent
     * refreshed. Found in production, on exactly that sequence.
     */
    const load = extractFunction(src, 'loadAgentHomeData', 'agent.html');
    t.check(/let sessionProvenFresh = false;/.test(load)
      && /sessionProvenFresh = true;/.test(load),
      'the load records whether it managed to renew the token');
    const iSet = load.indexOf('sessionProvenFresh = true;');
    const iRetry = load.indexOf('rows = await fetchAgentHomeRows();', iSet);
    t.check(iSet > -1 && iRetry > iSet,
      'and only counts it fresh once the renewal has actually succeeded, before re-reading');
    t.check(/if\(readLostRows\(rows, cached\) && !sessionProvenFresh\)\{/.test(load),
      'so an empty answer on a renewed token is believed rather than treated as a blip forever');
    t.check(/if\(sessionProvenFresh\) saveOfflineCache\(true\);/.test(load),
      'and the stale snapshot is overwritten, so the deleted rows cannot come back offline');

    const save = extractFunction(src, 'saveOfflineCache', 'agent.html');
    t.check(/function saveOfflineCache\(trusted\)/.test(save)
      && /if\(!trusted && wouldWipeCachedData/.test(save),
      'the wipe-guard is bypassed only for a caller that has proven the snapshot real');
    // Every other caller must keep the guard.
    const untrusted = (src.match(/saveOfflineCache\(\)/g) || []).length;
    t.check(untrusted >= 5,
      `every other call still goes through the guard (${untrusted} of them)`);

    process.exit(t.done() ? 1 : 0);
  })();
}
