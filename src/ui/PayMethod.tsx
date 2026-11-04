/*
 * S02 · How they paid (LANGUAGE.md §5.2 S02): the amount, the method, and
 * for cash in the dock "They gave / Give change".
 *
 *   <AmountField who="Kato pays now" value={420000} options={[{ word: 'All', amount: 420000, on: … }]} onOther={…} chosen={0} />
 *   <MethodPicker value="cash" onChange={setMethod} />          on light (Take payment)
 *   <MethodPicker navy value="cash" onChange={setMethod} />     inside the dock (a counter sale)
 *   <TheyGave total={52000} notes={[55000, 60000]} given={55000} onPick={setGiven} onKeep={…} />   cash only, in the dock
 *   <TheyGave … counted={53000} onCount={count} dim={!customer} />     the counter: Other amount, a counted tile, Short by
 *   <RefField value={ref} ok={ref.length >= 6} onInput={setRef} onPaste={paste} />                  Mobile and Bank
 */
import type { JSX } from 'preact';
import type { Method } from '../core/types.ts';
import { Icon, type IconName } from './icons.tsx';
import { notesFor } from '../core/money.ts';
import { fig } from './Money.tsx';
import { cx, type Fig } from './util.tsx';
import './paymethod.css';

const METHODS: [Method, string, IconName][] = [['cash', 'Cash', 'cash'], ['momo', 'Mobile', 'mobile'], ['bank', 'Bank', 'bank']];

/** Cash · Mobile · Bank, a radio group: on light, the chosen one navy; on navy (the dock), white. */
export function MethodPicker(p: { value: Method; onChange: (m: Method) => void; navy?: boolean; dim?: boolean }): JSX.Element {
  return (
    <div role="radiogroup" aria-label="How they paid" class={cx('ow-methods', p.navy && 'navy', p.dim && 'ow-dim')}>
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
  /** What it comes to. */
  total: number;
  /** The two likely notes, rounded up (core/money.ts likelyNotes). "Exact" comes first. */
  notes: number[];
  /** What they gave; 'exact' for Exact. */
  given: number | 'exact';
  onPick: (v: number | 'exact') => void;
  /** A counted amount that is not one of the notes: a fourth tile with a pen (KC06). */
  counted?: number | null;
  /** "Other amount" / "Count again": the counting sheet (the counter). */
  onCount?: () => void;
  /** They gave more and keep it: "Keep as deposit". */
  onKeep?: () => void;
  /** Not now (no customer yet, waiting): at 45%, not tappable. */
  dim?: boolean;
}

/** They gave: Exact and the two likely notes (a counted amount the fourth); then the change, or what is short and in which notes (KC07). */
export function TheyGave(p: TheyGaveProps): JSX.Element {
  const n = p.given === 'exact' ? p.total : p.given, change = n - p.total;
  const tiles: (number | 'exact')[] = ['exact', ...p.notes.slice(0, 2)];
  const counted = p.counted != null && !p.notes.includes(p.counted) && p.counted !== p.total ? p.counted : null;
  return (
    <div class={cx('ow-gave', p.dim && 'ow-dim')}>
      {p.onCount ? (
        <div class="ow-gave-h">
          <span>They gave</span>
          <button type="button" class="ow-gave-count" onClick={p.onCount}><span><Icon name="cash" size={15} stroke={2} />{counted != null ? 'Count again' : 'Other amount'}</span></button>
        </div>
      ) : <span class="ow-gave-k">They gave</span>}
      <div role="radiogroup" aria-label="They gave" class={cx('ow-gave-opts', counted != null && 'four')}>
        {tiles.map((t) => (
          <button key={t} type="button" role="radio" aria-checked={p.given === t} aria-label={t === 'exact' && p.onCount ? `Exact, ${fig(p.total)}` : undefined}
            class={cx(t !== 'exact' && 'mono', p.given === t && 'on')} onClick={() => p.onPick(t)}>{t === 'exact' ? 'Exact' : fig(t)}</button>
        ))}
        {counted != null && p.onCount && (
          <button type="button" role="radio" aria-checked={p.given === counted} aria-label={`They gave ${fig(counted)}. Count again`} class={cx('mono pen', p.given === counted && 'on')} onClick={p.onCount}>
            {fig(counted)}<Icon name="pen" size={13} stroke={2.2} />
          </button>
        )}
      </div>
      {change > 0 && (
        <div class="ow-gave-change">
          <span>Give change</span>
          {p.onKeep && <button type="button" class="ow-gave-keep" onClick={p.onKeep}><span>Keep as deposit</span></button>}
          <span class="mono">{fig(change)}</span>
        </div>
      )}
      {change < 0 && (
        <div class="ow-gave-change short">
          <span>Short by</span>
          <span class="ow-gave-s">
            <span role="img" aria-label={`${fig(-change)} still to come`} class="ow-gave-dash">{notesShort(-change).map((x, i) => <span key={i} class="mono">{fig(x)}</span>)}</span>
            <span class="mono">{fig(-change)}</span>
          </span>
        </div>
      )}
    </div>
  );
}

/** The missing money as the notes still to come (KC07: one dashed 2,000); under 1,000 counts as a 1,000. */
const notesShort = (v: number): number[] => notesFor(Math.ceil(v / 1000) * 1000).slice(0, 3);

/** The transaction ID (Mobile, Bank): amber until it is in, mint with a tick once it is; Paste reads their SMS (KC08, KC09). */
export function RefField(p: { value: string; ok: boolean; onInput: (v: string) => void; onPaste?: () => void }): JSX.Element {
  return (
    <label class={cx('ow-ref', p.ok && 'ok')}>
      <span class="ow-ref-t">
        <span>Transaction ID</span>
        <input type="text" inputmode="numeric" aria-label="Transaction ID" placeholder="Type the ID" value={p.value} autocomplete="off" spellcheck={false}
          onInput={(e) => p.onInput((e.target as HTMLInputElement).value)} />
      </span>
      {p.ok ? <span aria-hidden="true" class="ow-ref-ok"><Icon name="check" size={14} stroke={3.2} /></span>
        : p.onPaste && <button type="button" class="ow-ref-paste" aria-label="Paste the ID" onClick={(e) => { e.preventDefault(); (p.onPaste as () => void)(); }}><span>Paste</span></button>}
    </label>
  );
}
