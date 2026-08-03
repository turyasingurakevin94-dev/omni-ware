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
  const a = asset();
  const s = scope.assetSchedule(a);
  t.check(r(s[0].charge) === 400000,
    `(cost less salvage) over the life: (30m - 6m)/60 = 400,000 a month (got ${r(s[0].charge)})`);
  t.check(s.length === 60, `and it runs exactly the life, not a month more (got ${s.length})`);
  t.check(s[0].month === '2026-01', 'starting the month it was acquired');
  t.check(r(s[s.length - 1].closing) === 6000000,
    'and finishing exactly on the residual value, never below it');
  t.check(r(scope.assetNBVAt(a, '2026-12-31')) === 25200000,
    `book value after twelve charges is cost less twelve months (got ${r(scope.assetNBVAt(a, '2026-12-31'))})`);
  t.check(r(scope.assetAccumulatedAt(a, '2026-12-31')) === 4800000, 'with accumulated depreciation its mirror');

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
  t.check(r(s[0].charge) === r(30000000 * 0.25 / 12),
    `the first month is the annual rate over twelve, on the full cost (got ${r(s[0].charge)})`);
  t.check(s[1].charge < s[0].charge && s[11].charge < s[1].charge,
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

  t.check(r(scope.assetNBVAt(asset({ ...a, acquiredOn: '2026-03-03' }), '2026-06-30'))
    === r(scope.assetNBVAt(asset({ ...a, acquiredOn: '2026-03-28' }), '2026-06-30')),
  'the day of the month makes no difference -- whole months, deliberately');

  const sold = asset({ ...a, disposedOn: '2026-06-30', disposalProceeds: 1000000 });
  t.check(scope.assetMonthsCharged(sold, '2026-12-31') === 3,
    'the disposal month is NOT charged, so March, April and May are the three');
  t.check(r(scope.assetNBVAt(sold, '2026-12-31')) === r(scope.assetNBVAt(sold, '2026-06-30')),
    'and nothing is charged after it is gone');
}

/* ---------- 4. selling it --------------------------------------------- */
{
  const sold = asset({ cost: 1200000, lifeMonths: 12, salvage: 0, acquiredOn: '2026-03-10',
    disposedOn: '2026-06-30', disposalProceeds: 1000000 });
  const d = scope.assetDisposalResult(sold);
  t.check(r(d.book) === 900000, `book value at disposal is cost less what was charged (got ${r(d.book)})`);
  t.check(r(d.gain) === 100000, 'and the gain is what it fetched over that');
  t.check(r(scope.assetDisposalResult({ ...sold, disposalProceeds: 500000 }).gain) === -400000,
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
  t.check(r(scope.depreciationForPeriod('2026-01-01', '2026-03-31')) === 3 * (100000 + 50000),
    `the period charge adds every asset's months in that window (got ${r(scope.depreciationForPeriod('2026-01-01', '2026-03-31'))})`);
  // A period that does NOT begin at acquisition. Every window above starts
  // the month the assets were bought, where "this period" and "everything
  // so far" are the same number and the window is doing no work.
  t.check(r(scope.depreciationForPeriod('2026-03-01', '2026-03-31')) === 100000 + 50000,
    `one month in the middle charges that month alone, not everything since they were bought (got ${r(scope.depreciationForPeriod('2026-03-01', '2026-03-31'))})`);
  t.check(r(scope.depreciationForPeriod('2026-02-01', '2026-03-31')) === 2 * (100000 + 50000),
    'and a two-month window charges two');
  t.check(r(scope.depreciationForPeriod('2025-01-01', '2025-12-31')) === 0,
    'a period entirely before they were bought charges nothing');
  t.check(r(scope.fixedAssetsNBVAt('2026-03-31')) === (1200000 - 300000) + (600000 - 150000),
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

process.exit(t.done() ? 1 : 0);
