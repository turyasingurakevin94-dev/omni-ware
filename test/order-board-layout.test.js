#!/usr/bin/env node
'use strict';
/*
 * Order tracking as a console.
 *
 * The lane board this replaced said one fact three times (the top bar,
 * the step rail, the lane heads), scrolled sideways past its fifth lane,
 * put six controls on every card and had nowhere that said what needed
 * the owner. The console has a strip, a queue of what needs a decision,
 * one table grouped by stage with rows that open in place, and a rail
 * for the day's buying and delivering. The sourcing funnel keeps the
 * lane board and its .sq-* vocabulary, by design.
 *
 * What is pinned here is the shape that must not drift: the search
 * lives outside what the render rewrites; one listener does everything;
 * the strip counts the whole board and never a filter; the queue is the
 * named derivations, longest waiting first; a figure is never a warning;
 * the table groups off SQ_STATUS_ORDER; the overdue rule is the one line
 * the morning brief also reads; a move says where it went; and the stage
 * log is written where a status changes and read back honestly.
 *
 * Run: node test/order-board-layout.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('order board layout');
const src = read('index.html');
const section = (/<section id="tab-quote-saved"[\s\S]*?<\/section>/.exec(src) || [''])[0];
const render = extractFunction(src, 'renderSavedQuotes', 'index.html');
const layer = src.slice(src.indexOf('THE OW LAYER'), src.lastIndexOf('</style>'));
const phone = layer.slice(layer.indexOf('THE PHONE.'));
const desk = layer.slice(0, layer.indexOf('THE PHONE.'));

/* ---------- 1. the shape ---------------------------------------------- */
{
  t.check(/<div class="ow-strip ow-strip-5" id="ot_strip"><\/div>/.test(section), 'the strip has its mount');
  t.check(/id="ot_needs"/.test(section) && /id="ot_seg"/.test(section) && /id="ot_rail"/.test(section),
    'and so do the queue, the lens and the rail');
  t.check(/<div class="ow-pan"><div class="ow-tbl ow-ot" id="savedQuotesWrap"><\/div><\/div>/.test(section),
    'the table keeps the wrap id eight test files compile against, inside a panel');
  t.check(!/sq-board|sq-stepper|sq-card|sq-col|sqStepperMount|sq_select_all|sq_print_selected/.test(section),
    'and none of the lane vocabulary is in the markup');
  t.check(!/sq-(board|stepper|card|col|check|goods-row|cash|assignee)/.test(render), 'nor in what the render emits');
  t.check(/id="ot_search"/.test(section) && section.indexOf('id="ot_search"') < section.indexOf('id="ot_strip"'),
    'the search sits in the page header');
  t.check(!/ot_search'\)\.(value =|innerHTML)/.test(render) && /searchTokens\(\(el\('ot_search'\) \|\| \{\}\)\.value\)/.test(render),
    'outside anything the render rewrites -- it only reads it, so typing never loses the caret');
}

/* ---------- 2. one listener, bound once ------------------------------- */
{
  const bound = (src.match(/document\.getElementById\('tab-quote-saved'\)\.addEventListener\('click'/g) || []).length;
  t.check(bound === 1, `one delegated listener on the section, bound once at parse time (${bound})`);
  t.check(!/addEventListener/.test(render), 'and the render binds nothing -- an act never depends on which render last wired it');
  t.check(/const act = t\.closest\('\[data-act\]'\);\s*if\(act\)\{ otAct\(act\.dataset\.act, Number\(act\.dataset\.id\), act\); return; \}/.test(src),
    'every act is a data-act the listener dispatches, with the element so a supplier act knows its supplier');
  t.check(/if\(t\.closest\('a, button, input, select, label'\)\) return;/.test(src),
    'and a control inside a row never opens the row by accident');
  const dispatch = extractFunction(src, 'otAct', 'index.html');
  /* 'assign' and 'assigndelivery' are gone with the pop-up they opened.
     A picker is not assigned from here at all now -- the order joins the
     pickers' queue and the next free one takes it from their phone -- and
     a driver is named by loading the order out, which is 'loaded' (open
     the row's form) and 'loadgo' (the form's own button). 'release' is
     the way back to the queue for an order held by somebody whose phone
     cannot show it. */
  ['open', 'leave', 'announce', 'ask', 'confirmed', 'undoconfirm', 'confirm', 'next', 'prev', 'buying', 'pickups', 'runs',
    'loaded', 'loadgo', 'release', 'shortpick', 'prepay', 'invoice', 'print', 'preview', 'edit', 'delete'].forEach((a) => {
    t.check(new RegExp(`case '${a}':`).test(dispatch), `otAct knows ${a}`);
  });
}

/* ---------- 3. the strip counts the whole board ----------------------- */
{
  t.check(render.indexOf('put(strip,') > 0 && render.indexOf('otOrderMatches(q, tokens)') > render.indexOf('put(strip,'),
    'the strip is computed before the search narrows anything');
  t.check(/const quotes = allQuotes\.filter\(q=>!quoteAgedOffBoard\(q\) && !q\.voided\);/.test(render),
    'over the live orders: not aged off, not cancelled');
  t.check(/orderBoardCashToBuy\(beingPreparedOrders\(\)\)/.test(render),
    "the cash to buy in is the buying list's own figure, over both working stages");
  t.check(/deliveryRuns\(pendingDeliveryOrders\(\)\)/.test(render), "and out-for-delivery is the delivery runs' own clustering");
  t.check(/needs\.length \? 'ow-warn' : ''/.test(render) && /toInvoice\.length \? 'ow-warn' : ''/.test(render),
    'amber only on the two tiles that are chores, and only when they are not empty');
}

/* ---------- 4. the queue: named derivations, longest first ------------ */
{
  const NOW = Date.now();
  const env = {
    data: { staff: [{ id: 'W1', name: 'Musa' }], agents: [{ id: 'A1', name: 'Peter', paymentTerm: 'prepay' }] },
    esc: (s) => String(s == null ? '' : s),
    fmtUGX: (n) => Number(n || 0).toLocaleString('en-US') + ' UGX',
    supplierName: (id) => ({ S1: 'Roofings', S2: 'Hima' })[id] || String(id),
    staffName: (id) => ({ W1: 'Musa' })[id] || 'somebody',
    orderSupplierGroups: (q) => (q.sup || []).map((sid) => ({ supplierId: sid, lines: [] })),
    orderSupplierConfirmState: (q, sid) => Object.assign({ state: 'pending', askedAt: null, at: null, note: '' }, (q.states || {})[sid] || {}),
    orderDraftReady: (q) => (q.sup || []).every((sid) => ((q.states || {})[sid] || {}).state === 'confirmed'),
    agentPaymentBlocksPreparing: (q) => !!q.unpaid,
    invoiceBalanceDue: (q) => q.total || 0,
    orderGoodsProgress: (q) => q.goods || { received: 0, total: 0, short: 0 },
    orderLinesWithNobodySent: (q) => q.nobody || [],
    orderShortLines: (q) => q.shortLines || [],
    quoteLineShortfall: (l) => l.short || 0,
    orderHasPickShortfall: (q) => !!q.pickShort,
    pickShortfallLabel: () => 'Picked short — 2 of 5 found',
    orderNeedsWorker: (q) => q.status === 'preparing' && !!q.assignedWorkerId && q.pickingStatus === 'stranded',
    workerPickQueue: () => [],
    goodsBlockPreparing: (q) => !!q.goodsOut,
    orderIncomingLines: (q) => q.incoming || [],
    orderNeedsDelivery: (q) => q.status === 'pending_delivery' && !q.assignedDeliveryId,
    deliveryIsSelfCarried: (q) => q.assignedDeliveryId === '__agent__',
    deliveryAssigneeLabel: (q) => (q.assignedDeliveryId === '__agent__' ? 'Agent pickup' : 'Kasule'),
    itemPickAnswered: (it) => !!it.pickStatus,
    orderGoodsRowHTML: () => '<div class="ow-ot-gr">2 of 3 items in</div>',
    orderTripsRowHTML: () => '',
    invoiceNumberLabel: (q) => 'INV-' + q.id,
    savedQuoteTotal: (q) => q.total || 0,
    quoteClientName: (q) => (q.client && q.client.name) || 'Unnamed client',
    SQ_BOARD_HIDE_AFTER_MS: 86400000,
  };
  const scope = compileScope([
    extractDeclaration(src, 'ORDER_STATUS_SHORT_LABELS', 'index.html'),
    ...['otStageShort', 'otDuration', 'otWhen', 'otStageSince', 'otStaffGone', 'orderSupplierActsHTML', 'orderNeedsYou',
      'orderActSpec', 'orderWho', 'orderWhoText', 'orderWhoHTML'].map((n) => extractFunction(src, n, 'index.html')),
  ], env, ['orderNeedsYou', 'orderActSpec', 'orderWho', 'otDuration']);
  const late = () => true, fine = () => false;
  const q = (over) => Object.assign({ id: 7, status: 'draft', client: { name: 'Musa Hardware' }, total: 851000,
    stageEnteredAt: NOW - 3600000, items: [] }, over);
  const need = (o, over) => scope.orderNeedsYou(q(o), over || fine);

  const taps = (h, sid) => new RegExp(`data-act="ask" data-id="7" data-sid="${sid}"`).test(h) && new RegExp(`data-act="confirmed" data-id="7" data-sid="${sid}"`).test(h);
  let n = need({ sup: ['S1', 'S2'] });
  t.check(n && n.chip === 'Not asked' && n.acts.length === 0 && taps(n.html, 'S1') && taps(n.html, 'S2'),
    `a draft nobody has asked for is Not asked, with Ask and Confirmed on the row for each supplier (${n && n.chip})`);
  t.check(n && /Roofings/.test(n.html) && /Hima/.test(n.html) && !/Roofings/.test(n.say), 'the lines name who is to be asked, and the sentence does not say it twice');
  t.check(n && /not asked yet/.test(n.html) && /Ask</.test(n.html), 'each line says where the asking has got to');
  n = need({ sup: ['S1'], states: { S1: { state: 'pending', askedAt: NOW - 7200000 } } });
  t.check(n && n.chip === 'Supplier silent' && /Roofings/.test(n.say) && /2 h/.test(n.say) && /Ask again/.test(n.html),
    `asked and unanswered is Supplier silent, saying who and for how long, with Ask again (${n && n.say})`);
  n = need({ sup: ['S1'], states: { S1: { state: 'problem', note: 'no stock' } } });
  t.check(n && n.chip === 'Problem' && n.tone === 'ow-warn' && /no stock/.test(n.say) && taps(n.html, 'S1'),
    'a problem outranks the count and carries the note');
  n = need({ sup: ['S1'], states: { S1: { state: 'stale' } } });
  t.check(n && n.chip === 'Quote changed' && n.tone === 'ow-warn' && /Ask again/.test(n.html), 'a confirmation the quote moved under is Quote changed');
  n = need({ sup: ['S1', 'S2', 'S3'] });
  t.check(n && (n.html.match(/data-act="ask"/g) || []).length === 2 && /and 1 more/.test(n.html) && /data-act="open"/.test(n.html),
    'the queue shows two suppliers and counts the rest, with the row as the way to them');
  n = need({ sup: ['S1'], states: { S1: { state: 'confirmed' } } });
  t.check(n && n.chip === 'Ready' && n.acts[0].act === 'leave' && n.acts[0].label === 'Move on' && n.tone === '',
    'every supplier back is Ready, with the move as the act, and no amber -- nothing is wrong');
  n = need({ sup: [] });
  t.check(n && n.chip === 'Ready' && /shelf/.test(n.say) && n.acts[0].act === 'leave' && n.acts[0].label === 'To the pickers',
    'and an order with nothing to buy waits for one tap -- it has no answer to leave on, and a saved quote can still be a quote');
  n = need({ sup: ['S1'], states: { S1: { state: 'confirmed' } }, unpaid: true, originAgentId: 'A1' });
  t.check(n && n.chip === 'Agent unpaid' && n.acts[0].act === 'prepay' && /851,000/.test(n.say),
    'a prepay agent who has not paid is asked for the money first, with the figure');
  n = need({ status: 'awaiting_goods', nobody: [{ supplierId: 'S2' }], goods: { received: 0, total: 1, short: 0 } });
  t.check(n && n.chip === 'Nobody sent to buy' && n.acts[0].act === 'buying' && /Hima/.test(n.say),
    'a line on no trip is Nobody sent to buy, naming the supplier, with the buying list as the act');
  n = need({ status: 'awaiting_goods', goods: { received: 1, total: 1, short: 1 }, shortLines: [{ short: 20, unit: 'bags', productName: 'Cement' }] });
  t.check(n && n.chip === 'Short delivery' && n.tone === 'ow-warn' && /20 bags/.test(n.say) && /Cement/.test(n.say),
    'a short delivery is named with the number and the item');
  n = need({ status: 'awaiting_goods', goods: { received: 0, total: 2, short: 0 } });
  t.check(n === null, 'goods on their way need nothing from the owner');
  /* Nobody on a preparing order is not the owner's problem any more: it
     is in the pickers' queue on every worker's phone, and the next free
     one takes it. So the queue says nothing about it at all. */
  n = need({ status: 'preparing' });
  t.check(n === null, 'an order waiting for the next free picker needs nothing from the owner');
  n = need({ status: 'preparing', assignedWorkerId: 'W1', pickShort: true });
  t.check(n && n.chip === 'Short pick' && n.tone === 'ow-warn' && n.acts[0].act === 'shortpick', 'a short pick is a decision');
  n = need({ status: 'preparing', assignedWorkerId: 'W1', pickingStatus: 'in_progress' });
  t.check(n === null, 'an order being picked needs nothing');
  // Packed: the pick is over, the goods are on the floor, and the one
  // thing left is saying who took them.
  n = need({ status: 'preparing', assignedWorkerId: 'W1', pickingStatus: 'done', pickingDoneAt: NOW - 3600000 });
  t.check(n && n.chip === 'Packed' && n.acts[0].act === 'loaded' && /Musa/.test(n.say) && /1 h/.test(n.say),
    'a packed order says who packed it and when, and its act is Loaded');
  // Held by somebody whose phone cannot show it -- the one stranding the
  // board still has to offer a way out of.
  n = need({ status: 'preparing', assignedWorkerId: 'W1', pickingStatus: 'stranded' });
  t.check(n && n.acts[0].act === 'release' && /queue/.test(n.say),
    'an order held by somebody whose phone is not showing it goes back to the queue');
  // Why an order is NOT in that queue, when it is not.
  n = need({ status: 'preparing', goodsOut: true, incoming: [{}, {}] });
  t.check(n && n.chip === 'Goods not in' && n.acts[0].act === 'buying' && /2 lines/.test(n.say),
    'and an order no picker is offered says why — the goods are still at a supplier');
  n = need({ status: 'preparing', unpaid: true, originAgentId: 'A1' });
  t.check(n && n.chip === 'Agent unpaid' && n.acts[0].act === 'prepay',
    'as does one waiting on an agent who pays first');
  n = need({ status: 'pending_delivery' });
  t.check(n && n.chip === 'Nobody named' && n.acts[0].act === 'loaded', 'an order out with nobody named asks who has it');
  n = need({ status: 'pending_delivery', assignedDeliveryId: 'D1' });
  t.check(n === null, 'an order out with somebody needs nothing until the call comes');
  n = need({ status: 'completed', invoiced: false });
  t.check(n && n.chip === 'Not invoiced' && n.acts[0].act === 'invoice' && /851,000/.test(n.say) && /Musa Hardware/.test(n.say),
    'delivered and not invoiced says what invoicing will book, and on whom');
  t.check(n && /ow-ot-fig/.test(n.say) && !/ow-bad|ow-crimson|ow-warn/.test(n.say), 'the figure in a queue row is a size, not a warning');
  n = need({ status: 'completed', invoiced: true });
  t.check(n === null, 'and an invoiced order is done with');
  n = need({ status: 'pending_delivery', assignedDeliveryId: 'D1' }, late);
  t.check(n && /^Waiting/.test(n.chip) && n.tone === 'ow-warn' && n.acts[0].act === 'next',
    "past its limit with nothing else wrong, an order waits amber with the stage's own act");

  t.check(/\.filter\(x=> x\.need\)\.sort\(\(a, b\)=> since\(a\.q, b\.q\)\)/.test(render), 'and the queue is sorted longest waiting first, whatever the reason');
  const act = scope.orderActSpec(q({ status: 'pending_delivery', assignedDeliveryId: 'D1', deliveryMode: 'agent_pickup' }));
  t.check(act && act.label === 'Collected' && act.primary, "an agent's own pickup is Collected, not Delivered");
  t.check(scope.otDuration(2 * 86400000 + 3 * 3600000) === '2 d 3 h' && scope.otDuration(4 * 3600000 + 600000) === '4 h 10 m'
    && scope.otDuration(25 * 60000) === '25 m', 'a duration reads as the board says it');
}

/* ---------- 5. a figure is a size, the accent appears once ------------ */
{
  const qrow = extractFunction(src, 'otQueueRowHTML', 'index.html');
  t.check(/class="ow-ot-qw-s">#\$\{q\.id\} · \$\{esc\(fmtUGX\(savedQuoteTotal\(q\)\)\)\}/.test(qrow) && !/ow-bad|ow-crimson/.test(qrow),
    "a queue row's money is ink, never crimson");
  const row = extractFunction(src, 'orderRowHTML', 'index.html');
  t.check(/<div class="ow-tbl-n" data-l="Client pays"/.test(row) && !/ow-tbl-n[^>]*ow-(bad|warn)/.test(row),
    'and so is the table\'s "Client pays" column');
  const act = extractFunction(src, 'orderActHTML', 'index.html');
  t.check(/const accent = !!\(open && a\.primary\);/.test(act) && /\$\{accent \? 'btn-accent' : 'btn-ghost'\}/.test(act),
    "the accent lands on the open row's own act, and only when that act is the stage's real move");
  t.check(!/btn-accent/.test(qrow) && !/btn-accent/.test(section), 'nowhere else on the screen');
}

/* ---------- 6. the table groups off the one list ---------------------- */
{
  t.check(/SQ_STATUS_ORDER\.forEach\(s=>\{ byStage\[s\] = quotes\.filter\(q=> q\.status === s\)\.sort\(since\); \}\);/.test(render),
    'the groups come from SQ_STATUS_ORDER, each longest waiting first');
  t.check(/const shownStages = otStageLens === 'all' \? SQ_STATUS_ORDER : \[otStageLens\];/.test(render),
    'and the lens narrows to one of them, never to a literal list');
  t.check(!/\['draft'/.test(render), 'no stage list is written out by hand');
  t.check(/if\(!SQ_STATUS_ORDER\.includes\(otStageLens\)\) otStageLens = 'all';/.test(render),
    'a lens that names a stage that no longer exists falls back to All');
  t.check(/class="ow-tbl-g">\$\{esc\(otStageShort\(s\)\)\} <span class="ow-ot-gn">\$\{rows\.length\}<\/span><span class="ow-tbl-gs">\$\{esc\(OT_STAGE_SENTENCE\[s\] \|\| ''\)\}/.test(render),
    'each group head carries the stage, its count and its one sentence');
}

/* ---------- 7. the overdue rule, read in three places ----------------- */
{
  t.check(/const orderIsOverdue = \(q\)=> orderStageOverdue\(q, stageLimits, Date\.now\(\)\);/.test(render),
    'the overdue rule is one helper -- shared with the morning brief via orderStageOverdue');
  t.check(/orderRowHTML\(q, orderIsOverdue\)/.test(render), 'read by the row');
  t.check(/orderNeedsYou\(q, orderIsOverdue\)/.test(render), 'by the queue');
  t.check(/orderLatePanelHTML\(quotes, orderIsOverdue\)/.test(render), 'and by the rail, so the three can never disagree');
  const late = extractFunction(src, 'orderLatePanelHTML', 'index.html');
  t.check(/No stage limits set/.test(late) && /Nothing past its limit/.test(late),
    'and an empty panel tells the two silences apart -- no limit set, or nothing past one');
}

/* ---------- 8. a move says where it went ------------------------------ */
{
  const run = (over) => {
    const calls = { toasts: [], classes: [], scrolls: [] };
    const row = { classList: { add: (c) => calls.classes.push(c), remove: () => {} }, offsetWidth: 1,
      scrollIntoView: (o) => calls.scrolls.push(o) };
    const scope = compileScope([extractDeclaration(src, 'SQ_STATUSES', 'index.html'),
      extractFunction(src, 'announceOrderMove', 'index.html')], Object.assign({
      toast: (m) => calls.toasts.push(m),
      matchMedia: () => ({ matches: false }),
      document: { querySelector: () => row },
      setTimeout: () => 0,
    }, over || {}), ['announceOrderMove']);
    return { scope, calls };
  };
  const a = run();
  a.scope.announceOrderMove({ id: 7, client: { name: 'Musa Hardware' } }, 'preparing');
  t.check(a.calls.toasts[0] === 'Musa Hardware → Preparing',
    `the toast names the order and the stage, without the "Step 3." prefix (${a.calls.toasts[0]})`);
  t.check(a.calls.classes.includes('ow-ot-moved'), 'the row it became flashes');
  t.check(a.calls.scrolls.length === 1 && a.calls.scrolls[0].behavior === 'smooth' && a.calls.scrolls[0].block === 'nearest'
    && !('inline' in a.calls.scrolls[0]),
    'and is brought into view -- never sideways, because nothing on this screen scrolls sideways');
  const b = run({ matchMedia: () => ({ matches: true }) });
  b.scope.announceOrderMove({ id: 7, client: {} }, 'completed');
  t.check(b.calls.toasts[0] === 'Order → Delivered', 'an order with no client name is still announced, not skipped');
  t.check(!b.calls.classes.includes('ow-ot-moved') && b.calls.scrolls[0].behavior === 'auto',
    'reduced motion keeps the toast, drops the flash, and jumps instead of sliding');
  const c = run({ document: { querySelector: () => null } });
  c.scope.announceOrderMove({ id: 9, client: { name: 'X' } }, 'draft');
  t.check(c.calls.toasts.length === 1 && c.calls.scrolls.length === 0,
    'a move made while the board is not drawn still says so, and touches nothing');
  t.check(/#savedQuotesWrap \.ow-ot-r\[data-id=/.test(extractFunction(src, 'announceOrderMove', 'index.html')),
    'the row is found on the ORDERS board -- the sourcing funnel keeps the lanes and must never be scrolled by a move here');
  const setter = extractFunction(src, 'setSavedQuoteStatus', 'index.html');
  t.check(/const moved = q\.status!==status;/.test(setter) && /if\(moved\) announceOrderMove\(q, status\);/.test(setter),
    'called from setSavedQuoteStatus when the status really changed -- the assign modal and prepay paths land there too');
  t.check(!/announceOrderMove/.test(extractFunction(src, 'stepSavedQuoteStatus', 'index.html')),
    'and not duplicated in the arrow handler on top of it');
}

/* ---------- 9. the timer ---------------------------------------------- */
{
  const timer = (/setInterval\(\(\)=>\{\s*const tab = document\.getElementById\('tab-quote-saved'\);[\s\S]*?\}, 60000\);/.exec(src) || [''])[0];
  t.check(/if\(tab && tab\.style\.display !== 'none' && !otTyping\(\)\) renderSavedQuotes\(\);/.test(timer),
    'the board redraws itself every minute while it is showing, so a wait crosses its limit on its own');
  /* ...unless somebody is typing into a row's Loaded form, where a redraw
     mid-word would take the caret with it. What is typed survives a
     redraw either way (otLoadDrafts), so this is about the caret, not the
     characters -- and it is the same lesson the search box learned by
     living outside what the render rewrites. */
  const typing = extractFunction(src, 'otTyping', 'index.html');
  t.check(/document\.activeElement/.test(typing) && /\[data-load\]/.test(typing),
    'and holds off while a carrier field has the caret');
  t.check(/carrierDraftsFrom\(wrap\)\.forEach\(\(v, k\)=> otLoadDrafts\.set\(k, v\)\);/.test(render),
    'while what was typed survives every redraw, typed into or not');
  t.check(/if\(!document\.hidden\) runStageAlerts\(\);/.test(timer),
    'and the stage alerts ride the same timer whatever screen is open');
  t.check(/const otOpenRows = new Set\(\);/.test(src) && /otOpenRows\.has\(q\.id\)/.test(extractFunction(src, 'orderRowHTML', 'index.html')),
    'a row the owner opened stays open across that redraw');
}

/* ---------- 10. the phone --------------------------------------------- */
{
  t.check(/\.ow-ot \.ow-tbl-a \.btn\.ow-sm\{[^}]*min-height:var\(--ow-tap\)/.test(phone), "a row's act is a thumb high");
  t.check(/\.ow-ot-qa \.btn\.ow-sm\{[^}]*min-height:var\(--ow-tap\)/.test(phone), "and so is a queue row's");
  t.check(/\.ow-ot-more\{display:none;\}/.test(phone) && /\.ow-ot-needs\.ow-open \.ow-ot-more\{display:grid;\}/.test(phone),
    'the queue shows three rows and folds the rest');
  t.check(/\.ow-ot-qmore\{display:none;\}/.test(desk) && /\.ow-ot-qmore\{display:flex/.test(phone),
    'behind a control the console never needs');
  t.check(/class="ow-ot-q\$\{i >= 3 \? ' ow-ot-more' : ''\}\$\{need\.html \? ' ow-ot-q-sup' : ''\}"/.test(extractFunction(src, 'otQueueRowHTML', 'index.html'))
    && /data-act="needsmore"/.test(render) && /and \$\{needs\.length - 3\} more/.test(render),
    'and the control says how many are folded rather than hiding them silently');
  t.check(/\.ow-ot-r\.ow-open \+ \.ow-tbl-x\{display:flex;flex-direction:column/.test(phone),
    'an open row stacks its two halves on the phone');
}

/* ---------- 11. the stage log, written once and read honestly --------- */
{
  const setter = extractFunction(src, 'setSavedQuoteStatus', 'index.html');
  t.check(/if\(moved\)\{[\s\S]*?q\.stageLog\.push\(\{ status, at: Date\.now\(\), auto: !!\(opts && opts\.auto\) \}\);[\s\S]*?\}\s*q\.status = status;/.test(setter),
    'setSavedQuoteStatus appends to the stage log only on a real move, marking a step the app took itself');
  const trail = extractFunction(src, 'orderTrail', 'index.html');
  ['q.savedAt', 'q.supplierConfirms', 'q.stageLog', 'it.receivedAt', 'q.pickingAssignedAt', 'q.workerAcceptedAt',
    'q.pickingDoneAt', 'q.carrier', 'q.announcedAt', 'q.invoicedTs', 'q.cancelledAt'].forEach((f) => {
    t.check(trail.includes(f), `the trail reads ${f} off the record`);
  });
  t.check(!/Math\.random|invent/.test(trail), 'and invents nothing');
  t.check(/were not written down/.test(extractFunction(src, 'orderTrailHTML', 'index.html')),
    'an order from before the log says so rather than showing a history it does not have');
  const sync = (/savedQuotes: d\.savedQuotes\.map\(q=>\(\{[\s\S]*?\}\)\),/.exec(src) || [''])[0];
  ['stageLog:q.stageLog||null', 'announcedAt:q.announcedAt||null', 'cancelledAt:q.cancelledAt||null',
    'carrier:q.carrier||null', 'pickingDoneAt:q.pickingDoneAt||null'].forEach((k) => {
    t.check(sync.includes(k), `the sync literal carries ${k.split(':')[0]} -- a key missing there is dropped on save`);
  });
}

/* ---------- 12. the stages, named as the shop names them -------------- */
{
  const statuses = extractDeclaration(src, 'SQ_STATUSES', 'index.html');
  ['Step 1. Taken', 'Step 2. Buying', 'Step 3. Preparing', 'Step 4. Out for delivery', 'Step 5. Delivered'].forEach((l) => {
    t.check(statuses.includes(`label:'${l}'`), `${l}`);
  });
  t.check(/'draft','awaiting_goods','preparing','pending_delivery','completed'/.test(extractDeclaration(src, 'SQ_STATUS_ORDER', 'index.html')),
    'and the keys every derivation reads are untouched');
  const short = extractDeclaration(src, 'ORDER_STATUS_SHORT_LABELS', 'index.html');
  t.check(/draft:'Taken'/.test(short) && /pending_delivery:'Out for delivery'/.test(short) && /completed:'Delivered'/.test(short),
    'the short labels say the same words');
  t.check(!/Awaiting Goods|Being Prepared|Pending Delivery/.test(section + render), 'and the old names are gone from the screen');
}

/* ---------- 13. the caret survives the redraw ------------------------- */
/*
 * Reported from the live shop, on the Loaded form: you type, and mid-word
 * the box goes dead and the next letters vanish.
 *
 * The values were already carried across a redraw (otLoadDrafts), so the
 * text on screen looked right -- what was lost was the FOCUS. The board
 * replaces its whole wrap, so the box being typed into is a new element
 * and the old one's focus dies with it; every keystroke after that landed
 * on the page and was thrown away. What made it constant rather than rare
 * is that this render has some twenty callers, one of them a background
 * refresh every thirty seconds: pause to read a number plate off a lorry,
 * and the field dies under your hands.
 *
 * Two halves, and both are needed. The caret is given back after the
 * rewrite, which covers all twenty callers at once; and the background
 * refresh holds off while the form is in use, because an OPEN dropdown
 * cannot be given back -- no page can reopen a native select, so the list
 * of who is carrying the order shut itself while it was being read.
 */
{
  // Snapshot BEFORE the wrap is rewritten, restore AFTER -- restoring
  // first would put the caret into elements about to be destroyed.
  const iSnap = render.indexOf('otFocusSnapshot()');
  const iWrite = render.indexOf('wrap.innerHTML =');
  const iBack = render.indexOf('otRestoreFocus(');
  t.check(iSnap > -1 && iWrite > -1 && iBack > -1 && iSnap < iWrite && iWrite < iBack,
    'the render notes where the caret was, rewrites the board, then puts it back');

  // compileScope binds each env value as a variable at compile time, so the
  // fake document is MUTATED between cases rather than replaced.
  const doc = { activeElement: null, querySelector: () => null };
  const scope = compileScope(
    ['otFocusSnapshot', 'otRestoreFocus'].map((n) => extractFunction(src, n, 'index.html')),
    { document: doc }, ['otFocusSnapshot', 'otRestoreFocus'],
  );
  // A field in a row's Loaded form, with a caret parked mid-word.
  const form = { dataset: { load: '7' } };
  const typing = { tagName: 'INPUT', dataset: { car: 'name' }, selectionStart: 3, selectionEnd: 3,
    closest: (s) => (s === '#savedQuotesWrap [data-load]' ? form : null) };
  doc.activeElement = typing;
  const snap = scope.otFocusSnapshot();
  t.check(snap && snap.id === '7' && snap.car === 'name' && snap.start === 3,
    'it records which order, which field, and where in it the caret was');

  // The element the redraw built in its place.
  const rebuilt = { focused: 0, range: null, focus(){ this.focused++; }, setSelectionRange(a, b){ this.range = [a, b]; } };
  let asked = null;
  doc.activeElement = {};
  doc.querySelector = (s) => { asked = s; return rebuilt; };
  scope.otRestoreFocus(snap);
  t.check(asked === '#savedQuotesWrap [data-load="7"] [data-car="name"]',
    'and finds the same field on the board the redraw just built');
  t.check(rebuilt.focused === 1 && rebuilt.range && rebuilt.range[0] === 3,
    'giving back the focus AND the caret -- a caret slammed to the end is its own kind of broken when correcting a middle letter');

  // Nothing to restore is not an error, and neither is a field that is gone.
  let threw = false;
  try {
    scope.otRestoreFocus(null);
    doc.querySelector = () => null;
    scope.otRestoreFocus(snap);
    doc.activeElement = { tagName: 'DIV', dataset: {}, closest: () => null };
    t.check(scope.otFocusSnapshot() === null, 'and focus outside the form is nothing to carry');
  } catch (e) { threw = true; }
  t.check(!threw, 'a missing snapshot or a field that no longer exists is not an error');

  // The other half: the refresh keeps its hands off an entry in progress,
  // but cannot be held off for good by focus somebody parked and left.
  /* The guard started here, on this form. It is app-wide now -- every
     screen has controls a redraw would replace, and a dropdown shutting
     itself while it is being read is the same fault wherever it happens
     -- so what is pinned is the general one. */
  const poll = src.slice(src.indexOf('if(document.querySelector(\'.ap-confirm-pending\')) return;'));
  t.check(/if\(owControlInUse\(\) && Date\.now\(\) - lastUserInputAt < 60000\) return;/.test(poll.slice(0, 1600)),
    'the background refresh defers while a control is being used, and only while it is actually being used');
  const inUse = extractFunction(src, 'owControlInUse', 'index.html');
  t.check(/tag === 'select'/.test(inUse) && /isContentEditable/.test(inUse),
    'an open dropdown counts -- it keeps the focus for as long as its list is open');
  t.check(/\['button','submit','reset','checkbox','radio','file'\]/.test(inUse),
    'a button or a tick does not, holding no unsaved words');
  t.check(/\['input','change','keydown','pointerdown','focusin'\]/.test(src),
    "and the clock it reads is armed by opening a control, not only by typing into one -- a dropdown being read fires no input event at all");
  t.check(/closest\('#savedQuotesWrap \[data-load\]'\)/.test(extractFunction(src, 'otTyping', 'index.html')),
    "while the board's own minute timer still asks the narrower question about its own form");
}

process.exit(t.done() ? 1 : 0);
