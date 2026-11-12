/*
 * The order's dock (P15, as the Sell boards draw it): where it goes once it
 * is set (SL07 "Ntinda site · today +20,000"), Pickup or Delivery, what it
 * comes to and what still waits ("1 price coming", "1 for Ruth", "credit ·
 * Ruth decides", "all on shelf"), and the slide that places it. No signal:
 * the slide waits ("Back online to sell", SL27).
 */
import type { JSX } from 'preact';
import { useRef } from 'preact/hooks';
import { counted } from '../../../core/names.ts';
import { Icon } from '../../../ui/icons.tsx';
import { fig, orderFig } from '../../../ui/Money.tsx';
import { ModeSwitch, useDockHeight } from '../../../ui/Dock.tsx';
import { Slide } from '../../../ui/Slide.tsx';
import { toast } from '../../../ui/toast.tsx';
import { books, online } from '../shell/store.ts';
import { cur, setMode, sums, WHEN_WORD } from './model.ts';
import { manager } from './people.ts';
import { openDelivery } from './sheets.tsx';
import '../../../ui/dock.css';

/** `locked`: its place is kept on this phone (SAL-4): shown, never placed twice — "Waiting to send". */
export function OrderDock(p: { onPlace: () => unknown; sending: boolean; locked?: boolean }): JSX.Element | null {
  const x = cur.value, s = sums.value, b = books.value, foot = useRef<HTMLDivElement>(null);
  useDockHeight(foot, !!(x && s && b));
  if (!x || !s || !b) return null;
  const n = x.lines.length, empty = n === 0, m = manager(b);
  const fee = x.charges.find((c) => /^Delivery/.test(c.label));
  let sub: JSX.Element | null = null;
  if (!empty) {
    if (s.coming > 0 && s.forRuth > 0) {
      sub = <span class="sl-dock-pills"><span>{`${counted(s.coming, 'price')} coming`}</span><span>{`${s.forRuth} for ${m.first}`}</span></span>;
    } else if (s.coming > 0) sub = <>{`${counted(s.coming, 'price')} coming`}</>;
    else if (s.forRuth > 0) sub = <>{`${s.forRuth} for ${m.first}`}</>;
    else if (x.credit && s.hold) sub = <>{`credit · ${m.first} decides`}</>;
    else if (s.allShelf) sub = <span class="sl-dock-mint">all on shelf</span>;
  }
  const state = empty ? 'empty' : !online.value ? 'offline' : p.sending ? 'sending' : 'ready';
  return (
    <div ref={foot} class="ow-dock sl-dock">
      {x.mode === 'delivery' && x.delivery && (
        <a href="#" class="sl-dock-where" onClick={(e) => { e.preventDefault(); openDelivery(); }}>
          <span class="sl-dock-pin"><Icon name="pin" size={18} /></span>
          <span class="sl-dock-wt">{`${x.delivery.where.split(',')[0]} · ${WHEN_WORD[x.delivery.when].split(' ')[0]} `}{fee && <b class="mono">{fig(fee.value, false, true)}</b>}</span>
          <span class="sl-dock-go"><Icon name="chevron-right" size={14} stroke={2.4} /></span>
        </a>
      )}
      <div class="ow-dock-top">
        <ModeSwitch value={x.mode} onChange={(v) => (v === 'delivery' ? openDelivery() : setMode('pickup'))} />
        {empty
          ? <div class="ow-dock-none" aria-label="Nothing yet"><span aria-hidden="true"><i /><i /><i /></span><span class="mono">0</span></div>
          : <div class="ow-dock-sum"><span class="mono ow-dock-total">{fig(orderFig(x.lines, s.total))}</span>{sub && <span class="mono ow-dock-sub amber">{sub}</span>}</div>}
      </div>
      <Slide label={empty ? 'Add an item to place' : `Slide to place · ${counted(n, 'item')}`} state={state}
        lock={p.locked ? { icon: 'lock', label: 'Waiting to send · locked' } : undefined}
        onCommit={p.onPlace} onHint={() => toast.show('Slide the red button across', { kind: 'warn' })} />
    </div>
  );
}
