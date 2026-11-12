/*
 * Replies (board docs/canvas/buyer/Replies.dc.html, phone 1 and phone 4):
 * the navy head with "3 of 5 Found" and its bar, then "Waiting on a reply",
 * one row per supplier asked (rules.replyRows), the answered ones folded
 * into one line (rules.answeredRows), and what Sales sees. Opened from
 * Today's Asked tile.
 *
 *   Yes · same   act('answerYes', sid)                        one tap
 *   New price    nav.push('replies/price', { supplier })      Price.tsx
 *   No           act('answerNo', sid), then each line's Not found sheet (orders/NotFound.tsx)
 */
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { answeredRows, replyRows, tiles, type SupplierGroup } from '../../../core/buyer/rules.ts';
import type { BuyerBooks } from '../../../core/buyer/types.ts';
import { orderNo } from '../../../core/names.ts';
import { SplitBar } from '../../../ui/Bar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { Notice } from '../../../ui/Notice.tsx';
import { SectionHead } from '../../../ui/SectionHead.tsx';
import { sheet } from '../../../ui/sheet.tsx';
import { LoadingHead, SkeletonRows } from '../../../ui/Skeleton.tsx';
import { toast } from '../../../ui/toast.tsx';
import type { Kept } from '../../../core/outbox.ts';
import { openNotFound } from '../orders/NotFound.tsx';
import { nav, top } from '../shell/nav.ts';
import { act, books, discard, kept, now, online } from '../shell/store.ts';
import { Answered } from './Answered.tsx';
import { DoneCard } from './Done.tsx';
import { ReplyRow, type Answer } from './ReplyRow.tsx';
import { firstName, salesSees, seenOrders } from './rules.ts';
import { buyingNow, done, notFoundQueue } from './state.ts';
import './replies.css';

const KIND: Record<Exclude<Answer, 'price'>, 'answerYes' | 'answerNo'> = { yes: 'answerYes', no: 'answerNo' };
const KEPT_WORD: Record<string, string> = { answerYes: 'Yes · same', answerPrice: 'New price', answerNo: 'No' };

/** The answer for this supplier kept on the phone or refused, if any. */
function keptFor(list: Kept[], sid: string): Kept | null {
  return list.find((k) => k.kind in KEPT_WORD && Array.isArray(k.args) && k.args[0] === sid) || null;
}

const reason = (e: unknown): string => (e instanceof Error && e.message ? e.message : 'Not saved');

function Head(p: { b: BuyerBooks; now: number }): JSX.Element {
  const t = tiles(p.b, p.now), rest = Math.max(0, t.suppliers - t.found - t.asked - t.toask);
  return (
    <header class="ow-b-replies-head">
      <div class="ow-b-replies-hrow">
        <button type="button" class="ow-b-replies-back" aria-label="Back to Today" onClick={() => nav.back()}><Icon name="back" size={22} stroke={2} /></button>
        <h1>Replies</h1>
        <span class={'ow-b-replies-live' + (online.value && !kept.value.length ? '' : ' off')}><span />{!online.value ? 'Offline' : kept.value.length ? `${kept.value.length} waiting to send` : 'Live'}</span>
      </div>
      <div class="ow-b-replies-big"><span class="mono">{t.foundSuppliers}<span>{` of ${t.suppliers}`}</span></span><span>Found</span></div>
      <div class="ow-b-replies-hbar">
        <SplitBar h={6} label={`${t.found} Found, ${t.asked} Asked, ${t.toask} To ask`}
          parts={[{ value: t.found, color: '#6FDCB0' }, { value: t.asked, color: 'rgba(255,255,255,.55)' }, { value: t.toask + rest, color: 'rgba(255,255,255,.12)' }]} />
        <span aria-hidden="true" class="ow-b-replies-legend mono">
          <span><b class="mint">{t.found}</b> Found</span><span><b>{t.asked}</b> Asked</span>
          {t.toask > 0 && <span><b>{t.toask}</b> To ask</span>}
        </span>
      </div>
    </header>
  );
}

function SalesSees(p: { b: BuyerBooks; ids: number[] }): JSX.Element | null {
  const gs = salesSees(p.b, p.ids);
  if (!gs.length) return null;
  return (
    <div class="ow-b-replies-seesall">
      {gs.map((g) => (
        <div key={g.who ? g.who.id : 'sales'} class="ow-b-replies-seesline">
          <span class="w">{`${firstName(g.who)} sees`}</span>
          {g.orders.map((s) => (
            <span key={s.order.id} class="ow-b-replies-schip">
              {s.push && <Icon name="bell" size={12} stroke={2.2} />}<span class="mono">{orderNo(s.order.id)}</span>{s.word}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function Empty(p: { toask: number }): JSX.Element {
  return (
    <div class="ow-b-replies-empty">
      <span class="ow-b-replies-tick"><Icon name="check" size={28} stroke={2.4} /></span>
      <span>No replies to wait for</span>
      {p.toask > 0 && (
        <button type="button" class="ow-b-replies-toask" onClick={() => nav.push('orders', { filter: 'toask' })}>
          To ask<span class="mono">{p.toask}</span><Icon name="chevron-right" size={14} stroke={2.2} />
        </button>
      )}
    </div>
  );
}

export function Replies(): JSX.Element {
  const b = books.value, n = now.value;
  const [busy, setBusy] = useState<{ sid: string; a: Answer } | null>(null);
  const [errs, setErrs] = useState<Record<string, { msg: string; a: Answer } | null>>({});
  const queue = notFoundQueue.value, open = sheet.isOpen, onTop = top.value.id === 'replies';

  useEffect(() => () => { done.value = null; }, []);
  // After a "No": each line's Not found sheet, one at a time, while the list is on top.
  useEffect(() => {
    if (!queue.length || open || !onTop || busy) return;
    const [f, ...rest] = queue;
    notFoundQueue.value = rest;
    openNotFound(f.orderId, f.key);
  }, [queue, open, onTop, busy]);

  if (!b) return <main class="ow-b-replies"><LoadingHead text="Getting the replies" /><SkeletonRows rows={3} /></main>;

  const rows = replyRows(b, n), d = done.value, keptList = kept.value;

  const answer = async (g: SupplierGroup, a: Answer): Promise<void> => {
    const sid = g.supplier.id;
    if (a === 'price') { nav.push('replies/price', { supplier: sid }); return; }
    if (busy) return;
    const before = buyingNow(books.value), foundBefore = tiles(b, n).found;
    const lines = g.lines.map((r) => ({ orderId: r.order.id, key: r.line.key }));
    setBusy({ sid, a }); setErrs((e) => ({ ...e, [sid]: null }));
    try {
      const r = await act(KIND[a], sid);
      if (r.kept) { toast.show('Kept · sends when back', { kind: 'warn' }); return; }
      if (a === 'yes') {
        const after = buyingNow(books.value), ids = g.orders.map((o) => o.id);
        done.value = {
          supplierId: sid, supplier: g.supplier.name, at: now.value, lines: g.lines.length, total: g.total,
          orderIds: ids, moved: ids.filter((id) => after.has(id) && !before.has(id)), foundBefore,
        };
      } else {
        done.value = null;
        notFoundQueue.value = [...notFoundQueue.value, ...lines];
      }
    } catch (e) {
      setErrs((x) => ({ ...x, [sid]: { msg: reason(e), a } }));
    } finally {
      setBusy(null);
    }
  };

  const askAgain = async (g: SupplierGroup): Promise<void> => {
    if (busy) return;
    try {
      const r = await act('ask', g.supplier.id, g.orders.map((o) => o.confirms[g.supplier.id]?.how).find(Boolean) || 'whatsapp');
      toast.show(r.kept ? 'Kept · sends when back' : `Asked ${g.supplier.name} again`, { kind: r.kept ? 'warn' : 'ok' });
    } catch (e) { toast.show('Not saved', { kind: 'error', sub: reason(e), retry: () => void askAgain(g) }); }
  };

  const retryKept = async (k: Kept): Promise<void> => {
    await discard(k.id);
    try { await act(k.kind as 'answerYes', ...(k.args as unknown[])); } catch (e) { toast.show('Not saved', { kind: 'error', sub: reason(e) }); }
  };

  const waiting = keptList.filter((k) => k.kind in KEPT_WORD && k.state !== 'refused');
  const offline = !online.value || waiting.length > 0;
  const ids = seenOrders(b, [...answeredRows(b, n).flatMap((g) => g.orders.map((o) => o.id)), ...(d ? d.moved : [])]);
  const t = tiles(b, n);

  return (
    <main class="ow-b-replies">
      <Head b={b} now={n} />
      {offline && <Notice kind="offline" class="ow-b-replies-notice">Offline · sends when back</Notice>}
      <div class="ow-b-replies-body">
        {d && <DoneCard b={b} d={d} now={n} />}
        {rows.length > 0 && <SectionHead title="Waiting on a reply" dot count={rows.length} />}
        {rows.map((g, i) => {
          const k = keptFor(keptList, g.supplier.id), err = errs[g.supplier.id];
          const refused = k && k.state === 'refused' ? k : null;
          return (
            <ReplyRow key={g.supplier.id} b={b} g={g} now={n} lead={i === 0}
              busy={busy && busy.sid === g.supplier.id ? busy.a : null} hold={!!busy && busy.sid !== g.supplier.id}
              error={refused ? refused.reason || 'Not saved' : err ? err.msg : null}
              waiting={k && !refused ? { word: KEPT_WORD[k.kind], at: k.at } : null}
              onAnswer={(a) => void answer(g, a)}
              onRetry={() => (refused ? void retryKept(refused) : void answer(g, err ? err.a : 'yes'))}
              onAskAgain={() => void askAgain(g)} />
          );
        })}
        {rows.length === 0 && !d && <Empty toask={t.toask} />}
        <Answered b={b} now={n} />
        <SalesSees b={b} ids={ids} />
      </div>
    </main>
  );
}
