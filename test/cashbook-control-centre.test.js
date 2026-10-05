#!/usr/bin/env node
'use strict';
/*
 * The Cash Book as a control centre for money -- the layout the owner
 * signed off on the design canvas, built into the app. This file pins the
 * things that make it that layout and not merely a restyle of the old one:
 *
 *   - the order the questions are asked in, top to bottom;
 *   - one red action on the page;
 *   - a transfer drawn as ONE row, not two;
 *   - an entry with nothing behind it marked, and counted for its filter;
 *   - the record dialog sharing a payment down the open documents oldest
 *     first, and refusing more than the ticked bills;
 *   - the new 0105 fields written only when the columns are known to be
 *     there, because migrations here are applied by hand and an unknown
 *     column fails the whole cash upsert.
 *
 * Run: node test/cashbook-control-centre.test.js   (or: npm test)
 */
const fs = require('fs');
const path = require('path');
const { read, extractFunction, createReporter, ROOT } = require('./_extract');

const t = createReporter('cash book control centre');
const src = read('index.html');
const section = (/<section id="tab-cashbook"[\s\S]*?\n    <\/section>/.exec(src) || [''])[0];
const at = (s) => section.indexOf(s);

/* ---------- 1. the order the owner asks in ---------------------------- */
t.check(at('class="cbv-card cbv-cmd"') > -1, 'the command card heads the page');
t.check(at('id="cbStrip"') > -1 && at('id="cb_day_pick"') > -1, 'with the seven days and the picker in it');
t.check(at('id="cb_money_in"') < at('id="cbTiles"'), 'and the acts before anything they act on');
t.check(at('id="cbTiles"') < at('id="cbTxnTableWrap"'), 'then the position, then what moved');
t.check(at('id="cbTxnTableWrap"') < at('id="cbSummaryWrap"'), 'then closing the day');
t.check(at('id="cbSummaryWrap"') < at('id="cbLists"'), 'then what needs you and what is coming');
t.check(at('id="cbLists"') < at('id="cbInAnalytics"'), 'and the rings last — analytics never above the money itself');

/* The calendar opens OUT of the command card's lower strip, so nothing
   on that strip or the card may clip what overflows it. A clip-path there
   once hid the open calendar entirely -- it drew, and every tap on it
   landed on the page beneath. */
{
  const rule = (sel) => ((new RegExp('\\.' + sel + '\\{([^}]*)\\}').exec(src)) || ['', ''])[1];
  t.check(!/clip-path|overflow:\s*(hidden|clip)/.test(rule('cbv-cmd-bot')) && !/clip-path|overflow:\s*(hidden|clip)/.test(rule('cbv-cmd')),
    'the command card does not clip, so the calendar it opens can be seen and tapped');
}

/* ---------- 2. one red action ------------------------------------------ */
const accents = (section.replace(/<!--[\s\S]*?-->/g, '').match(/btn-accent/g) || []).length;
t.check(accents === 1, `exactly one accent button on the page (got ${accents})`);

/* ---------- 3. a transfer is one movement ----------------------------- */
const rows = extractFunction(src, 'cbLedgerRows', 'index.html');
t.check(/cbIsTransfer\(t\) && t\.transferId != null && byId\.has\(t\.transferId\)/.test(rows)
  && /if\(r\.isIn\) return;/.test(rows), 'the incoming leg of a transfer is folded into its outgoing one');
t.check(/kind: 'xfer'[\s\S]{0,200}accts: \[r\.account, leg\.account\]/.test(rows),
  'and the row belongs to both accounts, so either filter finds it');
const totals = extractFunction(src, 'renderCbTransactions', 'index.html');
t.check(/r\.kind !== 'xfer'/.test(totals), 'and it is left out of the In and Out totals');

/* ---------- 4. nothing behind it is said, not guessed ----------------- */
t.check(/r\.noDoc = \(r\.kind === 'in' \|\| r\.kind === 'out'\) && !r\.settles;/.test(rows),
  'an entry is "No document" only when nothing settles it — a transfer or a booked count difference never is');
const by = extractFunction(src, 'cbEnteredBy', 'index.html');
t.check(/Not recorded — entered before the book kept names/.test(by),
  'an entry from before names were kept says so rather than naming whoever is at the desk');

/* ---------- 5. the record dialog shares a payment down the list ------- */
{
  const alloc = extractFunction(src, 'cbRecAllocate', 'index.html');
  const run = (amount, ticks, owed) => {
    const scope = { cbRec: { amount, ticks } };
    const fn = new Function('scope', `with(scope){ ${alloc}; return cbRecAllocate; }`)(scope);
    return fn(owed.map((o, i) => ({ id: i, owed: o })));
  };
  let r = run(250000, null, [850000, 850000]);
  t.check(r.alloc[0] === 250000 && r.alloc[1] === 0 && r.extra === 0, 'a part payment goes to the oldest document first');
  r = run(1000000, [true, true], [850000, 850000]);
  t.check(r.alloc[0] === 850000 && r.alloc[1] === 150000, 'and runs on into the next');
  r = run(900000, [false, true], [850000, 850000]);
  t.check(r.alloc[0] === 0 && r.alloc[1] === 850000 && r.extra === 50000, 'an unticked document is skipped, and the rest is named');
  const save = extractFunction(src, 'cbRecSave', 'index.html');
  t.check(/if\(extra > 0\)\{ toast\('More than the ticked bills/.test(save), 'paying a supplier more than the ticked bills is refused');
  t.check(/recordCustomerPayment\(cbRec\.party\.id/.test(save), 'a customer payment goes through the one path every screen uses');
  t.check(/transferBetweenAccounts\(cbRec\.acct, cbRec\.to/.test(save), 'and a move through the transfer pair');
}

/* ---------- 6. 0105 is written only when it is there ------------------- */
t.check(/\.\.\.\(cashEntryMetaColumns \? \{entered_by:/.test(src), 'entered_by and photo go up only behind their probe');
t.check(/\.\.\.\(cashCloseColumns \? \{closed_at:/.test(src), 'and closed_at behind its own');
t.check(/sb\.from\('cash_txns'\)\.select\('entered_by, photo'\)\.limit\(1\)/.test(src)
  && /sb\.from\('cash_days'\)\.select\('closed_at, closed_by'\)\.limit\(1\)/.test(src), 'both are probed at load');
const mig = path.join(ROOT, 'supabase', 'migrations', '0105_cash_entry_meta.sql');
const sql = fs.existsSync(mig) ? fs.readFileSync(mig, 'utf8') : '';
t.check(/add column if not exists entered_by text/.test(sql) && /add column if not exists photo text/.test(sql)
  && /add column if not exists closed_at timestamptz/.test(sql), 'and the migration that makes them real is in the repo');

t.done();
