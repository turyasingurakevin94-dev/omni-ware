/*
 * Today (board docs/canvas/buyer/Today.dc.html). One screen; the books decide what it shows:
 *
 *   to ask        Needs you: one row per supplier, every order together, the navy Ask pill
 *   asks out      Replies due: "Yes · same" on the row; late (30 min) → "Ask again"
 *   trip ready    every supplier asked and one said yes: Next move, the trip card (the red + starts it);
 *                 Found's tile waits on Denis (tripReady; while one is still to ask, the ask comes first)
 *   all clear     Nothing waits on you (after the hand-in: what the Store counts in), Waiting on others
 *   no signal     the hero says Offline; the band under it counts the taps kept on the phone
 *
 * Where the work came from (the seller's dot and #0550 on every row) and what Sales gets back
 * ("Grace sees  Found · 09:25") are on the screen.
 */
import type { JSX } from 'preact';
import { clock } from '../../../core/time.ts';
import { answeredRows, askGroups, lineRefs, replyRows } from '../../../core/buyer/rules.ts';
import { checking } from '../orders/rules.ts';
import type { BuyerBooks } from '../../../core/buyer/types.ts';
import { Icon } from '../../../ui/icons.tsx';
import { Notice } from '../../../ui/Notice.tsx';
import { Tap, cx } from '../../../ui/util.tsx';
import { nav } from '../shell/nav.ts';
import { books, flush, kept, now, online } from '../shell/store.ts';
import { AllClear, NextTrip, WaitingOn } from './Cards.tsx';
import { Head } from './Head.tsx';
import { AskRow, Chip, NotFoundRow, ReplyRow, Sees } from './Rows.tsx';
import { calm, sellersOf, tripReady, waitingOn } from './rules.ts';
import { MoveTiles } from './Tiles.tsx';
import './today.css';

/** Replies due rows drawn on Today; the rest are behind "N ›" (Replies). */
const REPLY_ROWS = 1;

function Sec(p: { title: string; dot?: 'on' | 'off'; meta?: string; go?: { n: number; on: () => void; label: string; word?: string } }): JSX.Element {
  return (
    <div class={cx('ow-b-today-sec', p.dot && 'dot')}>
      {p.dot && <i aria-hidden="true" class={cx('ow-b-today-sec-dot', p.dot === 'off' && 'off')} />}
      <h2>{p.title}</h2>
      {p.go ? <Tap on={p.go.on} label={p.go.label} class="mono ow-b-today-sec-go">{p.go.word && <span class="w">{`${p.go.word} `}</span>}{`${p.go.n} ›`}</Tap>
        : p.meta != null && <span class="mono">{p.meta}</span>}
    </div>
  );
}

/**
 * "Grace · Faith see  Found · 09:25  Asked · 09:05": the newest answer and the oldest ask Sales sees,
 * named for the sellers whose orders they are about (an order still to ask is not named: nothing went yet).
 */
function SalesSees(p: { b: BuyerBooks; now: number }): JSX.Element | null {
  const { b, now: n } = p, reps = replyRows(b, n);
  const found = answeredRows(b, n).find((g) => g.state === 'found');
  const who = sellersOf(b, [...new Set([...(found ? [found] : []), ...reps].flatMap((g) => g.orders))]);
  const asked = reps.reduce<number | null>((m, g) => (g.askedAt != null && (m == null || g.askedAt < m) ? g.askedAt : m), null);
  if (!who.length || (!found && asked == null)) return null;
  return (
    <Sees who={who}>
      {found && found.answeredAt != null && <Chip tone="good">Found · <span class="mono">{clock(found.answeredAt)}</span></Chip>}
      {asked != null && <Chip tone="warn">Asked · <span class="mono">{clock(asked)}</span></Chip>}
    </Sees>
  );
}

export function Today(): JSX.Element {
  const b = books.value, n = now.value, off = !online.value, k = kept.value.length;
  if (!b) return <main class="ow-b-today-wait-main" aria-busy="true" />;

  // Lines to fix, red, on no tile: Not found, and No supplier (BUY-2). Today counts suppliers only.
  const nf = lineRefs(b).filter((r) => r.state === 'notfound' || r.state === 'nosupplier');
  const inChecking = checking(b).length;
  const asks = askGroups(b, n), reps = replyRows(b, n);
  const ready = tripReady(b, n), quiet = calm(b, n);
  const waits = quiet ? waitingOn(b, n) : [];
  const late = reps.some((g) => g.late);

  return (
    <>
      <Head b={b} now={n} offline={off} />
      {(off || k > 0) && (
        <Notice kind="offline" action={k > 0 && !off ? { label: 'Try again', on: () => { void flush(); } } : undefined}>
          {off ? 'No signal' : ''}{off && k > 0 ? ' · ' : ''}
          {k > 0 && <><b class="mono">{k}</b>{` ${k === 1 ? 'tap waits' : 'taps wait'} to send`}</>}
        </Notice>
      )}
      <main class="ow-b-today-main">
        {/* The tiles count suppliers (BUY-2); the way into Orders is this labelled door, its number the list's (orders). */}
        {quiet && waits.length ? <Sec title="On the move" meta={`${waits.length} waiting`} />
          : <Sec title="On the move" go={{ n: inChecking, word: 'Checking', on: () => nav.push('orders'), label: `Checking: ${inChecking} ${inChecking === 1 ? 'order' : 'orders'}. Open Orders.` }} />}
        <MoveTiles b={b} now={n} />

        {quiet ? (
          <>
            <AllClear b={b} />
            {waits.length > 0 && <WaitingOn list={waits} />}
          </>
        ) : (
          <>
            {asks.length + nf.length > 0 ? (
              <>
                <span id="ow-b-needs" />
                <Sec title="Needs you" dot="on" />
                {nf.map((r) => <NotFoundRow key={`${r.order.id}-${r.line.key}`} b={b} r={r} />)}
                {asks.map((g) => <AskRow key={g.supplier.id} b={b} g={g} />)}
              </>
            ) : !ready && (
              <>
                <span id="ow-b-needs" />
                <Sec title="Needs you" dot="off" />
                <div class="ow-b-today-none"><Icon name="check" size={18} stroke={2.4} />Every supplier asked</div>
              </>
            )}
            {ready && <NextTrip b={b} />}
            {reps.length > 0 && (
              <>
                <Sec title="Replies due" dot={late ? 'on' : undefined}
                  go={{ n: reps.length, on: () => nav.push('replies'), label: `Replies due: ${reps.length}. Open Replies.` }} />
                {reps.slice(0, REPLY_ROWS).map((g) => <ReplyRow key={g.supplier.id} b={b} g={g} />)}
              </>
            )}
            {!ready && <SalesSees b={b} now={n} />}
          </>
        )}
      </main>
    </>
  );
}
