#!/usr/bin/env node
'use strict';
/*
 * The playbook: a diagnosis must come with a treatment.
 *
 * The Manager had learned to diagnose. Live, from a real review:
 * "Margin, not turnover, is the binding problem: 31,436,660 of sales
 * returned 1,598,160 gross." True, well argued — and it stopped there.
 * It told the owner what was WRONG and never what to DO. Half a
 * manager: the half a spreadsheet can already be.
 *
 * The reason was a rule doing its job too well. "Never invent: every
 * figure you state must come from a tool result" is right about
 * FIGURES, and the mind had generalised it into silence about anything
 * the books cannot compute. But a strategy is not a figure. It is
 * craft — charge for cutting, bulk-lot the dead stock to a builder,
 * take a deposit before delivery — and the mind knows this trade.
 *
 * Four laws hold the new half honest, each one the shop's own:
 *
 *   A PLAY IS PROPOSED, NEVER ADOPTED BY THE WRITING OF IT  the
 *       management contract, unchanged since the first meeting. The
 *       shop works a strategy when the owner taps it, not when the
 *       model types it.
 *   NAMED RATHER THAN DROPPED  a play must treat a problem this app
 *       names. An invented category becomes nothing, rather than a
 *       heading the screen prints unchallenged.
 *   ONE READING  the screen and the mind take the playbook from the
 *       same function, so the owner can never be looking at a play the
 *       manager has forgotten.
 *   IT MUST REMEMBER  a play the shop dropped is never proposed again.
 *       Without this the owner hears the same bright idea every Monday
 *       and the whole thing is a listicle generator.
 *
 * RUN IT, DON'T READ IT: these checks call the tools and the savers.
 * Three times in this suite a value was computed and then dropped
 * before the return, and source-shaped assertions all passed.
 *
 * Run: node test/manager-playbook.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('the manager’s playbook');
const src = read('index.html');
/* The Manager screen is renderManager and the seven bed painters it hands
   every reading to (mgrPaint<Bed>), so a pin on "the render" reads all
   eight: what used to sit in one function is drawn by the bed it belongs to. */
const MGR_RENDER = ['renderManager', 'mgrPaintBrief', 'mgrPaintSim', 'mgrPaintTargets', 'mgrPaintPlays',
  'mgrPaintUnusual', 'mgrPaintAsk', 'mgrPaintRecord'];
const mgrRender = () => MGR_RENDER.map((n) => extractFunction(src, n, 'index.html')).join('\n');
const api = read('api/assistant.js');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const same = (got, want, msg) => t.check(JSON.stringify(got) === JSON.stringify(want), `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const TODAY = '2026-08-29';
const base = {
  managerNotesTable: true, rivalPricesTable: false, currentShopId: 'shop-1',
  todayISO: () => TODAY,
  apRound: (n) => Math.round(Number(n) || 0),
  /* managerPlaybook now works out what moved alongside each running
     play, so the reading needs the books it measures against. */
  data: { savedQuotes: [], customers: [] },
  daysSinceDate: (d) => Math.round((new Date(TODAY + 'T00:00:00Z') - new Date(d + 'T00:00:00Z')) / 86400000),
  anShiftDate: (iso, n) => { const x = new Date(iso + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); },
  anInvoicesInRange: () => [], anOverallTotals: () => ({ sales: 0, profit: 0, count: 0 }),
  dashInventoryHealth: () => ({ deadValue: 0 }), cashOnHandByAccount: () => ({ total: 0, byAccount: [] }),
  console, Date, JSON, Math, Number, String, Array, Object, Promise,
};

/* ---------- 1. the problems a play may treat are a whitelist --------- */
{
  const P = compileScope([
    extractDeclaration(src, 'MANAGER_PROBLEMS', 'index.html'),
    'function names(){ return { MANAGER_PROBLEMS }; }',
  ], { ...base }, ['names']).names().MANAGER_PROBLEMS;

  ['margin', 'cash', 'dead_stock', 'debt', 'concentration', 'supplier_cost', 'growth', 'other']
    .forEach((k) => t.check(!!P[k], `a play can treat ${k}`));
  eq(P.margin, 'Margin', 'and each problem carries the owner’s own word for it');
  eq(P.concentration, 'Depending on one buyer', 'in plain English, not the field name');
  eq(P.vibes, undefined, 'and nothing outside the list is a problem this shop names');
}

(async () => {
  /* ---------- 2. plays are saved proposed, capped, and whitelisted --- */
  {
    const inserted = [];
    const save = compileScope([
      extractFunction(src, 'managerSaveMeeting', 'index.html'),
      /* the optional fields of the meeting contract, through their whitelists */
      ...['managerPips', 'managerPlanText', 'managerMeetingFields', 'managerMoveFields', 'managerPlanRefs', 'managerAskFields', 'managerPlayFields']
        .map((n) => extractFunction(src, n, 'index.html')),
      extractDeclaration(src, 'MANAGER_DEPTS', 'index.html'), extractDeclaration(src, 'MANAGER_ASK_PLACES', 'index.html'),
      extractDeclaration(src, 'MANAGER_DOORS', 'index.html'),
      extractDeclaration(src, 'MANAGER_MOVE_KINDS', 'index.html'),
      extractFunction(src, 'managerResolvedSubject', 'index.html'),
      'async function managerInsertProposals(rows){ return sb.from(\'manager_notes\').insert(rows); }',
      extractDeclaration(src, 'MANAGER_PROBLEMS', 'index.html'),
      extractDeclaration(src, 'MANAGER_METRICS', 'index.html'),
      extractDeclaration(src, 'MANAGER_WORTH_BASES', 'index.html'),
      extractDeclaration(src, 'MANAGER_LEVERS', 'index.html'),
      extractDeclaration(src, 'MANAGER_OBJECTIVES', 'index.html'),
    ], { ...base,
      data: { customers: [] }, anShiftDate: (d) => d,
      debtCollectionsOn: () => ({ total: 0 }), anInvoicesInRange: () => [],
      anOverallTotals: () => ({ sales: 0, profit: 0, count: 0, estimatedQty: 0 }),
      dashInventoryHealth: () => ({ deadValue: 0, deadQty: 0 }),
      cashOnHandByAccount: () => ({ total: 0, byAccount: [] }),
      sb: { from: () => ({ insert: (row) => { inserted.push(row); return {
        select: () => ({ single: () => Promise.resolve({ data: { id: 44 }, error: null }) }) }; } }) },
    }, ['managerSaveMeeting']).managerSaveMeeting;

    await save({ keyline: 'k', moves: [{ title: 'Chase Milly', play: 'Charge for cutting' }],
      plays: [
        { name: 'Charge for cutting', treats: 'margin', how: 'Charge 2,000 a cut',
          sized: 'About 30 cuts a month is 60,000', watch: 'Gross profit on cut lines' },
        { name: 'Manifest abundance', treats: 'vibes', how: 'Believe' },
        { name: '   ', treats: 'cash', how: 'A play with no name' },
        { name: 'Bulk-lot the dead stock', treats: 'dead_stock', how: 'One lot to a builder' },
        { name: 'Deposit before delivery', treats: 'debt', how: 'Half up front' },
      ] });

    const plays = inserted.find((r) => Array.isArray(r) && r[0] && r[0].kind === 'play');
    t.check(!!plays, 'the plays reach the journal');
    eq(plays.length, 2, 'at most two a meeting — a shop cannot work five new strategies at once');
    eq(plays[0].status, 'proposed',
      'PROPOSED, never adopted by the writing of it — a strategy becomes the shop’s on a tap');
    eq(plays[0].body.name, 'Charge for cutting', 'the play it argued hardest for comes first');
    eq(plays[0].body.treats, 'margin', 'attached to the problem it treats');
    eq(plays[0].body.sized, 'About 30 cuts a month is 60,000', 'with the arithmetic that sized it');
    eq(plays[0].body.watch, 'Gross profit on cut lines', 'and what would show it working');
    eq(plays[0].body.source, 'manager', 'marked as the manager’s own idea, not the shop’s');
    eq(plays[0].meeting_id, 44, 'tied to the meeting that proposed it');
    t.check(!plays.some((p) => p.body.treats === 'vibes'),
      'a problem this app does not name never reaches the journal — named rather than dropped');
    t.check(!plays.some((p) => !String(p.body.name || '').trim()),
      'and a play with no name is not a play');

    const moves = inserted.find((r) => Array.isArray(r) && r[0] && r[0].kind === 'move');
    eq(moves[0].body.play, 'Charge for cutting',
      'a move can say which play it belongs to — otherwise today’s tasks and the strategy drift apart');

    /* Nothing proposed, nothing written: no empty insert. */
    inserted.length = 0;
    await save({ keyline: 'k', moves: [], plays: [] });
    t.check(!inserted.some((r) => Array.isArray(r) && r[0] && r[0].kind === 'play'),
      'a meeting with no play writes no play row');
  }

  /* ---------- 3. the shop's own reading of its playbook -------------- */
  {
    const rows = [
      { id: 5, date: '2026-08-28', status: 'proposed', body: { name: 'Charge for cutting', treats: 'margin', how: 'h', sized: 's', watch: 'w', source: 'manager' } },
      { id: 4, date: '2026-08-20', status: 'running', body: { name: 'Deposit before delivery', treats: 'debt', source: 'manager', startedOn: '2026-08-21' } },
      { id: 3, date: '2026-08-14', status: 'running', body: { name: 'Cash discount on Saturdays', treats: 'cash', source: 'owner', startedOn: '2026-08-14' } },
      { id: 2, date: '2026-08-07', status: 'dropped', body: { name: 'Bulk-lot the dead stock', treats: 'dead_stock', source: 'manager', endedOn: '2026-08-12' } },
      { id: 1, date: '2026-08-01', status: 'done', body: { name: 'Tighten the agent ladder', treats: 'margin', source: 'manager' } },
      { id: 0, date: '2026-07-30', status: 'proposed', body: { name: '  ', treats: 'growth' } },
    ];
    const book = await compileScope([
      extractFunction(src, 'managerPlaybook', 'index.html'),
      extractFunction(src, 'managerPlayClock', 'index.html'),
      extractFunction(src, 'managerPlaysPastSpan', 'index.html'),
      extractFunction(src, 'managerPlayProgress', 'index.html'),
      extractFunction(src, 'booksStartDate', 'index.html'),
      extractDeclaration(src, 'MANAGER_PROBLEM_METRICS', 'index.html'),
      extractDeclaration(src, 'MANAGER_METRICS', 'index.html'),
      extractDeclaration(src, 'MANAGER_PROBLEMS', 'index.html'),
    ], { ...base, sb: { from: () => { const q = {}; q.select = () => q; q.eq = () => q; q.order = () => q;
      q.limit = () => Promise.resolve({ data: rows, error: null }); return q; } } },
      ['managerPlaybook', 'managerPlayClock', 'managerPlaysPastSpan']).managerPlaybook();

    eq(book.proposed.length, 1, 'a nameless row is not a play in anybody’s book');
    eq(book.running.length, 2, 'what the shop is actually working');
    /* WAS: dropped.length 2 — a play marked worked was filed with the plays
       set aside. NOW (Q14): set aside holds only what the owner set aside;
       a closed play carries the owner's verdict in its own list. A 'done'
       row from before verdicts were asked for reads as their "worked". */
    eq(book.dropped.length, 1, 'what it has tried and set aside');
    eq(book.judged.length, 1, 'and what the owner closed with a verdict, in a list of its own');
    eq(book.judged[0].verdict, 'worked', 'an old "It worked" close reads as the owner’s verdict worked');
    eq(book.judged[0].verdictLegacy, true, 'and says it was marked before verdicts were asked for');
    eq(book.proposed[0].problem, 'Margin', 'each play named by the problem it treats, in the owner’s words');
    eq(book.running[1].source, 'owner', 'a play the owner typed is marked as theirs');
    eq(book.running[0].source, 'manager', 'and one the manager thought of is not');
    eq(book.running[1].started_on, '2026-08-14', 'with the day it started, which cannot be worked out later');
    eq(book.dropped[0].name, 'Bulk-lot the dead stock', 'the dropped ones keep their names');

    const none = await compileScope([
      extractFunction(src, 'managerPlaybook', 'index.html'),
      extractFunction(src, 'managerPlayClock', 'index.html'),
      extractFunction(src, 'managerPlaysPastSpan', 'index.html'),
      extractFunction(src, 'managerPlayProgress', 'index.html'),
      extractFunction(src, 'booksStartDate', 'index.html'),
      extractDeclaration(src, 'MANAGER_PROBLEM_METRICS', 'index.html'),
      extractDeclaration(src, 'MANAGER_METRICS', 'index.html'),
      extractDeclaration(src, 'MANAGER_PROBLEMS', 'index.html'),
    ], { ...base, managerNotesTable: false,
      sb: { from(){ throw new Error('reached for a table that is not there'); } } },
      ['managerPlaybook', 'managerPlayClock', 'managerPlaysPastSpan']).managerPlaybook();
    t.check(none.running.length === 0 && none.proposed.length === 0 && none.dropped.length === 0
      && none.judged.length === 0 && none.proven.length === 0,
      'without the memory table it answers an empty book rather than throwing');

    const errBook = await compileScope([
      extractFunction(src, 'managerPlaybook', 'index.html'),
      extractFunction(src, 'managerPlayClock', 'index.html'),
      extractFunction(src, 'managerPlaysPastSpan', 'index.html'),
      extractFunction(src, 'managerPlayProgress', 'index.html'),
      extractFunction(src, 'booksStartDate', 'index.html'),
      extractDeclaration(src, 'MANAGER_PROBLEM_METRICS', 'index.html'),
      extractDeclaration(src, 'MANAGER_METRICS', 'index.html'),
      extractDeclaration(src, 'MANAGER_PROBLEMS', 'index.html'),
    ], { ...base, sb: { from: () => { const q = {}; q.select = () => q; q.eq = () => q; q.order = () => q;
      q.limit = () => Promise.resolve({ data: null, error: { message: 'no such kind' } }); return q; } } },
      ['managerPlaybook', 'managerPlayClock', 'managerPlaysPastSpan']).managerPlaybook();
    eq(errBook.running.length, 0, 'and a refused read is an empty book, never a crashed screen');
    /* An empty book is a claim about this shop's strategy. A refused
       read is not, and the two are no longer the same answer. */
    eq(errBook.error, 'no such kind',
      'and carries the failure home, so the panel says so rather than "no play is running"');
  }

  /* ---------- 4. trying it, stopping it, and the owner's own --------- */
  {
    const mk = (over) => {
      const updates = [], inserts = [], toasts = [];
      const s = compileScope([
        extractFunction(src, 'managerPlayStatus', 'index.html'),
        extractFunction(src, 'managerRetireDuplicates', 'index.html'),
        extractFunction(src, 'managerAddOwnPlay', 'index.html'),
        extractDeclaration(src, 'MANAGER_PROBLEM_METRICS', 'index.html'),
        extractDeclaration(src, 'MANAGER_PROBLEMS', 'index.html'),
        extractDeclaration(src, 'MANAGER_METRICS', 'index.html'),
        extractDeclaration(src, 'MANAGER_DEPTS', 'index.html'),
        /* the slots (Q15) are counted by the Playbook's own refusal */
        extractFunction(src, 'mgrPlaySlotRefusal', 'index.html'),
        extractDeclaration(src, 'MGR_PLAY_SLOTS', 'index.html'),
        /* an owner's play passes the meeting's own whitelist */
        extractFunction(src, 'managerPlayFields', 'index.html'),
        extractFunction(src, 'managerPlanText', 'index.html'),
        'function names(){ return { managerPlayStatus, managerAddOwnPlay }; }',
      ], { ...base, toast: (m) => toasts.push(m), renderManager: () => {},
        managerPlaybook: async () => over.book || { running: [{ id: 1, name: 'Deposit before delivery' }], proposed: [] },
        sb: { from: () => ({
          select: () => ({ eq: () => ({ eq: () => ({ single: () => Promise.resolve({
            data: { body: { name: 'Charge for cutting', treats: 'margin' } } }) }) }) }),
          update: (patch) => { updates.push(patch); return { eq: () => ({ eq: () => Promise.resolve(over.updateError || { error: null }) }) }; },
          insert: (row) => { inserts.push(row); return Promise.resolve(over.insertError || { error: null }); },
        }) },
      }, ['names']).names();
      return { s, updates, inserts, toasts };
    };

    const a = mk({});
    await a.s.managerPlayStatus(5, 'running');
    eq(a.updates[0].status, 'running', 'trying it puts the play on');
    eq(a.updates[0].body.startedOn, TODAY, 'stamped with the day it started');
    eq(a.updates[0].body.name, 'Charge for cutting', 'keeping everything the meeting argued');
    t.check(a.toasts.some((m) => /will not propose it again/.test(m)),
      'and the owner is told the manager now knows it is running');

    const b = mk({});
    await b.s.managerPlayStatus(5, 'dropped');
    eq(b.updates[0].body.endedOn, TODAY, 'setting one aside stamps the day it ended');
    t.check(!b.updates[0].body.startedOn, 'a play set aside without ever running never claims a start date');

    const c = mk({ updateError: { error: { message: 'new row violates check constraint "manager_notes_kind_check"' } } });
    await c.s.managerPlayStatus(5, 'running');
    t.check(c.toasts.some((m) => /0086_manager_plays\.sql/.test(m)),
      'a database that has not been widened for plays names the migration that fixes it — a failure must name itself');

    const d = mk({});
    await d.s.managerAddOwnPlay('Cash discount on Saturdays', 'Two per cent off cash before noon');
    eq(d.inserts[0].kind, 'play', 'the owner’s own idea goes on the same playbook');
    eq(d.inserts[0].status, 'running',
      'and it is RUNNING from the moment they type it — the owner does not propose things to themselves');
    eq(d.inserts[0].body.source, 'owner', 'marked as theirs, which is what makes it outrank the manager’s');
    eq(d.inserts[0].body.startedOn, TODAY, 'starting today');
    eq(d.inserts[0].body.name, 'Cash discount on Saturdays', 'in their own words');

    const e = mk({});
    await e.s.managerAddOwnPlay('  ', 'no name at all');
    eq(e.inserts.length, 0, 'a play with no name is not kept');
    t.check(e.toasts.some((m) => /name/i.test(m)), 'and the owner is told why');

    /* THREE SLOTS (Q15). With three running, a fourth is refused by both
       writers, nothing is written, and the reason names every running play. */
    const three = { running: [{ id: 1, name: 'Friday chase' }, { id: 2, name: 'Steel' }, { id: 3, name: 'Hima' }], proposed: [] };
    const f = mk({ book: three });
    const fr = await f.s.managerPlayStatus(5, 'running');
    same([fr.ok, f.updates.length], [false, 0], 'a fourth play is not switched on — nothing written');
    t.check(/All 3 experiment slots are in use — “Friday chase”, “Steel” and “Hima”\. Judge or stop one first/.test(f.toasts[0] || ''),
      'and the owner is told why, every running play named');
    const g = mk({ book: three });
    const gr = await g.s.managerAddOwnPlay('Cash discount on Saturdays', 'Two per cent off');
    same([gr.ok, g.inserts.length], [false, 0], 'the owner’s own play cannot take a fourth slot either');
    const h = mk({ book: three });
    await h.s.managerPlayStatus(2, 'running');
    eq(h.updates.length, 1, 'a play already in a slot is not refused its own');
    const down = mk({ book: { running: [], proposed: [], error: 'offline' } });
    const dr = await down.s.managerPlayStatus(5, 'running');
    same([dr.ok, down.updates.length], [false, 0], 'slots that could not be counted start nothing');

    /* THE OWNER'S VERDICT (Q14): closed as done, with the verdict, what
       moved alongside it, and the lesson in their words. */
    const v = mk({});
    await v.s.managerPlayStatus(5, { verdict: 'didnt', result: 'the share kept 9.0% → 8.2%, better in 1 of 2 weeks',
      resultRead: { unit: 'pct', before: 9, after: 8.2, moved: -0.8, k: 1, n: 2 }, lesson: '  Price alone did not bring volume back.  ' }, []);
    eq(v.updates[0].status, 'done', 'a verdict closes the play');
    same([v.updates[0].body.verdict, v.updates[0].body.judgedOn, v.updates[0].body.endedOn], ['didnt', TODAY, TODAY],
      'with the owner’s verdict and the day they gave it');
    eq(v.updates[0].body.result, 'the share kept 9.0% → 8.2%, better in 1 of 2 weeks', 'what moved alongside it, kept in words');
    eq(v.updates[0].body.resultRead.moved, -0.8, 'and in figures');
    eq(v.updates[0].body.lesson, 'Price alone did not bring volume back.', 'and the lesson, in their words');
    t.check(v.toasts.some((m) => /your verdict — didn’t work/.test(m)), 'the toast says it was the owner’s verdict');
    const bad = mk({});
    const br = await bad.s.managerPlayStatus(5, { verdict: 'great' }, []);
    same([br.ok, bad.updates.length], [false, 0], 'a verdict that is not worked, didn’t or can’t tell is not kept');

    /* WRITE A PLAY: what the designer composed goes through the meeting's
       whitelist, a level stamps where it stood, a queued play waits on the
       board, and a name already waiting is said, not silently dropped. */
    const w = mk({ book: { running: [], proposed: [] } });
    await w.s.managerAddOwnPlay('Cash price under credit', 'give cash buyers a lower price', { status: 'running', treats: 'debt', weeks: 6,
      hypothesis: { if: 'give cash buyers a lower price', then: 'money owed to you will fall from 137m to 109m', target: '109m' },
      stop: { threshold: 'money owed to you no better than 137m', by_week: 3 }, cost: 60000, depends_on: '', dept: 'nonsense' });
    const wb = w.inserts[0].body;
    same([w.inserts[0].status, wb.treats, wb.weeks, wb.source, wb.startedOn], ['running', 'debt', 6, 'owner', TODAY], 'started today, the owner’s, six weeks');
    same(wb.hypothesis, { if: 'give cash buyers a lower price', then: 'money owed to you will fall from 137m to 109m', target: '109m' }, 'with its hypothesis');
    same(wb.stop, { threshold: 'money owed to you no better than 137m', byWeek: 3 }, 'and its stop rule, stored as the meeting’s are');
    same([wb.cost, 'dept' in wb, 'dependsOn' in wb], [60000, false, false], 'a department the app does not name and an empty dependency are not kept');
    eq(wb.baseline, 0, 'a level stamps where it stood the day it started (the books here owe nothing)');
    const q = mk({ book: { running: [], proposed: [{ id: 9, name: 'Cash price under credit' }] } });
    const qr = await q.s.managerAddOwnPlay('Cash price under credit!', 'x', { status: 'proposed', treats: 'debt', weeks: 6 });
    same([qr.ok, q.inserts.length], [false, 0], 'queuing a play already waiting on the board writes nothing');
    t.check(q.toasts.some((m) => /already on the board/.test(m)), 'and says it is there');
    const q2 = mk({ book: { running: [{ id: 1 }, { id: 2 }, { id: 3 }], proposed: [] } });
    await q2.s.managerAddOwnPlay('Saturday delivery', 'deliver', { status: 'proposed', treats: 'growth', weeks: 4 });
    same([q2.inserts[0].status, 'startedOn' in q2.inserts[0].body, 'baseline' in q2.inserts[0].body], ['proposed', false, false],
      'a queued play waits proposed — no start day and no stamp — even with the slots full');
    const odd = mk({ book: { running: [], proposed: [] } });
    await odd.s.managerAddOwnPlay('Moon dance', 'x', { treats: 'vibes', weeks: 40 });
    same([odd.inserts[0].body.treats, 'weeks' in odd.inserts[0].body], ['other', false], 'a problem or a span outside the rules is not kept');
  }

  /* ---------- 5. the mind is handed the book ------------------------- */
  {
    const journal = {
      meeting: [{ id: 1, date: '2026-08-28', body: { keyline: 'k' } }],
      move: [], question: [], target: [], review: [],
      play: [
        { id: 4, date: '2026-08-20', status: 'running', body: { name: 'Deposit before delivery', treats: 'debt', how: 'Half up front', source: 'manager', startedOn: '2026-08-21' } },
        { id: 3, date: '2026-08-14', status: 'running', body: { name: 'Cash discount on Saturdays', treats: 'cash', how: 'Two per cent', source: 'owner', startedOn: '2026-08-14' } },
        { id: 2, date: '2026-08-07', status: 'dropped', body: { name: 'Bulk-lot the dead stock', treats: 'dead_stock', source: 'manager' } },
      ],
    };
    const tools = compileScope([
      extractDeclaration(src, 'ASSISTANT_TOOLS', 'index.html'),
      extractFunction(src, 'managerAdviceTally', 'index.html'), extractFunction(src, 'mgrLiveMoveRows', 'index.html'), extractFunction(src, 'mgrJrWords', 'index.html'), extractDeclaration(src, 'MGR_JR_STOP', 'index.html'),
      extractFunction(src, 'managerTrackRecord', 'index.html'),
      extractFunction(src, 'mgrLiveMoveRows', 'index.html'),
      extractFunction(src, 'managerChaseEvidence', 'index.html'),
      /* The unusual-days reading has its own test; here it is quiet. */
      "function unusualDays(){ return { today: '', judged: 0, thin: 0, floor: 0, items: [] }; } function unusualLine(){ return ''; } var mgrUnusualMemo = null;",
      extractFunction(src, 'chaseResponse', 'index.html'),
      extractFunction(src, 'chaseDayAdd', 'index.html'),
      extractFunction(src, 'chaseRate', 'index.html'),
      extractFunction(src, 'chaseResponseLine', 'index.html'),
      extractFunction(src, 'customerCollectionDays', 'index.html'),
      extractFunction(src, 'collectionInvoiceTxn', 'index.html'),
      extractFunction(src, 'collectionLedgerRow', 'index.html'),
      extractFunction(src, 'debtLogIsInvoiceOwned', 'index.html'),
      extractFunction(src, 'cashIsMoneyIn', 'index.html'),
      extractDeclaration(src, 'CHASE_WINDOW', 'index.html'),
      extractDeclaration(src, 'CHASE_LOOKBACK', 'index.html'),
      extractDeclaration(src, 'CHASE_QUIET', 'index.html'),
      extractDeclaration(src, 'CHASE_MIN_CHASED', 'index.html'),
      extractDeclaration(src, 'CHASE_MIN_QUIET', 'index.html'),
      extractDeclaration(src, 'CHASE_MERGE', 'index.html'),
      extractDeclaration(src, 'CHASE_VERDICT_WORDS', 'index.html'),
      extractDeclaration(src, 'mgrChaseMemo', 'index.html'),
      extractDeclaration(src, 'mgrChaseExtras', 'index.html'),
      extractFunction(src, 'trackRecordName', 'index.html'),
      extractFunction(src, 'trackRecordLine', 'index.html'),
      extractFunction(src, 'trackRecordDeadLevers', 'index.html'),
      extractDeclaration(src, 'TRACK_MOVES_READ', 'index.html'),
      extractDeclaration(src, 'TRACK_MIN_TIMES', 'index.html'),
      extractDeclaration(src, 'TRACK_WINDOWED', 'index.html'),
      extractFunction(src, 'buyHoldsStanding', 'index.html'),
      extractFunction(src, 'buyHoldFor', 'index.html'),
      extractFunction(src, 'buyKeyLabel', 'index.html'),
      extractDeclaration(src, 'MANAGER_PROBLEMS', 'index.html'),
      extractDeclaration(src, 'MANAGER_METRICS', 'index.html'),
      extractFunction(src, 'managerPlaybook', 'index.html'),
      extractFunction(src, 'managerPlayClock', 'index.html'),
      extractFunction(src, 'managerPlaysPastSpan', 'index.html'),
      extractFunction(src, 'managerPlayProgress', 'index.html'),
      extractFunction(src, 'booksStartDate', 'index.html'),
      extractDeclaration(src, 'MANAGER_PROBLEM_METRICS', 'index.html'),
      extractFunction(src, 'managerScoreboard', 'index.html'),
      extractFunction(src, 'managerScoreProgress', 'index.html'),
      extractFunction(src, 'managerRecentReviews', 'index.html'),
      extractFunction(src, 'managerReviewBrief', 'index.html'),
      extractFunction(src, 'deriveMoveOutcome', 'index.html'),
      'function names(){ return { ASSISTANT_TOOLS }; }',
    ], { ...base,
      data: { customers: [], stockLog: [], savedQuotes: [], purchaseInvoices: [], cashTxns: [] },
      daysSinceDate: () => 1, fmtUGX: (n) => String(n), anShiftDate: (d) => d,
      anInvoicesInRange: () => [], anOverallTotals: () => ({ sales: 0, profit: 0, count: 0, estimatedQty: 0 }),
      debtCollectionsOn: () => ({ total: 0 }), dashInventoryHealth: () => ({ deadValue: 0, deadQty: 0 }),
      cashOnHandByAccount: () => ({ total: 0, byAccount: [] }),
      sb: { from: () => { const q = { _kind: null };
        q.select = () => q; q.order = () => q; q.in = () => q; q.gte = () => q; q.lte = () => q;
        q.eq = (c, v) => { if (c === 'kind') q._kind = v; return q; };
        q.limit = () => Promise.resolve({ data: journal[q._kind] || [], error: null });
        q.then = (res) => res({ data: journal[q._kind] || [], error: null });
        return q; } },
    }, ['names']).names().ASSISTANT_TOOLS;

    const hist = await tools.manager_history.run({ limit: 3 });
    t.check(!!hist.playbook, 'the meeting is HANDED the playbook, not merely near the code that builds one');
    eq(hist.playbook.running.length, 2, 'with what the shop is working');
    eq(hist.playbook.running[0].name, 'Deposit before delivery', 'by name');
    eq(hist.playbook.running[0].since, '2026-08-21', 'and since when, so it can judge whether it is working yet');
    eq(hist.playbook.running[1].whose, 'owner',
      'and WHOSE it is — the manager is told to rank the owner’s plays above its own');
    t.check((hist.playbook.tried_and_dropped || []).includes('Bulk-lot the dead stock'),
      'and what was tried and dropped — without this it proposes the same bright idea every Monday');

    /* PROVEN RECIPES (Q14). A play the OWNER judged worked twice is handed
       over by name with that count, and is the one closed play left off
       the never-again lists. Set aside, judged once, and judged not to
       work all stay on them. The same journal, read again. */
    journal.play = [
      { id: 9, date: '2026-08-10', status: 'done', body: { name: 'Deposit cash twice a week', treats: 'cash', source: 'manager',
        verdict: 'worked', judgedOn: '2026-08-24', endedOn: '2026-08-24', lesson: 'Fixed days work.' } },
      { id: 8, date: '2026-07-01', status: 'done', body: { name: 'Deposit cash twice a week', treats: 'cash', source: 'manager',
        verdict: 'worked', judgedOn: '2026-07-29', endedOn: '2026-07-29' } },
      { id: 7, date: '2026-07-01', status: 'done', body: { name: 'SMS price list', treats: 'growth', source: 'owner', verdict: 'worked', judgedOn: '2026-07-20' } },
      { id: 6, date: '2026-06-20', status: 'done', body: { name: 'Loyalty stamps', treats: 'growth', source: 'manager', verdict: 'didnt', judgedOn: '2026-07-10' } },
      { id: 2, date: '2026-08-07', status: 'dropped', body: { name: 'Bulk-lot the dead stock', treats: 'dead_stock', source: 'manager' } },
    ];
    const again = await tools.manager_history.run({ limit: 3 });
    same(again.playbook.proven_recipes, [{ name: 'Deposit cash twice a week', treats: 'cash', judged_worked: 2 }],
      'a play the owner judged worked twice is a proven recipe — its name, what it treats, and the count of those verdicts');
    t.check(!again.playbook.tried_and_dropped.includes('Deposit cash twice a week')
      && !again.do_not_repeat.plays_dropped.includes('Deposit cash twice a week'),
    'and it is on neither never-again list, so the meeting may propose it again');
    same(again.playbook.tried_and_dropped, ['SMS price list', 'Loyalty stamps', 'Bulk-lot the dead stock'],
      'judged once, judged not to work, and set aside all stay on tried_and_dropped');
    same(again.do_not_repeat.plays_dropped, ['SMS price list', 'Loyalty stamps', 'Bulk-lot the dead stock'],
      'and on the restraint list');
    t.check(!JSON.stringify(again).includes('it worked'), 'nothing handed to the meeting says a play worked — only that the owner judged it so');
    journal.play.splice(0, 1);
    const once = await tools.manager_history.run({ limit: 3 });
    eq(once.playbook.proven_recipes, undefined, 'judged worked once is not proven: no proven_recipes at all');
    t.check(once.playbook.tried_and_dropped.includes('Deposit cash twice a week'), 'and it stays never-again until a second verdict');

    /* Nothing to say beats an empty heading. */
    const empty = compileScope([
      extractDeclaration(src, 'ASSISTANT_TOOLS', 'index.html'),
      extractFunction(src, 'managerAdviceTally', 'index.html'), extractFunction(src, 'mgrLiveMoveRows', 'index.html'), extractFunction(src, 'mgrJrWords', 'index.html'), extractDeclaration(src, 'MGR_JR_STOP', 'index.html'),
      extractFunction(src, 'managerTrackRecord', 'index.html'),
      extractFunction(src, 'mgrLiveMoveRows', 'index.html'),
      extractFunction(src, 'managerChaseEvidence', 'index.html'),
      /* The unusual-days reading has its own test; here it is quiet. */
      "function unusualDays(){ return { today: '', judged: 0, thin: 0, floor: 0, items: [] }; } function unusualLine(){ return ''; } var mgrUnusualMemo = null;",
      extractFunction(src, 'chaseResponse', 'index.html'),
      extractFunction(src, 'chaseDayAdd', 'index.html'),
      extractFunction(src, 'chaseRate', 'index.html'),
      extractFunction(src, 'chaseResponseLine', 'index.html'),
      extractFunction(src, 'customerCollectionDays', 'index.html'),
      extractFunction(src, 'collectionInvoiceTxn', 'index.html'),
      extractFunction(src, 'collectionLedgerRow', 'index.html'),
      extractFunction(src, 'debtLogIsInvoiceOwned', 'index.html'),
      extractFunction(src, 'cashIsMoneyIn', 'index.html'),
      extractDeclaration(src, 'CHASE_WINDOW', 'index.html'),
      extractDeclaration(src, 'CHASE_LOOKBACK', 'index.html'),
      extractDeclaration(src, 'CHASE_QUIET', 'index.html'),
      extractDeclaration(src, 'CHASE_MIN_CHASED', 'index.html'),
      extractDeclaration(src, 'CHASE_MIN_QUIET', 'index.html'),
      extractDeclaration(src, 'CHASE_MERGE', 'index.html'),
      extractDeclaration(src, 'CHASE_VERDICT_WORDS', 'index.html'),
      extractDeclaration(src, 'mgrChaseMemo', 'index.html'),
      extractDeclaration(src, 'mgrChaseExtras', 'index.html'),
      extractFunction(src, 'trackRecordName', 'index.html'),
      extractFunction(src, 'trackRecordLine', 'index.html'),
      extractFunction(src, 'trackRecordDeadLevers', 'index.html'),
      extractDeclaration(src, 'TRACK_MOVES_READ', 'index.html'),
      extractDeclaration(src, 'TRACK_MIN_TIMES', 'index.html'),
      extractDeclaration(src, 'TRACK_WINDOWED', 'index.html'),
      extractFunction(src, 'buyHoldsStanding', 'index.html'),
      extractFunction(src, 'buyHoldFor', 'index.html'),
      extractFunction(src, 'buyKeyLabel', 'index.html'),
      extractDeclaration(src, 'MANAGER_PROBLEMS', 'index.html'),
      extractDeclaration(src, 'MANAGER_METRICS', 'index.html'),
      extractFunction(src, 'managerPlaybook', 'index.html'),
      extractFunction(src, 'managerPlayClock', 'index.html'),
      extractFunction(src, 'managerPlaysPastSpan', 'index.html'),
      extractFunction(src, 'managerPlayProgress', 'index.html'),
      extractFunction(src, 'booksStartDate', 'index.html'),
      extractDeclaration(src, 'MANAGER_PROBLEM_METRICS', 'index.html'),
      extractFunction(src, 'managerScoreboard', 'index.html'),
      extractFunction(src, 'managerScoreProgress', 'index.html'),
      extractFunction(src, 'managerRecentReviews', 'index.html'),
      extractFunction(src, 'managerReviewBrief', 'index.html'),
      extractFunction(src, 'deriveMoveOutcome', 'index.html'),
      'function names(){ return { ASSISTANT_TOOLS }; }',
    ], { ...base,
      data: { customers: [], stockLog: [], savedQuotes: [], purchaseInvoices: [], cashTxns: [] },
      daysSinceDate: () => 1, fmtUGX: (n) => String(n), anShiftDate: (d) => d,
      anInvoicesInRange: () => [], anOverallTotals: () => ({ sales: 0, profit: 0, count: 0, estimatedQty: 0 }),
      debtCollectionsOn: () => ({ total: 0 }), dashInventoryHealth: () => ({ deadValue: 0, deadQty: 0 }),
      cashOnHandByAccount: () => ({ total: 0, byAccount: [] }),
      sb: { from: () => { const q = { _kind: null };
        q.select = () => q; q.order = () => q; q.in = () => q; q.gte = () => q; q.lte = () => q;
        q.eq = (c, v) => { if (c === 'kind') q._kind = v; return q; };
        q.limit = () => Promise.resolve({ data: q._kind === 'meeting' ? journal.meeting : [], error: null });
        q.then = (res) => res({ data: q._kind === 'meeting' ? journal.meeting : [], error: null });
        return q; } },
    }, ['names']).names().ASSISTANT_TOOLS;
    const bare = await empty.manager_history.run({ limit: 3 });
    eq(bare.playbook, undefined, 'a shop with no plays yet is handed no playbook at all, not an empty one');
  }

  /* ---------- 6. one reading, screen and mind alike ------------------ */
  {
    const render = mgrRender();
    t.check(/managerPlaybook\(\)/.test(render),
      'the screen draws the playbook from the same function the tool calls');
    /* The tap also hands over the older copies of a proposal written
       before the duplicate guard, so answering one retires them all. */
    t.check(/managerPlayStatus\(id, status, dups\)/.test(render) && /managerAddOwnPlay\(/.test(render),
      'with the taps that try, stop and add one');
    const rest = src.replace(extractFunction(src, 'managerPlaybook', 'index.html'),
      extractFunction(src, 'managerPlayClock', 'index.html'),
      extractFunction(src, 'managerPlaysPastSpan', 'index.html'),
      extractFunction(src, 'managerPlayProgress', 'index.html'),
      extractFunction(src, 'booksStartDate', 'index.html'),
      extractDeclaration(src, 'MANAGER_PROBLEM_METRICS', 'index.html'),
      extractDeclaration(src, 'MANAGER_METRICS', 'index.html'), '')
      .replace(extractFunction(src, 'managerAddOwnPlay', 'index.html'), '');
    eq((rest.match(/\.eq\('kind', 'play'\)/g) || []).length, 0,
      'and nothing else in the app reads a play row on its own — two readings are two chances to disagree');
    t.check(/id="managerPlaysWrap"/.test(src), 'the playbook has its place on the Manager screen');
    const move = extractFunction(src, 'mgrMoveView', 'index.html');
    t.check(/Play: \$\{esc\(b\.play\)\}/.test(move),
      'and a move card says which play it serves, so today’s task and the strategy stay joined');
  }

  /* ---------- 7. the discipline the mind is held to ------------------ */
  {
    const ext = api.slice(api.indexOf('const MANAGER_COMMON'), api.indexOf('function managerExtension'));
    t.check(/NEVER NAME A PROBLEM WITHOUT NAMING A PLAY THAT TREATS IT/.test(ext),
      'the whole point, said first: a diagnosis with no treatment is half a manager');
    t.check(/A play is CRAFT, not measurement/.test(ext),
      'a strategy is judgement, and the mind is told to say which part is its own judgement');
    t.check(/SIZE IT IN THIS SHOP\\u2019S OWN FIGURES/.test(ext),
      'sized in this shop’s own arithmetic — never a general principle with no number on it');
    t.check(/Propose AT MOST TWO plays in a meeting and prefer one/.test(ext),
      'at most two, one preferred — a shop works strategies, it does not read lists');
    t.check(/NEVER propose a play the shop has tried and dropped/.test(ext),
      'and never re-proposes what the shop has ruled out — the reason the book is remembered at all');
    /* A PLAY IS FOR A SPAN, AND THE SPAN IS THE MANAGER'S OWN WORD.

       The rule this replaces — "say so plainly when a running play is
       not working" — had no clock behind it, so nothing ever said WHEN
       a play had had its chance: it ran until somebody remembered to
       stop it, and could be argued from every Monday for a season. The
       instruction to call a failing play now lives in
       manager_history's description, where it costs no rulebook, and
       the rulebook carries the part that needs a number. */
    t.check(/weeks \(how many weeks it is for\)/.test(ext),
      'a play names how many weeks it is FOR — a strategy with no horizon is a label');
    t.check(/A play past its span is never carried into another week in silence/.test(ext),
      'and one that outlives its own span is named, never carried');
    t.check(/extend it with a reason, stop it, or replace it/.test(ext),
      'with the three answers spelled out, so "say something" cannot be satisfied by saying anything');
    t.check(/outranking anything you thought of \\u2014 it is their trade/.test(ext),
      'the owner’s own plays outrank the manager’s');
    t.check(/never to recite/.test(ext),
      'the catalogue is to choose from by the figures, not to recite');
    ['charge for the work \\(cutting, threading, delivery\\)', 'turn dead stock into cash at a discount',
      'one bulk lot to a builder', 'a deposit before delivery', 'find the second buyer',
      'a volume rebate', 'stock deeper what climbed two months running']
      .forEach((p) => t.check(new RegExp(p).test(ext), `the catalogue carries: ${p.replace(/\\/g, '')}`));
    ['MARGIN', 'CASH', 'DEAD STOCK', 'DEBT', 'DEPENDING ON ONE BUYER', 'SUPPLIER COST', 'GROWTH']
      .forEach((p) => t.check(ext.includes(p + ' \\u2014'), `every problem the app names has plays: ${p}`));

    t.check(/"plays":\[\{"name":"Charge for cutting","treats":"margin"/.test(ext),
      'the plan block carries plays in its stated shape');
    t.check(/plays\[\]\.treats is one of: margin, cash, dead_stock, debt, concentration, supplier_cost, growth, other/.test(ext),
      'with the problems spelled out, so an invented one is the model’s mistake and not the app’s');
    t.check(/"play":"the play this move belongs to, or omitted"/.test(ext),
      'and a move may name the play it belongs to');
    t.check(/the playbook: the strategies this shop is already running/.test(api)
      && /which must never be proposed again/.test(api),
      'manager_history says in its own description that the playbook travels with it');

    const mig = read('supabase/migrations/0086_manager_plays.sql');
    t.check(/check \(kind in \('meeting', 'move', 'review', 'question', 'target', 'play'\)\)/.test(mig),
      '0086 admits the play kind — without it every play is refused by the database');
    t.check(/drop constraint if exists manager_notes_kind_check/.test(mig),
      'dropping the old check by name first, as 0082, 0084 and 0085 did');
  }
})().then(() => { process.exit(t.done() ? 1 : 0); })
  .catch((e) => { console.error(e); process.exit(1); });
