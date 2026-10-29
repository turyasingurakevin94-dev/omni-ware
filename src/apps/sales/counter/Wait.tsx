/*
 * KC11 · Waiting for Ruth: the sale is placed and pushed to her (counter_sale answered "waiting").
 * Grace may serve the next walk-in meanwhile; Ruth's yes brings this one back (KC12). Or the walk-in
 * takes the shop's price, and pays now.
 */
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { fig } from '../../../ui/Money.tsx';
import { toast } from '../../../ui/toast.tsx';
import { howLong } from '../../../core/time.ts';
import type { Order } from '../../../core/types.ts';
import { nav, stack } from '../shell/nav.ts';
import { act, books, now, refresh } from '../shell/store.ts';
import type { ScreenProps } from '../shell/types.ts';
import { WaitCard } from './Ask.tsx';
import { manager } from './Counter.tsx';
import { DockFrame, Methods, Move, NavyDock } from './CounterDock.tsx';
import { LineHead } from './local-line.tsx';
import { chipOf } from './Picked.tsx';
import { askedAt, bringBack, reset, totalOf, waitingLines } from './state.ts';
import './counter.css';

/** How long it has waited: the books' clock, or this phone's when the demo's stands still. */
export function waited(o: Order): number {
  const asked = askedAt.get(o.id);
  return Math.max(now.value - o.placedAt, asked ? Date.now() - asked : 0);
}

export function Wait(p: ScreenProps): JSX.Element {
  const id = Number(p.params.id), b = books.value, o = b ? b.orders.find((x) => x.id === id) : undefined;
  const [, tick] = useState(0);
  const [busy, setBusy] = useState(false);
  // While the walk-in waits, the books are read again every few seconds (sales.html ctPoll: 6 s).
  useEffect(() => {
    const t = window.setInterval(() => { tick((n) => n + 1); void refresh(); }, 5000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => {
    if (o && !waitingLines(o.lines).length && !o.invoiced) { bringBack(o); nav.replace('counter'); }
  }, [o && o.lines.map((l) => (l.priceReview ? l.priceReview.at : 0)).join()]);
  if (!b || !o) return <main class="kc" aria-busy="true" />;
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
          <div class="ow-who">
            <Avatar initials={o.customerId ? o.client.name.slice(0, 2).toUpperCase() : 'WI'} tint="t4" size={38} />
            <span class="ow-who-t">
              <span class="ow-who-n">Counter sale</span>
              <span class="ow-who-s"><span aria-hidden="true" class="ow-who-dot" style={{ background: '#95530C' }} />{`${o.client.name || 'Walk-in'} · waiting for ${ruth.first}`}</span>
            </span>
          </div>
        </div>
      </div>
      <div class="kc-body" style={{ paddingBottom: '380px' }}>
        <div class="kc-lines">
          {o.lines.map((l) => {
            const it = b.items.find((i) => i.id === l.itemId);
            return <div key={l.lineId} class="ow-line"><LineHead line={l} aisle={it ? it.aisle : ''} chip={chipOf(l)} /></div>;
          })}
        </div>
        <WaitCard ruth={ruth} waited={howLong(0, waited(o))} was={w.shopPrice || 0} now={w.price || 0} unit={w.unit} />
        <a href="#" class="kc-next" onClick={(e) => { e.preventDefault(); reset(); nav.replace('counter'); }}>
          <span aria-hidden="true" class="kc-next-i"><Icon name="plus" size={18} stroke={2.6} /></span>
          <span class="kc-next-t"><b>Serve the next walk-in</b><span>{`${ruth.first}’s yes brings this one back`}</span></span>
          <span class="kc-next-c"><Icon name="chevron-right" size={16} stroke={2.4} /></span>
        </a>
      </div>
      <DockFrame>
        <NavyDock words={`${ruth.first} decides first`} amber total={total} tight>
          <Methods value="cash" dim onChange={() => undefined} />
          <button type="button" class="kc-glassbtn" disabled={busy} onClick={() => void shopPrice()}>Sell at the shop’s price ·<span class="mono">{fig(totalOf(atShop))}</span></button>
          <Move sending={false} locked={{ icon: 'hourglass', label: `Waiting for ${ruth.first}` }} label="" onSell={() => undefined} />
        </NavyDock>
      </DockFrame>
    </main>
  );
}
