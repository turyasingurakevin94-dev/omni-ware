'use strict';
/*
 * The fastener studio: the 3D view, its 1:1 mode, and the boards' wiring.
 *
 * The page used to draw each fastener as an SVG illustration and said, in
 * as many words, that it was "not a calibrated screen ruler"; this file
 * pinned that drawing. The owner's canvas design replaced it with a WebGL
 * model built from the part's own millimetres, and a 1:1 mode that IS a
 * ruler once trued against a bank card. So this file now pins what that
 * promise rests on:
 *
 *   1. every mesh every board can build is finite, closed into triangles
 *      and bounded in size -- across every size, length, type and option
 *      on all three boards -- because one NaN vertex blanks the view;
 *   2. the model is the part's own size: the bolt runs from the head's
 *      top to the tip at exactly its length, and a screw's plug is as
 *      long as the table says;
 *   3. 1:1 really maps one millimetre to `ppm` pixels, ppm is the CSS
 *      reference of 96/25.4 trued by the card, and the card is the ISO
 *      bank card;
 *   4. every {{ hole }} a board's markup reads is one its logic provides,
 *      so no label on the live page prints blank because a name drifted.
 *
 * Run: node test/fastener-studio.test.js   (or: npm test)
 */
const assert = require('assert');
const { read } = require('./_extract');
const src = read('index.html');
const from = src.indexOf('class FsLogic {'), to = src.indexOf('const FS_PAGES = {');
assert(from > 0 && to > from, 'the boards are found ahead of the glue that mounts them');
const STORE = {};
const win = { localStorage: { getItem: (k) => (k in STORE ? STORE[k] : null), setItem: (k, v) => { STORE[k] = String(v); } } };
const K = new Function('window', src.slice(from, to) + `
  return { FsBoltsDesk, FsBoltsPhone, FsScrewsDesk, FsScrewsPhone, FsAnchorsDesk, FsAnchorsPhone, FS_TPL };`)(win);

/* A board with a stand-in GL: _buf hands back the vertex array itself, so
   _build leaves the very arrays WebGL would have been given. */
function studio(Cls) {
  const b = new Cls({});
  b._gl = { deleteBuffer() {} };
  b._buf = (arr) => Float32Array.from(arr);
  return b;
}
let meshes = 0, verts = 0;
function check(b, what) {
  const k = b.kit();
  b._build(k);
  assert(b._meshes.length > 0, what + ': builds something');
  for (const m of b._meshes) {
    assert.equal(m.pb.length, m.nb.length, what + ': a normal for every vertex');
    assert(m.count > 0 && m.count % 3 === 0 && m.count * 3 === m.pb.length, what + ': whole triangles');
    assert(m.count < 400000, what + ': bounded -- ' + m.part + ' has ' + m.count + ' vertices');
    let finite = true, unit = true;
    for (let i = 0; i < m.pb.length; i += 3) {
      const x = m.pb[i] + m.pb[i + 1] + m.pb[i + 2], l = m.nb[i] * m.nb[i] + m.nb[i + 1] * m.nb[i + 1] + m.nb[i + 2] * m.nb[i + 2];
      if (!Number.isFinite(x) || !Number.isFinite(l)) finite = false;
      else if (l < 0.25 || l > 2.25) unit = false;
    }
    assert(finite, what + ': every coordinate is finite (' + m.part + ')');
    assert(unit, what + ': normals are unit length (' + m.part + ')');
    meshes++; verts += m.count;
  }
  return k;
}
const span = (m) => { let lo = Infinity, hi = -Infinity; for (let i = 0; i < m.pb.length; i += 3) { lo = Math.min(lo, m.pb[i]); hi = Math.max(hi, m.pb[i]); } return [lo, hi]; };

/* The geometry (_build and the meshes under it) is shared by a board's
   desktop and phone designs, so every option is swept on the desktop
   board and the phone board is held to the extremes. */
const sweep = (Cls, full) => (full ? (xs) => xs : (xs) => xs.filter((x, i) => i === 0 || i === xs.length - 1));

/* ---------- 1 + 2. bolts: every size, standard, length, nut ---------- */
for (const [Cls, full] of [[K.FsBoltsDesk, true], [K.FsBoltsPhone, false]]) {
  const b = studio(Cls), D = b.D(), pick = sweep(Cls, full);
  for (const r of pick(D.M)) for (const std of ['DIN', 'ISO']) for (const L of [6, 400]) for (const nut of ['hex', 'nyloc']) {
    b.setState({ kind: 'met', size: r.size, std, len: L, nut, pitchIdx: 0 });
    const k = check(b, `${r.size}×${L} ${std} ${nut}`);
    const [lo, hi] = span(b._meshes.find((m) => m.part === 'bolt'));
    assert(Math.abs(hi - L) < 1e-3, `${r.size}×${L}: the tip is at the length, under the head (${hi})`);
    assert(Math.abs(lo + k.k) < 1e-3, `${r.size}×${L}: the head stands its own height above that (${lo})`);
  }
  pick(D.IMP).forEach((ir) => { b.setState({ kind: 'imp', imp: D.IMP.indexOf(ir), impLen: 2 }); check(b, ir.label); });
}

/* ---------- screws: every type, size, fixing and length -------------- */
for (const [Cls, full] of [[K.FsScrewsDesk, true], [K.FsScrewsPhone, false]]) {
  const s = studio(Cls), D = s.D(), pick = sweep(Cls, full);
  for (const type of Object.keys(D.T)) for (const z of pick(s.sizes(type))) for (const L of [6, 150]) {
    s.setState({ type, size: z.key, len: L, into: 'soft' });
    for (const into of s.kit().allowed) {
      s.setState({ into });
      const k = check(s, `${type} ${z.key}×${L} into ${into}`);
      const plug = s._meshes.find((m) => m.part === 'plug');
      if (k.wall && plug) {
        const [lo, hi] = span(plug);
        assert(Math.abs(hi - lo - k.plugLen) < 0.5, `${type} ${z.key}: the plug is drawn its own length (${hi - lo} vs ${k.plugLen})`);
      }
    }
  }
}

/* ---------- anchors: both types, every size, length and fixing ------- */
for (const [Cls, full] of [[K.FsAnchorsDesk, true], [K.FsAnchorsPhone, false]]) {
  const a = studio(Cls), D = a.D(), pick = sweep(Cls, full);
  for (const type of ['sleeve', 'wedge']) for (const z of pick(a.sizes(type))) for (const len of pick(z.lens)) for (const fix of pick(D.FIX)) {
    a.setState({ type, size: z.key, len, fix });
    check(a, `${type} ${z.key}×${len} through ${fix}`);
  }
}

/* ---------- 3. one millimetre is ppm pixels, trued by a card --------- */
{
  const b = new K.FsBoltsDesk({});
  const lv = b.lifeVals();
  // The CSS reference pixel is 1/96 inch, so 96 / 25.4 per millimetre.
  assert(Math.abs(3.7795 - 96 / 25.4) < 1e-4, 'the nominal scale is the CSS reference pixel');
  assert.equal(lv.calW, Math.round(85.6 * 3.7795), 'the calibration box is an ISO/IEC 7810 bank card wide');
  assert.equal(lv.calH, Math.round(53.98 * 3.7795), 'and tall');
  // An orthographic camera W/ppm millimetres wide puts 10 mm at 10·ppm px.
  const W = 834, ppm = 3.7795 * 1.07;
  const P = b._ortho(-W / 2 / ppm, W / 2 / ppm, -200, 200, 1, 1000);
  const px = (x) => (P[0] * x + P[12]) * 0.5 * W;
  assert(Math.abs(px(10) - px(0) - 10 * ppm) < 1e-9, '1:1 draws ten millimetres as ten millimetres');
  // The card's answer is kept per device, and kept sane.
  b.setCal(1.07);
  assert.equal(STORE['fs-life-cal'], '1.07', 'the calibration is remembered on this device');
  assert.equal(new K.FsScrewsPhone({})._cal, 1.07, 'and every board reads it back');
  b.setCal(9); assert.equal(b._cal, 2, 'a runaway calibration is clamped');
  b.setCal(0.1); assert.equal(b._cal, 0.5, 'both ways');
  delete STORE['fs-life-cal'];
}

/* ---------- 4. every hole the markup reads is provided --------------- */
{
  const boards = { boltsDesk: K.FsBoltsDesk, boltsPhone: K.FsBoltsPhone, screwsDesk: K.FsScrewsDesk,
    screwsPhone: K.FsScrewsPhone, anchorsDesk: K.FsAnchorsDesk, anchorsPhone: K.FsAnchorsPhone };
  // What the app adds to every board (fsExtras): the find action, and the
  // size box on the two desktop boards that drew one without wiring it.
  const extras = (key) => ['findStock'].concat(/^(screws|anchors)Desk$/.test(key) ? ['q', 'onQ'] : []);
  let holes = 0;
  for (const [key, Cls] of Object.entries(boards)) {
    const tpl = K.FS_TPL[key];
    const b = new Cls({});
    const vals = Object.assign({}, b.renderVals());
    extras(key).forEach((x) => { vals[x] = true; });
    const loopVars = new Set([...tpl.matchAll(/<sc-for [^>]*as="(\w+)"/g)].map((m) => m[1]).concat(['$index']));
    const missing = [];
    for (const m of tpl.matchAll(/\{\{\s*([\w$.]+)\s*\}\}/g)) {
      const root = m[1].split('.')[0];
      holes++;
      if (root === 'true' || root === 'false' || loopVars.has(root)) continue;
      if (!(root in vals)) { missing.push(m[1]); continue; }
      // A dotted path off a provided object must resolve too.
      let v = vals;
      for (const p of m[1].split('.')) v = v == null ? undefined : v[p];
      if (v === undefined) missing.push(m[1]);
    }
    assert.deepStrictEqual([...new Set(missing)], [], key + ': every hole in the markup is provided by the board');
  }
  console.log(`Fastener studio: ${meshes} meshes (${verts} vertices) across every size, length, type and option, all finite and to scale; 1:1 calibrated; ${holes} template holes all provided.`);
}
