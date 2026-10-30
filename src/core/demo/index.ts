/*
 * The demo: the sample shop of docs/canvas/sales-agent/FACTS.md, in memory,
 * behind the same DataSource the real books use. Flags in flags.ts and
 * README.md. Every read hands out a copy, so a screen can never change the
 * shop by accident; every write goes through writes.ts (or the small ones
 * below), as the server function it stands in for would.
 */
import { dataError, type DataSource } from '../datasource.ts';
import type { Kept } from '../outbox.ts';
import { dayOf, replyWindow } from '../time.ts';
import type { ChatNote, Message, Session, SourcingAsk } from '../types.ts';
import { readFlags, type DemoFlags } from './flags.ts';
import { SAVED_AT } from './seed/clock.ts';
import { seed, type DemoState } from './seed/index.ts';
import { CHAT, MUSA } from './seed/people.ts';
import * as W from './writes.ts';

const copy = <T>(x: T): T => structuredClone(x);
/** Writes take a moment, so "Sending…" is seen; reads are instant. */
const WRITE_MS = 250;
const later = <T>(fn: () => T): Promise<T> => new Promise((resolve, reject) => setTimeout(() => { try { resolve(fn()); } catch (e) { reject(e); } }, WRITE_MS));

export interface DemoSource extends DataSource {
  readonly flags: DemoFlags;
  /** The state itself, for tests and the parity harness. */
  readonly state: DemoState;
  /** What the outbox holds at the start (&offline=1: 2 not sent yet, TD09). */
  kept(): Kept[];
}

export function demoSource(search: string | DemoFlags = '?demo'): DemoSource {
  const flags = typeof search === 'string' ? readFlags(search) : search;
  const s = seed(flags);
  const me = s.books.me;
  let signedIn = true;

  const write = <T>(fn: () => T): Promise<T> => {
    if (flags.offline) return Promise.reject(dataError('offline', 'No signal'));
    return later(fn);
  };
  const chat = (id: number) => {
    const c = s.chats.find((x) => x.id === id);
    if (!c) throw dataError('refused', 'That chat is not here');
    return c;
  };
  const say = (chatId: number, body: string, kind: Message['kind']): Message => {
    const c = chat(chatId);
    if (kind !== 'template' && !replyWindow(c.lastInAt, s.now).open) throw dataError('refused', 'The 24-hour window is shut: send it as the reply template', 'WSHUT');
    const m: Message = { id: 'm' + (s.messages.length + 1), chatId, at: s.now, dir: 'out', kind, body, by: me.id, state: 'sent' };
    s.messages.push(m); c.lastAt = s.now;
    return copy(m);
  };

  const src: DemoSource = {
    kind: 'demo',
    flags,
    state: s,
    now: () => s.now,
    online: () => !flags.offline,
    // &offline=1: Grace's two answers to Mukono, typed with no signal at 10:40 and 10:41 (CH12; TD09 counts them).
    kept: () => (flags.offline ? [
      { id: 'k1', kind: 'send', args: [CHAT.mukono, 'Shall I add 6 tins to your order?'], at: s.now - 60000, tries: 1, state: 'kept', reason: '' },
      { id: 'k2', kind: 'send', args: [CHAT.mukono, 'I’ll bring the colour card on Monday.'], at: s.now, tries: 1, state: 'kept', reason: '' },
    ] : []),

    async session(): Promise<Session | null> {
      if (!signedIn) return null;
      // TD10: the login under this screen is now Musa's (Store); nothing is saved as Musa.
      if (flags.state === 'signed-elsewhere') return { userId: MUSA, shopId: s.books.shop.id, shopName: s.books.shop.name, role: 'store', name: 'Musa Kiggundu' };
      return { userId: me.id, shopId: s.books.shop.id, shopName: s.books.shop.name, role: me.role === 'manager' ? 'manager' : 'sales', name: me.name };
    },
    async signIn() { signedIn = true; return (await src.session()) as Session; },
    async signOut() { signedIn = false; },

    books() {
      // &state=loading: the books never come (the skeletons stay).
      if (flags.state === 'loading') return new Promise(() => {});
      const b = copy(s.books);
      b.at = flags.offline ? SAVED_AT : s.now;
      return Promise.resolve(b);
    },
    chats() {
      if (flags.state === 'loading') return new Promise(() => {});
      return Promise.resolve(copy({ at: flags.offline ? SAVED_AT : s.now, connected: s.connected, chats: s.chats, recent: s.messages.slice(-500) }));
    },
    thread: (chatId) => Promise.resolve(copy({
      chatId, messages: s.messages.filter((m) => m.chatId === chatId), notes: s.notes.filter((n) => n.chatId === chatId), events: s.events.filter((e) => e.chatId === chatId),
    })),

    placeOrder: (d) => write(() => copy(W.placeOrder(s, d))),
    counterSale: (d, pay) => write(() => copy(W.counterSale(s, d, pay))),
    markPriceTold: (orderId) => write(() => {
      const o = s.books.orders.find((x) => x.id === orderId);
      if (!o) throw dataError('refused', 'That order is not in the books');
      o.lines.forEach((l) => { if (l.priceReview && l.priceReview.state === 'changed' && !(l.priceToldAt && l.priceToldAt >= l.priceReview.at)) l.priceToldAt = s.now; });
      o.toldTotal = null;
    }),
    setClientPhone: (orderId, phone) => write(() => { const o = s.books.orders.find((x) => x.id === orderId); if (o) o.client.phone = phone; }),
    askBill: (a) => write(() => {
      const o = s.books.orders.find((x) => x.id === a.orderId);
      if (!o || !o.invoiced) throw dataError('refused', 'Only a bill can be voided or credited');
      const ask = { id: 'ba' + (s.books.billAsks.length + 1), orderId: o.id, customerId: o.customerId, kind: a.kind, amount: Math.round(a.amount), reason: a.reason || (a.kind === 'void' ? 'Raised twice' : ''), status: 'sent' as const, by: me.id, at: s.now };
      s.books.billAsks.push(ask);
      return copy(ask);
    }),
    withdrawBillAsk: (id) => write(() => W.withdrawAsk(s, id)),
    askCancel: (orderId, why) => write(() => copy(W.askCancel(s, orderId, why))),

    receivePayment: (a) => write(() => copy(W.receivePayment(s, a))),
    recordPromise: (a) => write(() => {
      const p = { id: s.books.promises.reduce((m, x) => Math.max(m, x.id), 0) + 1, customerId: a.customerId, on: a.on, madeOn: dayOf(s.now), amount: a.amount };
      s.books.promises.push(p);
      return copy(p);
    }),
    askPaymentFix: (a) => write(() => {
      const pay = s.books.payments.find((x) => x.id === a.paymentId);
      if (!pay) throw dataError('refused', 'That payment is not in the books');
      const ask = { id: 'pa' + (s.books.paymentAsks.length + 1), paymentId: pay.id, customerId: pay.customerId, orderId: pay.orderId, what: a.what, want: { ...a.want }, amount: a.what === 'over' && Number(a.want.over) > 0 ? Number(a.want.over) : pay.amount, status: 'sent' as const, by: me.id, at: s.now };
      s.books.paymentAsks.push(ask);
      return copy(ask);
    }),
    withdrawPaymentAsk: (id) => write(() => { const a = s.books.paymentAsks.find((x) => x.id === id); if (a) a.status = 'withdrawn'; }),

    addCustomer: (a) => write(() => copy(W.addCustomer(s, a))),

    askSourcing: (a) => write(() => {
      const name = a.name.trim(), hit = s.books.asks.find((x) => x.status !== 'dropped' && x.name.toLowerCase() === name.toLowerCase());
      const req = { at: s.now, by: me.id, customerId: a.customerId, qty: a.qty || 1 };
      if (hit) { hit.requests.push(req); return copy(hit); }
      const ask: SourcingAsk = { id: 'SRC-' + s.now.toString(36).toUpperCase(), name, status: 'asked', createdAt: s.now, stageAt: s.now, itemId: null, requests: [req], tried: [] };
      s.books.asks.push(ask);
      return copy(ask);
    }),
    logSearchMiss() { /* the demo keeps no search log */ },

    send: (chatId, text) => write(() => say(chatId, text, 'text')),
    sendTemplate: (chatId, text) => write(() => say(chatId, text, 'template')),
    sendImage: (chatId, _file, caption) => write(() => say(chatId, caption, 'image')),
    sendCatalog: (chatId) => write(() => say(chatId, '', 'catalog')),
    media: (messageId) => {
      const m = s.messages.find((x) => x.id === messageId);
      return m && m.media ? Promise.resolve({ link: m.media, mime: 'image/jpeg' }) : Promise.reject(dataError('refused', 'no file came back'));
    },
    note: (chatId, body) => write(() => {
      const n: ChatNote = { id: 'n' + (s.notes.length + 1), chatId: chat(chatId).id, at: s.now, by: me.id, body };
      s.notes.push(n);
      return copy(n);
    }),
    take: (chatId) => write(() => {
      const c = chat(chatId);
      if (c.ownerId && c.ownerId !== me.id) throw dataError('refused', 'Someone else took it first', 'OWTKN');
      c.ownerId = me.id; c.ownerAt = s.now;
      s.events.push({ id: 'e' + (s.events.length + 1), chatId, at: s.now, kind: 'taken', by: me.id, to: me.id, note: '' });
    }),
    // hand_conversation (0170): your own customer is handed; the Manager (chat.move) moves anyone's, and both are pushed.
    give: (chatId, to, note) => write(() => {
      const c = chat(chatId), mine = c.ownerId === me.id;
      if (!mine && me.role !== 'manager') throw dataError('refused', 'Only the chat’s salesperson hands it on; the Manager moves any chat.', '42501');
      const target = s.books.members.find((m) => m.id === to);
      if (!target || !['sales', 'manager', 'owner'].includes(target.role)) throw dataError('refused', 'Give it to someone on the sales team.', '22023');
      if (c.ownerId === to) return;
      c.ownerId = to; c.ownerAt = s.now;
      s.events.push({ id: 'e' + (s.events.length + 1), chatId, at: s.now, kind: mine ? 'handed' : 'moved', by: me.id, to, note: note.trim() });
    }),
    markRead: (chatId) => write(() => { chat(chatId).lastReadAt = s.now; }),
    touch() { /* presence is seeded */ },
    served: (chatId) => {
      const by = new Map<string, number>(Object.entries(s.servedBefore[chatId] || {}));
      s.messages.filter((m) => m.chatId === chatId && m.dir === 'out' && m.by).forEach((m) => by.set(m.by as string, (by.get(m.by as string) || 0) + 1));
      return Promise.resolve([...by].map(([id, n]) => ({ by: id, name: (s.books.members.find((m) => m.id === id) || { name: '' }).name, messages: n })));
    },
  };
  return src;
}
