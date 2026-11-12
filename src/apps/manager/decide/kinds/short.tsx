/*
 * D-12 Packed short (DecideOrders p1): the line's sheets packed of those ordered, drawn as a
 * grid (the short ones dashed); what each answer bills. Bill what went (a tap) · Bill it all.
 * The pattern every kind follows: the evidence from the books by one rule, the words from
 * core/manager/words.ts, the answer through c.tap / c.slide.
 */
import type { JSX } from 'preact';
import { money } from '../../../../core/money.ts';
import type { MLine, ShortAsk } from '../../../../core/manager/types.ts';
import { ANSWER } from '../../../../core/manager/words.ts';
import type { Kind } from '../kit.ts';
import './short.css';

function Grid(p: { l: MLine }): JSX.Element {
  const went = p.l.packed ?? p.l.qty, n = Math.min(p.l.qty, 60);
  return (
    <span class="mg-sh-grid" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => <i key={i} class={i < Math.round((went / p.l.qty) * n) ? '' : 'short'} />)}
    </span>
  );
}

export const kind: Kind<ShortAsk> = (c) => {
  const o = c.b.orders.find((x) => x.id === c.a.orderId)!;
  const lines = o.lines.filter((l) => l.packed != null && l.packed < l.qty);
  const went = o.lines.reduce((s, l) => s + Math.round((l.price || 0) * (l.packed ?? l.qty)), 0);
  const all = o.total;
  const packer = c.asker ? c.asker.id : 'musa';
  return {
    evidence: (
      <>
        {lines.map((l) => (
          <div class="mg-card" key={l.idx}>
            <div class="mg-card-h"><b class="mg-sh-name">{l.name}</b><span class="mg-mono mg-soft">{`${money(l.price || 0)} a ${l.unit}`}</span></div>
            <div class="mg-sh-big"><b class="mg-mono">{l.packed}</b><span>{`of ${l.qty} ${l.unit} packed`}</span><span class="mg-pill warn">{`${l.qty - (l.packed || 0)} short`}</span></div>
            <Grid l={l} />
            <div class="mg-sh-row"><span>{ANSWER.billWent} <span class="mg-mono">{`${l.packed} × ${money(l.price || 0)}`}</span></span><b class="mg-mono">{money(went)}</b></div>
            <i class="mg-sh-bar"><i style={{ width: `${Math.round((went / all) * 100)}%` }} /></i>
            <div class="mg-sh-row soft"><span>{ANSWER.billAll} <span class="mg-mono">{`${l.qty} × ${money(l.price || 0)}`}</span></span><b class="mg-mono">{money(all)}</b></div>
            <i class="mg-sh-bar grey"><i style={{ width: '100%' }} /></i>
          </div>
        ))}
      </>
    ),
    dock: {
      told: [packer, o.sellerId || ''],
      word: ANSWER.billWent,
      primary: { tap: { label: `${ANSWER.billWent} · ${money(went)}`, on: () => c.tap(`${ANSWER.billWent} · ${money(went)}`, 'settlePick', [o.id, false]) } },
      secondary: { label: `${ANSWER.billAll} · ${money(all)}`, on: () => c.tap(`${ANSWER.billAll} · ${money(all)}`, 'settlePick', [o.id, true]) },
    },
  };
};
