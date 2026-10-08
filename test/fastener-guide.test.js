#!/usr/bin/env node
'use strict';
/*
 * The fastener guide: a printed workshop chart, in code.
 *
 * The shop sells the same screw under two naming systems at once --
 * "Truss Head 4*19" is millimetres, "Black Screws 8* 3/4" is
 * gauge-and-inch -- and this page is the translation, plus the fit
 * questions a fastener counter answers all day: which spanner turns an
 * M10, which nut and washers go on it, which drill passes it, which plug
 * takes a number-10, how deep an anchor has to sit.
 *
 * The page is the owner's design canvas, put on the live site as drawn:
 * three boards (Bolts & nuts, Screws & plugs, Anchors), each with a
 * desktop and a phone design, whose logic classes carry the shop's own
 * tables. Those tables are what the counter reads, so this file pins them
 * the way it pinned the chart before the redesign, two ways at once:
 *
 *   properties   relations that hold across every row -- a tap drill is
 *                the diameter minus the pitch give or take a stock bit,
 *                a washer's bore is wider than its bolt, columns only
 *                ever go up. These catch a row that is wrong RELATIVE to
 *                the physics.
 *   anchors      exact rows written out literally. Properties tolerate
 *                drift -- 2 1/2" sold as 64mm passes every tolerance and
 *                is still not what any shelf says -- so the ladder and
 *                the known-tricky rows are matched exactly.
 *
 * Then what the boards DO with them: a spanner names its bolt, the kit
 * names the nut and washers that go with it, the size boxes read what
 * people type, and an anchor says whether it holds.
 *
 * WHAT CHANGED, and why the old checks are not here. Until the redesign
 * the page was a search box over result cards, four reference charts and
 * an SVG drawing; its router (fgRouteQuery) and card builders were pinned
 * here line by line. The owner replaced that page with the canvas design,
 * which has no result cards -- each board is a converter that the size
 * box drives -- so the router, the cards and the charts went with the
 * page, and their checks with them. The tables did NOT change: the
 * canvas boards carry the same figures the chart printed (METRIC_BOLTS,
 * SCREW_GAUGES, WALL_PLUGS, TRADE_LENGTHS, IMPERIAL_HEX were compared row
 * for row when the boards were carried over), so sections 1-5 below are
 * the chart's own checks, re-pointed at where the figures now live.
 *
 * Run: node test/fastener-guide.test.js   (or: npm test)
 */
const { read, extractFunction, createReporter } = require('./_extract');

const t = createReporter('fastener guide');
const src = read('index.html');

/* The boards' code: the runtime, the classes and the templates, which run
   without a page (nothing in them touches the DOM until mounted). The
   glue that mounts them is read function by function. */
const from = src.indexOf('class FsLogic {');
const to = src.indexOf('const FS_PAGES = {');
t.check(from > 0 && to > from, 'the guide’s boards are found, ahead of the glue that mounts them');
const STORE = {};
const fakeWindow = { localStorage: { getItem: (k) => (k in STORE ? STORE[k] : null), setItem: (k, v) => { STORE[k] = String(v); } } };
const K = new Function('window', src.slice(from, to) + `
  ${['fsFindTerm', 'fsInchesOf', 'fsScrewsQuery', 'fsAnchorsQuery'].map((n) => extractFunction(src, n, 'index.html')).join('\n')}
  return { FsLogic, FsStudio, FsBolts, FsBoltsDesk, FsBoltsPhone, FsScrews, FsScrewsDesk, FsScrewsPhone,
    FsAnchors, FsAnchorsDesk, FsAnchorsPhone, FS_TPL, fsFindTerm, fsScrewsQuery, fsAnchorsQuery };`)(fakeWindow);

/* A board outside a page: state merges at once, nothing renders. */
const board = (Cls) => { const b = new Cls({}); b.renderVals(); return b; };
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const inc = (arr, msg) => t.check(arr.every((v, i) => i === 0 || v > arr[i - 1]), `${msg} strictly increases`);
const B = board(K.FsBoltsDesk), S = board(K.FsScrewsDesk), A = board(K.FsAnchorsDesk);
const BD = B.D(), SD = S.D(), AD = A.D();

/* ---------- 1. the bolt chart holds together --------------------------- */
{
  const M = BD.M;
  eq(M.length, 15, 'fifteen metric sizes, M3 to M30');
  inc(M.map((r) => r.dia), 'bolt diameter');
  inc(M.map((r) => r.afIso), 'ISO across-flats');
  inc(M.map((r) => r.afDin), 'DIN across-flats');
  t.check(M.every((r) => r.fine.every((f) => f < r.pitch)),
    'every fine pitch is finer than the coarse one');
  /* Tap drill = dia − pitch, ROUNDED TO A STOCK BIT: M8's exact figure
     is 6.75 and no shop sells a 6.75mm bit. So a tolerance, not an
     equation -- but a tight one, because a tap drill a half-millimetre
     out strips the thread it was meant to cut. */
  t.check(M.every((r) => Math.abs(r.tap - (r.dia - r.pitch)) <= 0.1 && r.tap < r.dia),
    'every tap drill is diameter minus pitch, give or take a stock bit');
  t.check(M.every((r) => r.clear > r.dia && r.clear <= r.dia + 3),
    'every clearance drill passes its bolt without wallowing');
  t.check(M.every((r) => r.wId > r.dia && r.wOd > r.wId && r.wT > 0),
    'every flat washer goes over its own bolt and is wider than its bore');
  t.check(M.every((r) => r.spId > r.dia && r.spB > r.spS && r.spS > 0),
    'every spring washer goes over its own bolt, and its section is wider than it is thick');
  t.check(M.every((r) => r.afIso > r.dia && r.afDin > r.dia),
    'every spanner flat is wider than the thread it turns');
  t.check(M.every((r) => r.k < r.dia && r.m < r.dia && r.m > r.k * 0.9),
    'every head and nut is shorter than the bolt is wide, and a nut is about a head');
  t.check(M.every((r) => r.size === 'M' + r.dia),
    'the name and the diameter agree on every row');

  /* The DIN/ISO split, exactly: these four sizes -- and ONLY these four
     -- take different spanners under the two standards, and M22 is the
     one where ISO is the BIGGER of the pair. Both circulate here, so a
     swapped cell hands somebody the wrong spanner with confidence. */
  const split = M.filter((r) => r.afIso !== r.afDin).map((r) => `${r.size}:${r.afIso}/${r.afDin}`);
  eq(JSON.stringify(split), JSON.stringify(['M10:16/17', 'M12:18/19', 'M14:21/22', 'M22:34/32']),
    'ISO and DIN disagree at exactly the four known sizes, the known way round');

  // The whole M8 row, the size a furniture-hardware counter sells most.
  const m8 = M.find((r) => r.size === 'M8');
  eq(JSON.stringify(m8), JSON.stringify({ size: 'M8', dia: 8, pitch: 1.25, fine: [1], afIso: 13, afDin: 13,
    wId: 8.4, wOd: 16, wT: 1.6, tap: 6.8, clear: 9, k: 5.3, m: 6.8, spB: 3, spS: 2, spId: 8.2 }), 'the M8 row is exactly right');
  eq(JSON.stringify(B.D()), JSON.stringify(board(K.FsBoltsPhone).D()), 'and the phone board reads the very same chart');
}

/* ---------- 2. the screw chart ----------------------------------------- */
{
  const G = SD.G;
  inc(G.map((r) => r.gauge), 'gauge');
  inc(G.map((r) => r.dia), 'screw diameter');
  t.check(G.every((r) => r.pilotSoft < r.pilotHard && r.pilotHard < r.dia && r.dia < r.clear),
    'pilot soft < pilot hard < diameter < clearance, on every gauge');
  eq(G.find((r) => r.gauge === 8).dia, 4.2, 'a number-8 is the 4.2');
  t.check(G.every((r) => SD.P.some((p) => p.size === r.plugMm)),
    'every gauge pairs with a plug that exists in the plug table');
  /* Coach screws are sized by the bolt chart's own clearance holes and
     DIN 571 spanners, and their plug comes from the plug table's own
     millimetre ranges -- not a second guess at either. */
  t.check(SD.C.every((c) => { const r = BD.M.find((m) => m.dia === c[0]); return r && r.clear === c[4]; }),
    'every coach screw clears through the bolt chart’s own clearance hole');
  t.check(S.sizes('coach').every((z) => z.plugMm == null || SD.P.some((p) => p.size === z.plugMm && p.mmMin <= z.dia && z.dia <= p.mmMax)),
    'and takes the plug whose range covers it, or none');
}

/* ---------- 3. the trade ladder, exactly ------------------------------- */
{
  const L = BD.TRADE;
  inc(L.map((r) => r[0]), 'ladder inches');
  inc(L.map((r) => r[2]), 'ladder millimetres');
  t.check(L.every((r) => Math.abs(r[0] * 25.4 - r[2]) <= 2.5),
    'every trade rounding stays within the trade’s own tolerance');
  /* And the ladder itself, literally. The tolerance above would happily
     accept 2 1/2" sold as 64 -- which passes the arithmetic and matches
     no shelf on earth. The convention IS the data, so it is pinned as
     written. */
  eq(L.map((r) => `${r[1]}=${r[2]}`).join(' '),
    '1/4″=6 3/8″=10 1/2″=13 5/8″=16 3/4″=19 7/8″=22 1″=25 1 1/4″=32 1 1/2″=38 1 3/4″=45 2″=50 2 1/2″=65 3″=75 3 1/2″=90 4″=100 5″=125 6″=150',
    'the whole ladder reads exactly as the shelf does');
  eq(JSON.stringify(SD.TRADE), JSON.stringify(L), 'and the screws board reads the same ladder as the bolts board');
  /* The ladder read the other way. 50mm is a two-inch screw on every
     shelf; the nearest sixteenth calls it 1 15/16, which is closer
     arithmetically and is a thing nobody has ever asked for. */
  eq(S.inchName(50), '2″', '50mm is named by the rung it is sold as');
  eq(S.inchName(32), '1 1/4″', 'and so is 32');
  eq(S.inchName(51), '≈2″', 'a figure that is not a rung is marked as the nearest sixteenth, not given one');
}

/* ---------- 4. plugs ---------------------------------------------------- */
{
  t.check(SD.P.every((r) => r.drill === r.size),
    'the masonry drill is the plug size, on every plug -- that is the one fact that stops a wobble');
  t.check(SD.P.every((r) => r.gMin == null || (r.gMin <= r.gMax
      && SD.G.some((g) => g.gauge === r.gMin) && SD.G.some((g) => g.gauge === r.gMax))),
    'every stated gauge range exists in the screw chart, and none is stretched past it');
  t.check(SD.P.every((r) => r.mmMin < r.mmMax), 'every screw range is a range');
  t.check(SD.P.every((r) => r.colour in SD.INK), 'and every plug colour has the ink it is drawn in');
}

/* ---------- 5. imperial hex -------------------------------------------- */
{
  const H = BD.IMP;
  inc(H.map((r) => r.inch), 'imperial thread');
  inc(H.map((r) => r.af), 'imperial across-flats');
  // The stored mm must BE the stored fraction: parse the label back and
  // multiply out, so the two columns cannot quietly disagree.
  t.check(H.every((r) => Math.abs(B.parseIn(r.afLabel) * 25.4 - r.af) <= 0.02),
    'every AF millimetre figure is its own fraction times 25.4');
  t.check(H.every((r) => /^\d+ mm/.test(r.note)),
    'every row answers the real question: which metric spanner');
  /* And that answer is what the spanner rack leads with, so a rung the
     note names turns the inch bolt -- 11 is the 1/4", 14 the 3/8". */
  t.check(H.every((r, i) => B.impForAf(parseFloat(r.note)) === i),
    'every metric spanner a note names finds its own inch bolt');
}

/* ---------- 6. spanner to bolt, and back ------------------------------- */
{
  const b = board(K.FsBoltsDesk);
  b.pickAf(17);
  eq(`${b.state.size} ${b.state.std} ${b.state.kind}`, 'M10 DIN met', 'a 17 spanner is the DIN M10 -- and says so');
  b.pickAf(16);
  eq(`${b.state.size} ${b.state.std}`, 'M10 ISO', 'while 16 is the ISO M10');
  b.pickAf(13);
  eq(`${b.state.size} ${b.state.std}`, 'M8 DIN', 'a 13 is the M8, under both standards');
  b.pickAf(11);
  eq(`${b.state.kind} ${BD.IMP[b.state.imp].label}`, 'imp 1/4″', 'an 11 turns no metric bolt, but it turns a 1/4″');
  b.pickAf(17); b.pickStd('ISO');
  eq(b.state.af, 16, 'switching the M10 to an ISO head moves the spanner to 16');
  t.check(BD.RACK.every((af, i) => i === 0 || af > BD.RACK[i - 1]), 'the spanner rack runs smallest to largest');
  t.check(BD.M.every((r) => BD.RACK.includes(r.afIso) && BD.RACK.includes(r.afDin)),
    'and holds every spanner the metric chart names, under both standards');
}

/* ---------- 7. the size box reads what people type --------------------- */
{
  const q = (v) => { const b = board(K.FsBoltsDesk); b.query(v); return b; };
  eq(q('M12').state.size, 'M12', '"M12" picks the M12');
  eq(q('m 16').state.size, 'M16', 'in any case, with a space');
  eq(q('17').state.af, 17, 'a bare number on the rack is a spanner');
  eq(q('15').state.af, 17, 'and one that is not on the rack changes nothing');
  const tq = q('3/8"');
  eq(`${tq.state.mode} ${BD.IMP[tq.state.imp].label}`, 'inch 3/8″', 'an inch fraction that is a UNC thread opens it in inches');
  const one = q('1 1/2 in');
  eq(`${one.state.inch} ${one.state.mmTxt}`, '1.5 38.10', 'a spoken length converts exactly');
  eq(q('xyzzy').state.size, 'M10', 'and garbage leaves the board where it was');
  eq(B.frac(0.375), '3/8', 'fractions come back reduced');
  eq(B.frac(1.5), '1 1/2', 'and mixed');
  eq(B.parseIn('1-1/2'), 1.5, 'the hyphenated form parses too');
}

/* ---------- 8. any length, not only the chips -------------------------- */
{
  /* The owner asked to test lengths past the old 100 mm stop: the slider
     is logarithmic from 6 to 400 mm (a quarter-inch to 16″ in inch mode)
     and the box takes any figure in that range. */
  eq(JSON.stringify(B.lenRange(false)), '[6,400]', 'metric lengths run 6 to 400 mm');
  eq(JSON.stringify(B.lenRange(true)), '[0.25,16]', 'inch lengths a quarter-inch to sixteen');
  t.check(BD.LEN_M.every((L) => B.posToLen(B.lenToPos(L, false), false) === L),
    'every common metric length survives the slider round trip');
  t.check(BD.LEN_I.every((L) => B.posToLen(B.lenToPos(L, true), true) === L),
    'and every common inch length');
  const b = board(K.FsBoltsDesk);
  b.setLen(1000, false); eq(b.state.len, 400, 'a length past the end stops at 400');
  b.setLen(275, false); eq(b.state.len, 275, 'and anything in range is kept as typed');
  b.stepLen(1, false); eq(b.state.len, 280, 'the + steps to the next 5 mm');
  b.stepLen(-1, false); eq(b.state.len, 275, 'and − back');
}

/* ---------- 9. what goes with it --------------------------------------- */
{
  const b = board(K.FsBoltsDesk);
  b.pickAf(17); b.setLen(50, false);
  let k = b.kit();
  eq(k.title, 'M10 × 50', 'the kit is named as the shelf names it');
  eq(`${k.af}/${k.nutAf}`, '17/17', 'its nut takes the same spanner as its head');
  eq(`${k.wId} × ${k.wOd} × ${k.wT}`, '10.5 × 20 × 2', 'its flat washer is the chart’s ISO 7089 M10');
  eq(`${k.clear}/${k.tap}`, '11/8.5', 'and its drills are the chart’s clearance and tap');
  t.check(k.full && k.b === k.L, 'the bolt is threaded head to tip, as the owner asked');
  b.setState({ nut: 'nyloc' });
  eq(b.kit().m, 10, 'a nyloc nut is drawn a bolt-diameter tall');
  b.setState({ pitchIdx: 1 });
  k = b.kit();
  eq(`${k.p} ${k.tap}`, '1.25 8.8', 'a fine pitch brings its own tap drill');
  /* The inch bolt borrows the first metric washer that goes over it and
     keeps its own spanner sizes. */
  b.pickImp(0);
  k = b.kit();
  t.check(k.imp && k.wId >= k.d && k.af === BD.IMP[0].af, 'a 1/4″ bolt gets a washer that clears it and its own spanner');
  t.check(BD.IMP.every((ir, i) => { b.pickImp(i); const x = b.kit(); return x.wId >= x.d + 0.05; }),
    'and so does every inch bolt on the chart');
}

/* ---------- 10. screws: what each one goes into ------------------------ */
{
  const s = board(K.FsScrewsDesk);
  /* The owner's correction, pinned: truss head screws are self-drilling,
     so they go into metal (and only drill their own hole), as do the
     roofing hex screws. */
  s.pickType('truss');
  eq(s.kit().into, 'metal', 'a truss head screw starts in metal -- it drills its own hole');
  t.check(s.kit().drillPt, 'and is drawn with a drill point');
  s.pickType('hexsd');
  eq(JSON.stringify(s.kit().allowed), '["metal","soft","hard"]', 'a roofing hex screw never goes in a wall plug');
  t.check(s.sizes('hexsd').every((z) => z.gauge >= 10 && z.af), 'and comes in #10 to #14, each with its socket');
  s.pickType('black'); s.setState({ thread: 'fine' });
  let k = s.kit();
  t.check(/ fine$/.test(k.shelf) && Math.abs(k.p - k.d * 0.4) < 1e-9, 'black screws come fine-threaded, and say so on the shelf');
  s.setState({ thread: 'coarse' });
  k = s.kit();
  t.check(!/fine/.test(k.shelf) && Math.abs(k.p - k.d * 0.75) < 1e-9, 'or coarse');
  s.pickType('csk'); s.setState({ size: 'g10', into: 'wall' });
  k = s.kit();
  eq(`${k.plug.size} ${k.bitD}`, '7 7', 'a #10 into a wall takes the 7 plug and the 7 masonry bit');
  s.setState({ into: 'hard' });
  eq(s.kit().bitD, 3.5, 'and into hardwood, the hardwood pilot');
  s.pickType('coach'); s.setState({ size: 'c12', into: 'wall' });
  k = s.kit();
  eq(k.into, 'soft', 'a coach screw no plug fits is not offered a wall');
  eq(s.kit().drive, '19 mm', 'and is driven by its own socket');
}

/* ---------- 11. anchors: does it hold ---------------------------------- */
{
  const a = board(K.FsAnchorsDesk);
  /* What sits outside the concrete is the bracket plus the washer, the
     nut and a thread's pitch past it; the rest is in the wall, and it
     must reach the minimum: 4.5 sleeve diameters, or 6 bolt diameters
     for a wedge anchor. */
  a.setState({ type: 'sleeve', size: 'e10', len: 80, fix: 10 });
  let k = a.kit();
  // The 10 mm sleeve carries an M8 stud: its washer, nut and pitch are the M8's.
  t.check(Math.abs(k.embed - (80 - 10 - (1.6 + 6.8 + 1.25))) < 1e-9, `a 10 × 80 through a 10 mm bracket sits 60.35 mm in the concrete (got ${k.embed})`);
  eq(k.minEmbed, 45, 'and needs 45');
  eq(k.verdict, 'ok', 'so it holds');
  eq(k.holeDepth, 65, 'drilled 5 past the sleeve');
  eq(k.fixHole, 11, 'through a bracket hole one over the drill');
  a.setState({ len: 60 });
  k = a.kit();
  eq(`${k.verdict} ${k.better}`, 'warn 80', 'a 10 × 60 is too shallow, and the board names the length that is not');
  a.setState({ fix: 40, len: 45 });
  eq(a.kit().verdict, 'bad', 'and one that does not reach the wall at all says so');
  a.setState({ type: 'wedge', size: 'w12', len: 100, fix: 10 });
  k = a.kit();
  eq(`${k.minEmbed} ${k.fixHole} ${k.holeDepth}`, '72 13.5 93', 'a wedge anchor wants 6 diameters, the bolt chart’s clearance, and 1.5 diameters past');
  t.check(Object.keys(AD.M).every((d) => { const r = BD.M.find((m) => m.dia === +d); return r && r.afDin === AD.M[d].af && r.wOd === AD.M[d].wOd && r.clear === AD.M[d].clear; }),
    'every anchor’s nut, washer and clearance are the bolt chart’s own');
}

/* ---------- 12. the size boxes the app wired --------------------------- */
{
  /* The screws and anchors boards drew a size box with an example in it
     and no wiring. These read exactly the shapes their examples show. */
  const sq = (v, type) => { const s = board(K.FsScrewsDesk); if (type) s.pickType(type); K.fsScrewsQuery(s, v); return s; };
  let s = sq('8 × 3/4″');
  eq(`${s.state.size} ${s.state.len}`, 'g8 19', '"8 × 3/4″" is a number-8 three-quarters long, sold as 19');
  s = sq('4 × 30');
  eq(`${s.state.type} ${s.state.size} ${s.state.len}`, 'gold g8 30', '"4 × 30" is the 4 mm chipboard screw, 30 long');
  s = sq('#10', 'coach');
  eq(`${s.state.type} ${s.state.size}`, 'csk g10', 'a gauge typed on the coach board moves to a screw sold by gauge');
  s = sq('6 × 50', 'gold');
  eq(s.state.size, 'g14', 'the 6.3 is the 6, as the shelf names it -- not the 5.5');
  s = sq('6 mm plug');
  // The 6 plug takes #6 to #10; the board opens the size whose own plug it is.
  eq(`${s.state.size} ${s.state.into}`, 'g8 wall', '"6 mm plug" opens the screw it is the plug for, going into a wall');
  s = sq('nonsense');
  eq(s.state.size, 'g8', 'and anything else leaves the board where it was');

  const aq = (v) => { const a = board(K.FsAnchorsDesk); K.fsAnchorsQuery(a, v); return a; };
  let a = aq('M12 × 100');
  eq(`${a.state.type} ${a.state.size} ${a.state.len}`, 'wedge w12 100', '"M12 × 100" is the wedge anchor');
  a = aq('10 × 60');
  eq(`${a.state.type} ${a.state.size} ${a.state.len}`, 'sleeve e10 60', '"10 × 60" is the expansion bolt');
  a = aq('16 mm');
  eq(`${a.state.type} ${a.state.size}`, 'sleeve e16', '"16 mm" is the sleeve that size');
  a = aq('12 × 63');
  eq(a.state.len, 75, 'a length the anchor is not sold in snaps to the nearest it is');

  /* "Find … in stock" searches the catalogue for the token the shop's own
     names carry: the size, not the whole kit title, because the Products
     box matches every word it is given. */
  eq(K.fsFindTerm(board(K.FsBoltsDesk)), 'M10', 'the bolt board finds its size');
  const ib = board(K.FsBoltsDesk); ib.pickImp(2); ib.renderVals();
  eq(K.fsFindTerm(ib), '3/8', 'an inch bolt by its fraction');
  eq(K.fsFindTerm(board(K.FsScrewsDesk)), '4*', 'a gold screw by its millimetre name');
  const cs = board(K.FsScrewsDesk); cs.pickType('csk'); cs.renderVals();
  eq(K.fsFindTerm(cs), '8*', 'a countersunk screw by its gauge');
  eq(K.fsFindTerm(board(K.FsAnchorsDesk)), 'M8', 'and an anchor by its stud');
}

/* ---------- 13. the page is wired, not merely defined ------------------ */
{
  const stripped = src
    .replace(/(?<![\w"'])\/\*[\s\S]*?\*\//g, ' ')
    .split(/\r?\n/).map((l) => l.replace(/(?<![:"'])\/\/.*$/, '')).join('\n');
  t.check(/<section id="tab-fasteners"[^>]*>\s*<div id="fg_host"><\/div>\s*<\/section>/.test(stripped),
    'the section exists, and the boards mount into it');
  t.check(/data-tab="fasteners"[^>]*data-keywords="[^"]*spanner/.test(stripped),
    'the rail button exists and nav search will find "spanner"');
  /* The phone sheet is generated from the rail (mmsRenderDestinations
     walks NAV_INDEX), so a rail entry IS a phone entry -- there is no
     second list to add it to. */
  t.check(!/class="mms-item" data-tab=/.test(stripped),
    'and the phone sheet carries it by being generated from that rail, not by a second copy');
  t.check(/if\(tab==='fasteners'\) renderFasteners\(\);/.test(stripped), 'entering the tab renders it');
  t.check(/if\(tab!=='fasteners'\) fsSleep\(\);/.test(stripped),
    'and leaving it stops the 3D loop, rather than drawing to a hidden canvas sixty times a second');
  t.check(/getElementById\('tab-fasteners'\)\.addEventListener\('click'/.test(stripped) && /data-fs-go/.test(stripped),
    'one delegated listener moves between the three boards');
  t.check(/const fsPhoneMq = window\.matchMedia\('\(max-width: 820px\)'\);/.test(stripped),
    'and the phone design is switched in at 820px, not reflowed');
  t.check(/goToTab\('products'\);\s*\r?\n\s*triggerProductsRender\(\);/.test(stripped),
    'find-in-stock jumps AND renders -- goToTab’s chain has no products line');
  t.check(/getElementById\('p_category_filter'\)\.value = '';/.test(stripped),
    'and clears the category filter so the hits it promises are not hidden by one');

  /* Six boards, each with the canvas's own chrome taken off: the app's
     rail, top bar and phone bars frame them instead, and a second copy of
     any would be a second navigation that goes nowhere. */
  const keys = ['boltsDesk', 'boltsPhone', 'screwsDesk', 'screwsPhone', 'anchorsDesk', 'anchorsPhone'];
  eq(JSON.stringify(Object.keys(K.FS_TPL)), JSON.stringify(keys), 'all six boards are carried');
  keys.forEach((key) => {
    const tpl = K.FS_TPL[key];
    t.check(!/aria-label="Main"/.test(tpl) && !/<header\b/.test(tpl) && !/<main\b/.test(tpl),
      `${key}: carries none of the canvas’s chrome`);
    t.check(/onClick="\{\{ findStock \}\}"/.test(tpl), `${key}: its one action finds the kit in stock`);
    t.check(!/\.dc\.html/.test(tpl) && (tpl.match(/data-fs-go="(bolts|screws|anchors)"/g) || []).length === 3,
      `${key}: links to the three boards, not to canvas files`);
    t.check((tpl.match(/<button[^>]*class="ow-fs-ox"/g) || []).length <= 1 && (tpl.match(/background: #C93A30/g) || []).length === 1,
      `${key}: one accent, on the one primary action`);
  });
  ['boltsDesk', 'screwsDesk', 'anchorsDesk'].forEach((key) => {
    t.check(/<input class="ow-fs-mono" type="text" value="\{\{ q \}\}" onInput="\{\{ onQ \}\}"/.test(K.FS_TPL[key]),
      `${key}: its size box is wired`);
  });
}

process.exit(t.done() ? 1 : 0);
