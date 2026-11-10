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
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { firstWord, orderNo } from '../../../core/names.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Dock } from '../../../ui/Dock.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { fig } from '../../../ui/Money.tsx';
import { sheet } from '../../../ui/sheet.tsx';
import { toast } from '../../../ui/toast.tsx';
import { barW } from '../../../ui/util.tsx';
import { nav } from '../shell/nav.ts';
import { act, books, now } from '../shell/store.ts';
import { FromChip, RowAct, Sees, StateWord } from './parts.tsx';
import { byRole, nextSupplier, orderView } from './rules.ts';
import './sheets.css';

/** The reason Sales is told when a line comes off for want of a supplier (buyer.html W8). */
export const REMOVE_REASON = 'Nobody has it';

type Busy = 'other' | 'wait' | null;

/** What happened, as a toast: kept on the phone (no signal) or done. */
function told(r: { kept: boolean }, done: string, undo?: () => void): void {
  if (r.kept) toast.show('Kept · it sends when back', { kind: 'warn' });
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
  const alt = nextSupplier(b, l, now.value);
  const moses = byRole(b, 'sourcing');
  const only = v.live.length <= 1;
  const left = v.total - (x.state === 'removed' ? 0 : x.total);

  const fail = (what: string, again: () => void) => (e: unknown) => {
    toast.show('Not saved', { kind: 'error', sub: what, retry: again });
    void e;
  };
  const other = async () => {
    if (!alt) return;
    const was = { sid: l.supplierId, cost: l.cost };
    setBusy('other');
    try {
      const r = await act('otherSupplier', o.id, l.key, alt.supplier.id, alt.price.price);
      sheet.close();
      told(r, `Switched · ${alt.supplier.name}`, was.sid ? () => { void act('otherSupplier', o.id, l.key, was.sid, was.cost); } : undefined);
    } catch (e) { fail(`Switch to ${firstWord(alt.supplier.name)} · ${fig(alt.price.price)}`, () => { void other(); })(e); } finally { setBusy(null); }
  };
  const wait = async () => {
    setBusy('wait');
    try {
      const r = await act('clientWaits', o.id, l.key);
      sheet.close();
      told(r, `Client waits · ${moses ? firstWord(moses.name) : 'Sourcing'} is told`);
    } catch (e) { fail('Client waits', () => { void wait(); })(e); } finally { setBusy(null); }
  };
  const remove = async () => {
    try {
      const r = await act('removeLine', o.id, l.key, REMOVE_REASON);
      sheet.close();
      told(r, `Removed · ${l.name}`);
    } catch (e) { fail(`Remove ${l.name}`, () => { void remove(); })(e); }
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

        <div class="ow-b-orders-way best">
          <div class="r">
            <span aria-hidden="true" class="tile"><Icon name="store" size={20} stroke={2} /></span>
            <span class="t">
              <span class="n">{alt ? alt.supplier.name : 'No other supplier'}</span>
              {alt && <span class="p"><span class="mono">{fig(alt.price.price)}</span><span class="age">{`on the list · ${alt.days} ${alt.days === 1 ? 'day' : 'days'}`}</span></span>}
            </span>
            {alt
              ? <RowAct icon="swap" word="Switch" busyWord="Switching" busy={busy === 'other'} label={`Switch to ${alt.supplier.name} at ${fig(alt.price.price)}`} on={() => { void other(); }} />
              : <button type="button" class="ow-b-orders-act" disabled aria-label="Switch is off: nobody else has it on the list"><Icon name="swap" size={16} stroke={2.2} />Switch</button>}
          </div>
          {alt && (
            <div class="pic" role="img" aria-label={`Cost ${fig(alt.price.price)}, ${seller} sells at ${fig(l.sell)}`}>
              <div class="bar"><span style={{ width: barW((alt.price.price / Math.max(1, l.sell)) * 100), background: alt.price.price > l.sell ? '#8E2A22' : '#0F6B43' }} /></div>
              <div class="k"><span>cost <span class="mono">{fig(alt.price.price)}</span></span><span>sells <span class="mono">{fig(l.sell)}</span></span></div>
            </div>
          )}
          <div class="f">
            <Sees who={seller}>Switched</Sees>
            <button type="button" class="more" onClick={otherItem}>Other item<Icon name="chevron-right" size={16} stroke={2.2} /></button>
          </div>
        </div>

        <div class="ow-b-orders-way">
          <div class="r">
            {moses ? <Avatar initials={moses.initials} tint={moses.tint} size={40} /> : <span aria-hidden="true" class="tile"><Icon name="search" size={20} stroke={2} /></span>}
            <span class="t">
              <span class="n">{`${moses ? firstWord(moses.name) : 'Sourcing'} finds it`}</span>
              <span class="s">billed when it comes in</span>
            </span>
            <RowAct kind="line" icon="hourglass" word="Client waits" busyWord="Sending" busy={busy === 'wait'} on={() => { void wait(); }} />
          </div>
          <div class="f line"><Sees who={seller}>Client waits</Sees></div>
        </div>
      </div>
      <Dock inline words={`${seller} sees: Removed`} total={left} sub={{ text: fig(-x.total, false, true), tone: 'rose' }}
        style={{ marginTop: 'auto' }}
        slide={{
          label: 'Slide to remove', onCommit: remove,
          onHint: () => toast.show('Slide the red button across', { kind: 'warn' }),
          lock: only ? { icon: 'lock', label: 'Only line · use Client waits' } : undefined,
        }} />
    </div>
  );
}

/** Open the Not found sheet for one line of an order (Orders and the Replies "No" path). */
export function openNotFound(orderId: number, key: string): void {
  sheet.open(() => <NotFoundSheet orderId={orderId} lineKey={key} />, { label: `Not found · ${orderNo(orderId)}`, top: 84 });
}
