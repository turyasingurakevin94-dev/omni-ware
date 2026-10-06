#!/usr/bin/env node
'use strict';
/*
 * The things the shop owns and uses.
 *
 * Phase 2 of the accounting work. Stock is bought to be sold and leaves
 * through COGS; a van is bought to be USED and leaves a little at a time
 * over years. There was nowhere to record one, so a van was a single
 * large payment in the cash book and then nothing at all -- a month that
 * looked catastrophic, years that looked better than they were, and no
 * asset anywhere on the books.
 *
 * Everything here is arithmetic on a stored asset and a date. Nothing
 * accumulates into a running balance, so a schedule cannot drift out of
 * step with the register: ask again and it recomputes.
 *
 * The conventions are choices, and each one is pinned below because each
 * could reasonably have gone the other way:
 *
 *   whole months     the day of the month is ignored. Daily proration is
 *                    more precise and, for a shop deciding what a van is
 *                    worth, precision nobody uses is just noise.
 *   from acquisition the acquisition month is charged, the disposal month
 *                    is not. So a thing owned one month is charged once.
 *   never below salvage
 *                    reducing balance would otherwise approach zero
 *                    forever and straight line would sail past it.
 *
 * Run: node test/fixed-assets.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('fixed assets');
const src = read('index.html');
const data = { fixedAssets: [] };

const scope = compileScope([
  extractDeclaration(src, 'DEPRECIATION_MAX_MONTHS', 'index.html'),
  extractFunction(src, 'monthsBetween', 'index.html'),
  extractFunction(src, 'monthChargeFraction', 'index.html'),
  extractFunction(src, 'assetCoverInMonth', 'index.html'),
  extractFunction(src, 'assetRowFraction', 'index.html'),
  extractFunction(src, 'assetIsDisposed', 'index.html'),
  extractFunction(src, 'assetMonthsCharged', 'index.html'),
  extractFunction(src, 'assetMonthlyCharge', 'index.html'),
  extractFunction(src, 'assetSchedule', 'index.html'),
  extractFunction(src, 'assetNBVAt', 'index.html'),
  extractFunction(src, 'assetAccumulatedAt', 'index.html'),
  extractFunction(src, 'assetChargeBetween', 'index.html'),
  extractFunction(src, 'liveFixedAssets', 'index.html'),
  extractFunction(src, 'depreciationForPeriod', 'index.html'),
  extractFunction(src, 'fixedAssetsNBVAt', 'index.html'),
  extractFunction(src, 'assetDisposalResult', 'index.html'),
], { data }, ['monthsBetween', 'assetIsDisposed', 'assetMonthsCharged', 'assetSchedule',
  'assetNBVAt', 'assetAccumulatedAt', 'assetChargeBetween', 'depreciationForPeriod',
  'fixedAssetsNBVAt', 'assetDisposalResult']);

const r = (n) => Math.round(n);
const asset = (over) => Object.assign({
  id: 1, name: 'Delivery van', cost: 30000000, acquiredOn: '2026-01-15',
  method: 'straight_line', lifeMonths: 60, ratePct: null, salvage: 6000000,
  disposedOn: null, disposalProceeds: null,
}, over);

/* ---------- 1. straight line ------------------------------------------ */
{
  /* THE ASSET IS BOUGHT ON THE 15th, which is why the first row is not a
     whole month any more. A month's charge is still (30m - 6m) / 60 =
     400,000; the January row is the 17 days of January the shop owned
     it, and the tail runs one calendar month further to finish the sixty
     months of life. Everything the shop is charged over that life is
     unchanged -- what moved is WHEN, and it moved to the truth. */
  const a = asset();               // acquired 2026-01-15
  const s = scope.assetSchedule(a);
  t.check(r(s[1].charge) === 400000,
    `(cost less salvage) over the life: (30m - 6m)/60 = 400,000 a whole month (got ${r(s[1].charge)})`);
  t.check(r(s[0].charge) === r(400000 * 17 / 31),
    `and the month it arrived charges the 17 days it was there for (got ${r(s[0].charge)})`);
  t.check(s.length === 61,
    `sixty months from the 15th end in the 61st calendar month (got ${s.length})`);
  t.check(r(s.reduce((n, row) => n + row.charge, 0)) === 30000000 - 6000000,
    'and the life still costs exactly cost less salvage, whatever day it started on');
  t.check(s[0].month === '2026-01', 'starting the month it was acquired');
  t.check(r(s[s.length - 1].closing) === 6000000,
    'and finishing exactly on the residual value, never below it');
  t.check(r(scope.assetNBVAt(a, '2026-12-31')) === r(30000000 - 400000 * (11 + 17 / 31)),
    `book value is cost less the months owned -- eleven whole and 17 days (got ${r(scope.assetNBVAt(a, '2026-12-31'))})`);
  t.check(r(scope.assetAccumulatedAt(a, '2026-12-31')) === r(400000 * (11 + 17 / 31)),
    'with accumulated depreciation its mirror');

  // Salvage is a floor, not a target: an asset with none goes to nil.
  const nil = asset({ salvage: 0, cost: 1200000, lifeMonths: 12 });
  t.check(r(scope.assetSchedule(nil).slice(-1)[0].closing) === 0, 'no residual value means it depreciates to nothing');
  t.check(r(scope.assetChargeBetween(nil, '2026-01-01', '2027-12-31')) === 1200000,
    'and the whole life charges exactly what it cost -- no more, no less');
}

/* ---------- 2. reducing balance --------------------------------------- */
{
  const a = asset({ method: 'reducing_balance', lifeMonths: null, ratePct: 25 });
  const s = scope.assetSchedule(a);
  /* Same asset, same 15th: the first row is 17 days of the annual rate
     over twelve, on the full cost. The second row is the first WHOLE
     month, so it is the one that carries the rule. */
  t.check(r(s[0].charge) === r(30000000 * 0.25 / 12 * 17 / 31),
    `the month it arrived is 17 days of the monthly rate, on the full cost (got ${r(s[0].charge)})`);
  t.check(r(s[1].charge) === r((30000000 - s[0].charge) * 0.25 / 12),
    'and the first whole month is the annual rate over twelve, on what is left after it');
  t.check(s[2].charge < s[1].charge && s[11].charge < s[2].charge,
    'and every month after is smaller -- the point of the method, and how a vehicle actually loses value');
  t.check(r(s[s.length - 1].closing) === 6000000,
    'it still stops at the residual value, which a percentage of a shrinking balance would never reach on its own');
  t.check(s.length < 40 * 12, `and so it terminates rather than running forever (${s.length} months)`);

  // With no salvage the balance approaches zero but never arrives, so the
  // cap is what ends it. Checked, because an uncapped loop here would
  // hang the browser rather than produce a wrong number.
  const forever = asset({ method: 'reducing_balance', lifeMonths: null, ratePct: 25, salvage: 0 });
  t.check(scope.assetSchedule(forever).length <= 40 * 12,
    'a reducing balance with no residual value is capped rather than looping forever');
}

/* ---------- 3. when the clock starts and stops ------------------------ */
{
  const a = asset({ cost: 1200000, lifeMonths: 12, salvage: 0, acquiredOn: '2026-03-10' });

  t.check(scope.assetMonthsCharged(a, '2026-03-31') === 1,
    'the month it was acquired is charged -- a thing owned for one month is charged once');
  t.check(scope.assetMonthsCharged(a, '2026-04-30') === 2, 'and each month after adds one');
  t.check(r(scope.assetNBVAt(a, '2026-01-31')) === 1200000,
    'before it was acquired it has not depreciated at all');
  t.check(scope.assetMonthsCharged(a, '2026-01-31') === 0,
    'and the count is zero rather than negative, which would ADD value to an asset the shop did not own yet');

  /* THE DAY OF THE MONTH NOW MAKES THE DIFFERENCE IT ALWAYS SHOULD HAVE.
     This read `=== `: a van bought on the 3rd and one bought on the 28th
     were worth the same on 30 June, because a month was the smallest
     thing that could be charged. The shop asked for the days, and the
     days are what an asset is worn by -- one was owned for 29 of March's
     31 and the other for 4. */
  const early = scope.assetNBVAt(asset({ ...a, acquiredOn: '2026-03-03' }), '2026-06-30');
  const late = scope.assetNBVAt(asset({ ...a, acquiredOn: '2026-03-28' }), '2026-06-30');
  t.check(r(early) === r(1200000 - 100000 * (3 + 29 / 31)),
    `bought on the 3rd, it is worn by 29 days of March and three whole months (got ${r(early)})`);
  t.check(r(late) === r(1200000 - 100000 * (3 + 4 / 31)),
    `bought on the 28th, by four days of March and the same three (got ${r(late)})`);
  t.check(late > early,
    'so the one bought later in the month is worth more, which is the whole point');

  /* AND THE DISPOSAL MONTH IS CHARGED FOR THE DAYS IT WAS OWNED. Skipping
     it entirely was the conservative half of a choice that only existed
     because a month could not be split: something sold on the 20th had
     to take either a whole month or none. It takes twenty days. */
  const sold = asset({ ...a, disposedOn: '2026-06-20', disposalProceeds: 1000000 });
  t.check(scope.assetMonthsCharged(sold, '2026-12-31') === 4,
    'March to June inclusive is four calendar months, the last two of them part months');
  t.check(r(scope.assetChargeBetween(sold, '2026-01-01', '2026-12-31'))
    === r(100000 * (22 / 31 + 1 + 1 + 20 / 30)),
    'and what it cost the shop is exactly the days it was owned: 22 of March, April, May, 20 of June');
  t.check(r(scope.assetNBVAt(sold, '2026-12-31')) === r(scope.assetNBVAt(sold, '2026-06-20')),
    'and nothing is charged after the day it went');
}

/* ---------- 4. selling it --------------------------------------------- */
{
  /* Owned 10 March to 30 June: 22 days of March, then three whole
     months. The book value it is sold against is worn by exactly that,
     where it used to skip both end months and charge three flat. */
  const sold = asset({ cost: 1200000, lifeMonths: 12, salvage: 0, acquiredOn: '2026-03-10',
    disposedOn: '2026-06-30', disposalProceeds: 1000000 });
  const worn = 100000 * (22 / 31 + 3);
  const d = scope.assetDisposalResult(sold);
  t.check(r(d.book) === r(1200000 - worn),
    `book value at disposal is cost less the days it was owned (got ${r(d.book)})`);
  t.check(r(d.gain) === r(1000000 - (1200000 - worn)), 'and the gain is what it fetched over that');
  t.check(r(scope.assetDisposalResult({ ...sold, disposalProceeds: 500000 }).gain)
    === r(500000 - (1200000 - worn)),
    'a sale below book value is a loss, signed rather than clamped');
  t.check(scope.assetDisposalResult(asset()) === null,
    'an asset still owned has no disposal result -- null, so "not sold" cannot be read as "sold for nothing"');
}

/* ---------- 5. what the statements will read -------------------------- */
{
  data.fixedAssets = [
    asset({ id: 1, cost: 1200000, lifeMonths: 12, salvage: 0, acquiredOn: '2026-01-10' }),
    asset({ id: 2, cost: 600000, lifeMonths: 12, salvage: 0, acquiredOn: '2026-01-10' }),
  ];
  /* Both bought on 10 January, so January is 22 of its 31 days. */
  const owned = 22 / 31 + 2;
  t.check(r(scope.depreciationForPeriod('2026-01-01', '2026-03-31')) === r(owned * (100000 + 50000)),
    `the period charge adds every asset's days in that window (got ${r(scope.depreciationForPeriod('2026-01-01', '2026-03-31'))})`);
  // A period that does NOT begin at acquisition. Every window above starts
  // the month the assets were bought, where "this period" and "everything
  // so far" are the same number and the window is doing no work.
  t.check(r(scope.depreciationForPeriod('2026-03-01', '2026-03-31')) === 100000 + 50000,
    `one month in the middle charges that month alone, not everything since they were bought (got ${r(scope.depreciationForPeriod('2026-03-01', '2026-03-31'))})`);
  t.check(r(scope.depreciationForPeriod('2026-02-01', '2026-03-31')) === 2 * (100000 + 50000),
    'and a two-month window charges two');
  t.check(r(scope.depreciationForPeriod('2025-01-01', '2025-12-31')) === 0,
    'a period entirely before they were bought charges nothing');
  t.check(r(scope.fixedAssetsNBVAt('2026-03-31'))
    === r((1200000 - owned * 100000) + (600000 - owned * 50000)),
    'and the balance-sheet figure is what they are all still worth');

  // The two have to agree: what was charged is what came off the books.
  const start = r(scope.fixedAssetsNBVAt('2025-12-31'));
  const end = r(scope.fixedAssetsNBVAt('2026-03-31'));
  const cost = 1200000 + 600000;
  t.check(start === 0, 'nothing is on the books before either was acquired');
  t.check(cost - end === r(scope.depreciationForPeriod('2026-01-01', '2026-03-31')),
    'and cost less closing book value equals the charge for the period -- the two cannot drift apart');

  data.fixedAssets = [asset({ id: 1, cost: 1200000, lifeMonths: 12, salvage: 0,
    acquiredOn: '2026-01-10', disposedOn: '2026-04-30' })];
  t.check(r(scope.fixedAssetsNBVAt('2026-05-31')) === 0,
    'a disposed asset leaves the balance sheet');
  t.check(r(scope.fixedAssetsNBVAt('2026-03-31')) > 0, 'but is still on it beforehand');
  t.check(r(scope.fixedAssetsNBVAt('2025-06-30')) === 0,
    'and one not yet bought is not on it either');
}

/* ---------- 6. months, without a timezone in the way ------------------ */
{
  t.check(scope.monthsBetween('2026-01-31', '2026-02-01') === 1,
    'a month boundary one day apart is one month');
  t.check(scope.monthsBetween('2026-01-01', '2026-01-31') === 0, 'and the same month is none');
  t.check(scope.monthsBetween('2026-01-15', '2027-01-15') === 12, 'a year is twelve');
  t.check(scope.monthsBetween('2026-06-01', '2026-01-01') === -5,
    'and backwards is negative rather than absolute, so a caller can tell which way round it is');
  t.check(scope.monthsBetween('not a date', '2026-01-01') === 0, 'nonsense in gives zero rather than NaN');
}

/* ---------- 7. wired into the shop's data ----------------------------- */
{
  const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
  t.check(/addDiffOps\(ops, 'fixedAssets', 'fixed_assets', 'id', shopId, rows\.fixedAssets\);/.test(code),
    'the register is saved with everything else');
  t.check(/sel\('fixed_assets'\)/.test(code), 'and loaded with it');
  t.check(/fixedAsset:\s*\{kind:'row:fixed_asset'/.test(code),
    'with its own id kind, so two admins adding an asset at once cannot collide');
  t.check(/'supplierCommissions','fixedAssets'/.test(code),
    'and it is guarded against being absent, like every other collection');

  const mig = read('supabase/migrations/0042_fixed_assets.sql');
  t.check(/generated by default as identity/.test(mig),
    'the id column accepts the id the client assigns -- ALWAYS would reject every insert');
  t.check(/is_shop_member\(shop_id\)/.test(mig), 'and the table is behind the same membership check as the rest');
  t.check(/insert into entity_id_counters/.test(mig) && /row:fixed_asset/.test(mig),
    'with its id counter seeded, or the first client would start from 1 over existing rows');
  t.check(/check \(method in \('straight_line', 'reducing_balance'\)\)/.test(mig),
    'and only the two methods the app can actually compute are storable');
}

/* ---------- selling one is something you can find -------------------- */
{
  const src = read('index.html');

  /* The disposal fields were only reachable by opening Edit and knowing
     that two more fields sit below the notes -- which is not a thing
     anybody knows. Asked directly: "I dont seem to see how an asset can
     be sold." */
  /* WHAT MOVED, AND WHAT DID NOT. The register is one row per thing now
     and the row opens in place, so Sell is a named button inside the
     opened row rather than the third of four unlabelled icons at the end
     of a table row. The fault this section was written for is unchanged
     and still guarded: selling must be VISIBLE somewhere that is not
     "open Edit and scroll past the notes", it must go through the one
     form, and it must never be offered on something already sold. What
     is no longer asserted is that the door is an icon in a <td>; that
     table does not exist.

     AND AGAIN, FOR VERSION 2. Nothing opens in place any more: picking a
     thing opens its workspace, and Sell or dispose is a named button in
     that workspace's header, beside Edit. The three guarantees are the
     same three, read off the new code: the words are on the button, the
     button opens the one asset form in its selling mode, and a thing
     already sold is never offered it. */
  t.check(/acts\.push\(\['sell', 'Sell or dispose'\]\)/.test(src),
    'selling is offered on the thing itself, named in words');
  t.check(/else if\(k === 'sell'\) openAssetForm\(sel\.a\.id, true\);/.test(src),
    'through the same form, told what it was opened for');

  /* Not on something already sold: the entry says "sold" and carries the
     gain, and a second disposal would bank the proceeds twice. */
  t.check(/if\(a && !r\.gone\) acts\.push\(\['sell', 'Sell or dispose'\]\);/.test(src),
    'and never on one already sold, which would bank the proceeds a second time');

  /* One form, not a second sale dialog -- two places writing the
     disposal date and the proceeds is how two screens come to disagree. */
  const open = extractFunction(src, 'openAssetForm', 'index.html');
  t.check(/function openAssetForm\(id, sell\)/.test(open),
    'selling reuses the asset form rather than a second dialog of its own');
  t.check(/const selling = !!sell && !!a;/.test(open),
    'and "sell" means nothing on an asset that does not exist yet');
  t.check(/selling \? 'Sell or dispose' : \(a \? 'Edit asset' : 'Add an asset'\)/.test(open),
    'the heading says which of the three it was opened as');

  /* The disposal fields sit past the cost, the life and the notes, so
     landing on the name would leave somebody who pressed Sell looking at
     a form that shows no sign of having heard them. */
  t.check(/el\.scrollIntoView\(\{block:'center'\}\);\s*\n\s*el\.focus\(\);/.test(open),
    'the cursor lands in the date sold, which is the field they came for');
  t.check(/if\(!el\.value\) el\.value = todayISO\(\);/.test(open),
    'seeded with today, and never overwriting a date already recorded');

  /* The one id in this form that existed twice: getElementById returns
     the first, so the second could never be written to. */
  const modal = (/<div class="modal-overlay" id="assetModal">[\s\S]*?\n<\/div>/.exec(src) || [''])[0];
  t.check((modal.match(/id="fa_preview"/g) || []).length === 1,
    'and the asset form declares fa_preview once, not twice');
}

/* ---------- a window gets the days of a month it covers ---------------
 *
 * Reported from the shop, off the profit and loss: "how can depreciation
 * of the month and a day be the same". It could, and it was worse than
 * that -- assetChargeBetween matched schedule rows on YYYY-MM and took
 * every matching month WHOLE, so:
 *
 *   one day of September charged the whole of September;
 *   ten days in the middle of August charged the whole of August;
 *   25 August to 4 September charged TWO full months, which is more
 *   depreciation than eleven days contains time for.
 *
 * Depreciation is above operating profit and inside break-even's running
 * costs, so every short window overstated what the shop costs to run and
 * understated what it made.
 *
 * The schedule stays whole months -- that is what a monthly charge means
 * and what the register shows. What a WINDOW takes is apportioned by the
 * days of each month it actually covers.
 */
{
  data.fixedAssets = [asset({ id: 1, cost: 30000000, salvage: 6000000,
    acquiredOn: '2025-01-01', method: 'straight_line', lifeMonths: 60 })];
  const month = (30000000 - 6000000) / 60;   // 400,000 a month
  const near = (a, b) => Math.abs(a - b) < 0.5;

  t.check(near(scope.depreciationForPeriod('2026-08-01', '2026-08-31'), month),
    'a whole month is still exactly a month -- no month-end figure this app has shown ever moved');
  t.check(near(scope.depreciationForPeriod('2026-08-01', '2026-08-04'), month * 4 / 31),
    `four days of August charge four days of it (got ${r(scope.depreciationForPeriod('2026-08-01','2026-08-04'))})`);
  t.check(near(scope.depreciationForPeriod('2026-08-04', '2026-08-04'), month / 31),
    'and one day charges one day, which is the report this came from');
  t.check(near(scope.depreciationForPeriod('2026-08-10', '2026-08-20'), month * 11 / 31),
    'eleven days in the middle of a month charge eleven days, not the month around them');

  /* The one that was not merely imprecise but arithmetically impossible:
     a window shorter than a month charging more than a month. */
  const across = scope.depreciationForPeriod('2026-08-25', '2026-09-04');
  t.check(near(across, month * 7 / 31 + month * 4 / 30),
    `eleven days spanning a month end charge eleven days (got ${r(across)})`);
  t.check(across < month,
    'and a window shorter than a month can no longer charge more than a month');

  /* THE INVARIANT THAT KEEPS THE TWO STATEMENTS AGREEING. Whatever the
     profit and loss charges over a window, the balance sheet's book
     value must fall by exactly that much across it -- otherwise the van
     is worth a month less on the 4th while the P&L shows four days. */
  const dayBefore = (iso) => {
    const d = new Date(iso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  };
  const a = data.fixedAssets[0];
  [['2026-08-01', '2026-08-04'], ['2026-08-01', '2026-08-31'],
   ['2026-08-25', '2026-09-04'], ['2026-08-10', '2026-08-20'],
   ['2026-07-01', '2026-09-30']].forEach(([from, to]) => {
    const charge = scope.assetChargeBetween(a, from, to);
    const fall = scope.assetNBVAt(a, dayBefore(from)) - scope.assetNBVAt(a, to);
    t.check(near(charge, fall),
      `${from} to ${to}: the charge equals the fall in book value (${r(charge)} vs ${r(fall)})`);
  });

  /* Nothing is created or destroyed by apportioning: a life still costs
     exactly cost less salvage, whoever asks and however they slice it. */
  t.check(r(scope.depreciationForPeriod('2025-01-01', '2035-01-31')) === 30000000 - 6000000,
    'and the whole life still charges exactly cost less salvage');
  data.fixedAssets = [];
}

process.exit(t.done() ? 1 : 0);
