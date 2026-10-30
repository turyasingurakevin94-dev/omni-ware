/*
 * sell/placed · the order is in (SL28, SL29; P22): its number (a tap opens
 * it), the picture on WhatsApp (sent, or "not sent yet · Try again"), what
 * went and what it comes to, what happens next stage by stage, and the one
 * end: "Back to Today", which the mint bar takes by itself.
 */
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { lineTotal, orderTotal } from '../../../core/money.ts';
import { lineWaits } from '../../../core/orders.ts';
import { orderNo } from '../../../core/names.ts';
import type { Books, Order } from '../../../core/types.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Duo, Icon, phWhatsapp, type IconName } from '../../../ui/icons.tsx';
import { ItemSquare } from '../../../ui/ItemSquare.tsx';
import { fig } from '../../../ui/Money.tsx';
import { EndOfFlow } from '../../../ui/Moment.tsx';
import { nav } from '../shell/nav.ts';
import { books } from '../shell/store.ts';
import type { ScreenProps } from '../shell/types.ts';
import { first } from './insights.ts';
import { itemOf } from './model.ts';
import { buyer, manager, sourcing, store } from './people.ts';
import { lastPlaced, pictures, sendPicture } from './picture.ts';
import '../../../ui/moment.css';
import './placed.css';

const BACK_MS = 8000;

interface Step { icon: IconName; title: string; sub: string; now?: boolean; skipped?: boolean }

/** What happens next, from where it starts and what waits (spec 01: the five stages). */
function steps(b: Books, o: Order, who: string): Step[] {
  const coming = o.lines.some((l) => l.price == null), under = o.lines.some((l) => l.price != null && lineWaits(l));
  const buy = o.lines.filter((l) => l.from !== 'shelf');
  const m = manager(b), s = sourcing(b), d = buyer(b), st = store(b);
  if (o.stage === 'packing') {
    return [
      { icon: 'checking', title: 'Checking', sub: 'skipped · all on our shelf', skipped: true },
      { icon: 'orders', title: 'Packing', sub: `now · ${st.first} packs it`, now: true },
      ...(o.paid < orderTotal(o) ? [{ icon: 'cash' as IconName, title: 'Not paid yet', sub: `${who} pays at the gate · Take payment` }] : []),
    ];
  }
  const why = coming ? `${s.first} finds the cost · ${m.first} prices it` : under ? `${m.first} decides the price` : o.credit ? `${m.first} decides the credit` : `${m.first} checks it`;
  const out: Step[] = [{ icon: 'checking', title: 'Checking', sub: `now · ${why}`, now: true }];
  if (buy.length) out.push({ icon: 'cart', title: 'Buying', sub: `${d.first} buys ${buy.length === 1 ? `the ${buy[0].name.split(' · ')[0].split(' ').slice(-1)[0].toLowerCase()}` : `${buy.length} items`}` });
  out.push({ icon: 'orders', title: 'Packing', sub: `${st.first} packs it` });
  return out;
}

export function PlacedScreen(p: ScreenProps): JSX.Element | null {
  const b = books.value, id = Number(p.params.id);
  const o = (b && b.orders.find((x) => x.id === id)) || (lastPlaced.value && lastPlaced.value.id === id ? lastPlaced.value : null);
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const t0 = Date.now();
    const iv = window.setInterval(() => { const k = Math.min(1, (Date.now() - t0) / BACK_MS); setPct(Math.round(k * 1000) / 10); if (k >= 1) { clearInterval(iv); nav.home(); } }, 100);
    return () => clearInterval(iv);
  }, []);
  if (!b || !o) return <main class="ow-moment sl-placed" aria-busy="true" />;
  const c = o.customerId ? b.customers.find((x) => x.id === o.customerId) || null : null;
  const who = c ? first(c.name) : 'They', pic = pictures.value.get(o.id);
  const n = o.lines.length, mode = o.deliverTo ? 'delivery' : 'pickup', unpaid = o.paid < orderTotal(o);
  const allShelf = o.lines.every((l) => l.from === 'shelf');
  return (
    <div class="ow-moment sl-placed">
      <div class="ow-moment-x"><button type="button" aria-label="Close" onClick={() => nav.home()}><Icon name="close" size={16} stroke={2.2} /></button></div>
      <div class="ow-moment-top">
        <span aria-hidden="true" class="ow-moment-tick"><Icon name="check" size={46} stroke={2.8} /></span>
        <h1>Placed</h1>
        <button type="button" class="ow-moment-who" aria-label={`Open ${orderNo(o.id)}`} onClick={() => nav.replace('orders/order', { id: o.id })}>
          <Avatar initials={c ? c.initials : 'WI'} tint={c ? c.tint : 't4'} size={30} font={11} />
          <span class="ow-moment-who-n">{c ? c.name : o.client.name}</span>
          <span class="mono ow-moment-who-r">{orderNo(o.id)}</span>
          <span class="ow-moment-who-go"><Icon name="chevron-right" size={14} stroke={2.4} /></span>
        </button>
        {pic && pic.state === 'sent' && <span class="ow-moment-note"><Duo i={phWhatsapp} size={16} color="#6FDCB0" />{`Picture sent to ${who}`}<Icon name="check" size={14} stroke={2.8} /></span>}
        {pic && pic.state === 'sending' && <span class="ow-moment-note sl-pic-wait"><Duo i={phWhatsapp} size={16} color="#B3BCD2" />{`Sending the picture to ${who}`}</span>}
        {pic && pic.state === 'failed' && (
          <span class="sl-pic-fail"><Duo i={phWhatsapp} size={16} color="#F5B26B" />Picture not sent yet
            <button type="button" onClick={() => void sendPicture(o, pic.chatId)}><span>Try again</span></button></span>
        )}
      </div>
      {n <= 2 ? (
        <div class="sl-placed-ls">
          {o.lines.map((l) => (
            <div key={l.lineId}><ItemSquare aisle={(itemOf(b, l.itemId, l.variantIdx) || { aisle: '' }).aisle} size={26} radius={8} icon={16} /><span class="n">{l.name.split(' · ')[0]}</span>
              <span class="mono q">{`${l.qty} × ${l.price == null ? '…' : fig(l.price)}`}</span><span class="mono a">{fig(lineTotal(l))}</span></div>
          ))}
          <div class="t"><span>{`${allShelf ? 'all on our shelf' : `${n} item${n === 1 ? '' : 's'}`} · ${mode}`}</span><span class="mono">{fig(orderTotal(o))}</span></div>
        </div>
      ) : (
        <div class="ow-moment-items">
          <span aria-hidden="true" class="ow-moment-sq">
            {o.lines.slice().reverse().slice(0, 3).map((l, i) => { const a = (itemOf(b, l.itemId, l.variantIdx) || { aisle: '' }).aisle; return i ? <span key={i} class="ow-moment-sq-r"><ItemSquare aisle={a} size={32} radius={10} icon={20} /></span> : <ItemSquare key={i} aisle={a} size={32} radius={10} icon={20} />; })}
          </span>
          <span class="ow-moment-items-t"><span>{`${n} items · ${mode}`}</span>{unpaid && <span>Not paid yet</span>}</span>
          <span class="mono ow-moment-items-a">{fig(orderTotal(o))}</span>
        </div>
      )}
      <div class="ow-next-steps">
        <span class="ow-next-steps-h">What happens next</span>
        {steps(b, o, who).map((s, i) => (
          <>
            {i > 0 && <span aria-hidden="true" class="ow-next-steps-line" />}
            <div class={'sl-step2' + (s.now ? ' now' : '') + (s.skipped ? ' skip' : '')}>
              <span aria-hidden="true" class="sl-step2-sq"><Icon name={s.icon} size={s.skipped ? 18 : 20} stroke={s.now ? 2 : s.skipped ? 1.8 : 1.9} /></span>
              <span class="sl-step2-t"><span>{s.title}</span><span>{s.sub}</span></span>
            </div>
          </>
        ))}
      </div>
      <EndOfFlow on={() => nav.home()} pct={pct} />
    </div>
  );
}
