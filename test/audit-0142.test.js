#!/usr/bin/env node
'use strict';
/*
 * 0142 and the app fixes beside it: the audit's section 4 items 4, 5, 7, 9
 * and 11, reproduced on the rig and fixed.
 *
 *   4. accept_stock_count takes a count once, from 'sent'; a surplus lot is
 *      valued at the last cost the shop knew, never nothing.
 *   5. cash_txns_accounts_guard runs on INSERT too: no line on a closed day.
 *   7. sourcing.html saveLead merges the lead's requests with the server's.
 *   9. buyer.html opens the order from a supplier.answered push.
 *  11. owner.html names sales.html as the Sales app.
 *
 * Run: node test/audit-0142.test.js
 */
const { read, createReporter } = require('./_extract');

const t = createReporter('a count once, a closed day closed (0142)');
const sql = read('supabase/migrations/0142_count_once_closed_day.sql');
const fn = name => { const at = sql.indexOf('create or replace function ' + name + '('); if (at < 0) throw new Error('0142 has no ' + name); const open = sql.indexOf('$$', at); return sql.slice(at, sql.indexOf('$$;', open + 2)); };

const lk = fn('ow_last_known_cost');
t.check(/from stock_lots l where l\.shop_id = p_shop_id and l\.key = p_key and l\.cost is not null order by l\.id desc limit 1/.test(lk) && /from stock_log g where g\.shop_id = p_shop_id and g\.key = p_key and g\.cost is not null and g\.type in \('restock', 'correction'\) order by g\.id desc limit 1/.test(lk) && /select min\(coalesce\(p\.wholesale, p\.retail\)\) from prices p/.test(lk), 'the last cost known: newest lot, else newest restock or correction, else the lowest list price');
const ac = fn('accept_stock_count');
t.check(/if c\.status = 'accepted' then return jsonb_build_object\('ok', true, 'changed', 0, 'already', true\); end if;/.test(ac), 'an accepted count stays as it was');
t.check(/if c\.status = 'recount' then\s*raise exception 'This count was sent back for a recount — accept the recount when it comes\.'/.test(ac) && /if c\.status is distinct from 'sent' then/.test(ac), "only a count that is 'sent' is accepted, and a recount is refused with the reason");
t.check(/v_cost := ow_last_known_cost\(c\.shop_id, k, l ->> 'productId', l ->> 'variantIdx'\);\s*insert into stock_lots \(shop_id, key, qty, cost\) values \(c\.shop_id, k, delta, v_cost\);/.test(ac), 'a surplus lot takes that cost');
t.check(/log_id := ow_next_row_id\(c\.shop_id, 'row:stock_log', 0\);/.test(ac) && !/insert into entity_id_counters/.test(ac), 'the log id comes from the one allocator (0138)');
t.check(/' · surplus valued at ' \|\| ow_money\(v_cost\)/.test(ac) && /' · surplus, no cost known'/.test(ac) && /case when delta > 0 then v_cost end\);/.test(ac), 'the log line says what the surplus was valued at, and carries the cost');
t.check(/for lot in select id, qty from stock_lots where shop_id = c\.shop_id and key = k order by id for update loop/.test(ac), 'the lots taken are locked');

const g = fn('cash_txns_accounts_guard');
t.check(/if tg_op = 'INSERT' then\s*if cash_day_is_closed\(new\.shop_id, new\.date\) then\s*raise exception 'That day is closed\. Reopen it from Days first\.'/.test(g), 'an Accounts login cannot insert a line on a closed day');
t.check(/create trigger cash_txns_accounts_guard before insert or update on cash_txns/.test(sql), 'the guard runs on insert and update');

const sourcing = read('sourcing.html');
t.check(/function mergeRequests\(server, local\)\{/.test(sourcing) && /const cur = await sb\.from\('sourcing_leads'\)\.select\('requests'\)\.eq\('shop_id', S\.shopId\)\.eq\('id', l\.id\)\.maybeSingle\(\);\s*if \(cur\.error\) throw cur\.error;\s*if \(cur\.data\) l\.requests = mergeRequests\(cur\.data\.requests, l\.requests\);/.test(sourcing), "sourcing: a lead's requests are merged with the server's before the save");
{
  const src = sourcing.slice(sourcing.indexOf('function mergeRequests(server, local){'), sourcing.indexOf('async function saveLead(l){'));
  const merge = new Function(src + '; return mergeRequests;')();
  const server = [{ at: '1', source: 'sourcing.ask', customerId: 'C1', qty: 2 }, { at: '2', source: 'sourcing.ask', customerId: 'C2', qty: 5 }];
  const local = [{ at: '1', source: 'sourcing.ask', customerId: 'C1', qty: 2, withdrawn: true }];
  const out = merge(server, local);
  t.check(out.length === 2 && out[0].withdrawn === true && out[1].customerId === 'C2', "an ask Sales appended meanwhile is kept, and this phone's withdrawal of its own entry lands");
}
t.check(/else if \(d\.kind === 'supplier\.answered'\) \{ const q = quoteById\(id\); if \(q\) at\('order', \{ id: Number\(q\.id\) \}\); else at\('plan', \{\}\); \}/.test(read('buyer.html')), "buyer: a supplier's answer opens the order");
t.check(/sales:\s*\{ label: 'Sales',[^\n]*app: 'sales\.html' \}/.test(read('owner.html')), 'owner: the Sales app is sales.html');
t.check(/\| 0142 \| /.test(read('docs/decision-rights.md')), 'docs/decision-rights.md reserves 0142 for it');

process.exit(t.done() ? 1 : 0);
