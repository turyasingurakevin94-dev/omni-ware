#!/usr/bin/env node
'use strict';
/*
 * 0141: the treasurer's cash-first actions are one write each.
 *
 * accounts.html wrote the cash line first (addCash) and then the row it
 * belonged to: wages and rent, a loan repaid, a loan received, an asset
 * bought, an asset sold or gone, an agent settled. A lost signal between
 * the two left the money in the book with nothing against it. Six functions
 * now do each in one transaction, with the owner's log line, and hand the
 * phone back the rows they wrote.
 *
 * What this pins:
 *   1. Each function: its task, the cash line's category and words, the
 *      row it writes, the log line, what it hands back.
 *   2. The app calls each, takes the rows back, and no longer writes the
 *      pieces by hand; addCash stays for the single-line actions only.
 *
 * Run: node test/audit-0141.test.js
 */
const { read, createReporter } = require('./_extract');

const t = createReporter("the treasurer's one-write actions (0141)");
const sql = read('supabase/migrations/0141_accounts_one_write.sql');
const acc = read('accounts.html');
const fn = name => { const at = sql.indexOf('create or replace function ' + name + '('); if (at < 0) throw new Error('0141 has no ' + name); const open = sql.indexOf('$$', at); return sql.slice(at, sql.indexOf('$$;', open + 2)); };

/* ---------------- 1. the functions ---------------- */
t.check(/insert into decision_log \(shop_id, by, by_name, role, task, what, amount, ref, after\)\s*values \(p_shop_id, auth\.uid\(\), ow_staff_name_of\(auth\.uid\(\), p_shop_id\), 'accounts', p_task, p_what,/.test(fn('ow_accounts_log')), "ow_accounts_log: the owner's log line, in the treasurer's name");
t.check(/id bigint := ow_next_row_id\(p_shop_id, 'row:cash_txn', 0\);/.test(fn('ow_accounts_cash')) && /if not \(p_amount > 0\) then raise exception 'A cash line is never zero\.'/.test(fn('ow_accounts_cash')) && /entered_by, photo\)/.test(fn('ow_accounts_cash')), 'ow_accounts_cash: a cash line from the one sequence, never zero, with the photo when there is one');

const pd = fn('pay_dues');
t.check(/has_task\(p_shop_id, 'payroll\.run'\)/.test(pd), 'pay_dues: payroll.run');
t.check(/select \* into row from dues where shop_id = p_shop_id and kind = d ->> 'kind' and ref_id = d ->> 'refId' and period = d ->> 'period' for update;/.test(pd) && /did := ow_next_row_id\(p_shop_id, 'row:due', 0\);/.test(pd), "a due the console only imagined gets its row, by (kind, person, month) first");
t.check(/pay := round\(least\(want, greatest\(0, coalesce\(row\.amount, 0\) - coalesce\(row\.paid, 0\)\)\)\);/.test(pd), 'each is paid its balance, never more than asked');
t.check(/kind_label := 'Rent'; cat := 'Rent';/.test(pd) && /kind_label := 'Wages'; cat := 'Salaries & Wages';/.test(pd) && /kind_label \|\| ' — ' \|\| nm \|\| ' — ' \|\| ow_period_word\(row\.period\)/.test(pd), 'as Rent or Salaries & Wages, "Wages — name — October 2026"');
t.check(/update dues set paid = coalesce\(paid, 0\) \+ pay, payload = coalesce\(payload, '\{\}'::jsonb\) \|\| jsonb_build_object\('payments', pays\)/.test(pd) && /'payroll\.run', 'Paid ' \|\| lower\(kind_label\)/.test(pd), 'the due carries the payment and the owner is told');
t.check(/to_char\(to_date\(p_period \|\| '-01', 'YYYY-MM-DD'\), 'FMMonth YYYY'\)/.test(fn('ow_period_word')), 'the month in words, as the app shows it');

const rl = fn('repay_loan');
t.check(/has_task\(p_shop_id, 'loan\.edit'\)/.test(rl) && /select \* into l from loans where shop_id = p_shop_id and id = p_loan_id for update;/.test(rl) && /if l\.closed_on is not null then raise exception 'That loan is closed\.'/.test(rl), 'repay_loan: loan.edit, the loan locked, a closed loan refused');
t.check(/'payment', 'Loan Repayment', amt, coalesce\(l\.lender, 'Loan'\) \|\| ' — repayment'/.test(rl) && /jsonb_build_object\('date', ow_today\(\), 'amount', amt, 'note', '', 'cashTxnId', cid\)/.test(rl), 'a Loan Repayment line and the repayment on the loan, linked');
const rv = fn('receive_loan');
t.check(/'receipt', 'Loan Received', amt - fees, lender \|\| case when fees > 0 then ' — ' \|\| ow_money\(fees\) \|\| ' kept in fees' else '' end/.test(rv) && /if not \(amt - fees > 0\) then raise exception 'The fees are the whole loan; nothing came in\.'/.test(rv), 'receive_loan: the money in net of fees, the fees named');
t.check(/lid := ow_next_row_id\(p_shop_id, 'row:loan', 0\);/.test(rv) && /'reducing_balance', months, fees, 1000, 'monthly', 0, ow_today\(\), null, null, cid, jsonb_build_object\('repayments', '\[\]'::jsonb\)\)/.test(rv), 'the loan row as the app wrote it, pointing at its cash line');

const ba = fn('buy_asset'), da = fn('dispose_asset');
t.check(/has_task\(p_shop_id, 'asset\.edit'\)/.test(ba) && /'payment', 'Equipment purchase', cost, nm \|\| ' — ' \|\| cat, null, p_photo\)/.test(ba) && /aid := ow_next_row_id\(p_shop_id, 'row:fixed_asset', 0\);/.test(ba) && /'straight_line', years \* 12, null, 0, null, null/.test(ba), 'buy_asset: asset.edit, an Equipment purchase line with the receipt photo, the asset straight-line over the years');
t.check(/if coalesce\(p_how, ''\) not in \('sold', 'stolen', 'gone'\) then raise exception 'Sold, stolen or thrown away\?'/.test(da) && /raise exception '% is off the books already\.', a\.name/.test(da), 'dispose_asset: sold, stolen or gone; once');
t.check(/if proceeds > 0 then\s*cid := ow_accounts_cash\(p_shop_id, p_account, 'receipt', 'Asset Sale', proceeds, 'Sold ' \|\| a\.name\);/.test(da) && /update fixed_assets set disposed_on = ow_today\(\), disposal_proceeds = case when proceeds > 0 then proceeds else null end, disposal_cash_txn_id = cid/.test(da), 'an Asset Sale line when sold, the disposal on the asset');
t.check(/' \(on the books at ' \|\| ow_money\(p_nbv\) \|\| '\)'/.test(da), "the owner's line says what it stood at");

const sa = fn('settle_agent');
t.check(/has_task\(p_shop_id, 'agent\.pay'\)/.test(sa) && /coalesce\(s\.payload ->> 'agentPaymentStatus', ''\) <> 'paid' and coalesce\(s\.payload ->> 'shopConfirmedAt', ''\) <> ''/.test(sa) && /if coalesce\(ag\.payment_term, 'prepay'\) = 'prepay' then/.test(sa), 'settle_agent: agent.pay; a prepay agent\'s confirmed, unpaid orders');
t.check(/'receipt', 'Agent Payment', owed, 'Cash payment from ' \|\| coalesce\(ag\.name, ag\.id\) \|\| ' — order #' \|\| q\.id, q\.id\)/.test(sa) && /jsonb_build_object\('payments', pays, 'agentPaymentStatus', 'paid'\)/.test(sa), 'the cash for each order onto the order, marked paid');
t.check(/from_acct := case when cash_in - paid_out >= 0 then 'cash' else coalesce\(nullif\(btrim\(p_account\), ''\), 'cash'\) end;/.test(sa) && /update agent_commission_claims set status = 'paid', paid_at = now\(\), cash_txn_id = cid/.test(sa), 'each claim paid, from cash when the agent nets it off, else the account picked');
t.check(/raise exception 'Nothing is due between the shop and %\.', coalesce\(ag\.name, 'this agent'\)/.test(sa), 'nothing due is said, not written');
for (const g of ['pay_dues(uuid, jsonb, text)', 'repay_loan(uuid, bigint, numeric, text)', 'receive_loan(uuid, jsonb, text)', 'buy_asset(uuid, jsonb, text, text)', 'dispose_asset(uuid, bigint, text, numeric, text, numeric)', 'settle_agent(uuid, text, text)']) {
  t.check(sql.includes(`grant execute on function ${g} to authenticated;`), `${g.split('(')[0]} granted`);
}

/* ---------------- 2. the app ---------------- */
const LAND = "(d.cashRows || []).forEach(row => { if (!txnById(row.id)) D().cashTxns.push(rowToTxn(row)); });";
t.check(acc.split(LAND).length - 1 >= 7, 'every one-write action takes the cash lines it wrote into the phone\'s copy once');
t.check(/sb\.rpc\('pay_dues', \{ p_shop_id: S\.shopId, p_dues: dues, p_account: a\.acct \}\)/.test(acc) && /id: d\.virtual \? null : d\.id, kind: d\.kind, refId: String\(d\.refId\), period: d\.period/.test(acc) && /pay: Math\.round\(P\.bal\(d\)\)/.test(acc), 'payroll: the month\'s ticked dues, imagined ones with no id, each with its balance');
t.check(/\(d\.dues \|\| \[\]\)\.forEach\(row => \{ const got = rowToDue\(row\)/.test(acc), 'and the dues come back onto the phone');
t.check(/sb\.rpc\('repay_loan', \{ p_shop_id: S\.shopId, p_loan_id: Number\(l\.id\), p_amount: amt, p_account: a\.acct \}\)/.test(acc) && /if \(d\.loan\) Object\.assign\(l, rowToLoan\(d\.loan\)\);/.test(acc), 'a repayment is the one call');
t.check(/sb\.rpc\('receive_loan', \{ p_shop_id: S\.shopId, p_row: \{ lender, principal: amt, ratePct: a\.rate == null \? 20 : a\.rate, termMonths: a\.months \|\| 12, fees \}, p_account: a\.acct \}\)/.test(acc) && /if \(d\.loan\) D\(\)\.loans\.push\(rowToLoan\(d\.loan\)\);/.test(acc), 'a loan received is the one call');
t.check(/sb\.rpc\('buy_asset', \{ p_shop_id: S\.shopId, p_row: \{ name, category: a\.cat, cost, years: a\.years \|\| 5, from: a\.from \|\| '' \}, p_account: a\.acct, p_photo: a\.photo \|\| null \}\)/.test(acc) && /if \(d\.asset\) D\(\)\.fixedAssets\.push\(rowToAsset\(d\.asset\)\);/.test(acc), 'an asset bought is the one call, photo and all');
t.check(/sb\.rpc\('dispose_asset', \{ p_shop_id: S\.shopId, p_asset_id: Number\(x\.id\), p_how: a\.how \|\| 'sold', p_proceeds: proceeds, p_account: a\.acct, p_nbv: nbv \}\)/.test(acc) && /if \(d\.asset\) Object\.assign\(x, rowToAsset\(d\.asset\)\);/.test(acc), 'an asset sold or gone is the one call');
t.check(/sb\.rpc\('settle_agent', \{ p_shop_id: S\.shopId, p_agent_id: String\(a\.aid\), p_account: a\.acct \|\| 'cash' \}\)/.test(acc), 'an agent settled is the one call');
const two = [...acc.matchAll(/await addCash\(\{[^\n]*\n[^\n]*await sb\.from\('(dues|loans|fixed_assets|agent_commission_claims|saved_quotes)'\)/g)].length;
t.check(two === 0, 'no action writes a cash line and then one of those rows by hand');
const addCashLeft = [...acc.matchAll(/await addCash\(/g)].length;
t.check(addCashLeft === 2 && /await addCash\(\{ account: a\.acct, type: 'payment', category, amount: amt, description: what, photo: a\.photo \}\);/.test(acc) && /await addCash\(\{ account: a\.acct, type: 'receipt', category, amount: amt, description: \(a\.note \|\| ''\)\.trim\(\) \|\| category \}\);/.test(acc), 'addCash stays for the two single-line actions only: an expense, other income');
t.check(!/ensureDue\(x\.d\)/.test(acc) && /ensureDue\(dueFor\('wage', a\.sid, curPeriod\(\)\)\)/.test(acc), 'ensureDue serves only the absence screen now');

t.check(/\| 0141 \| /.test(read('docs/decision-rights.md')), 'docs/decision-rights.md reserves 0141 for it');

process.exit(t.done() ? 1 : 0);
