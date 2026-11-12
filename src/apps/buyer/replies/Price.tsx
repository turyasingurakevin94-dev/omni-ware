/*
 * New price (board Replies, phone 2; Buyer round 1 board R1NewPrice): one
 * supplier's lines, each with the list price and a mono number field. It
 * opens at once with the first field focused (BUY-06: no write before Save);
 * the head keeps its word (Asked) until the save lands. A line typed over its
 * selling price is marked "Ruth decides" (the Manager decides it,
 * docs/decision-rights.md); a price more than 50% from the list says "Far
 * from the list (24,000) · check it" and the button becomes "Save anyway"
 * (BUY-07: nothing blocked). Save sends every line's cost at once:
 * act('answerPrice', supplierId, [{ orderId, key, cost }]); a supplier not
 * asked yet (from Today's Ask sheet) is asked in the same Save.
 *
 * Only the cost changes here: what the client pays (sellPrice) is Sales' and
 * the Manager's (BUY-02).
 *
 *   nav.push('replies/price', { supplier: 's-namanve' })
 */
import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { askGroups, farFromList, replyRows, tiles, WORD, type LineRef } from '../../../core/buyer/rules.ts';
import type { PriceAnswer } from '../../../core/buyer/source.ts';
import type { BuyerBooks } from '../../../core/buyer/types.ts';
import { counted, orderNo } from '../../../core/names.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Button } from '../../../ui/Button.tsx';
import { FullSheet } from '../../../ui/FullSheet.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { fig } from '../../../ui/Money.tsx';
import { Callout, Notice } from '../../../ui/Notice.tsx';
import { toast } from '../../../ui/toast.tsx';
import { cx } from '../../../ui/util.tsx';
import { SeesCard } from '../orders/parts.tsx';
import { hm, listPrice, overSell, priceComing } from '../orders/rules.ts';
import type { Params } from '../shell/nav.ts';
import { nav } from '../shell/nav.ts';
import { act, books, now, online } from '../shell/store.ts';
import { decider, firstName, seesWord, seller } from './rules.ts';
import { buyingNow, done } from './state.ts';
import './replies.css';

const id = (r: LineRef): string => `${r.order.id}:${r.line.key}`;
const digits = (s: string): string => s.replace(/\D/g, '').replace(/^0+/, '').slice(0, 9);

function Line(p: { b: BuyerBooks; r: LineRef; sid: string; value: string; ruth: string; onInput: (v: string) => void; off: boolean; focus: boolean }): JSX.Element {
  const { line: l, order: o } = p.r, m = seller(p.b, o);
  const field = useRef<HTMLInputElement>(null);
  // BUY-06: the field is ready at once, focused, the keyboard up.
  useEffect(() => { if (p.focus && field.current) field.current.focus(); }, []);
  const list = listPrice(p.b, l, p.sid);
  const cost = p.value ? Number(p.value) : null, changed = cost != null && cost !== l.cost, over = changed && overSell(l, cost as number);
  const far = cost != null && !!list && farFromList(cost, list.price);
  const diff = changed ? (cost as number) - l.cost : 0;
  // BUY-08: a line with no selling price never reads "sells 0".
  const sells = priceComing(l) ? 'Price coming' : `sells ${fig(l.sell)}`;
  return (
    <div class={cx('ow-b-replies-pline', (over || far) && 'over')}>
      <div class="ow-b-replies-ptop">
        {m && <Avatar initials={m.initials} tint={m.tint} size={26} />}
        <span class="ow-b-replies-who"><b>{l.name}</b><span class="mono">{`${orderNo(o.id)} · ${l.qty} ${l.unit} · ${sells}`}</span></span>
        <span class="ow-b-replies-list"><span>{list ? 'List' : 'Cost'}</span><span class="mono">{fig(list ? list.price : l.cost)}</span></span>
      </div>
      <div class="ow-b-replies-prow">
        <label class={cx('ow-b-replies-field', !p.value && 'empty', p.value.length > 6 && 'long')}>
          <input ref={field} class="mono" type="text" inputMode="numeric" autocomplete="off" placeholder="their price" disabled={p.off}
            aria-label={`New price for ${l.name}, ${orderNo(o.id)}`} value={p.value ? fig(Number(p.value)) : ''}
            onInput={(e) => p.onInput(digits((e.target as HTMLInputElement).value))} />
          <span>UGX</span>
        </label>
        {changed && <span class={cx('ow-b-replies-diff mono', diff < 0 && !far && 'down')}>{fig(diff, false, true)}</span>}
      </div>
      {far && list && (
        <Callout tone="warn" icon="warning">Far from the list (<span class="mono">{fig(list.price)}</span>) · check it</Callout>
      )}
      {over && !far && (
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
  // Asked and waiting (Replies), or not asked yet (Today's Ask sheet, BUY-06: the ask goes with the price on Save).
  const g = b ? replyRows(b, n).find((x) => x.supplier.id === sid) || askGroups(b, n).find((x) => x.supplier.id === sid) : undefined;
  if (!b || !g) {
    return (
      <FullSheet onBack={() => nav.back()} backLabel="Back to Replies" head={<span aria-hidden="true" class="ow-grab ow-b-replies-grab" />}>
        <div class="ow-b-replies-empty"><span>No lines waiting on this supplier</span></div>
      </FullSheet>
    );
  }
  const ruth = firstName(decider(b));
  const lines = g.lines, asked = g.askedAt != null;
  const costOf = (r: LineRef): number => (vals[id(r)] ? Number(vals[id(r)]) : r.line.cost);
  const changed = lines.filter((r) => costOf(r) !== r.line.cost);
  const over = changed.filter((r) => overSell(r.line, costOf(r)));
  const far = lines.filter((r) => { const lp = listPrice(b, r.line, sid); return !!vals[id(r)] && !!lp && farFromList(costOf(r), lp.price); });
  const total = lines.reduce((t, r) => t + costOf(r) * r.line.qty, 0);
  const sending = state === 'sending', off = !online.value;
  // BUY-06: the head keeps the word it has (Asked) until the save lands; nothing flips early.
  const word = asked ? WORD.asked : WORD.toask;

  const save = async (): Promise<void> => {
    if (sending || !changed.length) return;
    const prices: PriceAnswer[] = lines.map((r) => ({ orderId: r.order.id, key: r.line.key, cost: costOf(r) }));
    const before = buyingNow(b), foundBefore = tiles(b, n).found;
    setState('sending'); setErr(null);
    try {
      const a = asked ? null : await act('ask', sid, 'call');
      const r = await act('answerPrice', sid, prices);
      if (r.kept || (a && a.kept)) toast.show('Kept · sends when back', { kind: 'warn' });
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

  const tail = sending ? 'Sending…' : off ? 'waits to send' : counted(lines.length, 'line');
  const head = (
    <div class="ow-b-replies-phead">
      <span aria-hidden="true" class="ow-grab ow-b-replies-grab" />
      <div class="ow-b-replies-top">
        <span class="ow-b-replies-box t-asked">
          <span class="mono">{g.askedAt ? hm(g.askedAt) : '—'}</span><span>{word}</span>
        </span>
        <span class="ow-b-replies-who big"><b>{g.supplier.name}</b><span class="mono">{`${word} · ${g.askedAt ? hm(g.askedAt) : '—'} · ${tail}`}</span></span>
        <button type="button" class="ow-b-replies-x" aria-label="Close" onClick={() => nav.back()}><Icon name="close" size={18} stroke={2} /></button>
      </div>
    </div>
  );
  const first = changed[0];
  const foot = (
    <div class="ow-b-replies-pfoot">
      {err && <Callout tone="bad" icon="warning"><b>Not saved</b>{first ? <> · <span class="mono">{`${fig(costOf(first))} · ${first.line.name}`}</span></> : ` · ${err}`}</Callout>}
      <Button state={sending ? 'sending' : changed.length ? 'idle' : 'disabled'} onClick={() => void save()}>
        {!changed.length ? 'Type their price' : err ? 'Try again' : far.length ? 'Save anyway' : over.length ? `Save · ${ruth} decides` : 'Save'}
      </Button>
    </div>
  );
  return (
    <FullSheet onBack={() => nav.back()} backLabel="Back to Replies" head={head} foot={foot} pad="4px 16px 12px">
      {off && <Notice kind="offline">Offline · sends when back</Notice>}
      {lines.map((r, i) => (
        <Line key={id(r)} b={b} r={r} sid={sid} ruth={ruth} off={sending} focus={i === 0} value={vals[id(r)] || ''}
          onInput={(v) => setVals((x) => ({ ...x, [id(r)]: v }))} />
      ))}
      {/* What each salesperson sees now: the word changes only once the save lands (BUY-04 · BUY-06). */}
      {g.orders.map((o) => {
        const s = seesWord(b, o);
        return <SeesCard key={o.id} solid who={seller(b, o)} word={s.word}
          tail={g.orders.length > 1 ? <span class="mono">{orderNo(o.id)}</span> : undefined} />;
      })}
    </FullSheet>
  );
}
