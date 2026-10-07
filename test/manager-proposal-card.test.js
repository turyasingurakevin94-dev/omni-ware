#!/usr/bin/env node
'use strict';
/*
 * A proposed target, drawn as its own arithmetic.
 *
 * The card used to be a paragraph the owner had to do the sum from. It
 * now draws where the measure stood and the aim built from its parts.
 *
 * Pinned: parts that do not close on the aim are dropped whole, never
 * drawn; "where it stood" is measured by the scoreboard's own function
 * over the seven days before the proposal, never taken from the
 * meeting; what a move would ADD is drawn differently from what the
 * books already do; and the card keeps the two taps that commit or set
 * a number aside.
 *
 * Run: node test/manager-proposal-card.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('manager proposal card');
const src = read('index.html');
const TODAY = '2026-09-24';
const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmtUGX = (n) => Number(n).toLocaleString('en-US') + ' UGX';

const measured = [];
const s = compileScope([
  extractFunction(src, 'managerTargetParts', 'index.html'),
  extractFunction(src, 'managerProposalBefore', 'index.html'),
  extractDeclaration(src, 'MGR_METRIC_MARKS', 'index.html'),
  extractFunction(src, 'mgrProposalHTML', 'index.html'),
  extractFunction(src, 'anShiftDate', 'index.html'),
  extractFunction(src, 'mgrTgFig', 'index.html'), extractFunction(src, 'mgrTgGap', 'index.html'), extractFunction(src, 'mgrTgDelta', 'index.html'),
  extractDeclaration(src, 'MGR_TG_GLYPH', 'index.html'), extractFunction(src, 'mgrTgPerson', 'index.html'), extractFunction(src, 'mgrTgAvHTML', 'index.html'),
], {
  esc, fmtUGX, todayISO: () => TODAY,
  data: { staff: [{ id: 'ST001', name: 'Joan Nakato' }, { id: 'ST009', name: 'Gone Away', unavailable: true }] },
  MANAGER_METRICS: {
    gross_profit: { label: 'Gross profit', kind: 'flow', measure: (from, to) => { measured.push([from, to]); return 1124990; } },
    collections: { label: 'Collect', kind: 'flow', measure: () => 0 },
    debtors_total: { label: 'Money owed to you', kind: 'level', measure: () => 8000000 },
    margin_pct: { label: 'Gross margin', kind: 'level', unit: 'pct', direction: 'up', round: (v) => Math.round(v * 10) / 10, measure: () => 9.1 },
  },
  Date, String, Number, Math, Array,
}, ['managerTargetParts', 'managerProposalBefore', 'mgrProposalHTML']);

/* ---------- 1. the parts must close on the aim ------------------------ */
{
  const ok = s.managerTargetParts([
    { label: "Book's pace", amount: 1165000 }, { label: 'Masasi lift', amount: 235000, adds: true }], 1400000);
  t.check(ok.length === 2 && ok[1].adds === true && ok[0].adds === false,
    'parts that sum to the aim are kept, and only a literal true marks what a move adds');
  t.check(s.managerTargetParts([{ label: 'Book', amount: 600000 }], 1400000).length === 0,
    'parts that fall short of the aim are dropped whole — a bar must not draw a sum the argument never reached');
  t.check(s.managerTargetParts([{ label: 'Amos Dulisa', amount: 2515000 }], 2500000).length === 1,
    'a named debt a little over the aim is its honest cover');
  t.check(s.managerTargetParts([{ label: 'Everyone', amount: 9000000 }], 2500000).length === 0,
    'but not one half again over it');
  t.check(s.managerTargetParts([{ label: '', amount: 1400000 }, { label: 'x', amount: -5 }], 1400000).length === 0,
    'an unnamed or negative part is nothing');
  t.check(s.managerTargetParts('parts', 1400000).length === 0 && s.managerTargetParts(null, 0).length === 0,
    'and anything that is not a list of parts draws nothing');
}

/* ---------- 2. where it stood is measured, not reported --------------- */
{
  const b = s.managerProposalBefore({ metric: 'gross_profit', date: '2026-09-20' });
  t.check(b && b.v === 1124990 && b.label === 'Last 7d', 'a flow stood where the books put it over the week before');
  t.check(measured.length && measured[0][0] === '2026-09-13' && measured[0][1] === '2026-09-19',
    'the seven days BEFORE the proposal, never the days it is meant to earn');
  const lv = s.managerProposalBefore({ metric: 'debtors_total', date: '2026-09-20' });
  t.check(lv && lv.label === 'Now' && lv.v === 8000000, 'a level stands where the books say it is today');
  t.check(s.managerProposalBefore({ metric: 'nothing' }) === null, 'a measure this app does not have stood nowhere');
}

/* ---------- 3. the card ---------------------------------------------- */
{
  const html = s.mgrProposalHTML({ id: 9, metric: 'gross_profit', label: 'Gross profit', aim: 1400000, date: '2026-09-20',
    why: 'Last week returned 1,124,990 <b>', dupIds: [7],
    parts: [{ label: "Book's pace", amount: 1165000 }, { label: 'Masasi lift', amount: 235000, adds: true }] });
  t.check(/data-tid="9"/.test(html) && /data-dups="7"/.test(html), 'the card carries its row and the copies it retires');
  t.check(/mgr-target-adopt/.test(html) && /mgr-target-decline/.test(html), 'and both taps: a number becomes a commitment only by one');
  t.check((html.match(/mgr-pp-seg/g) || []).length === 2 && /mgr-pp-seg mgr-pp-adds/.test(html),
    'the aim is drawn as its parts, with what a move adds drawn apart from what the books already do');
  /* WAS full shillings (+235,000; 1,124,990); NOW the section's own
     figures, as the running rows beside it read: +235k, 1.12m. */
  t.check(/\+235k/.test(html), 'an added part says it is added');
  t.check(/1\.12m/.test(html) && /\+24%/.test(html), 'where it stood, and how far the aim is from it');
  /* NEW: who owns it once taken on -- the owner by default, or staff on
     file who are not away; never nobody. */
  t.check(/data-owner="you"/.test(html) && /data-pp-owner="you"[^>]*>/.test(html) && /class="mgr-tg-opt mgr-tg-opt-p mgr-tg-on" aria-pressed="true" data-pp-owner="you"/.test(html),
    'the card names its owner before it is taken on: you, unless another is picked');
  t.check(/data-pp-owner="ST001"/.test(html) && !/data-pp-owner="ST009"/.test(html), 'staff on file can be picked; staff away cannot');
  t.check(/<details class="mgr-pp-why">/.test(html) && /&lt;b&gt;/.test(html),
    'the argument is one tap away, escaped, not the first thing read');

  const bare = s.mgrProposalHTML({ id: 6, metric: 'collections', label: 'Collect', aim: 2500000, date: '2026-09-20',
    why: '', parts: [{ label: 'Somebody', amount: 100 }] });
  t.check((bare.match(/mgr-pp-seg/g) || []).length === 1 && !/mgr-pp-part/.test(bare),
    'parts that do not close fall back to one plain bar for the aim, with no legend');
  t.check(/<span class="mgr-pp-c"><b class="mgr-pp-fig">2\.50m<\/b><\/span>/.test(bare), 'and the aim bar is labelled with its figure');
  t.check(/from 0/.test(bare), 'nothing earned the week before reads as "from 0", not as an infinite percentage');
  t.check(!/<details/.test(bare), 'and no argument means no fold to open');
}

/* ---------- 4. the cap on what runs at once ---------------------------- */
/* WAS: the header drew two slots, and two targets a week was the most
   that could run. NOW (Q16): up to four run at once -- the meeting's
   weekly ones and the owner's own together -- and at four, Take it on is
   held back with the reason on it. */
{
  t.check(/const MGR_TG_MAX_RUNNING = 4;/.test(src), 'up to four targets run at once');
  const draw = extractFunction(src, 'mgrTgDraw', 'index.html');
  t.check(/const full = live\.length >= MGR_TG_MAX_RUNNING;/.test(draw) && /if\(full\)\{ adopt\.disabled = true; adopt\.title = /.test(draw),
    'and at four a proposal cannot be taken on until one finishes, and says so');
}

/* ---------- 4b. a proposal in its own unit ------------------------------ */
{
  const pct = s.mgrProposalHTML({ id: 12, metric: 'margin_pct', label: 'Gross margin', aim: 10.5, date: TODAY, why: '' });
  t.check(/<span class="mgr-pp-big">10\.5%<\/span><span class="mgr-pp-u">this week<\/span>/.test(pct),
    'a margin is proposed in per cent, not in shillings');
  t.check(/<span class="mgr-pp-chip">\+1\.4 pts<\/span>/.test(pct), 'and its distance from now in points (9.1% to 10.5%)');
}

/* ---------- an aim below what the shop already did says why ---------- */
{
  const low = s.mgrProposalHTML({ id: 9, metric: 'gross_profit', label: 'Gross profit', aim: 1000000, date: TODAY, why: 'Last week had one unusual sale to Kato that will not repeat' });
  t.check(/class="mgr-pp-back"/.test(low) && /Aims 125k below last week\./.test(low) && /will not repeat/.test(low) && !/<details class="mgr-pp-why"/.test(low),
    'an aim below what the shop already did leads with how far below, and the Manager\'s reason, out of its fold');
  const bare = s.mgrProposalHTML({ id: 10, metric: 'gross_profit', label: 'Gross profit', aim: 1000000, date: TODAY });
  t.check(/gave no reason for aiming lower/.test(bare), 'and a missing reason is said to be missing');
  const up = s.mgrProposalHTML({ id: 11, metric: 'gross_profit', label: 'Gross profit', aim: 1400000, date: TODAY, why: 'w' });
  t.check(!/mgr-pp-back/.test(up) && /<details class="mgr-pp-why"/.test(up), 'an aim above it keeps its argument folded as before');
}

t.done();
