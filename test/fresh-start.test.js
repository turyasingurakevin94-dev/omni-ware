#!/usr/bin/env node
'use strict';
/*
 * A fresh start (0146), read where no database is at hand.
 * test/fresh-start-db.test.js runs it against a real one.
 *
 *   1. The two steps are the operator's: no app login may call them, and
 *      each is a dry run unless told otherwise.
 *   2. The running records kept in the settings stay behind.
 *   3. The runbook says what to paste, in order, and that the old shop is
 *      never deleted; the decision-rights table holds the number.
 *   4. Photos are shared with the old shop, so the console only ever
 *      removes a photo from its own shop's storage folder.
 *
 * Run: node test/fresh-start.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('a fresh start');
const mig = read('supabase/migrations/0146_fresh_start.sql');
const doc = read('docs/fresh-start.md');
const rights = read('docs/decision-rights.md');
const src = read('index.html');

/* ---------------- 1. the operator's, and a dry run first ---------------- */
for (const sig of ['ow_fs_copy(text, uuid, uuid, text, jsonb, boolean)', 'ow_fresh_start(uuid, text, boolean)', 'ow_fresh_start_move(uuid, uuid, boolean)']) {
  t.check(mig.includes(`revoke all on function ${sig} from public, anon, authenticated;`), `${sig.split('(')[0]}: no app login may call it`);
}
t.check(/function ow_fresh_start\(p_from uuid, p_name text, p_for_real boolean default false\)/.test(mig)
  && /function ow_fresh_start_move\(p_from uuid, p_to uuid, p_for_real boolean default false\)/.test(mig), 'both steps are a dry run unless told otherwise');
t.check((mig.match(/raise exception using errcode = 'OWFSD'/g) || []).length === 2 && (mig.match(/exception when sqlstate 'OWFSD' then/g) || []).length === 2,
  'a dry run undoes its work by its own error, and only that error is caught');
t.check(!/security definer/i.test(mig), 'none of them runs with powers beyond the operator\'s own');
t.check(/'customers', p_from, v_to, 'true', '\{"debt": 0\}'\)/.test(mig), 'every customer\'s debt starts at 0');
t.check(!/'(stock|stock_lots|stock_log|cash_txns|cash_days|saved_quotes|purchase_invoices|customer_debt_log|loans|dues)', p_from/.test(mig),
  'no stock, cash, order, bill, debt history, loan or wage row is ever copied');
t.check(/'agents', p_from, v_to, 'x\.retired_at is null', '\{"user_id": null\}'\)/.test(mig), 'an agent\'s login never opens two shops (agents_user_unique)');

/* ---------------- 2. the settings ---------------- */
{
  const keys = (/history_keys text\[\] := array\[([\s\S]*?)\];/.exec(mig) || [, ''])[1].match(/'([a-zA-Z]+)'/g).map((k) => k.slice(1, -1));
  const logs = ['dayLog', 'buyHolds', 'buyOrders', 'stockCounts', 'debtChases', 'chaseLog', 'msgUseLog', 'waPins', 'waSnooze', 'waNotes', 'analysisMarks'];
  t.check(logs.every((k) => keys.includes(k)), 'the running records kept in the settings stay behind');
  t.check(logs.every((k) => new RegExp(`${k}:d\\.preset`).test(src)), 'and each is still a key the console saves');
  t.check(!keys.some((k) => ['categories', 'units', 'defaultMarkup', 'creditHold', 'priceReview', 'shopLegalName'].includes(k)), 'while categories, units, markups, policies and the letterhead come across');
}

/* ---------------- 3. the runbook ---------------- */
{
  const at = (s) => doc.indexOf(s);
  const steps = ["npm run backup", "select * from ow_fresh_start('<old shop id>', 'Mukasa Hardware');",
    "select * from ow_fresh_start('<old shop id>', 'Mukasa Hardware', true);", "select * from ow_fresh_start_move('<old shop id>', '<new shop id>');",
    "select * from ow_fresh_start_move('<old shop id>', '<new shop id>', true);"];
  t.check(steps.every((s) => at(s) >= 0) && steps.every((s, i) => !i || at(s) > at(steps[i - 1])), 'the runbook gives every step to paste, in order: back up, look, do, look, move');
  t.check(/The old shop is never deleted/.test(doc) && /delete from shops where id = '<new shop id>';/.test(doc), 'and says the old shop is never deleted, and how to undo a copy before the move');
  t.check(/^\| 0146 \| A fresh start/m.test(rights) && /docs\/fresh-start\.md/.test(rights), 'the decision-rights table holds 0146 and points at the runbook');
}

/* ---------------- 4. a shared photo is never removed from the other shop ---------------- */
{
  const removed = [];
  const env = {
    PRODUCT_IMAGE_URL_PREFIX: 'https://x.supabase.co/storage/v1/object/public/product-images/',
    PRODUCT_IMAGE_BUCKET: 'product-images', currentShopId: 'new-shop', console,
    sb: { storage: { from: () => ({ remove: async (paths) => { removed.push(...paths); return { error: null }; } }) } },
  };
  const api = compileScope([extractFunction(src, 'productImageStoragePath', 'index.html'), extractFunction(src, 'deleteProductImageIfStored', 'index.html')],
    env, ['deleteProductImageIfStored']);
  (async () => {
    await api.deleteProductImageIfStored(env.PRODUCT_IMAGE_URL_PREFIX + 'new-shop/a.jpg');
    await api.deleteProductImageIfStored(env.PRODUCT_IMAGE_URL_PREFIX + 'old-shop/b.jpg');
    await api.deleteProductImageIfStored('data:image/png;base64,xx');
    t.check(removed.join() === 'new-shop/a.jpg', 'a photo in this shop\'s folder is removed; one shared from the old shop\'s folder is not');
    process.exit(t.done() ? 1 : 0);
  })().catch((e) => { console.error(e); process.exit(1); });
}
