#!/usr/bin/env node
'use strict';
/*
 * The Manager stops repeating itself, and puts its moves in order.
 *
 * The rulebook has said since the day the Manager was built that
 * "advice the owner keeps skipping is advice to rethink, not repeat".
 * Nothing computed it. do_not_repeat carried open questions, running
 * plays, dropped plays and held lines — and not one move. So a move
 * skipped on Monday with a reason the owner typed came back the
 * following Monday, unchanged, and the reason went unread. A rule
 * stated in the prompt with no data behind it: the same defect that
 * made collected_after_chases structurally zero, in a different corner.
 *
 * It is repairable only because of that earlier repair. With subject
 * ids flowing through the reading, "the same move again" is finally an
 * id and not a turn of phrase.
 *
 * And the plan was a list where the Manager meant a sequence. A move
 * could say what it `unlocks` in prose and nothing said WHICH move
 * waited on which, nothing ordered the cards, and nothing noticed when
 * the thing a move depended on had not been done. The cards were not
 * even drawn in the Manager's own ranking: the query that fetched them
 * carried no order clause at all.
 *
 * The laws this file guards:
 *
 *   TWICE, NOT ONCE     one skip is timing — somebody was travelling, a
 *                       supplier was shut. Twice with nothing done in
 *                       between is a decision.
 *   COMING ROUND COUNTS a fingerprint the owner has EVER marked done is
 *                       not on this list, however often it was skipped
 *                       first.
 *   BY ID, NOT BY NAME  two customers' chases are two pieces of advice,
 *                       however alike the titles read.
 *   WITH THE REASONS    names alone are a ban with no argument behind
 *                       them, and a mind told only "don't" proposes the
 *                       same thing wearing a different hat.
 *   MARKS, NEVER BLOCKS a waiting move still has its buttons. The owner
 *                       may do the day in any order they like.
 *   RUN IT, DON'T READ IT  these checks call the functions.
 *
 * Run: node test/manager-restraint.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('the manager’s restraint');
const src = read('index.html');
const api = read('api/assistant.js');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const TODAY = '2026-08-28';
const shift = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

const move = (o) => ({ date: o.date || '2026-08-20', status: o.status,
  body: { title: o.title, mkind: o.kind || 'chase',
    ...(o.subject ? { subject: o.subject } : {}),
    ...(o.why ? { skipReason: o.why } : {}) } });

const advice = async (rows) => {
  const sb = { from: () => { const q = {};
    q.select = () => q; q.eq = () => q; q.gte = () => q;
    q.lte = () => Promise.resolve({ data: rows, error: null });
    return q; } };
  const s = compileScope([extractFunction(src, 'managerSkippedAdvice', 'index.html')],
    { managerNotesTable: true, currentShopId: 'shop-1', sb,
      todayISO: () => TODAY, anShiftDate: shift,
      console, Date, Math, Number, String, Array, Object, Map, Set, Promise },
    ['managerSkippedAdvice']);
  return s.managerSkippedAdvice(TODAY);
};

(async () => {
  /* ---------- 1. twice, not once ------------------------------------ */
  {
    const out = await advice([
      move({ title: 'Chase Milly today', subject: { customerId: 7 }, status: 'skipped', why: 'she is travelling' }),
      move({ title: 'Chase Milly today', subject: { customerId: 7 }, status: 'skipped', why: 'still travelling', date: '2026-08-24' }),
      move({ title: 'Chase Dad today', subject: { customerId: 8 }, status: 'skipped', why: 'bad day for it' }),
    ]);
    eq(out.rows.length, 1, 'only advice passed on more than once counts');
    eq(out.rows[0].title, 'Chase Milly today', 'and it is named');
    eq(out.rows[0].times, 2, 'with how many times');
    eq(out.rows[0].last_on, '2026-08-24', 'and the day it was last put to them');
    /* A BAN WITH NO ARGUMENT IS A BAN THE MIND WILL ROUTE AROUND. The
       rule is RETHINK, not avoid: told only "don't", a mind proposes
       the same thing wearing a different hat. Told WHY, it can do
       something else. */
    eq(out.rows[0].reasons.length, 2, 'and both reasons the owner typed');
    eq(out.rows[0].reasons[0], 'she is travelling', 'in their own words');
    t.check(!out.rows.some((r) => r.title === 'Chase Dad today'),
      'a move skipped once is timing, not a decision — it is not on this list');

    /* One reading: the window and the threshold leave with the rows, so
       the sentence the screen writes about this list cannot come to
       disagree with the list. */
    eq(out.times, 2, 'the threshold travels with the answer');
    eq(out.days, 35, 'and so does the window it was read over');
  }

  /* ---------- 2. coming round counts ---------------------------------- */
  {
    const out = await advice([
      move({ title: 'Chase Milly today', subject: { customerId: 7 }, status: 'skipped', why: 'travelling' }),
      move({ title: 'Chase Milly today', subject: { customerId: 7 }, status: 'skipped', why: 'still travelling', date: '2026-08-22' }),
      move({ title: 'Chase Milly today', subject: { customerId: 7 }, status: 'done', date: '2026-08-26' }),
    ]);
    eq(out.rows.length, 0,
      'the owner came round and did it — telling the manager they never did would be telling it something untrue');
  }

  /* ---------- 3. by id, not by name ----------------------------------- */
  {
    /* THE PAYOFF FROM THE ACCOUNTING REPAIR. Two customers, one wording
       — before subject ids reached the plan there was nothing to tell
       these apart, and a shop that skipped one debtor twice would have
       had the manager stop chasing the other. */
    const out = await advice([
      move({ title: 'Chase them today', subject: { customerId: 7 }, status: 'skipped', why: 'a' }),
      move({ title: 'Chase them today', subject: { customerId: 8 }, status: 'skipped', why: 'b' }),
    ]);
    eq(out.rows.length, 0, 'two customers chased once each is not one piece of advice skipped twice');

    /* And a move that named nobody can only be matched on its wording.
       Said out loud rather than passed off as the stronger claim. */
    const byName = await advice([
      move({ title: 'Tidy the shelf', kind: 'other', status: 'skipped', why: 'no time' }),
      move({ title: 'Tidy the shelf', kind: 'other', status: 'skipped', why: 'still no time' }),
    ]);
    eq(byName.rows.length, 1, 'wording is the fallback when a move named nothing');
    eq(byName.rows[0].matched_by_wording, true,
      'and it says so — a match on a title is the weaker of the two claims');
    const byId = await advice([
      move({ title: 'Chase Milly', subject: { customerId: 7 }, status: 'skipped', why: 'a' }),
      move({ title: 'Chase Milly', subject: { customerId: 7 }, status: 'skipped', why: 'b' }),
    ]);
    t.check(!('matched_by_wording' in byId.rows[0]),
      'while a match on an id claims nothing extra');

    /* Two KINDS of move about one customer are two pieces of advice. */
    const kinds = await advice([
      move({ title: 'Chase Milly', kind: 'chase', subject: { customerId: 7 }, status: 'skipped', why: 'a' }),
      move({ title: 'Invoice Milly', kind: 'invoice', subject: { customerId: 7 }, status: 'skipped', why: 'b' }),
    ]);
    eq(kinds.rows.length, 0, 'chasing somebody and invoicing them are different advice about one person');
  }

  /* ---------- 4. it reaches the mind, and the owner ------------------- */
  {
    t.check(/advice_you_keep_passing_on: passedOn\.rows/.test(src),
      'the restraint list carries it, where the mind is told to look');
    t.check(/managerSkippedAdvice\(todayISO\(\)\)\.then/.test(src),
      'and the Manager screen shows the owner what it has stopped proposing');
    t.check(/Advice you have passed on/.test(src),
      'under a heading in their own words — advice vanishing with nobody told would be the app deciding on its own');
    t.check(/advice_you_keep_passing_on/.test(api),
      'and the tool description names the key');
    t.check(/the rule is RETHINK, not restate/.test(api),
      'with the rule that makes it useful rather than merely restrictive');
    t.check(/matched_by_wording/.test(api),
      'and tells the mind which matches are the weaker kind');
  }

  /* ---------- 5. a plan that is a sequence ---------------------------- */
  {
    const inserted = [];
    const save = compileScope([extractFunction(src, 'managerSaveMeeting', 'index.html'),
      extractDeclaration(src, 'MANAGER_OBJECTIVES', 'index.html'),
      extractDeclaration(src, 'MANAGER_WORTH_BASES', 'index.html'),
      extractDeclaration(src, 'MANAGER_LEVERS', 'index.html'),
      extractDeclaration(src, 'MANAGER_METRICS', 'index.html'),
      extractDeclaration(src, 'MANAGER_PROBLEMS', 'index.html')],
    { managerNotesTable: true, currentShopId: 'shop-1', todayISO: () => TODAY,
      apRound: (n) => Math.round(Number(n) || 0),
      sb: { from: () => ({ insert: (row) => { inserted.push(row); return {
        select: () => ({ single: () => Promise.resolve({ data: { id: 21 }, error: null }) }) }; } }) },
      console, Promise, Date, JSON, Math, Number, String, Array, Object, Set },
    ['managerSaveMeeting']).managerSaveMeeting;

    const plan = (moves) => ({ keyline: 'k', moves });
    const bodies = async (moves) => {
      inserted.length = 0;
      await save(plan(moves));
      const rows = inserted.find((r) => Array.isArray(r) && r[0] && r[0].kind === 'move');
      return (rows || []).map((r) => r.body);
    };
    const m = (title, after) => ({ title, kind: 'other', worth: 0, ...(after == null ? {} : { after }) });

    const good = await bodies([m('Collect from Milly'), m('Buy the cement', 1)]);
    eq(good[1].after, 0, 'a move waits on another by its position, stored 0-based');
    t.check(!('after' in good[0]), 'and a move that waits on nothing carries no claim that it does');

    /* REFUSED RATHER THAN REPAIRED. A dependency the screen could not
       honour would draw an order that does not exist. */
    eq((await bodies([m('One'), m('Two', 9)]))[1].after, undefined,
      'a position outside the plan is not a dependency');
    eq((await bodies([m('One'), m('Two', 2)]))[1].after, undefined,
      'nor is a move waiting on itself');
    /* Self-reference is refused by the cycle walk itself and not by a
       guard of its own — a separate `from === i` line was written here
       and no mutation could tell it from the walk, so it went. What is
       asserted is the BEHAVIOUR; do not read the missing line as a
       hole. */
    eq((await bodies([m('One'), m('Two', 0)]))[1].after, undefined,
      'nor a position before the first move');
    eq((await bodies([m('One', 1.5), m('Two')]))[0].after, undefined,
      'nor half a position');
    const ring = await bodies([m('One', 2), m('Two', 1)]);
    t.check(ring[0].after === undefined || ring[1].after === undefined,
      'and a ring of moves each waiting on the next is broken, not stored — it would loop the screen for ever');
    const longRing = await bodies([m('One', 3), m('Two', 1), m('Three', 2)]);
    t.check([0, 1, 2].some((i) => longRing[i].after === undefined),
      'however long the ring is');
  }

  /* ---------- 6. the cards obey it, and never enforce it -------------- */
  {
    const scope = compileScope([
      extractFunction(src, 'mgrMoveOrder', 'index.html'),
      extractFunction(src, 'mgrMoveView', 'index.html'),
      extractFunction(src, 'deriveMoveOutcome', 'index.html'),
      extractDeclaration(src, 'MANAGER_DOORS', 'index.html'),
      extractDeclaration(src, 'MANAGER_WORTH_BASES', 'index.html'),
    ], { data: { customers: [], stockLog: [], savedQuotes: [], purchaseInvoices: [] },
      esc: (x) => String(x == null ? '' : x), fmtUGX: (n) => String(n),
      Math, Number, String, Object, Array, Set }, ['mgrMoveOrder', 'mgrMoveView']);

    const row = (id, title, after, status) => ({ id, status: status || 'open',
      body: { title, mkind: 'other', ...(after == null ? {} : { after }) } });

    /* THE PLAN'S OWN RANKING, only refusing to draw a move above the one
       it waits on. Never a re-ranking: the manager ranked these by what
       the action changes this week, and that is not the screen's to
       overturn. */
    const rows = [row(1, 'Buy the cement', 1), row(2, 'Collect from Milly')];
    const drawn = scope.mgrMoveOrder(rows).map((r) => r.body.title);
    eq(drawn.join(' | '), 'Collect from Milly | Buy the cement',
      'a move is drawn after the one it waits on');
    eq(scope.mgrMoveOrder([row(1, 'A'), row(2, 'B'), row(3, 'C')]).map((r) => r.body.title).join(''),
      'ABC', 'and a plan with no dependencies keeps the order it was ranked in');
    eq(scope.mgrMoveOrder(rows).length, rows.length, 'every move is drawn exactly once');
    /* AND THE PLAN ACTUALLY GOES THROUGH IT. The ordering above is
       tested by running; that the screen calls it can only be checked
       in the source, because renderPlanCards is a closure — so it is
       checked precisely rather than loosely. */
    t.check(/const cards = mgrMoveOrder\(rows\)\.map\(\(r, i\)=> mgrMoveView\(r, i, rows\)\)/.test(src),
      'the plan draws its cards through the sequence pass, and hands each one the plan in its own order');

    const waiting = scope.mgrMoveView(rows[0], 0, rows);
    t.check(/waiting on: Collect from Milly/.test(waiting),
      'and it says on the card what it is waiting for');
    /* MARKS, NEVER BLOCKS. The owner may do the day in any order they
       like; a Done button the app switched off would be the app
       deciding something that is theirs to decide. */
    t.check(/mgr-done/.test(waiting) && !/disabled/.test(waiting),
      'while its buttons stay live — the app marks, it never forbids');

    const settled = [row(1, 'Buy the cement', 1), row(2, 'Collect from Milly', null, 'done')];
    t.check(!/waiting on/.test(scope.mgrMoveView(settled[0], 0, settled)),
      'and once the blocker is done, nothing is waiting on anything');
  }

  /* ---------- 7. the ranking finally reaches the screen ---------------- */
  {
    /* The query that feeds the cards carried no order clause at all, so
       "ranked by the money on them" was whatever the database happened
       to return — and `after`, which is a position, could not be
       resolved without it. */
    const load = extractFunction(src, 'managerLoadState', 'index.html');
    t.check(/\.eq\('kind', 'move'\)\.in\('meeting_id', ids\)\s*\n?\s*\.order\('id', \{ ascending: true \}\)/.test(load),
      'the screen reads the moves in the order the manager ranked them');
    const hist = src.slice(src.indexOf('manager_history: { confirm: false'));
    t.check(/\.eq\('kind', 'move'\)\.in\('meeting_id', ids\)\s*\n?\s*\.order\('id', \{ ascending: true \}\)/.test(hist.slice(0, 4000)),
      'and so does the meeting that reads its own past');
    t.check(/"after":2/.test(api), 'the plan block carries after in its stated shape');
    t.check(/after is the position in this plan of the move this one waits on/.test(api),
      'and says what it means');
  }
})().then(() => {
  process.exit(t.done() ? 1 : 0);
}).catch((e) => { console.error(e); process.exit(1); });
