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

// compileScope binds `data` to this very object, so filling it here is
// what the compiled fgCatalogueHits sees.
const FIXTURE = { products: [] };

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
  extractFunction(src, 'fgTradeByMm', 'index.html'),
  extractFunction(src, 'fgGaugeToMm', 'index.html'),
  extractFunction(src, 'fgMmToGauge', 'index.html'),
  extractFunction(src, 'fgSecondNumber', 'index.html'),
  extractFunction(src, 'fgSizeRegex', 'index.html'),
  extractFunction(src, 'fgCatalogueHits', 'index.html'),
  extractFunction(src, 'fgSpannerForBolt', 'index.html'),
  extractFunction(src, 'fgBoltsForSpanner', 'index.html'),
  extractFunction(src, 'fgRouteQuery', 'index.html'),
  extractFunction(src, 'fgBias', 'index.html'),
], {
  // fgCatalogueHits reads the shop's own catalogue through the same
  // helpers the Products search uses, so the count it prints and the
  // jump it offers can never disagree.
  data: FIXTURE,
  searchTokens: (q) => String(q || '').trim().toLowerCase().split(/\s+/).filter(Boolean),
  matchesAllTokens: (hay, tokens) => tokens.every((tk) => hay.includes(tk)),
  variantLabel: (combo) => Object.values(combo || {}).join(' / '),
}, ['fgParseFraction', 'fgParseLengthInput', 'fgInchToMm', 'fgMmToInch', 'fgNearestFraction',
  'fgTradeMm', 'fgTradeByMm', 'fgGaugeToMm', 'fgMmToGauge', 'fgSpannerForBolt', 'fgBoltsForSpanner', 'fgRouteQuery',
  'fgGcd', 'fgSecondNumber', 'fgCatalogueHits']);

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

  /* The ladder read the other way. 50mm is a two-inch screw on every
     shelf; the nearest sixteenth calls it 1 15/16, which is closer
     arithmetically and is a thing nobody has ever asked for. */
  eq(scope.fgTradeByMm(50).inchLabel, '2"', '50mm is named by the rung it is sold as');
  eq(scope.fgTradeByMm(75).inchLabel, '3"', 'and so is 75');
  eq(scope.fgTradeByMm(51), null, 'a figure that is not a rung is not given one');
  // By value, not identity: the scope and T are two separate evaluations
  // of the same declaration, so their rows are equal and never the same
  // object.
  t.check(T.TRADE_LENGTHS.every((r) => {
    const found = scope.fgTradeByMm(r.tradeMm);
    return found && found.inchLabel === r.inchLabel;
  }), 'every rung is findable by its own millimetre figure');
  // The nearest-sixteenth answer for 50mm is the one this exists to beat.
  eq(scope.fgNearestFraction(scope.fgMmToInch(50), 16).label, '1 15/16',
    'which is what the sixteenths would have called it');
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

  /* "M8x50" and "M8x1.25" are the same shape and mean opposite things.
     The second number was read as a pitch either way, so an M8x50 -- how
     every invoice in this trade writes a 50mm bolt -- produced a
     confident warning that its nut would not fit an M8. False, and
     exactly the kind of wrong a counter repeats out loud. */
  eq(R('M8x50')[0].lengthTyped, 50, 'M8x50 is a fifty-millimetre bolt');
  eq(R('M8x50')[0].pitchTyped, null, 'and NOT a bolt with a pitch of fifty');
  eq(R('M8x1')[0].pitchTyped, 1, 'while M8x1 is still the fine pitch it is');
  eq(R('M8x1')[0].lengthTyped, null, 'and is not mistaken for a one-millimetre bolt');
  eq(R('M20x25')[0].lengthTyped, 25, 'a 25mm M20 reads as a length');
  /* The split follows EACH SIZE'S own coarse pitch, and the big sizes
     are where that matters: M30's standard coarse thread is 3.5, past
     any plausible global cutoff, while a 3.5mm-long M30 bolt is absurd.
     A single hard-coded threshold gets this exactly backwards. */
  eq(R('M30x3.5')[0].pitchTyped, 3.5, 'M30x3.5 is M30’s own coarse pitch');
  eq(R('M30x3.5')[0].lengthTyped, null, 'and not a three-and-a-half-millimetre bolt');
  eq(R('M4x3')[0].lengthTyped, 3, 'while 3 on an M4 is a length — no M4 has a 3mm pitch');
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
  /* A gauge is spoken far more often than it is written with a hash, and
     the counter types what the customer said. */
  ['no 8', 'no. 8', 'number 8', 'gauge 8'].forEach((q)=>{
    eq(JSON.stringify(kinds(q)), JSON.stringify(['screw']), `"${q}" is a screw`);
    eq(R(q)[0].row.gauge, 8, `and the right one`);
  });

  /* THE CATALOGUE'S OWN NAMING. "Wood Screws 8*50", "Truss Head 4*13",
     "RIDER 4.2*25" -- diameter-by-length is how the box lid reads and
     how this shop names its own products, and the page used to answer
     every one of them with nothing at all. */
  eq(R('4.2*25')[0].row.gauge, 8, '4.2*25 is the number-8');
  eq(R('4.2*25')[0].lengthTyped, 25, 'twenty-five millimetres long');
  eq(R('4.2*25').length, 1, 'and 4.2 is unambiguous, so it gets one card');
  eq(R('4.2x25')[0].row.gauge, 8, 'the x form reads the same');
  eq(R('8*50')[0].row.gauge, 8, '8*50 is a gauge-8 by fifty');
  eq(R('8*50')[0].lengthTyped, 50, 'with its length');
  eq(R('M8*100')[0].kind, 'bolt', 'and M8*100 is a bolt — the star multiplies there too');
  eq(R('M8*100')[0].lengthTyped, 100, 'a hundred millimetres of it');

  /* A small whole number is genuinely ambiguous: "4*13" is 4mm in this
     catalogue's Truss Head and gauge-4 in anyone's screw box. Both, exact
     reading first -- a number that IS a gauge leads, a millimetre figure
     that merely rounds to one follows. */
  const four = R('4*13');
  eq(four.length, 2, '4*13 is ambiguous and says so with two cards');
  eq(four[0].row.gauge, 4, 'the exact gauge reading leads');
  eq(four[0].assumed, 'gauge', 'captioned as an assumption');
  eq(four[1].row.gauge, 8, 'and the millimetre reading follows');
  eq(four[1].diaMm, 4, 'carrying the 4 that was typed, so the card can say it is sold as the 4.2');
  eq(four[1].assumed, 'mm', 'also captioned');
  eq(R('20*50').length, 0, 'while a first number that is neither gauge nor diameter claims nothing');
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
  /* Every rivet's own INCH name has to find it. The table prints those
     names, and the inch branch used to return before the rivet check ran
     -- so "3/16", the name on the box this shop sells, found a length
     and never the rivet. A size is the same size in either language.
     1/4" is the tight one: 6.35 against a 6.4 entry is 0.05 apart in
     arithmetic and a hair more in floating point. */
  let missed = 0;
  T.RIVETS.forEach((r)=>{
    const got = R(r.inchLabel).filter((c)=> c.kind === 'rivet' && c.row.dia === r.dia);
    if(!got.length){ missed++; t.fail(`the ${r.inchLabel} rivet is not found by its own inch name`); }
  });
  if(!missed) t.pass('every rivet is found by the inch name printed on its own box (4 sizes)');
  t.check(kinds('6').includes('plug'), 'and 6 offers the wall plug the shop actually stocks');
}

/* ---------- 10. the shop's own answer ---------------------------------- */
/*
 * The chart is generic. The question behind it is almost always "and do
 * we have it?", so the card answers both -- counted over PRODUCTS,
 * because a five-size product is one thing on the shelf.
 *
 * Two things this got wrong before they were pinned:
 *
 *   a bare substring counted "M8*100" as a gauge-8 screw, because "8*"
 *   sits inside it. It is an M8 anchor bolt. The count said three where
 *   the shop held two, with a number, which is a confident lie.
 *
 *   and counting ONE spelling reported half the shelf: a number-8 lives
 *   here as both "8*50" and "4.2*25", which is the very confusion this
 *   whole page exists to settle.
 *
 * The Products search the card also offers a jump to is a general text
 * search and is deliberately more generous than this. That is not a
 * disagreement to fix: a search box showing a near miss is helpful, a
 * COUNT including one is wrong.
 */
{
  FIXTURE.products = [
    { id:'P1', name:'Anchor Bolts M8*100', category:'Fasteners', subcategory:'Anchors', variants:[] },
    { id:'P2', name:'Wood Screws 8*50 / 25kgs', category:'Fasteners', subcategory:'Wood Screws', variants:[] },
    { id:'P3', name:'Wood Screws 8*100 / 25kgs', category:'Fasteners', subcategory:'Wood Screws', variants:[] },
    { id:'P4', name:'Wood Screws 8*150 / 25kgs', category:'Fasteners', subcategory:'Wood Screws', variants:[] },
    { id:'P5', name:'RIDER Self Drilling Screws', category:'Fasteners', subcategory:'Self Drilling',
      variants:[{ combo:{ Size:'4.2*25' } }, { combo:{ Size:'1.5"' } }] },
    { id:'P6', name:'Hinges', category:'Furniture', subcategory:'Hinges', variants:[] },
    // The bigger sizes exist so "M1" has something to be wrongly found
    // inside. Without them the trailing-digit guard could be deleted and
    // every check would still pass.
    { id:'P7', name:'Nuts', category:'Fasteners', subcategory:'Nuts',
      variants:[{ combo:{ Size:'M10' } }, { combo:{ Size:'M16' } }] },
  ];
  const H = scope.fgCatalogueHits;

  eq(H('M8').count, 1, 'the M8 card finds the shop’s one M8 line');
  eq(H('M8').names[0], 'Anchor Bolts M8*100', 'and names it');

  /* A size is only that size when nothing alphanumeric runs into it.
     "8*" sits inside "M8*100" -- an M8 anchor bolt, not a gauge-8 screw
     -- and counting it told the counter it held three where it held
     two. */
  // Three Wood Screws lines carry "8*"; the anchor bolt only contains it.
  eq(H('8*').count, 3, 'the gauge-8 count excludes the M8 bolt that merely contains "8*"');
  t.check(!H('8*').names.includes('Anchor Bolts M8*100'), 'and does not name it');
  eq(H('M10').count, 1, 'M10 finds the line that carries it');
  eq(H('M1').count, 0, 'and "M1" is not found inside the M10 and M16 sitting right there');

  /* Counted across every spelling the shelf uses, deduped by product.
     A number-8 is stocked here as both "8*50" and "4.2*25"; one spelling
     reports half the shelf while sounding certain. */
  eq(H('4.2*').count, 1, 'the millimetre spelling finds its own line');
  eq(H('4.2*').names[0], 'RIDER Self Drilling Screws', 'which is the one named in millimetres');
  eq(H(['8*', '4.2*']).count, 4, 'and both spellings together find the whole shelf');
  eq(H(['8*', '8*']).count, 3, 'while the same spelling twice counts each product once');
  /* A blank term must claim NOTHING, not everything. Without the guard
     the regex body is empty, `(^|[^0-9a-z])` matches at the start of
     every string, and the card announces the entire catalogue as being
     that size -- the most confident possible way to be wrong. */
  eq(H(['', null]).count, 0, 'a list of nothing claims nothing');
  eq(H('').count, 0, 'and neither does an empty term');
  eq(H('   ').count, 0, 'nor whitespace');
  t.check(H('').count !== FIXTURE.products.length,
    'least of all the whole catalogue, which is what an ungated blank matches');
  eq(H(['8*', '4.2*']).names.length, 3, 'names are capped — a card is not a search results page');

  // Counted over PRODUCTS. A five-size product is one thing on the shelf,
  // and counting variants would report six of something there is one of.
  eq(H('RIDER').count, 1, 'a multi-variant product counts once, not once per size');
  // Variant labels are still searched, so a size that lives only on a
  // variant is findable.
  eq(H('1.5"').count, 1, 'while a size that exists only as a variant label is still found');

  eq(H('M30').count, 0, 'a size the shop does not carry says so with a zero');
  eq(H('').count, 0, 'and an empty term claims nothing rather than everything');
  FIXTURE.products = [];
  eq(H('M8').count, 0, 'an empty catalogue is not an error');
}

/* ---------- 11. the page is wired, not merely defined ------------------ */
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

  /* The four reference charts share one panel now -- thirty-four rows of
     table below the part of the page anyone uses was the same "long list
     buries the thing you came for" the stock log and price registry were
     just cured of. Charts are consulted, not scanned, so one at a time. */
  t.check(/id="fg_ref_chips"/.test(stripped) && /id="fg_ref_body"/.test(stripped),
    'the reference charts share one panel');
  t.check(!/id="fg_lengths"/.test(stripped) && !/id="fg_plugs"/.test(stripped),
    'rather than four panels stacked below the search');
  const clickHandler = (/getElementById\('tab-fasteners'\)\.addEventListener\('click',[\s\S]*?\n\}\);/.exec(stripped) || [''])[0];
  t.check(/data-fg-ref/.test(clickHandler) && /fgRenderRefPanel\(\)/.test(clickHandler),
    'and switching between them is wired through the same delegated listener');

  // The empty state teaches what the box accepts; the examples must fill
  // it AND route, or they are decoration.
  t.check(/data-fg-example/.test(clickHandler) && /fgRenderResults\(\)/.test(clickHandler),
    'the example chips fill the box and route it');
  t.check(/const FG_EXAMPLES = \[[^\]]*'M8x50'/.test(stripped),
    'and one of them is M8x50, the shape that used to be read as a pitch');

  // The shop's own answer has to be ON the cards, not merely computable.
  t.check(/\$\{fgStockLineHTML\(r\.size\)\}/.test(stripped),
    'the bolt card says what the shop holds in that size');
  t.check(/\$\{fgStockLineHTML\(\[`\$\{r\.gauge\}\*`, `\$\{r\.dia\}\*`\]\)\}/.test(stripped),
    'and the screw card counts BOTH of the catalogue’s spellings, or it reports half the shelf');
  t.check(/lengthTyped != null/.test(stripped),
    'and a typed length is answered rather than warned about');
  // Both cards must consult the ladder, or one of them goes back to
  // calling a 2" screw "1 15/16".
  t.check(/const lenTrade = entry\.lengthTyped != null \? fgTradeByMm\(entry\.lengthTyped\) : null;/.test(stripped),
    'the bolt card names a typed length by the rung it is sold as');
  t.check(/const trade = fgTradeByMm\(c\.mm\) \|\| fgTradeMm\(frac\.num \/ frac\.den\);/.test(stripped),
    'and the length card reads the ladder from whichever end it was typed');
  // Three cards name lengths now, and each needs its own check -- two of
  // them passing is not evidence about the third.
  t.check(/const lenTrade = len != null \? fgTradeByMm\(len\) : null;/.test(stripped),
    'and so does the screw card, for the length in "8*50"');

  /* Typing "4.2*25" passes through "4.", "4.2" and "4.2*". None of those
     is a failure and none should be told it is. */
  t.check(/const stillTyping = \/\[\*x×\\\/\\-\.,\\s\]\$\/i\.test\(q\.trim\(\)\);/.test(stripped),
    'a half-typed size waits quietly instead of being called wrong');

  /* Layout. auto-FILL reserved a column per 260px and left a single card
     marooned at 287px inside 1183px of panel -- and a single card is the
     commonest result this page produces. auto-FIT collapses the tracks
     nothing occupies. */
  const css = (src.match(/<style[^>]*>[\s\S]*?<\/style>/g) || []).join('\n');
  t.check(/\.fg-results\{display:grid;grid-template-columns:repeat\(auto-fit,minmax\(260px,1fr\)\);/.test(css),
    'one card takes the width of the panel rather than a quarter of it');
  /* Which then makes a label/value pair span the whole panel, and the eye
     loses the line between them. The specs flow into as many ~220px
     columns as fit -- one on a phone, three or four on a monitor. */
  t.check(/\.fg-specs\{columns:220px;/.test(css),
    'and its figures column up instead of stretching across the width');
  t.check(/\.fg-spec\{break-inside:avoid;/.test(css),
    'without a row being split down the middle by a column break');
  // Every card type must use the wrapper, or one of them stretches.
  const builders = ['fgBoltCardHTML', 'fgScrewCardHTML', 'fgLengthCardHTML', 'fgSpannerCardHTML',
    'fgPlugCardHTML', 'fgRivetCardHTML', 'fgImpHexCardHTML'];
  const missing = builders.filter((b)=>{
    const body = (new RegExp('function ' + b + '\\([\\s\\S]*?\\n\\}')).exec(stripped);
    return !body || !/class="fg-specs"/.test(body[0]);
  });
  t.check(missing.length === 0,
    `every card type columns its specs${missing.length ? ` (missing: ${missing.join(', ')})` : ` (${builders.length} builders)`}`);
  t.check(/stillTyping \? '' :/.test(stripped),
    'and only a finished one that matches nothing gets the message');
}

process.exit(t.done() ? 1 : 0);
