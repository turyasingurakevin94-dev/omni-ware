/*
 * The answer just saved, on top of the list (board Replies, phone 4 and the
 * Success state). An order it moved to Buying gets the big card: the tick,
 * the order and its Buying pill, its lines found, the four tiles with "+1"
 * on Found, and "Grace sees: Buying". Otherwise the small row: "1 Found",
 * the supplier, when and what it costs, and what Sales sees.
 */
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { tiles } from '../../../core/buyer/rules.ts';
import type { BuyerBooks } from '../../../core/buyer/types.ts';
import { counted, orderNo } from '../../../core/names.ts';
import { clock } from '../../../core/time.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { SplitBar } from '../../../ui/Bar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { fig } from '../../../ui/Money.tsx';
import { toast } from '../../../ui/toast.tsx';
import { firstName, orderWord, seller } from './rules.ts';
import { act } from '../shell/store.ts';
import { done, type Done } from './state.ts';

const UNDO_S = 5;

/** "Undo · 5": counts down, then goes; a tap puts the supplier's lines back to Asked (source.undoAnswer). */
function Undo(p: { sid: string }): JSX.Element | null {
  const [left, setLeft] = useState(UNDO_S);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (left <= 0 || busy) return undefined;
    const t = window.setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(t);
  }, [left, busy]);
  if (left <= 0 && !busy) return null;
  const undo = async () => {
    setBusy(true);
    try { await act('undoAnswer', p.sid); done.value = null; toast.show('Undone · back to Asked'); }
    catch (e) { setBusy(false); toast.show('Not undone', { kind: 'error', sub: e instanceof Error ? e.message : '' }); }
  };
  return (
    <button type="button" class="ow-b-replies-undo" disabled={busy} aria-busy={busy || undefined} onClick={() => void undo()}>
      {busy ? <span class="ow-spin" aria-hidden="true" /> : <>Undo · <span class="mono">{left}</span></>}
    </button>
  );
}

function Sees(p: { b: BuyerBooks; ids: number[]; sid: string }): JSX.Element {
  const os = p.b.orders.filter((o) => p.ids.includes(o.id));
  const m = os.length ? seller(p.b, os[0]) : null;
  const word = os.length ? orderWord(os[0], p.b.trip).word : 'Found';
  return (
    <div class="ow-b-replies-dsees">
      {m && <Avatar initials={m.initials} tint={m.tint} size={26} />}
      <span>{`${firstName(m)} sees: `}<b>{word}</b></span>
      <Undo sid={p.sid} />
    </div>
  );
}

export function DoneCard(p: { b: BuyerBooks; d: Done; now: number }): JSX.Element {
  const { b, d } = p;
  const o = d.moved.length ? b.orders.find((x) => x.id === d.moved[0]) : null;
  if (!o) {
    const up = d.lines === 0 && !!d.priceUp;
    return (
      <div class="ow-b-replies-row" role="status">
        <div class="ow-b-replies-top">
          {up
            ? <span class="ow-b-replies-box t-late"><span class="mono">{d.priceUp}</span><span>Price up</span></span>
            : <span class="ow-b-replies-box t-good"><span class="mono">{d.lines}</span><span>Found</span></span>}
          <span class="ow-b-replies-who"><b>{d.supplier}</b><span class="mono">{`${up ? 'Price up' : 'Found'} · ${clock(d.at)} · ${fig(d.total)}`}</span></span>
        </div>
        <Sees b={b} ids={d.orderIds} sid={d.supplierId} />
      </div>
    );
  }
  const live = o.lines.filter((l) => !l.removed);
  const cost = live.reduce((t, l) => t + l.cost * l.qty, 0);
  const t = tiles(b, p.now), plus = t.found - d.foundBefore;
  const tile = (n: number, word: string, cls = ''): JSX.Element => (
    <span class={'ow-b-replies-tile ' + cls}>
      {cls === 'on' && plus > 0 && <span class="ow-b-replies-plus mono">{`+${plus}`}</span>}
      <span class="mono">{n}</span><span>{word}</span>
    </span>
  );
  return (
    <div class="ow-b-replies-done" role="status">
      <div class="ow-b-replies-dtop">
        <span class="ow-b-replies-tick"><Icon name="check" size={26} stroke={2.6} /></span>
        <span class="ow-b-replies-dwho">
          <span><b class="mono">{orderNo(o.id)}</b><span class="ow-b-replies-buying"><span />Buying</span></span>
          <span class="mono">{`${o.client} · Found · ${clock(d.at)}`}</span>
        </span>
      </div>
      <div class="ow-b-replies-dbar">
        <SplitBar parts={live.map(() => ({ value: 1, color: '#0F6B43' }))} h={6} label={`${live.length} of ${counted(live.length, 'line')} Found`} />
        <span class="mono"><span>{`${live.length} of ${counted(live.length, 'line')} Found`}</span><b>{fig(cost)} <span>UGX</span></b></span>
      </div>
      <div class="ow-b-replies-tiles">
        {tile(t.toask, 'To ask', 'dash')}
        {tile(t.asked, 'Asked')}
        {tile(t.found, 'Found', 'on')}
        {tile(t.ontrip, 'On the trip')}
      </div>
      <Sees b={b} ids={[o.id]} sid={d.supplierId} />
    </div>
  );
}
