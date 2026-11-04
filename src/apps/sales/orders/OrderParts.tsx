/*
 * The pictures inside one order: the door photo (OR09), the road map with the driver (OR08),
 * the price ladder of a line Ruth decides (OR12), the new price to tell (OR13), and where a
 * return ask is (OR22).
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { firstWord, orderNo, phone9 } from '../../../core/names.ts';
import { orderTotal, paidOver } from '../../../core/money.ts';
import { clock, dayOf, replyWindow, weekday, when } from '../../../core/time.ts';
import type { BillAsk, Books, Line, Order, Payment } from '../../../core/types.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Duo, Icon, phWhatsapp } from '../../../ui/icons.tsx';
import { OrderPill } from '../../../ui/StageGroup.tsx';
import { AskStep } from '../../../ui/Track.tsx';
import { toast } from '../../../ui/toast.tsx';
import { act, chats, now } from '../shell/store.ts';
import { twinOf } from '../../../core/orders.ts';
import { backLines, byRole, custOf, faceOfMember, member, shortItem, shortName } from './data.ts';
import { chatFor, sayMoney } from './msg.ts';
import './sheets.css';

/** OR09 · at the door: the photo square, where, who delivered, when. */
export function DoorCard(p: { place: string; by?: string; at: string }): JSX.Element {
  return (
    <div class="or-door">
      <button type="button" class="or-door-ph" aria-label="See the photo at the door" disabled><Icon name="camera" size={22} />photo</button>
      <span class="or-door-t"><span>At the door</span><span>{p.place}</span><span>{p.by ? `${firstWord(p.by)} delivered` : 'Delivered'}</span><span class="mono">{p.at}</span></span>
    </div>
  );
}

/** OR08 · on the road: the drawn route, when it arrives, where to, and the driver to call. */
export function MapCard(p: { b: Books; o: Order }): JSX.Element {
  const { b, o } = p, d = member(b, o.holderId), who = shortName(b, o), usual = 35;
  const arrive = clock(o.stageAt + usual * 60000), phone = d && d.id === 'staff:ssali' ? '0772 000 202' : '';
  return (
    <div class="or-map">
      <div role="img" aria-label={`${d ? firstWord(d.name) : 'The driver'} left at ${clock(o.stageAt)}; arrives about ${arrive}`} class="or-map-pic">
        <svg width="328" height="124" viewBox="0 0 328 124" aria-hidden="true">
          <path d="M0 96 C80 92 120 70 170 66 S260 40 328 34" fill="none" stroke="#FFFFFF" stroke-width="12" stroke-linecap="round" />
          <path d="M120 0 L150 124" fill="none" stroke="#FFFFFF" stroke-width="8" />
          <path d="M230 124 L250 0" fill="none" stroke="#FFFFFF" stroke-width="6" />
          <rect x="20" y="16" width="44" height="24" rx="5" fill="#E1E4DC" /><rect x="270" y="76" width="40" height="28" rx="5" fill="#E1E4DC" /><rect x="176" y="86" width="34" height="22" rx="5" fill="#E1E4DC" />
          <path d="M44 96 C90 92 120 72 170 66" fill="none" stroke="#0F6B43" stroke-width="4" stroke-linecap="round" />
          <path d="M170 66 C210 60 250 44 296 36" fill="none" stroke="#0F6B43" stroke-width="3" stroke-linecap="round" stroke-dasharray="1 7" />
        </svg>
        <span class="or-map-eta">Arrives <b class="mono">{`~${arrive}`}</b></span>
        <span aria-hidden="true" class="or-map-shop"><Icon name="store" size={16} stroke={2} /></span>
        <span aria-hidden="true" class="or-map-truck"><Icon name="truck" size={16} stroke={2} /></span>
        <span aria-hidden="true" class="or-map-pin"><Icon name="pin" size={24} stroke={2.2} /></span>
        <span class="mono or-map-l">{`left ${clock(o.stageAt)}`}</span>
        <span class="or-map-r">{`usually ${usual} min`}</span>
      </div>
      <div class="or-map-row">
        <span aria-hidden="true" class="or-map-ic"><Icon name="pin" size={18} stroke={2} /></span>
        <span class="or-map-t"><span>{(o.deliverTo || '').split(',')[0]}</span><span>{`${who}'s site manager receives it`}</span></span>
      </div>
      {d && (
        <div class="or-map-row">
          <Avatar initials={d.initials} tint={d.tint} size={40} />
          <span class="or-map-t"><span>{`${firstWord(d.name)} · driving`}</span><span>{`has ${who}'s number`}</span></span>
          {phone && <a href={'tel:+256' + phone.replace(/\s/g, '').slice(1)} class="or-map-call"><Icon name="phone" size={16} stroke={2} />{`Call ${firstWord(d.name)}`}</a>}
        </div>
      )}
    </div>
  );
}

/** OR12 · under a line Ruth decides: where the price sits since the cost went up, and what her answer leads to. */
export function LadderUnder(p: { b: Books; o: Order; l: Line }): JSX.Element {
  const { b, o, l } = p, ruth = byRole(b, 'manager'), rn = firstWord(ruth?.name || 'Manager');
  const price = l.price || 0, cost = l.cost || 0, shop = l.shopPrice || price;
  const pct = shop > cost ? 40 + ((price - cost) / (shop - cost)) * 32 : 56;
  const up = (l.cost || 0) > price * 0.9;
  return (
    <>
      <div role="img" aria-label={`The cost went up. They pay ${price.toLocaleString('en-US')}, under the shop's new price of ${shop.toLocaleString('en-US')}`} class="or-lad">
        <div class="or-lad-t">
          <span class="mono or-lad-b" style={{ left: `calc(${pct}% - 30px)` }}>{price.toLocaleString('en-US')}</span>
          <span class="or-lad-band" />
          <span class="or-lad-cost" />
          <span class="or-lad-shop" />
          <span class="or-lad-k" style={{ left: `calc(${pct}% - 10px)` }} />
        </div>
        <div class="or-lad-l"><span>{up ? 'cost went up' : 'cost'}</span><span class="mono">{`shop ${shop.toLocaleString('en-US')}`}</span></div>
      </div>
      <span role="group" aria-label={`What ${rn}'s answer leads to`} class="or-if">
        <span class="or-if-h">{ruth && <Avatar {...faceOfMember(ruth)} size={18} />}{`If ${rn}`}</span>
        <span class="or-if-r good"><span aria-hidden="true" />{`keeps ${price.toLocaleString('en-US')} · on to Buying`}</span>
        <span class="or-if-r info"><span aria-hidden="true" />{`sets a new price · you tell ${shortName(b, o)}`}</span>
      </span>
    </>
  );
}

/** OR13 · Ruth set a new price: the message as they will read it, sent from here, or marked told. */
export function PriceTell(p: { b: Books; o: Order; l: Line }): JSX.Element {
  const { b, o, l } = p, rv = l.priceReview as NonNullable<Line['priceReview']>, who = shortName(b, o);
  const [busy, setBusy] = useState<'' | 'told' | 'send'>('');
  const word = shortItem(l.name).toLowerCase();
  const total = orderTotal(o);
  const text = `Hello ${who}, ${word} is now ${sayMoney(rv.price)} a ${l.unit}, not ${sayMoney(rv.was || 0)}. Order #${String(o.id).padStart(4, '0')} is now ${sayMoney(total)}.`;
  const chat = chatFor(b, o, chats.value), win = chat ? replyWindow(chat.lastInAt, now.value) : null, shut = !win || !win.open;
  const p9 = phone9(custOf(b, o)?.phone || o.client.phone), sms = `sms:${p9 ? '+256' + p9 : ''}?body=${encodeURIComponent(text)}`;
  const told = async () => {
    setBusy('told');
    try { const r = await act('markPriceTold', o.id); toast.show(r.kept ? 'Kept on this phone' : `${who} told`, { kind: r.kept ? 'warn' : 'ok' }); } catch (e) { toast.show((e as Error).message, { kind: 'error' }); } finally { setBusy(''); }
  };
  const send = async () => {
    if (!chat) { toast.show(`${who} has no chat yet`, { kind: 'warn' }); return; }
    setBusy('send');
    try {
      const r = await act('send', chat.id, text);
      await act('markPriceTold', o.id);
      toast.show(r.kept ? 'Kept on this phone' : `Sent to ${who}`, { kind: r.kept ? 'warn' : 'ok' });
    } catch (e) { toast.show((e as Error).message, { kind: 'error' }); } finally { setBusy(''); }
  };
  return (
    <div class="or-ptell">
      <div class="or-ptell-m"><span><MonoText text={text} /></span></div>
      <div class="or-ptell-b">
        <button type="button" class="or-btn-w" onClick={told} disabled={!!busy}><Icon name="check" size={18} stroke={2.6} />{busy === 'told' ? 'Sending…' : 'Told them'}</button>
        {shut
          ? (
            <a href={sms} class="or-btn-n or-ptell-sms" aria-label={`Send as SMS: the chat is shut${win ? `, ${win.daysShut} days` : ''}`} onClick={() => { void act('markPriceTold', o.id); }}>
              <span><Icon name="message" size={18} stroke={2} />Send as SMS</span>
              {win && <span><Icon name="lock" size={11} stroke={2.4} />{'chat shut · '}<span class="mono">{`${win.daysShut} days`}</span></span>}
            </a>
          )
          : <button type="button" class="or-btn-g" onClick={send} disabled={!!busy}><Duo i={phWhatsapp} size={20} />{busy === 'send' ? 'Sending…' : 'Send on WhatsApp'}</button>}
      </div>
    </div>
  );
}

/** OR22 · a return asked: waiting, Undo, and its two steps (you asked · Ruth checks it, then the credit note). */
export function AskTimeline(p: { b: Books; o: Order; ask: BillAsk }): JSX.Element {
  const { b, o, ask } = p, ruth = byRole(b, 'manager'), rn = firstWord(ruth?.name || 'Manager');
  const [busy, setBusy] = useState(false);
  const back = backLines(o, ask);
  const what = back.length ? back.map(({ line, n }) => `${n} ${line.unit}${n > 1 ? 's' : ''}`).join(' + ') : ask.amount.toLocaleString('en-US');
  const undo = async () => {
    setBusy(true);
    try { await act('withdrawBillAsk', ask.id); } catch (e) { toast.show((e as Error).message, { kind: 'error' }); } finally { setBusy(false); }
  };
  return (
    <div class="or-asks">
      <div class="or-asks-h"><span>Return asked<span class="or-wait">Waiting</span></span>
        <button type="button" class="or-undo" onClick={undo} disabled={busy}><span><Icon name="undo" size={14} stroke={2.4} />{busy ? 'Sending…' : 'Undo ask'}</span></button></div>
      <AskStep mark="ok" title="You asked" sub={`${what} · ${ask.reason.toLowerCase()} · ${when(ask.at, now.value)}`} line />
      <AskStep mark={ruth ? faceOfMember(ruth) : 'to'} title={`${rn} checks it`} sub={`then the credit note, ${ask.amount.toLocaleString('en-US')}`} tone="warn" />
    </div>
  );
}

/** OR27 · the payment that brought more than the bill: OR15's split bar, what went to it and what is over. */
export function OverRow(p: { b: Books; p: Payment }): JSX.Element {
  const { cleared, over } = paidOver(p.b, p.p), t = now.value, at = p.p.at;
  const m = ({ cash: ['Cash', 'cash'], momo: ['Mobile', 'mobile'], bank: ['Bank', 'bank'] } as const)[p.p.method];
  const said = `${m[0]} · ${dayOf(at) === dayOf(t) ? `today ${clock(at)}` : when(at, t)}`, f = (n: number) => n.toLocaleString('en-US');
  return (
    <div role="group" aria-label={`${said}, ${f(p.p.amount)}: ${f(cleared)} to the bill, ${f(over)} over`} class="or-ovr">
      <div class="or-prow">
        <span aria-hidden="true" class="w"><Icon name={m[1]} size={18} stroke={2} /></span>
        <span><span>{said}</span><span>one payment, two parts</span></span>
        <span class="mono">{f(p.p.amount)}</span>
      </div>
      <span aria-hidden="true" class="or-over-bar"><span style={{ flex: cleared }} /><span style={{ flex: over }} /></span>
      <div class="or-ovr-k">
        <span><span><i aria-hidden="true" />To the bill</span><span class="mono">{f(cleared)}</span></span>
        <span><span><i aria-hidden="true" />Over</span><span class="mono">{f(over)}</span></span>
      </div>
    </div>
  );
}

/** OR29 · entered twice, after the void: the one kept, the copy voided. */
export function TwinCard(p: { b: Books; o: Order }): JSX.Element | null {
  const tw = twinOf(p.b.orders, p.o, true);
  if (!tw) return null;
  const row = (x: Order, copy: boolean) => (
    <div class={'or-twr' + (copy ? ' copy' : '')}>
      <span><b class="mono">{orderNo(x.id)}</b><span>{`Invoice · ${x.invoicedAt ? `${weekday(x.invoicedAt)} ${clock(x.invoicedAt)}` : ''}${copy ? ' · the copy' : ''}`}</span></span>
      {x.voided ? <s class="mono">{orderTotal(x).toLocaleString('en-US')}</s> : <span class="mono">{orderTotal(x).toLocaleString('en-US')}</span>}
      {x.voided ? <OrderPill tone="bad">Void</OrderPill> : x.paid >= orderTotal(x) ? <OrderPill tone="good" tick>Paid</OrderPill> : <OrderPill tone="warn">Owes</OrderPill>}
    </div>
  );
  return (
    <div role="group" aria-label={`Entered twice: ${orderNo(tw.orig.id)} kept, ${orderNo(tw.copy.id)} ${tw.copy.voided ? 'void' : 'the copy'}`} class="or-twc">
      <div class="or-twc-h">Entered twice</div>
      {row(tw.orig, false)}{row(tw.copy, true)}
    </div>
  );
}

/** The words, numbers and order numbers in mono, as the bubble draws them. */
export function MonoText(p: { text: string }): JSX.Element {
  return <>{p.text.split(/(#\d{4}|\d[\d,]*\d|\d)/).map((x, i) => (i % 2 ? <span key={i} class="mono or-m5">{x}</span> : x))}</>;
}
