/*
 * LOCAL PART (for the lead to move into src/ui, beside S02's AmountField):
 * the amount as the Customers boards draw it, a field you type in. 56 tall,
 * a 2 px ink outline, "UGX" small before the figure in Plex Mono 26/600,
 * written with commas as it is typed (CU15, CU30-CU36).
 */
import type { JSX, RefObject } from 'preact';
import { money } from '../../../core/money.ts';

/** The whole shillings in what was typed: "420,000" → 420000. */
export function digits(s: string): number {
  const d = String(s || '').replace(/\D/g, '');
  return d ? Math.min(Number(d), 999999999) : 0;
}

export function AmountInput(p: { value: number; label: string; onInput: (v: number) => void; inputRef?: RefObject<HTMLInputElement> }): JSX.Element {
  return (
    <label class="cu-amt">
      <span>UGX</span>
      <input ref={p.inputRef} type="text" inputMode="numeric" class="mono" aria-label={p.label} value={p.value ? money(p.value) : ''}
        onInput={(e) => { const el = e.target as HTMLInputElement, v = digits(el.value); el.value = v ? money(v) : ''; p.onInput(v); }} />
    </label>
  );
}
