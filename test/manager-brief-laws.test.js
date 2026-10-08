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
  const S = compileScope([fn('mgrBriefSubHTML'), fn('mgrBriefTestedText'), fn('mgrBriefDay'), fn('waWeekday'), fn('mgrShortUGX'),
    decl('MGR_BRIEF_MONTHS'), decl('MGR_WEEKDAYS')], {
    esc: (s) => String(s),
  }, ['mgrBriefSubHTML', 'mgrBriefTestedText']);
  const base = { signals: { count: 18, depts: 6 }, linked: [1, 2, 3], reading: [1], errors: [],
    adds: { cash: 15233850, profit: 1279185, loss: 0, saving: 0, sales: 0 }, floor: { amount: 3000000, source: 'set' } };
  const plan = { verdict: 'x' };
  const say = (extra) => S.mgrBriefSubHTML({ ...base, ...extra }, plan).replace(/<[^>]+>/g, '');
  const plain = say({});
  /* Side by side, never "run through them" (law 5): nothing joins a
     chain to a signal. */
  t.check(/I connected 18 signals across all six departments; 4 chains join departments — 3 linked in your books, 1 my reading\./.test(plain),
    'the signals, the departments and the chains, by source, side by side (got ' + plain + ')');
  t.check(!/run through|behind|explain/.test(plain), 'and no word says the chains explain the signals');
  t.check(/The meeting sized today’s plan at \+1\.28m of profit over 30 days and 15\.23m of cash\./.test(plain) && !/plan adds/.test(plain),
    'what the plan adds, each kind apart, said as the meeting\'s own sizing -- never read as the Simulator\'s test (got ' + plain + ')');
  t.check(!/tested/.test(plain) && !/corrected/.test(plain), 'no Simulator figure and no correction: neither clause is said');
  t.check(!/tested/.test(say({ tz: { plan: 'nothing changes', lowest: { balance: 1, date: '2026-10-10' }, profitMonth: null } })),
    'a Simulator that played "nothing changes" has not tested the plan, so the band does not say it has');
  /* "tested" is never said without what the test found (review). Thu 5 Nov
     2026: the committed line on my plan at -1,060,000, under the 3m floor
     and under zero. 8 Oct 2026 is a Thursday; 5 Nov is 28 days on: Thu. */
  const failed = say({ tz: { plan: 'my plan', lowest: { balance: -1060000, date: '2026-11-05' }, shocksHeld: 0, shocksOf: 3 } });
  t.check(/I’ve tested the plan against the next 30 days: on it, cash goes as low as −1\.06m on Thu 5 Nov, under your 3m floor and below zero — see the Simulator\./.test(failed),
    'a plan the test finds under the floor: "tested" says where and when (got ' + failed + ')');
  const held = say({ tz: { plan: 'my plan', lowest: { balance: 3450000, date: '2026-10-20' }, shocksHeld: 3, shocksOf: 3 } });
  t.check(/I’ve tested the plan against the next 30 days: at its lowest, 3\.45m on Tue 20 Oct, cash stays above your 3m floor, and it holds 3 of 3 shocks on the expected line\./.test(held),
    'a plan that holds: said with its lowest and the shocks it holds on the expected line, Q40 (got ' + held + ')');
  t.check(S.mgrBriefTestedText({ plan: 'my plan', lowest: null, profitMonth: { lo: 1, hi: 2 } }, base.floor) === null
    && !/tested/.test(say({ tz: { plan: 'my plan', profitMonth: { lo: 1, hi: 2 } } })),
    'a test with no lowest worked out is not said to have been made');
  /* Every place the band can say "tested", the result rides with it. */
  const sub = extractFunction(src, 'mgrBriefSubHTML', 'index.html');
  t.check(!/tested the plan/.test(sub) && /mgrBriefTestedText\(/.test(sub), 'the band\'s "tested" comes only from mgrBriefTestedText, which always carries the outcome');
  t.check(/I’ve tested the plan against the next 30 days: at its lowest, 3\.45m on Tue 20 Oct, cash stays above your 3m floor, and it holds 3 of 3 shocks on the expected line\. I corrected one of my own earlier calls\./
    .test(say({ tz: { plan: 'my plan', lowest: { balance: 3450000, date: '2026-10-20' }, shocksHeld: 3, shocksOf: 3 }, corrected: { body: { corrections: [{}] } } })),
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


/* ---------- 5. the band on a morning with no meeting, and with no journal -- */
{
  const H = compileScope([fn('mgrHeroHTML')], {
    mgrBriefModel: null, managerMeetingRunning: false, apMode: null, apWasCutOff: false, managerCommittedPlan: null, assistantBusy: false,
    mgrBriefSpokeAt: () => null, managerPips: () => null, esc: (s) => String(s), mgrBriefSubHTML: () => '', mgrBriefReadsHTML: () => '',
    String, Number,
  }, ['mgrHeroHTML']);
  const txt = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  /* Q30, Q41: no meeting yet -- the band says so WITH the control. */
  const none = H.mgrHeroHTML(null, null, false, null, false);
  t.check(/No meeting has been held yet today\./.test(txt(none)) && /<button type="button" class="btn btn-accent mgr-b-hold" id="mgrRunBtn">Hold the morning meeting<\/button>/.test(none)
    && /It spends a little AI credit and never runs itself\./.test(txt(none)) && !/button below/.test(txt(none)),
    'no meeting yet: the band carries the one accent "Hold the morning meeting", never "from the button below"');
  t.check(!/mgrRunBtn/.test(H.mgrHeroHTML({ verdict: 'x' }, [], true, null, false)) && !/mgrRunBtn/.test(H.mgrHeroHTML(null, null, null, null, false))
    && !/mgrRunBtn/.test(H.mgrHeroHTML(null, null, null, 'Failed to fetch', false)),
    'and never while a plan is in, the journal is still being read, or it could not be read');
  /* A meeting stamped on this device, with no journal to read it back:
     held, said as held here -- never "Reading today's meeting…" forever. */
  const dev = txt(H.mgrHeroHTML(null, null, true, null, true));
  t.check(/Today’s meeting was held on this device\./.test(dev) && /Its plan is not kept/.test(dev) && !/Reading today/.test(dev),
    'held on this device with no journal: said as that, never a read that never resolves');
  const fail = txt(H.mgrHeroHTML(null, null, null, 'Failed to fetch', false));
  t.check(/The journal could not be read\./.test(fail) && /Failed to fetch/.test(fail) && !/No meeting has been held/.test(fail),
    'a journal the probe could not read: the band names the failure, never "no meeting"');
  /* The painter routes a failed probe to that band, and a stamp with no
     journal to "held". */
  const paint = extractFunction(src, 'mgrPaintBrief', 'index.html');
  t.check(/else if\(probeErr\) paintBand\(\{ plan: sessionPlan\(\), moves: null, held: null, unread: probeErr \}\);/.test(paint)
    && /held: heldGuess \? \(ctx\.notes \? null : true\) : false/.test(paint), 'the painter hands the band the failure, or the device\'s own stamp');
}

process.exit(t.done() ? 1 : 0);
