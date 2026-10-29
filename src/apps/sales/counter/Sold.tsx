/*
 * KC14 / KC15 · Sold: the change to give, big, as the notes to hand back (cash), or paid in full
 * with the ID kept (mobile); the day at the counter as bars, this sale in mint. It does not go back
 * by itself (a cashier giving change must not lose the screen): Receipt, Sell again, Back to Today.
 */
import type { JSX } from 'preact';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { fig } from '../../../ui/Money.tsx';
import { notesFor, orderTotal } from '../../../core/money.ts';
import { orderNo } from '../../../core/names.ts';
import { clock } from '../../../core/time.ts';
import type { Method, Order } from '../../../core/types.ts';
import { nav } from '../shell/nav.ts';
import { books, now } from '../shell/store.ts';
import type { ScreenProps } from '../shell/types.ts';
import { counterToday } from './shop.ts';
import { reset, sold } from './state.ts';
import './sold.css';

const WORD: Record<Method, string> = { cash: 'cash', momo: 'mobile', bank: 'bank' };
const NOTE_TINT: Record<number, [string, string]> = {
  50000: ['#F6E4F1', '#7A3268'], 20000: ['#DCEAF8', '#1A5A8A'], 10000: ['#DDF1EE', '#0E5E57'], 5000: ['#E4E6FA', '#3A3F9B'], 2000: ['#FDEEE1', '#7A4A02'], 1000: ['#E8EBF0', '#3D4A5C'],
};

/** What the Sold and Receipt screens need of a sale: the order, how it was paid, what they gave, the ID. */
export function saleOf(id: number): { o: Order; method: Method; given: number; ref: string } | null {
  const b = books.value, fresh = sold.value && sold.value.order.id === id ? sold.value : null;
  const o = (b && b.orders.find((x) => x.id === id && x.invoiced)) || (fresh ? fresh.order : null);
  if (!o) return null;
  const pay = b ? b.payments.find((p) => p.orderId === id) : undefined;
  const method = o.payments.length ? o.payments[0].method : pay ? pay.method : 'cash';
  return { o, method, given: fresh ? fresh.given : 0, ref: fresh ? fresh.ref : pay ? pay.ref : '' };
}

function Day(p: { id: number }): JSX.Element | null {
  const b = books.value;
  if (!b) return null;
  const sales = counterToday(b, now.value);
  if (!sales.length) return null;
  const top = Math.max(...sales.map((x) => x.amount)), sum = sales.reduce((a, x) => a + x.amount, 0);
  const first = sales[0].o, last = sales[sales.length - 1].o;
  return (
    <div class="kc-day">
      <div class="kc-day-h"><span>Today at the counter</span><span><span class="mono">{fig(sales.length)}</span>{' sales · '}<span class="mono w">{fig(sum)}</span></span></div>
      <span role="img" aria-label={`${sales.length} sales today from ${clock(first.invoicedAt || first.placedAt)}, this one at ${clock(last.invoicedAt || last.placedAt)}`} class="kc-bars">
        {sales.map((x) => (
          <span key={x.o.id} title={fig(x.amount)} style={{ height: `${Math.round((x.amount / top) * 100)}%`, background: x.o.id === p.id ? '#6FDCB0' : x.method === 'cash' ? '#DDE3F0' : '#8D99B5' }} />
        ))}
      </span>
      <div class="kc-day-f">
        <span class="mono">{clock(first.invoicedAt || first.placedAt)}</span>
        <span class="kc-legend"><span><i style={{ background: '#DDE3F0' }} />cash</span><span><i style={{ background: '#8D99B5' }} />mobile</span><span class="me"><i style={{ background: '#6FDCB0' }} />this one</span></span>
        <span class="mono">{clock(last.invoicedAt || last.placedAt)}</span>
      </div>
    </div>
  );
}

export function Sold(p: ScreenProps): JSX.Element {
  const id = Number(p.params.id), s = saleOf(id);
  const again = () => { reset(); nav.replace('counter'); };
  if (!s) return <main class="kc-sold" aria-busy="true" />;
  const total = orderTotal(s.o), change = s.method === 'cash' ? Math.max(0, s.given - total) : 0, notes = notesFor(change);
  const name = s.o.client.name || 'Walk-in', c = books.value && s.o.customerId ? books.value.customers.find((x) => x.id === s.o.customerId) : null;
  return (
    <main class="kc-sold">
      <div class="kc-sold-x"><button type="button" aria-label="Close" onClick={again}><Icon name="close" size={16} stroke={2.2} /></button></div>
      <div class="kc-sold-c">
        <span class="kc-pop" aria-hidden="true"><Icon name="check" size={42} stroke={2.8} /></span>
        <h1>Sold</h1>
        <span class="kc-who-pill">
          <Avatar initials={c ? c.initials : 'WI'} tint={c ? c.tint : 't4'} size={30} />
          <span class="n">{name}</span>
          <span class="mono">{`${orderNo(id)} · ${fig(total)} · ${WORD[s.method]}`}</span>
        </span>
      </div>
      {change > 0 ? (
        <div class="kc-card">
          <div class="kc-card-h"><span class="kc-chg-k">Give change</span><span class="kc-gave-t">{'They gave '}<span class="mono">{fig(s.given)}</span></span></div>
          <span class="mono kc-big">{fig(change)}</span>
          <div role="img" aria-label={`Give ${notes.map((n) => 'one ' + fig(n)).join(', ').replace(/, ([^,]*)$/, ' and $1')}`} class="kc-give" style={{ gridTemplateColumns: `repeat(${Math.max(3, notes.length)}, minmax(0, 1fr))` }}>
            {notes.map((n, i) => <span key={i} class="mono" style={{ background: NOTE_TINT[n][0], color: NOTE_TINT[n][1] }}>{fig(n)}</span>)}
          </div>
        </div>
      ) : (
        <div class="kc-card paid">
          <div class="kc-card-h"><span class="kc-meth">{s.method === 'cash' ? 'Cash' : s.method === 'momo' ? 'Mobile' : 'Bank'}</span><span class="kc-paid"><Icon name="check" size={12} stroke={3.2} />Paid</span></div>
          <span class="mono kc-big">{fig(total)}</span>
          {!!s.ref && (
            <div class="kc-id">
              <span aria-hidden="true"><Icon name={s.method === 'bank' ? 'bank' : 'mobile'} size={18} stroke={2} /></span>
              <span><span>Transaction ID</span><span class="mono">{s.ref}</span></span>
            </div>
          )}
        </div>
      )}
      <Day id={id} />
      <div class="kc-sold-f">
        <div>
          <button type="button" class="kc-pillbtn" onClick={() => nav.push('counter/receipt', { id })}><Icon name="receipt" size={18} stroke={2} style={{ color: '#6FDCB0' }} />Receipt</button>
          <button type="button" class="kc-pillbtn" onClick={again}><Icon name="plus" size={18} stroke={2.4} style={{ color: '#6FDCB0' }} />Sell again</button>
        </div>
        <a href="#" class="kc-home" onClick={(e) => { e.preventDefault(); reset(); nav.home(); }}>Back to Today</a>
      </div>
    </main>
  );
}
