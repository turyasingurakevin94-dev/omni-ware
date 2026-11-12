/*
 * The answered suppliers, folded to one line ("Answered ●●●● 4 ›", board
 * Replies phone 1) and opened in place (docs/canvas/buyer/Additions.dc.html,
 * phone D): one row per supplier (rules.answeredRows), the count tile, the
 * name, "Found · 09:50 · #0553" (or "2 orders"), the state chip. A row
 * opens its order, or Orders when it holds several.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { answeredRows, WORD } from '../../../core/buyer/rules.ts';
import type { BuyerBooks, LineState } from '../../../core/buyer/types.ts';
import { counted, orderNo } from '../../../core/names.ts';
import { clock } from '../../../core/time.ts';
import { Icon } from '../../../ui/icons.tsx';
import { nav } from '../shell/nav.ts';

const TONE: Partial<Record<LineState, string>> = { priceup: 'warn', notfound: 'bad', found: 'good' };
const DOT: Record<string, string> = { warn: '#95530C', bad: '#8E2A22', good: '#0F6B43' };

export function Answered(p: { b: BuyerBooks; now: number }): JSX.Element | null {
  const [open, setOpen] = useState(false);
  const rows = answeredRows(p.b, p.now);
  if (!rows.length) return null;
  const words = rows.map((r) => WORD[r.state]);
  if (!open) {
    return (
      <button type="button" class="ow-b-replies-answered" aria-expanded="false" aria-label={`Answered, ${rows.length}`} onClick={() => setOpen(true)}>
        <span class="t">Answered</span>
        <span class="ow-b-replies-dots" role="img" aria-label={words.join(', ')}>
          {rows.map((r) => <span key={r.supplier.id} style={{ background: DOT[TONE[r.state] || 'good'] }} />)}
        </span>
        <span class="mono">{rows.length}</span>
        <Icon name="chevron-right" size={18} stroke={2} />
      </button>
    );
  }
  return (
    <section class="ow-b-replies-ans">
      <div class="ow-b-replies-anshead">
        <b>Answered</b>
        <button type="button" class="mono" aria-expanded="true" onClick={() => setOpen(false)}>{`${rows.length} · hide ⌃`}</button>
      </div>
      <div class="ow-b-replies-anslist">
        {rows.map((r) => {
          const tone = TONE[r.state] || 'good', n = r.lines.filter((x) => x.state === r.state).length || r.lines.length;
          const where = r.orders.length === 1 ? orderNo(r.orders[0].id) : counted(r.orders.length, 'order');
          const go = () => (r.orders.length === 1 ? nav.push('orders/order', { id: r.orders[0].id }) : nav.push('orders'));
          return (
            <button key={r.supplier.id} type="button" class="ow-b-replies-ansrow" onClick={go}
              aria-label={`${r.supplier.name}: ${WORD[r.state]}. Open ${r.orders.length === 1 ? 'the order' : 'Orders'}`}>
              <span class={'ow-b-replies-anstile mono t-' + tone}>{n}</span>
              <span class="ow-b-replies-who"><b>{r.supplier.name}</b><span class="mono">{`${WORD[r.state]} · ${r.answeredAt ? clock(r.answeredAt) : '—'} · ${where}`}</span></span>
              <span class={'ow-b-replies-anschip t-' + tone}>{WORD[r.state]}</span>
            </button>
          );
        })}
      </div>
      <span class="ow-b-replies-anshint">Tap a supplier to see its orders</span>
    </section>
  );
}
