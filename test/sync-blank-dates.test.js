#!/usr/bin/env node
'use strict';
/*
 * A date column will not take an empty string.
 *
 * "No date on record" is a real answer in this app. An opening balance
 * carried in from before the shop kept records has an age nobody knows,
 * and every screen handles that: daysSinceDate() returns -1 for a blank,
 * the aging bands file it under "No date on record", and every sort
 * reaches for `x.date||''`.
 *
 * Postgres does not share that tolerance. `date` takes null and rejects
 * '' outright — and PostgREST rejects the whole batch, not the offending
 * row. So ONE undated record stops an entire table from saving, and the
 * shop is told "Sync failed — a change may not have been saved (invalid
 * input syntax for type date: "")" every thirty seconds, for ever.
 *
 * That is exactly what happened: a supplier opening balance ticked
 * "nobody knows when it started" put date:'' on a purchase invoice and
 * jammed purchase-invoice syncing. The customer opening balance has
 * carried the same '' since long before, on a debt-log row, waiting for
 * the first shop to tick its box.
 *
 * Run: node test/sync-blank-dates.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('sync blank dates');
const src = read('index.html');
const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

let fns = null, err = null;
try { fns = compileScope([extractFunction(src, 'dateOrNull', 'index.html')], {}, ['dateOrNull']); }
catch (e) { err = e; }
t.check(!!fns, `dateOrNull compiles${err ? ` (${err.message})` : ''}`);

if (fns) {
  const { dateOrNull } = fns;
  const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

  /* ---------- 1. what the database means by "no date" -------------- */
  eq(dateOrNull(''), null, 'an empty date becomes null — the value the column accepts');
  eq(dateOrNull(null), null, 'so does a missing one');
  eq(dateOrNull(undefined), null, 'and an absent one');
  eq(dateOrNull('   '), null, 'and one that is only spaces, which would fail the same way');
  eq(dateOrNull('2026-08-21'), '2026-08-21', 'while a real date is passed through untouched');
  eq(dateOrNull(' 2026-08-21 '), '2026-08-21', 'trimmed, since a padded one is not a different day');

  /* ---------- 2. every date crossing the boundary is converted ----- */
  /*
   * Read out of buildSyncRows itself. One unguarded date field is one
   * table that can stop saving, and the failure is silent apart from a
   * toast that fades — so this is checked by name rather than trusted.
   */
  const build = code.slice(code.indexOf('function buildSyncRows'), code.indexOf('function initLastSynced'));
  t.check(build.length > 0, 'found buildSyncRows');

  [
    ['the customer debt log', 'date:dateOrNull(l.date), type:l.type'],
    ['purchase invoices', 'quote_id:pi.quoteId, date:dateOrNull(pi.date),'],
    ['saved quotes', 'date:dateOrNull(q.date),'],
    ['the invoiced-on stamp', 'invoiced_at:dateOrNull(q.invoicedAt),'],
    ['cash entries', 'date:dateOrNull(t.date), account:t.account'],
    ['the stock log', 'date:dateOrNull(l.date), at:l.at'],
    ['prices', 'date:dateOrNull(pr.date), unit:pr.unit'],
    ['scheduled posts', 'date:dateOrNull(w.date),'],
    ['dues', 'due_date:dateOrNull(x.dueDate),'],
  ].forEach(([what, needle]) => {
    t.check(build.includes(needle), `${what} send null rather than a blank date`);
  });

  /* No bare `date:` left. Written as a scan rather than a list so a date
     field added later cannot quietly reintroduce the jam. cashDays is
     excluded on purpose: its date is the row KEY, built from
     Object.keys, and a null key would break the upsert outright rather
     than fix anything. */
  const bare = [];
  const re = /\b(date|due_date|invoiced_at):\s*([A-Za-z_$][\w$]*\.[\w$]+)/g;
  let m;
  while ((m = re.exec(build))) bare.push(m[0]);
  t.check(bare.length === 0,
    `no date field goes out unconverted (${bare.length ? bare.join(', ') : 'none'})`);

  /* ---------- 3. the record that caused it ------------------------- */
  {
    const mk = (/function createSupplierOpeningBalance[\s\S]*?\n\}/.exec(code) || [''])[0];
    t.check(/date: sinceISO \|\| null,/.test(mk),
      'an opening balance nobody can date now carries null, not an empty string');
    t.check(!/date: sinceISO \|\| '',/.test(mk), 'and the form that jammed the sync is gone');
  }

  /* ---------- 4. null reads the same as blank did ------------------ */
  /*
   * The change is only safe because every reader already treats "no
   * date" the same whichever falsy shape it arrives in. Checked against
   * the real functions rather than asserted.
   */
  {
    const RNAMES = ['daysSinceDate', 'agingBandFor'];
    const rs = compileScope(
      [require('./_extract').extractDeclaration(src, 'AGING_BANDS', 'index.html'),
        ...RNAMES.map(n => extractFunction(src, n, 'index.html'))],
      { todayISO: () => '2026-08-21' }, RNAMES,
    );
    eq(rs.daysSinceDate(null), -1, 'a null date is "not dated", exactly as a blank one was');
    eq(rs.daysSinceDate(''), -1, 'the blank behaving the same');
    eq(rs.agingBandFor(rs.daysSinceDate(null)), 'unknown',
      'so it still lands in "No date on record" rather than flattering the under-30 band');
    // And it still sorts oldest-first, which is what an opening balance is.
    const sorted = [{ date: '2026-01-01' }, { date: null }, { date: '2025-06-01' }]
      .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
    t.check(sorted[0].date === null, 'and sorts first among a supplier\'s bills, as the oldest thing owed');
  }
}

process.exit(t.done() ? 1 : 0);
