#!/usr/bin/env node
'use strict';
/*
 * The sales desk: a login that sells, and nothing else.
 *
 * Until 0113 a login was the owner, a picker on the worker app, or an
 * agent. A shop that hired somebody to sell had to hand them the owner's
 * password. The access plan (the design canvas, "People & access") gives
 * Sales: quotes, orders, customers, chats and taking a customer's
 * payment -- and keeps cost, margin, stock, supplier bills, the cash
 * book, credit terms, invoicing and voiding with the owner.
 *
 * Four gates hold that line, and each is checked here against its own
 * source rather than restated:
 *
 *   1. THE DATABASE (0113)  role_tasks + has_task(); restrictive write
 *      policies re-drawn on exactly the four tables Sales writes; two
 *      triggers that refuse an invoice, a void, a raised debt or a
 *      credit term from a Sales login. Everything else stays 0083's.
 *   2. THE SERVER FUNCTIONS  wa-send lets any member reply but only the
 *      owner broadcast or rewire; invite-worker gives a Sales person a
 *      'sales' membership and moves an existing login between the floor
 *      and the desk -- never an owner's or an admin's.
 *   3. THE SAVE  a sales-desk save sends only the tables Sales writes,
 *      names what it held back, and keeps the half-typed quote on the
 *      device rather than in the shop's settings row.
 *   4. THE SCREEN  six screens, no cost or margin, and the owner's
 *      buttons say whose work they are.
 *
 * The database half is also run for real, against Postgres, by
 * test/sales-role-db.test.js when OW_PG is set.
 *
 * Run: node test/sales-desk.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('the sales desk');
const eq = (a, b, m) => t.check(JSON.stringify(a) === JSON.stringify(b), `${m} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const html = read('index.html');
/* Outside the desk's own block, every read of the flag is guarded --
   `typeof salesDesk !== 'undefined' && salesDesk` -- because the rest of
   the suite lifts single functions into a sandbox where the flag does
   not exist, and there a missing desk must read as the owner's session.
   The checks below read the source with those guards folded back, so
   they pin what the code DOES; the guards themselves are pinned in 4. */
const src = html
  .split("typeof salesDesk !== 'undefined' && salesDesk").join('salesDesk')
  .replace(/(?<!if)\(salesDesk\)/g, 'salesDesk')
  .split("typeof salesDeskRefuses === 'function' && ").join('')
  .split("typeof salesDeskAllows === 'function' && ").join('')
  .split("if(typeof salesDeskFilterOps === 'function') ").join('')
  .split("if(typeof salesDeskOwnDraft === 'function') ").join('')
  .split("(typeof salesDeskAllows !== 'function' || salesDeskAllows(resolveTab(savedTab)))").join('salesDeskAllows(resolveTab(savedTab))');
const shared = read('shared-worker.js');
const mig = read('supabase/migrations/0113_sales_role.sql');
const migCode = mig.split(/\r?\n/).filter((l) => !/^\s*--/.test(l)).join('\n');
const waSend = read('supabase/functions/wa-send/index.ts');
const invite = read('supabase/functions/invite-worker/index.ts');

/* ---------- 1. the database ---------------------------------------- */
{
  t.check(/check \(role in \('owner', 'admin', 'staff', 'sales'/.test(migCode),
    'a membership may be sales');
  const tasks = [...migCode.matchAll(/\('sales', '([a-z.]+)'\)/g)].map((m) => m[1]).sort();
  eq(tasks, ['customer.edit', 'msg.reply', 'order.move', 'payment.receive', 'quote.make', 'statement.send'],
    'Sales holds exactly the tasks the access plan gives it');
  t.check(!/'sales', '(price\.set|cash\.record|cash\.close|supplier\.|stock\.|msg\.broadcast|sale\.counter)/.test(migCode),
    'and none of the owner\'s: prices, the cash book, suppliers, stock, broadcasts, the till');
  t.check(/create or replace function has_task[\s\S]*?security definer[\s\S]*?m\.role in \('owner', 'admin'\)/.test(migCode),
    'has_task answers yes for the owner and admin always, from shop_members, as a definer');
  t.check(/create policy "anyone signed in reads the task list" on role_tasks\s+for select/.test(migCode)
    && !/on role_tasks\s+(as \w+ )?for (insert|update|delete|all)/.test(migCode),
    'the task list can be read by a login but written by none — only the SQL editor');

  const redrawn = [...migCode.matchAll(/create policy "owner or sales (?:writes|updates)" on ([a-z_]+)/g)].map((m) => m[1]);
  eq([...new Set(redrawn)].sort(), ['cash_txns', 'customer_debt_log', 'customers', 'statements_sent'],
    'the write walls are re-drawn on four tables, and only four');
  t.check((migCode.match(/create policy "owner or sales[^"]*" on [a-z_]+\s+as restrictive/g) || []).length === redrawn.length,
    'every re-drawn policy is RESTRICTIVE — it narrows the members\' grant, never widens it');
  t.check(/category in \('Debt Payment', 'Invoice Payment', 'Customer Payment'\)/.test(migCode)
    && /type = 'receipt' and amount > 0/.test(migCode),
    'a Sales cash row is a customer payment received — not a cash-out, a till sale or a loan');
  t.check(/has_task\(shop_id, 'payment\.receive'\) and type = 'payment'/.test(migCode),
    'a Sales debt-log line is a payment, never a charge');
  t.check(!/"owner updates only" on (cash_txns|customer_debt_log)/.test(migCode.replace(/-- "owner updates only"[^\n]*/g, ''))
    || !/drop policy if exists "owner updates only" on (cash_txns|customer_debt_log)/.test(migCode),
    'editing a cash row or a debt line after the fact stays the owner\'s');
  t.check(!/"owner only deletes"/.test(migCode), 'deleting is not touched — it stays owner-only (0058)');
  t.check(!/\bplaces\b/.test(migCode), 'map pins stay the owner\'s — least access, nothing Sales does not need');

  t.check(/create trigger saved_quotes_sales_guard before insert or update on saved_quotes/.test(migCode)
    && /new\.invoiced is distinct from old\.invoiced or new\.voided is distinct from old\.voided/.test(migCode),
    'an order cannot be invoiced, un-invoiced or voided by a Sales login');
  t.check(/coalesce\(new\.debt, 0\) > coalesce\(old\.debt, 0\)/.test(migCode)
    && /new\.credit_limit is distinct from old\.credit_limit or new\.terms_days is distinct from old\.terms_days/.test(migCode),
    'a Sales login can lower a debt (a payment) but not raise one, and cannot touch credit terms');
  /* The app saves by upsert: Postgres runs the INSERT trigger on the
     proposed row even when it becomes an update. Without this exit a
     payment on an existing customer would be refused as "a new customer
     owing something". Caught on a real database, not by reading. */
  eq((migCode.match(/if tg_op = 'INSERT' and exists \(select 1 from/g) || []).length, 2,
    'both triggers judge an upsert of an existing row as the update it becomes');
  t.check(/if not is_shop_sales\(new\.shop_id\) then return new; end if;/.test(migCode),
    'the triggers bind Sales only — the worker app, agents and the Edge Functions are untouched');
  t.check(/drop trigger if exists customers_sales_guard/.test(migCode) && /drop policy if exists "owner or sales writes" on customers/.test(migCode),
    'the file can be run again: everything is dropped before it is made');
  t.check(/select role, count\(\*\) from shop_members/.test(mig) && /ROLLBACK/.test(mig),
    'and it carries the look-first query and the way back');
}

/* ---------- 2. the server functions --------------------------------- */
{
  const replies = (/const REPLY_ACTIONS = \[([^\]]*)\]/.exec(waSend) || ['', ''])[1];
  eq([...replies.matchAll(/"([a-z-]+)"/g)].map((m) => m[1]).sort(), ['send', 'send-catalog', 'send-image', 'status'],
    'any member may reply in a chat');
  t.check(/if \(!REPLY_ACTIONS\.includes\(action\)\)[\s\S]{0,200}rpc\("is_shop_admin"/.test(waSend),
    'and everything else — a broadcast, re-registering the number, templates — asks for the owner');
  const gateAt = waSend.indexOf('REPLY_ACTIONS.includes');
  t.check(gateAt > 0 && gateAt < waSend.indexOf('action === "broadcast"') && gateAt < waSend.indexOf('action === "register"'),
    'asked before any of those actions runs');

  t.check(/select\("id, user_id, role"\)/.test(invite) && /const memberRole = isSales \? "sales" : isBuyer \? "buyer" : isStore \? "store" : "staff"/.test(invite),
    'an invite gives somebody who sells a sales membership, somebody who buys a buyer one, somebody who runs the store a store one, everybody else staff as before');
  t.check(/redirectTo: isSales \? ADMIN_APP_URL : isBuyer \? BUYER_APP_URL : isStore \? STORE_APP_URL : WORKER_APP_URL/.test(invite),
    'and lands a salesperson in the admin app and a buyer in the Buyer app, not the worker app');
  t.check(/const DESK_ROLES = \["staff", "sales", "buyer", "store"\]/.test(invite) && /\.in\("role", DESK_ROLES\)/.test(invite) && /DESK_ROLES\.includes\(member\.role\)/.test(invite),
    'an existing login moves between the floor and the desks only — an owner\'s or admin\'s membership is never touched');
}

/* ---------- 3. the save --------------------------------------------- */
{
  t.check(/key: collectionKey, table: tableName,/.test(shared) && /key: collectionKey, table: tableName, deletes: true,/.test(shared),
    'every sync op names its collection, so the desk can tell them apart before any runs');
  t.check(read('worker-www/shared-worker.js') === shared, 'and the APK copy of shared-worker.js matches');

  const toasts = [];
  const make = (desk) => compileScope([
    extractDeclaration(src, 'SALES_WRITES', 'index.html'),
    extractDeclaration(src, 'SALES_WRITE_NAMES', 'index.html'),
    `var salesDesk = ${desk};`,
    extractDeclaration(src, 'salesHeldBackSaid', 'index.html'),
    extractFunction(src, 'salesDeskFilterOps', 'index.html'),
    extractFunction(src, 'salesDeskRefuses', 'index.html'),
  ], { toast: (m) => toasts.push(m), salesDeskKeepDraft: () => {}, console: { warn() {} } },
  ['salesDeskFilterOps', 'salesDeskRefuses']);

  const ops = () => [
    { key: 'savedQuotes' }, { key: 'customers' }, { key: 'debtLog' }, { key: 'cashTxns' }, { key: 'statementsSent' },
    { key: 'prices', table: 'prices' }, { key: 'stock', table: 'stock' },
    { key: 'customers', table: 'customers', deletes: true },
    { key: 'settings', table: 'app_settings', workingPartsOnly: true },
  ];
  const desk = make(true);
  const a = ops(); desk.salesDeskFilterOps(a);
  eq(a.map((o) => o.key), ['savedQuotes', 'customers', 'debtLog', 'cashTxns', 'statementsSent'],
    'a desk save sends quotes, customers, payments and statements — and nothing else');
  t.check(toasts.length === 1 && /prices/.test(toasts[0]) && /stock/.test(toasts[0]) && /deleting customers/.test(toasts[0]),
    `and NAMES what it held back, deletes included (${JSON.stringify(toasts[0])})`);
  t.check(!/settings/.test(toasts[0]),
    'the quote being typed and the id counters are held back without a word — they are the desk\'s own');
  desk.salesDeskFilterOps(ops());
  eq(toasts.length, 1, 'the same refusal is said once, not on every save');

  const all = ops(); make(false).salesDeskFilterOps(all);
  eq(all.length, 9, 'the owner\'s save is untouched');

  const sync = extractFunction(src, 'syncDataToServer', 'index.html');
  t.check(/addSettingsDiffOp\(ops, shopId, rows\.settings\);\s*salesDeskFilterOps\(ops\);\s*if\(!ops\.length\) return true;/.test(sync),
    'the filter runs after every op is built and before any is sent');

  const settingsOp = extractFunction(src, 'addSettingsDiffOp', 'index.html');
  t.check(/delete c\.quote_draft; if\(c\.presets\) delete c\.presets\.idCounters;/.test(settingsOp)
    && /workingPartsOnly: rulesOnly\(settingsCore\) === rulesOnly\(lastSynced\.settings\)/.test(settingsOp),
    'the settings op knows when only the draft or the counters moved');

  /* The draft: per device, per login, back on every refresh. */
  const store = {};
  const draft = compileScope([
    'var salesDesk = true; var currentShopId = "s1"; var currentUser = { id: "u9" };',
    'var data = { quote: { client: { name: "Kato" }, items: [{ lineId: 1 }] } };',
    extractFunction(src, 'salesDraftKey', 'index.html'),
    extractFunction(src, 'salesDeskKeepDraft', 'index.html'),
    extractFunction(src, 'salesDeskOwnDraft', 'index.html'),
  ], { lsSet: (k, v) => { store[k] = v; }, lsGet: (k) => store[k] || null, todayISO: () => '2026-10-16' },
  ['salesDeskKeepDraft', 'salesDeskOwnDraft', 'salesDraftKey']);
  draft.salesDeskKeepDraft();
  eq(Object.keys(store), ['ow-sales-draft:s1:u9'], 'the half-typed quote is kept per shop and per login');
  const fresh = { quote: { client: { name: 'the owner\'s draft' }, items: [] } };
  draft.salesDeskOwnDraft(fresh);
  eq(fresh.quote.client.name, 'Kato', 'and a refresh brings back the salesperson\'s own, not the shop\'s');

  const boot = extractFunction(src, 'boot', 'index.html');
  t.check(/salesDesk = currentMemberRole === 'sales';\s*data = await loadData\(currentShopId\);\s*salesDeskOwnDraft\(data\);/.test(boot),
    'the desk is decided from the membership before the first load');
  t.check(/if\(!salesDesk\) reportDebtReconciliation/.test(boot) && /if\(!salesDesk && dedupeLoadedPrices/.test(boot)
    && /if\(!salesDesk\) await migrateBase64ProductImages/.test(boot) && /if\(!salesDesk\)\{\s*await backfillMediaLibrary/.test(boot),
    'the owner\'s repairs — debts, prices, media — do not run on the desk, where they could only be refused');
  t.check(/if\(!salesDesk\) runStartupReminders\(\);/.test(boot), 'nor do the owner\'s reminders about rent and repayments');
  const poll = extractFunction(src, 'pollForUpdatesNow', 'index.html');
  t.check(/salesDeskOwnDraft\(fresh\);/.test(poll) && /if\(!salesDesk\) reportDebtReconciliation\(reconcileCustomerDebts\(fresh\)\)/.test(poll),
    'and a background refresh keeps to the same two rules');
}

/* ---------- 4. the screen ------------------------------------------- */
{
  const tabs = eval(extractDeclaration(src, 'SALES_TABS', 'index.html').replace(/^const SALES_TABS = /, ''));
  eq(tabs, ['quote', 'quote-saved', 'invoices', 'customers', 'followups', 'pairings'],
    'six screens: new quote, orders, invoices, customers, messages, what goes with what');
  tabs.forEach((tab) => t.check(new RegExp(`data-tab="${tab}"`).test(src), `${tab} is a real rail destination`));

  /* The guard on every read outside the desk's block. Found by line: the
     block runs from its heading to the end of salesDeskFilterOps. */
  const lines = html.split('\n');
  const from = lines.findIndex((l) => /THE SALES DESK ====/.test(l));
  const to = lines.findIndex((l, i) => i > from && /^function salesDeskFilterOps/.test(l));
  const bare = lines.map((l, i) => ({ l, i })).filter(({ l, i }) => (i < from || i > to + 30)
    && /\bsalesDesk\b/.test(l.replace(/typeof salesDesk !== 'undefined' && salesDesk/g, '').replace(/salesDesk = currentMemberRole === 'sales';/, ''))
    && !/^\s*(\/\/|\*|\/\*)/.test(l) && !/\(salesDeskOwnDraft\)/.test(l));
  t.check(from > 0 && to > from && bare.length === 0,
    `outside the desk's block, every read of the flag is guarded, so a lifted function reads as the owner's (${JSON.stringify(bare.map((b) => b.i + 1))})`);

  const go = extractFunction(src, 'goToTab', 'index.html');
  const guardAt = go.indexOf('if(!salesDeskAllows(tab))');
  t.check(guardAt > 0 && guardAt < go.indexOf("style.display='block'"),
    'every door to a screen passes the desk\'s check before the screen is shown');
  t.check(/if\(salesDesk && tab === 'invoices'\) invSide = 'sales';/.test(go),
    'and Invoices opens on the sales side — supplier bills are the buying desk\'s');

  const refusals = { toggleQuoteInvoiced: /salesDeskRefuses\(q\.invoiced \? 'Taking an invoice back' : 'Invoicing an order'\)/,
    setInvoicesVoided: /salesDeskRefuses\(voided \? 'Voiding an invoice'/ };
  Object.keys(refusals).forEach((fn) => {
    const body = extractFunction(src, fn, 'index.html');
    t.check(refusals[fn].test(body), `${fn} says whose work it is before anything changes`);
  });
  t.check(/OrderFlowBoard\.prototype\.csSell = function \(c, cart, total\) \{\s*\/\/[^\n]*\n[^\n]*\n\s*if \(salesDeskRefuses\('Ringing a counter sale'\)\) return;/.test(src),
    'and so does ringing a counter sale, which takes goods off the shelf');

  const below = extractFunction(src, 'sellBelowCostClause', 'index.html');
  eq((below.match(/if\(salesDesk\) return `\$\{fmtUGX\(sell\)\} is below what this line costs the shop`;/g) || []).length, 2,
    'a line under cost is still flagged on the desk — without saying what it costs');

  /* The desk's hiding rules: every selector from the first to the grid
     override that follows them, each list closed by display:none. */
  const cssFrom = src.indexOf('body.sales-desk-mode .assistant-panel,');
  const css = cssFrom < 0 ? '' : src.slice(cssFrom, src.indexOf('body.sales-desk-mode .q-doc .ow-tbl{', cssFrom));
  t.check(/^[^{]*\{display:none !important;\}[^{]*\{display:none !important;\}\s*@media/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')),
    'the hiding rules are two plain selector lists, each closed by display:none');
  ['#assistantOpenBtn', '#exportBtn', '#importBtn', '#clearBtn', '#c_owe_block', '#c_owes_charge',
    '.q-doc .q-foot-cost', '.q-doc .q-foot-keep', '.qp-keep', '#itemPickerModal .q-sup-file', '#itemPickerModal .q-ip-gauges',
    '.of-cashplan', '.of-auto', '#iv_side [data-side="buys"]'].forEach((sel) =>
    t.check(css.includes('body.sales-desk-mode ' + sel), `${sel} is not drawn on the desk`));
  t.check(/class=\\"of-cashplan\\"/.test(src) && /class=\\"of-pickup\\"/.test(src),
    'the board\'s cash plan and pickup run carry the names the rule hides them by');

  const terms = extractFunction(src, 'cfShowTerms', 'index.html');
  t.check(/el\.disabled = salesDesk;/.test(terms), 'credit terms are shown on the desk, read-only');
  t.check(/\.\.\.\(salesDesk \? \{\} : cfReadTerms\(\)\),/.test(src), 'and a desk save leaves them as the owner set them');
  t.check(/if\(salesDesk\) return val;/.test(extractFunction(src, 'rememberLocation', 'index.html')),
    'a new customer keeps their place without writing the owner\'s list of places');
  t.check(/const asks = salesDesk \? \[\] :/.test(src) && /const asking = q\.length >= NAV_ASK_MIN && !salesDesk;/.test(src),
    'the search box finds screens and never offers the owner\'s Manager');
}

/* ---------- 5. the staff screen ------------------------------------- */
{
  const roles = eval(extractDeclaration(src, 'SF_ROLES', 'index.html').replace(/^const SF_ROLES = /, ''));
  eq(roles.map((r) => r.key).slice(0, 3), ['worker', 'delivery', 'sales'], 'Sells is offered after the two floor roles (Buys follows it)');
  const state = compileScope([extractFunction(src, 'staffDispatchState', 'index.html')],
    { staffAttendanceOn: () => ({ state: 'in' }), todayISO: () => '2026-10-16', staffActiveOrders: () => [], esc: (x) => x },
    ['staffDispatchState']).staffDispatchState;
  eq(state({ role: 'sales', userId: 'u1' }).key, 'sales', 'a salesperson with a login reads as on the sales desk');
  t.check(state({ role: 'sales', userId: 'u1' }).key !== 'free', 'never as Free — the next order is not theirs to take');
  eq(state({ role: 'worker', userId: 'u2' }).key, 'free', 'a picker reads as before');
  const line = compileScope([extractFunction(src, 'staffInLine', 'index.html')],
    { data: { staff: [{ name: 'A', role: 'worker' }, { name: 'B', role: 'sales' }] }, staffDispatchState: () => ({ rank: 0 }) },
    ['staffInLine']).staffInLine;
  eq(line().map((x) => x.s.name), ['A'], 'and is never in the line for the next order');
}

process.exit(t.done() ? 1 : 0);
