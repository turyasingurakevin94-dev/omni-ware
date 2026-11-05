/*
 * The order's dock (P15, as the Sell boards draw it): where it goes once it
 * is set (SL07 "Ntinda site · today +20,000"), Pickup or Delivery, what it
 * comes to and what still waits ("1 price coming", "1 for Ruth", "credit ·
 * Ruth decides", "all on shelf"), and the slide that places it. No signal:
 * the slide waits ("Back online to sell", SL27).
 */
import type { JSX } from 'preact';
import { Icon } from '../../../ui/icons.tsx';
import { fig } from '../../../ui/Money.tsx';
import { ModeSwitch } from '../../../ui/Dock.tsx';
import { Slide } from '../../../ui/Slide.tsx';
import { toast } from '../../../ui/toast.tsx';
import { books, online } from '../shell/store.ts';
import { cur, setMode, sums, WHEN_WORD } from './model.ts';
import { manager } from './people.ts';
import { openDelivery } from './sheets.tsx';
import '../../../ui/dock.css';

export function OrderDock(p: { onPlace: () => unknown; sending: boolean }): JSX.Element | null {
  const x = cur.value, s = sums.value, b = books.value;
  if (!x || !s || !b) return null;
  const n = x.lines.length, empty = n === 0, m = manager(b);
  const fee = x.charges.find((c) => /^Delivery/.test(c.label));
  let sub: JSX.Element | null = null;
  if (!empty) {
    if (s.coming > 0 && s.forRuth > 0) {
      sub = <span class="sl-dock-pills"><span>{`${s.coming} price${s.coming === 1 ? '' : 's'} coming`}</span><span>{`${s.forRuth} for ${m.first}`}</span></span>;
    } else if (s.coming > 0) sub = <>{`${s.coming} price${s.coming === 1 ? '' : 's'} coming`}</>;
    else if (s.forRuth > 0) sub = <>{`${s.forRuth} for ${m.first}`}</>;
    else if (x.credit && s.hold) sub = <>{`credit · ${m.first} decides`}</>;
    else if (s.allShelf) sub = <span class="sl-dock-mint">all on shelf</span>;
  }
  const state = empty ? 'empty' : !online.value ? 'offline' : p.sending ? 'sending' : 'ready';
  return (
    <div class="ow-dock sl-dock">
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
          : <div class="ow-dock-sum"><span class="mono ow-dock-total">{fig(s.total)}</span>{sub && <span class="mono ow-dock-sub amber">{sub}</span>}</div>}
      </div>
      <Slide label={empty ? 'Add an item to place' : `Slide to place · ${n} item${n === 1 ? '' : 's'}`} state={state}
        onCommit={p.onPlace} onHint={() => toast.show('Slide the red button across', { kind: 'warn' })} />
    </div>
  );
}
