/*
 * The demo's answers: each changes the sample books the way its server function would
 * (docs/spec/04-screens-manager-data.md §2), takes the ask off the queue, and writes a
 * line in Today's answers naming who is told. No money moves that the books would not move.
 */
import { orderNo } from '../../names.ts';
import { money } from '../../money.ts';
import type { Money, PriceWord, LimitPick } from '../source.ts';
import type { Ask, Cust, Day, ManagerBooks, MOrder, Ms, Stage, UGX } from '../types.ts';
import { ANSWER } from '../words.ts';

type B = () => ManagerBooks;

export function demoWrites(get: B, now: () => Ms) {
  const b = () => get();
  const order = (id: number): MOrder => {
    const o = b().orders.find((x) => x.id === id);
    if (!o) throw new Error('No such order: ' + orderNo(id));
    return o;
  };
  const cust = (id: string | null): Cust | null => (id ? b().customers.find((c) => c.id === id) || null : null);
  const drop = (pred: (a: Ask) => boolean): Ask | null => {
    const bk = b(), i = bk.asks.findIndex(pred);
    if (i < 0) return null;
    return bk.asks.splice(i, 1)[0];
  };
  const dropKey = (key: string) => drop((a) => a.key === key);
  const done = (word: string, sub: string, told: (string | null | undefined)[]) => {
    b().done.unshift({ at: now(), word, sub, told: told.filter((x): x is string => !!x), auto: false });
  };
  const retotal = (o: MOrder) => { o.total = o.lines.reduce((s, l) => s + (l.price != null ? Math.round(l.price * l.qty) : 0), 0); };
  const askerOfKey = (key: string): string | null => { const a = b().asks.find((x) => x.key === key); return a ? a.askerId : null; };
  const limitOn = (c: Cust | null, l: LimitPick | null) => { if (c && l) { c.limit = l.limit; c.termsDays = l.days; } };

  return {
    price(orderId: number, idx: number, price: UGX, word: PriceWord) {
      const o = order(orderId), ln = o.lines[idx];
      if (ln.cost != null && price < ln.cost) throw new Error('under cost');
      const key = b().asks.find((a) => (a.kind === 'price' || a.kind === 'counter') && a.orderId === orderId && a.idx === idx);
      const asker = key ? key.askerId : o.sellerId;
      ln.price = price; ln.buying = ln.buying === 'up' ? 'found' : ln.buying; retotal(o);
      if (key) dropKey(key.key);
      if (o.heldCode === 'OWTPC' || o.heldCode === 'OWPRC') o.heldCode = null;
      const w = word === 'approved' ? ANSWER.approved : word === 'shop' ? ANSWER.shopsPrice : ANSWER.priceSet;
      done(w, `${orderNo(orderId)} · ${money(price)}`, [asker, o.sellerId !== asker ? o.sellerId : null]);
    },
    costAndPrice(orderId: number, idx: number, cost: UGX, price: UGX) {
      order(orderId).lines[idx].cost = cost;
      this.price(orderId, idx, price, 'set');
    },
    askCost(orderId: number, idx: number) {
      done('Asked Denis', `${orderNo(orderId)} · ${order(orderId).lines[idx].name} · the cost`, ['denis']);
    },
    markup(productId: string, markup: number) {
      const a = drop((x) => x.kind === 'markup' && x.productId === productId);
      done(`${ANSWER.markup} ${Math.round(markup * 100)}%`, a && a.kind === 'markup' ? `${a.name} · ${money(Math.round(a.cost * (1 + markup)))}` : productId, [a ? a.askerId : null]);
    },

    credit(orderId: number, yes: boolean, limit: LimitPick | null) {
      const o = order(orderId), c = cust(o.customerId);
      const a = drop((x) => x.kind === 'credit' && x.orderId === orderId);
      if (yes) limitOn(c, limit);
      done(yes ? ANSWER.onCredit : ANSWER.cashFirst, `${orderNo(orderId)} · ${money(o.total)}`, [a ? a.askerId : o.sellerId]);
    },
    storeCredit(orderId: number, yes: boolean, limit: LimitPick | null) {
      const o = order(orderId), c = cust(o.customerId);
      const a = drop((x) => x.kind === 'storecredit' && x.orderId === orderId);
      if (yes) { limitOn(c, limit); o.credit = true; }
      done(yes ? ANSWER.loadIt : ANSWER.itStays, `${orderNo(orderId)}${limit && yes ? ` · ${limit.limit / 1e6}M · ${limit.days} d` : ''}`, [a ? a.askerId : null, o.sellerId]);
    },
    limitAsk(askId: string, yes: boolean, limit: LimitPick | null) {
      const a = drop((x) => x.kind === 'limit' && x.askId === askId);
      if (!a || a.kind !== 'limit') throw new Error('Someone else just did this');
      const c = cust(a.customerId);
      if (yes) limitOn(c, limit || { limit: a.amount, days: a.days });
      done(yes ? `Limit ${money(limit ? limit.limit : a.amount)}` : ANSWER.cashOnly, c ? c.name : '', [a.askerId, c && c.sellers[0]]);
    },
    setLimit(customerId: string, limit: LimitPick | null) {
      const c = cust(customerId);
      if (!c) throw new Error('No such customer');
      if (limit) limitOn(c, limit); else { c.limit = null; c.termsDays = null; }
      done('Limit set', `${c.name} · ${limit ? money(limit.limit) + ' · ' + limit.days + ' days' : 'cash only'}`, [c.sellers[0]]);
    },

    invoiceNow(orderId: number) {
      const o = order(orderId);
      o.invoiced = true; o.invoiceNo = 'INV-' + String(orderId).padStart(4, '0');
      done('Invoiced', `${orderNo(orderId)} · ${money(o.total)}`, [o.sellerId, 'esther']);
    },
    billSmall(orderId: number) {
      const o = order(orderId);
      drop((x) => x.kind === 'bill' && x.orderId === orderId);
      o.invoiced = true; o.heldCode = null; o.invoiceNo = 'INV-' + String(orderId).padStart(4, '0');
      done('Invoiced', `${orderNo(orderId)} · ${money(o.total)}`, [o.sellerId]);
    },
    givenAway(orderId: number, idxs: number[], why: string) {
      const o = order(orderId);
      idxs.forEach((i) => { o.lines[i].givenAway = why; });
      drop((x) => x.kind === 'given' && x.orderId === orderId);
      o.heldCode = null; o.invoiced = true;
      done(`${ANSWER.givenAway} · ${why}`, orderNo(orderId), [o.sellerId]);
    },
    priceAgain(orderId: number, idxs: number[]) {
      const o = order(orderId);
      idxs.forEach((i) => { o.lines[i].price = null; });
      drop((x) => x.kind === 'given' && x.orderId === orderId);
      o.heldCode = 'OWTPC';
      b().asks.push({ key: `price:${orderId}:${idxs[0]}`, at: now(), askerId: o.sellerId, standing: false, orderId, kind: 'price', mode: 'coming', idx: idxs[0], asked: null, costWas: null });
      done('To price', orderNo(orderId), [o.sellerId]);
    },
    settlePick(orderId: number, all: boolean) {
      const o = order(orderId);
      drop((x) => x.kind === 'short' && x.orderId === orderId);
      if (!all) o.lines.forEach((l) => { if (l.packed != null) { l.qty = l.packed; } });
      retotal(o);
      done(all ? ANSWER.billAll : ANSWER.billWent, `${orderNo(orderId)} · ${money(o.total)}`, ['musa', o.sellerId]);
    },

    takeCheckin(tripId: string) {
      const a = drop((x) => x.kind === 'checkin' && x.tripId === tripId);
      done('Took Musa\'s check-in', a && a.kind === 'checkin' ? `${a.lines.filter((l) => l.counted !== l.brought).length} line differs` : tripId, [a ? a.askerId : null, a && a.kind === 'checkin' ? a.runnerId : null]);
    },
    extra(askId: string, keep: boolean) {
      const a = drop((x) => x.kind === 'extra' && x.askId === askId);
      done(keep ? ANSWER.keepIt : ANSWER.goesBack, a && a.kind === 'extra' ? `${a.qty} ${a.name}` : askId, [a ? a.askerId : null]);
    },
    writeOff(reportIds: string[], keepIds: string[]) {
      const a = drop((x) => x.kind === 'loss' && x.reports.some((r) => reportIds.includes(r.id) || keepIds.includes(r.id)));
      const rs = a && a.kind === 'loss' ? a.reports.filter((r) => reportIds.includes(r.id)) : [];
      const sum = rs.reduce((s, r) => s + r.qty * r.cost, 0);
      done(ANSWER.writtenOff, `${rs.map((r) => `${r.qty} ${r.name}`).join(', ')} · ${money(sum)}`, [a ? a.askerId : null]);
    },
    keepOnShelf(reportIds: string[]) {
      const a = drop((x) => x.kind === 'loss' && x.reports.some((r) => reportIds.includes(r.id)));
      done(ANSWER.keptShelf, a && a.kind === 'loss' ? a.reports.map((r) => `${r.qty} ${r.name}`).join(', ') : '', [a ? a.askerId : null]);
    },
    countTaken(countId: string) {
      const a = drop((x) => x.kind === 'count' && x.countId === countId);
      done(ANSWER.countTaken, a && a.kind === 'count' ? a.aisle : countId, [a ? a.askerId : null]);
    },
    countAgain(countId: string) {
      const a = drop((x) => x.kind === 'count' && x.countId === countId);
      done(ANSWER.countAgain, a && a.kind === 'count' ? a.aisle : countId, [a ? a.askerId : null]);
    },
    restock(restockId: string, hold: boolean) {
      const r = b().restock.find((x) => x.id === restockId);
      if (r) r.held = hold;
      done(hold ? ANSWER.notYet : ANSWER.goAhead, r ? r.name : restockId, ['denis']);
    },
    carton(restockId: string, ok: boolean) {
      const a = drop((x) => x.kind === 'carton' && x.restockId === restockId);
      done(ok ? ANSWER.shelfOk : ANSWER.orderOnly, a && a.kind === 'carton' ? `${a.name} · ${money(ok ? a.forShelf * a.cost : a.forOrder * a.cost)}` : '', [a ? a.askerId : null]);
    },

    creditNote(askId: string, orderId: number, lines: { idx: number; qty: number }[]) {
      const o = order(orderId), c = cust(o.customerId);
      drop((x) => x.kind === 'return' && x.askId === askId);
      const amt = lines.reduce((s, l) => s + l.qty * (o.lines[l.idx].price || 0), 0);
      if (c) { c.owes -= amt; const bill = c.bills.find((x) => x.orderId === orderId); if (bill) bill.left -= amt; }
      done(ANSWER.creditNote, `${orderNo(orderId)} · ${money(amt)}`, [askerOfKey('return:' + askId), o.sellerId, 'esther']);
    },
    keepSold(askId: string) {
      const a = drop((x) => x.kind === 'return' && x.askId === askId);
      done(ANSWER.keptSold, a && a.orderId ? orderNo(a.orderId) : '', [a ? a.askerId : null]);
    },
    voidBill(askId: string, orderId: number, _reason: string, m: Money) {
      const o = order(orderId), c = cust(o.customerId);
      const a = drop((x) => x.kind === 'void' && x.askId === askId);
      if (c) {
        const bill = c.bills.find((x) => x.orderId === orderId), left = bill ? bill.left : 0;
        c.bills = c.bills.filter((x) => x.orderId !== orderId);
        c.owes -= left + (m && m.how === 'deposit' ? o.paid : 0);
      }
      o.stage = 'cancelled';
      done(ANSWER.voided, `${orderNo(orderId)} · ${money(o.total)}${m ? (m.how === 'refund' ? ` · refund ${money(o.paid)}` : ` · ${money(o.paid)} deposit`) : ''}`, [a ? a.askerId : null, o.sellerId, 'esther']);
    },
    keepBilled(askId: string) {
      const a = drop((x) => x.kind === 'void' && x.askId === askId);
      done(ANSWER.keptBilled, a && a.orderId ? orderNo(a.orderId) : '', [a ? a.askerId : null]);
    },
    cancel(askId: string, orderId: number) {
      const o = order(orderId);
      drop((x) => x.kind === 'cancel' && x.askId === askId);
      o.stage = 'cancelled' as Stage;
      done(ANSWER.cancelled, `${orderNo(orderId)} · ${o.paid ? money(o.paid) + ' paid' : 'Nothing paid'}`, [o.sellerId, 'denis', 'musa']);
    },
    keepOrder(askId: string) {
      const a = drop((x) => x.kind === 'cancel' && x.askId === askId);
      done(ANSWER.kept, a && a.orderId ? orderNo(a.orderId) : '', [a ? a.askerId : null]);
    },
    cancelTwin(dropId: number, keepId: number) {
      const o = order(dropId);
      if (o.invoiced) throw new Error('Billed first · ask for a void');
      o.stage = 'cancelled';
      done(ANSWER.cancelled, `${orderNo(dropId)} · keep ${orderNo(keepId)}`, [o.sellerId, 'musa']);
    },
    bothReal(a: number, c: number) {
      order(a).twinOk.push(c); order(c).twinOk.push(a);
      done(ANSWER.bothReal, `${orderNo(a)} & ${orderNo(c)}`, []);
    },
    agent(orderId: number, agreed: number[], cancel: boolean) {
      const o = order(orderId);
      const a = drop((x) => x.kind === 'agent' && x.orderId === orderId);
      let less = 0;
      if (a && a.kind === 'agent') {
        if (cancel) o.stage = 'cancelled';
        a.lines.filter((l) => agreed.includes(l.idx)).forEach((l) => { const ln = o.lines[l.idx]; less += (ln.qty - l.to) * (ln.price || 0); ln.qty = l.to; });
      }
      retotal(o);
      done(agreed.length || cancel ? ANSWER.agreed : ANSWER.kept, `${orderNo(orderId)}${less ? ' · −' + money(less) : ''}`, ['peter', 'denis']);
    },

    merge(keepId: string, dropId: string) {
      const k = cust(keepId), d = cust(dropId);
      if (!k || !d) throw new Error('No such customer');
      k.orders += d.orders; k.owes += d.owes; k.lookAlike = null;
      b().customers = b().customers.filter((c) => c.id !== dropId);
      done('Merged', `${k.name} · ${k.orders} orders · ${money(k.owes)}`, []);
    },
    notSame(a: string, c: string) {
      [cust(a), cust(c)].forEach((x) => { if (x) x.lookAlike = null; });
      done('Not the same', '', []);
    },
    opening(customerId: string, amount: UGX, since: Day) {
      const c = cust(customerId);
      // As set_opening_balance: the old books' figure becomes what they owe, the first bill (0148).
      if (c) { c.owes += amount; c.bills.unshift({ orderId: 0, day: since, left: amount }); c.oldBooks = null; }
      done('Opening balance', `${c ? c.name : ''} · ${money(amount)} · since ${since}`, []);
    },
    promise(customerId: string, on: Day, amount: UGX) {
      const c = cust(customerId);
      if (!c) throw new Error('No such customer');
      c.promises.push({ id: 'pr-' + now(), on, madeOn: on, amount, state: 'open' });
      done(ANSWER.promised, `${c.name} · ${money(amount)} · ${on}`, [c.sellers[0]]);
    },
    goals(month: string, goals: { staffId: string; amount: UGX }[]) {
      goals.forEach((g) => { const p = b().team.find((x) => x.id === g.staffId); if (p && month === 'this') p.goal = g.amount; });
      done('Goals set', `${month === 'this' ? 'October' : 'November'} · ${money(goals.reduce((s, g) => s + g.amount, 0))}`, goals.map((g) => g.staffId));
    },
    stageLimits(limits: Partial<Record<Stage, number>>) { b().shop.stageLimits = { ...b().shop.stageLimits, ...limits }; done('Stage limits', '', []); },
    holdDays(days: number) { b().shop.holdDays = days; done('Credit hold line', `${days} d`, []); },
    nudge(staffId: string, orderId: number | null) {
      const p = b().team.find((x) => x.id === staffId);
      done(`${ANSWER.nudged} ${p ? p.name.split(' ')[0] : ''}`, orderId ? orderNo(orderId) : '', [staffId]);
    },
    giveTo(orderId: number, staffId: string) {
      const o = order(orderId), p = b().team.find((x) => x.id === staffId);
      o.holderId = staffId;
      done(`Given to ${p ? p.name.split(' ')[0] : ''}`, orderNo(orderId), [staffId]);
    },
  };
}
