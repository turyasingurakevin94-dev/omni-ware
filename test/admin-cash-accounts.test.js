#!/usr/bin/env node
'use strict';
/*
 * Every shilling lands in one of three accounts.
 *
 * The Cash Book keys everything off three ids -- cash, momo, bank -- and
 * cbAccountTotals() filters on an exact match. A row carrying anything else
 * counts toward no account's receipts and no closing balance.
 *
 * check-momo-payment-status wrote the provider's DISPLAY NAME as the
 * account: "MTN MoMo", "Airtel Money". So every agent mobile-money payment
 * ever taken was missing from the MoMo balance. The row still appeared in
 * the day's transaction list, which is exactly what made it invisible --
 * the shopkeeper could see the payment sitting there and had no reason to
 * doubt it was counted. Against a physically counted float it would show as
 * a permanent, unexplained surplus.
 *
 * Fixed at the writer. Rows already in the database are mapped on the way
 * in, since no migration is going to reach every shop.
 *
 * Run: node test/admin-cash-accounts.test.js   (or: npm test)
 */
const fs = require('fs');
const path = require('path');
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('admin cash accounts');
const src = read('index.html');
const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

/* ---------- 1. the writer ------------------------------------------- */
{
  const fn = read('supabase/functions/check-momo-payment-status/index.ts');
  t.check(/account: "momo",/.test(fn), 'the MoMo receipt is filed under the momo account');
  t.check(!/account: providerLabel/.test(fn), 'not under the provider\'s display name');
  // The provider is still recorded -- just not as the account id.
  t.check(/category: "Mobile Money"/.test(fn), 'the category still says what kind of money it is');
  t.check(/description: `\$\{providerLabel\} payment from/.test(fn), 'the description still names the provider');
  t.check(/payments\.push\(\{[^}]*note: providerLabel/.test(fn), 'and so does the order\'s own payments entry');
}

/* ---------- 2. no other server-side write can do it either ---------- */
/*
 * Swept, because the bug was one insert nobody looked at again. Any
 * account written from an Edge Function has to be one the Cash Book knows.
 */
{
  const dir = path.join(__dirname, '..', 'supabase', 'functions');
  const files = fs.readdirSync(dir)
    .map(d => path.join(dir, d, 'index.ts'))
    .filter(p => fs.existsSync(p));
  t.check(files.length > 5, `the sweep sees the functions (${files.length})`);

  const bad = [];
  files.forEach(p => {
    const body = fs.readFileSync(p, 'utf8');
    [...body.matchAll(/account:\s*([^,\n]+)/g)].forEach(m => {
      const v = m[1].trim();
      // `account: {` opens a nested object -- client-portal answers a
      // customer with { ok, account: { owed, termsDays, ... } }, which is
      // a response shape and not a cash account at all. A brace can never
      // be an account id, so it is the one value skipped. Deliberately
      // NOT narrowed to "only quoted strings count": the bug section 1
      // pins is `account: providerLabel`, an unquoted identifier, and a
      // sweep that ignored those would stop catching the thing it exists
      // for. Checked by planting that very line and watching this fail.
      if (v === '{') return;
      if (!/^"(cash|momo|bank)"$/.test(v)) bad.push(`${path.basename(path.dirname(p))}: ${v}`);
    });
  });
  t.check(bad.length === 0,
    `every cash account written server-side is one of the three${bad.length ? ` (${bad.join('; ')})` : ''}`);
}

/* ---------- 3. rows already written are recovered on read ----------- */
{
  let f = null, err = null;
  try {
    ({ normaliseCashAccount: f } = compileScope(
      ['const ACCOUNTS = [{key:"cash"},{key:"momo"},{key:"bank"}];',
       'const CASH_ACCOUNT_KEYS = new Set(ACCOUNTS.map(a=>a.key));',
       extractFunction(src, 'normaliseCashAccount', 'index.html')],
      {}, ['normaliseCashAccount'],
    ));
  } catch (e) { err = e; }
  t.check(typeof f === 'function', `normaliseCashAccount compiles${err ? ` (${err.message})` : ''}`);

  if (f) {
    t.check(f('cash') === 'cash' && f('momo') === 'momo' && f('bank') === 'bank',
      'a real account id passes through untouched');
    t.check(f('MTN MoMo') === 'momo', 'the MTN rows already written land in momo');
    t.check(f('Airtel Money') === 'momo', 'and the Airtel ones');
    t.check(f('Bank Transfer') === 'bank' && f('Cash on hand') === 'cash',
      'other plausible labels map by what they say');
    t.check(f('') === 'cash' && f(null) === 'cash' && f(undefined) === 'cash',
      'a missing account does not vanish');
    t.check(f('Wakanda Vault') === 'cash',
      'and nor does something unrecognised -- a balance wrong in a named account is visible and fixable, one absent from every account is neither');
  }

  t.check(/account:\s*normaliseCashAccount\(t\.account\)/.test(code),
    'the read mapping runs every row through it');

  // Why the pass-through line is not redundant.
  //
  // For today's three ids the keyword fallbacks below happen to give the
  // same answer -- "cash" contains "cash" -- so deleting the early return
  // changes nothing and a mutation of it survived. It stops being harmless
  // the moment ACCOUNTS gains an id that does not spell itself out. A real
  // account must be returned because it IS one, not because its name
  // happens to contain a word the fallbacks look for.
  let g = null;
  try {
    ({ normaliseCashAccount: g } = compileScope(
      ['const ACCOUNTS = [{key:"cash"},{key:"momo"},{key:"bank"},{key:"till2"}];',
       'const CASH_ACCOUNT_KEYS = new Set(ACCOUNTS.map(a=>a.key));',
       extractFunction(src, 'normaliseCashAccount', 'index.html')],
      {}, ['normaliseCashAccount'],
    ));
  } catch (e) { /* reported below */ }
  t.check(typeof g === 'function', 'it compiles against a different account list');
  if (g) {
    t.check(g('till2') === 'till2',
      'an account id is honoured because it is in ACCOUNTS, not because of what it is called');
    t.check(g('momo') === 'momo' && g('Wakanda Vault') === 'cash',
      'with the rest of the behaviour unchanged');
  }
}

/* ---------- 4. why it was invisible rather than wrong --------------- */
/*
 * Stated as behaviour, because this is the part that made it survive: the
 * transaction list shows every row for the day regardless of account, so
 * the payment was on screen the whole time.
 */
{
  const ACCOUNTS = ['cash', 'momo', 'bank'];
  const txns = [
    { date: 'D', account: 'momo', type: 'receipt', amount: 20000 },
    { date: 'D', account: 'MTN MoMo', type: 'receipt', amount: 300000 },
  ];
  const totalsFor = (rows, acct) => rows
    .filter(x => x.date === 'D' && x.account === acct && x.type === 'receipt')
    .reduce((s, x) => s + x.amount, 0);

  const listed = txns.filter(x => x.date === 'D').length;
  const counted = ACCOUNTS.reduce((s, a) => s + totalsFor(txns, a), 0);
  t.check(listed === 2, 'both rows appear in the day list');
  t.check(counted === 20000, `while only ${counted} of 320,000 reaches any account total`);
  t.check(320000 - counted === 300000, 'leaving the agent payment missing from every balance');

  const fixed = txns.map(x => ({ ...x, account: x.account === 'MTN MoMo' ? 'momo' : x.account }));
  t.check(ACCOUNTS.reduce((s, a) => s + totalsFor(fixed, a), 0) === 320000,
    'and with the account corrected, all of it counts');
}

process.exit(t.done() ? 1 : 0);
