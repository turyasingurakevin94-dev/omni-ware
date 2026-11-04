/*
 * Take payment's dock (CU30–CU36): what they owe before and after, the
 * receipt switch, for cash what they gave (Exact or the next notes) and the
 * change or deposit, then the one slide. The slide waits, with a lock and
 * the reason, until the payment can be recorded (CU33).
 */
import type { JSX } from 'preact';
import { Icon } from '../../../ui/icons.tsx';
import { Slide } from '../../../ui/Slide.tsx';
import { toast } from '../../../ui/toast.tsx';
import { cx } from '../../../ui/util.tsx';
import { money } from '../../../core/money.ts';
import { orderNo } from '../../../core/names.ts';
import type { Method } from '../../../core/types.ts';

export interface PayDockProps {
  method: Method;
  given: number | 'exact';
  notes: number[];
  onGiven: (v: number | 'exact') => void;
  amount: number;
  owes: number;
  after: number;
  payable: number;
  over: { how: 'change' | 'deposit'; amount: number } | null;
  change: number;
  record: number;
  receipt: { on: boolean; label: string; toggle: () => void } | null;
  /** A walk-in's order: what is left, and who will owe what once it is on their account. */
  walkin: { id: number; total: number; left: number; who: { name: string; owes: number } | null } | null;
  /** Why the slide waits; null when it can go. */
  words: string | null;
  sending: boolean;
  onCommit: () => Promise<void>;
}

function Receipt(p: { on: boolean; label: string; toggle: () => void }): JSX.Element {
  return (
    <button type="button" role="switch" aria-checked={p.on} aria-label={p.label} class={cx('cu-rcpt', !p.on && 'off')} onClick={p.toggle}>
      <span aria-hidden="true"><Icon name="receipt" size={16} stroke={2.2} /></span>Receipt
    </button>
  );
}

export function PayDock(p: PayDockProps): JSX.Element {
  const pct = p.owes ? Math.round(((p.owes - p.after) / p.owes) * 100) : 0;
  const head = p.walkin ? (
    <span class="cu-dk-owes">
      <span class="cu-dk-k">{orderNo(p.walkin.id)}</span><s class="mono">{money(p.walkin.total)}</s><span class="cu-dk-arrow">→</span>
      <span class="mono cu-dk-after amber">{money(p.walkin.left)}{p.walkin.who && ' '}{p.walkin.who && <span class="cu-dk-who">{`· ${p.walkin.who.name} owes `}<b class="mono">{money(p.walkin.who.owes)}</b></span>}</span>
    </span>
  ) : (
    <span class="cu-dk-owes">
      <span class="cu-dk-k">Owes</span><s class="mono">{money(p.owes)}</s><span class="cu-dk-arrow">→</span>
      <span class={cx('mono cu-dk-after', p.after > 0 && 'amber')}>{money(p.after)}</span>
    </span>
  );
  const top = (
    <div class="cu-dk-top">
      <span class="cu-dk-l">
        {head}
        <span role="img" aria-label={`This pays ${pct} percent of what they owe`} class="cu-dk-meter"><span style={{ width: `${pct}%` }} /></span>
      </span>
      {p.receipt && <Receipt {...p.receipt} />}
    </div>
  );
  const cash = p.method === 'cash' && !p.walkin;
  return (
    <div class="cu-dock">
      {cash ? (
        <div class="cu-gave">
          <span class="cu-gave-h"><span>They gave</span><span>pays now <b class="mono">{money(p.amount)}</b></span></span>
          <div role="radiogroup" aria-label="They gave" class="cu-gave-o">
            <button type="button" role="radio" aria-checked={p.given === 'exact'} class={cx(p.given === 'exact' && 'on')} onClick={() => p.onGiven('exact')}>Exact</button>
            {p.notes.map((n) => <button key={n} type="button" role="radio" aria-checked={p.given === n} class={cx('mono', p.given === n && 'on')} onClick={() => p.onGiven(n)}>{money(n)}</button>)}
          </div>
          {p.over || p.change > 0 ? (
            <div class="cu-gave-c"><span>{p.over && p.over.how === 'deposit' ? 'Deposit' : 'Give change'}</span>
              <span><span class="mono">{money(p.over ? p.over.amount : p.change)}</span>{p.receipt && <Receipt {...p.receipt} />}</span></div>
          ) : top}
        </div>
      ) : top}
      {p.words ? <Slide label="" knobLabel="" onCommit={() => undefined} lock={{ icon: 'lock', label: p.words, quiet: true, onTap: () => toast.show(p.words as string, { kind: 'warn' }) }} />
        : <Slide label={`Slide to record ${money(p.record)}`} knobLabel={`Record ${money(p.record)}`} state={p.sending ? 'sending' : 'ready'} onCommit={p.onCommit}
          onHint={() => toast.show('Slide the red button across', { kind: 'warn' })} />}
    </div>
  );
}
