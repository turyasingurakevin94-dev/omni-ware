#!/usr/bin/env node
'use strict';
/*
 * The Brief's laws, pinned on the Brief's own code (its JS block, between
 * its markers), because the older pins scan renderManager and the
 * mgrPaint* functions and do not reach the Brief's new entry points:
 *
 *   1. Nothing runs untapped. The band, the plan and the ask card are new
 *      ways to reach a meeting or the assistant; each is reached only from
 *      a tap (a click or the Enter of a typed question).
 *   2. A question is not a meeting: the Brief never sets apMode.
 *   3. The band's sentence says only what is true: "tested against the
 *      next 30 days" only when the Simulator played this plan, "I
 *      corrected one of my own earlier calls" only when a review did, and
 *      a flag the books could not read is named, never counted as none.
 *   4. A box whose readings failed says so -- never its all-clear empty
 *      state ("Nothing is dated…", "Nothing repeats…").
 *
 * Run: node test/manager-brief-laws.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('manager brief laws');
const src = read('index.html');
const fn = (n) => extractFunction(src, n, 'index.html');
const decl = (n) => extractDeclaration(src, n, 'index.html');

/* The Brief's JS block: the third pair of its markers (desktop CSS, phone
   CSS, then the script). */
const BEGIN = '/* ═══ MGR BED: Brief — begin ═══ */', END = '/* ═══ MGR BED: Brief — end ═══ */';
const begins = [], ends = [];
for (let i = src.indexOf(BEGIN); i > -1; i = src.indexOf(BEGIN, i + 1)) begins.push(i);
for (let i = src.indexOf(END); i > -1; i = src.indexOf(END, i + 1)) ends.push(i);
t.check(begins.length === 3 && ends.length === 3, 'the Brief has its three blocks: desktop CSS, phone CSS and script');
const block = src.slice(begins[2], ends[2]);
t.check(/function mgrPaintBrief\(/.test(block) && /function mgrBriefAsk\(/.test(block), 'and the script block is the one that paints the Brief');

/* Where a function's text sits in the block. */
const spanOf = (name) => {
  const at = block.indexOf('function ' + name + '(');
  if (at < 0) return null;
  const body = extractFunction(block, name, 'the Brief block');
  return [at, at + body.length];
};
const inside = (i, span) => !!span && i >= span[0] && i < span[1];
const all = (re) => { const out = []; let m; const g = new RegExp(re.source, 'g'); while ((m = g.exec(block))) out.push(m.index); return out; };

/* ---------- 1. nothing runs untapped ----------------------------------- */
{
  const runs = all(/runManagerMeeting/);
  t.check(runs.length > 0 && runs.every((i) => /addEventListener\('click', runManagerMeeting\)$/.test(block.slice(Math.max(0, i - 40), i + 'runManagerMeeting)'.length))),
    'a meeting is held only by a click on its button: runManagerMeeting appears only as a click listener (' + runs.length + ' places)');
  const ask = spanOf('mgrBriefAsk');
  const sends = all(/apSend\(/);
  const finish = block.indexOf("finBtn.addEventListener('click', ()=>{ apOpenPanel(); apSend('continue'); });");
  t.check(sends.length === 2 && sends.every((i) => inside(i, ask) || (finish > -1 && i > finish && i < finish + 90)),
    'the assistant is sent a message only by the ask card (mgrBriefAsk) and the Finish button\'s click');
  const asks = all(/mgrBriefAsk\(/).filter((i) => !block.startsWith('function mgrBriefAsk(', i - 'function '.length));
  const tapped = (i) => {
    const line = block.slice(block.lastIndexOf('\n', i), block.indexOf('\n', i));
    if (/addEventListener\('click'/.test(line)) return true;
    const key = block.lastIndexOf("addEventListener('keydown'", i);
    return key > -1 && i - key < 400 && /e\.key !== 'Enter'/.test(block.slice(key, i));
  };
  t.check(asks.length >= 2 && asks.every(tapped), 'and the ask card is reached only from a click or the Enter of a typed question (' + asks.length + ' places)');
  t.check(!/mgrBriefAsk\(\s*\)/.test(block) && !/setTimeout\([^)]*mgrBriefAsk/.test(block), 'never on a timer, never on its own');
}

/* ---------- 2. a question is not a meeting ------------------------------ */
{
  t.check(!/\bapMode\s*=(?!=)/.test(block), 'the Brief never sets apMode -- it only reads it');
  const ask = extractFunction(block, 'mgrBriefAsk', 'the Brief block');
  t.check(/apOpenPanel\(\)/.test(ask) && /if\(apMode \|\| assistantBusy\)\{ if\(input\)\{ input\.value = q;/.test(ask),
    'a question opens the shared panel, and while a meeting or a review is open there it waits in the box for the owner to send');
}

/* ---------- 3. the band says only what is true ------------------------ */
{
  const S = compileScope([fn('mgrBriefSubHTML'), fn('mgrShortUGX')], {
    esc: (s) => String(s),
  }, ['mgrBriefSubHTML']);
  const base = { signals: { count: 18, depts: 6 }, linked: [1, 2, 3], reading: [1], errors: [],
    adds: { cash: 15233850, profit: 1279185, loss: 0, saving: 0, sales: 0 } };
  const plan = { verdict: 'x' };
  const say = (extra) => S.mgrBriefSubHTML({ ...base, ...extra }, plan).replace(/<[^>]+>/g, '');
  const plain = say({});
  t.check(/I connected 18 signals across all six departments; 4 chains run through them — 3 linked in your books, 1 my reading\./.test(plain),
    'the signals, the departments and the chains, by source (got ' + plain + ')');
  t.check(/Today’s plan adds \+1\.28m of profit over 30 days and 15\.23m of cash\./.test(plain), 'what the plan adds, each kind apart');
  t.check(!/tested/.test(plain) && !/corrected/.test(plain), 'no Simulator figure and no correction: neither clause is said');
  t.check(!/tested/.test(say({ tz: { plan: 'nothing changes', lowest: { balance: 1, date: '2026-10-10' }, profitMonth: null } })),
    'a Simulator that played "nothing changes" has not tested the plan, so the band does not say it has');
  t.check(/I’ve tested the plan against the next 30 days\./.test(say({ tz: { plan: 'my plan', lowest: { balance: 1, date: '2026-10-10' } } })),
    'a Simulator that played my plan: "tested against the next 30 days"');
  t.check(/I’ve tested the plan against the next 30 days — and I corrected one of my own earlier calls\./
    .test(say({ tz: { plan: 'my plan', profitMonth: { lo: 1, hi: 2 } }, corrected: { body: { corrections: [{}] } } })),
    'both, when both are true');
  t.check(/ I corrected one of my own earlier calls\.$/.test(say({ corrected: { body: { corrections: [{}] } } })) ,
    'a correction alone, when only a review corrected itself');
  const flags = say({ errors: ['alerts', 'answers to days out of the ordinary'] });
  t.check(/\(alerts, answers to days out of the ordinary could not be read, so not counted\.\)/.test(flags),
    'a flag the books could not read is named, never counted as none (got ' + flags + ')');
  const kinds = say({ adds: { cash: 0, profit: 100000, loss: 420000, saving: 130000, sales: 0 } });
  t.check(/\+100k of profit over 30 days, 420k of losses avoided and 130k of costs saved\./.test(kinds),
    '"over 30 days" belongs to profit alone; a loss avoided and a cost saved are each said as what they are (got ' + kinds + ')');
}

/* ---------- 4. a box whose readings failed says so -------------------- */
{
  const els = {};
  const document = { getElementById: (id) => (els[id] = els[id] || { id, innerHTML: '', querySelectorAll: () => [], classList: { toggle() {} } }) };
  const M = { today: '2026-10-07', chains: [], foresight: [], patterns: [], blind: [], signals: { count: 0 }, meeting: null,
    hit: null, deadLevers: [], corrected: null, unknownTerms: null, orderByMore: 0,
    errors: ['the cash ahead', 'risks', 'the buy plan', 'the shelf', 'lead times', 'orders on the way', 'chase record', 'chase verdicts',
      'posts', 'counts', 'statements', 'rival checks', 'supplier of P001'] };
  const S = compileScope([
    ...['mgrBriefPaintChains', 'mgrBriefPaintForesight', 'mgrBriefPaintMemory', 'mgrBriefPaintBlind', 'mgrBriefUnread', 'mgrBriefUnreadHTML',
      'mgrBriefForesightPick', 'mgrBriefNext7', 'mgrBriefLampHTML', 'mgrBriefDeptChip', 'mgrBriefPipsHTML', 'mgrBriefDoor', 'mgrBriefWireGo', 'mgrBriefChainDepts',
      'mgrBriefDay', 'mgrShortUGX', 'mgrDept', 'anShiftDate', 'waWeekday'].map(fn),
    ...['MGR_BRIEF_NEEDS', 'MGR_BRIEF_ICON', 'mgrBriefIcon', 'MGR_BRIEF_DOORS', 'MGR_BRIEF_FS_ORDER', 'MGR_BRIEF_WEEK_KEEP', 'MGR_WEEKDAYS', 'MGR_DEPTS',
      'MGR_WHOLE_SHOP', 'MGR_BRIEF_MONTHS'].map(decl),
  ], {
    document, mgrBriefModel: M, mgrBriefDept: 'all', mgrBriefChain: null, mgrBriefRows: [], mgrBriefMoreFore: false, mgrBriefFore30: false, mgrBriefMoreBlind: false,
    mgrBriefCtx: {}, MANAGER_DOORS: {}, esc: (s) => String(s), fmtUGX: (n) => String(n), fmtShortDate: (d) => String(d),
    mgrMoveOrder: (r) => r.slice(), todayISO: () => '2026-10-07', Math, Number, String, Map, Set, Array, Object, JSON,
  }, ['mgrBriefPaintChains', 'mgrBriefPaintForesight', 'mgrBriefPaintMemory', 'mgrBriefPaintBlind']);
  [['managerChainWrap', 'mgrBriefPaintChains', /Nothing in the books joins/, /The cash ahead, the buy plan, risks, the shelf and who supplies each line could not be read/],
    ['managerForesightWrap', 'mgrBriefPaintForesight', /Nothing is dated/, /The cash ahead, risks, the shelf, lead times, orders on the way and who supplies each line could not be read/],
    ['managerMemoryWrap', 'mgrBriefPaintMemory', /Nothing repeats/, /Chase record, chase verdicts and posts could not be read/],
    ['managerBlindWrap', 'mgrBriefPaintBlind', /Nothing the advice leans on/, /Rival checks, counts, statements and the cash ahead could not be read/]]
    .forEach(([id, painter, allClear, named]) => {
      S[painter]();
      const html = els[id].innerHTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      t.check(!allClear.test(html) && named.test(html), id + ': its failed readings are named, and its all-clear is not said (got ' + html.trim().slice(0, 220) + ')');
    });
  /* And the all-clear is still said when nothing failed. */
  M.errors = [];
  S.mgrBriefPaintForesight();
  t.check(/Nothing is dated in the next 30 days\./.test(els.managerForesightWrap.innerHTML) && !/could not be read/.test(els.managerForesightWrap.innerHTML),
    'with every reading in, an empty box says so plainly');
}

process.exit(t.done() ? 1 : 0);
