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
export function OnTheMove(p: { orders: Order[]; onOrder: (id: number) => void }): JSX.Element {
  const sum = p.orders.reduce((s, o) => s + orderTotal(o), 0);
  return (
    <div class="cu-move">
      <span class="cu-move-h"><span>On the move <span class="mono">{p.orders.length}</span></span><b class="mono">{fig(sum)}</b></span>
      <div class="cu-move-tiles">
        {p.orders.slice(0, 3).map((o) => (
          <Tap key={o.id} on={() => p.onOrder(o.id)} label={`Order ${orderNo(o.id)}, ${STAGE_WORD[o.stage]}`} class={cx('cu-move-tile', o.stage === 'packing' && 'lit')}>
            <span><Icon name={STAGE_ICON[o.stage]} size={14} stroke={2} /><b class="mono">{orderNo(o.id)}</b></span>
            <span>{STAGE_WORD[o.stage]}</span>
          </Tap>
        ))}
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
export function AsksCard(p: { checker: Member; askedAt: string; chat: { who: string; ago: string; text: string; on: () => void } | null; onEsther: () => void }): JSX.Element {
  const t = TINTS[p.checker.tint], name = p.checker.name.split(/\s+/)[0];
  return (
    <div class="cu-asks">
      <div class="cu-ask">
        <span aria-hidden="true" class="cu-ask-av" style={{ background: t.bg, color: t.fg }}>{p.checker.initials}</span>
        <span class="cu-ask-t"><span>{`${name} is checking`}</span><span>{p.askedAt}</span></span>
        <button type="button" class="cu-ask-b tile" aria-label={`Message ${name}`} onClick={p.onEsther}><Icon name="message" size={18} stroke={2} /></button>
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
