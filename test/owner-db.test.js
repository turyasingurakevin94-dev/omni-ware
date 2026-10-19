#!/usr/bin/env node
'use strict';
/*
 * Migration 0127, the Owner app's part of the database.
 *
 * - A role's task switched off in one shop is refused by has_task, so
 *   every guard and function refuses it -- not only an app's button -- and
 *   a push addressed by that task no longer reaches the role.
 * - The owner's settings change one key at a time, owner or admin only,
 *   and each change is logged.
 * - Stepping in goes through the role's own function, so its guards and
 *   its log line are the role's, and the new line points at the old one.
 * - The digest goes to each shop at its own hour.
 * - A console save that leaves out the digest hour or the Manager's credit
 *   hold keeps them.
 *
 * The functions were run against Postgres 16 while this was written; this
 * test holds the shape so a later edit cannot quietly undo it.
 *
 * Run: node test/owner-db.test.js   (or: npm test)
 */
const { read, createReporter } = require('./_extract');
const t = createReporter('owner db (0127)');
const sql = read('supabase/migrations/0127_owner_app.sql');
// One function's text: from its create line to the $$; that closes its body.
const fn = name => { const at = sql.indexOf('create or replace function ' + name + '('); if (at < 0) throw new Error('0127 has no ' + name); const open = sql.indexOf('$$', at); const end = sql.indexOf('$$;', open + 2); if (open < 0 || end < 0) throw new Error('no body for ' + name); return sql.slice(at, end + 3); };

/* switches */
{
  t.check(/create table if not exists shop_task_off \([^;]*primary key \(shop_id, role, task\)/.test(sql), 'a switch is one row per shop, role and task');
  const has = fn('has_task');
  t.check(/m\.role in \('owner', 'admin'\)/.test(has) && /not exists \(select 1 from shop_task_off o[\s\S]*o\.shop_id = p_shop_id and o\.role = m\.role and o\.task = p_task\)/.test(has),
    'has_task: the owner and admins hold every task; a role holds a task unless this shop switched it off');
  const rec = fn('ow_push_recipients');
  t.check(/not exists \(select 1 from shop_task_off x where x\.shop_id = o\.shop_id and x\.role = m\.role and x\.task = o\.to_task\)/.test(rec), 'a push by task does not reach a role whose task is off');
  const set = fn('owner_set_task');
  t.check(/if not is_shop_admin\(p_shop_id\) then/.test(set) && /from role_tasks where role = p_role and task = p_task/.test(set), 'only the owner switches, and only a task the role can be given');
  t.check(/owner_log\(p_shop_id, 'role\.tasks'/.test(set), 'each switch is in the log');
  t.check(!/insert into shop_task_off[^;]*;[\s\S]*create policy[^;]*for (insert|update|delete|all)/.test(sql) && /create policy "members read the switches" on shop_task_off\s+for select/.test(sql), 'members read the switches; nobody writes them but owner_set_task');
}
/* settings */
{
  const p = fn('owner_set_preset');
  t.check(/if not is_shop_admin\(p_shop_id\) then/.test(p), 'the owner\'s settings are the owner\'s (or an admin\'s)');
  ['priceReview', 'digestHour', 'shopLegalName', 'receiptFooter', 'autoPrintReceipt', 'categories', 'units', 'locations', 'incomeCategories', 'expenseCategories'].forEach(k =>
    t.check(new RegExp("'" + k + "'").test(p), `${k} is one of them`));
  t.check(/else\s+raise exception 'That setting is not one the owner sets here\.'/.test(p), 'and nothing else is');
  t.check(/presets = coalesce\(app_settings\.presets, '\{\}'::jsonb\) \|\| jsonb_build_object\(p_key, v_val\)/.test(p), 'one key changes; the rest of the row is left as it was');
  t.check(/'targetPerPeriod', \(p_value ->> 'perDay'\)::int \* 26/.test(p), 'prices a day keeps the console\'s month figure in step (Sourcing reads perDay, else targetPerPeriod / 26)');
  t.check(/perform owner_log\(p_shop_id, v_task,/.test(p), 'every change is logged');
}
/* stepping in */
{
  const s = fn('owner_step_in');
  t.check(/if not is_shop_admin\(l\.shop_id\) then/.test(s), 'only the owner steps in');
  t.check(/set_product_markup\(l\.shop_id, l\.ref ->> 'id', v_val\)/.test(s) && /set_shop_preset\(l\.shop_id, v_key, v_val\)/.test(s), 'through the role\'s own function, so its guards and its log apply');
  t.check(/coalesce\(p_value, l\.before\)/.test(s), 'no value puts back what the log says was there');
  t.check(/errcode = '0A000'/.test(s) && /not built yet/.test(s), 'a kind of decision not built here is refused by name');
  t.check(/update decision_log set steps_in = p_log_id/.test(s) && /alter table decision_log add column if not exists steps_in uuid;/.test(sql), 'the new line points at the line it answers');
}
/* the digest */
{
  const dg = fn('ow_owner_digest');
  t.check(/presets -> 'digestHour'/.test(dg) && /, 19\)/.test(dg), 'the digest goes at the shop\'s own hour, 19:00 when unset');
  t.check(/not in \('owner', 'admin'\)/.test(dg), 'it counts the decisions made for the owner, not their own');
  t.check(/'digest:' \|\| d/.test(dg) && /'owner'/.test(dg), 'once a day, to the owner');
  t.check(/cron\.schedule\('ow-owner-digest', '0 \* \* \* \*'/.test(sql), 'and the job looks every hour');
}
/* the console's whole-row save */
{
  const k = fn('app_settings_keep_role_keys');
  t.check(/array\['digestHour', 'creditHold'\]/.test(k) && /before update on app_settings/.test(sql), 'a save without digestHour or creditHold keeps them');
  t.check(/'\{priceReview,perDay\}'/.test(k), 'and a priceReview without perDay keeps its perDay');
}
/* grants */
['owner_set_task(uuid, text, text, boolean)', 'owner_set_preset(uuid, text, jsonb)', 'owner_step_in(uuid, jsonb)'].forEach(sig => {
  t.check(sql.includes('revoke all on function ' + sig + ' from public, anon;') && sql.includes('grant execute on function ' + sig + ' to authenticated;'), `${sig.split('(')[0]}: signed-in callers only`);
});
t.check(sql.includes('revoke all on function owner_log(uuid, text, text, jsonb, jsonb, jsonb) from public, anon, authenticated;'), 'owner_log is called from inside the database only');

process.exit(t.done() ? 1 : 0);
