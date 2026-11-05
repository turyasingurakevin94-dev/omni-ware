/*
 * KC11 · Waiting for Ruth: the sale is placed and pushed to her (counter_sale answered "waiting").
 * Grace may serve the next walk-in meanwhile; Ruth's yes brings this one back (KC12). Or the walk-in
 * takes the shop's price, and pays now.
 */
import { WhoPill } from '../../../ui/TopBar.tsx';
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { Icon } from '../../../ui/icons.tsx';
import { fig } from '../../../ui/Money.tsx';
import { toast } from '../../../ui/toast.tsx';
import { howLong } from '../../../core/time.ts';
import type { Order } from '../../../core/types.ts';
import { nav, stack } from '../shell/nav.ts';
import { act, books, now } from '../shell/store.ts';
import type { ScreenProps } from '../shell/types.ts';
import { WaitCard } from './Ask.tsx';
import { manager } from './Counter.tsx';
import { Dock } from '../../../ui/Dock.tsx';
import { MethodPicker } from '../../../ui/PayMethod.tsx';
import './dock.css';
import { LineHead } from '../../../ui/LineCard.tsx';
import { chipOf } from './Picked.tsx';
import { askedAt, bringBack, reset, totalOf, waitingLines } from './state.ts';
import { heldOrder, startWatch } from './watch.ts';
import './counter.css';

/** How long it has waited: the books' clock, or this phone's when the demo's stands still. */
export function waited(o: Order): number {
  const asked = askedAt.get(o.id);
  return Math.max(now.value - o.placedAt, asked ? Date.now() - asked : 0);
}

export function Wait(p: ScreenProps): JSX.Element {
  const id = Number(p.params.id), b = books.value, o = heldOrder(id);
  const [, tick] = useState(0);
  const [busy, setBusy] = useState(false);
  // How long it has waited moves on by itself; the order is read again by watch.ts.
  useEffect(() => {
    startWatch();
    const t = window.setInterval(() => tick((n) => n + 1), 15000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => {
    if (o && !waitingLines(o.lines).length && !o.invoiced) { bringBack(o); nav.replace('counter'); }
  }, [o && o.lines.map((l) => (l.priceReview ? l.priceReview.at : 0)).join()]);
  if (!b || !o) return <main class="kc" aria-busy="true" />;
  const c = o.customerId ? b.customers.find((x) => x.id === o.customerId) : undefined;
  const ruth = manager(b), w = waitingLines(o.lines)[0] || o.lines[0], total = totalOf(o.lines);
  const atShop = o.lines.map((l) => (waitingLines([l]).length ? { ...l, price: l.shopPrice ?? l.price, priceBy: null, priceNote: null } : l));
  const close = () => { if (stack.value.length > 1) nav.back(); else nav.home(); };
  const shopPrice = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await act('counterLines', o.id, atShop);
      bringBack({ ...o, lines: atShop });
      nav.replace('counter');
    } catch (e) {
      toast.show('Not changed', { kind: 'error', sub: (e as Error).message });
    } finally { setBusy(false); }
  };
  return (
    <main class="kc">
      <div class="ow-topbar">
        <div class="ow-topbar-r">
          <button type="button" class="ow-close-c" aria-label="Close the counter sale" onClick={close}><Icon name="close" size={18} stroke={2} /></button>
          <WhoPill still face={c ? { initials: c.initials, tint: c.tint } : { initials: 'WI', tint: 't4' }} name="Counter sale" sub={`${c ? c.name : 'Walk-in'} · waiting for ${ruth.first}`} dot="var(--warn)" />
        </div>
      </div>
      <div class="kc-body" style={{ paddingBottom: '380px' }}>
        <div class="kc-lines">
          {o.lines.map((l) => {
            const it = b.items.find((i) => i.id === l.itemId);
            return <div key={l.lineId} class="ow-line"><LineHead name={l.name} qty={l.qty} unit={l.unit} price={l.price} aisle={it ? it.aisle : ''} chip={chipOf(l)} /></div>;
          })}
        </div>
        <WaitCard ruth={ruth} waited={howLong(0, waited(o))} was={w.shopPrice || 0} now={w.price || 0} unit={w.unit} />
        <a href="#" class="kc-next" onClick={(e) => { e.preventDefault(); reset(); nav.replace('counter'); }}>
          <span aria-hidden="true" class="kc-next-i"><Icon name="plus" size={18} stroke={2.6} /></span>
          <span class="kc-next-t"><b>Serve the next walk-in</b><span>{`${ruth.first}’s yes brings this one back`}</span></span>
          <span class="kc-next-c"><Icon name="chevron-right" size={16} stroke={2.4} /></span>
        </a>
      </div>
      <Dock above={null} words={`${ruth.first} decides first`} amber total={total} tight
        slide={{ label: '', onCommit: () => undefined, lock: { icon: 'hourglass', label: `Waiting for ${ruth.first}` } }}>
        <MethodPicker navy value="cash" dim onChange={() => undefined} />
        <button type="button" class="kc-glassbtn" disabled={busy} onClick={() => void shopPrice()}>Sell at the shop’s price ·<span class="mono">{fig(totalOf(atShop))}</span></button>
      </Dock>
    </main>
  );
}
