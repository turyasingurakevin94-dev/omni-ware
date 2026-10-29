/*
 * The pictures inside one order: the door photo (OR09), the road map with the driver (OR08),
 * the price ladder of a line Ruth decides (OR12), the new price to tell (OR13), and where a
 * return ask is (OR22).
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { firstWord, phoneText } from '../../../core/names.ts';
import { lineTotal, orderTotal } from '../../../core/money.ts';
import { clock, when } from '../../../core/time.ts';
import type { BillAsk, Books, Line, Order } from '../../../core/types.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Duo, Icon, phWhatsapp } from '../../../ui/icons.tsx';
import { toast } from '../../../ui/toast.tsx';
import { act, chats, now } from '../shell/store.ts';
import { byRole, faceOfMember, member, shortItem, shortName } from './data.ts';
import { chatFor, sayMoney } from './msg.tsx';

/** OR09 · at the door: the photo square, where, who delivered, when. */
export function DoorCard(p: { place: string; by?: string; at: string }): JSX.Element {
  return (
    <div class="or-door">
      <button type="button" class="or-door-ph" aria-label="See the photo at the door" onClick={() => toast.show('The photo comes with the driver’s app', { kind: 'warn' })}><Icon name="camera" size={22} />photo</button>
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
        <span aria-hidden="true" class="or-map-shop"><Icon name="store" size={16} /></span>
        <span aria-hidden="true" class="or-map-truck"><Icon name="truck" size={16} /></span>
        <span aria-hidden="true" class="or-map-pin"><Icon name="pin" size={24} /></span>
        <span class="mono or-map-l">{`left ${clock(o.stageAt)}`}</span>
        <span class="or-map-r">{`usually ${usual} min`}</span>
      </div>
      <div class="or-map-row">
        <span aria-hidden="true" class="or-map-ic"><Icon name="pin" size={18} /></span>
        <span class="or-map-t"><span>{(o.deliverTo || '').split(',')[0]}</span><span>{`${who}'s site manager receives it`}</span></span>
      </div>
      {d && (
        <div class="or-map-row">
          <Avatar initials={d.initials} tint={d.tint} size={40} />
          <span class="or-map-t"><span>{`${firstWord(d.name)} · driving`}</span><span>{`has ${who}'s number`}</span></span>
          {phone && <a href={'tel:+256' + phone.replace(/\s/g, '').slice(1)} class="or-map-call"><Icon name="phone" size={16} />{`Call ${firstWord(d.name)}`}</a>}
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
  const chat = chatFor(b, o, chats.value);
  const told = async () => {
    setBusy('told');
    try { await act('markPriceTold', o.id); toast.show(`${who} told`, { kind: 'ok' }); } catch (e) { toast.show((e as Error).message, { kind: 'error' }); } finally { setBusy(''); }
  };
  const send = async () => {
    if (!chat) { toast.show(`${who} has no chat yet`, { kind: 'warn' }); return; }
    setBusy('send');
    try { await act('send', chat.id, plain(text)); await act('markPriceTold', o.id); toast.show(`Sent to ${who}`, { kind: 'ok' }); } catch (e) { toast.show((e as Error).message, { kind: 'error' }); } finally { setBusy(''); }
  };
  return (
    <div class="or-ptell">
      <div class="or-ptell-m"><span>{text.split(/(\d[\d,]*|#\d{4})/).map((x, i) => (i % 2 ? <span key={i} class="mono">{x}</span> : x))}</span></div>
      <div class="or-ptell-b">
        <button type="button" class="or-btn-w" onClick={told} disabled={!!busy}><Icon name="check" size={18} />{busy === 'told' ? 'Sending…' : 'Told them'}</button>
        <button type="button" class="or-btn-g" onClick={send} disabled={!!busy}><Duo i={phWhatsapp} size={20} />{busy === 'send' ? 'Sending…' : 'Send on WhatsApp'}</button>
      </div>
      {lineTotal(l) < 0 && null}
    </div>
  );
}
const plain = (s: string) => s;

/** OR22 · a return asked: waiting, Undo, and its two steps (you asked · Ruth checks it, then the credit note). */
export function AskTimeline(p: { b: Books; o: Order; ask: BillAsk }): JSX.Element {
  const { b, o, ask } = p, ruth = byRole(b, 'manager'), rn = firstWord(ruth?.name || 'Manager');
  const [busy, setBusy] = useState(false);
  const line = o.lines.find((l) => l.price && ask.amount % l.price === 0 && ask.amount / l.price <= l.qty);
  const n = line && line.price ? ask.amount / line.price : 0;
  const what = line ? `${n} ${line.unit}${n > 1 ? 's' : ''}` : ask.amount.toLocaleString('en-US');
  const undo = async () => {
    setBusy(true);
    try { await act('withdrawBillAsk', ask.id); toast.show('Ask taken back', { kind: 'ok' }); } catch (e) { toast.show((e as Error).message, { kind: 'error' }); } finally { setBusy(false); }
  };
  return (
    <div class="or-asks">
      <div class="or-asks-h"><span>Return asked<span class="or-wait">Waiting</span></span>
        <button type="button" class="or-undo" onClick={undo} disabled={busy}><span><Icon name="undo" size={14} />{busy ? 'Sending…' : 'Undo ask'}</span></button></div>
      <div class="or-step"><span aria-hidden="true" class="or-step-ok"><Icon name="check" size={13} stroke={3.2} /></span><span aria-hidden="true" class="or-step-line" />
        <span class="or-step-t"><span>You asked</span><span>{`${what} · ${ask.reason.toLowerCase()} · ${when(ask.at, now.value)}`}</span></span></div>
      <div class="or-step"><span aria-hidden="true" class="or-step-face">{ruth && <Avatar {...faceOfMember(ruth)} size={28} style={{ boxShadow: '0 0 0 2px #F5B26B' }} />}</span>
        <span class="or-step-t warn"><span>{`${rn} checks it`}</span><span>{`then the credit note, ${ask.amount.toLocaleString('en-US')}`}</span></span></div>
    </div>
  );
}

export { phoneText };
