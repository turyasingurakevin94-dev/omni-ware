/*
 * Pack one order, line by line (store-agent PK02–PK07, PK11, PK12, PK15, PK16, PK18, PK19, PK21;
 * routes `pack/order { id, line? }`; spec §4.2). Looking is free: the first Packed claims the order
 * (W1). Red packs the whole line (W2), Short opens the count and Pack short sends the line short
 * (W2, Ruth settles it); the last line finishes the order onto its bay, held 10 s with Undo (W3).
 * No signal: the line is kept on this phone and so is the finish, behind it ("Back online to finish"):
 * the outbox sends both in order when the signal is back, and the order is packed. Every line answered
 * and the order not finished (a finish undone, refused or lost): Finish is the screen's one action.
 * Someone else took it first: back to To pack, "Someone else just did this · Refreshed".
 *
 * The screen keeps where it is in `mode`; the books say the rest. An order with nothing to pack
 * here opens as its own look: waiting on goods (Waits), someone else's (Look), packed (Packed).
 */
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { firstWord, orderNo } from '../../../core/names.ts';
import { bayFor } from '../../../core/store/bays.ts';
import { whoIs } from '../../../core/store/faces.ts';
import { keptPack } from '../../../core/store/outbox.ts';
import { currentLine, isLastOpen, progress, type LineMark } from '../../../core/store/pack.ts';
import type { PickAnswer } from '../../../core/store/source.ts';
import { isMine, isPickup, stageOf } from '../../../core/store/yard.ts';
import type { YardBooks } from '../../../core/store/types.ts';
import { clock, howLong } from '../../../core/time.ts';
import { FullSheet } from '../../../ui/FullSheet.tsx';
import { toast } from '../../../ui/toast.tsx';
import { nav } from '../shell/nav.ts';
import { act, books, hold, held, kept, me, notDone, now, undoHeld } from '../shell/store.ts';
import { PackHead } from './head.tsx';
import { toSheet } from './parts.tsx';
import { LineView, ShortView, SentView } from './LineCard.tsx';
import { Look } from './Look.tsx';
import { Packed, Unpacked } from './Packed.tsx';
import { Unpack } from './Unpack.tsx';
import { moved, chipPicked } from './sheet-data.ts';
import { Waits } from './Waits.tsx';
import './card.css';

type Mode =
  | { k: 'line' }
  | { k: 'short'; idx: number; n: number }
  | { k: 'sent'; idx: number; n: number; at: number }
  | { k: 'done'; bay: number | null; args: [number, number | null] | null }
  | { k: 'unpacked'; bay: number | null };

export type Busy = null | 'sending' | 'failed';

export function Pack(p: { id: number; line: number | null; unpack?: boolean }): JSX.Element {
  const b = books.value, o = b ? b.orders.find((x) => x.id === p.id) : null;
  const [mode, setMode] = useState<Mode>({ k: 'line' });
  const [busy, setBusy] = useState<Busy>(null);
  const [retry, setRetry] = useState<(() => void) | null>(null);
  const [want, setWant] = useState<number | null>(p.line);

  // A short sent on the last line: its Undo runs 10 s, then the order finishes (PK05 → PK06).
  useEffect(() => {
    if (mode.k !== 'sent') return undefined;
    const t = setTimeout(() => finish(), Math.max(0, mode.at + 10000 - Date.now()));
    return () => clearTimeout(t);
  }, [mode]);

  if (!b || !o) return <FullSheet onBack={toSheet} backLabel="Back to To pack" head={<div class="ow-shead" />} />;
  // From another order's bay tile (AD02): the order on its bay with the Unpack sheet, until the screen is left.
  if (p.unpack) return <Unpack o={o} />;
  const order = o, books_ = b;
  const stage = stageOf(o, b, me.value, now.value);
  if (mode.k === 'done' || mode.k === 'unpacked') {
    return mode.k === 'done'
      ? <Packed o={o} bay={mode.bay} held={!!held.value && mode.args != null} onUndo={undo} onBay={changeBay} />
      : <Unpacked o={o} bay={mode.bay} onAgain={() => finish(mode.bay)} />;
  }
  if (stage === 'waiting') return <Waits o={o} />;
  if (stage === 'packed' || stage === 'ready' || stage === 'road' || stage === 'delivered') return <Packed o={o} bay={o.bay} held={false} onUndo={undo} onBay={changeBay} />;
  if (stage === 'cancelled') { nav.replace('pack/put-back', { id: o.id }); return <></>; }
  if (stage === 'look' || (stage === 'packing' && !isMine(o, me.value))) return <Look id={o.id} />;

  const cur = currentLine(order, mode.k === 'line' ? want : mode.idx);
  const pr = progress(order);
  const since = order.workerAcceptedAt != null && isMine(order, me.value) ? `since ${clock(order.workerAcceptedAt)}` : `waiting ${howLong(order.stageEnteredAt ?? order.createdAt ?? now.value, now.value)}`;
  const taker = whoIs(b, order.takenBy), tName = taker ? firstWord(taker.name) : 'Sales';
  const kp = keptPack(kept.value, order.id), keptIdx = kp.lines;
  const marks: Record<number, LineMark> = {};
  keptIdx.forEach((i) => { marks[i] = 'now'; });

  /** The first Packed claims the order (W1); someone else first: back to To pack, refreshed. */
  async function claimed(): Promise<boolean> {
    if (isMine(order, me.value) && order.pickingStatus === 'in_progress') return true;
    try {
      await act('claim', order.id);
      return true;
    } catch (_e) {
      const n = notDone.value;
      setBusy(n && n.tone === 'failed' ? 'failed' : null);
      if (n && n.tone === 'someone') {
        const fresh = books.value && books.value.orders.find((x) => x.id === order.id);
        const who = fresh ? whoIs(books.value as YardBooks, fresh.assignedWorkerId) : null;
        moved.value = { id: order.id, by: who ? firstWord(who.name) : 'Someone' };
        chipPicked.value = null;
        toSheet();
      }
      return false;
    }
  }

  /** Send one line's answer (W2). The last one finishes the order. */
  async function send(a: PickAnswer, after: () => void): Promise<void> {
    setBusy('sending');
    setRetry(() => () => { notDone.value = null; void send(a, after); });
    if (!(await claimed())) return;
    const last = isLastOpen(order, a.idx);
    try {
      const r = await act('pick', order.id, [a], a.idx + 1);
      setBusy(null);
      // Kept: the finish is kept behind the last line, so the outbox finishes the order when the signal is back.
      if (r.kept) { if (last) void act('finishPack', ...finishArgs()).catch(() => undefined); else setWant(null); return; }
      notDone.value = null;
      setWant(null);
      if (last) after(); else setMode({ k: 'line' });
    } catch (_e) {
      const n = notDone.value;
      setBusy(n && n.tone === 'failed' ? 'failed' : null);
    }
  }

  return renderLine();

  function renderLine(): JSX.Element {
    const lineNow = cur && !keptIdx.includes(cur.idx) ? cur : cur;
    const sees = mode.k === 'sent' ? `${tName} sees: ${pr.short || 1} short · Ruth settles` : `${tName} sees: Packing · ${pr.done} of ${pr.of}`;
    const tone = mode.k === 'sent' ? 'amber' : keptIdx.length ? 'amber' : busy === 'failed' ? 'glass' : 'mint';
    const head = <PackHead b={books_} o={order} since={since} sees={sees} tone={tone} now={lineNow} marks={marks} onClose={toSheet} />;
    if (mode.k === 'short' && cur) {
      return (
        <FullSheet onBack={() => setMode({ k: 'line' })} backLabel="Back to the line" head={head} pad="14px 16px 16px">
          <ShortView b={books_} o={order} l={cur} n={mode.n} busy={busy} onN={(n) => setMode({ k: 'short', idx: cur.idx, n })}
            onSend={() => send({ idx: cur.idx, status: 'short', qty: mode.n }, () => { shortSent(cur.idx, mode.n); })}
            retry={retry} onClose={() => { setBusy(null); notDone.value = null; }} />
        </FullSheet>
      );
    }
    if (mode.k === 'sent') {
      const l = order.lines[mode.idx];
      return (
        <FullSheet onBack={toSheet} backLabel="Back to To pack" head={head} pad="14px 16px 16px">
          <SentView b={books_} o={order} l={l} n={mode.n} at={mode.at} taker={tName} onFinish={() => finish()} />
        </FullSheet>
      );
    }
    return (
      <FullSheet onBack={toSheet} backLabel="Back to To pack" head={head} pad="14px 16px 16px">
        <LineView b={books_} o={order} l={cur} busy={busy} kept={cur ? keptIdx.includes(cur.idx) : kp.finish} taker={tName} onFinish={() => finish()}
          onPacked={() => cur && send({ idx: cur.idx, status: 'done', qty: cur.qty }, () => finish())}
          onShort={() => cur && setMode({ k: 'short', idx: cur.idx, n: Math.max(0, cur.qty - 1) })}
          retry={retry} onClose={() => { setBusy(null); notDone.value = null; }} />
      </FullSheet>
    );
  }

  /** After a short on the last line: "Sent to Ruth · Grace told" with Undo (back to the count), then it finishes. */
  function shortSent(idx: number, n: number): void {
    setMode({ k: 'sent', idx, n, at: Date.now() });
    toast.show(`Sent to Ruth · ${tName} told`, { undo: () => setMode({ k: 'short', idx, n }) });
  }

  /** The order is packed onto its bay: held 10 s with Undo (W3, W3' for a pickup). */
  function finishArgs(bay?: number | null): [number, number | null] {
    const cur2 = books.value && books.value.orders.find((x) => x.id === order.id);
    return [order.id, cur2 && isPickup(cur2, books_.customers) ? null : bay !== undefined ? bay : bayFor(order, books_)];
  }

  function finish(bay?: number | null): void {
    const args = finishArgs(bay), pick = args[1];
    setMode({ k: 'done', bay: pick, args });
    hold(`Packed ${orderNo(order.id)}`, 'finishPack', args, () => setMode({ k: 'unpacked', bay: pick }));
    // The moment says it with its own Undo (PK06): no toast over it.
    toast.hide();
  }

  /** Undo on the moment: the pack never went (or, once it has, unpack it: W5). */
  function undo(): void {
    if (held.value) { undoHeld(); unpackedToast(mode.k === 'done' ? mode.bay : null); return; }
    void act('unpack', order.id).then(() => { setMode({ k: 'unpacked', bay: order.bay }); unpackedToast(order.bay); }).catch(() => undefined);
  }

  function unpackedToast(bay: number | null): void {
    toast.show(bay != null ? `Unpacked · bay ${bay} free` : 'Unpacked', { undo: () => finish(bay) });
  }

  /** Change the bay (W4): before the pack goes, the held write takes the new one. */
  function changeBay(n: number): void {
    if (mode.k === 'done' && mode.args && held.value) { mode.args[1] = n; setMode({ ...mode, bay: n }); return; }
    void act('setBay', order.id, n).catch(() => undefined);
    if (mode.k === 'done') setMode({ ...mode, bay: n });
  }
}
