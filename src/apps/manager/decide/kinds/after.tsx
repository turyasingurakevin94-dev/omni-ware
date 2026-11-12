/*
 * The parts the after-the-order kinds share (DecideOrders p2–p6): the "owes 662,000 → 605,750" bar
 * (the new figure navy, what comes off hatched), and the dock's Refund · Deposit chips (D-19, D-20).
 */
import type { JSX } from 'preact';
import { money } from '../../../../core/money.ts';
import type { Money } from '../../../../core/manager/source.ts';
import { ANSWER } from '../../../../core/manager/words.ts';
import { SplitBar } from '../../../../ui/Bar.tsx';
import './after.css';

const HATCH = 'repeating-linear-gradient(135deg, #DCEBE3 0 4px, #EEF5F1 4px 8px)';

/** "Lubowa Builders owes 662,000 → 605,750" and its bar; `under` is the soft line below it. */
export function OwesBar(p: { who: string; was: number; now: number; under?: string; head?: JSX.Element }): JSX.Element {
  const moved = p.was !== p.now;
  return (
    <div class="mg-card">
      {p.head}
      <div class="mg-af-owes">
        <span>{p.who}</span>
        <span class="mg-mono">
          {moved && <s>{money(p.was)}</s>}
          {moved && ' → '}
          <b>{money(p.now)}</b>
        </span>
      </div>
      <SplitBar h={8} gap={0} label={`${p.who} ${money(p.was)} to ${money(p.now)}`}
        parts={[{ value: Math.max(0, p.now), color: '#16203C' }, { value: Math.max(0, p.was - p.now), color: HATCH }]} />
      {p.under && <span class="mg-af-under mg-mono">{p.under}</span>}
    </div>
  );
}

export type How = 'refund' | 'deposit' | null;

/** The dock's chip row: Refund 200,000 · Deposit 200,000 (none picked at first). */
export function MoneyChips(p: { paid: number; how: How; onPick: (h: How) => void }): JSX.Element {
  const chip = (h: 'refund' | 'deposit', word: string) => (
    <button type="button" role="radio" aria-checked={p.how === h} onClick={() => p.onPick(h)}>{`${word} ${money(p.paid)}`}</button>
  );
  return <div class="mg-segs" role="radiogroup" aria-label="The money paid">{chip('refund', ANSWER.refund)}{chip('deposit', ANSWER.deposit)}</div>;
}

/** The write's Money from a picked chip (a refund goes back in cash). */
/** The answer's money: a refund goes back the way it was paid (the order's paidBy; cash when not known). */
export function moneyOf(how: How, paidBy: 'cash' | 'momo' | 'bank' | null = null): Money {
  return how === 'refund' ? { how: 'refund', account: paidBy || 'cash' } : how === 'deposit' ? { how: 'deposit' } : null;
}
