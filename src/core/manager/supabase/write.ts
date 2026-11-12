/*
 * The Manager's answers (docs/spec/04-screens-manager-data.md §2, the "New app" column), one per
 * ManagerSource write. Where a server function exists it is the write (it checks the task, locks the
 * ask and logs itself: nothing is logged again from the phone). Where none exists the answer is a
 * patch of the order exactly as manager.html changeOrder (2027) makes it: re-read the one row, refuse
 * when the ask is no longer open, then send ONLY the keys this answer changes through ow_patch_order
 * (0165), a key gone in p_drop. Those patch answers are logged from the phone after the write
 * (W44; §5 Q10 default "phone, as today"); a log line that fails never undoes the answer.
 *
 * Every "already" (a function's {already: true}, "That ask is accepted already.", OWRST) is a clash:
 * "Someone else just did this" (§4a). A function 0184 adds and the database lacks is refused MG-0184.
 */
import { dataError, isDataError } from '../../datasource.ts';
import { money, orderTotal } from '../../money.ts';
import { firstWord, orderNo } from '../../names.ts';
import type { Row, Sb } from '../../supabase/client.ts';
import { orderOf, priceBookOf } from '../../supabase/rows.ts';
import { ok, patchOrder, recordPromise } from '../../supabase/write.ts';
import { addDays } from '../../time.ts';
import type { LimitPick, ManagerSource, Money, PriceWord } from '../source.ts';
import type { Stage, UGX } from '../types.ts';
import { shelfCost } from './asks.ts';
import { agentKey, agentOpen, atZero, creditAskOpen, freeOpen, isLive, lineCost, priceNow, quoteOf, shortLines, shortWaits, waitsPrice, type Q } from './lines.ts';
import { readOne, readOrderRow, type MSession } from './read.ts';
import type { Ctx } from './rows.ts';

const CLASH = 'Someone else just did this';
const clash = () => dataError('clash', CLASH);
const iso = () => new Date().toISOString();
const num = (v: unknown): number => Number(v) || 0;

/** A server function's answer: {already: true} and every "… already" refusal are a clash (§4a). */
async function call<T = Row>(sb: Sb, name: string, args: Row): Promise<T> {
  let d: T;
  try { d = await ok<T>(sb.rpc(name, args)); } catch (e) {
    if (isDataError(e) && e.kind === 'refused' && (e.code === 'OWRST' || /\balready\b/i.test(e.message))) throw clash();
    throw e;
  }
  if (d && typeof d === 'object' && (d as Row).already) throw clash();
  return d;
}

/** A function only 0184 brings: missing → refused MG-0184 "Needs the update". */
async function call0184(sb: Sb, name: string, args: Row): Promise<void> {
  try { await call(sb, name, args); } catch (e) {
    if (isDataError(e) && e.kind === 'missing') throw dataError('refused', 'Needs the update', 'MG-0184');
    throw e;
  }
}

const moneyArgs = (m: Money): { p_choice: string | null; p_account: string } =>
  !m ? { p_choice: null, p_account: 'cash' } : m.how === 'refund' ? { p_choice: 'refund', p_account: m.account } : { p_choice: 'deposit', p_account: 'cash' };

export interface WriteDeps {
  sb: Sb;
  s: MSession;
  /** The last read, for what an answer needs to know (the price book, the asks' rows, who sold to whom). */
  ctx: () => Ctx | null;
}

type Writes = Omit<ManagerSource, 'kind' | 'now' | 'online' | 'session' | 'signIn' | 'signOut' | 'snapshot' | 'live' | 'savedCopy' | 'pushOn'>;

export function managerWrites({ sb, s, ctx }: WriteDeps): Writes {
  const by = () => ({ by: s.userId, byName: s.name });
  const pb = () => { const x = ctx(); return x ? x.pb : priceBookOf([], [], [], [], {}); };
  const raw = () => { const x = ctx(); if (!x) throw dataError('refused', 'Load the shop first', 'MG-001'); return x.raw; };

  /** W44: the owner's log, from the phone, for an answer no function logs. */
  const log = async (task: string, what: string, extra: { amount?: number | null; ref?: Row; before?: unknown; after?: unknown } = {}) => {
    try {
      await sb.from('decision_log').insert({ shop_id: s.shopId, by: s.userId, by_name: s.name, role: s.role, task, what: what.slice(0, 300),
        amount: extra.amount == null ? null : Math.round(extra.amount), ref: extra.ref || null, before: extra.before ?? null, after: extra.after ?? null });
    } catch (_e) { /* the answer stands; the line is a record of it */ }
  };

  /** manager.html:2027 changeOrder: re-read, `fn` false = the ask is no longer open (a clash), send only `keys`. */
  const change = async (id: number, keys: string[] | ((q: Q) => string[]), fn: (q: Q) => boolean | void, status: string | null = null): Promise<Q> => {
    const row = await readOrderRow(sb, s, id);
    if (!row) throw dataError('refused', 'This order is no longer in the books.', 'P0002');
    const q = quoteOf(row);
    if (fn(q) === false) throw clash();
    const patch: Row = {}, drop: string[] = [];
    (typeof keys === 'function' ? keys(q) : keys).forEach((k) => { if (q[k] === undefined) { if (row.payload && k in row.payload) drop.push(k); } else patch[k] = q[k]; });
    const saved = await patchOrder(sb, s, id, patch, null, null, { drop, status });
    return quoteOf(saved || { ...row, payload: { ...(row.payload || {}), ...patch } });
  };
  const items = (q: Q): Row[] => (Array.isArray(q.items) ? q.items : []);
  const totalOf = (q: Q): UGX => orderTotal(orderOf({ id: q.id, payload: q, amount_paid: q.amountPaid }, pb()));
  const review = (it: Row, v: number, was: number, changed: boolean) => ({ state: changed ? 'changed' : 'approved', price: v, was, qty: Number(it.qty), ...by(), at: iso() });

  /** W8 the customer's limit and terms (credit.set: the customers guard logs it, 0122:166). */
  const writeLimit = async (customerId: string, l: LimitPick | null) => {
    const rows = await ok<Row[]>(sb.from('customers').update({ credit_limit: l ? l.limit : null, terms_days: l ? l.days : null }).eq('shop_id', s.shopId).eq('id', customerId).select('id'));
    if (!rows || !rows.length) throw dataError('refused', 'Setting a limit is not on for this login (credit.set)', '42501');
  };
  /** W33: the salesperson who last sold to them hears of it (tell_customer_change, 0158). Not the answer: a miss is let go. */
  const tell = async (customerId: string, what: string) => {
    const x = ctx(), last = x ? [...x.o.values()].filter((o) => o.customerId === customerId && o.placedBy).sort((a, b) => b.placedAt - a.placedAt)[0] : undefined;
    if (!last || !last.placedBy || last.placedBy === s.userId) return;
    try { await call(sb, 'tell_customer_change', { p_shop_id: s.shopId, p_customer_id: customerId, p_to: last.placedBy, p_what: what }); } catch (_e) { /* told on their next load */ }
  };
  /** W7/W8: the credit answer on the order (creditCheck; creditAsk.answer for the Store's ask). */
  const creditAnswer = async (orderId: number, yes: boolean, limit: LimitPick | null, store: boolean) => {
    const at0 = ctx(), q0 = at0 ? at0.q.get(orderId) : undefined, cid = q0 && q0.customerId != null ? String(q0.customerId) : null;
    if (store && !(q0 && creditAskOpen(q0))) throw clash();
    if (yes && limit && cid) await writeLimit(cid, limit);
    const q = await change(orderId, ['creditCheck', 'creditAsk'], (o) => {
      if (store ? !creditAskOpen(o) : o.status !== 'draft' || (o.creditCheck && o.creditCheck.decision && o.creditCheck.decision !== 'hold')) return false;
      const c = at0 && cid ? at0.customers.get(cid) : undefined, owes = c ? c.owes : 0, total = totalOf(o);
      o.creditCheck = { decision: yes ? 'release' : 'cash', ...by(), at: Date.now(), limit: limit ? limit.limit : c ? c.creditLimit : null, withIt: owes + Math.max(0, total - num(o.amountPaid)), ...(store ? { ask: true, terms: limit ? limit.days : null } : {}) };
      if (store) o.creditAsk = { ...o.creditAsk, answer: { decision: yes ? 'credit' : 'cash', ...by(), at: iso() } };
      return true;
    });
    await log('credit.release', `${yes ? 'On credit' : 'Cash first'}: ${q.client && q.client.name ? q.client.name : orderNo(orderId)}`, { amount: totalOf(q), ref: { table: 'saved_quotes', id: orderId }, after: { decision: yes ? 'release' : 'cash', limit } });
    if (yes && limit && cid) await tell(cid, `On credit: limit ${money(limit.limit)}, ${limit.days} days`);
  };

  return {
    /* ---- prices (W1, W3, W4, W5, W6) ---- */
    async price(orderId: number, idx: number, price: UGX, word: PriceWord) {
      let was = 0, v = 0;
      const q = await change(orderId, ['items'], (o) => {
        const it = items(o)[idx];
        if (!it || o.invoiced || !isLive(o) || !waitsPrice(it, pb())) return false;
        const cost = lineCost(it);
        was = priceNow(it, pb()); v = word === 'approved' ? was : Math.round(price);
        if (!(v > 0)) throw dataError('refused', 'There is no price to set', '22023');
        if (cost && v < cost) throw dataError('refused', 'Never under cost', 'OWCST');
        if (word !== 'approved') it.sellPrice = v;
        it.priceReview = review(it, v, was, word !== 'approved');
        return true;
      });
      const it = items(q)[idx] || {};
      await log('price.approve', `${word === 'approved' ? 'Approved' : 'Set'} ${it.productName || 'a line'} at ${money(v)} for ${(q.client && q.client.name) || orderNo(orderId)}`,
        { amount: v * num(it.qty), ref: { table: 'saved_quotes', id: orderId, line: idx }, before: { price: was }, after: { price: v, state: word === 'approved' ? 'approved' : 'changed' } });
    },
    async costAndPrice(orderId: number, idx: number, cost: UGX, price: UGX) {
      if (price < cost) throw dataError('refused', 'Never under cost', 'OWCST');
      let was = 0;
      const q = await change(orderId, ['items'], (o) => {
        const it = items(o)[idx];
        if (!it || o.invoiced || !isLive(o) || lineCost(it) || !waitsPrice(it, pb())) return false;
        was = priceNow(it, pb());
        it.price = Math.round(cost); it.costBy = { ...by(), at: iso(), source: 'manager' };
        if (price !== was) it.sellPrice = Math.round(price);
        it.priceReview = review(it, Math.round(price), was, price !== was);
        return true;
      });
      await log('price.approve', `${(items(q)[idx] || {}).productName || 'A line'}: cost ${money(cost)} (the Manager's), at ${money(price)} for ${(q.client && q.client.name) || orderNo(orderId)}`,
        { amount: price * num((items(q)[idx] || {}).qty), ref: { table: 'saved_quotes', id: orderId, line: idx }, before: { cost: null, price: was }, after: { cost, price } });
    },
    async askCost(orderId: number, idx: number) {
      // W5 (§5 Q12 default: keep the write, no push).
      await change(orderId, ['costAsked'], (o) => { const it = items(o)[idx]; if (!it || lineCost(it) || !waitsPrice(it, pb())) return false; o.costAsked = { at: iso(), by: s.userId }; return true; });
    },
    async markup(productId: string, markup: number) {
      await call(sb, 'set_product_markup', { p_shop_id: s.shopId, p_product_id: productId, p_fields: { wholesaleMarkupType: 'percent', wholesaleMarkupValue: Math.round(markup * 1000) / 10 } });
    },

    /* ---- credit (W7–W9, W31) ---- */
    credit: (orderId: number, yes: boolean, limit: LimitPick | null) => creditAnswer(orderId, yes, limit, false),
    storeCredit: (orderId: number, yes: boolean, limit: LimitPick | null) => creditAnswer(orderId, yes, limit, true),
    async limitAsk(askId: string, yes: boolean, limit: LimitPick | null) {
      // D-32 waits on 0184 (customer_asks, P-12): the function is called; until it exists, refused MG-0184.
      await call0184(sb, 'answer_customer_ask', { p_id: askId, p_yes: yes, p_limit: limit ? limit.limit : null, p_days: limit ? limit.days : null });
    },
    async setLimit(customerId: string, limit: LimitPick | null) {
      await writeLimit(customerId, limit);
      await tell(customerId, limit ? `Limit ${money(limit.limit)}, ${limit.days} days` : 'Cash only');
    },

    /* ---- the bill (W11–W14) ---- */
    async invoiceNow(orderId: number) { await call(sb, 'invoice_order', { p_shop_id: s.shopId, p_quote_id: orderId }); },
    // W12: the small bill is the phone's check (§5 Q2): the bill itself is invoice_order.
    async billSmall(orderId: number) { await call(sb, 'invoice_order', { p_shop_id: s.shopId, p_quote_id: orderId }); },
    async givenAway(orderId: number, idxs: number[], why: string) {
      const w = why.trim();
      if (!w) throw dataError('refused', 'Say why it is given away.', '22023');
      const q = await change(orderId, ['items'], (o) => {
        let n = 0;
        idxs.forEach((i) => { const it = items(o)[i]; if (it && freeOpen(it)) { it.givenAway = { why: w, by: s.userId, at: iso() }; n++; } });
        return n > 0;
      });
      const free = items(q).filter((it) => atZero(it) && it.givenAway);
      await log('price.approve', `${(q.client && q.client.name) || ''} ${orderNo(orderId)}: ${free.length} given away (${w})`, {
        amount: free.reduce((a, it) => a + (lineCost(it) || 0) * num(it.qty), 0), ref: { table: 'saved_quotes', id: orderId },
        after: { givenAway: free.map((it) => ({ name: it.productName || '', qty: num(it.qty), why: w })) },
      });
      if (q.status === 'completed' && !q.invoiced) await call(sb, 'invoice_order', { p_shop_id: s.shopId, p_quote_id: orderId });
    },
    async settlePick(orderId: number, all: boolean) {
      let total = 0;
      const q = await change(orderId, ['items', 'pickShortfallAckAt', 'pickSettle'], (o) => {
        const lines = shortLines(o);
        if (!shortWaits(o) || !lines.length) return false;
        if (all) o.pickShortfallAckAt = Date.now(); else lines.forEach((l) => { items(o)[l.idx].qty = l.picked; });
        o.pickSettle = { pick: all ? 'full' : 'went', ...by(), at: iso(), lines: lines.map((l) => ({ idx: l.idx, ordered: l.ordered, picked: l.picked })) };
        return true;
      });
      total = totalOf(q);
      await log('pick.settle', `${all ? 'Billed the full quantity' : 'Billed what went'} on ${(q.client && q.client.name) || orderNo(orderId)}`, { amount: total, ref: { table: 'saved_quotes', id: orderId }, before: q.pickSettle && q.pickSettle.lines, after: { pick: all ? 'full' : 'went' } });
    },

    /* ---- the yard (W15–W21, W29, W30) ---- */
    async takeCheckin(tripId: string, noteId: string | null) {
      await call(sb, 'accept_trip_difference', { p_trip_id: tripId });
      // W16: the trip's open notes are seen with it (RLS: yard_note needs trip.difference, 0151:82).
      const ids = new Set(raw().yardNotes.filter((n) => String((n.payload && n.payload.tripId) || n.ref || '') === tripId).map((n) => String(n.id)));
      if (noteId) ids.add(noteId);
      for (const id of ids) await ok(sb.from('buyer_handoffs').update({ status: 'done' }).eq('shop_id', s.shopId).eq('id', id));
    },
    async extra(askId: string, keep: boolean) {
      // W17 (0157): the answer only; no stock moves (§5 Q4).
      await call(sb, 'answer_store_ask', { p_id: askId, p_status: keep ? 'accepted' : 'declined', p_note: null });
    },
    async writeOff(reportIds: string[], keepIds: string[]) {
      const reports = raw().reports.filter((r) => reportIds.includes(String(r.id)));
      if (reports.length !== reportIds.length) throw clash();
      const x = ctx() as Ctx;
      if (reports.length) {
        const lines = reports.map((r) => {
          const key = String(r.key || (r.variant_idx == null ? r.product_id : `${r.product_id}::${r.variant_idx}`));
          return { key, productId: r.product_id, variantIdx: r.variant_idx, name: r.name, delta: -Math.abs(num(r.qty)), cost: shelfCost(x, key), report: r.id };
        });
        await call(sb, 'write_off_stock', { p_shop_id: s.shopId, p_report_ids: reports.map((r) => r.id), p_lines: lines, p_reason: reports.map((r) => r.why || 'damaged').join(', ') });
      }
      // W19: what she keeps on the shelf is dismissed (dismiss_stock_report, 0122:915; no update policy).
      for (const id of keepIds) await call(sb, 'dismiss_stock_report', { p_id: id });
    },
    async keepOnShelf(reportIds: string[]) { for (const id of reportIds) await call(sb, 'dismiss_stock_report', { p_id: id }); },
    async countTaken(countId: string) { await call(sb, 'accept_stock_count', { p_id: countId }); },
    async countAgain(countId: string) {
      // ask_recount updates nothing and says nothing when the count is not 'sent' (0115:208): re-read first.
      const c = await readOne(sb, s, 'stock_counts', countId);
      if (!c || c.status !== 'sent') throw clash();
      await call(sb, 'ask_recount', { p_id: countId });
    },
    async restock(restockId: string, hold: boolean) { await call(sb, 'hold_restock_buy', { p_id: restockId, p_hold: hold }); },
    async carton(restockId: string, yes: boolean) {
      if (yes) await call(sb, 'hold_restock_buy', { p_id: restockId, p_hold: false });
      else await call(sb, 'refuse_restock_buy', { p_id: restockId });
    },

    /* ---- after the order (W22–W28) ---- */
    async creditNote(askId: string, orderId: number, lines: { idx: number; qty: number; back: boolean }[], cashBack: boolean) {
      const a = raw().invoiceAsks.find((r) => String(r.id) === askId);
      await call(sb, 'raise_credit_note', { p_shop_id: s.shopId, p_order: orderId, p_lines: lines.map((l) => ({ idx: l.idx, qty: l.qty, restock: l.back })),
        p_reason: String((a && a.reason) || 'Returned'), p_cash_back: cashBack, p_ask: askId });
    },
    async keepSold(askId: string) { await call(sb, 'decide_invoice_ask', { p_id: askId, p_status: 'declined' }); },
    async voidBill(askId: string, orderId: number, reason: string, m: Money) {
      // The goods come back to the shelf unless the bill went to the wrong customer or at the wrong price (VOID_WHY 5443).
      const restock = !/^wrong/i.test(reason.trim());
      await call(sb, 'void_invoice', { p_shop_id: s.shopId, p_order: orderId, p_why: reason, p_restock: restock, ...moneyArgs(m), p_ask: askId });
    },
    async keepBilled(askId: string) { await call(sb, 'decide_invoice_ask', { p_id: askId, p_status: 'declined' }); },
    async cancel(askId: string, _orderId: number, m: Money) {
      await call(sb, 'answer_cancel_ask', { p_id: askId, p_yes: true, p_note: null, ...moneyArgs(m) });
    },
    async keepOrder(askId: string, words: string) {
      // §5 Q9 default: her words go with the No when she typed any.
      await call(sb, 'answer_cancel_ask', { p_id: askId, p_yes: false, p_note: words.trim() || null, p_choice: null, p_account: 'cash' });
    },
    async cancelTwin(dropId: number, _keepId: number) {
      // M-20: the one cancel (0177), not the phone's void.
      await call(sb, 'cancel_order', { p_shop_id: s.shopId, p_order: dropId, p_why: 'Entered twice', p_choice: null, p_account: 'cash' });
    },
    async bothReal(a: number, b: number) {
      const [older, newer] = a < b ? [a, b] : [b, a];
      await change(newer, ['dupOkWith'], (o) => {
        const was = (Array.isArray(o.dupOkWith) ? o.dupOkWith : []).map(Number);
        if (was.includes(older)) return false;
        o.dupOkWith = [...was, older];
        return true;
      });
    },
    async agent(orderId: number, agreed: number[], cancel: boolean) {
      const q = await change(orderId, ['items', 'agentChange', 'agentCancel', 'agentCredit'], (o) => {
        const open = agentOpen(o), now = iso();
        if (!open) return false;
        if (open.cancel) {
          o.agentCancel = cancel ? { ...o.agentCancel, agreed: true, decidedAt: now, by: s.userId } : { ...o.agentCancel, declined: true, closed: true, decidedAt: now, by: s.userId };
          return true;
        }
        const c = o.agentChange, list: Row[] = Array.isArray(o.items) ? o.items : [];
        (c.lines as Row[]).filter((l) => l && !l.decision).forEach((l) => {
          const idx = list.findIndex((it) => agentKey(it) === agentKey(l)), yes = idx >= 0 && agreed.includes(idx);
          l.decision = yes ? 'agreed' : 'declined'; l.decidedAt = now;
          if (!yes) return;
          if (num(l.to) > 0) list[idx].qty = num(l.to); else o.items = (o.items as Row[]).filter((it) => it !== list[idx]);
          const before = num(o.agentCredit && o.agentCredit.amount), owed = Math.max(0, Math.round(num(o.amountPaid) - totalOf(o)));
          if (owed > before) o.agentCredit = { used: [], ...(o.agentCredit || {}), amount: owed, at: (o.agentCredit && o.agentCredit.at) || now };
        });
        c.state = (c.lines as Row[]).some((l) => l && l.decision === 'agreed') ? 'agreed' : 'declined'; c.decidedAt = now;
        if (!items(o).length && !o.agentCancel) o.agentCancel = { at: now, reason: 'Agreed with the shop', agreed: true };
        return true;
      });
      await log('agent.change', `Answered ${q.originAgentName || 'an agent'} on ${(q.client && q.client.name) || orderNo(orderId)}`, { amount: totalOf(q), ref: { table: 'saved_quotes', id: orderId }, after: { change: q.agentChange || null, cancel: q.agentCancel || null } });
    },

    /* ---- money and the team (W32–W43) ---- */
    async merge(keepId: string, dropId: string) { await call(sb, 'merge_customers', { p_shop_id: s.shopId, p_keep: keepId, p_drop: dropId }); },
    async notSame(a: string, b: string) {
      // D-26: "Not the same" is only a line in the owner's log (ref.apart), read back by R27.
      await ok(sb.from('decision_log').insert({ shop_id: s.shopId, by: s.userId, by_name: s.name, role: s.role, task: 'customer.edit', what: 'Not the same customer', ref: { table: 'customers', apart: [a, b].sort() } }));
    },
    async opening(customerId: string, amount: UGX, since: string) {
      await call(sb, 'set_opening_balance', { p_shop_id: s.shopId, p_customer_id: customerId, p_amount: amount, p_since: since });
    },
    async promise(customerId: string, on: string, amount: UGX) {
      const x = ctx(), max = x ? x.raw.promises.reduce((m, p) => Math.max(m, num(p.id)), 0) : 0;
      await recordPromise(sb, s, { customerId, on, amount }, max, x ? x.today : on);
      await log('promise.record', `Promise to pay ${money(amount)} on ${on}`, { amount, ref: { table: 'customers', id: customerId } });
    },
    async goals(month: string, goals: { staffId: string; amount: UGX }[]) {
      const x = ctx(), today = x ? x.today : new Date().toISOString().slice(0, 10), staff = x ? x.raw.staff : [];
      const first = /^\d{4}-\d{2}$/.test(month) ? month + '-01' : month === 'next' ? addDays(today.slice(0, 8) + '01', 32).slice(0, 8) + '01' : today.slice(0, 8) + '01';
      const last = addDays(addDays(first, 32).slice(0, 8) + '01', -1);
      for (const g of goals) {
        const st = staff.find((r) => String(r.id) === g.staffId), who = st && st.user_id ? String(st.user_id) : g.staffId.replace(/^user:/, '');
        await call(sb, 'set_person_goal', { p_shop_id: s.shopId, p_who: who, p_aim: g.amount, p_from: first, p_to: last });
      }
    },
    async stageLimits(limits: Partial<Record<Stage, number>>) {
      const cur = (ctx() && (ctx() as Ctx).raw.presets.orderStageLimits) || {};
      await call(sb, 'set_shop_preset', { p_shop_id: s.shopId, p_key: 'orderStageLimits', p_value: { ...cur, ...limits } });
    },
    async holdDays(days: number) {
      const cur = (ctx() && (ctx() as Ctx).raw.presets.creditHold) || {};
      await call(sb, 'set_shop_preset', { p_shop_id: s.shopId, p_key: 'creditHold', p_value: { ...cur, days } });
    },
    async nudge(staffId: string, orderId: number | null, words: string) {
      // P-9 (0184): a push through nudge_person; until it exists, refused MG-0184 (§5 Q13: the app shows the WhatsApp link).
      const st = (ctx() ? (ctx() as Ctx).raw.staff : []).find((r) => String(r.id) === staffId);
      const to = st && st.user_id ? String(st.user_id) : staffId.startsWith('user:') ? staffId.slice(5) : null;
      if (!to) throw dataError('refused', `${firstWord(String((st && st.name) || 'They'))} has no phone in the app`, 'MG-NOPHONE');
      await call0184(sb, 'nudge_person', { p_shop: s.shopId, p_to: to, p_order: orderId, p_words: words });
    },
    async giveTo(orderId: number, staffId: string) {
      const st = (ctx() ? (ctx() as Ctx).raw.staff : []).find((r) => String(r.id) === staffId);
      if (!st) throw dataError('refused', 'Only someone on the staff list', 'MG-NOSTAFF');
      // W41: a packer (handToPacker 1973: the pick starts again) or a driver (handToDriver 1982).
      const PACK = ['items', 'assignedWorkerId', 'pickingStatus', 'pickCursor', 'pickingAssignedAt', 'workerAcceptedAt', 'pickShortfallAckAt', 'pickingDoneAt'];
      await change(orderId, (o) => (o.status === 'preparing' ? PACK : ['assignedDeliveryId', 'carrier']), (o) => {
        if (!isLive(o)) return false;
        if (o.status === 'preparing' && o.pickingStatus !== 'done') {
          o.pickingStatus = 'awaiting_accept'; o.pickCursor = 0; o.pickingAssignedAt = Date.now(); o.workerAcceptedAt = null; o.pickShortfallAckAt = null; o.pickingDoneAt = null;
          items(o).forEach((it) => { it.pickStatus = null; it.pickedQty = null; });
          o.assignedWorkerId = String(st.id);
          return true;
        }
        if (o.status === 'pending_delivery') {
          o.assignedDeliveryId = String(st.id);
          o.carrier = { kind: 'staff', name: String(st.name || ''), what: '', phone: '', at: Date.now(), by: 'manager' };
          return true;
        }
        return false;
      });
    },
  };
}
