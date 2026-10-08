#!/usr/bin/env node
'use strict';
/*
 * The agent's Clients tab.
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
 * while hunting for someone -- and hunting is what the search box is for.
 * The list is ordered by who needs seeing: late on their own rhythm
 * first, then due today, then anyone with an order on the way, then
 * whoever is due soonest; within a group, who you dealt with last.
 *
 * Run: node test/agent-customers.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('agent customers');
const src = read('agent.html');
const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

/* ---------- 1. the list has a heading, a count and an action -------- */
{
  t.check(/<h1>Clients <span id="ag_clientsCount"><\/span><\/h1>/.test(src),
    'the list is named and counted -- the count is its own element beside the label, with a real space before it');
  t.check(/\.ax-page-h h1 span\{[^}]*color:var\(--ink-soft\)/.test(src),
    'in a readable ink on the page ground');
  t.check(/agentClients\.length \|\| ''/.test(code), 'and an empty account shows no count rather than a zero');
  // Adding is the search box itself: type a name that is not there, and
  // the first row offers to add it. No separate button to find.
  const render = extractFunction(src, 'renderClientsListScreen', 'agent.html');
  t.check(/data-client-add/.test(render) && /Add &ldquo;/.test(render),
    'a name that is not on the list is offered as a new client, right where it was typed');
  t.check(/Add your first client/.test(render), 'and an empty list is one tap from its first client');
  t.check(/\.ax-cr\{\s*all:unset;box-sizing:border-box/.test(src) && /\.ax-ringav\{[^}]*width:44px;height:44px/.test(src),
    'every row is a full-width tap target, restoring border-box after all:unset');
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
  t.check(/if\(makeActive\) goToClientBasket\(inserted\);/.test(code),
    'and only selects when asked to');
  t.check(/openNewClientPanel\(typed, \(c\)=>\{[\s\S]{0,240}?\}, \{ makeActive: false \}\)/.test(code),
    'the Clients tab opts out -- saving a contact you just met does not swap the order you are building');
  // The order screen's own "add" is mid-order and does want the new
  // client to be the one the order is for.
  t.check(/openNewClientPanel\(typed, \(\)=>\{ if\(currentView === 'order'\) renderOrder\(\); \}\);/.test(code),
    'the order screen\'s picker still makes the client it just created the one the order is for');

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
    // The tie-breaker, transcribed from the render: within a group, who
    // you dealt with last, then by name.
    const cmp = (a, b) =>
      String(f(b.orders).lastAt || '').localeCompare(String(f(a.orders).lastAt || ''))
      || String(a.c.name || '').localeCompare(String(b.c.name || ''));
    const ord = (date) => ({ status: 'completed', voided: false, date, items: [{ sellPrice: 1, agentSellPrice: 2, qty: 1, bonusCommission: 0 }] });
    const rows = [
      { c: { name: 'Zawadi' }, orders: [ord('2026-01-05')] },
      { c: { name: 'Ahmed' }, orders: [ord('2026-08-01')] },
      { c: { name: 'Moses' }, orders: [ord('2026-07-20')] },
    ];
    const order = rows.slice().sort(cmp).map(r => r.c.name);
    t.check(order.join(',') === 'Ahmed,Moses,Zawadi', `within a group, most recent first (${order.join(' > ')})`);
  }
  const render = extractFunction(src, 'renderClientsListScreen', 'agent.html');
  t.check(/rows\.sort\(\(a,b\)=> a\.s\.rank - b\.s\.rank \|\| \(b\.s\.late\|\|0\) - \(a\.s\.late\|\|0\) \|\| \(a\.s\.soon\|\|0\) - \(b\.s\.soon\|\|0\)/.test(render),
    'the list leads with who needs seeing: the most overdue first, then whoever is due soonest');
  t.check(/String\(b\.stats\.lastAt\|\|''\)\.localeCompare\(String\(a\.stats\.lastAt\|\|''\)\)/.test(render),
    'and falls back to who you dealt with last');
  const status = extractFunction(src, 'clientStatus', 'agent.html');
  const rank = (re) => { const m = re.exec(status); return m ? Number(m[1]) : -1; };
  const late = rank(/rank: (\d), cls:'late'/), due = rank(/rank: (\d), cls:'due'/), live = rank(/rank: (\d), cls: st\.needs/), quiet = rank(/rank: (\d), cls:'', text:`Quiet/);
  t.check(late < due && due < live && live < quiet,
    `late, then due today, then an order on the way, and the quiet ones last (${[late, due, live, quiet].join(',')})`);
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

  // The search box is also how a client is added, so it is always there.
  t.check(/id="ag_clientListSearch" placeholder="Name or phone"/.test(src), 'the search box finds by name or phone');
  t.check(/No client matches &ldquo;\$\{esc\(q\)\}&rdquo;\./.test(code),
    'a search with no hits repeats what was searched for');
}

/* ---------- 5. arriving at the tab -------------------------------- */
{
  t.check(/if\(tab === 'clients'\)\{ document\.getElementById\('ag_clientListSearch'\)\.value = ''; renderClientsListScreen\(\); \}/.test(code),
    'a query left from the last visit is cleared on the way in');
}

process.exit(t.done() ? 1 : 0);
