#!/usr/bin/env node
'use strict';
/*
 * The meeting contract, widened for six departments.
 *
 * The Manager was asked to advise a whole shop -- finance, sales,
 * procurement, store, people, marketing -- and to show its work the way
 * the canvas draws it: a verdict to lead with, a department and a
 * confidence on every decision, the evidence behind each, what would
 * change its mind, its own reading of how one problem runs through
 * several departments, questions that say what hangs on them, plays
 * written as tests, and a review that says where it was wrong.
 *
 * None of that has a deterministic source, so it comes from the meeting
 * -- and everything that comes from the meeting is MODEL OUTPUT. The
 * laws this file holds:
 *
 *   SAID AND KEPT AS ONE   every field the rulebook offers is one the
 *       save path keeps, and every one it keeps is whitelisted: an
 *       unknown department, a confidence of 9, evidence with no figure,
 *       a chain that says "caused" -- each becomes nothing, never a
 *       label the screen would print unchallenged.
 *   OLD ROWS STILL READ    a plan that carries none of it saves exactly
 *       the body it always did. Every new key is absent rather than
 *       null, so the screen falls back to what it derives.
 *   THE READING IS UNTOUCHED  what the journal holds reaches the screen
 *       as it was written -- the load path adds nothing and drops
 *       nothing.
 *   THE LAWS STAND    never forecast, never causation as fact, never
 *       credit, the meeting's order is the ranking, and no figure is
 *       multiplied by a confidence. A reading is labelled as a reading.
 *
 * Run: node test/manager-contract.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('the meeting contract');
const src = read('index.html');
const api = read('api/assistant.js');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const same = (got, want, msg) => eq(JSON.stringify(got), JSON.stringify(want), msg);

const TODAY = '2026-10-07';
const block = (n) => { const i = api.indexOf('const ' + n + ' = ['); return api.slice(i, api.indexOf('\n];', i)); };
const meeting = block('MANAGER_MEETING');
const review = block('MANAGER_REVIEW');
const common = block('MANAGER_COMMON');

const FIELDS = [
  ...['managerPips', 'managerPlanText', 'managerMeetingFields', 'managerMoveFields', 'managerAskFields', 'managerPlayFields']
    .map((n) => extractFunction(src, n, 'index.html')),
  extractDeclaration(src, 'MANAGER_DEPTS', 'index.html'),
  extractDeclaration(src, 'MANAGER_ASK_PLACES', 'index.html'),
  extractDeclaration(src, 'MANAGER_METRICS', 'index.html'),
];

const PRODUCTS = [
  { id: 'P1', name: 'G28 sheets', type: 'variable', variants: [{ combo: { Gauge: '28' } }, { combo: { Gauge: '30' } }] },
];
const DATA = () => ({
  products: PRODUCTS,
  customers: [{ id: 7, name: 'Kato' }],
  suppliers: [{ id: 'S1', name: 'Roofings' }],
  staff: [{ id: 's-1', name: 'Joan' }, { id: 's-2', name: 'Peter' }],
  agents: [{ id: 'a-1', name: 'Moses' }, { id: 'a-2', name: 'Ron', retiredAt: '2026-01-01' }],
});

(async () => {
/* ---------- 1. the rulebook says all of it -------------------------- */
{
  t.check(/Compose the day: pick AT MOST EIGHT moves/.test(meeting),
    'EIGHT moves (approval Q29) — one decision a department can have, never a quota');
  t.check(/sales \(sales kept or won, never ranked against cash or profit\)/.test(meeting),
    'the third kind of money is named in the same breath as the other two, and never ranked against them');

  t.check(/SIX DEPARTMENTS\. Advise across finance \(cash, debt, creditors, loans\), sales \(invoices, quotes, margin, customers\), procurement \(bills, buying, suppliers\), store \(stock, dead stock, counts\), people \(staff, payroll, picks\) and marketing \(WhatsApp posts, broadcasts, repeat customers\)/.test(meeting),
    'the six departments, each with what it holds — the mapping the owner approved (Q2)');
  t.check(/A department gets a move only where the books show something there/.test(meeting)
    && /never invent one to fill a slot: eight is a ceiling, not a quota/.test(meeting),
    'and a department gets a move only on the books’ evidence — eight slots is not a demand for eight moves');

  t.check(/verdict: ONE first-person sentence from the figures, the first thing the owner reads/.test(meeting),
    'the verdict is one first-person sentence, from the figures');
  t.check(/sure: 1\\u20135 for the whole plan/.test(meeting), 'with how sure the whole plan is');
  t.check(/On a move: dept; touches\[\], the other departments it moves/.test(meeting),
    'each move names its department and the others it moves');
  t.check(/confidence 1\\u20135, a judgement, never a rank \\u2014 your order IS the ranking and no figure is ever multiplied by a confidence/.test(meeting),
    'CONFIDENCE NEVER RE-RANKS: the plan order stays the ranking and no figure is multiplied by a confidence (Q5)');
  t.check(/evidence, at most 3 phrases each carrying a figure a tool returned/.test(meeting),
    'evidence carries figures a tool returned, not adjectives');
  t.check(/mind, what would change your mind, as an event the books would show/.test(meeting),
    'what would change its mind is an event the books can show');
  t.check(/target, the metric or scoreboard id it serves, and effect, its size in that unit by arithmetic on the books/.test(meeting),
    'a move links to the target it serves, sized by arithmetic — never a forecast');
  t.check(/from_question, the id of the answered question that shaped it/.test(meeting),
    'and to the answer that shaped it');

  t.check(/MY READING, NEVER A CAUSE\. Draw AT MOST THREE chains, none when the books link nothing/.test(meeting),
    'chains are the meeting’s READING, at most three, and none when nothing links');
  t.check(/links in order \(2\\u20135, each with dept, text, a figure a tool returned and that tool\\u2019s name\)/.test(meeting),
    'every link cites a figure and the tool that returned it');
  t.check(/fix naming the move that addresses it by its position in this plan, confidence 1\\u20135/.test(meeting),
    'the fix points at a move in this plan');
  t.check(/It is shown as your reading: linkage, never proof/.test(meeting),
    'and it is said to be linkage, never proof (Q3)');
  t.check(/Never write that one thing caused another or call it the root cause, and never credit a move or a play with clearing what follows/.test(meeting),
    'NO CAUSATION AS FACT, NO CREDIT — the law, restated where the chains are asked for');

  t.check(/AN ASK SAYS WHAT HANGS ON IT\. place\.kind is one of: you, rival, supplier, bank, staff, customer\./.test(meeting),
    'a question names where its answer is found');
  t.check(/An ask may also carry why \(what the answer decides\), stake \(shillings a tool sized, else omit\), dept, confidence \(1\\u20135, how sure the advice it bears on is now\)/.test(meeting),
    'why it is asked, what is at stake only when a tool sized it, and how sure the advice is now');
  t.check(/place \(kind, and the id or name of where to find out\), choices as objects \(label; effect, what that answer changes in your advice; confidence_after\)/.test(meeting),
    'each likely answer says what it would change in the advice and how sure it would leave the Manager');
  t.check(/and delegate \(who on the staff could find out \\u2014 the owner sends it, never you\)/.test(meeting),
    'NOTHING SENDS ITSELF: a delegated question is the owner’s to send');

  t.check(/A PLAY IS A TEST: dept; hypothesis \(if, then, and the target level it should reach, from the books \\u2014 a claim to test, never a promise\)/.test(meeting),
    'a play is a hypothesis to test, never a promise — the never-forecast law at the play');
  t.check(/stop \(threshold and by_week, the reading that ends it\); cost in shillings; depends_on, the play or move it waits for/.test(meeting),
    'with the reading that would stop it, its cost and what it waits for');
  t.check(/A play the OWNER judged worked twice or more is a proven recipe and may be proposed again as their verdict/.test(meeting),
    'a proven recipe is the OWNER’s verdict, twice — the only play that may come back (Q14)');
  t.check(/never one they set aside, never with a claim that it caused anything/.test(meeting),
    'never one they set aside, and still no credit claimed');
  t.check(/NEVER propose a play the shop has tried and dropped/.test(meeting),
    'and the rule against re-proposing a dropped play still stands beside it');

  t.check(/CORRECT YOURSELF OUT LOUD\. Where the week shows one of YOUR OWN earlier claims was wrong/.test(review),
    'the review corrects the Manager’s own earlier claims');
  t.check(/put it in corrections, at most three: was \(what you said\), now \(what the books show\), why \(the figure that shows it\)/.test(review),
    'each one what it said, what the books show and the figure that shows it');
  t.check(/Only your own claims, never the owner\\u2019s, and a play judged by what moved alongside it is never a correction/.test(review),
    'only its own claims — and a play’s movement is never dressed up as proof it was wrong');
  t.check(/"corrections":\[\{"was":"what you said","now":"what the books show","why":"the figure that shows it"\}\]/.test(review),
    'and the review block carries them');

  /* Each occasion carries only its own. */
  t.check(!/CORRECT YOURSELF/.test(meeting) && !/MY READING/.test(review) && !/SIX DEPARTMENTS/.test(review),
    'the review’s correction rule is not in the meeting, and the meeting’s chains are not in the review');

  /* The block shows every new key in its place. */
  t.check(/"verdict":"","sure":3,"moves":/.test(meeting), 'the block example carries the verdict and sure');
  t.check(/"dept":"finance","touches":\["procurement"\],"confidence":4,"evidence":\["paid within 3 days of 4 of 4 chases"\],"mind":"no payment by Thursday","target":"collections","effect":840000/.test(meeting),
    'a move in the example carries every new field, its evidence carrying a figure');
  t.check(/"chains":\[\{"title":"","dept":"sales","links":\[\{"dept":"sales","text":"","figure":"","tool":"shop_pulse"\}\],"fix":\{"title":"","move":1\},"confidence":3\}\]/.test(meeting),
    'and a chain with its links, fix and confidence');
  t.check(/"choices":\[\{"label":"","effect":"","confidence_after":4\}\]/.test(meeting) && /"delegate":\{"staff":""\}/.test(meeting),
    'and an ask with choices as objects and a delegate');
  t.check(/"hypothesis":\{"if":"","then":"","target":""\},"stop":\{"threshold":"","by_week":2\}/.test(meeting),
    'and a play as a test');

  /* THE LAWS THAT WERE ALREADY THERE, still there. */
  t.check(/Never forecast: argue only from what is recorded/.test(common), 'never forecast');
  t.check(/Never infer causation or failed execution from subsequent events/.test(common), 'never infer causation');
  t.check(/Never claim an action happened, and never present a move as already done/.test(common), 'never claim an action happened');
  t.check(/Rank them by WHAT THE ACTION CHANGES THIS WEEK/.test(meeting), 'the plan order is the ranking');
  t.check(/TWO MOVES MAY NEVER CLAIM THE SAME SHILLINGS/.test(meeting), 'no double-counted money');
  t.check(/PRESERVE THE STANDING OWNER OBJECTIVE/.test(meeting), 'the owner’s objective is preserved');
  t.check(/targets\[\]\.metric is one of: collections, gross_profit, sales, debtors_total, dead_stock_value, cash_on_hand,/.test(meeting),
    'the weekly targets keep the six metrics — new metrics wait for the Targets bed');
}

/* ---------- 2. a whole [plan:] block, parsed and saved --------------- */
const ok = (s) => /^[a-z]/.test(s);
const link = (dept, text, figure, tool) => ({ dept, text, figure, tool });
const two = [link('sales', 'Quotes wait for the owner', '11 quotes over 7 days', 'shop_pulse'),
  link('finance', 'Profit on quotes that went elsewhere', '270,000 a month', 'month_and_quarter')];
const PLAN = {
  objective: { name: 'cash', why: 'Cover is 9 days; 11,600,000 is owed' },
  verdict: 'Profit is up.   Cash is down. It is the same problem in four departments.',
  sure: 4,
  moves: [
    { title: 'Chase Kato for 2,400,000', why: 'w', worth: 2400000, worth_basis: 'cash_freed', lever: 'collect',
      door: 'chase', kind: 'chase', subject: { customerId: 7 },
      dept: 'finance', touches: ['procurement', 'store', 'finance', 'procurement', 'hr'], confidence: 5,
      evidence: ['Paid within 3 days of 4 of 4 chases', 'Owes 2,400,000, oldest 41 days', 'a hunch with nothing behind it',
        'Cement cover 11 days', 'a fourth with 4 in it'],
      mind: 'If Kato has not paid by Thursday evening', target: 'collections', effect: 2400000, from_question: 12 },
    { title: 'Pay Roofings before Saturday', why: 'w', worth: 1600000, worth_basis: 'sales', lever: 'cost',
      door: 'creditors', kind: 'settle', subject: { supplierId: 'S1' }, after: 1,
      dept: 'procurement', touches: ['store', 'sales'], confidence: 9, target: 31, effect: '1,600,000', from_question: 'twelve' },
    { title: 'Price G28 at 46,500', worth: 525000, worth_basis: 'profit_30d', kind: 'price', dept: 'sales',
      confidence: 3.6, evidence: 'not a list', mind: { not: 'words' }, target: 'unicorns', effect: 5 },
    { title: 'Clear the dead stock', kind: 'other', dept: 'store', confidence: '4', target: 'constructor' },
    { title: 'Hire a second Saturday loader', kind: 'other', dept: 'people', confidence: 0 },
    { title: 'Post the rains price list', kind: 'other', dept: 'marketing', confidence: true, worth_basis: 'sales' },
    { title: 'Teach Joan to quote', kind: 'other', dept: 'hr' },
    { title: 'Count the paint shelf', kind: 'other', dept: 'store', touches: 'sales' },
    { title: 'A ninth move', kind: 'other', dept: 'finance' },
  ],
  chains: [
    { title: 'Credit given without terms', dept: 'sales', links: [
      link('sales', 'Sales go out on credit with no due date', '38% of sales', 'shop_pulse'),
      link('finance', 'Customers hold your money', '11,600,000 owed', 'list_debtors'),
      link('finance', 'Lowest cash of the month', '1,350,000 on 14 Oct', 'shop_pulse'),
      link('procurement', 'Buying waits for cash', 'late', 'purchase_plan'),
      link('hr', 'A department nobody named', '3 of 4', 'manager_history'),
      link('finance', 'The bank offers a loan', '10,000,000 at 22%', 'Some Tool!'),
      link('finance', 'A fifth good link', '1 day', 'shop_pulse'),
      link('finance', 'A sixth good link, over the cap', '2 days', 'shop_pulse'),
    ], fix: { title: '14-day terms for new builders', move: 2 }, confidence: 4 },
    { title: 'Only you can quote', dept: 'people', links: two, fix: { title: 'Teach Joan', move: 99 }, confidence: 7 },
    { title: 'The root cause of the squeeze', links: two },
    { title: 'One link only', links: [two[0]] },
    { title: 'Quotes wait', links: two, fix: { move: 12 } },
    { title: 'A fifth reading, over the cap', links: two },
  ],
  asks: [
    { q: 'What is Kasubi charging for G28 sheets this week?', product_id: 'P1', variant_index: 0, rival: 'Kasubi Depot',
      why: 'It decides whether 46,500 holds', stake: 525000, dept: 'sales', confidence: 4,
      place: { kind: 'rival', id: 'Kasubi Depot' },
      choices: [{ label: 'Under 45,000', effect: 'Hold the price move', confidence_after: 2 },
        { label: '45,000 to 46,500', effect: 'Price at 45,500 instead', confidence_after: 4 },
        'Still 47,000 or more', { label: 'a fourth', effect: 'x' }],
      delegate: { staff: 'moses' } },
    { q: 'Did Kato give you a date when you last spoke?', why: 'Simba waits on it', stake: 0,
      place: { kind: 'customer', id: 7 }, delegate: 'Joan', choices: ['This Friday', 'Next week'] },
    { q: 'Would Peter work Saturday overtime?', place: { kind: 'staff', id: 'Peter' }, stake: 'a lot',
      confidence: 'high', delegate: { staff: 'Nobody Known' } },
    { q: 'A fourth question, over the cap', place: { kind: 'you' } },
  ],
  plays: [
    { name: 'Cash price 3% under credit', treats: 'cash', how: 'h', sized: 's', watch: 'w', weeks: 6, dept: 'finance',
      hypothesis: { if: 'cash costs 3% less than credit', then: '1 in 4 credit buyers pays cash', target: 'cash share from 62% to 70%' },
      stop: { threshold: 'cash share under 64%', by_week: 4 }, cost: 60000, depends_on: 'Chase Kato for 2,400,000' },
    { name: 'Saturday delivery', treats: 'growth', weeks: 4, dept: 'mystery', hypothesis: { if: 'only an if' },
      stop: { threshold: 'under +10%', by_week: 9 }, cost: -5, depends_on: '' },
  ],
  targets: [{ metric: 'collections', aim: 3000000, why: 'w', parts: [] }],
  rejected: 'r', keyline: 'k',
};

const extract = compileScope([extractFunction(src, 'apExtractPlan', 'index.html')], {}, ['apExtractPlan']).apExtractPlan;
const saver = (inserted, data) => compileScope([
  extractFunction(src, 'managerSaveMeeting', 'index.html'),
  ...FIELDS,
  extractDeclaration(src, 'MANAGER_DOORS', 'index.html'),
  extractDeclaration(src, 'MANAGER_MOVE_KINDS', 'index.html'),
  extractFunction(src, 'managerResolvedSubject', 'index.html'),
  extractDeclaration(src, 'MANAGER_WORTH_BASES', 'index.html'),
  extractDeclaration(src, 'MANAGER_LEVERS', 'index.html'),
  extractDeclaration(src, 'MANAGER_OBJECTIVES', 'index.html'),
  extractDeclaration(src, 'MANAGER_PROBLEMS', 'index.html'),
  extractFunction(src, 'buyKeyParts', 'index.html'),
  extractFunction(src, 'stockKey', 'index.html'),
  'async function managerInsertProposals(rows){ return sb.from(\'manager_notes\').insert(rows); }',
], {
  managerNotesTable: true, currentShopId: 'shop-1', todayISO: () => TODAY, data,
  apRound: (n) => Math.round(Number(n) || 0), toast: () => {}, setBuyHold: () => true,
  sb: { from: () => ({ insert: (row) => { inserted.push(row); return {
    select: () => ({ single: () => Promise.resolve({ data: { id: 21 }, error: null }) }) }; } }) },
  console, Promise, JSON, Math, Number, String, Array, Object, Set,
}, ['managerSaveMeeting']).managerSaveMeeting;
const rowsOf = (inserted, kind) => {
  const single = inserted.find((r) => !Array.isArray(r) && r.kind === kind);
  return single ? [single] : (inserted.find((r) => Array.isArray(r) && r[0] && r[0].kind === kind) || []);
};

const text = 'Cash first — Kato’s 2,400,000 is the week.\n\n[plan: ' + JSON.stringify(PLAN) + ']';
const parsed = extract(text);
t.check(parsed.plan && Array.isArray(parsed.plan.moves) && parsed.plan.moves.length === 9,
  'the whole block parses — every new field is plain JSON the walker already reads');
t.check(!/\[plan:/.test(parsed.clean) && !/chains/.test(parsed.clean), 'and none of it reaches the screen as text');

const inserted = [];
const meetingId = await saver(inserted, DATA())(parsed.plan);
eq(meetingId, 21, 'the meeting is saved');

/* -- the meeting row -- */
{
  const b = rowsOf(inserted, 'meeting')[0].body;
  eq(b.verdict, 'Profit is up. Cash is down. It is the same problem in four departments.',
    'the verdict is kept in the Manager’s own words, its whitespace tidied');
  eq(b.sure, 4, 'with how sure it was of the whole plan');
  eq(b.moves, 9, 'the count of moves PROPOSED is kept as before (the screen says when one was over the ceiling)');
  t.check(Array.isArray(b.chains) && b.chains.length === 3, `at most three chains survive (got ${b.chains && b.chains.length})`);
  same(b.chains.map((c) => c.title), ['Credit given without terms', 'Only you can quote', 'Quotes wait'],
    'a chain claiming a root cause is not kept, nor one with a single link — and the cap counts what survived');
  const c0 = b.chains[0];
  same(c0.links.map((l) => l.text), ['Sales go out on credit with no due date', 'Customers hold your money',
    'Lowest cash of the month', 'A department nobody named', 'A fifth good link'],
  'a link with no figure, or a source that is not a tool name, is dropped; five at most');
  eq(c0.links[3].dept, undefined, 'a department outside the six is not drawn as a seventh');
  eq(c0.links[0].tool, 'shop_pulse', 'each link keeps the tool its figure came from');
  eq(c0.dept, 'sales', 'the chain starts where the meeting said');
  same(c0.fix, { title: '14-day terms for new builders', move: 1 },
    'the fix points at the second move, stored 0-based like `after`');
  eq(c0.confidence, 4, 'with its confidence');
  same(b.chains[1].fix, { title: 'Teach Joan' }, 'a fix pointing outside the plan keeps its words and loses the pointer');
  eq(b.chains[1].confidence, undefined, 'a confidence of 7 is off the scale and refused, never pinned to 5');
  eq(b.chains[2].dept, 'sales', 'a chain with no dept starts where its first link sits');
  eq(b.chains[2].fix, undefined, 'and one whose fix pointed nowhere carries none');
}

/* -- the moves -- */
const moves = rowsOf(inserted, 'move').map((r) => r.body);
{
  eq(moves.length, 8, 'EIGHT moves are kept and the ninth is not (the prompt and the saver agree on eight)');
  const [m0, m1, m2, m3, m4, m5, m6, m7] = moves;
  eq(m0.dept, 'finance', 'a move keeps its department');
  same(m0.touches, ['procurement', 'store'], 'and the others it moves — never its own, never twice, never an unknown');
  eq(m0.confidence, 5, 'its confidence');
  same(m0.evidence, ['Paid within 3 days of 4 of 4 chases', 'Owes 2,400,000, oldest 41 days', 'Cement cover 11 days'],
    'evidence with a figure in it, three at most — "a hunch with nothing behind it" is not evidence');
  eq(m0.mind, 'If Kato has not paid by Thursday evening', 'what would change its mind');
  same(m0.target, { metric: 'collections' }, 'the target metric it serves');
  eq(m0.effect, 2400000, 'and its size in that target’s unit');
  eq(m0.fromQuestion, 12, 'and the answer that shaped it');
  eq(m0.worthBasis, 'cash_freed', 'the existing whitelist still runs');
  eq(m1.worthBasis, 'sales', 'SALES KEPT OR WON is a basis now — labelled as itself, never ranked against cash or profit');
  eq(m1.confidence, undefined, 'a confidence of 9 is refused');
  same(m1.target, { id: 31 }, 'a target named by its scoreboard id');
  eq(m1.effect, undefined, 'an effect written as words-with-commas is not a number');
  eq(m1.fromQuestion, undefined, 'a question id written in words is not an id');
  eq(m1.after, 0, 'and `after` still resolves inside the eight');
  eq(m2.confidence, 4, 'a half rounds');
  eq(m2.evidence, undefined, 'evidence that is not a list is nothing');
  eq(m2.mind, undefined, 'an object where a sentence belongs is nothing');
  eq(m2.target, undefined, 'a metric this app cannot measure is no target');
  eq(m2.effect, undefined, 'and with no target an effect floats free, so it is dropped');
  eq(m3.confidence, 4, 'a confidence written as a string of a whole number is read');
  eq(m3.target, undefined, 'and an inherited property name is not a metric');
  eq(m4.confidence, undefined, 'zero is off the scale');
  eq(m5.confidence, undefined, 'and so is true');
  eq(m6.dept, undefined, 'a department outside the six is nothing');
  eq(m7.touches, undefined, 'touches that are not a list are nothing');
  /* The plan's own order, untouched: rows go in as one insert in the
     order the meeting wrote them, whatever their confidence. */
  same(moves.map((m) => m.title).slice(0, 3), ['Chase Kato for 2,400,000', 'Pay Roofings before Saturday', 'Price G28 at 46,500'],
    'THE MEETING’S ORDER IS KEPT — confidence is stored beside a move and never re-ranks it');
}

/* -- the questions -- */
{
  const qs = rowsOf(inserted, 'question').map((r) => r.body);
  eq(qs.length, 3, 'three questions at most, as before');
  const [a, b, c] = qs;
  eq(a.productId, 'P1', 'the line identity still resolves');
  eq(a.rival, 'Kasubi Depot', 'and the shop');
  eq(a.why, 'It decides whether 46,500 holds', 'why it is asked');
  eq(a.stake, 525000, 'what is at stake, in whole shillings');
  eq(a.dept, 'sales', 'its department');
  eq(a.confidence, 4, 'and how sure the advice it bears on is now');
  same(a.place, { kind: 'rival', name: 'Kasubi Depot' }, 'where the answer is found');
  same(a.choices, ['Under 45,000', '45,000 to 46,500', 'Still 47,000 or more'],
    'the likely answers stay WORDS, three at most — the screen and the answer box read them as before');
  same(a.choiceEffects, [
    { label: 'Under 45,000', effect: 'Hold the price move', confidenceAfter: 2 },
    { label: '45,000 to 46,500', effect: 'Price at 45,500 instead', confidenceAfter: 4 },
    { label: 'Still 47,000 or more' },
  ], 'and beside them, in the same order, what each would change in the advice and how sure it would leave the Manager');
  same(a.delegate, { agentId: 'a-1', name: 'Moses' }, 'a field agent named in any case resolves to the record');
  eq(b.stake, undefined, 'a stake of 0 is absent — it would read as "nothing at stake"');
  same(b.place, { kind: 'customer', id: 7 }, 'a customer place resolves against the books');
  same(b.delegate, { staffId: 's-1', name: 'Joan' }, 'a delegate named as a bare string resolves to the staff record');
  same(b.choices, ['This Friday', 'Next week'], 'choices given as bare words still work');
  eq(b.choiceEffects, undefined, 'and carry no effects when none were given');
  same(c.place, { kind: 'staff', staffId: 's-2', name: 'Peter' }, 'a staff place resolves by name');
  eq(c.stake, undefined, 'a stake in words is nothing');
  eq(c.confidence, undefined, 'a confidence in words is nothing');
  same(c.delegate, { name: 'Nobody Known' }, 'a name the books do not hold is kept as a name only — nothing could send to it');

  const other = [];
  await saver(other, DATA())({ keyline: 'k', moves: [{ title: 'x' }], asks: [
    { q: 'Is Mulongo still trading?', place: { kind: 'customer', id: 999 } },
    { q: 'Ask the carrier pigeon please', place: { kind: 'pigeon' } },
    { q: 'Ask Ron about the delivery', place: { kind: 'staff', id: 'Ron' }, delegate: { staff: 'Ron' } },
    ] });
  const sq = [];
  await saver(sq, DATA())({ keyline: 'k', moves: [{ title: 'x' }], asks: [
    { q: 'Will Roofings deliver on Saturdays?', supplier_id: 'S1', place: { kind: 'supplier', id: 'Roofings Ltd' } },
    { q: 'Does Centenary charge to pay early?', place: { kind: 'bank', name: 'Centenary' } }] });
  const sqb = rowsOf(sq, 'question').map((r) => r.body);
  same(sqb[0].place, { kind: 'supplier', id: 'S1' }, 'a supplier place named loosely falls back to the supplier the ask carries');
  same(sqb[1].place, { kind: 'bank', name: 'Centenary' }, 'and a bank is named, not resolved — the books hold no banks');
  const oq = rowsOf(other, 'question').map((r) => r.body);
  same(oq[0].place, { kind: 'customer' }, 'an invented customer keeps the kind and loses the id');
  eq(oq[1].place, undefined, 'an unknown kind of place is nothing');
  same(oq[2].delegate, { name: 'Ron' }, 'a retired agent is not someone to send a question to');
}

/* -- the plays -- */
{
  const plays = rowsOf(inserted, 'play').map((r) => r.body);
  eq(plays.length, 2, 'two plays');
  const [p, q] = plays;
  eq(p.dept, 'finance', 'a play keeps its department');
  same(p.hypothesis, { if: 'cash costs 3% less than credit', then: '1 in 4 credit buyers pays cash', target: 'cash share from 62% to 70%' },
    'its hypothesis, both halves and the level');
  same(p.stop, { threshold: 'cash share under 64%', byWeek: 4 }, 'the reading that would stop it, inside its six weeks');
  eq(p.cost, 60000, 'what it costs');
  eq(p.dependsOn, 'Chase Kato for 2,400,000', 'and what it waits on');
  eq(p.weeks, 6, 'its span is saved as before');
  eq(p.source, 'manager', 'and its source');
  eq(q.dept, undefined, 'an unknown department is nothing');
  eq(q.hypothesis, undefined, 'an "if" with no "then" claims nothing that could be checked');
  same(q.stop, { threshold: 'under +10%' }, 'a stop week past a four-week span is no check, so only the threshold stays');
  eq(q.cost, undefined, 'a negative cost is nothing');
  eq(q.dependsOn, undefined, 'an empty dependency is nothing');
}

/* -- the targets, unchanged -- */
{
  const tg = rowsOf(inserted, 'target').map((r) => r.body);
  same(Object.keys(tg[0]).sort(), ['aim', 'metric', 'parts', 'why'], 'the weekly targets keep their shape — new kinds of target wait for the Targets bed');
}

/* ---------- 3. a plan with none of it saves what it always did ------- */
{
  const old = [];
  await saver(old, DATA())({ objective: { name: 'margin', why: 'w' }, keyline: 'k', rejected: 'r',
    moves: [{ title: 'Chase', why: 'w', worth: 1, worth_basis: 'cash_freed', lever: 'collect', door: 'chase', kind: 'chase', subject: { customerId: 7 } }],
    asks: [{ q: 'Is Mulongo still trading?', choices: ['Yes', 'No'] }],
    plays: [{ name: 'Charge for cutting', treats: 'margin', how: 'h', sized: 's', watch: 'w', weeks: 4 }] });
  same(Object.keys(rowsOf(old, 'meeting')[0].body).sort(), ['keyline', 'moves', 'objective', 'objectiveWhy', 'rejected'],
    'OLD ROWS STILL READ: a meeting with no new fields saves exactly the keys it always did');
  same(Object.keys(rowsOf(old, 'move')[0].body).sort(),
    ['door', 'lever', 'mkind', 'play', 'subject', 'title', 'unlocks', 'why', 'worth', 'worthBasis'],
    'and so does a move — absent, never null, so the screen falls back to what it derives');
  same(Object.keys(rowsOf(old, 'question')[0].body).sort(), ['choices', 'question'], 'and a question');
  same(Object.keys(rowsOf(old, 'play')[0].body).sort(), ['how', 'name', 'sized', 'source', 'treats', 'watch', 'weeks'], 'and a play');
}

/* ---------- 4. one whitelist for the journal and the session --------- */
{
  const F = compileScope([...FIELDS], { data: DATA(), Math, Number, String, Array, Object },
    ['managerMeetingFields', 'managerMoveFields', 'managerAskFields', 'managerPlayFields', 'managerPips']);
  const b = rowsOf(inserted, 'meeting')[0].body;
  same(F.managerMeetingFields(PLAN, 8), { verdict: b.verdict, sure: b.sure, chains: b.chains },
    'the meeting fields are pure: a plan held only in this session reads exactly as the journal does');
  same(F.managerMoveFields(PLAN.moves[0]), (({ dept, touches, confidence, evidence, mind, target, effect, fromQuestion }) =>
    ({ dept, touches, confidence, evidence, mind, target, effect, fromQuestion }))(moves[0]),
  'and so are a move’s');
  same(F.managerMeetingFields(null, 0), {}, 'nothing in, nothing out');
  same(F.managerMoveFields('a string'), {}, 'a move that is not an object adds nothing');
  same(F.managerAskFields(undefined), {}, 'nor a question');
  same(F.managerPlayFields(7), {}, 'nor a play');
  same([1, 2, 3, 4, 5].map(F.managerPips), [1, 2, 3, 4, 5], 'the five pips');
  same([0, 6, -1, 2.5, '3', '', null, undefined, true, [3], 'x', 5.4, 0.6].map(F.managerPips),
    [null, null, null, 3, 3, null, null, null, null, null, null, 5, 1],
    'and nothing off the scale, nothing that is not a number, halves rounded');
  t.check(/MANAGER_DEPTS = \['finance', 'sales', 'procurement', 'store', 'people', 'marketing'\]/.test(src),
    'the six departments, in the owner’s order (Q2)');
}

/* ---------- 5. the review says where it was wrong -------------------- */
{
  const ins = [];
  const save = compileScope([extractFunction(src, 'managerSaveReview', 'index.html')], {
    managerNotesTable: true, currentShopId: 'shop-1', todayISO: () => TODAY,
    apRound: (n) => Math.round(Number(n) || 0), toast: () => {},
    sb: { from: () => ({ insert: (row) => { ins.push(row); return Promise.resolve({ error: null }); } }) },
    Array, String, Number, Math, Promise, JSON, Object,
  }, ['managerSaveReview']).managerSaveReview;
  await save({ verdict: 'A hard week saved by collections.', lessons: ['One'], corrections: [
    { was: 'Kato pays within 3 days of a chase', now: 'He has not paid 9 days after the last one', why: '0 of 1 this month' },
    { was: 'Paint moves at 15% off', now: '3 tins in 4 weeks' },
    { was: 'only half' },
    'not an object',
    { was: 'A fourth', now: 'over the cap', why: '4' },
    { was: 'A fifth', now: 'over the cap', why: '5' },
  ] }, {});
  same(ins[0].body.corrections, [
    { was: 'Kato pays within 3 days of a chase', now: 'He has not paid 9 days after the last one', why: '0 of 1 this month' },
    { was: 'Paint moves at 15% off', now: '3 tins in 4 weeks' },
    { was: 'A fourth', now: 'over the cap', why: '4' },
  ], 'corrections are kept whole — was and now both, the figure when given — three at most, counted after the half ones go');
  ins.length = 0;
  await save({ verdict: 'v', lessons: [] }, {});
  eq(ins[0].body.corrections, undefined, 'a review that found nothing to correct carries no key at all');
  same(Object.keys(ins[0].body).sort(), ['lessons', 'verdict', 'week'], 'and saves exactly the body it always did');
}

/* ---------- 6. the reading hands it over untouched ------------------- */
{
  const meetingBody = rowsOf(inserted, 'meeting')[0].body;
  const journal = {
    meeting: [{ id: 21, date: TODAY, body: meetingBody, status: 'held' }],
    move: rowsOf(inserted, 'move').map((r, i) => ({ id: 100 + i, meeting_id: 21, date: TODAY, body: r.body, status: 'open' })),
    question: rowsOf(inserted, 'question').map((r, i) => ({ id: 200 + i, date: TODAY, body: r.body, status: 'open' })),
    review: [{ id: 300, date: TODAY, status: 'held', body: { verdict: 'v', lessons: [], corrections: [{ was: 'a 1', now: 'b 2' }] } }],
  };
  const q = () => { const o = { _kind: null };
    o.select = () => o; o.order = () => o; o.in = () => o; o.gte = () => o; o.lte = () => o;
    o.eq = (c, v) => { if (c === 'kind') o._kind = v; return o; };
    o.limit = () => Promise.resolve({ data: journal[o._kind] || [], error: null });
    o.then = (res) => res({ data: journal[o._kind] || [], error: null });
    return o; };
  const load = compileScope([extractFunction(src, 'managerLoadState', 'index.html'),
    extractFunction(src, 'managerRecentReviews', 'index.html')], {
    managerNotesTable: true, currentShopId: 'shop-1', todayISO: () => TODAY, anShiftDate: (d) => d,
    managerScoreboard: async () => ({ targets: [] }), sb: { from: q }, console, Promise, Math, Number, String, Object, Array, Set,
  }, ['managerLoadState']).managerLoadState;
  const st = await load();
  same(st.today.meeting.body, meetingBody, 'the meeting reaches the screen exactly as it was written — verdict, sure and chains');
  same(st.today.moves.map((m) => m.body), journal.move.map((m) => m.body), 'every move with its new fields');
  same(st.questions.map((x) => x.body), journal.question.map((x) => x.body), 'every open question with its place, stake and effects');
  same(st.reviews[0].body.corrections, [{ was: 'a 1', now: 'b 2' }], 'and the review’s corrections, for the Memory');

  /* The playbook's own view is a whitelist of its own -- the new parts
     of a play pass through it, and an old play gains no keys. */
  const plays = rowsOf(inserted, 'play').map((r, i) => ({ id: 400 + i, date: TODAY, status: 'proposed', body: r.body }));
  plays.push({ id: 500, date: TODAY, status: 'proposed', body: { name: 'An old play', treats: 'margin', source: 'manager' } });
  const book = await compileScope([extractFunction(src, 'managerPlaybook', 'index.html'),
    extractDeclaration(src, 'MANAGER_PROBLEMS', 'index.html')], {
    managerNotesTable: true, currentShopId: 'shop-1', todayISO: () => TODAY,
    managerPlayProgress: () => null, managerPlayClock: () => null,
    sb: { from: () => { const o = {}; o.select = () => o; o.eq = () => o; o.order = () => o;
      o.limit = () => Promise.resolve({ data: plays, error: null }); return o; } },
    console, Promise, Math, Number, String, Object, Array, Set, Map,
  }, ['managerPlaybook']).managerPlaybook();
  const p = book.proposed.find((x) => x.name === 'Cash price 3% under credit');
  same([p.dept, p.hypothesis, p.stop, p.cost, p.dependsOn], [plays[0].body.dept, plays[0].body.hypothesis,
    plays[0].body.stop, plays[0].body.cost, plays[0].body.dependsOn],
  'the playbook hands the screen the hypothesis, stop, cost, dependency and department as saved');
  const oldPlay = book.proposed.find((x) => x.name === 'An old play');
  t.check(!['dept', 'hypothesis', 'stop', 'cost', 'dependsOn'].some((k) => k in oldPlay),
    'and an old play gains none of them');
}

/* ---------- 7. the meeting alone gets the bigger answer -------------- */
{
  t.check(/max_tokens: mgrMode === 'manager' \? 4000 : 3000,/.test(api),
    'the morning meeting is allowed 4000 tokens (Q7); the review and the plain assistant stay at 3000');
}

process.exit(t.done() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
