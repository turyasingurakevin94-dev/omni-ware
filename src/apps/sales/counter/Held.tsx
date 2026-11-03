/*
 * KC24 · a counter sale waiting for the Manager's price, on the free counter: open it (KC11), or
 * "They left": the ask to cancel it (ask_cancel, 0181: only the Manager cancels an order). KC27 ·
 * asked: OR28's "Cancel asked · Waiting", the Undo in the shared toast (withdraw_cancel_ask). When
 * she says yes, cancel_order takes the sale, and her price ask with it.
 */
import type { JSX } from 'preact';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { fig } from '../../../ui/Money.tsx';
import { toast } from '../../../ui/toast.tsx';
import { orderNo } from '../../../core/names.ts';
import type { BillAsk, Books, Order, Tint } from '../../../core/types.ts';
import { nav } from '../shell/nav.ts';
import { act } from '../shell/store.ts';
import { totalOf, waitingLines } from './state.ts';
import { mine } from './watch.ts';
import './held.css';

/** The reason the ask carries (0181 takes words). */
const LEFT = 'They left';

async function theyLeft(o: Order, ruth: string): Promise<void> {
  try {
    const r = await act<BillAsk>('askCancel', o.id, LEFT);
    const id = r.kept ? null : r.value.id;
    toast.show(`Asked ${ruth} to cancel ${orderNo(o.id)}`, { undo: id ? () => { void act('withdrawBillAsk', id); } : undefined });
  } catch (e) {
    toast.show('Not sent', { kind: 'error', sub: (e as Error).message });
  }
}

/** The waiting sales of this phone's salesperson (with a price waiting, or a cancel asked). */
export function heldSales(b: Books): { o: Order; ask: BillAsk | undefined }[] {
  return mine().map((o) => ({ o, ask: b.billAsks.find((a) => a.kind === 'cancel' && a.orderId === o.id && a.status === 'sent') }))
    .filter((x) => x.ask || waitingLines(x.o.lines).length);
}

export function Held(p: { b: Books; ruth: { initials: string; tint: Tint; first: string } }): JSX.Element | null {
  const rows = heldSales(p.b);
  if (!rows.length) return null;
  return (
    <>
      {rows.map(({ o, ask }) => ask ? (
        <div key={o.id} class="kc-held asked">
          <div>
            <span aria-hidden="true" class="kc-held-x"><Icon name="close" size={19} stroke={2.2} /></span>
            <span class="kc-held-t">
              <span class="h">Cancel asked<span class="chip">Waiting</span></span>
              <span class="s"><Avatar initials={p.ruth.initials} tint={p.ruth.tint} size={18} />{`Asked ${p.ruth.first} to cancel `}<span class="mono">{orderNo(o.id)}</span></span>
            </span>
          </div>
        </div>
      ) : (
        <div key={o.id} class="kc-held">
          <a href="#" class="kc-held-o" aria-label={`Open ${orderNo(o.id)}, waiting for ${p.ruth.first}`} onClick={(e) => { e.preventDefault(); nav.replace('counter/wait', { id: o.id }); }}>
            <Avatar initials={p.ruth.initials} tint={p.ruth.tint} size={40} class="kc-glow" />
            <span class="kc-held-w">
              <span class="h">{`Waiting for ${p.ruth.first} · `}<span class="mono">{orderNo(o.id)}</span></span>
              <span class="s"><span aria-hidden="true" class="dot" />{`${o.client.name || 'Walk-in'} · `}<span class="mono">{fig(totalOf(o.lines))}</span></span>
            </span>
          </a>
          <button type="button" class="kc-held-left" onClick={() => void theyLeft(o, p.ruth.first)}>They left</button>
        </div>
      ))}
    </>
  );
}
