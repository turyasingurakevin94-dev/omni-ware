/*
 * The result of an answer made in place (Orders board states): the navy strip "{answer} · Undo"
 * while it waits its 10 s, the same strip with a tick once sent, "Not sent · {what} · Try again",
 * or "Waits" with no signal. Nothing while it is idle or sending (the button shows those).
 */
import type { JSX } from 'preact';
import { Icon } from '../../../ui/icons.tsx';
import { undoHeld } from '../shell/store.ts';
import type { InPlace } from './useAnswer.ts';

export function Strip(p: { spot: InPlace; what: string }): JSX.Element | null {
  const s = p.spot;
  if (s.st === 'held' || s.st === 'done') {
    return (
      <div class="mg-orders-strip" role="status" onClick={(e) => e.stopPropagation()}>
        <Icon name="check" size={18} stroke={2.4} />
        <span>{s.label}</span>
        {s.st === 'held' && <button type="button" onClick={() => undoHeld()}><Icon name="undo" size={16} stroke={2.2} />Undo</button>}
      </div>
    );
  }
  if (s.st === 'kept') return <div class="mg-orders-acts"><span class="mg-orders-waits"><Icon name="clock" size={16} stroke={2} />Waits</span></div>;
  if (s.st === 'error') {
    return (
      <div class="mg-orders-err" role="alert" onClick={(e) => e.stopPropagation()}>
        <span class="ic"><Icon name="warning" size={18} stroke={2} /></span>
        <span class="t"><b>Not sent</b><span class="mono">{p.what}</span></span>
        <button type="button" class="mg-orders-btn navy" onClick={s.retry}><Icon name="retry" size={16} stroke={2.2} />Try again</button>
      </div>
    );
  }
  return null;
}
