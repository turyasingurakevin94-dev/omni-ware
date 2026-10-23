#!/usr/bin/env node
'use strict';
/*
 * Audit round 6, wording and consistency (store.html only; docs/audit/store/ROUND-6.md).
 *
 *   WORD-01 one resolver for every name: the name they chose, never a login handle.
 *   WORD-02 the shift is "passed"; "hand over" is only for goods at the gate.
 *   WORD-03 one label, "Not paid yet", and one reason.
 *   WORD-04 one definition per count: To pack is ready only; delivered includes collected.
 *   WORD-05 With Ruth lists every yard ask, each with who sent it.
 *   WORD-06 a trip check-in difference is a check-in, never a count.
 *   WORD-07 how long is "9 h 41 m"; when is "15:20" today, "Thu 23:28" otherwise.
 *   WORD-08 a trip is a trip, "trip · 3 suppliers"; never a round.
 *   WORD-09 stock history names the order; units are lower case.
 *   WORD-10 the bell counts what needs you, and opening Alerts reads it.
 *
 * Run: node test/store-round6.test.js
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('audit round 6: wording and consistency');
const store = read('store.html');
// A one-line function is its own line; a longer one is brace-matched.
const fn = n => { const l = store.split('\n').find(x => x.startsWith('function ' + n + '(')); return l && (l.match(/\{/g) || []).length === (l.match(/\}/g) || []).length ? l : extractFunction(store, n); };
// What a person reads: the app's code without its comments.
const code = store.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '');

// WORD-01
{
  const S = { user: { id: 'u-musa' }, data: {
    staff: [{ id: 'W1', name: 'Musa Kiggundu', userId: 'u-musa' }, { id: 'W5', name: 'turyasingurakevin94', userId: 'u-denis' }, { id: 'W2', name: 'joyn7', userId: 'u-joy' }, { id: 'W3', name: 'Ssali', userId: null }],
    members: [{ userId: 'u-denis', name: 'turyasingurakevin94' }, { userId: 'u-denis', name: 'Denis Okello' }, { userId: 'u-joy', name: 'joyn7' }, { userId: 'u-grace', name: 'Grace Akello' }, { userId: 'u-x', name: 'The Store' }] } };
  const P = compileScope([fn('looksHandle'), fn('personName')], { S, myName: () => 'Musa Kiggundu' }, ['personName']);
  t.check(P.personName({ staffId: 'W5' }) === 'Denis Okello', 'a staff record named like a login gives way to the name the person chose');
  t.check(P.personName({ userId: 'u-grace' }) === 'Grace Akello', 'a login with no staff record is named by the name they chose');
  t.check(P.personName({ staffId: 'W2' }) === 'Someone' && P.personName({ userId: 'u-x', stored: 'joy@mukasa.ug' }) === 'Someone', 'a handle or an email is never shown: "Someone"');
  t.check(P.personName({ staffId: 'W3' }) === 'Ssali' && P.personName({ userId: 'u-gone', stored: 'Peter Sserwadda' }) === 'Peter Sserwadda', 'a driver with no login, and a name stored with an old row, still read as written');
  t.check(P.personName({ staffId: 'W1' }) === 'Musa Kiggundu', 'the person holding the phone is their own name');
  t.check(/function staffName\(id\)\{ if \(!id\) return ''; return personName\(\{ staffId: id \}\); \}/.test(store) && /function nameEveryone\(\)\{/.test(store)
    && /nameEveryone\(\);\n  S\.loadedAt = Date\.now\(\); S\.loadErr = null;/.test(store) && /S\.data = snap\.data; nameEveryone\(\);/.test(store), 'staffName and every row that lands go through personName');
  t.check(/const st = myStaff\(\), sn = st && \(st\.recName != null \? st\.recName : st\.name\); if \(sn && !looksHandle\(sn\)\) return sn;/.test(store), 'your own staff record named like a login is not your name either');
}
// WORD-02
t.check(/End my shift · pass the yard to \$\{esc\(firstWord\(mate\.name\)\)\}/.test(store) && (store.match(/<b>Pass the yard<\/b>/g) || []).length === 2 && /passed you the yard/.test(store)
  && !/Hand over the yard|Hand the yard to|handed you the yard|>Hand it to /.test(code), 'the shift is passed; "hand over" stays at the gate');
t.check(/Slide to hand over to \$\{firstWord\(whoName\) \|\| whoName\}/.test(store), 'the gate keeps "Slide to hand over to …"');
// WORD-03
t.check(/const NOT_PAID = 'Not paid yet';/.test(store) && /function notPaidWhy\(\)\{ return `Sales take the money before it leaves, or \$\{managerName\(\)\} lets it go on credit\.`; \}/.test(store), 'one label and one reason');
t.check(!/waits on (the )?money|Waits on money|cash customer|CASH CUSTOMER|'a hold', 'holds'/.test(code.replace('/cash customer/i.test(e.message', '')), 'no "waits on money", "holds" or "cash customer" on any screen');
t.check(/hold \? \(loadAskOf\(q\) \? 'with ' \+ managerName\(\) : NOT_PAID\)/.test(store) && /\$\{NOT_PAID\.toUpperCase\(\)\}/.test(store) && /return hold \? \[NOT_PAID,/.test(store), 'the bay, the stamp and the order view say "Not paid yet"');
// WORD-04
t.check(/function counts\(\)\{ return memo\('counts', \(\) => \{ const done = doneToday\(\); return \{ toPack: packQueue\(\)\.length, waitingGoods: waitingOnGoods\(\)\.length, delivered: done\.length, collected: done\.filter\(orderIsPickup\)\.length,/.test(store), 'one counts(), shared');
t.check(/const N = counts\(\), done = N\.delivered, road = N\.road, packed = N\.packed, pack = N\.toPack;/.test(store) && /tile\('tpack', CV\.pack, pack, 'to pack', false, null, N\.waitingGoods \? `\+\$\{N\.waitingGoods\} waiting` : ''\)/.test(store)
  && !/packQueue\(\)\.length \+ waitingOnGoods\(\)\.length/.test(store), 'Today\'s "to pack" is ready only, with "+N waiting" beside it');
t.check(/\[done\.length, 'delivered today'\], \[collected\.length, 'of them collected'\]/.test(store), 'On the road: delivered includes collected');
// WORD-05 / WORD-06
t.check(/\(D\(\)\.counts \|\| \[\]\)\.filter\(c => c\.status === 'sent' \|\| mine\(c\.countedBy\)\)/.test(store) && /\(D\(\)\.returns \|\| \[\]\)\.filter\(r => r\.status === 'sent' \|\| mine\(r\.by\)\)/.test(store)
  && /\(D\(\)\.reports \|\| \[\]\)\.filter\(r => r\.status === 'sent' \|\| mine\(r\.by\)\)/.test(store) && /who = yours \? 'You' : firstWord\(personName/.test(store), 'With Ruth lists everyone\'s asks, with who sent each');
t.check(/R\.waiting\.filter\(w => w\.mine\)\.length === 1 \? 'is yours' : 'are yours'/.test(store) && /waits = ruthAsks\(\)\.waiting\.filter\(w => w\.mine\);/.test(store), 'the strip counts yours; passing the yard moves only yours');
t.check(/title: `Your check-in of \$\{trip\}`/.test(store) && /accepted your check-in/.test(store) && !/Accepted your count · \$\{n0\(l\.yardQty\)\}/.test(store), 'a trip difference is a check-in, never a count');
// WORD-07
{
  const T = compileScope(['todayISO', 'isoOf', 'hm', 'isTodayMs', 'howLong', 'whenAt'].map(fn), {}, ['howLong', 'whenAt']);
  t.check(T.howLong(581) === '9 h 41 m' && T.howLong(125) === '2 h 05 m' && T.howLong(41) === '41 m' && T.howLong(60) === '1 h' && T.howLong(3000) === '2 days', `how long: "9 h 41 m" (got "${T.howLong(581)}")`);
  const now = new Date(); now.setHours(15, 20, 0, 0); const before = now.getTime() - 3 * 864e5;
  t.check(T.whenAt(now.getTime()) === '15:20' && /^[A-Z][a-z]{2} 15:20$/.test(T.whenAt(before)), `when: "15:20" today, the day otherwise (got "${T.whenAt(before)}")`);
  t.check(!/function waitClock|function waitWords|waitClock\(|waitWords\(/.test(store) && !/oldest ' \+ esc\(howLong/.test(store) && /function whenSaid\(ms\)\{ return whenAt\(ms\); \}/.test(store), 'no duration as a clock; one way to say when');
}
// WORD-08
{
  const R = compileScope([fn('roundWord')], {}, ['roundWord']);
  t.check(R.roundWord([{ supplierId: 'S1' }, { supplierId: 'S2' }, { supplierId: 'S3' }]) === 'trip · 3 suppliers' && R.roundWord([{ supplierId: 'S1' }]) === 'trip', 'a trip with several suppliers is "trip · 3 suppliers"');
  t.check(!/'round'|'s round|the round'|buying round/.test(code.replace(/kind: 'round'|kind === 'round'/g, '')), '"round" appears nowhere on screen');
}
// WORD-09
{
  const D = () => ({ savedQuotes: [{ id: 548, client: { name: 'Walk-in' }, invoicedTs: 1000, items: [{ productId: 'P1', variantIdx: null }] }] });
  const L = compileScope([fn('stockKey'), fn('q4'), store.slice(store.indexOf('function logNoteSay('), store.indexOf('function fmtLevels('))], { D, quoteClientName: q => q.client.name }, ['logNoteSay']);
  t.check(L.logNoteSay('Quote for Walk-in', 'P1', 2000) === 'Order #0548 · Walk-in' && L.logNoteSay('Quote #77 for Kato', 'P1', 0) === 'Order #0077 · Kato'
    && L.logNoteSay('Quote for Ssali', 'P1', 0) === 'Sale · Ssali' && L.logNoteSay('Check-in', 'P1', 0) === 'Check-in', 'stock history never says "Quote"');
  const U = compileScope([fn('unitSay')], {}, ['unitSay']);
  t.check(U.unitSay('Ctn') === 'ctn' && U.unitSay(' Pcs ') === 'pcs' && U.unitSay(null) === '', 'units are lower case');
  t.check(/unit: unitSay\(quoteLinePack\(it\)\.packUnit\)/.test(store) && /return unitSay\(\(unitsFor\(x\.productId, x\.variantIdx\) \|\| \{\}\)\.unit \|\| 'pc'\)/.test(store) && /parts\.push\(n0\(q\) \+ ' ' \+ unitSay\(l\[1\]\)\)/.test(store), 'one formatter for every quantity');
}
// WORD-10
t.check(/return alertsAll\(\)\.map\(a => \(\{ \.\.\.a, unread: !!a\.forYou && isTodayMs\(a\.at\) && a\.at > seen \}\)\);/.test(store), 'only an alert for you, from today, is unread');
t.check(/if \(on && !S\.ui\.alOpen\) \{ S\.ui\.alPrev = seenAt\(\); try \{ localStorage\.setItem\(SEEN_KEY\(\), String\(Date\.now\(\)\)\); \}/.test(store), 'opening Alerts reads them; the dots stay for that visit');
t.check(/For you<span class="m">/.test(store) && /In the yard today/.test(store) && /passed you the yard`, sub: /.test(store), 'Alerts: "For you" first, then the yard today; a shift passed to you is for you');

t.done();
