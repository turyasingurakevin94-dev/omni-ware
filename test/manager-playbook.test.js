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
const api = read('api/assistant.js');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const TODAY = '2026-08-29';
const base = {
  managerNotesTable: true, currentShopId: 'shop-1',
  todayISO: () => TODAY,
  apRound: (n) => Math.round(Number(n) || 0),
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
      extractDeclaration(src, 'MANAGER_PROBLEMS', 'index.html'),
    ], { ...base, sb: { from: () => { const q = {}; q.select = () => q; q.eq = () => q; q.order = () => q;
      q.limit = () => Promise.resolve({ data: rows, error: null }); return q; } } },
      ['managerPlaybook']).managerPlaybook();

    eq(book.proposed.length, 1, 'a nameless row is not a play in anybody’s book');
    eq(book.running.length, 2, 'what the shop is actually working');
    eq(book.dropped.length, 2, 'and what it has tried and stopped — dropped AND done both stop being proposals');
    eq(book.proposed[0].problem, 'Margin', 'each play named by the problem it treats, in the owner’s words');
    eq(book.running[1].source, 'owner', 'a play the owner typed is marked as theirs');
    eq(book.running[0].source, 'manager', 'and one the manager thought of is not');
    eq(book.running[1].started_on, '2026-08-14', 'with the day it started, which cannot be worked out later');
    eq(book.dropped[0].name, 'Bulk-lot the dead stock', 'the dropped ones keep their names');

    const none = await compileScope([
      extractFunction(src, 'managerPlaybook', 'index.html'),
      extractDeclaration(src, 'MANAGER_PROBLEMS', 'index.html'),
    ], { ...base, managerNotesTable: false,
      sb: { from(){ throw new Error('reached for a table that is not there'); } } },
      ['managerPlaybook']).managerPlaybook();
    t.check(none.running.length === 0 && none.proposed.length === 0 && none.dropped.length === 0,
      'without the memory table it answers an empty book rather than throwing');

    const errBook = await compileScope([
      extractFunction(src, 'managerPlaybook', 'index.html'),
      extractDeclaration(src, 'MANAGER_PROBLEMS', 'index.html'),
    ], { ...base, sb: { from: () => { const q = {}; q.select = () => q; q.eq = () => q; q.order = () => q;
      q.limit = () => Promise.resolve({ data: null, error: { message: 'no such kind' } }); return q; } } },
      ['managerPlaybook']).managerPlaybook();
    eq(errBook.running.length, 0, 'and a refused read is an empty book, never a crashed screen');
  }

  /* ---------- 4. trying it, stopping it, and the owner's own --------- */
  {
    const mk = (over) => {
      const updates = [], inserts = [], toasts = [];
      const s = compileScope([
        extractFunction(src, 'managerPlayStatus', 'index.html'),
        extractFunction(src, 'managerAddOwnPlay', 'index.html'),
        'function names(){ return { managerPlayStatus, managerAddOwnPlay }; }',
      ], { ...base, toast: (m) => toasts.push(m), renderManager: () => {},
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
      extractDeclaration(src, 'MANAGER_PROBLEMS', 'index.html'),
      extractDeclaration(src, 'MANAGER_METRICS', 'index.html'),
      extractFunction(src, 'managerPlaybook', 'index.html'),
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

    /* Nothing to say beats an empty heading. */
    const empty = compileScope([
      extractDeclaration(src, 'ASSISTANT_TOOLS', 'index.html'),
      extractDeclaration(src, 'MANAGER_PROBLEMS', 'index.html'),
      extractDeclaration(src, 'MANAGER_METRICS', 'index.html'),
      extractFunction(src, 'managerPlaybook', 'index.html'),
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
    const render = extractFunction(src, 'renderManager', 'index.html');
    t.check(/managerPlaybook\(\)/.test(render),
      'the screen draws the playbook from the same function the tool calls');
    t.check(/managerPlayStatus\(id, status\)/.test(render) && /managerAddOwnPlay\(/.test(render),
      'with the taps that try, stop and add one');
    const rest = src.replace(extractFunction(src, 'managerPlaybook', 'index.html'), '')
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
    const ext = api.slice(api.indexOf('const MANAGER_EXTENSION'), api.indexOf('].join', api.indexOf('const MANAGER_EXTENSION')));
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
    t.check(/say so plainly when a running play is not working and propose stopping it/.test(ext),
      'a play that is not working is called, not carried');
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
