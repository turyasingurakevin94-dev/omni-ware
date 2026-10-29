/*
 * P12b · The stepper (LANGUAGE.md §3 P12b): a #F7F5F2 track, 44 tall;
 * fewer and more are 44 × 44 buttons; the number in mono with its unit.
 * It really counts: it calls onChange with the new number, never below min.
 *
 *   <Stepper value={qty} unit="pc" onChange={setQty} />
 *   <Stepper value={2} unit="of 3" min={1} max={3} onChange={…} />     a return: how many come back
 */
import type { JSX } from 'preact';
import { Icon } from './icons.tsx';
import './stepper.css';

export interface StepperProps {
  value: number;
  unit: string;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** "Fewer"/"More" by default; the item's name makes them say what they change. */
  what?: string;
}

export function Stepper(p: StepperProps): JSX.Element {
  const min = p.min ?? 0, max = p.max ?? Infinity, step = p.step || 1;
  const set = (n: number) => p.onChange(Math.max(min, Math.min(max, n)));
  return (
    <div class="ow-stepper" role="group" aria-label={p.what ? `How many ${p.what}` : 'How many'}>
      <button type="button" aria-label={p.what ? `Fewer ${p.what}` : 'Fewer'} disabled={p.value <= min} onClick={() => set(p.value - step)}><Icon name="minus" size={18} stroke={2.2} /></button>
      <span class="mono" aria-live="polite">{p.value}<span class="ow-word">{p.unit}</span></span>
      <button type="button" aria-label={p.what ? `More ${p.what}` : 'More'} disabled={p.value >= max} onClick={() => set(p.value + step)}><Icon name="plus" size={18} stroke={2.2} /></button>
    </div>
  );
}
