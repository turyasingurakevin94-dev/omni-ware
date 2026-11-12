/*
 * The end of an Out flow (OU05 On the road, OU12 Handed over, OU22 Delivered): the navy moment with its
 * mark, who it went with, who sees it now (the pushes, rows on glass), what happens next, the Undo row
 * while the write waits its 10 s (store.ts hold, quiet: this row is its Undo), and "Back to Today".
 * The moment is P22's; the Store's draws its "sees" rows and its Undo row, so it is built here from
 * WhatsNext and EndOfFlow rather than <Moment>.
 */
import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { Avatar, type Face } from '../../../ui/Avatar.tsx';
import { Icon, type IconName } from '../../../ui/icons.tsx';
import { EndOfFlow } from '../../../ui/Moment.tsx';
import { nav } from '../shell/nav.ts';
import { held, undoHeld } from '../shell/store.ts';
import './done.css';

export interface Sees { face: Face; who: string; what: string; at?: string }
export interface Step { icon: IconName; title: string; sub: string }

export interface DoneProps {
  mark: 'check' | 'hand-over';
  title: string;
  /** The chip under the title: a face (or the door photo) and its words. */
  chip: { face?: Face; photo?: boolean; name: string; sub: string; mono?: boolean };
  sees: Sees[];
  next: Step[];
  /** The Undo row's words ("Left 13:20 · bay 1 is free"); shown while the write waits. */
  undo: string;
}

/** Seconds left on the held write, or 0 once it has gone. */
function useLeft(): number {
  const [, tick] = useState(0);
  const h = held.value;
  useEffect(() => {
    if (!h) return undefined;
    const t = window.setInterval(() => tick((x) => x + 1), 500);
    return () => clearInterval(t);
  }, [h]);
  return h && h.quiet ? Math.max(0, Math.ceil((h.until - Date.now()) / 1000)) : 0;
}

function Chip(p: DoneProps['chip']): JSX.Element {
  if (p.photo) {
    return (
      <span class="dn-chip photo">
        <span aria-hidden="true" class="dn-thumb"><span /><span /></span>
        <span class="dn-chip-t"><span>{p.name}</span><span class="mono">{p.sub}</span></span>
      </span>
    );
  }
  return (
    <span class="dn-chip">
      {p.face && <Avatar {...p.face} size={30} font={11} style={{ letterSpacing: '-.02em' }} />}
      <span class="dn-chip-n">{p.name}</span><span class="mono dn-chip-s">{p.sub}</span>
    </span>
  );
}

export function Done(p: DoneProps & { children?: ComponentChildren }): JSX.Element {
  const left = useLeft();
  return (
    <main class="dn" data-route="out-done">
      <div class="dn-x"><button type="button" aria-label="Close" onClick={() => nav.home()}><Icon name="close" size={16} stroke={2.2} /></button></div>
      <div class="dn-top">
        <span aria-hidden="true" class="dn-mark">{p.mark === 'check' ? <Icon name="check" size={40} stroke={2.8} /> : <Icon name="hand-over" size={40} stroke={2.2} />}</span>
        <h1>{p.title}</h1>
        <Chip {...p.chip} />
      </div>
      <div class="dn-sees">
        {p.sees.map((s, i) => (
          <div key={i} class="dn-see">
            <Avatar {...s.face} size={28} font={11} style={{ letterSpacing: '-.02em' }} />
            <span class="dn-see-t"><b>{s.who} sees</b> · {s.what}</span>
            <span class="dn-see-at">{<Icon name="bell" size={s.at ? 12 : 13} stroke={2.2} />}{s.at && <span class="mono">{s.at}</span>}</span>
          </div>
        ))}
      </div>
      <div class="dn-next">
        <span class="dn-next-h">What happens next</span>
        {p.next.map((s, i) => (
          <div key={i} class="dn-step">
            <span aria-hidden="true" class={'dn-step-sq' + (i === 0 ? ' now' : '')}><Icon name={s.icon} size={20} stroke={2} /></span>
            <span class="dn-step-t"><span>{s.title}</span><span>{s.sub}</span></span>
            {i < p.next.length - 1 && <span aria-hidden="true" class="dn-step-line" />}
          </div>
        ))}
      </div>
      <div class="dn-end">
        {left > 0 && (
          <div role="status" class="dn-undo">
            <span>{p.undo}</span>
            <button type="button" onClick={undoHeld}><Icon name="undo" size={15} stroke={2.2} />Undo <span class="mono">{left} s</span></button>
          </div>
        )}
        <EndOfFlow on={() => nav.home()} ms={12000} />
      </div>
    </main>
  );
}
