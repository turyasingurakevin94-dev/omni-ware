/*
 * S10 · The bill being checked, side by side (LANGUAGE.md §5.2 S10; as
 * built: CU12): the two figures that may be the same money as two tiles
 * joined by "=": the open bill on warn soft, the payment on good soft. With
 * an eyebrow it comes as its card.
 *
 *   <BillMatch eyebrow="BILL #0528 · GGABA STORES · PAID ALREADY?" label="This bill, 125,000 open from 17 Aug, matches …"
 *     bill={{ k: '#0528 · open', v: 125000, sub: 'billed 17 Aug' }} paid={{ k: 'paid in cash', v: 125000, sub: 'receipt · 17 Aug' }} />
 */
import type { JSX } from 'preact';
import { fig } from './Money.tsx';
import type { Fig } from './util.tsx';
import './billmatch.css';

interface Side { k: string; v: Fig; sub: string }

export function BillMatch(p: { bill: Side; paid: Side; label: string; eyebrow?: string; sign?: string }): JSX.Element {
  const side = (s: Side, c: string) => <span class={'ow-bm-side ' + c}><span>{s.k}</span><b class="mono">{fig(s.v)}</b><span>{s.sub}</span></span>;
  const grid = (
    <div role="img" aria-label={p.label} class="ow-bm">
      {side(p.bill, 'warn')}
      <span class="ow-bm-eq mono">{p.sign || '='}</span>
      {side(p.paid, 'good')}
    </div>
  );
  if (!p.eyebrow) return grid;
  return <div class="ow-bm-card"><span class="ow-bm-eye">{p.eyebrow}</span>{grid}</div>;
}
