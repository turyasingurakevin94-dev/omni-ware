/*
 * S02 · How they paid (LANGUAGE.md §5.2 S02): the amount, the method, and
 * for cash in the dock "They gave / Give change".
 *
 *   <AmountField who="Kato pays now" value={420000} options={[{ word: 'All', amount: 420000, on: … }]} onOther={…} chosen={0} />
 *   <MethodPicker value="cash" onChange={setMethod} />          on light (Take payment)
 *   <MethodPicker navy value="cash" onChange={setMethod} />     inside the dock (a counter sale)
 *   <TheyGave notes={[55000, 60000]} value={55000} onPick={setGiven} change={3000} onKeep={…} />   cash only, in the dock
 */
import type { JSX } from 'preact';
import type { Method } from '../core/types.ts';
import { Icon, type IconName } from './icons.tsx';
import { fig } from './Money.tsx';
import { cx, type Fig } from './util.tsx';
import './paymethod.css';

const METHODS: [Method, string, IconName][] = [['cash', 'Cash', 'cash'], ['momo', 'Mobile', 'mobile'], ['bank', 'Bank', 'bank']];

/** Cash · Mobile · Bank, a radio group: on light, the chosen one navy; on navy (the dock), white. */
export function MethodPicker(p: { value: Method; onChange: (m: Method) => void; navy?: boolean }): JSX.Element {
  return (
    <div role="radiogroup" aria-label="How they paid" class={cx('ow-methods', p.navy && 'navy')}>
      {METHODS.map(([m, word, icon]) => (
        <button key={m} type="button" role="radio" aria-checked={p.value === m} class={cx('ow-method', p.value === m && 'on')} onClick={() => p.onChange(m)}>
          <Icon name={icon} size={18} />{word}
        </button>
      ))}
    </div>
  );
}

export interface AmountFieldProps {
  /** "Kato pays now". */
  who: string;
  value: Fig;
  /** The quick amounts ("All 420,000"). */
  options: { word: string; amount: Fig; on: () => void }[];
  /** Which option is chosen; null: Other. */
  chosen: number | null;
  onOther: () => void;
}

/** The amount as a big mono field, with "All 420,000 / Other" under it. */
export function AmountField(p: AmountFieldProps): JSX.Element {
  return (
    <div class="ow-amount">
      <span class="ow-amount-k">{p.who}</span>
      <span class="ow-amount-v mono" aria-live="polite">{fig(p.value)}</span>
      <div class="ow-amount-opts">
        {p.options.map((o, i) => (
          <button key={i} type="button" class="ow-amount-o" aria-pressed={p.chosen === i} onClick={o.on}>
            <span class={cx(p.chosen === i && 'on')}>{o.word}<b class="mono">{fig(o.amount)}</b></span>
          </button>
        ))}
        <button type="button" class="ow-amount-o" aria-pressed={p.chosen == null} onClick={p.onOther}><span class={cx(p.chosen == null && 'on')}>Other</span></button>
      </div>
    </div>
  );
}

export interface TheyGaveProps {
  /** The two likely notes, rounded up. "Exact" comes first. */
  notes: number[];
  /** What they gave; 'exact' for Exact. */
  value: number | 'exact';
  onPick: (v: number | 'exact') => void;
  change: Fig;
  /** They gave more and keep it: "Keep as deposit". */
  onKeep?: () => void;
}

export function TheyGave(p: TheyGaveProps): JSX.Element {
  return (
    <div class="ow-gave">
      <span class="ow-gave-k">They gave</span>
      <div role="radiogroup" aria-label="They gave" class="ow-gave-opts">
        <button type="button" role="radio" aria-checked={p.value === 'exact'} class={cx(p.value === 'exact' && 'on')} onClick={() => p.onPick('exact')}>Exact</button>
        {p.notes.slice(0, 2).map((n) => (
          <button key={n} type="button" role="radio" aria-checked={p.value === n} class={cx('mono', p.value === n && 'on')} onClick={() => p.onPick(n)}>{fig(n)}</button>
        ))}
      </div>
      <div class="ow-gave-change">
        <span>Give change</span>
        {p.onKeep && <button type="button" class="ow-gave-keep" onClick={p.onKeep}><span>Keep as deposit</span></button>}
        <span class="mono">{fig(p.change)}</span>
      </div>
    </div>
  );
}
