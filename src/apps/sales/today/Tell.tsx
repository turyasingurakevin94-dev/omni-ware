/*
 * TD04 · Tell them: one sheet per order whose price Ruth changed. The line (old price struck), what
 * they were told against what they pay now, who decided and when, the message as they will get it,
 * the next tell queued, then Send (WhatsApp, the shop's line) or "They know already".
 * An item that came in (a listed ask) is told from its own screen (TD22, today/asks).
 */
import type { ComponentChildren, JSX } from 'preact';
import { money, orderTotal } from '../../../core/money.ts';
import { firstWord, orderNo } from '../../../core/names.ts';
import { clock, replyWindow } from '../../../core/time.ts';
import type { Books, ChatBooks, Order } from '../../../core/types.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Button } from '../../../ui/Button.tsx';
import { ItemSquare } from '../../../ui/ItemSquare.tsx';
import { Icon, phWhatsapp } from '../../../ui/icons.tsx';
import { sheet } from '../../../ui/sheet.tsx';
import { toast } from '../../../ui/toast.tsx';
import { Tap } from '../../../ui/util.tsx';
import { nav } from '../shell/nav.ts';
import { act, books, chats, now } from '../shell/store.ts';
import { askTells, priceTells } from './data.ts';
import { markTold, useLocal } from './local.ts';
import './tell.css';

/** "Hello Kato, the iron sheets went up to 38,000 each. Your order #0552 is now 1,810,000. Shall we go on?" */
export function priceMessage(b: Books, o: Order): string {
  const c = b.customers.find((x) => x.id === o.customerId), l = o.lines.find((x) => x.priceReview && x.priceReview.state === 'changed');
  if (!l || !l.priceReview) return '';
  const what = l.name.split(/ G\d| ·|,/)[0].toLowerCase() + 's', up = (l.priceReview.was || 0) < l.priceReview.price;
  return `Hello ${firstWord(c ? c.name : o.client.name)}, the ${what} went ${up ? 'up' : 'down'} to ${money(l.priceReview.price)} each. Your order ${orderNo(o.id)} is now ${money(orderTotal(o))}. Shall we go on?`;
}

/** What they get: the chat ground, a chip, our bubble with Grace's name and "now". */
export function Preview(p: { chip: string; who: string; wide?: boolean; children: ComponentChildren }): JSX.Element {
  return (
    <div class={'td-preview' + (p.wide ? ' wide' : '')}>
      <span class="td-preview-chip">{p.chip}</span>
      <div class="td-preview-b"><span>{p.who}</span>{p.children}{!p.wide && <span class="mono">now</span>}</div>
    </div>
  );
}

/**
 * What a send did: nothing (no chat with them), the words only, the words under the photo, or kept on this
 * phone with no signal (it sends itself).
 */
export type Sent = 'no-chat' | 'text' | 'photo' | 'kept';

/**
 * Send on WhatsApp through the shop's line; after the 24 hours, as the reply template (which carries words
 * only, so a photo goes only inside the 24 hours). A photo is a link in the shop's bucket, sent with the words under it.
 */
export async function sendTo(cb: ChatBooks | null, customerId: string | null, text: string, nowMs: number, photo: string | null = null): Promise<Sent> {
  const c = cb && customerId ? cb.chats.find((x) => x.customerId === customerId) : null;
  if (!c) return 'no-chat';
  const open = replyWindow(c.lastInAt, nowMs).open;
  const r = open && photo ? await act('sendImage', c.id, photo, text) : await act(open ? 'send' : 'sendTemplate', c.id, text);
  return r.kept ? 'kept' : open && photo ? 'photo' : 'text';
}

/** Says what a send did, once; false when nothing went (no chat with them: nothing is marked told). */
export function sentToast(sent: Sent, who: string, photo: boolean): boolean {
  if (sent === 'no-chat') { toast.show(`No chat with ${who}`, { kind: 'error', sub: 'Nothing was sent' }); return false; }
  if (sent === 'kept') toast.show('No signal · kept on this phone', { sub: 'It sends itself' });
  else if (photo && sent === 'text') toast.show(`Sent to ${who}`, { sub: 'Words only: their 24 hours are over, a photo cannot go' });
  else toast.show(`Sent to ${who}`);
  return true;
}

/** Open the i-th tell: a price in this sheet; an item that came in on its own screen. */
export function openTell(i: number): void {
  const b = books.value;
  if (!b) return;
  const told = useLocal().told, prices = priceTells(b).filter((o) => !told.includes('price:' + o.id)), asks = askTells(b, told);
  if (i < prices.length) sheet.open(() => <TellSheet i={i} />, { label: 'Tell them', top: 118 });
  else if (asks[i - prices.length]) { sheet.close(); nav.push('today/asks', { id: asks[i - prices.length].id }); }
  else sheet.close();
}

function TellSheet(p: { i: number }): JSX.Element {
  const b = books.value as Books, L = useLocal();
  const prices = priceTells(b).filter((o) => !L.told.includes('price:' + o.id)), asks = askTells(b, L.told), all = prices.length + asks.length;
  const o = prices[p.i];
  if (!o) return <div class="td-sheet" />;
  const c = b.customers.find((x) => x.id === o.customerId), who = firstWord(c ? c.name : o.client.name);
  const l = o.lines.find((x) => x.priceReview && x.priceReview.state === 'changed'), r = l && l.priceReview;
  const by = r ? b.members.find((m) => m.id === r.by) : null, it = l ? b.items.find((x) => x.id === l.itemId) : null;
  const next = prices[p.i + 1] || null, nextAsk = next ? null : asks[0] || null;
  const nextCust = next ? b.customers.find((x) => x.id === next.customerId) : nextAsk ? b.customers.find((x) => x.id === nextAsk.requests[0].customerId) : null;
  const goNext = () => openTell(next ? p.i + 1 : prices.length);
  const done = () => {
    markTold('price:' + o.id);
    void act('markPriceTold', o.id).catch(() => { /* kept on this phone; it goes when there is signal */ });
    if (next || nextAsk) openTell(next ? p.i : prices.length - 1); else sheet.close();
  };
  const send = async () => {
    try {
      if (sentToast(await sendTo(chats.value, o.customerId, priceMessage(b, o), now.value), who, false)) done();
    } catch (e) { toast.show('Not sent', { kind: 'error', sub: (e as Error).message, retry: () => { void send(); } }); }
  };
  return (
    <div class="td-sheet">
      <span aria-hidden="true" class="td-sheet-grab" />
      <div class="td-sheet-h">
        <span class="td-sheet-ht"><span>{`Order ${orderNo(o.id)} · ${p.i + 1} of ${all}`}</span><h2>{`Tell ${who}`}</h2></span>
        <span class="td-sheet-hr">
          <span aria-hidden="true" class="td-dots">{Array.from({ length: all }, (_x, k) => <span key={k} class={k === p.i ? 'on' : undefined} />)}</span>
          <button type="button" class="ow-x-tile" aria-label="Close" onClick={() => sheet.close()}><Icon name="close" size={16} stroke={2.2} /></button>
        </span>
      </div>
      <div class="td-sheet-b">
        {l && r && (
          <div class="td-tell-line">
            <ItemSquare aisle={it ? it.aisle : ''} size={40} />
            <span class="td-tell-lt"><span>{l.name}</span>
              <span class="mono">{`${l.qty} `}<span class="ow-word">{l.unit}</span>{' × '}<s>{money(r.was || 0)}</s>{' → '}<b>{money(r.price)}</b></span></span>
            {by && <span class="td-tell-by"><Avatar initials={by.initials} tint={by.tint} size={24} />{firstWord(by.name)}</span>}
          </div>
        )}
        <div class="td-tell-tiles">
          <div class="td-tell-was"><span>They were told</span><s class="mono">{money(o.toldTotal || 0)}</s></div>
          <div class="td-tell-now"><span>{`${who} pays now`}</span><span class="mono">{money(orderTotal(o))}</span></div>
        </div>
        {by && r && (
          <div class="td-tell-who">
            <Avatar initials={by.initials} tint={by.tint} size={28} font={11} />
            <span><b>{firstWord(by.name)}</b>{r.price === (l && l.shopPrice) ? " kept the shop's price" : ` set ${money(r.price)}`}</span>
            <span class="mono">{clock(r.at)}</span>
          </div>
        )}
        <Preview chip={`What ${who} gets`} who={firstWord(b.me.name)}>{priceMessage(b, o)}</Preview>
        {nextCust && (
          <Tap on={goNext} class="td-tell-next">
            <span>Next</span>
            <Avatar initials={nextCust.initials} tint={nextCust.tint} size={28} font={11} />
            <span>{next ? `${firstWord(nextCust.name)} · a new price` : `${firstWord(nextCust.name)} · ${(nextAsk ? nextAsk.name : '').split(' · ')[0].toLowerCase()} is in`}</span>
            <span aria-hidden="true" class="ow-chev"><Icon name="chevron-right" size={16} stroke={2.2} /></span>
          </Tap>
        )}
        <div class="td-tell-acts">
          <Button kind="green" duo={phWhatsapp} onClick={() => { void send(); }}>{`Send to ${who}`}</Button>
          <Button kind="ghost" h={52} class="td-btn-in" onClick={done}><Icon name="check" size={16} stroke={2.6} />They know already</Button>
        </div>
      </div>
    </div>
  );
}
