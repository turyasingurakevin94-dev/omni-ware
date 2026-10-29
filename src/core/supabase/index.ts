/*
 * The real books: the DataSource over Supabase. Reads in read.ts, writes in
 * write.ts, rows mapped in rows.ts. It keeps the last books it read, for
 * what a write needs to know (the highest order number as a floor, the
 * customer list a chat is matched against).
 */
import { dataError, type DataSource } from '../datasource.ts';
import { orderTotal } from '../money.ts';
import { invoiceNo } from '../names.ts';
import { startStage } from '../orders.ts';
import { dayOf } from '../time.ts';
import type { Books, Order, Session } from '../types.ts';
import { client, isNetwork, type Sb } from './client.ts';
import { readBooks, readChats, readSession, readThread } from './read.ts';
import * as W from './write.ts';

export function supabaseSource(): DataSource {
  let session: Session | null = null;
  let last: Books | null = null;

  const sb = (): Sb => {
    const c = client();
    if (!c) throw dataError('offline', 'No signal');
    return c.sb;
  };
  const me = (): Session => {
    if (!session) throw dataError('signed-out', 'Sign in again');
    return session;
  };
  const books = async (): Promise<Books> => last || src.books();
  const order = async (id: number): Promise<Order> => {
    const o = (await books()).orders.find((x) => x.id === id);
    if (!o) throw dataError('refused', 'That order is not in the books');
    return o;
  };

  const src: DataSource = {
    kind: 'supabase',
    now: () => Date.now(),
    online: () => typeof navigator === 'undefined' || navigator.onLine !== false,

    async session() {
      session = await readSession(sb());
      return session;
    },
    async signIn(email, password) {
      const { error } = await sb().auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw isNetwork(error) ? dataError('offline', 'No signal') : dataError('refused', String(error.message || error));
      const s = await src.session();
      if (!s) throw dataError('signed-out', 'Sign in again');
      return s;
    },
    async signOut() {
      // Sign-out clears the copy (spec 06 Q12): every ow-*-snap on this phone (sales.html:6816 owForgetCopies).
      try { for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && /^ow-[a-z]+-snap:/.test(k)) localStorage.removeItem(k); } } catch (_e) { /* nothing kept */ }
      session = null; last = null;
      await sb().auth.signOut();
    },

    async books() {
      last = await readBooks(sb(), me(), Date.now());
      return last;
    },
    async chats() {
      return readChats(sb(), me().shopId, (await books()).customers, Date.now());
    },
    thread: (chatId) => readThread(sb(), chatId),

    async placeOrder(d) {
      const b = await books(), now = Date.now();
      const cust = d.customerId ? b.customers.find((c) => c.id === d.customerId) || null : null;
      const total = orderTotal({ lines: d.lines, charges: d.charges, discount: 0, credit: d.credit });
      const stage = startStage(d, b.items, cust, dayOf(now), b.settings.holdDays, total);
      const id = await W.placeOrder(sb(), me(), d, stage, b.orders.reduce((m, o) => Math.max(m, o.id), 0), now);
      await src.books();
      return order(id);
    },
    async counterSale(d, pay) {
      const r = await W.counterSale(sb(), me(), d, pay, Date.now());
      await src.books();
      return { order: await order(r.id), invoice: r.invoice || invoiceNo(r.id), paid: r.paid, change: r.change, waiting: r.waiting };
    },
    async markPriceTold(orderId) { await W.markPriceTold(sb(), me(), orderId, Date.now()); },
    async setClientPhone(orderId, phone) { await W.setClientPhone(sb(), me(), orderId, phone); },
    async askBill(a) { return W.askBill(sb(), me(), await order(a.orderId), a); },
    async withdrawBillAsk(id) { await W.withdrawBillAsk(sb(), id); },
    async askCancel() {
      // 0177: "Sales' ask for a cancel is not built". No table or function takes it yet.
      throw dataError('missing', 'Asking Ruth to cancel needs a database update first');
    },

    async receivePayment(a) {
      const r = await W.receivePayment(sb(), me(), a);
      const b = await src.books();
      const ids = new Set(r.rows.map((x) => Number(x.id)));
      return { payments: b.payments.filter((p) => ids.has(p.id)), amount: r.amount, before: r.before, after: r.after, deposit: r.deposit, change: a.over === 'change' ? Math.max(0, a.amount - r.amount) : 0 };
    },
    async recordPromise(a) {
      const b = await books();
      return W.recordPromise(sb(), me(), a, b.promises.reduce((m, p) => Math.max(m, p.id), 0), dayOf(Date.now()));
    },
    async askPaymentFix(a) {
      const p = (await books()).payments.find((x) => x.id === a.paymentId);
      return W.askPaymentFix(sb(), me(), { ...a, amount: p ? p.amount : 0, customerId: p ? p.customerId : null, orderId: p ? p.orderId : null });
    },
    async withdrawPaymentAsk(id) { await W.withdrawPaymentAsk(sb(), id); },

    async addCustomer(a) {
      const nums = (await books()).customers.map((c) => Number(String(c.id).replace(/[^0-9]/g, '')) || 0);
      return W.addCustomer(sb(), me(), a, nums.length ? Math.max(...nums) : 0);
    },

    async askSourcing(a) {
      const name = a.name.trim().toLowerCase();
      const lead = (await books()).asks.find((x) => x.status !== 'dropped' && x.name.trim().toLowerCase() === name) || null;
      return W.askSourcing(sb(), me(), a, lead ? lead.id : null, Date.now());
    },
    logSearchMiss(words, clientName) { try { W.logSearchMiss(sb(), me(), words, clientName); } catch (_e) { /* fire and forget */ } },

    send: (chatId, text) => W.waSend(sb(), me(), chatId, text, false, Date.now()),
    sendTemplate: (chatId, text) => W.waSend(sb(), me(), chatId, text, true, Date.now()),
    note: (chatId, body) => W.addNote(sb(), me(), chatId, body, Date.now()),
    take: (chatId) => W.takeChat(sb(), chatId),
    give: (chatId, to, note) => W.giveChat(sb(), chatId, to, note),
    markRead: (chatId) => W.markRead(sb(), chatId, Date.now()),
    touch(chatId, typing) { try { W.touch(sb(), me(), chatId, typing); } catch (_e) { /* fire and forget */ } },
    served: (chatId) => W.served(sb(), me(), chatId),
  };
  return src;
}
