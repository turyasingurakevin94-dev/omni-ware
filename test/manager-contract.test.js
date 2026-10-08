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
  ...['managerPips', 'managerPlanText', 'managerMeetingFields', 'managerMoveFields', 'managerPlanRefs', 'managerAskFields', 'managerPlayFields']
    .map((n) => extractFunction(src, n, 'index.html')),
  extractDeclaration(src, 'MANAGER_DEPTS', 'index.html'),
  extractDeclaration(src, 'MANAGER_ASK_PLACES', 'index.html'),
  extractDeclaration(src, 'MANAGER_METRICS', 'index.html'),
  /* What a play's aim and stop figures are read on (Q38). */
  extractDeclaration(src, 'MANAGER_PROBLEM_METRICS', 'index.html'),
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
  t.check(/sales \(what a named customer or line bought in the last 30 days, from a tool, that this move keeps or wins back/.test(meeting),
    'the third kind of money is anchored in the books like the other two — what a named customer or line already bought');
  t.check(/never a guess at new sales, and its figure is never compared with cash or profit\)/.test(meeting),
    'NEVER FORECAST at the sales basis: never a guess at new sales — and its figure is never compared with cash or profit');

  t.check(/SIX DEPARTMENTS\. Advise across finance \(cash, debt, creditors, loans\), sales \(invoices, quotes, margin, customers\), procurement \(bills, buying, suppliers\), store \(stock, dead stock, counts\), people \(staff, payroll, picks\) and marketing \(WhatsApp posts, broadcasts, repeat customers\)/.test(meeting),
    'the six departments, each with what it holds — the mapping the owner approved (Q2)');
  t.check(/A department gets a move only where the books show something there/.test(meeting)
    && /never invent one to fill a slot: eight is a ceiling, not a quota/.test(meeting),
    'and a department gets a move only on the books’ evidence — eight slots is not a demand for eight moves');

  t.check(/verdict: ONE first-person sentence from the figures, the first thing the owner reads/.test(meeting),
    'the verdict is one first-person sentence, from the figures');
  /* WAS: these pins quoted the contract lines' dashes as \u2013 / \u2014
     escapes. NOW: the four contract lines carry the characters themselves
     -- five source characters each, freed to fit the Q38 fields under
     the 20,000 ceiling -- and the pins quote the same words. */
  t.check(/sure: 1–5 for the whole plan/.test(meeting), 'with how sure the whole plan is');
  t.check(/On a move: dept; touches\[\], the other departments it moves/.test(meeting),
    'each move names its department and the others it moves');
  t.check(/confidence 1–5, a judgement, never a rank — your order IS the ranking and no figure is ever multiplied by a confidence/.test(meeting),
    'CONFIDENCE NEVER RE-RANKS: the plan order stays the ranking and no figure is multiplied by a confidence (Q5)');
  t.check(/evidence, at most 3 phrases each carrying a figure a tool returned/.test(meeting),
    'evidence carries figures a tool returned, not adjectives');
  t.check(/mind, what would change your mind, as an event the books would show/.test(meeting),
    'what would change its mind is an event the books can show');
  t.check(/target, the metric or the scoreboard id it serves, and effect, its size in that unit by arithmetic on the books/.test(meeting),
    'a move links to the target it serves — an id the scoreboard gave it — sized by arithmetic, never a forecast');
  t.check(/from_question, the answered question that shaped it, its asked words copied exactly from answered_questions — never an id, never one no tool returned/.test(meeting),
    'and to the answer that shaped it, by the words manager_history showed it — the only handle it is ever given');

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
  t.check(/An ask may also carry why \(what the answer decides\), stake \(shillings a tool sized, else omit\), dept, confidence \(1–5, how sure the advice it bears on is now\)/.test(meeting),
    'why it is asked, what is at stake only when a tool sized it, and how sure the advice is now');
  t.check(/place \(kind, and the id or name of where to find out\), choices as objects \(label; effect, what that answer changes in your advice; confidence_after\)/.test(meeting),
    'each likely answer says what it would change in the advice and how sure it would leave the Manager');
  /* WAS: delegate (who on the staff could find out — the owner sends it,
     never you). NOW: and the day they go (Q38); the law is unchanged. */
  t.check(/and delegate \(who on the staff could find out, and the day they go — the owner sends it, never you\)/.test(meeting),
    'NOTHING SENDS ITSELF: a delegated question is the owner’s to send — on the day the meeting gives it (Q38)');

  t.check(/A PLAY IS A TEST: dept; hypothesis \(if, then, and the target level it should reach, from the books — a claim to test, never a promise\)/.test(meeting),
    'a play is a hypothesis to test, never a promise — the never-forecast law at the play');
  t.check(/stop \(threshold and by_week, the reading that ends it\); cost in shillings; depends_on, the play or move it waits for/.test(meeting),
    'with the reading that would stop it, its cost and what it waits for');
  /* WAS: "...the play or move it waits for. Never say a play caused...".
     NOW: the aim and the stop as figures come between (Q38) -- LEVELS of
     a week's reading (never a rise), margin in % points, the rest in
     shillings as every figure in the contract is. */
  t.check(/the play or move it waits for; aim\.value, stop\.value: a week’s level of what it treats \(margin in % points\); stop\.when: above or below\. Never say a play caused what followed it\./.test(meeting),
    'a play’s aim and stop are also figures — a week’s level of what it treats, margin in % points — the stop above or below (Q38); and NO CREDIT: a play is never said to have caused what followed it');
  /* NOW: the planned price is said to be WHOLESALE -- the side the Ask
     scale draws it on and the Simulator's lever prices it on. */
  t.check(/from_question[^']*; price, a price\/policy move’s planned wholesale unit price for its line, in shillings\./.test(meeting),
    'a price or policy move carries the WHOLESALE unit price it plans for its line, in shillings (Q38)');
  t.check(/NEVER propose a play the shop has tried and dropped/.test(meeting),
    'and the rule against re-proposing a dropped play stands');
  /* A PLAY COMES BACK ONLY THROUGH A FIELD THAT COUNTS IT (Q14).
     The owner approved letting a play THEY judged worked twice or more
     be proposed again. But the playbook folds a play marked as worked
     into the dropped list, manager_history hands that list over as
     tried_and_dropped and do_not_repeat.plays_dropped -- "never
     re-propose" -- and nothing counts how often the owner judged one
     worked. A sentence granting the exception would contradict the
     data it depends on, and the model could not tell a proven recipe
     from a play the owner set aside. So the rulebook grants it only
     once the app hands the meeting the count it needs: a field naming
     the proven recipes, and worked plays no longer filed as dropped. */
  {
    const both = meeting + common;
    const grants = /proven recipe|proposed again/i.test(both);
    const book = extractFunction(src, 'managerPlaybook', 'index.html');
    const foldsWorked = /x\.status === 'dropped' \|\| x\.status === 'done'/.test(book);
    t.check(!grants || (/proven_recipes/.test(both) && src.includes('proven_recipes') && !foldsWorked),
      'a proven recipe may come back only through a counted field the app produces, never against a list that says never re-propose');
    /* The permission is now given (Q14), tied to that field, and carries
       the no-credit law with it. manager-playbook.test.js runs
       manager_history and holds the field to it: a play the owner judged
       worked twice is in proven_recipes and in neither never-again list. */
    t.check(grants && /only a play it lists in proven_recipes \(the owner\\u2019s own verdict, counted\) may be proposed again, and never claim it caused anything/.test(meeting),
      'the meeting may propose again only a play manager_history lists in proven_recipes — the owner’s verdict, counted — and never as its cause');
    t.check(/proven_recipes: book\.proven\.map\(r=> \(\{ name: r\.name, treats: r\.treats,\s*judged_worked: r\.judgedWorked \}\)\)/.test(src),
      'and manager_history hands it as { name, treats, judged_worked }');
  }

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
  t.check(/"choices":\[\{"label":"","effect":"","confidence_after":4\}\]/.test(meeting) && /"delegate":\{"staff":"","day":"Thu"\}/.test(meeting),
    'and an ask with choices as objects and a delegate with the day they go');
  /* WAS: the example's stop carried "value":8,"when":"below" and its aim
     "unit":"%". NOW: both are said in the prose above (stop.value,
     stop.when: above or below; margin in % points), and the example
     keeps the aim's shape -- room for the targets track's sat_load under
     the 20,000 ceiling. */
  t.check(/"hypothesis":\{"if":"","then":"","target":""\},"stop":\{"threshold":"","by_week":2\},"aim":\{"value":10\}/.test(meeting),
    'and a play as a test, its aim as a figure');

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
      mind: 'If Kato has not paid by Thursday evening', target: 'collections', effect: 2400000,
      from_question: '  did Kato say when he’d pay ' },
    { title: 'Pay Roofings before Saturday', why: 'w', worth: 1600000, worth_basis: 'sales', lever: 'cost',
      door: 'creditors', kind: 'settle', subject: { supplierId: 'S1' }, after: 1,
      dept: 'procurement', touches: ['store', 'sales'], confidence: 9, target: 31, effect: '1,600,000', from_question: 12 },
    { title: 'Price G28 at 46,500', worth: 525000, worth_basis: 'profit_30d', kind: 'price', dept: 'sales',
      confidence: 3.6, evidence: 'not a list', mind: { not: 'words' }, target: 'unicorns', effect: 5 },
    { title: 'Clear the dead stock', kind: 'other', dept: 'store', confidence: '4', target: 'constructor' },
    { title: 'Hire a second Saturday loader', kind: 'other', dept: 'people', confidence: 0,
      target: 44, effect: 5, from_question: 'Would Peter work Saturday overtime?' },
    { title: 'Post the rains price list', kind: 'other', dept: 'marketing', confidence: true, worth_basis: 'sales',
      target: '45', from_question: 'Was the answer left blank?' },
    { title: 'Teach Joan to quote', kind: 'other', dept: 'hr', target: ' 46 ', effect: 1, from_question: 'An answer nobody gave' },
    { title: 'Count the paint shelf', kind: 'other', dept: 'store', touches: 'sales', target: 31.5, from_question: 'Did' },
    { title: 'A ninth move', kind: 'other', dept: 'finance', target: 47 },
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

/* What the journal holds for a move to point at. Every row is the
   shop's own; the stub filters by the columns the saver asks about, so
   a pointer survives only if the saver asked for the right thing. */
const JOURNAL = [
  { id: 12, kind: 'question', status: 'answered', body: { question: 'Did Kato say when he’d pay?', answer: 'Friday, he said' } },
  { id: 13, kind: 'question', status: 'open', body: { question: 'Would Peter work Saturday overtime?' } },
  { id: 14, kind: 'question', status: 'answered', body: { question: 'Was the answer left blank?' } },
  { id: 31, kind: 'target', status: 'open', body: { metric: 'collections' } },
  { id: 45, kind: 'target', status: 'declined', body: { metric: 'sales' } },
  { id: 46, kind: 'target', status: 'proposed', body: { metric: 'gross_profit' } },
  { id: 47, kind: 'target', status: 'open', body: { metric: 'sales' } },
];
const journalDb = (inserted, journal, reads, fail) => ({ from: () => {
  const f = { eq: {}, in: null };
  const rows = () => (journal || []).filter((r) => Object.keys(f.eq).every((k) => k === 'shop_id' || String(r[k]) === String(f.eq[k]))
    && (!f.in || f.in.vals.map(String).includes(String(r[f.in.col]))));
  const answer = () => { reads.push(JSON.parse(JSON.stringify(f)));
    return Promise.resolve(fail ? { data: null, error: { message: 'offline' } } : { data: rows(), error: null }); };
  const o = {
    insert: (row) => { inserted.push(row); return {
      select: () => ({ single: () => Promise.resolve({ data: { id: 21 }, error: null }) }) }; },
    select: () => o, order: () => o,
    eq: (c, v) => { f.eq[c] = v; return o; },
    in: (c, vals) => { f.in = { col: c, vals }; return o; },
    limit: () => answer(),
    then: (res, rej) => answer().then(res, rej),
  };
  return o;
} });

const extract = compileScope([extractFunction(src, 'apExtractPlan', 'index.html')], {}, ['apExtractPlan']).apExtractPlan;
const saver = (inserted, data, reads = [], fail = false) => compileScope([
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
  sb: journalDb(inserted, JOURNAL, reads, fail),
  console: { warn: () => {}, log: console.log, error: console.error }, Promise, JSON, Math, Number, String, Array, Object, Set,
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
const reads = [];
const meetingId = await saver(inserted, DATA(), reads)(parsed.plan);
eq(meetingId, 21, 'the meeting is saved');
/* The journal is read for what the pointers may land on -- the
   shop's own answered questions, and only the target ids the KEPT
   moves name -- before anything is written. */
{
  const q = reads.find((r) => r.eq.kind === 'question');
  const tg = reads.find((r) => r.eq.kind === 'target');
  t.check(!!q && q.eq.status === 'answered' && q.eq.shop_id === 'shop-1',
    'the answered questions are read, this shop’s only');
  t.check(!!tg && tg.eq.shop_id === 'shop-1' && tg.in && tg.in.col === 'id',
    'and the targets the moves name, by id, this shop’s only');
  same(tg.in.vals.slice().sort((a, b) => a - b), [31, 44, 45, 46],
    'only the ids the eight kept moves name — the ninth move’s target is never looked up');
  eq(reads.length, 2, 'two reads, no more');
}

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
  eq(m0.fromQuestion, 12, 'and the answer that shaped it — its asked words matched to the answered row, stored as that row’s id');
  eq(m0.worthBasis, 'cash_freed', 'the existing whitelist still runs');
  eq(m1.worthBasis, 'sales', 'SALES KEPT OR WON is a basis now — labelled as itself, never ranked against cash or profit');
  eq(m1.confidence, undefined, 'a confidence of 9 is refused');
  same(m1.target, { id: 31 }, 'a target named by its scoreboard id, live in the journal');
  eq(m1.effect, undefined, 'an effect written as words-with-commas is not a number');
  eq(m1.fromQuestion, undefined, 'a bare question id is never trusted — the meeting is shown none, so one is invented');
  eq(m1.after, 0, 'and `after` still resolves inside the eight');
  eq(m2.confidence, 4, 'a half rounds');
  eq(m2.evidence, undefined, 'evidence that is not a list is nothing');
  eq(m2.mind, undefined, 'an object where a sentence belongs is nothing');
  eq(m2.target, undefined, 'a metric this app cannot measure is no target');
  eq(m2.effect, undefined, 'and with no target an effect floats free, so it is dropped');
  eq(m3.confidence, 4, 'a confidence written as a string of a whole number is read');
  eq(m3.target, undefined, 'and an inherited property name is not a metric');
  eq(m4.confidence, undefined, 'zero is off the scale');
  eq(m4.target, undefined, 'A TARGET THE BOOKS DO NOT HOLD IS NO TARGET: id 44 is in no journal');
  eq(m4.effect, undefined, 'and its effect goes with it');
  eq(m4.fromQuestion, undefined, 'a question still open was answered by nobody — it shaped nothing');
  eq(m5.confidence, undefined, 'and so is true');
  eq(m5.target, undefined, 'a target the owner declined is served by nothing');
  eq(m5.fromQuestion, undefined, 'a question marked answered with no answer in it shaped nothing');
  eq(m6.dept, undefined, 'a department outside the six is nothing');
  same(m6.target, { id: 46 }, 'a target awaiting approval is a real one to serve, its id written as a string read as the id');
  eq(m6.effect, 1, 'with its effect');
  eq(m6.fromQuestion, undefined, 'and words no answered question carries point at nothing');
  eq(m7.touches, undefined, 'touches that are not a list are nothing');
  eq(m7.target, undefined, 'an id with a fraction is no id');
  eq(m7.fromQuestion, undefined, 'and three letters match nothing, however many questions begin with them');
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
  const oldReads = [];
  await saver(old, DATA(), oldReads)({ objective: { name: 'margin', why: 'w' }, keyline: 'k', rejected: 'r',
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
  eq(oldReads.length, 0, 'and a plan whose moves point at nothing reads nothing before it is written');
}

/* ---------- 3b. a journal that cannot be read vouches for nothing ---- */
{
  const ins = [];
  const failed = [];
  const id = await saver(ins, DATA(), failed, true)({ keyline: 'k', moves: [
    { title: 'Chase Kato', target: 31, effect: 9, from_question: 'Did Kato say when he’d pay?', dept: 'finance' },
    { title: 'Lift collections', target: 'collections', effect: 7 }] });
  eq(id, 21, 'the meeting is still saved when the journal cannot be read');
  const [a, b] = rowsOf(ins, 'move').map((r) => r.body);
  eq(a.target, undefined, 'but an id nothing could check is not kept');
  eq(a.effect, undefined, 'nor its effect');
  eq(a.fromQuestion, undefined, 'nor the answer it named');
  eq(a.dept, 'finance', 'and everything that needs no checking is kept as before');
  same([b.target, b.effect], [{ metric: 'collections' }, 7], 'a metric target needs no journal, so it stands');
  eq(failed.length, 2, 'both readings were tried');

  /* A read that THROWS rather than answering an error is the same
     answer, and must never take the meeting down with it. */
  const thrown = [];
  const save = compileScope([
    extractFunction(src, 'managerSaveMeeting', 'index.html'), ...FIELDS,
    extractDeclaration(src, 'MANAGER_DOORS', 'index.html'), extractDeclaration(src, 'MANAGER_MOVE_KINDS', 'index.html'),
    extractFunction(src, 'managerResolvedSubject', 'index.html'), extractDeclaration(src, 'MANAGER_WORTH_BASES', 'index.html'),
    extractDeclaration(src, 'MANAGER_LEVERS', 'index.html'), extractDeclaration(src, 'MANAGER_OBJECTIVES', 'index.html'),
    extractDeclaration(src, 'MANAGER_PROBLEMS', 'index.html'), extractFunction(src, 'buyKeyParts', 'index.html'),
    extractFunction(src, 'stockKey', 'index.html'),
  ], {
    managerNotesTable: true, currentShopId: 'shop-1', todayISO: () => TODAY, data: DATA(),
    apRound: (n) => Math.round(Number(n) || 0), toast: () => {}, setBuyHold: () => true,
    sb: { from: () => ({ insert: (row) => { thrown.push(row); return {
      select: () => ({ single: () => Promise.resolve({ data: { id: 22 }, error: null }) }) }; },
      select: () => { throw new Error('socket closed'); } }) },
    console: { warn: () => {} }, Promise, JSON, Math, Number, String, Array, Object, Set,
  }, ['managerSaveMeeting']).managerSaveMeeting;
  eq(await save({ keyline: 'k', moves: [{ title: 'Chase', target: 31, from_question: 'Did Kato say when he’d pay?' }] }), 22,
    'a read that throws still saves the meeting');
  const tm = rowsOf(thrown, 'move').map((r) => r.body)[0];
  same([tm.target, tm.fromQuestion], [undefined, undefined], 'with neither pointer');
}

/* ---------- 4. one whitelist for the journal and the session --------- */
{
  const F = compileScope([...FIELDS], { data: DATA(), Math, Number, String, Array, Object },
    ['managerMeetingFields', 'managerMoveFields', 'managerAskFields', 'managerPlayFields', 'managerPips']);
  const b = rowsOf(inserted, 'meeting')[0].body;
  same(F.managerMeetingFields(PLAN, 8), { verdict: b.verdict, sure: b.sure, chains: b.chains },
    'the meeting fields are pure: a plan held only in this session reads exactly as the journal does');
  const REFS = { answered: [{ id: 12, question: 'Did Kato say when he’d pay?' }], targets: [31] };
  const pick = ({ dept, touches, confidence, evidence, mind, target, effect, fromQuestion }) =>
    ({ dept, touches, confidence, evidence, mind, target, effect, fromQuestion });
  same(F.managerMoveFields(PLAN.moves[0], REFS), pick(moves[0]), 'and so are a move’s, given what the journal holds');
  same(F.managerMoveFields(PLAN.moves[1], REFS), pick(moves[1]), 'its target id included');
  same(F.managerMoveFields({ target: 31, effect: 4, from_question: 'Did Kato say when he’d pay?' }), {},
    'WITH NOTHING TO VOUCH FOR THEM, neither pointer is kept — a plan held only in this session has no journal to land on');
  same(F.managerMoveFields({ target: 'collections', effect: 4 }), { target: { metric: 'collections' }, effect: 4 },
    'while a metric target needs no journal at all');
  same(F.managerMoveFields({ from_question: 'did kato say when he d pay' }, REFS), { fromQuestion: 12 },
    'the asked words match through case, spacing and punctuation');
  same(F.managerMoveFields({ from_question: 'Did Kato say when he’d pay? Probably Friday' }, REFS), {},
    'but not through added words — near enough is not the question');
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

/* ---------- 6b. Q38: the price a move plans, the aim and stop as figures,
   and the day a delegate goes -- through the save path, each whitelisted - */
{
  /* Wednesday 7 October 2026. */
  const ins = [];
  await saver(ins, DATA())({ keyline: 'k', moves: [
    { title: 'Price G28 at 46,500', kind: 'price', subject: { key: 'P1::0' }, price: 46500 },
    { title: 'Hold G30 at 47,000', kind: 'policy', subject: { key: 'P1::1' }, price: 47000.6 },
    { title: 'Price in words', kind: 'price', subject: { key: 'P1::0' }, price: '46,500' },
    { title: 'A chase is no price', kind: 'chase', subject: { customerId: 7, key: 'P1::0' }, price: 46500 },
    { title: 'A line nobody stocks', kind: 'price', subject: { key: 'P9' }, price: 100 },
    { title: 'No line at all', kind: 'price', subject: { customerId: 7 }, price: 100 },
    { title: 'A price of nothing', kind: 'price', subject: { key: 'P1::0' }, price: 0 },
    { title: 'Priced below nothing', kind: 'policy', subject: { key: 'P1::0' }, price: -5 },
  ], asks: [
    { q: 'What does Kasubi charge for G28?', delegate: { staff: 'Moses', day: 'Thu' } },
    { q: 'Is Kato still trading?', delegate: { staff: 'Joan', day: '2026-10-20' } },
    { q: 'Will Roofings deliver Saturday?', delegate: { staff: 'Joan', day: '2026-10-06' } },
  ], plays: [
    { name: 'Charge for cutting', treats: 'margin', weeks: 4,
      aim: { value: 10.04, unit: '%' }, stop: { threshold: 'the share kept below 8%', by_week: 2, value: 8, when: 'below' } },
    { name: 'Friday chase', treats: 'debt', weeks: 6, aim: { value: 100000000.4 }, stop: { value: 120000000, when: 'above', by_week: 3 } },
  ] });
  const mv = rowsOf(ins, 'move').map((r) => r.body);
  same(mv.map((b) => b.price), [46500, 47001, undefined, undefined, undefined, undefined, undefined, undefined],
    'A PRICE IS KEPT ONLY AS A FIGURE, on a price or policy move whose subject is a line the catalogue holds: 46,500; 47,000.6 → 47,001 whole shillings; words, a chase, an unknown line, no line, nothing and below nothing are nothing');
  same(mv[0].subject, { key: 'P1::0' }, 'and the line it prices is the move’s own subject');
  const qs = rowsOf(ins, 'question').map((r) => r.body);
  same(qs[0].delegate, { agentId: 'a-1', name: 'Moses', day: '2026-10-08' }, 'a delegate’s weekday is kept as the next such day from the meeting: Thu → Thursday 8 October');
  same(qs[1].delegate, { staffId: 's-1', name: 'Joan', day: '2026-10-20' }, 'a date is kept as itself');
  same(qs[2].delegate, { staffId: 's-1', name: 'Joan' }, 'a day already gone is nothing — the card reads as it did without one');
  const pl = rowsOf(ins, 'play').map((r) => r.body);
  eq(pl[0].aimValue, 10, 'a margin play’s aim is kept in % points, to one place: 10.04 → 10');
  same(pl[0].stop, { threshold: 'the share kept below 8%', byWeek: 2, value: 8, when: 'below' }, 'and its stop keeps the words, the week and the figure with its direction');
  eq(pl[1].aimValue, 100000000, 'a money play’s aim is whole shillings, no unit needed');
  same(pl[1].stop, { byWeek: 3, value: 120000000, when: 'above' }, 'a stop given only as a figure is kept, with its week');

  /* Old shapes save what they always did: no key appears unasked. */
  const old = [];
  await saver(old, DATA())({ keyline: 'k', moves: [{ title: 'Price it', kind: 'price', subject: { key: 'P1::0' } }],
    asks: [{ q: 'Ask Moses', delegate: { staff: 'Moses' } }], plays: [{ name: 'Old play', treats: 'margin', stop: { threshold: 'below 8%' } }] });
  eq('price' in rowsOf(old, 'move')[0].body, false, 'OLD ROWS: a price move with no price carries no price key');
  same(rowsOf(old, 'question')[0].body.delegate, { agentId: 'a-1', name: 'Moses' }, 'a delegate with no day carries no day');
  const op = rowsOf(old, 'play')[0].body;
  same([op.aimValue, op.stop], [undefined, { threshold: 'below 8%' }], 'and a play with words only keeps words only');

  /* The pure whitelists, edge by edge (no journal needed). */
  const F = compileScope([...FIELDS, extractFunction(src, 'buyKeyParts', 'index.html')],
    { data: DATA(), todayISO: () => TODAY, Math, Number, String, Array, Object, Date, isNaN },
    ['managerMoveFields', 'managerAskFields', 'managerPlayFields']);
  const day = (d) => (F.managerAskFields({ delegate: { staff: 'Moses', day: d } }).delegate || {}).day;
  same(['Thursday', 'thurs', 'THU.', 'wed', 'Wednesday', 'mon', 'sun', 'th', 'someday', '2026-10-07', '2026-02-30', '7 Oct', '2027-01-04'].map(day),
    ['2026-10-08', '2026-10-08', '2026-10-08', '2026-10-07', '2026-10-07', '2026-10-12', '2026-10-11', undefined, undefined, '2026-10-07', undefined, undefined, '2027-01-04'],
    'a weekday, full or short, is the next one on or after the meeting’s Wednesday; today is today; two letters, a word, a date that is no date and a date in words are nothing');
  eq(F.managerAskFields({ delegate: 'Moses' }).delegate.day, undefined, 'a delegate named as a bare word has no day to carry');
  const play = (x) => F.managerPlayFields(x);
  same(play({ treats: 'margin', aim: { value: 10, unit: 'UGX' } }), {}, 'an aim in a unit its measure does not read is nothing — never converted');
  same(play({ treats: 'margin', aim: { value: 250, unit: '%' } }), {}, 'a share past 100% is off the scale');
  same(play({ treats: 'cash', aim: { value: -5 } }), {}, 'money below nothing is no aim');
  same(play({ treats: 'growth', aim: { value: 'lots' }, stop: { threshold: 'x', value: 5, when: 'atmost' } }), { stop: { threshold: 'x' } },
    'an aim in words is nothing, and a stop direction the contract does not offer keeps the words only');
  same(play({ treats: 'other', aim: { value: 5 }, stop: { value: 5, when: 'below' } }), {}, 'a problem nothing here measures takes no figure at all');
  same(play({ treats: 'growth', aim: { value: '90000000', unit: 'ugx' }, stop: { value: '60000000.7', when: 'below' } }),
    { aimValue: 90000000, stop: { value: 60000001, when: 'below' } }, 'figures written as plain numbers are read, money rounded to the shilling');
  /* A SHARE IS IN POINTS. 0.1 with no unit could be a tenth of a point
     or 10% written as a fraction: nothing, never a guess -- the board
     then counts the owner's verdicts, labelled. With its unit it is what
     it says; whole points and nothing at all stand. */
  same(play({ treats: 'margin', aim: { value: 0.1 } }), {}, 'a margin aim of 0.1 with no unit is nothing — a fraction cannot be told from a tenth of a point');
  same(play({ treats: 'margin', stop: { value: 0.08, when: 'below' } }), {}, 'and so is a margin stop of 0.08');
  same(play({ treats: 'margin', aim: { value: 0.5, unit: '%' } }), { aimValue: 0.5 }, 'a share labelled % is taken as written');
  same(play({ treats: 'margin', aim: { value: 12 }, stop: { value: 0, when: 'below' } }), { aimValue: 12, stop: { value: 0, when: 'below' } },
    'whole points stand with no unit, and a stop at nothing is a figure');
  same([play({ treats: 'growth', aim: 90000000 }), play({ treats: 'margin', aim: '11' })], [{ aimValue: 90000000 }, { aimValue: 11 }],
    'an aim written as a bare figure is read as its value');
  same(F.managerMoveFields({ kind: 'policy', subject: { key: 'P1' }, price: 12000 }), { price: 12000 },
    'a line with no variant is a line');
  same(F.managerMoveFields({ kind: 'price', subject: { key: 'P1::5' }, price: 12000 }), {},
    'but a variant the line does not have is not');
}

/* ---------- 7. the meeting alone gets the bigger answer -------------- */
{
  t.check(/max_tokens: mgrMode === 'manager' \? 4000 : 3000,/.test(api),
    'the morning meeting is allowed 4000 tokens (Q7); the review and the plain assistant stay at 3000');
}

process.exit(t.done() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
