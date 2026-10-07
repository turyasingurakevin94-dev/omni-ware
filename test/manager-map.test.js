#!/usr/bin/env node
'use strict';
/*
 * The Manager's map: the shop as one picture.
 *
 * Six areas around the Manager, each with its one figure and the people,
 * lines and accounts that matter most hanging off it. It reads the same
 * position the meeting reads (shop_pulse), and every leaf is keyed the
 * way a move's subject is keyed -- which is what lets today's plan light
 * up exactly the customer, supplier or line it acts on.
 *
 * Run: node test/manager-map.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('manager map');
const src = read('index.html');
/* The Manager screen is renderManager and the seven bed painters it hands
   every reading to (mgrPaint<Bed>), so a pin on "the render" reads all
   eight: what used to sit in one function is drawn by the bed it belongs to. */
const MGR_RENDER = ['renderManager', 'mgrPaintBrief', 'mgrPaintSim', 'mgrPaintTargets', 'mgrPaintPlays',
  'mgrPaintUnusual', 'mgrPaintAsk', 'mgrPaintRecord'];
const mgrRender = () => MGR_RENDER.map((n) => extractFunction(src, n, 'index.html')).join('\n');
const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const scope = compileScope([
  extractFunction(src, 'mgrMapModel', 'index.html'),
  extractFunction(src, 'mgrMapSubjectIds', 'index.html'),
  extractFunction(src, 'mgrMapLayout', 'index.html'),
  extractFunction(src, 'mgrMapUnclash', 'index.html'),
  extractFunction(src, 'mgrMapLeafW', 'index.html'),
  extractDeclaration(src, 'MGR_MAP_LEAF_MAXW', 'index.html'),
  extractFunction(src, 'mgrMapAvHTML', 'index.html'),
  extractFunction(src, 'mgrMapNodeStyle', 'index.html'),
  extractFunction(src, 'mgrMapIni', 'index.html'),
  extractFunction(src, 'mgrMapHTML', 'index.html'),
  extractFunction(src, 'mgrMapDetailHTML', 'index.html'),
  extractFunction(src, 'mgrShortUGX', 'index.html'),
  extractDeclaration(src, 'MGR_MAP_DOMAINS', 'index.html'),
  extractDeclaration(src, 'MGR_MAP_ICON', 'index.html'),
], {
  esc, Math, Number, String, Array, Object, Map, Set,
  fmtUGX: (n) => Math.round(n).toLocaleString('en-US') + ' UGX', fmtShortDate: (d) => d,
  MANAGER_DOORS: { chase: { tab: 'chase', label: 'Open the money queue' }, cashbook: { tab: 'cashbook', label: 'Open the Cash book' } },
  MANAGER_OBJECTIVES: { cash: 'Cash first' },
  chaseResponseLine: () => 'pays when chased', mgrChaseRowFor: () => ({}),
}, ['mgrMapModel', 'mgrMapLayout', 'mgrMapHTML', 'mgrMapAvHTML']);

const pulse = {
  cash: { total: 10630000, safe_to_spend: 6600000 },
  who_you_owe: { total: 19700000, bills: 35, no_day_named: 30, past_a_day_you_named: 0,
    due_in_the_window: [{ supplierId: 'S1', supplier: 'Roto', bill: 'B1', owed: 4000000 }],
    biggest_with_no_day: [{ supplierId: 'S1', supplier: 'Roto', bill: 'B1', owed: 4000000 }, { supplierId: 'S2', supplier: 'Kato Steel', bill: 'B2', owed: 2500000 }],
    missed_own_word: [] },
  profit: { margin_pct: 5.3, runway_months: 0.2, gross_profit_30d: 900000 },
  margin: { target_pct: 10, lifting_them_would_add_over_30_days: 943000,
    worst_lines: [{ key: 'P1|0', line: 'Masasi 12"', lifting_adds: 600000, kept_pct: 3 }] },
  running_out_soon: [{ key: 'P2|', item: 'Cement 50kg', days_left: 4 }],
  dead_stock: { value: 1200000 },
  buying: { top_lines: [{ cost: 500000 }] },
  going_quiet: [{ customerId: 9, name: 'Ssekitoleko', silent_days: 40 }],
  best_customers: [{ name: 'Amos Dulisa', profit: 800000 }],
};
const debtors = [
  { id: 1, name: 'Amos Dulisa', debt: 2515000, ageDays: 13 },
  { id: 2, name: 'Dad', debt: 1436000, ageDays: 30 },
  { id: 3, name: 'Mulongo Hardware', debt: 900000, ageDays: 8 },
  { id: 4, name: 'Small One', debt: 10000, ageDays: 2 },
  { id: 5, name: 'Tiny', debt: 5000, ageDays: 1 },
];
const moves = [
  { status: 'open', body: { title: 'Collect from Amos', mkind: 'chase', subject: { customerId: 1 } } },
  { status: 'done', body: { title: 'Ring Tiny', mkind: 'chase', subject: { customerId: 5 } } },
  { status: 'open', body: { title: 'Lift Masasi', mkind: 'price', subject: { key: 'P1|0' } } },
];
const model = scope.mgrMapModel(pulse, {
  accounts: [{ key: 'cash', label: 'Cash drawer', amount: 8000000 }, { key: 'momo', label: 'Mobile money', amount: 2630000 }, { key: 'bank', label: 'Bank', amount: 0 }],
  debtors, moves, nameOf: (id) => id === 'c:5' ? 'Tiny' : '',
});
const dom = (id) => model.domains.find((d) => d.id === id);

/* ---------- 1. six areas, each with its one figure ---------------------- */
t.check(model.domains.map((d) => d.id).join() === 'cash,customers,growth,margin,stock,suppliers', 'six areas around the Manager');
t.check(dom('cash').figText === '6.6m' && /safe to spend of 10.63m/.test(dom('cash').sub) && dom('cash').note === '0.2 months of cover',
  'cash leads with what is safe to spend, not the balance');
t.check(dom('cash').leaves.length === 2 && dom('cash').leaves[0].label === 'Cash drawer', 'its accounts hang off it, empty ones left out');
t.check(dom('customers').figText === '4.87m' && dom('customers').sub === '5 owe you', 'customers: what is owed, by how many');
t.check(dom('suppliers').leaves.length === 2 && dom('suppliers').leaves[0].fig === 4000000,
  'suppliers: a bill listed under two headings is counted once');
t.check(dom('margin').figText === '5.3%' && dom('margin').bad === true && dom('margin').sub === 'aim 10%', 'margin below its aim is marked');
t.check(dom('stock').figText === '1' && dom('stock').leaves[0].id === 'k:P2|', 'stock: the lines running out, keyed as a move would key them');
t.check(dom('growth').leaves[0].id === 'c:9' && /40 days silent/.test(dom('growth').leaves[0].sub), 'growth: who is going quiet');

/* ---------- 2. today's plan lights up what it acts on ------------------- */
t.check(dom('customers').on && dom('margin').on && !dom('cash').on && !dom('growth').on,
  'an area glows when a move of its kind is in today\'s plan, and only then');
const amos = dom('customers').leaves.find((l) => l.id === 'c:1');
t.check(amos.on && !amos.done, 'the customer a chase names glows');
const tiny = dom('customers').leaves.find((l) => l.id === 'c:5');
t.check(tiny && tiny.on && tiny.done, 'someone below the top four is added when the plan names them, and shows as done');
t.check(dom('margin').leaves[0].on, 'a line the plan prices glows');
t.check(dom('customers').moves.length === 2, 'and the area carries its moves for the detail panel');
t.check(dom('customers').stroke > dom('growth').stroke && dom('cash').stroke <= 9 && dom('growth').stroke >= 2,
  'line weight follows the money on each area, between 2 and 9');

/* ---------- 3. drawn ---------------------------------------------------- */
const laid = scope.mgrMapLayout(model.domains);
t.check(laid.every((d) => d.leaves.every((l) => l.x >= 90 && l.x <= 910 && l.y >= 22 && l.y <= 638)),
  'every leaf stays inside the frame');
const html = scope.mgrMapHTML(model, null, { today: { meeting: { date: '2026-09-24', body: { objective: 'cash', objectiveWhy: 'w', keyline: 'Get Amos in', rejected: 'the reorder waits' } }, moves },
  review: { date: '2026-09-08', body: { lessons: ['Volume is not the lever'] } }, last: null });
t.check((html.match(/class="mgr-mp-d /g) || []).length === 6 && (html.match(/class="mgr-mp-t[ "]/g) || []).length === 6,
  'six nodes for the drawing, and six tiles for a phone');
t.check(/mgr-mp-ln-on/.test(html) && /stroke-width="[\d.]+"/.test(html), 'glowing lines run to the areas the plan acts on');
t.check(/data-dom="customers" style="[^"]*" aria-pressed="true"/.test(html), 'with no choice made, the first area the plan touches is opened');
t.check(/Open the money queue/.test(html) && /in today’s plan/.test(html) && /done today/.test(html) && /pays when chased/.test(html),
  'the detail names each customer, whether the plan names them, how they answer a chase, and the door');
t.check(/met today · 3 moves/.test(html), 'the Manager at the centre says when it last met');
t.check(/How it decided today/.test(html) && /Cash first/.test(html) && /Set aside/.test(html) && /Volume is not the lever/.test(html),
  'underneath: how it decided, and what it has learned');
const quiet = scope.mgrMapHTML(model, 'growth', null);
t.check(/data-dom="growth" style="[^"]*" aria-pressed="true"/.test(quiet) && /no meeting yet/.test(quiet) && !/How it decided/.test(quiet),
  'an area chosen stays chosen, and a day with no meeting says so and draws nothing it does not have');

/* ---------- 4. wired into the screen ------------------------------------ */
/* WAS: a third tab of the switch with a bed of its own. The map folded
   into the Brief's department board (Q26): it is drawn into the Brief's
   managerDeptWrap, still only when it is looked at -- a render while
   another section is open marks it stale, and opening the Brief draws it. */
const brief = extractFunction(src, 'mgrPaintBrief', 'index.html');
t.check(/const drawMap = \(\)=>\{ mgrPaintMap\(\); mgrMapDirty = false; \};/.test(brief)
  && /mgrMapDirty = true;\s*if\(mgrView === 'brief'\) drawMapSoon\(\);/.test(brief)
  && /if\(gen === mgrRenderGen && mgrMapDirty && mgrView === 'brief'\) drawMap\(\);/.test(brief)
  && /if\(ctx\.landed === 'view' && mgrMapDirty\) drawMap\(\);/.test(brief),
  'the Brief draws it, when it is looked at — after the rest of the Brief, and only for the current render');
t.check(/<div class="mgr-bed mgr-bed-b"[\s\S]*?<div id="managerDeptWrap" class="mgr-slot"><\/div>[\s\S]*?<div class="mgr-bed mgr-bed-x"/.test(src)
  && /function mgrPaintMap\(\)\{\s*const wrap = document\.getElementById\('managerDeptWrap'\);/.test(src),
  'in the Brief\'s department slot');
const paint = extractFunction(src, 'mgrPaintMap', 'index.html');
t.check(/ASSISTANT_TOOLS\.shop_pulse\.run\(\)/.test(paint), 'it reads the same position the meeting reads');
t.check(/could not read the shop/.test(paint), 'and says so when it cannot, rather than drawing a blank');
const render = mgrRender();
t.check(/mgrMapJournal = \{ today: st\.today/.test(render) && /mgrMapModelCache = null;/.test(render),
  'every fresh read of the journal redraws it');
t.check(/\.mgr-mp-cv\{display:none;\}/.test(src) && /\.mgr-mp-tiles\{display:grid;/.test(src),
  'on a phone the drawing becomes tiles');
t.check(/prefers-reduced-motion: reduce\)\{ \.mgr-mp-lines line\.mgr-mp-ln-on/.test(src), 'and the glow holds still for those who ask it to');

/* ---------- labels that land on each other --------------------------
   The shop's own map on 24 Sept: five customers on the right edge and
   five items at the bottom. Before, Mulongo sat under Amos Dulisa and
   "Soft Close Mulper — Flat" under "Half Bend". Every leaf is measured
   as the stylesheet draws it and no two boxes may touch. */
{
  const real = [{"id": "cash", "angle": -90, "leaves": [{"id": "a:cash", "label": "Cash"}, {"id": "a:momo", "label": "Mobile Money"}, {"id": "a:bank", "label": "Bank"}]}, {"id": "customers", "angle": -30, "leaves": [{"id": "c:X727", "label": "Aid"}, {"id": "c:X208", "label": "Kato Brian"}, {"id": "c:X600", "label": "Ruthx"}, {"id": "c:X350", "label": "Mukasax"}, {"id": "c:X864", "label": "Ojok Peters"}]}, {"id": "growth", "angle": 30, "leaves": [{"id": "c:X108", "label": "Nakato An"}, {"id": "c:X793", "label": "Okello Jox"}, {"id": "c:X409", "label": "Babiry"}]}, {"id": "margin", "angle": 90, "leaves": [{"id": "k:P051::18", "label": "Runners \u2014 Masasi / 14\""}, {"id": "k:P051::17", "label": "Runners \u2014 Masasi / 12\""}, {"id": "k:P073::0", "label": "ELEPHANT King \u2014 Short / Single Lock"}]}, {"id": "stock", "angle": 150, "leaves": [{"id": "k:P044::0", "label": "Soft Close Mulper \u2014 Flat"}, {"id": "k:P044::1", "label": "Soft Close Mulper \u2014 Half Bend"}, {"id": "k:P211::3", "label": "Window Rollers \u2014 Big / Grooved"}, {"id": "s:X43", "label": "Akello Maryxx"}, {"id": "k:P073::0", "label": "ELEPHANT King \u2014 Short / Single Lock"}]}, {"id": "suppliers", "angle": 210, "leaves": [{"id": "s:X43", "label": "Akello Maryxx"}, {"id": "s:X574", "label": "Wasswaxxxxx"}]}];
  const out = scope.mgrMapLayout(real);
  const PX = 0.84, PY = 560 / 660, boxes = [];
  out.forEach((d) => d.leaves.forEach((l) => boxes.push({ n: l.label, x: l.x * PX, y: l.y * PY, w: Math.min(180, 36 + l.label.length * 6.2), h: 24 })));
  out.forEach((d) => boxes.push({ n: d.id, x: d.x * PX, y: d.y * PY, w: 108, h: 90 }));
  boxes.push({ n: 'core', x: 420, y: 280, w: 124, h: 124 });
  const clash = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    if (Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2) clash.push(a.n + ' / ' + b.n);
  }
  t.check(!clash.length, 'no label on the map lands on another, or on an area (' + (clash.join('; ') || 'none') + ')');
  t.check(out.every((d) => d.leaves.every((l) => l.x * PX - Math.min(180, 36 + l.label.length * 6.2) / 2 >= 0 && l.x * PX + Math.min(180, 36 + l.label.length * 6.2) / 2 <= 840)),
    'and every label stays inside the frame');
  const crossing = [];
  out.forEach((d) => d.leaves.forEach((l) => {
    const through = out.filter((o) => o.id !== d.id).find((o) => {
      for (let k = 0.1; k < 0.95; k += 0.05) { const x = d.x + (l.x - d.x) * k, y = d.y + (l.y - d.y) * k; if (Math.abs(x - o.x) < 75 && Math.abs(y - o.y) < 61) return true; }
      return false; });
    if (through) crossing.push(l.label + ' through ' + through.id);
  }));
  t.check(!crossing.length, 'and no leaf is moved so far that its line runs through another area (' + (crossing.join('; ') || 'none') + ')');
  const again = scope.mgrMapLayout(real);
  t.check(JSON.stringify(again) === JSON.stringify(out), 'the same books always draw the same map');
  const a = scope.mgrMapAvHTML({ id: 'k:P051::18', label: 'Runners — Masasi / 14"' }, { tone: 'buy' });
  const b = scope.mgrMapAvHTML({ id: 'k:P051::17', label: 'Runners — Masasi / 12"' }, { tone: 'buy' });
  const c = scope.mgrMapAvHTML({ id: 'c:C106', label: 'Mulongo' }, { tone: 'money' });
  t.check(/<svg/.test(a) && a === b && />MU</.test(c),
    'an item wears the tag rather than initials two sizes of it would share; a person keeps their initials');
}

process.exit(t.done() ? 1 : 0);
