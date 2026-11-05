/*
 * OR05–OR09, OR12, OR13, OR22 · One order, as a full sheet over the list: the customer and the
 * track on navy, then what it costs and what is paid, what they get (each line's mark), and the
 * acts: Tell, Receipt, Change (before the bill) or Fix it (after), and Take payment while unpaid.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { orderOwes, orderTotal, paidOver } from '../../../core/money.ts';
import { firstWord, orderNo, phone9 } from '../../../core/names.ts';
import { clock, dayLabel, dayOf } from '../../../core/time.ts';
import type { Books, Order } from '../../../core/types.ts';
import { Button } from '../../../ui/Button.tsx';
import { FullSheet, SheetHead } from '../../../ui/FullSheet.tsx';
import { Icon, phWhatsapp } from '../../../ui/icons.tsx';
import { ItemSquare } from '../../../ui/ItemSquare.tsx';
import { nav } from '../shell/nav.ts';
import { books, now } from '../shell/store.ts';
import type { ScreenProps } from '../shell/types.ts';
import { twinOf } from '../../../core/orders.ts';
import { custOf, faceOf, kept, member, nameOf, orderOf, orderWhen, overPaymentOf, owesOnceFixed, payFixesOf, shortItem, shortName } from './data.ts';
import { go, payFor } from './links.ts';
import { CheckList, CheckPills } from '../../../ui/CheckList.tsx';
import { ActBar, type Act } from '../../../ui/ActTiles.tsx';
import { MoneyTiles } from '../../../ui/MoneyTiles.tsx';
import { Track } from '../../../ui/Track.tsx';
import { AskTimeline, DoorCard, GateCard, LadderUnder, MapCard, OverRow, PaidBar, PayFixAsked, PriceTell, TwinCard } from './OrderParts.tsx';
import { openChange } from './Change.tsx';
import { openTell } from './Tell.tsx';
import { openPayFix, openWrong } from './Wrong.tsx';
import { freshPrice, orderView, pendingOf } from './view.ts';
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
  const ruth = firstWord(b.members.find((m) => m.role === 'manager')?.name || 'Manager'), esther = firstWord(b.members.find((m) => m.role === 'accounts')?.name || 'Accounts');
  const k = kept(o);
  const pending = pendingOf(o);
  const op = delivered ? overPaymentOf(b, o) : null;
  const fixes = o.voided ? [] : payFixesOf(b, o);
  const tiles = fixes.length && v.bill ? [{ ...v.tiles[0], warnNote: v.tiles[1].note }, { ...v.tiles[1], dot: true, note: `${owesOnceFixed(b, o, fixes[0]).toLocaleString('en-US')} once fixed` }] : op ? [{ ...v.tiles[0], note: o.paid >= total ? 'paid in full' : v.tiles[0].note }, { k: 'Paid over', v: paidOver(b, op).over, tone: 'warn' as const, note: `${firstWord(b.members.find((m) => m.role === 'accounts')?.name || 'Accounts')} settles it`, on: () => nav.push('orders/paid-over', { payment: op.id, from: 'order' }), label: `Paid over ${paidOver(b, op).over.toLocaleString('en-US')}: pick Give change or Deposit for ${firstWord(b.members.find((m) => m.role === 'accounts')?.name || 'Accounts')}` }] : v.tiles;
  const acts: Act[] = [];
  if (fresh) acts.push({ tone: 'call', icon: 'phone', word: `Call ${who}`, sub: phone, href: phone9(phone) ? 'tel:+256' + phone9(phone) : undefined });
  else acts.push({ tone: 'tell', duo: phWhatsapp, word: v.bill ? 'Tell them' : `Tell ${who}`, sub: v.tellSub, on: () => openTell(o.id) });
  acts.push({ tone: 'receipt', icon: 'receipt', word: 'Receipt', sub: o.voided ? 'voided' : pending ? 'as it stands' : v.bill ? `${o.paid.toLocaleString('en-US')} paid` : total.toLocaleString('en-US'), on: () => nav.push('orders/receipt', { id: o.id }) });
  if (o.voided) { /* nothing to fix on a voided bill */ }
  else if (v.bill) acts.push({ tone: 'fix', icon: 'warning', word: 'Fix it', sub: `ask ${esther}`, label: 'Something wrong with this bill', on: () => openPayFix(o.id) });
  else if (delivered) acts.push({ tone: 'fix', icon: 'warning', word: 'Fix it', sub: `ask ${ruth}`, label: v.returnAsk ? 'Something wrong with this sale' : 'Fix it: something wrong with this sale', on: () => openWrong(o.id) });
  else acts.push({ tone: 'change', icon: 'pen', word: 'Change', sub: `ask ${ruth}`, label: `Change this order: ask ${ruth}`, on: () => openChange(o.id) });
  return (
    <FullSheet onBack={nav.back} backLabel="Back to Orders" gap={v.returnAsk ? 8 : 10}
      head={(
        <SheetHead face={faceOf(b, o)} name={name} sub={`${orderNo(o.id)} · ${orderWhen(o, t)}`} subMono phone={phone9(phone) ? '+256' + phone9(phone) : undefined} callLabel={`Call ${name}`} onClose={nav.back}>
          <Track stage={o.stage} word={v.word} ready={v.ready} sub={v.sub} waits={v.waits} times={v.times} skipped={v.skipped} />
        </SheetHead>
      )}>
      {delivered && !v.returnAsk && o.deliveredAt && o.deliverTo && dayOf(o.deliveredAt) === dayOf(t) && <DoorCard place={o.deliverTo ? o.deliverTo.split(',')[0] : 'At the gate'} by={member(b, o.holderId)?.name} at={`${dayLabel(o.deliveredAt)} · ${clock(o.deliveredAt)}`} photo={o.deliveredPhoto} />}
      {v.ready ? <GateCard o={o} /> : o.stage === 'road' && <MapCard b={b} o={o} />}
      <MoneyTiles tiles={tiles} />
      {op && <OverRow b={b} p={op} />}
      {(o.stage === 'road' && !v.ready) || v.bill ? null : delivered && !v.returnAsk && !open ? (
        <div class="or-fold">
          <ItemIcon b={b} o={o} />
          <span class="or-fold-n">{k.length ? `${k[0].name.split(' · ')[0]}${k.length > 1 ? ` +${k.length - 1}` : ''}` : shortItem(o.lines[0]?.name || '')}</span>
          {v.head.pills && <CheckPills pills={v.head.pills} />}
          <button type="button" class="or-fold-b" aria-label="Show the items" onClick={() => setOpen(true)}><Icon name="chevron-down" size={16} stroke={2.4} /></button>
        </div>
      ) : (
        <CheckList tight={v.ready} head={v.head} lines={v.lines.map((l, i) => (o.stage === 'checking' && l.mark.k === 'face' && o.lines[i].price != null ? { ...l, under: <LadderUnder b={b} o={o} l={o.lines[i]} /> } : l))} />
      )}
      {o.voided && twinOf(b.orders, o, true) && <TwinCard b={b} o={o} />}
      {fresh && <PriceTell b={b} o={o} l={fresh} />}
      {v.returnAsk && <AskTimeline b={b} o={o} ask={v.returnAsk} />}
      {fixes.map((x) => <PayFixAsked key={x.pay.id} b={b} o={o} pay={x.pay} asks={x.asks} />)}
      {fixes.length > 0 && v.bill && <PaidBar b={b} o={o} />}
      <div class="or-foot">
        <ActBar acts={acts} />
        {owes > 0 && !v.returnAsk && !pending && !o.voided
          ? <Button kind="red" icon="cash" class="or-take" onClick={() => payFor(b, o)}>Take payment · <span class="mono">{owes.toLocaleString('en-US')}</span></Button>
          : null}
        {delivered && !v.returnAsk && !v.bill && !o.voided && <button type="button" class="ow-btn k-ghost h52" onClick={() => go('sell/order', { customer: o.customerId, from: 'again', items: againItems(o) })}><Icon name="undo" size={18} stroke={2} />Sell again</button>}
      </div>
    </FullSheet>
  );
}

/** Sell again: this order's own lines, at today's prices (ROUTES.md sell/order `items`). */
const againItems = (o: Order): string => JSON.stringify(kept(o).map((l) => ({ itemId: l.itemId, variantIdx: l.variantIdx, qty: l.qty })));

function ItemIcon(p: { b: Books; o: Order }): JSX.Element {
  const l = kept(p.o)[0], it = l && p.b.items.find((i) => i.id === l.itemId);
  return <ItemSquare aisle={it?.aisle || ''} size={34} radius={9} icon={20} />;
}
