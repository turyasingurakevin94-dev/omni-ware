/*
 * The Decide sheet's navy dock (BRIEF "Dock rule"): who sees what (bell + the green word), the
 * figure the answer moves, an optional chip row, one primary answer (a white pill: a tap; or the
 * red-knob slide: money or books), and the outline second.
 */
import type { JSX } from 'preact';
import { money } from '../../../core/money.ts';
import { whoSee } from '../../../core/manager/words.ts';
import { Icon } from '../../../ui/icons.tsx';
import { Slide } from '../../../ui/Slide.tsx';
import { toast } from '../../../ui/toast.tsx';
import type { Dock } from './kit.ts';

export function DockView(p: { d: Dock; busy?: boolean; cooling?: boolean; online?: boolean }): JSX.Element {
  const d = p.d, pr = d.primary, wait = p.busy || p.cooling;
  return (
    <footer class="mg-dock" aria-busy={wait ? 'true' : undefined}>
      {d.above}
      <div class="mg-dock-top">
        <span class="mg-sees"><Icon name="bell" size={14} stroke={2} />{whoSee(d.told)}{d.word && <span class="w">{d.word}</span>}</span>
        {d.total && <span class="mg-dock-tot"><b>{money(d.total.v)}</b>{d.total.sub && <span>{d.total.sub}</span>}</span>}
      </div>
      {'tap' in pr ? (
        <button type="button" class="mg-ans" aria-disabled={pr.tap.disabled ? 'true' : undefined}
          onClick={() => { if (pr.tap.disabled) toast.show(pr.tap.disabled, { kind: 'warn' }); else if (!wait) pr.tap.on(); }}>
          {!pr.tap.disabled && <Icon name="check" size={18} stroke={2.4} />}
          <span>{pr.tap.disabled || pr.tap.label}</span>
        </button>
      ) : (
        <Slide label={pr.slide.label} onCommit={pr.slide.on} state={p.busy ? 'sending' : 'ready'}
          lock={pr.slide.disabled ? { icon: 'lock', label: pr.slide.disabled }
            // A slide moves money or books and is never kept on the phone: it waits for signal (DecideStock offline).
            : p.online === false ? { icon: 'offline', label: `${pr.slide.label.split(' · ')[0]} needs signal` } : undefined}
          onHint={() => toast.show('Slide the red button across', { kind: 'warn' })} />
      )}
      {d.secondary && (
        <button type="button" class="mg-out" aria-disabled={d.secondary.disabled ? 'true' : undefined}
          onClick={() => { if (!d.secondary!.disabled && !wait) d.secondary!.on(); }}>{d.secondary.label}</button>
      )}
    </footer>
  );
}
