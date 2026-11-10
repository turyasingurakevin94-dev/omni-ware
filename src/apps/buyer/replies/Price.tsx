/*
 * New price (board Replies, phone 2 and the Disabled state): one supplier's
 * asked lines, each with its old price and a mono number field. A line
 * typed over its selling price is marked "Ruth decides" with a bell: the
 * Manager decides it (docs/decision-rights.md). Save sends every line's
 * cost at once: act('answerPrice', supplierId, [{ orderId, key, cost }]).
 *
 *   nav.push('replies/price', { supplier: 's-namanve' })
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { replyRows, tiles, type LineRef } from '../../../core/buyer/rules.ts';
import type { PriceAnswer } from '../../../core/buyer/source.ts';
import type { BuyerBooks } from '../../../core/buyer/types.ts';
import { counted, orderNo } from '../../../core/names.ts';
import { clock } from '../../../core/time.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Button } from '../../../ui/Button.tsx';
import { FullSheet } from '../../../ui/FullSheet.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { fig } from '../../../ui/Money.tsx';
import { Callout } from '../../../ui/Notice.tsx';
import { toast } from '../../../ui/toast.tsx';
import { cx } from '../../../ui/util.tsx';
import type { Params } from '../shell/nav.ts';
import { nav } from '../shell/nav.ts';
import { act, books, now } from '../shell/store.ts';
import { decider, firstName, seller } from './rules.ts';
import { buyingNow, done } from './state.ts';
import './replies.css';

const id = (r: LineRef): string => `${r.order.id}:${r.line.key}`;
const digits = (s: string): string => s.replace(/\D/g, '').replace(/^0+/, '').slice(0, 9);

function Line(p: { b: BuyerBooks; r: LineRef; value: string; ruth: string; onInput: (v: string) => void; off: boolean }): JSX.Element {
  const { line: l, order: o } = p.r, m = seller(p.b, o);
  const cost = p.value ? Number(p.value) : null, changed = cost != null && cost !== l.cost, over = changed && (cost as number) > l.sell;
  const diff = changed ? (cost as number) - l.cost : 0;
  return (
    <div class={cx('ow-b-replies-pline', over && 'over')}>
      <div class="ow-b-replies-ptop">
        {m && <Avatar initials={m.initials} tint={m.tint} size={26} />}
        <span class="ow-b-replies-who"><b>{l.name}</b><span class="mono">{`${orderNo(o.id)} · ${l.qty} ${l.unit} · sells ${fig(l.sell)}`}</span></span>
        <span class={cx('mono', 'ow-b-replies-old', changed && 'struck')}>{fig(l.cost)}</span>
      </div>
      <div class="ow-b-replies-prow">
        <label class={cx('ow-b-replies-field', !p.value && 'empty')}>
          <input class="mono" type="text" inputMode="numeric" autocomplete="off" placeholder="—" disabled={p.off}
            aria-label={`New price for ${l.name}, ${orderNo(o.id)}`} value={p.value ? fig(Number(p.value)) : ''}
            onInput={(e) => p.onInput(digits((e.target as HTMLInputElement).value))} />
          <span>UGX</span>
        </label>
        {changed && <span class={cx('ow-b-replies-diff mono', diff < 0 && 'down')}>{fig(diff, false, true)}</span>}
      </div>
      {over && (
        <div class="ow-b-replies-ruth">
          <Icon name="bell" size={18} stroke={2} /><span>{`${p.ruth} decides`}</span>
          <span class="mono">{`${fig(cost as number)} › ${fig(l.sell)}`}</span>
        </div>
      )}
    </div>
  );
}

export function Price(p: { params: Params }): JSX.Element {
  const b = books.value, n = now.value, sid = String(p.params.supplier || '');
  const [vals, setVals] = useState<Record<string, string>>({});
  const [state, setState] = useState<'idle' | 'sending'>('idle');
  const [err, setErr] = useState<string | null>(null);
  const g = b ? replyRows(b, n).find((x) => x.supplier.id === sid) : undefined;
  if (!b || !g) {
    return (
      <FullSheet onBack={() => nav.back()} backLabel="Back to Replies" head={<span aria-hidden="true" class="ow-grab ow-b-replies-grab" />}>
        <div class="ow-b-replies-empty"><span>No lines waiting on this supplier</span></div>
      </FullSheet>
    );
  }
  const ruthM = decider(b), ruth = firstName(ruthM);
  const lines = g.lines;
  const costOf = (r: LineRef): number => (vals[id(r)] ? Number(vals[id(r)]) : r.line.cost);
  const changed = lines.filter((r) => costOf(r) !== r.line.cost);
  const over = changed.filter((r) => costOf(r) > r.line.sell);
  const was = lines.reduce((t, r) => t + r.line.cost * r.line.qty, 0);
  const total = lines.reduce((t, r) => t + costOf(r) * r.line.qty, 0);
  const sellers = [...new Map(g.orders.map((o) => [o.sellerId, o])).values()];
  const sending = state === 'sending';

  const save = async (): Promise<void> => {
    if (sending || !changed.length) return;
    const prices: PriceAnswer[] = lines.map((r) => ({ orderId: r.order.id, key: r.line.key, cost: costOf(r) }));
    const before = buyingNow(b), foundBefore = tiles(b, n).found;
    setState('sending'); setErr(null);
    try {
      const r = await act('answerPrice', sid, prices);
      if (r.kept) toast.show('Kept · sends when back', { kind: 'warn' });
      else {
        const after = buyingNow(books.value), ids = g.orders.map((o) => o.id);
        done.value = { supplierId: sid, supplier: g.supplier.name, at: now.value, lines: lines.length - over.length, priceUp: over.length, total, orderIds: ids, moved: ids.filter((x) => after.has(x) && !before.has(x)), foundBefore };
      }
      nav.back();
    } catch (e) {
      setErr(e instanceof Error && e.message ? e.message : 'Not saved');
      setState('idle');
    }
  };

  const head = (
    <div class="ow-b-replies-phead">
      <span aria-hidden="true" class="ow-grab ow-b-replies-grab" />
      <div class="ow-b-replies-top">
        <span class={'ow-b-replies-box ' + (changed.length ? 't-late' : 't-asked')}>
          <span class="mono">{changed.length || lines.length}</span><span>{changed.length ? 'Price up' : 'Asked'}</span>
        </span>
        <span class="ow-b-replies-who big"><b>{g.supplier.name}</b><span class="mono">{`Asked · ${g.askedAt ? clock(g.askedAt) : '—'} · ${counted(lines.length, 'line')}`}</span></span>
        <button type="button" class="ow-b-replies-x" aria-label="Close" onClick={() => nav.back()}><Icon name="close" size={18} stroke={2} /></button>
      </div>
    </div>
  );
  const foot = (
    <div class="ow-b-replies-pfoot">
      {err && <Callout tone="bad" icon="warning">{`Not saved · ${err}`}</Callout>}
      <Button state={sending ? 'sending' : changed.length ? 'idle' : 'disabled'} onClick={() => void save()}>
        {!changed.length ? 'Type the new price' : err ? 'Try again' : over.length ? `Save · ${ruth} decides` : 'Save'}
      </Button>
    </div>
  );
  return (
    <FullSheet onBack={() => nav.back()} backLabel="Back to Replies" head={head} foot={foot} pad="4px 16px 12px">
      {lines.map((r) => (
        <Line key={id(r)} b={b} r={r} ruth={ruth} off={sending} value={vals[id(r)] || ''}
          onInput={(v) => setVals((x) => ({ ...x, [id(r)]: v }))} />
      ))}
      {changed.length > 0 && (
        <div class="ow-b-replies-cost">
          <span>New cost</span>
          <span class={cx('mono', 'd', total < was && 'down')}>{fig(total - was, false, true)}</span>
          <b class="mono">{fig(total)} <span>UGX</span></b>
        </div>
      )}
      <div class="ow-b-replies-hears">
        {over.length > 0 && ruthM && (
          <div><Avatar initials={ruthM.initials} tint={ruthM.tint} size={26} /><b>{`${ruth} sees it`}</b><Icon name="bell" size={16} stroke={2} /></div>
        )}
        {sellers.map((o) => {
          const m = seller(b, o), up = over.some((r) => r.order.sellerId === o.sellerId);
          return (
            <div key={o.sellerId}>
              {m && <Avatar initials={m.initials} tint={m.tint} size={26} />}
              <span>{`${firstName(m)} sees: `}<b>{up ? `Price up · ${ruth} decides` : 'Found'}</b></span>
            </div>
          );
        })}
      </div>
    </FullSheet>
  );
}
