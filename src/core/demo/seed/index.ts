/*
 * The whole sample shop, fresh each time: FACTS.md as the app's shapes.
 * Each entity has its own file; each tab adds what only it needs in
 * extra/<tab>.ts, which only that tab's builder edits.
 */
import { at } from '../../time.ts';
import type { Books, Chat, ChatEvent, ChatNote, Message, Ms } from '../../types.ts';
import type { DemoFlags } from '../flags.ts';
import { sourcingAsks } from './asks.ts';
import { backgroundCustomers, backgroundOrders } from './background.ts';
import { chatEvents, chats, messages } from './chats.ts';
import { NOW, TODAY } from './clock.ts';
import { castCustomers } from './customers.ts';
import { items } from './items.ts';
import { billAsks, goal, payments, paymentAsks, promises, settings } from './money.ts';
import { liveOrders } from './orders-live.ts';
import { pastOrders } from './orders-past.ts';
import { GRACE, people } from './people.ts';
import { extra as chatsExtra } from './extra/chats.ts';
import { extra as counterExtra } from './extra/counter.ts';
import { extra as customersExtra } from './extra/customers.ts';
import { extra as ordersExtra } from './extra/orders.ts';
import { extra as sellExtra } from './extra/sell.ts';
import { extra as todayExtra } from './extra/today.ts';

/** Everything the demo holds. The demo source reads and writes this, and hands out copies. */
export interface DemoState {
  now: Ms;
  books: Books;
  connected: boolean;
  chats: Chat[];
  messages: Message[];
  notes: ChatNote[];
  events: ChatEvent[];
}

export function seed(f: DemoFlags): DemoState {
  const members = people();
  const now = f.clock ? at(TODAY, f.clock) : f.state === 'first-day' ? at(TODAY, '8:00') : NOW;
  const s: DemoState = {
    now,
    books: {
      at: now,
      shop: { id: 'demo-shop', name: 'Mukasa Hardware' },
      settings: settings(),
      me: members.find((m) => m.id === GRACE) as Books['me'],
      members,
      customers: [...castCustomers(), ...backgroundCustomers()],
      orders: [...liveOrders(), ...pastOrders(), ...backgroundOrders()].sort((a, b) => a.id - b.id),
      items: items(),
      payments: payments(),
      promises: promises(),
      asks: sourcingAsks(),
      billAsks: billAsks(),
      paymentAsks: paymentAsks(),
      goal: goal(),
    },
    connected: true,
    chats: chats(),
    messages: messages(),
    notes: [],
    events: chatEvents(),
  };
  if (f.state === 'empty') emptyShop(s);
  if (f.state === 'first-day') firstDay(s);
  // Each tab's own additions, in tab order.
  [todayExtra, chatsExtra, sellExtra, counterExtra, ordersExtra, customersExtra].forEach((x) => x(s, f));
  return s;
}

/** &state=empty: nothing live, nobody owes, no chats (CH06, OR04, CU06). */
function emptyShop(s: DemoState): void {
  const b = s.books;
  b.orders = b.orders.filter((o) => o.stage === 'delivered' && o.invoiced);
  b.customers.forEach((c) => { c.owes = 0; c.debtLog = []; });
  b.promises = []; b.billAsks = []; b.paymentAsks = []; b.asks = [];
  s.chats = []; s.messages = []; s.events = [];
}

/** &state=first-day: Grace's first day (TD06): nothing of hers yet, nothing waiting on her. */
function firstDay(s: DemoState): void {
  const b = s.books;
  b.orders = b.orders.filter((o) => o.placedBy !== GRACE);
  b.payments = b.payments.filter((p) => p.by !== GRACE);
  b.billAsks = []; b.paymentAsks = []; b.promises = [];
  s.chats.forEach((c) => { if (c.ownerId === GRACE) c.ownerId = null; });
}
