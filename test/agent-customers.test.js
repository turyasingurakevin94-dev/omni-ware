#!/usr/bin/env node
'use strict';
/*
 * The agent Customers tab.
 *
 * A catalogue banner, the requests from it, and then -- with no heading of
 * its own -- the client list simply began. It was every client, in the
 * alphabetical order PostgREST returned them in, with no search and no way
 * to add one. The empty state said to add a client "when you build your
 * first quote", which was not advice: the quote screen was the only place
 * a client could be created at all, so meeting someone and saving their
 * number meant starting a quote you did not want.
 *
 * Alphabetical answers "where is X in the alphabet", which is only asked
 * while hunting for someone -- and hunting is what the search box added
 * here is for. Who you dealt with last is the more useful default.
 *
 * Run: node test/agent-customers.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('agent customers');
const src = read('agent.html');
const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

/* ---------- 1. the list has a heading, a count and an action -------- */
{
  // This used to pin the exact markup
  //
  //   <span>Your clients <span class="ag-seg-count" id="ag_clientsCount"></span></span>
  //
  // with the literal space called out, because without it the count runs
  // into the label and reads "Your clients12". The heading is a .fx-sec
  // now: the label and the count are separate flex children with a gap
  // between them, so the hazard the space guarded against cannot occur --
  // there is no text node for them to share. What is still pinned is that
  // the count is its own element beside the label rather than inside it.
  //
  // The count also had to leave .ag-seg-count. That class moved onto the
  // Orders segment control, which now sits on a dark header, so its text
  // went white -- and white on this screen's page ground is invisible.
  const head = (/<div class="fx-sec">\s*<h2>Your clients<\/h2>([\s\S]{0,600}?)<\/div>/.exec(src) || [])[1] || '';
  t.check(/id="ag_clientsCount"/.test(head),
    'the list is named and counted -- and the count is its own element beside the label, not run into it');
  t.check(!/ag-seg-count/.test(head),
    'and not on the class that turned white when the segment control moved to a dark ground');
  t.check(/\.fx-sec \.cnt\{[^}]*color:var\(--fx-ink-3\)/.test(src),
    'it is a readable ink on the page ground');
  t.check(/id="ag_addClientBtn"/.test(head), 'with an Add control beside it');
  t.check(/\.fx-sec-add\{[^}]*min-height:44px/.test(src), 'sized 44px for a thumb');
  t.check(/\.fx-sec-add\{[^}]*box-sizing:border-box/.test(src),
    'restoring border-box after all:unset, so 44 means 44');
  t.check(/\.fx-sec-add:focus-visible\{outline:/.test(src), 'with a visible focus ring');
  t.check(/agentClients\.length \|\| ''/.test(code),
    'and an empty account shows no count rather than a zero');
}

/* ---------- 2. adding a client does not hijack the quote ------------ */
/*
 * The panel already existed, but it always called selectClient(), which
 * parks the basket in hand and switches the Sell screen to the new client.
 * Right for the two callers that are mid-quote. Wrong for "I just met
 * someone, let me save their number".
 */
{
  t.check(/function openNewClientPanel\(prefillName, onDone, \{ makeActive = true \} = \{\}\)/.test(code),
    'the panel takes an opt-out, defaulting to the behaviour its existing callers rely on');
  t.check(/if\(makeActive\) selectClient\(inserted\);/.test(code),
    'and only selects when asked to');
  t.check(/openNewClientPanel\('', \(\)=>\{[\s\S]{0,200}?\}, \{ makeActive: false \}\)/.test(code),
    'the Customers tab opts out');

  // The two mid-quote callers must NOT have been changed.
  t.check(/openNewClientPanel\(typed, \(\)=> switchTab\('sell'\)\);/.test(code),
    'the new-quote sheet still selects the client it just created');
  t.check(/openNewClientPanel\(query\.trim\(\)\)/.test(code),
    'and so does the quote screen\'s own "add new"');

  t.check(/\bsaveClientBtn\.disabled = true;/.test(code),
    'the double-tap guard on the save button is still there');
}

/* ---------- 3. ordered by who you dealt with last ------------------- */
{
  let f = null;
  try {
    ({ clientStats: f } = compileScope(
      [extractFunction(src, 'orderTotal', 'agent.html'),
        extractFunction(src, 'agentLinePriced', 'agent.html'),
        extractFunction(src, 'orderEarnings', 'agent.html'),
       extractFunction(src, 'orderDate', 'agent.html'), extractFunction(src, 'clientStats', 'agent.html')],
      {}, ['clientStats'],
    ));
  } catch (e) { /* reported below */ }
  t.check(typeof f === 'function', 'clientStats compiles');

  if (f) {
    // The comparator, transcribed from the render.
    const cmp = (a, b) =>
      String(f(b.orders).lastAt || '').localeCompare(String(f(a.orders).lastAt || ''))
      || String(a.c.name || '').localeCompare(String(b.c.name || ''));
    const ord = (date) => ({ status: 'completed', voided: false, date, items: [{ sellPrice: 1, agentSellPrice: 2, qty: 1, bonusCommission: 0 }] });
    const rows = [
      { c: { name: 'Zawadi' }, orders: [ord('2026-01-05')] },
      { c: { name: 'Ahmed' }, orders: [ord('2026-08-01')] },
      { c: { name: 'Bugolobi' }, orders: [] },
      { c: { name: 'Moses' }, orders: [ord('2026-07-20')] },
      { c: { name: 'Aaron' }, orders: [] },
    ];
    const order = rows.slice().sort(cmp).map(r => r.c.name);
    t.check(order.join(',') === 'Ahmed,Moses,Zawadi,Aaron,Bugolobi',
      `most recent first, never-ordered last, ties by name (${order.join(' > ')})`);
    t.check(order.indexOf('Bugolobi') > order.indexOf('Zawadi'),
      'a client who has never ordered sorts to the end, not into the middle on an empty date');
    t.check(order.indexOf('Aaron') < order.indexOf('Bugolobi'),
      'and the never-ordered ones are alphabetical among themselves rather than arbitrary');
  }

  t.check(/\.sort\(\(a,b\)=> String\(clientStats\(b\.orders\)\.lastAt\|\|''\)\.localeCompare\(String\(clientStats\(a\.orders\)\.lastAt\|\|''\)\)/.test(code),
    'which is what the screen does');
}

/* ---------- 4. finding one --------------------------------------- */
{
  let f = null;
  try { ({ clientMatchesQuery: f } = compileScope([extractFunction(src, 'clientMatchesQuery', 'agent.html')], {}, ['clientMatchesQuery'])); }
  catch (e) { /* reported below */ }
  t.check(typeof f === 'function', 'clientMatchesQuery compiles');
  if (f) {
    const c = { name: 'Moses Ssebunya', phone: '+256 701 222 333', location: 'Ntinda' };
    t.check(f(c, 'moses') === true, 'by name');
    t.check(f(c, 'ssebunya') === true, 'including the part of the name you remember');
    t.check(f(c, '701') === true, 'by the number in your phone');
    t.check(f(c, 'ntinda') === true, 'or by where they are');
    t.check(f(c, '') === true, 'an empty query matches everyone');
    t.check(f(c, 'zzz') === false, 'and a miss is a miss');
    t.check(f({}, 'x') === false, 'a client with no details at all does not throw');
  }

  // Furniture control: a search box above three names is noise.
  t.check(/const CLIENT_SEARCH_MIN = 8;/.test(code), 'the search box has a threshold');
  t.check(/searchWrap\.style\.display = agentClients\.length >= CLIENT_SEARCH_MIN \? 'block' : 'none';/.test(code),
    'and appears only once the list is long enough to need it');
  t.check(/No client matches &ldquo;\$\{esc\(q\)\}&rdquo;\./.test(code),
    'a search with no hits repeats what was searched for');
}

/* ---------- 5. arriving at the tab -------------------------------- */
{
  t.check(/if\(tab==='customers'\)\{ document\.getElementById\('ag_clientListSearch'\)\.value = ''; renderClientsListScreen\(\); \}/.test(code),
    'a query left from the last visit is cleared on the way in, as on order history');
  t.check(/add the first one above, or one gets saved the next time you build a quote/.test(code),
    'and the empty state points at the button above it instead of sending the agent to the quote screen');
}

process.exit(t.done() ? 1 : 0);
