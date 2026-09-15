#!/usr/bin/env node
'use strict';
/*
 * What a customer owes, shown while an order is being raised for them.
 *
 * This is not a new number -- the quote screen already printed
 * "owes 1,340,000" as one item in a dot-separated list beside the order
 * count, which is where a figure goes to be ignored. What it never showed
 * is the thing that changes behaviour: how long the money has been
 * outstanding. 200,000 at three days is an ordinary trading position;
 * 1,340,000 at forty-seven is a conversation to have before more stock
 * leaves the building. The old display could not tell those apart.
 *
 * So the standing carries an age and a band, and it appears in the client
 * DROPDOWN as well as after selection -- whether this is the customer to
 * raise an order for is the question being answered while looking at that
 * list, and answering it afterwards means backing out of a half-built
 * quote.
 *
 * Nothing new is computed or stored: customerOutstandingInvoices() already
 * returned this customer's unpaid invoices oldest first.
 *
 * Run: node test/customer-standing.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('customer standing');
const src = read('index.html');

const today = '2026-08-02';
const daysSinceDate = (iso) => {
  const a = new Date(iso + 'T00:00:00Z'), b = new Date(today + 'T00:00:00Z');
  return Math.round((b - a) / 86400000);
};

let fns = null, err = null;
try {
  fns = compileScope(
    [
      extractFunction(src, 'customerDebtStanding', 'index.html'),
      extractFunction(src, 'debtStandingBand', 'index.html'),
    ],
    {
      daysSinceDate,
      invoiceNumberLabel: (q) => `INV-${String(q.id).padStart(4, '0')}`,
      customerOutstandingInvoices: (id) => (global.__open[id] || []),
    },
    ['customerDebtStanding', 'debtStandingBand'],
  );
} catch (e) { err = e; }
t.check(!!fns, `the standing helpers compile${err ? ` (${err.message})` : ''}`);

if (fns) {
  const { customerDebtStanding, debtStandingBand } = fns;
  const setOpen = (map) => { global.__open = map; };

  /* ---------- 1. the age is the oldest unpaid invoice ---------------- */
  {
    setOpen({ c1: [
      { id: 118, invoicedAt: '2026-06-16' },   // 47 days
      { id: 131, invoicedAt: '2026-07-02' },   // 31 days
    ] });
    const st = customerDebtStanding({ id: 'c1', debt: 1980000 });
    t.check(st && st.owed === 1980000, 'the balance comes from the customer record');
    t.check(st && st.oldestDays === 47, `the age is the OLDEST invoice, not the newest (${st && st.oldestDays})`);
    t.check(st && st.openCount === 2, 'and how many are open is carried too');
    t.check(st && st.oldestLabel === 'INV-0118', 'named, so it can be found');
  }

  /* ---------- 2. no debt, nothing said ------------------------------- */
  {
    setOpen({ c2: [] });
    t.check(customerDebtStanding({ id: 'c2', debt: 0 }) === null,
      'a customer who owes nothing produces no standing at all');
    t.check(customerDebtStanding({ id: 'c2', debt: -50 }) === null,
      'nor does a credit balance');
    t.check(customerDebtStanding(null) === null, 'nor a missing customer');
    t.check(debtStandingBand(null) === null, 'and no standing means no band to render');
  }

  /* ---------- 3. the bands ------------------------------------------- */
  {
    const bandFor = (days) => {
      setOpen({ x: [{ id: 1, invoicedAt: new Date(Date.UTC(2026, 7, 2) - days * 86400000).toISOString().slice(0, 10) }] });
      return debtStandingBand(customerDebtStanding({ id: 'x', debt: 100000 }));
    };
    t.check(bandFor(3) === 'open', 'three days is ordinary credit');
    t.check(bandFor(29) === 'open', 'so is twenty-nine');
    t.check(bandFor(30) === 'late', 'thirty is late');
    t.check(bandFor(47) === 'late', 'forty-seven is late');
    t.check(bandFor(60) === 'severe', 'sixty is severe');
    t.check(bandFor(120) === 'severe', 'and it does not get better');

    // A boundary that must not wobble: the dashboard already flags the
    // over-60 pool, so these two views agree about who is in it.
    t.check(bandFor(59) === 'late' && bandFor(60) === 'severe',
      'the 60-day line matches the pool the dashboard already flags');
  }

  /* ---------- 4. an unknown age never escalates ---------------------- */
  /*
   * A debt can exist with no open invoice behind it -- a manual adjustment
   * on the customer's ledger, which the debt log supports. That is missing
   * information, not evidence of a problem, and colouring it as severe
   * would be inventing a fact.
   */
  {
    setOpen({ c3: [] });
    const st = customerDebtStanding({ id: 'c3', debt: 400000 });
    t.check(st && st.owed === 400000, 'a balance with no open invoice is still reported');
    t.check(st && st.oldestDays === null, 'with an unknown age');
    t.check(debtStandingBand(st) === 'open', 'and it bands as open, never as severe');

    setOpen({ c4: [{ id: 9 }] });   // no invoicedAt, no date
    const st2 = customerDebtStanding({ id: 'c4', debt: 100 });
    t.check(st2 && st2.oldestDays === null, 'an invoice with no date is an unknown age, not day zero');
    t.check(debtStandingBand(st2) === 'open', 'and does not escalate either');
  }

  /* ---------- 5. it falls back to the order date --------------------- */
  {
    setOpen({ c5: [{ id: 7, date: '2026-06-16' }] });   // invoicedAt absent
    const st = customerDebtStanding({ id: 'c5', debt: 5000 });
    t.check(st && st.oldestDays === 47,
      'when invoicedAt is missing the order date is used rather than giving up');
  }
}

/* ---------- 6. it is shown where the decision is made --------------- */
{
  const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

  t.check(/const st = customerDebtStanding\(c\);/.test(code) && /q-ac-owed/.test(code),
    'the standing appears in the client dropdown, while choosing');
  /* On the quote it is a cell of the client band and a row of the rail,
     toned by the same band the dropdown uses. It was a block of its own
     (debtStandingHTML); the band replaced it. */
  const bandFn = (/function renderClientHistoryBox\(\)\{[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/const standing = customerDebtStanding\(customer\);\s*const band = debtStandingBand\(standing\);/.test(bandFn)
    /* "Owed now": the same words the rail and the customer book use for
       the same figure. The band alone said "Owes now". */
    && /Owed now\$\{esc\(age\)\}/.test(bandFn),
    'and again on the quote once a client is chosen, banded the same way');
  t.check(!/parts\.push\(`<span class="owed">owes/.test(code),
    'the old dot-separated "owes" clause is gone');

  // Banded classes must exist for all three, or a band silently renders unstyled.
  ['open', 'late', 'severe'].forEach(b => {
    t.check(new RegExp(`\\.q-ac-owed\\.${b}\\{`).test(code), `the ${b} band is styled in the dropdown`);
  });
  /* On the band the three read as ink, amber and crimson: open is the
     ordinary trading position and gets no colour at all, late is a
     caution, severe is the pool the dashboard already flags. The
     mapping is pinned with its tones, and both tones are painted. */
  t.check(/band==='severe' \? ' ow-bad' : band==='late' \? ' ow-warn' : ''/.test(bandFn),
    'and on the quote: open in ink, late in amber, severe in crimson');
  t.check(/\.ow-fig\.ow-bad\{color:var\(--ow-crimson\);\}/.test(code) && /\.ow-fig\.ow-warn\{color:var\(--ow-amber-ink\);\}/.test(code),
    'with both tones painted');
}

process.exit(t.done() ? 1 : 0);
