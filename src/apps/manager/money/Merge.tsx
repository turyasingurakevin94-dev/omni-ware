/*
 * Look alike (route `money/merge` { keep, drop }, Added2 p2, AD04, D-26): the phone (or name) they
 * share, the two records side by side, tick the one kept; after: one record with both's orders and
 * what both owe. The slide "Merge into Ggaba Stores" (grey "Pick the one to keep" until one is
 * ticked; no signal: it waits, a slide never queues) goes at once and in the owner's log.
 * "Not the same" is a tap held 10 s with Undo; then the look alike goes away.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { money } from '../../../core/money.ts';
import { mergeAfter } from '../../../core/manager/money.ts';
import type { Cust } from '../../../core/manager/types.ts';
import { Icon } from '../../../ui/icons.tsx';
import type { Params } from '../../../ui/stack.ts';
import { toast } from '../../../ui/toast.tsx';
import { cx } from '../../../ui/util.tsx';
import { nav, top, under } from '../shell/nav.ts';
import { act, answer, books, online } from '../shell/store.ts';
import { Dot, HeldStrip, MoneyDock, MoneySheet, sellersOf } from './parts.tsx';
import './sheets.css';

const orders = (n: number) => (n === 1 ? '1 order' : `${n} orders`);

function Card(p: { c: Cust; on: boolean; kept: boolean | null; go: () => void }): JSX.Element {
  const b = books.value!, s = sellersOf(b, p.c)[0];
  return (
    <button type="button" class="mg-mo-mrec" aria-pressed={p.on} aria-label={`Keep ${p.c.name}`} onClick={p.go}>
      <span class="h"><span class={cx('mg-mo-tick big', p.on && 'on')}>{p.on && <Icon name="check" size={14} stroke={3} />}</span><b>{p.c.name}</b></span>
      <span class="rows">
        <span><span class="mono k">orders</span><b class="mono">{p.c.orders}</b></span>
        <span><span class="mono k">owes</span><b class="mono">{money(Math.max(0, p.c.owes))}</b></span>
      </span>
      {s && <span class="who"><Dot who={s} />{p.on ? `${s.name.split(' ')[0]} sells here` : `${s.name.split(' ')[0]} · ${orders(p.c.orders)}`}</span>}
      {p.kept != null && <span class={cx('mg-mo-chip', p.kept && 'navy')}>{p.kept ? 'Kept' : 'Merged in'}</span>}
    </button>
  );
}

export function MergeSheet(p: { params: Params }): JSX.Element | null {
  const b = books.value;
  const [keep, setKeep] = useState<string | null>((p.params.keep as string) || null);
  const [error, setError] = useState(false);
  const [notSame, setNotSame] = useState(false);
  if (!b) return null;
  const a = b.customers.find((x) => x.id === p.params.keep), z = b.customers.find((x) => x.id === p.params.drop);
  if (!a || !z) return null;
  const k = keep === a.id ? a : keep === z.id ? z : null, d = k ? (k === a ? z : a) : null;
  const after = k && d ? mergeAfter(k, d) : null;
  const me = top.value.key;
  const merge = async () => {
    if (!k || !d || !after) return;
    setError(false);
    try {
      await act('merge', k.id, d.id);
      // The page under shows the record that went: the kept one takes its place.
      if (top.peek().key === me) { if (under.peek().params.customer === d.id) nav.replace('money/customer', { customer: k.id }); else nav.back(); }
      toast.show(`Merged · ${k.name}`, { sub: `${orders(after.orders)} · ${money(after.owes)}` });
    } catch (_e) { setError(true); }
  };
  const apart = () => {
    setNotSame(true);
    answer(null, 'Not the same', 'notSame', [a.id, z.id], {
      quiet: true, undo: () => setNotSame(false),
      then: (r) => { if (r && top.peek().key === me) nav.back(); else if (!r) setNotSame(false); },
    });
  };
  const blocks = after ? Math.min(after.orders, 24) : 0, keepN = k ? Math.round((k.orders / Math.max(1, after!.orders)) * blocks) : 0;
  return (
    <MoneySheet label="Look alike" top={96}
      head={<div class="mg-mo-sh"><span class="mg-mo-sh-i amber"><Icon name="link" size={20} stroke={2} /></span><span class="mg-mo-sh-t"><b>Look alike</b><span>2 customers look alike</span></span></div>}
      dock={notSame
        ? <MoneyDock strip={<HeldStrip word="Not the same" sub={`${a.name} · ${z.name}`} />} />
        : <MoneyDock log error={error ? 'Not merged · Try again' : null}
          slide={{ label: k ? `Merge into ${k.name}` : 'Pick the one to keep', sending: 'Merging', on: merge, lock: k ? undefined : 'Pick the one to keep', offline: !online.value }}
          second={{ label: 'Not the same', on: apart, label2: 'Not the same: keep both records, the look alike goes away' }} />}>
      <div class="mg-mo-card mg-mo-same">
        <span class="mg-mo-sh-i amber"><Icon name={a.lookAlike && a.lookAlike.why === 'name' ? 'person' : 'phone'} size={18} stroke={2} /></span>
        <span class="n">{a.lookAlike && a.lookAlike.why === 'name' ? <b>{a.name}</b> : <b class="mono">{a.phone}</b>}<span>on both</span></span>
        <span class="mg-mo-chip warn">{a.lookAlike && a.lookAlike.why === 'name' ? 'Same name' : 'Same phone'}</span>
      </div>
      <div class="mg-mo-pair">
        {[a, z].map((c) => <Card key={c.id} c={c} on={keep === c.id} kept={k ? k === c : null} go={() => setKeep(keep === c.id ? null : c.id)} />)}
      </div>
      {k && d && after && (
        <div class="mg-mo-card mg-mo-after">
          <div class="h"><span>{`After · ${k.name}`}</span><b class="mono">{money(after.owes)}</b></div>
          <div class="blocks" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${Math.max(1, blocks)}, 1fr)` }}>
            {Array.from({ length: blocks }, (_, i) => <i key={i} class={i < keepN ? '' : 'in'} />)}
          </div>
          <div class="k mono"><span>{`${k.orders} + ${d.orders} = ${orders(after.orders)}`}</span><span>{`owes ${money(Math.max(0, k.owes))} + ${money(Math.max(0, d.owes))}`}</span></div>
        </div>
      )}
    </MoneySheet>
  );
}
