/*
 * The customer sheet's cards (CU10, CU11, CU13): the bills (each with its
 * one act), the orders on the move, and their rhythm as day blocks.
 */
import type { JSX } from 'preact';
import { fig } from '../../../ui/Money.tsx';
import { Duo, Icon, phWhatsapp, STAGE_ICON, type IconName } from '../../../ui/icons.tsx';
import { Tap, cx } from '../../../ui/util.tsx';
import { orderTotal, short as shortMoney } from '../../../core/money.ts';
import { orderNo, STAGE_WORD, TINTS } from '../../../core/names.ts';
import { dayLabel, dayOf } from '../../../core/time.ts';
import type { Member, Order } from '../../../core/types.ts';
import type { Bill } from './data.ts';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** One bill: the day it was billed, what is left, its number and age, and its act (Take, or Being checked). */
export function BillRow(p: { b: Bill; onTake: () => void; onChecked?: () => void; sub?: string }): JSX.Element {
  const b = p.b, d = new Date(b.day + 'T00:00:00Z');
  const inner = (
    <>
      <span class="cu-bill-d"><span class="mono">{d.getUTCDate()}</span><span>{MONTHS[d.getUTCMonth()]}</span></span>
      <span class="cu-bill-t"><span class="mono">{fig(b.left)}</span><span class={cx(p.sub && 'info')}>{p.sub || `${orderNo(b.id)} · ${b.age} days`}</span></span>
      {b.checked
        ? <span class="cu-bill-act info"><Icon name="clock" size={14} stroke={2.2} />Being checked</span>
        : <span class="cu-bill-act"><Icon name="cash" size={14} stroke={2.2} />{`Take ${shortMoney(b.left)}`}</span>}
    </>
  );
  if (b.checked && !p.onChecked) return <div class="cu-bill">{inner}</div>;
  return <Tap on={b.checked ? p.onChecked : p.onTake} class="cu-bill" label={b.checked ? `${orderNo(b.id)}, ${fig(b.left)}, being checked` : `Take ${fig(b.left)} for ${orderNo(b.id)}`}>{inner}</Tap>;
}

export function BillsCard(p: { children: JSX.Element[] }): JSX.Element {
  return <div class="cu-bills">{p.children}</div>;
}

/** "Bills · oldest first" and what holds them: new credit waits for the Manager, or the books say 0. */
export function BillsHead(p: { title: string; hold?: string; note?: string }): JSX.Element {
  return (
    <div class="cu-bills-h">
      <span>{p.title}</span>
      {p.hold && <span class="bad"><Icon name="lock" size={12} stroke={2.2} />{p.hold}</span>}
      {p.note && <span class="info">{p.note}</span>}
    </div>
  );
}

/** "On the move 3 · 2,100,000": a tile per live order, the one packing lit. */
export function OnTheMove(p: { orders: Order[]; onOrder: (id: number) => void; copies?: number[]; onCopy?: (id: number) => void; late?: number[] }): JSX.Element {
  const sum = p.orders.reduce((s, o) => s + orderTotal(o), 0);
  return (
    <div class="cu-move">
      <span class="cu-move-h"><span>On the move <span class="mono">{p.orders.length}</span></span><b class="mono">{fig(sum)}</b></span>
      <div class="cu-move-tiles">
        {p.orders.slice(0, 3).map((o) => {
          // The copy of an order entered twice opens Entered twice? (OR19); a late one says so, with the late dot.
          const copy = !!p.copies && p.copies.includes(o.id), late = !!p.late && p.late.includes(o.id);
          const word = copy ? `Copy · ${STAGE_WORD[o.stage]}` : late ? `${STAGE_WORD[o.stage]} · 2+ days` : STAGE_WORD[o.stage];
          return (
            <Tap key={o.id} on={() => (copy && p.onCopy ? p.onCopy(o.id) : p.onOrder(o.id))} label={`Order ${orderNo(o.id)}, ${copy ? 'the copy, ' : ''}${STAGE_WORD[o.stage]}${late ? ', 2+ days: late' : ''}`}
              class={cx('cu-move-tile', o.stage === 'packing' && 'lit', late && 'late')}>
              <span><Icon name={STAGE_ICON[o.stage]} size={14} stroke={2} /><b class="mono">{orderNo(o.id)}</b></span>
              <span>{word}</span>
              {late && <span aria-hidden="true" class="cu-move-dot" />}
            </Tap>
          );
        })}
      </div>
    </div>
  );
}

/**
 * S08 as the customer sheet draws it: a block per day of their rhythm. Days gone are grey, days ahead
 * dashed, the ink bar where it runs out, and each day past it amber.
 */
export function Rhythm(p: { every: number; gone: number; late: number; pill: string; tone: 'neutral' | 'caution' | 'good'; label: string; labels: string[] | null }): JSX.Element {
  const gone = Math.min(p.every, p.gone), ahead = p.every - gone;
  return (
    <div class="cu-days">
      <div class="cu-days-h"><span>{`Orders every ${p.every} days`}</span><span class={'cu-days-pill ' + p.tone}>{p.pill}</span></div>
      <div role="img" aria-label={p.label} class="cu-days-strip">
        {Array.from({ length: gone }, (_, i) => <span key={'g' + i} />)}
        {Array.from({ length: ahead }, (_, i) => <span key={'a' + i} class="ahead" />)}
        <span class="due" />
        {Array.from({ length: p.late }, (_, i) => <span key={'l' + i} class="late" />)}
      </div>
      {p.labels && <div class="cu-days-l">{p.labels.map((l, i) => <span key={i} class={i === 2 && p.late ? 'late' : undefined}>{l}</span>)}</div>}
    </div>
  );
}

/**
 * LOCAL PART · P21's joined bar as the customer sheet draws it: the discs are the act's own soft and ink
 * (Take payment sand #FDEEE1 / #95530C, Promise info #E3EEFB / #1A5A8A, Statement good), icons 20.
 */
const ACT_TONE = { take: ['#FDEEE1', '#95530C'], promise: ['#E3EEFB', '#1A5A8A'], statement: ['#E4F4EA', '#0F6B43'] } as const;

export function Acts(p: { acts: { tone: keyof typeof ACT_TONE; icon: IconName; word: string; sub: string; on: () => void }[] }): JSX.Element {
  return (
    <div class="cu-acts">
      {p.acts.map((a) => (
        <Tap key={a.word} on={a.on} class="cu-act">
          <span aria-hidden="true" style={{ background: ACT_TONE[a.tone][0], color: ACT_TONE[a.tone][1] }}><Icon name={a.icon} size={20} stroke={2} /></span>
          <span>{a.word}</span><span>{a.sub}</span>
        </Tap>
      ))}
    </div>
  );
}

/** CU13 · who is on it: Esther checking (since when), and their chat while it waits. */
export function AsksCard(p: { checker: Member; askedAt: string; chat: { who: string; ago: string; text: string; on: () => void } | null; onEsther: (() => void) | null }): JSX.Element {
  const t = TINTS[p.checker.tint], name = p.checker.name.split(/\s+/)[0];
  return (
    <div class="cu-asks">
      <div class="cu-ask">
        <span aria-hidden="true" class="cu-ask-av" style={{ background: t.bg, color: t.fg }}>{p.checker.initials}</span>
        <span class="cu-ask-t"><span>{`${name} is checking`}</span><span>{p.askedAt}</span></span>
        <button type="button" class="cu-ask-b tile" aria-label={p.onEsther ? `Message ${name}` : `Message ${name}: they have no chat to put a note on`} disabled={!p.onEsther} onClick={p.onEsther || undefined}><Icon name="message" size={18} stroke={2} /></button>
      </div>
      {p.chat && (
        <div class="cu-ask">
          <span aria-hidden="true" class="cu-ask-sq"><Duo i={phWhatsapp} size={20} /></span>
          <span class="cu-ask-t"><span>{`${p.chat.who} asked `}<span>{`· ${p.chat.ago}`}</span></span><span class="q">{`“${p.chat.text}”`}</span></span>
          <button type="button" class="cu-ask-b" aria-label={`Reply to ${p.chat.who}`} onClick={p.chat.on}><Icon name="send" size={18} stroke={2} /></button>
        </div>
      )}
    </div>
  );
}

/** CU16 · Their last bills, paid: the day, the amount, the number, a Paid tick. Each opens its order. */
export function PaidBills(p: { orders: Order[]; onOrder: (id: number) => void }): JSX.Element {
  return (
    <>
      <BillsHead title="Last bills · paid" />
      <div class="cu-bills">
        {p.orders.map((o) => {
          const [, date, mon] = dayLabel(dayOf(o.invoicedAt || o.placedAt)).split(' ');
          return (
            <Tap key={o.id} on={() => p.onOrder(o.id)} class="cu-bill" label={`${orderNo(o.id)}, ${fig(orderTotal(o))}, paid`}>
              <span class="cu-bill-d"><span class="mono">{date}</span><span>{mon}</span></span>
              <span class="cu-bill-t"><span class="mono">{fig(orderTotal(o))}</span><span>{orderNo(o.id)}</span></span>
              <span class="cu-bill-act good"><Icon name="check" size={14} stroke={2.6} />Paid</span>
            </Tap>
          );
        })}
      </div>
    </>
  );
}

/** CU16 · Today's money first: what they paid today, and what came over the bills, which opens the paid-over sheet (OR15). */
export function TodayPaid(p: { rows: { id: number; amount: number; how: string; over: number; overSub: string; onOver: () => void }[] }): JSX.Element {
  return (
    <div class="cu-today">
      {p.rows.map((r) => [
        <div key={r.id} class="cu-today-r">
          <span aria-hidden="true" class="cu-today-i good"><Icon name="check" size={16} stroke={2.6} /></span>
          <span class="cu-today-t"><span>{'Paid '}<b class="mono">{fig(r.amount)}</b></span><span>{r.how}</span></span>
        </div>,
        r.over > 0 ? (
          <Tap key={`${r.id}-over`} on={r.onOver} class="cu-today-r" label={`${fig(r.over)} paid over: ${r.overSub}`}>
            <span aria-hidden="true" class="cu-today-i warn"><Icon name="cash" size={16} stroke={2.2} /></span>
            <span class="cu-today-t"><span><b class="mono warn">{fig(r.over)}</b>{' paid over'}</span><span>{r.overSub}</span></span>
            <span aria-hidden="true" class="cu-today-c"><Icon name="chevron-right" size={16} stroke={2.4} /></span>
          </Tap>
        ) : null,
      ])}
    </div>
  );
}
