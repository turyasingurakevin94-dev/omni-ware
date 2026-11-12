#!/usr/bin/env node
'use strict';
/*
 * The new Store app's shell and its wiring (src/apps/store/shell, src/core/store/supabase):
 *   - the route table is the spec's (docs/spec/04-screens-store-routes.md §2): every id, its boards on the canvas;
 *   - a tapped push opens only ids of that table (routes §5; this is test/store-push-routes.test.js of the spec);
 *   - a snapshot row becomes the yard's shape with no money key read;
 *   - the parity specs test/parity/store-*.json are well formed;
 *   - next/store.html is committed, built from src/, within budget, and carries no sample shop.
 *
 * Run: node test/store-shell.test.js   (or: npm test)
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { ROOT, createReporter } = require('./_extract');

const t = createReporter('store shell');
const { ROUTES, RAIL } = require(path.join(ROOT, 'src/apps/store/shell/routes.ts'));
const { pushRoute, PUSH_KINDS } = require(path.join(ROOT, 'src/apps/store/shell/pushes.ts'));
const { booksOf } = require(path.join(ROOT, 'src/core/store/supabase/rows.ts'));
const { storeDemo } = require(path.join(ROOT, 'src/core/store/demo/index.ts'));

/* ---- the routes are the spec's ---- */
const spec = fs.readFileSync(path.join(ROOT, 'docs/spec/04-screens-store-routes.md'), 'utf8');
const section2 = spec.slice(spec.indexOf('## 2. The routes'), spec.indexOf('## 3.'));
const specIds = [...section2.matchAll(/^\| `([a-z/-]+)` \|/gm)].map((m) => m[1]);
const ids = ROUTES.map((r) => r.id);
t.check(specIds.length === 33 && ids.length === 33, `33 route ids in the spec and in routes.ts (spec ${specIds.length}, table ${ids.length})`);
t.check(specIds.every((id) => ids.includes(id)), `every spec id is in routes.ts${specIds.filter((id) => !ids.includes(id)).map((x) => ' · missing ' + x).join('')}`);
t.check(new Set(ids).size === ids.length, 'one row per id');
const boards = new Set(fs.readdirSync(path.join(ROOT, 'docs/canvas/store-agent/boards')).map((f) => (f.match(/^([A-Z]{2}\d{2})/) || [])[1]).filter(Boolean));
const drawn = ROUTES.flatMap((r) => r.boards);
t.check(drawn.every((b) => boards.has(b)), `every board a route names is on the canvas${drawn.filter((b) => !boards.has(b)).map((x) => ' · ' + x).join('')}`);
// OU31 (name a direction) is a sheet inside out/load, not a route (routes §4).
const screens = [...boards].filter((b) => !/^(IB|FL)/.test(b) && b !== 'OU31');
t.check(screens.every((b) => drawn.includes(b)), `every screen board has a route (${screens.length} boards)${screens.filter((b) => !drawn.includes(b)).map((x) => ' · ' + x).join('')}`);
t.check(ROUTES.filter((r) => r.kind === 'stage').map((r) => r.id).join() === 'pack,in,out/load,out/road', 'the stage sheets: pack, in, out/load, out/road');
t.check(ROUTES.filter((r) => r.kind === 'tab').map((r) => r.id).join() === 'today,shelf', 'the tabs: today and shelf');
t.check(RAIL.map((r) => r.word).join(' · ') === 'Coming in · To pack · To load · On the road · Delivered', 'the rail: Coming in · To pack · To load · On the road · Delivered');
for (const area of ['today', 'pack', 'in', 'shelf', 'out']) t.check(fs.existsSync(path.join(ROOT, 'src/apps/store', area, 'index.tsx')), `src/apps/store/${area}/index.tsx is where the ${area} area's screens go`);

/* ---- a tapped push opens a route of the table ---- */
const section5 = spec.slice(spec.indexOf('## 5.'));
const specKinds = [...section5.matchAll(/`([a-z_]+\.[a-z_.]+)`/g)].map((m) => m[1]).filter((k) => !k.includes('/') && !/\.(ts|js)$/.test(k));
t.check(specKinds.every((k) => PUSH_KINDS.includes(k)), `every push kind of routes §5 is mapped${specKinds.filter((k) => !PUSH_KINDS.includes(k)).map((x) => ' · ' + x).join('')}`);
(async () => {
  const d = storeDemo('?demo', { instant: true }), b = await d.snapshot();
  const datas = [{}, { orderId: 552 }, { orderId: 556 }, { orderId: 534 }, { orderId: 555 }, { tripId: 'TRIP-1017B-1' }, { key: 'p-wn4' }, { aisle: 'Aisle C · Fasteners' }, { askKind: 'extra', tripId: 'T' }, { askKind: 'restock', key: 'p-gp' }, { askKind: 'handover' }];
  const opened = new Set();
  for (const k of [...PUSH_KINDS, 'something.else']) for (const x of datas) opened.add(pushRoute(k, x, b, 'st-mk').id);
  t.check([...opened].every((id) => ids.includes(id)), `every id the push map opens is a route (${[...opened].length} opened)${[...opened].filter((x) => !ids.includes(x)).map((x) => ' · ' + x).join('')}`);
  t.check(pushRoute('order.pick', { orderId: 552 }, b, 'st-mk').id === 'pack/order' && pushRoute('order.pick', { orderId: 556 }, b, 'st-mk').id === 'pack', 'order.pick opens the order only when it is already yours; a tap never takes one');
  t.check(pushRoute('order.cancelled', { orderId: 534 }, b, 'st-mk').id === 'out/road' && pushRoute('order.cancelled', { orderId: 530 }, b, 'st-mk').id === 'pack/put-back', 'order.cancelled: on a truck → On the road; in the yard → put it back');
  t.check(pushRoute('credit.ask.decided', { orderId: 555 }, b, 'st-mk').id === 'out/gate' && pushRoute('credit.ask.decided', { orderId: 530 }, b, 'st-mk').id === 'out/load', 'credit.ask.decided: a pickup → the gate, else To load');

  /* ---- a snapshot row becomes the yard's shape ---- */
  const snap = {
    orders: [{ id: 552, status: 'preparing', invoiced: false, voided: false, date: '2026-10-17', client_name: 'Kato Construction', client_phone: '0772 418 220',
      payload: { customerId: 'c1', assignedWorkerId: 's1', pickingStatus: 'in_progress', bay: 1, deliverTo: 'Ntinda site', deliverWhen: 'today afternoon', counter: false,
        comingBack: { why: 'Closed', at: 1, byName: 'Musa' }, takenBack: [{ askId: 'a', restocked: true, lines: [{ idx: 0, qty: 2, restocked: false }] }],
        letGoAsk: { at: 5, by: 'u1', byName: 'Musa' }, carrier: { kind: 'hired', name: 'Abudu', at: '2026-10-17T10:00:00Z' },
        items: [{ lineId: 'L1', productId: 'p1', variantIdx: 2, productName: 'Iron sheet', qty: 40, unit: 'PC', pickStatus: 'done', pickedQty: 40, supplierId: '__stock__' }] } }],
    trips: [{ id: 'TRIP-X-1', supplier_id: 's9', status: 'collected', assigned_worker_id: '__supplier__', lines: [{ orderId: '552', productId: 'p1', qty: 3, gotQty: 0 }] }],
    holds: { 552: { decision: 'hold' } }, suppliers: [{ id: 's9', name: 'Hima Cement' }],
    products: [{ id: 'p1', name: 'Iron sheet', category: 'Roofing', variants: [{ name: 'G28' }, { name: 'G26' }, { name: 'G30' }] }],
    units: [{ product_id: 'p1', variant_idx: 2, unit: 'pc', pack_unit: 'bundle', pack_qty: 20 }], stock: { 'p1::2': 52 },
    staff: [{ id: 's1', name: 'musa2', user_id: 'u1', role: 'store' }], members: [{ user_id: 'u1', name: 'Musa Kiggundu', role: 'store' }],
    me: { name: 'Musa Kiggundu', staff_id: 's1' }, presets: { categories: ['Roofing'], bays: 6 },
  };
  const yb = booksOf(snap, { userId: 'u1', shopId: 'sh', shopName: 'Mukasa', role: 'store', name: 'musa2', staffId: 's1' }, 0);
  const yo = yb.orders[0], ln = yo.lines[0];
  t.check(yo.moneyHold && yo.deliverTo === 'Ntinda site' && yo.deliverWhen === 'today afternoon' && yo.comingBack.why === 'Closed' && yo.takenBack[0].restocked && yo.takenBack[0].lines[0].restocked === false, 'rows: 0183\'s keys read (deliverTo, deliverWhen, comingBack, takenBack[].restocked), the hold a label');
  t.check(ln.key === 'p1::2' && ln.unit === 'pc' && ln.pickStatus === 'done' && yo.carrier.kind === 'hired' && yo.letGoAsk.byName === 'Musa', 'rows: a line\'s stock key, unit lower case, its pick; the carrier and the ask');
  t.check(yb.trips[0].supplierName === 'Hima Cement' && yb.trips[0].lines[0].gotQty === 0 && yb.trips[0].lines[0].orderId === 552, 'rows: a supplier\'s delivery, a line answered 0');
  t.check(yb.items.length === 3 && yb.items[2].books === 52 && yb.items[2].packUnit === 'bundle' && yb.items[2].name === 'Iron sheet · G30', 'rows: products × variants with their units and stock');
  t.check(yb.me.name === 'Musa Kiggundu' && yb.bays === 6, 'rows: a login handle is never the name (Musa Kiggundu, not musa2)');
  t.check(!/"(price|cost|amount|sellPrice|total)"/.test(JSON.stringify(yb)), 'rows: no money key comes out');

  /* ---- the parity specs ---- */
  const canvas = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/canvas/store-agent/boards/canvas.json'), 'utf8'));
  const files = fs.readdirSync(path.join(ROOT, 'test/parity')).filter((f) => /^store-[a-z]+\.json$/.test(f));
  t.check(files.includes('store-today.json'), 'test/parity/store-today.json, the example spec, is there');
  // A board of the "Added while building" page (AD) belongs to the area whose route draws it (routes.ts).
  const routeSrc = fs.readFileSync(path.join(ROOT, 'src/apps/store/shell/routes.ts'), 'utf8');
  const addedArea = (board) => {
    const id = board.slice(0, 4), m = [...routeSrc.matchAll(/r\('[^']+', '([a-z]+)', '[a-z]+', '[^']*', '([^']*)'\)/g)].find((x) => x[2].split(' ').includes(id));
    return m ? m[1] : null;
  };
  for (const f of files) {
    const area = f.replace(/^store-|\.json$/g, ''), list = JSON.parse(fs.readFileSync(path.join(ROOT, 'test/parity', f), 'utf8'));
    list.forEach((s, i) => {
      const b2 = canvas.boards[s.board];
      t.check(!!b2 && (b2.page === area || (b2.page === 'added' && addedArea(s.board) === area)), `${f}[${i}] ${s.board}: a board of the ${area} page`);
      t.check(!s.demo || s.demo.startsWith('&'), `${f}[${i}]: demo flags start with "&"`);
      t.check(Array.isArray(s.steps || []), `${f}[${i}]: steps is a list`);
    });
  }

  /* ---- the built page ---- */
  const page = path.join(ROOT, 'next/store.html');
  const html = fs.existsSync(page) ? fs.readFileSync(page, 'utf8') : '';
  t.check(html.split('\n')[0].includes('GENERATED from src/apps/store'), 'next/store.html is committed and says GENERATED from src/apps/store');
  t.check(!html.includes('Mukasa Hardware') && !html.includes('Kiggundu'), 'the page carries no sample day (next/store-demo.js does, on ?demo)');
  const gz = zlib.gzipSync(Buffer.from(html), { level: 9 }).length;
  t.check(gz <= 200 * 1024, `next/store.html within the 200 KB budget: ${(gz / 1024).toFixed(1)} KB compressed`);
  t.check(fs.existsSync(path.join(ROOT, 'next/store-demo.js')), 'next/store-demo.js is committed');
  // Per-area loading (shell/areas.ts, spec 07 §4): Pack, Goods in, Shelf and Out each a file beside the page,
  // named by it, of its build, within the 60 KB budget; the page keeps the shell and Today, the demo stays apart.
  const tool = require(path.join(ROOT, 'tools/build-app.js'));
  const lazy = tool.ROLES.store.lazy, named = ((html.match(/<meta name="ow-files" content="([^"]*)">/) || [])[1] || '').split(/\s+/).filter(Boolean);
  t.check(['pack', 'in', 'shelf', 'out'].every((a) => lazy.includes(a)) && !lazy.includes('today'), `Pack, Goods in, Shelf and Out are lazy, Today is in the page (${lazy.join(', ')})`);
  t.check(lazy.every((a) => named.includes(`store-${a}.js`)) && !named.includes('store-demo.js'), `the page names each area's file, never the demo (${named.join(', ')})`);
  const storeBuild = (html.match(/window\.owStoreBuild="(\w+)"/) || [])[1];
  for (const f of named) {
    const text = fs.existsSync(path.join(ROOT, 'next', f)) ? fs.readFileSync(path.join(ROOT, 'next', f), 'utf8') : '';
    const g = zlib.gzipSync(Buffer.from(text), { level: 9 }).length;
    t.check(text.startsWith('// GENERATED from src/apps/store/'), `next/${f} is committed, built from its area`);
    t.check(g <= tool.TAB_BUDGET, `next/${f} within the 60 KB budget: ${(g / 1024).toFixed(1)} KB compressed`);
    t.check(!!storeBuild && text.includes(`"${storeBuild}")`), `next/${f} is of the page's build (${storeBuild})`);
    t.check(!text.includes('Mukasa Hardware'), `next/${f} carries no sample day`);
  }
  const areaSrc = fs.readFileSync(path.join(ROOT, 'src/apps/store/shell/screens.ts'), 'utf8');
  t.check(!/from '\.\.\/(pack|in|shelf|out)\//.test(areaSrc), 'the shell imports no lazy area (they load by route id, shell/areas.ts)');
  t.check(fs.readFileSync(path.join(ROOT, 'store.html'), 'utf8').split('\n')[0].indexOf('GENERATED') < 0, 'store.html, the live app, is untouched (not a built page)');
  let esb = null;
  try { esb = require.resolve('esbuild', { paths: [ROOT] }); } catch (_e) { esb = null; }
  if (!esb) console.log('  (skipped the build: esbuild is not installed here; build-check.yml runs it)');
  else {
    const built = await require(path.join(ROOT, 'tools/build-app.js')).build('store');
    built.files.forEach((x) => t.check((fs.existsSync(x.out) ? fs.readFileSync(x.out, 'utf8') : '') === x.text, `${path.relative(ROOT, x.out)} is exactly what src/ builds (npm run build:store)`));
  }
  process.exit(t.done() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
