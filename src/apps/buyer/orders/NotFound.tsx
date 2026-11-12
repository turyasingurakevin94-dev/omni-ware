/*
 * The Not found sheet (docs/canvas/buyer/Orders.dc.html phone 3): a line the
 * supplier does not have, and its three ways out, each naming what the
 * salesperson gets back:
 *
 *   other supplier   the next best supplier on the price list, 1 tap Switch → act('otherSupplier')    Grace sees: Switched
 *                    (or "Other item ›": another item in its place, the 'orders/switch' screen)
 *   Client waits     Sourcing (Moses) finds it, billed when it comes in → act('clientWaits')          Grace sees: Client waits
 *   Remove           a slide in the navy dock → act('removeLine', …, reason)                           Grace sees: Removed
 *
 *   openNotFound(553, 'L0')     the Replies "No" path opens it too
 *
 * BUY-13 (board R1CostPrice): what the salesperson will see shows only once a choice is picked (the navy
 * "{Seller} sees: Switched · Sending" over the slide), never before.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { firstWord, orderNo } from '../../../core/names.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Button } from '../../../ui/Button.tsx';
import { Slide } from '../../../ui/Slide.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { fig } from '../../../ui/Money.tsx';
import { sheet } from '../../../ui/sheet.tsx';
import { toast } from '../../../ui/toast.tsx';
import { askMessage } from '../../../core/buyer/rules.ts';
import { askSupplier, openWhatsApp, shopName } from '../shell/ask.ts';
import { barW } from '../../../ui/util.tsx';
import { nav } from '../shell/nav.ts';
import { act, books, now } from '../shell/store.ts';
import { FromChip, KEPT, KEPT_TOAST, RowAct, Sees, StateWord } from './parts.tsx';
import { byRole, nextSupplier, orderView, overSell, priceComing } from './rules.ts';
import '../../../ui/dock.css';
import './sheets.css';

/** The reason Sales is told when a line comes off for want of a supplier (buyer.html W8). */
export const REMOVE_REASON = 'Nobody has it';

type Busy = 'other' | 'wait' | 'remove' | null;

/** What happened, as a toast: kept on the phone (no signal) or done. */
function told(r: { kept: boolean }, done: string, undo?: () => void): void {
  if (r.kept) toast.show(KEPT, KEPT_TOAST);
  else toast.show(done, undo ? { undo } : {});
}

function NotFoundSheet(p: { orderId: number; lineKey: string }): JSX.Element {
  const [busy, setBusy] = useState<Busy>(null);
  const b = books.value;
  const o = b ? b.orders.find((x) => x.id === p.orderId) : null;
  const v = b && o ? orderView(o, b, now.value) : null;
  const x = v ? v.lines.find((y) => y.line.key === p.lineKey) : null;
  if (!b || !o || !v || !x) {
    return <div class="ow-b-orders-nfs"><span class="ow-grab" aria-hidden="true" /><span class="ow-b-orders-gone">This line is not here any more</span></div>;
  }
  const l = x.line, seller = v.seller ? firstWord(v.seller.name) : 'Sales';
  // X-2: a line nobody sells yet is picked here (the same sheet): the cheapest on the list is asked, or Sourcing looks.
  const pick = x.state === 'nosupplier';
  const alt = nextSupplier(b, l, now.value);
  const moses = byRole(b, 'sourcing');
  const finder = moses ? firstWord(moses.name) : 'Sourcing';
  const only = v.live.length <= 1;
  const coming = priceComing(l);
  // The word Sales gets, once a choice is picked (BUY-13).
  const chosen = busy === 'other' ? (pick ? 'Asked' : 'Switched') : busy === 'wait' ? 'Client waits' : busy === 'remove' ? 'Removed' : null;

  const fail = (what: string, again: () => void) => (e: unknown) => {
    toast.show('Not saved', { kind: 'error', sub: what, retry: again });
    void e;
  };
  const other = async () => {
    if (!alt) return;
    const was = { sid: l.supplierId, cost: l.cost }, to = alt.supplier;
    // The one Ask's rule (shell/ask.ts): WhatsApp opens inside the tap, before the writes; no WhatsApp: the call sheet after.
    if (to.whatsapp) openWhatsApp(to.phone, askMessage(to, [l], shopName()));
    setBusy('other');
    try {
      const r1 = await act('otherSupplier', o.id, l.key, to.id, alt.price.price);
      if (!to.whatsapp && !r1.kept) { sheet.close(); await askSupplier(books.value || b, to.id); return; }
      const r = r1.kept ? r1 : await act('ask', to.id, 'whatsapp');
      sheet.close();
      told(r, `Asked ${alt.supplier.name}`, was.sid ? () => { void act('otherSupplier', o.id, l.key, was.sid, was.cost); } : undefined);
    } catch (e) { fail(`Switch to ${firstWord(alt.supplier.name)} · ${fig(alt.price.price)}`, () => { void other(); })(e); } finally { setBusy(null); }
  };
  const wait = async () => {
    setBusy('wait');
    try {
      const r = await act('clientWaits', o.id, l.key);
      sheet.close();
      told(r, `Client waits · ${finder} is told`);
    } catch (e) { fail('Client waits', () => { void wait(); })(e); } finally { setBusy(null); }
  };
  const remove = async () => {
    setBusy('remove');
    try {
      const r = await act('removeLine', o.id, l.key, REMOVE_REASON);
      sheet.close();
      told(r, `Removed · ${l.name}`);
    } catch (e) { fail(`Remove ${l.name}`, () => { void remove(); })(e); } finally { setBusy(null); }
  };
  const otherItem = () => { sheet.close(); nav.push('orders/switch', { id: o.id, key: l.key }); };

  return (
    <div class="ow-b-orders-nfs">
      <span class="ow-grab" aria-hidden="true" />
      <div class="b">
        <div class="h">
          <span aria-hidden="true" class="x"><Icon name="close" size={22} stroke={2.2} /></span>
          <span class="t">
            <span class="n">{l.name}</span>
            <span class="mono q">{`${l.qty} ${l.unit} × ${fig(l.cost)}${x.supplier ? ` · ${x.supplier.name}` : ''}`}</span>
          </span>
          <StateWord state={x.state} at={x.at} h={30} />
        </div>
        <div><FromChip who={v.seller} no={o.id} /></div>

        {alt ? (
          <div class="ow-b-orders-way best">
            <div class="r">
              <span aria-hidden="true" class="tile"><Icon name="store" size={20} stroke={2} /></span>
              <span class="t">
                <span class="n">{alt.supplier.name}</span>
                <span class="p"><span class="mono">{fig(alt.price.price)}</span><span class="age">{alt.days === 0 ? "on the list · today" : `on the list · ${alt.days} ${alt.days === 1 ? "day" : "days"}`}</span></span>
              </span>
              <RowAct icon={pick ? 'send' : 'swap'} word={pick ? 'Ask' : 'Switch'} busyWord={pick ? 'Asking' : 'Switching'} busy={busy === 'other'} label={`${pick ? 'Ask' : 'Switch to'} ${alt.supplier.name} at ${fig(alt.price.price)}`} on={() => { void other(); }} />
            </div>
            <div class="pic" role="img" aria-label={coming ? `Cost ${fig(alt.price.price)}, price coming` : `Cost ${fig(alt.price.price)}, the client pays ${fig(l.sell)}`}>
              <div class="bar"><span style={{ width: barW(coming ? 100 : (alt.price.price / Math.max(1, l.sell)) * 100), background: overSell(l, alt.price.price) ? '#8E2A22' : '#0F6B43' }} /></div>
              <div class="k"><span>cost <span class="mono">{fig(alt.price.price)}</span></span>{coming ? <span>Price coming</span> : <span>client pays <span class="mono">{fig(l.sell)}</span></span>}</div>
            </div>
            <div class="f">
              <button type="button" class="more" onClick={otherItem}>Other item<Icon name="chevron-right" size={16} stroke={2.2} /></button>
            </div>
          </div>
        ) : (
          <div class="ow-b-orders-noalt">
            <span aria-hidden="true" class="tile"><Icon name="search" size={18} stroke={2} /></span>
            <span class="t"><b>{pick ? 'Nobody on the price list sells it' : 'No other supplier on the list'}</b><span>{`${finder} can find one while ${seller}'s client waits`}</span></span>
          </div>
        )}

        {alt ? (
          <div class="ow-b-orders-way">
            <div class="r">
              {moses ? <Avatar initials={moses.initials} tint={moses.tint} size={40} /> : <span aria-hidden="true" class="tile"><Icon name="search" size={20} stroke={2} /></span>}
              <span class="t">
                <span class="n">{`${finder} finds it`}</span>
                <span class="s">billed when it comes in</span>
              </span>
              <RowAct kind="line" icon="hourglass" word="Client waits" busyWord="Sending" busy={busy === 'wait'} on={() => { void wait(); }} />
            </div>
          </div>
        ) : (
          <>
            <Button icon="hourglass" state={busy === 'wait' ? 'sending' : 'idle'} onClick={() => { void wait(); }}>{`Client waits · ${finder} finds it`}</Button>
          </>
        )}
      </div>
      <div class="ow-dock inline ow-b-orders-nfdock" style={{ marginTop: 'auto' }}>
        {chosen && (
          <div class="ow-b-orders-nfchosen" role="status">
            <Sees who={seller} navy>{chosen}</Sees>
            <span class="s"><span aria-hidden="true" class="ow-b-orders-spin" />Sending</span>
          </div>
        )}
        <Slide label="Slide to remove" onCommit={remove} state={busy === 'remove' ? 'sending' : undefined}
          onHint={() => toast.show('Slide the red button across', { kind: 'warn' })}
          lock={only ? { icon: 'lock', label: 'Only line · use Client waits' } : undefined} />
      </div>
    </div>
  );
}

/** Open the Not found sheet for one line of an order (Orders and the Replies "No" path). */
export function openNotFound(orderId: number, key: string): void {
  sheet.open(() => <NotFoundSheet orderId={orderId} lineKey={key} />, { label: `Not found · ${orderNo(orderId)}`, top: 84 });
}
