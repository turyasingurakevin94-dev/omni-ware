/*
 * One supplier asked and not answered yet (board Replies, phone 1 and the
 * states row): the count and its word first, the name and when, then the
 * three answers: one navy "Yes · same", quieter "New price" and "No".
 * Late (over 30 min): the orders it holds, what Sales sees, and Ask again.
 *
 *   <ReplyRow g={g} now={n} lead busy={null} … />
 */
import type { JSX } from 'preact';
import type { SupplierGroup } from '../../../core/buyer/rules.ts';
import type { BuyerBooks } from '../../../core/buyer/types.ts';
import { clock } from '../../../core/time.ts';
import { counted, orderNo } from '../../../core/names.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { cx } from '../../../ui/util.tsx';
import { firstName, seller, waitWord } from './rules.ts';

export type Answer = 'yes' | 'price' | 'no';

export interface ReplyRowProps {
  b: BuyerBooks;
  g: SupplierGroup;
  now: number;
  /** The screen's one navy pill (the first row); the others are outlined. */
  lead: boolean;
  /** This row's answer on its way. */
  busy: Answer | null;
  /** Another row is sending: this one waits. */
  hold: boolean;
  /** The refused reason, with Try again. */
  error: string | null;
  /** Kept on the phone (no signal): the answer and when. */
  waiting: { word: string; at: number } | null;
  onAnswer: (a: Answer) => void;
  onRetry: () => void;
  onAskAgain: () => void;
}

function Box(p: { tone: 'asked' | 'late' | 'bad' | 'warn'; n?: string; word?: string; children?: JSX.Element }): JSX.Element {
  return (
    <span class={'ow-b-replies-box t-' + p.tone}>
      {p.children || <><span class="mono">{p.n}</span><span>{p.word}</span></>}
    </span>
  );
}

export function ReplyRow(p: ReplyRowProps): JSX.Element {
  const { g, b } = p;
  const lines = counted(g.lines.length, 'line');
  const name = g.supplier.name;
  if (p.waiting) {
    return (
      <div class="ow-b-replies-row">
        <div class="ow-b-replies-top">
          <Box tone="warn" n="1" word="Waiting" />
          <span class="ow-b-replies-who"><b>{name}</b><span class="mono">{`${p.waiting.word} · ${clock(p.waiting.at)}`}</span></span>
        </div>
      </div>
    );
  }
  const sellers = [...new Map(g.orders.map((o) => [o.sellerId, seller(b, o)])).values()].filter((m) => m != null);
  const sending = p.busy != null, off = sending || p.hold;
  const pill = (a: Answer, word: string, cls: string): JSX.Element => (
    <button type="button" class={cx('ow-b-replies-pill', cls, p.busy === a && 'busy')} disabled={off && p.busy !== a}
      aria-busy={p.busy === a || undefined} aria-label={`${word}: ${name}`}
      onClick={off ? undefined : () => (p.error && a === 'yes' ? p.onRetry() : p.onAnswer(a))}>
      {p.busy === a ? <><span class="ow-spin" aria-hidden="true" />Saving</> : word}
    </button>
  );
  const lead = p.error
    ? <button type="button" class="ow-b-replies-pill navy" disabled={off} onClick={p.onRetry}><Icon name="undo" size={15} stroke={2.2} />Try again</button>
    : pill('yes', 'Yes · same', p.lead ? 'navy' : 'ring');
  return (
    <div class="ow-b-replies-row">
      <div class="ow-b-replies-top">
        {p.error
          ? <Box tone="bad"><Icon name="warning" size={22} stroke={2} /></Box>
          : <Box tone={g.late ? 'late' : 'asked'} n={waitWord(g.askedAt, p.now)} word={g.late ? 'Late' : 'Asked'} />}
        <span class="ow-b-replies-who">
          <b>{name}</b>
          {p.error
            ? <span class="mono bad">{`Not saved · ${p.error}`}</span>
            : <span class="mono">{`Asked · ${g.askedAt ? clock(g.askedAt) : '—'} · ${lines}`}</span>}
        </span>
        {!g.late && !p.error && sellers.slice(0, 2).map((m) => <Avatar key={m.id} initials={m.initials} tint={m.tint} size={26} />)}
      </div>
      {g.late && !p.error && (
        <div class="ow-b-replies-late">
          {g.orders.slice(0, 2).map((o) => {
            const m = seller(b, o);
            return <span key={o.id} class="ow-b-replies-ochip">{m && <Avatar initials={m.initials} tint={m.tint} size={26} />}<span class="mono">{orderNo(o.id)}</span></span>;
          })}
          <span class="ow-b-replies-sees">{`${sellers.map(firstName).join(' · ') || 'Sales'} ${sellers.length > 1 ? 'see' : 'sees'}: `}<b>Asked</b></span>
          <button type="button" class="ow-b-replies-again" disabled={off} onClick={p.onAskAgain} aria-label={`Ask ${name} again`}>
            <Icon name="undo" size={15} stroke={2} />Ask again
          </button>
        </div>
      )}
      <div class="ow-b-replies-pills">
        {lead}
        {pill('price', 'New price', 'soft')}
        {pill('no', 'No', 'soft')}
      </div>
    </div>
  );
}
