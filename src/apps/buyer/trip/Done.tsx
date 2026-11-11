/*
 * Trip · Handed in (TripHandIn.dc.html phones 3 and 4): the end of the
 * trip. Each order goes to the Store (Packing, dashed: Musa counts it in
 * first); the cash back to Esther; one button, "Back to Today". With no signal the
 * hand-in waits on this phone: "Saved on this phone · Sends when online".
 */
import type { JSX } from 'preact';
import { handIn } from '../../../core/buyer/rules.ts';
import { counted, firstWord } from '../../../core/names.ts';
import { clock } from '../../../core/time.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { fig } from '../../../ui/Money.tsx';
import { EndOfFlow } from '../../../ui/Moment.tsx';
import { Notice } from '../../../ui/Notice.tsx';
import { nav, type Params } from '../shell/nav.ts';
import { books, flush, kept as keptW, now } from '../shell/store.ts';
import { byRole, liveStops, memberOf, ordersCame, tripBooks } from './model.ts';
import { OrderChip } from './parts.tsx';
import { Told } from './Told.tsx';
import './handin.css';

export function Done(p: { params: Params }): JSX.Element {
  const b = books.value ? tripBooks(books.value, keptW.value) : null, t = b ? b.trip : null;
  if (!b || !t) return <main class="ow-b-trip" aria-busy="true" />;
  const kept = !!p.params.kept;
  const h = handIn(t, b), came = ordersCame(b, t), musa = byRole(b, 'store'), esther = byRole(b, 'accounts');
  const mn = firstWord(musa?.name || 'The store');
  const end = <div class="ow-b-hi-end"><EndOfFlow on={() => nav.home()} bar={false} /></div>;

  if (kept) {
    return (
      <main class="ow-b-trip ow-b-hi-done">
        <header class="ow-b-trip-head">
          <button type="button" class="ow-b-trip-x" aria-label="Close" onClick={() => nav.home()}><Icon name="close" size={20} stroke={2} /></button>
          <div class="ow-b-trip-ht"><h1>Hand in</h1></div>
          <span class="mono ow-b-hi-time">{clock(now.value)}</span>
        </header>
        <div class="ow-b-trip-body">
          <Notice kind="offline"><b>Saved on this phone</b> · Sends when online</Notice>
          <h2 class="ow-b-hi-h">Waiting to send <span class="mono">{fig(h.paid)}</span></h2>
          {came.map((o) => (
            <div key={o.order.id} class="ow-b-hi-wait">
              <OrderChip who={memberOf(b, o.order.sellerId)} id={o.order.id} /><b>{o.order.client}</b>
              <span class="ow-b-hi-mark kept" aria-label="Sends when online"><Icon name="clock" size={14} stroke={2.4} /></span>
            </div>
          ))}
          <h2 class="ow-b-hi-h">Then told <Icon name="bell" size={16} stroke={2} /></h2>
          <Told b={b} back={h.back} orders={came.length} shorts={h.shorts} kept />
          <button type="button" class="ow-b-hi-now" onClick={() => { void flush(); }}>Send now</button>
          {end}
        </div>
      </main>
    );
  }

  return (
    <main class="ow-b-trip ow-b-hi-done">
      <div class="ow-b-hi-moment">
        <span class="ow-b-hi-tick"><Icon name="check" size={30} stroke={2.6} /></span>
        <h1>Handed in</h1>
        {musa && <span class="ow-b-hi-who"><Avatar initials={musa.initials} tint={musa.tint} size={28} /><Icon name="bell" size={14} stroke={2} />{`${mn} counts it in`}</span>}
        <span class="mono ow-b-hi-meta">{[clock(t.handedInAt ?? now.value), counted(liveStops(t).length, 'stop'), counted(came.length, 'order')].join(' · ')}</span>
      </div>
      <div class="ow-b-trip-body">
        {came.map((o) => {
          const short = h.shorts.find((s) => s.order.id === o.order.id), seller = memberOf(b, o.order.sellerId);
          return (
            <div key={o.order.id} class="ow-b-hi-card" aria-label={`${o.order.client}: Packing, once ${mn} counts it in`}>
              <div class="ow-b-hi-top"><OrderChip who={seller} id={o.order.id} /><b>{o.order.client}</b><span class="ow-b-hi-next">Packing</span></div>
              <span class="ow-b-hi-stage" aria-hidden="true"><i class="on" /><i class="on" /><i class="next" /><i /><i /></span>
              {short && <span class="ow-b-hi-short">{seller && <Avatar initials={seller.initials} tint={seller.tint} size={28} />}<Icon name="bell" size={14} stroke={2} />{`Short · got ${short.got} of ${short.line.qty}`}</span>}
            </div>
          );
        })}
        {esther && (
          <div class="ow-b-hi-cash">
            <Avatar initials={esther.initials} tint={esther.tint} size={36} />
            <span class="ow-b-hi-tt"><b>{firstWord(esther.name)}</b><span><Icon name="bell" size={12} stroke={2} />Cash back</span></span>
            <span class="mono ow-b-hi-cashamt">{fig(h.back)}</span>
          </div>
        )}
        {end}
      </div>
    </main>
  );
}
