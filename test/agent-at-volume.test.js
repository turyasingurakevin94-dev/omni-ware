#!/usr/bin/env node
'use strict';
/*
 * On the move, at volume.
 *
 * Thirty orders in a stage cannot be thirty big cards. Past a handful a
 * stage becomes a list to work through: what it is worth and how it
 * splits on top, the urgent part first and oldest first within it, four
 * rows of each part with the rest folded, and one button for a whole part
 * (pay, ask the shop, every counter code). Today names what needs doing
 * rather than every order, and baskets nobody has opened in two weeks
 * fold into one card that clears them together.
 *
 * Run: node test/agent-at-volume.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('agent at volume');
const src = read('agent.html');
const fn = (n) => extractFunction(src, n, 'agent.html');

/* ---------- 1. a stage past a handful is a list ---------------------- */
{
  t.check(/const BUSY_AT = 4;/.test(src), 'a handful is four');
  t.check(/return BUSY_PAGES\[key\] \? openBusyStage\(key\) : null;/.test(fn('openStageSheet')) && !/BUSY_AT/.test(fn('openStageSheet')),
    'a stage always opens as the list to work through, at one order as at thirty');
  t.check(/\$\{rows\.length > BUSY_AT \? `<div class="ax-bz-q">/.test(fn('openBusyStage')),
    'with search and sort only past a handful, where there is something to find');
  t.check(/Nothing here right now/.test(fn('openBusyStage')), 'and an empty stage says so');
  const parts = compileScope([fn('calDaysAgo'), fn('busyParts')], {}, ['busyParts']).busyParts;
  const day = 86400000, now = Date.now();
  const p = parts('packing', [{ since: now - 3 * day }, { since: now - day }, { since: now }, { since: now - 5 * day }]);
  t.check(p[0].id === 'late' && p[0].rows.length === 2 && p[0].act === 'ask' && p[1].rows.length === 1 && p[2].rows.length === 1,
    'packing splits into 2+ days (with one message to the shop about all of them), since yesterday, and today');
  const s = parts('sent', [{ st: { needs: 'pay', key: 'pay' } }, { st: { key: 'checking' } }, { st: { key: 'queued' } }]);
  t.check(s[0].id === 'pay' && s[0].act === 'pay' && s[0].rows.length === 1 && s[1].rows.length === 1 && s[2].rows.length === 1,
    'sent puts what waits on your money first');
  const o = parts('out', [{ st: { key: 'ready' } }, { st: { key: 'out' } }]);
  t.check(o[0].act === 'codes' && o[0].rows.length === 1 && o[1].rows.length === 1,
    'out puts what is ready to collect first, with every counter code in one tap');
  const busy = fn('openBusyStage');
  t.check(/rows\.slice\(0, 4\)/.test(busy) && /data-more=/.test(busy) && /Show \$\{rows\.length - vis\.length\} more/.test(busy),
    'each part shows four and folds the rest');
  t.check(/data-q/.test(busy) && /data-sort/.test(busy) && /data-only=/.test(busy),
    'with a search, a sort and a filter by part');
}

/* ---------- 2. how long it has sat, at a glance ---------------------- */
{
  const { busyAge, busyTone } = compileScope([fn('busyAge'), fn('busyTone'), 'const BUSY_WAIT = { sent:[3, 24], packing:[24, 48], out:[4, 24] };'], {}, ['busyAge', 'busyTone']);
  const now = Date.now();
  t.check(busyAge(now - 30 * 60000) === '30m' && busyAge(now - 5 * 3600000) === '5h' && busyAge(now - 3 * 86400000) === '3d',
    'minutes, then hours, then days');
  t.check(busyTone('packing', now - 3 * 86400000) === 'late' && busyTone('packing', now - 30 * 3600000) === 'warn' && busyTone('packing', now - 3600000) === '',
    'a wait goes amber, then red, by what is slow for that stage');
}

/* ---------- 3. Today names what needs doing ------------------------- */
{
  const move = fn('renderMove');
  t.check(!/BUSY_AT|ax-needrow/.test(move) && /data-need="\$\{k\}"/.test(move),
    'Today lists kinds of work, not orders -- at one order as at forty');
  t.check(/'Pay the shop'/.test(move) && /'Ready to collect'/.test(move) && /'Packing 2\+ days'/.test(move) && /'Baskets gone cold'/.test(move),
    'pay, collect, chase the shop, clear old baskets');
  t.check(/class="need \$\{dot\}"/.test(move), 'and each stage tile says how many of it need you');
}

/* ---------- 4. baskets ----------------------------------------------- */
{
  t.check(/addedAt: Date\.now\(\),/.test(fn('addCatalogLine')), 'a line remembers when it went in, so a basket can say how long it has sat');
  const sheet = fn('openBasketsSheet');
  t.check(/x\.d >= 14 && !x\.b\.active/.test(sheet) && /data-clear/.test(sheet) && /Clear them/.test(sheet),
    'baskets untouched two weeks fold into one card, cleared together after a yes -- never the one in hand');
  const { basketTouched } = compileScope([fn('basketTouched')], {}, ['basketTouched']);
  t.check(basketTouched([{ addedAt: 5 }, { addedAt: 9 }, {}]) === 9 && basketTouched([{}]) === null,
    'a basket was last touched when its newest line went in; with no record it is not called cold');
}

/* ---------- 5. one message, one sheet -------------------------------- */
{
  t.check(/these orders have been packing for 2 days or more/.test(fn('askShopAbout')) && /wa\.me/.test(fn('askShopAbout')),
    'one WhatsApp to the shop lists every order stuck in packing');
  t.check(/Show at the counter/.test(fn('openCodesSheet')), 'and every counter code is on one sheet, big enough to read across the counter');
}

process.exit(t.done() ? 1 : 0);
