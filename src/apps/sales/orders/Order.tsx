/*
 * OR05–OR09, OR12, OR13, OR22 · One order, as a full sheet over the list: the customer and the
 * track on navy, then what it costs and what is paid, what they get (each line's mark), and the
 * acts: Tell, Receipt, Change (before the bill) or Fix it (after), and Take payment while unpaid.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { orderOwes, orderTotal } from '../../../core/money.ts';
import { firstWord, orderNo } from '../../../core/names.ts';
import { clock, dayLabel, dayOf } from '../../../core/time.ts';
import type { Books, Order } from '../../../core/types.ts';
import { Button } from '../../../ui/Button.tsx';
import { FullSheet, SheetHead } from '../../../ui/FullSheet.tsx';
import { Icon, phWhatsapp } from '../../../ui/icons.tsx';
import { ItemSquare } from '../../../ui/ItemSquare.tsx';
import { nav } from '../shell/nav.ts';
import { books, now } from '../shell/store.ts';
import type { ScreenProps } from '../shell/types.ts';
import { custOf, faceOf, headWhen, kept, member, nameOf, orderOf, overOf, overPaymentOf, shortItem, shortName, waitsRuth } from './data.ts';
import { go, payFor } from './links.ts';
import { CheckList, Pills } from './local-CheckList.tsx';
import { ActBar, Tiles, type Act } from './local-Parts.tsx';
import { Track } from './local-Track.tsx';
import { AskTimeline, DoorCard, LadderUnder, MapCard, PriceTell } from './OrderParts.tsx';
import { openChange } from './Change.tsx';
import { openTell } from './Tell.tsx';
import { openWrong } from './Wrong.tsx';
import { freshPrice, orderView } from './view.ts';
import './order.css';

export function OrderScreen(p: ScreenProps): JSX.Element {
  const b = books.value, o = b && orderOf(b, Number(p.params.id));
  if (!b || !o) return <FullSheet onBack={nav.back} backLabel="Back to Orders" head={<div class="ow-shead" />}><p class="or-gone">{b ? 'This order is no longer in the books' : ''}</p></FullSheet>;
  return <OrderBody b={b} o={o} />;
}

function OrderBody(p: { b: Books; o: Order }): JSX.Element {
  const { b, o } = p, t = now.value, v = orderView(b, o, t), who = shortName(b, o), name = nameOf(b, o);
  const [open, setOpen] = useState(false);
  const c = custOf(b, o), phone = c?.phone || o.client.phone, fresh = freshPrice(o);
  const delivered = o.stage === 'delivered', owes = orderOwes(o), total = orderTotal(o);
  const ruth = firstWord(b.members.find((m) => m.role === 'manager')?.name || 'Manager');
  const k = kept(o), waitN = o.lines.filter(waitsRuth).length;
  const pending = (o.stage === 'checking' && waitN > 0 && !o.toldTotal) || !!fresh;
  const op = delivered ? overPaymentOf(b, o) : null;
  const tiles = op ? [v.tiles[0], { k: 'Paid over', v: overOf(b, op).over, tone: 'warn' as const, note: `${firstWord(b.members.find((m) => m.role === 'accounts')?.name || 'Accounts')} settles it`, on: () => nav.push('orders/paid-over', { payment: op.id }) }] : v.tiles;
  const acts: Act[] = [];
  if (fresh) acts.push({ bg: '#E4E6FA', fg: '#3A3F9B', icon: 'phone', word: `Call ${who}`, sub: phone, href: phone ? 'tel:' + phone.replace(/\s/g, '') : undefined });
  else acts.push({ bg: '#E4F4EA', fg: '#0F6B43', duo: phWhatsapp, word: `Tell ${who}`, sub: v.tellSub, on: () => openTell(o.id) });
  acts.push({ bg: '#DCEAF8', fg: '#1A5A8A', icon: 'receipt', word: 'Receipt', sub: pending ? 'as it stands' : total.toLocaleString('en-US'), on: () => go('customers/paid', { id: o.id }) });
  if (delivered) acts.push({ bg: '#FDEEE1', fg: '#7A4A02', icon: 'warning', word: 'Fix it', sub: `ask ${ruth}`, label: v.returnAsk ? 'Something wrong with this sale' : 'Fix it: something wrong with this sale', on: () => openWrong(o.id) });
  else acts.push({ bg: '#F1EEE8', fg: '#5F6980', icon: 'pen', word: 'Change', sub: `ask ${ruth}`, label: `Change this order: ask ${ruth}`, on: () => openChange(o.id) });
  return (
    <FullSheet onBack={nav.back} backLabel="Back to Orders" gap={v.returnAsk ? 8 : 10}
      head={(
        <SheetHead face={faceOf(b, o)} name={name} sub={`${orderNo(o.id)} · ${headWhen(delivered && o.invoicedAt && t - o.placedAt > 7 * 864e5 ? o.invoicedAt : o.placedAt, t)}`} subMono phone={phone || undefined} callLabel={`Call ${name}`} onClose={nav.back}>
          <Track stage={o.stage} sub={v.sub} waits={v.waits} times={v.times} skipped={v.skipped} />
        </SheetHead>
      )}>
      {delivered && !v.returnAsk && o.deliveredAt && o.deliverTo && dayOf(o.deliveredAt) === dayOf(t) && <DoorCard place={o.deliverTo ? o.deliverTo.split(',')[0] : 'At the gate'} by={member(b, o.holderId)?.name} at={`${dayLabel(o.deliveredAt)} · ${clock(o.deliveredAt)}`} />}
      {o.stage === 'road' && <MapCard b={b} o={o} />}
      <Tiles tiles={tiles} />
      {o.stage === 'road' ? null : delivered && !v.returnAsk && !open ? (
        <div class="or-fold">
          <ItemIcon b={b} o={o} />
          <span class="or-fold-n">{k.length ? `${k[0].name.split(' · ')[0]}${k.length > 1 ? ` +${k.length - 1}` : ''}` : shortItem(o.lines[0]?.name || '')}</span>
          {v.head.pills && <Pills pills={v.head.pills} />}
          <button type="button" class="or-fold-b" aria-label="Show the items" onClick={() => setOpen(true)}><Icon name="chevron-down" size={16} stroke={2.2} /></button>
        </div>
      ) : (
        <CheckList head={v.head} lines={v.lines.map((l, i) => (o.stage === 'checking' && l.mark.k === 'face' && o.lines[i].price != null ? { ...l, under: <LadderUnder b={b} o={o} l={o.lines[i]} /> } : l))} />
      )}
      {fresh && <PriceTell b={b} o={o} l={fresh} />}
      {v.returnAsk && <AskTimeline b={b} o={o} ask={v.returnAsk} />}
      <div class="or-foot">
        <ActBar acts={acts} />
        {owes > 0 && !v.returnAsk && !pending
          ? <Button kind="red" icon="cash" class="or-take" onClick={() => payFor(b, o)}>Take payment · <span class="mono">{owes.toLocaleString('en-US')}</span></Button>
          : null}
        {delivered && !v.returnAsk && <button type="button" class="ow-btn k-ghost h52" onClick={() => go('sell/order', { customer: o.customerId, from: 'again', items: o.id })}><Icon name="undo" size={18} stroke={2} />Sell again</button>}
      </div>
    </FullSheet>
  );
}

function ItemIcon(p: { b: Books; o: Order }): JSX.Element {
  const l = kept(p.o)[0], it = l && p.b.items.find((i) => i.id === l.itemId);
  return <ItemSquare aisle={it?.aisle || ''} size={34} radius={9} icon={20} />;
}
