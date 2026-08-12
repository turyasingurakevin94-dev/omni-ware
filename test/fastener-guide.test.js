#!/usr/bin/env node
'use strict';
/*
 * The fastener guide: a printed workshop chart, in code.
 *
 * The shop sells the same screw under two naming systems at once --
 * "Truss Head 4*19" is millimetres, "Black Screws 8* 3/4" is
 * gauge-and-inch -- and this page is the translation, plus the fit
 * questions a fastener counter answers all day: which spanner turns an
 * M8 nut, which drill passes an M8 bolt, which plug takes a number-10.
 *
 * A wrong number here sells someone the wrong drill bit, so this file
 * pins the chart two ways at once:
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
 * And the search box's honesty: a bare "13" genuinely means several
 * things at a fastener counter, so the router must return several
 * interpretations rather than guess -- and "8mm" must never be read as
 * a bolt called M8.
 *
 * Run: node test/fastener-guide.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('fastener guide');
const src = read('index.html');

const scope = compileScope([
  extractDeclaration(src, 'METRIC_BOLTS', 'index.html'),
  extractDeclaration(src, 'SCREW_GAUGES', 'index.html'),
  extractDeclaration(src, 'TRADE_LENGTHS', 'index.html'),
  extractDeclaration(src, 'WALL_PLUGS', 'index.html'),
  extractDeclaration(src, 'RIVETS', 'index.html'),
  extractDeclaration(src, 'IMPERIAL_HEX', 'index.html'),
  extractFunction(src, 'fgGcd', 'index.html'),
  extractFunction(src, 'fgParseFraction', 'index.html'),
  extractFunction(src, 'fgParseLengthInput', 'index.html'),
  extractFunction(src, 'fgInchToMm', 'index.html'),
  extractFunction(src, 'fgMmToInch', 'index.html'),
  extractFunction(src, 'fgNearestFraction', 'index.html'),
  extractFunction(src, 'fgTradeMm', 'index.html'),
  extractFunction(src, 'fgGaugeToMm', 'index.html'),
  extractFunction(src, 'fgMmToGauge', 'index.html'),
  extractFunction(src, 'fgSpannerForBolt', 'index.html'),
  extractFunction(src, 'fgBoltsForSpanner', 'index.html'),
  extractFunction(src, 'fgRouteQuery', 'index.html'),
  extractFunction(src, 'fgBias', 'index.html'),
], {}, ['fgParseFraction', 'fgParseLengthInput', 'fgInchToMm', 'fgMmToInch', 'fgNearestFraction',
  'fgTradeMm', 'fgGaugeToMm', 'fgMmToGauge', 'fgSpannerForBolt', 'fgBoltsForSpanner', 'fgRouteQuery', 'fgGcd']);

// Re-extract the literals for direct row access.
/* eslint-disable no-eval */
const T = new Function(
  [ 'METRIC_BOLTS', 'SCREW_GAUGES', 'TRADE_LENGTHS', 'WALL_PLUGS', 'RIVETS', 'IMPERIAL_HEX' ]
    .map((n) => extractDeclaration(src, n, 'index.html')).join('\n')
  + '\nreturn {METRIC_BOLTS, SCREW_GAUGES, TRADE_LENGTHS, WALL_PLUGS, RIVETS, IMPERIAL_HEX};'
)();
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const inc = (arr, msg) => t.check(arr.every((v, i) => i === 0 || v > arr[i - 1]), `${msg} strictly increases`);

/* ---------- 1. the bolt chart holds together --------------------------- */
{
  const B = T.METRIC_BOLTS;
  inc(B.map((r) => r.dia), 'bolt diameter');
  inc(B.map((r) => r.afIso), 'ISO across-flats');
  inc(B.map((r) => r.afDin), 'DIN across-flats');
  t.check(B.every((r) => r.fine.every((f) => f < r.pitch)),
    'every fine pitch is finer than the coarse one');
  /* Tap drill = dia − pitch, ROUNDED TO A STOCK BIT: M8's exact figure
     is 6.75 and no shop sells a 6.75mm bit. So a tolerance, not an
     equation -- but a tight one, because a tap drill a half-millimetre
     out strips the thread it was meant to cut. */
  t.check(B.every((r) => Math.abs(r.tapDrill - (r.dia - r.pitch)) <= 0.1 && r.tapDrill < r.dia),
    'every tap drill is diameter minus pitch, give or take a stock bit');
  t.check(B.every((r) => r.clearDrill > r.dia && r.clearDrill <= r.dia + 3),
    'every clearance drill passes its bolt without wallowing');
  t.check(B.every((r) => r.washerId > r.dia && r.washerOd > r.washerId && r.washerT > 0),
    'every washer goes over its own bolt and is wider than its bore');
  t.check(B.every((r) => r.afIso > r.dia && r.afDin > r.dia),
    'every spanner flat is wider than the thread it turns');
  t.check(B.every((r) => r.size === 'M' + r.dia),
    'the name and the diameter agree on every row');

  /* The DIN/ISO split, exactly: these four sizes -- and ONLY these four
     -- take different spanners under the two standards, and M22 is the
     one where ISO is the BIGGER of the pair. Both circulate here, so a
     swapped cell hands somebody the wrong spanner with confidence. */
  const split = B.filter((r) => r.afIso !== r.afDin).map((r) => `${r.size}:${r.afIso}/${r.afDin}`);
  eq(JSON.stringify(split), JSON.stringify(['M10:16/17', 'M12:18/19', 'M14:21/22', 'M22:34/32']),
    'ISO and DIN disagree at exactly the four known sizes, the known way round');

  // The whole M8 row, the size a furniture-hardware counter sells most.
  const m8 = B.find((r) => r.size === 'M8');
  eq(JSON.stringify(m8), JSON.stringify({ size:'M8', dia:8, pitch:1.25, fine:[1], afIso:13, afDin:13,
    washerId:8.4, washerOd:16, washerT:1.6, tapDrill:6.8, clearDrill:9 }), 'the M8 row is exactly right');
}

/* ---------- 2. the screw chart ----------------------------------------- */
{
  const S = T.SCREW_GAUGES;
  inc(S.map((r) => r.gauge), 'gauge');
  inc(S.map((r) => r.dia), 'screw diameter');
  t.check(S.every((r) => r.pilotSoft < r.pilotHard && r.pilotHard < r.dia && r.dia < r.clearDrill),
    'pilot soft < pilot hard < diameter < clearance, on every gauge');
  eq(scope.fgGaugeToMm(8), 4.2, 'a number-8 is the 4.2');
  t.check(S.every((r) => scope.fgMmToGauge(scope.fgGaugeToMm(r.gauge)).gauge === r.gauge),
    'gauge -> mm -> gauge round-trips on every row');
  t.check(S.every((r) => T.WALL_PLUGS.some((p) => p.size === r.plugMm)),
    'every gauge pairs with a plug that exists in the plug table');

  // The catalogue's own translation: "Truss Head 4*13" is a 4mm
  // chipboard screw, which is a number-8 by the trade's own rounding.
  const four = scope.fgMmToGauge(4);
  eq(four.gauge, 8, 'the catalogue’s 4* chipboard naming reads as a number-8');
  eq(four.exact, false, 'and is flagged as the rounding it is, not an exact match');
  eq(scope.fgMmToGauge(4.2).exact, true, 'while 4.2 IS the number-8, exactly');
  eq(scope.fgMmToGauge(20), null, 'a diameter nowhere near the chart claims no gauge at all');
  /* And one just past the window, not merely far away: 6.9 sits 0.6 off
     the number-14, within a doubled window but outside the honest one.
     A 7mm coach screw is not a number-14, and a widened window would
     say it is. */
  eq(scope.fgMmToGauge(6.9), null, 'a diameter between the chart and nowhere claims nothing');
}

/* ---------- 3. the trade ladder, exactly ------------------------------- */
{
  const L = T.TRADE_LENGTHS;
  inc(L.map((r) => r.inch), 'ladder inches');
  inc(L.map((r) => r.tradeMm), 'ladder millimetres');
  t.check(L.every((r) => Math.abs(r.inch * 25.4 - r.tradeMm) <= 2.5),
    'every trade rounding stays within the trade’s own tolerance');
  /* And the ladder itself, literally. The tolerance above would happily
     accept 2 1/2" sold as 64 -- which passes the arithmetic and matches
     no shelf on earth. The convention IS the data, so it is pinned as
     written. */
  const ladder = L.map((r) => `${r.inchLabel}=${r.tradeMm}`).join(' ');
  eq(ladder, '1/4"=6 3/8"=10 1/2"=13 5/8"=16 3/4"=19 7/8"=22 1"=25 1 1/4"=32 1 1/2"=38 1 3/4"=45 2"=50 2 1/2"=65 3"=75 3 1/2"=90 4"=100 5"=125 6"=150',
    'the whole ladder reads exactly as the shelf does');
  eq(scope.fgTradeMm(1.5).tradeMm, 38, 'an inch-and-a-half is sold as 38');
  eq(scope.fgTradeMm(0.9), null, 'and 0.9" is not quietly called an inch');
}

/* ---------- 4. plugs and rivets ---------------------------------------- */
{
  t.check(T.WALL_PLUGS.every((r) => r.drill === r.size),
    'the masonry drill is the plug size, on every plug -- that is the one fact that stops a wobble');
  t.check(T.WALL_PLUGS.every((r) => r.gaugeMin == null || (r.gaugeMin <= r.gaugeMax
      && T.SCREW_GAUGES.some((g) => g.gauge === r.gaugeMin) && T.SCREW_GAUGES.some((g) => g.gauge === r.gaugeMax))),
    'every stated gauge range exists in the screw chart, and none is stretched past it');
  t.check(T.WALL_PLUGS.every((r) => r.screwMmMin < r.screwMmMax),
    'every screw range is a range');
  t.check(T.RIVETS.every((r) => r.drill - r.dia >= 0.05 && r.drill - r.dia <= 0.15),
    'every rivet drill is a whisker over the body -- seats without spinning');
  inc(T.RIVETS.map((r) => r.dia), 'rivet diameter');
}

/* ---------- 5. imperial hex -------------------------------------------- */
{
  const H = T.IMPERIAL_HEX;
  inc(H.map((r) => r.threadIn), 'imperial thread');
  inc(H.map((r) => r.afMm), 'imperial across-flats');
  // The stored mm must BE the stored fraction: parse the label back and
  // multiply out, so the two columns cannot quietly disagree.
  t.check(H.every((r) => Math.abs(scope.fgParseFraction(r.afLabel.replace(/"/g, '')) * 25.4 - r.afMm) <= 0.02),
    'every AF millimetre figure is its own fraction times 25.4');
  t.check(H.every((r) => /\d+ ?mm/.test(r.metricNote)),
    'every row answers the real question: which metric spanner');
}

/* ---------- 6. parsing what people actually type ----------------------- */
{
  const P = scope.fgParseFraction;
  eq(P('1 1/2'), 1.5, 'a spoken fraction parses');
  eq(P('1-1/2'), 1.5, 'and the hyphenated form');
  eq(P('1½'), 1.5, 'and the phone-keyboard ½');
  eq(P('3/8'), 0.375, 'and a bare fraction');
  eq(P('1.5'), 1.5, 'and a decimal');
  eq(P('1/0'), null, 'a zero denominator is nonsense, not zero');
  eq(P('abc'), null, 'and letters are not a length');

  const L = scope.fgParseLengthInput;
  eq(JSON.stringify(L('38')), JSON.stringify({ value:38, unit:null }), 'a bare number claims no unit');
  eq(JSON.stringify(L('38mm')), JSON.stringify({ value:38, unit:'mm' }), '38mm claims millimetres');
  eq(JSON.stringify(L('38 mm')), JSON.stringify({ value:38, unit:'mm' }), 'with a space too');
  eq(JSON.stringify(L('1 1/2')), JSON.stringify({ value:1.5, unit:'in' }),
    'a bare fraction is inches -- nobody says three-eighths of a millimetre');
  eq(JSON.stringify(L('1.5"')), JSON.stringify({ value:1.5, unit:'in' }), 'the inch mark claims inches');
  eq(L('1,5'), null, 'a comma is rejected outright -- decimal to some hands, thousands to others');
  eq(L('0'), null, 'zero is not a size');
  eq(L(''), null, 'and neither is nothing');
}

/* ---------- 7. exactness of the one conversion ------------------------- */
{
  eq(scope.fgInchToMm(1), 25.4, 'an inch is 25.4 millimetres, exactly');
  t.check(Math.abs(scope.fgMmToInch(scope.fgInchToMm(7.3)) - 7.3) < 1e-9, 'and the round trip loses nothing');

  /* Sweep the workshop range: every half-millimetre from 1 to 160. The
     nearest sixteenth must stay within a thirty-second, arrive reduced
     (24/16 is not an answer anyone says), and re-parse to itself. */
  let bad = 0;
  for(let mm = 1; mm <= 160; mm += 0.5){
    const f = scope.fgNearestFraction(scope.fgMmToInch(mm), 16);
    if(Math.abs(f.errorIn) > 1 / 32 + 1e-9){ bad++; t.fail(`${mm}mm: error ${f.errorIn}" exceeds 1/32"`); }
    if(scope.fgGcd(f.num, f.den) !== 1 && f.num !== 0){ bad++; t.fail(`${mm}mm: ${f.num}/${f.den} is not reduced`); }
    const back = scope.fgParseFraction(f.label);
    if(back == null || Math.abs(back - f.num / f.den) > 1e-9){ bad++; t.fail(`${mm}mm: label ${JSON.stringify(f.label)} does not re-parse to ${f.num}/${f.den}`); }
  }
  if(!bad) t.pass('every half-millimetre from 1 to 160 rounds to a reduced, re-parseable sixteenth within 1/32" (319 cases)');
  const f38 = scope.fgNearestFraction(scope.fgMmToInch(38), 16);
  eq(f38.label, '1 1/2', '38mm reads as the inch-and-a-half it is sold as');
  t.check(Math.abs(f38.errorMm - (-0.1)) < 0.01,
    `and carries the 0.1mm it is short by, because 38 is NOT 38.1 (${f38.errorMm})`);
}

/* ---------- 8. spanner lookups, both directions ------------------------ */
{
  let bad = 0;
  T.METRIC_BOLTS.forEach((r) => {
    const s = scope.fgSpannerForBolt(r.size);
    if(!s || s.afIso !== r.afIso || s.afDin !== r.afDin){ bad++; t.fail(`${r.size}: fgSpannerForBolt disagrees with the table`); }
    if(!scope.fgBoltsForSpanner(r.afIso).some((b) => b.size === r.size)){ bad++; t.fail(`${r.size}: its own ISO spanner does not find it`); }
    if(!scope.fgBoltsForSpanner(r.afDin).some((b) => b.size === r.size)){ bad++; t.fail(`${r.size}: its own DIN spanner does not find it`); }
  });
  if(!bad) t.pass('both spanner lookups agree with every row of the table');

  eq(JSON.stringify(scope.fgBoltsForSpanner(13)), JSON.stringify([{ size:'M8', std:'ISO & DIN' }]),
    'a 13mm spanner means M8, under both standards');
  eq(JSON.stringify(scope.fgBoltsForSpanner(17)), JSON.stringify([{ size:'M10', std:'DIN' }]),
    'a 17mm spanner is the DIN M10 -- and says so');
  eq(JSON.stringify(scope.fgBoltsForSpanner(16)), JSON.stringify([{ size:'M10', std:'ISO' }]),
    'while 16mm is the ISO M10');
  eq(scope.fgBoltsForSpanner(15).length, 0, 'and 15mm turns nothing in the chart');
  eq(scope.fgSpannerForBolt('m8').afIso, 13, 'case does not matter to a bolt name');
}

/* ---------- 9. the search box stays honest ----------------------------- */
{
  const R = scope.fgRouteQuery;
  const kinds = (q) => R(q).map((c) => c.kind);
  const WHITELIST = ['bolt', 'screw', 'length', 'spanner', 'plug', 'rivet', 'imphex'];

  eq(JSON.stringify(kinds('M8')), JSON.stringify(['bolt']), 'M8 is a bolt and only a bolt');
  eq(R('M8')[0].row.size, 'M8', 'the right bolt');
  eq(R('m10x1.25')[0].pitchTyped, 1.25, 'a typed pitch travels with the card');
  t.check(!kinds('8mm').includes('bolt'),
    '8mm is NEVER a bolt -- the M-prefix/mm-suffix collision, pinned');
  /* The digit-after-m requirement protects "8mm" even unanchored; what
     the ANCHOR protects is the transposition typo. "mm8" contains a
     perfectly good "m8" one character in, and only the ^ stops a
     de-anchored pattern reading a typo as a confident bolt card. */
  t.check(!kinds('mm8').includes('bolt'),
    'and neither is the transposed typo mm8 -- the anchor is what stops it');
  eq(JSON.stringify(kinds('#8')), JSON.stringify(['screw']), '#8 is a screw');
  eq(JSON.stringify(kinds('8g')), JSON.stringify(['screw']), 'and so is 8g');
  eq(JSON.stringify(kinds('m8 nut')), JSON.stringify(['bolt']), 'noise words fall away');

  /* The core honesty: a bare 13 means several things at this counter,
     and the router says ALL of them rather than guessing one. */
  const thirteen = kinds('13');
  t.check(thirteen.length >= 2, `a bare 13 gets multiple interpretations (${JSON.stringify(thirteen)})`);
  t.check(thirteen.includes('length') && thirteen.includes('spanner'),
    'including the length it might be and the spanner it might be');
  /* EVERY bare-number card carries its assumption -- not merely one of
     them. An earlier form of this check asked for "at least one", and a
     mutant that stripped the assumption off the length card alone
     passed, because the spanner card still had its own. Each card is
     only true IF its caption is, so each must carry one. */
  t.check(R('13').every((c) => c.assumed),
    'every assumed reading carries its assumption, so every card can say it');
  eq(R('13')[0].assumed, 'mm', 'and the first one rests on millimetres, stated');
  eq(kinds('13')[0], 'length', 'deterministic order: millimetres first, in a metric country');

  t.check(kinds('13 spanner')[0] === 'spanner',
    'saying "spanner" puts the spanner reading first');
  eq(JSON.stringify(R('')), JSON.stringify([]), 'an empty query routes nowhere');
  eq(JSON.stringify(R('xyzzy')), JSON.stringify([]), 'and so does garbage');
  ['M8', '#8', '13', '38mm', '1 1/2', '3/8', '6', '4.8'].forEach((q) => {
    const out = kinds(q);
    t.check(out.every((k) => WHITELIST.includes(k)), `every kind for ${JSON.stringify(q)} is whitelisted (${JSON.stringify(out)})`);
  });
  t.check(kinds('3/8').includes('imphex'),
    'an inch fraction that is also a UNC thread offers the imperial hex card');
  t.check(kinds('4.8').includes('rivet'), '4.8 offers the rivet it names');
  t.check(kinds('6').includes('plug'), 'and 6 offers the wall plug the shop actually stocks');
}

/* ---------- 10. the page is wired, not merely defined ------------------ */
{
  const stripped = src
    .replace(/(?<![\w"'])\/\*[\s\S]*?\*\//g, ' ')
    .split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
  t.check(/id="tab-fasteners"/.test(stripped), 'the section exists');
  t.check(/data-tab="fasteners"[^>]*data-keywords="[^"]*spanner/.test(stripped),
    'the rail button exists and nav search will find "spanner"');
  t.check(/class="mms-item" data-tab="fasteners"/.test(stripped),
    'and the phone More sheet carries it too');
  t.check(/if\(tab==='fasteners'\) renderFasteners\(\);/.test(stripped),
    'entering the tab renders it');
  t.check(/getElementById\('fg_q'\)\.addEventListener\('input', fgRenderResults\)/.test(stripped),
    'typing re-routes live');
  t.check(/getElementById\('tab-fasteners'\)\.addEventListener\('click'/.test(stripped),
    'one delegated click listener serves every chip and find-button');
  t.check(/goToTab\('products'\);\s*\r?\n\s*triggerProductsRender\(\);/.test(stripped),
    'find-in-catalogue jumps AND renders -- goToTab’s chain has no products line');
  t.check(/getElementById\('p_category_filter'\)\.value = '';/.test(stripped),
    'and clears the category filter so the hits it promises are not hidden by one');
}

process.exit(t.done() ? 1 : 0);
