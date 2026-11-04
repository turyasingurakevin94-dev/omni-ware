/*
 * S09 · A stage group in Orders (LANGUAGE.md §5.2 S09; as built: OR01).
 * The group is the stage, so its rows carry no stage dots. The header (a
 * 10 px stage dot, the stage, the count, the sum); each row 62 tall: the
 * avatar, the name, the order number with one status line (who decides,
 * with their face; Not paid yet; Cancel asked), the amount, and at the
 * right the time placed with a chevron, or the one act ("Take 1.1M").
 *
 *   <StageGroup stage="checking" count={3} sum={542000}>
 *     <OrderRow face={…} name="Kato Construction" no="#0553" status={{ face: { initials: 'RN', tint: 't2' }, text: 'Ruth decides' }} amount={170000} time="10:16" on={…} />
 *     <OrderRow face={…} name="Mukono Roofing" no="#0551" status={{ text: 'Not paid yet', tone: 'warn' }} amount={320000}
 *       act={{ word: 'Take', amount: '1.1M', label: 'Take payment from Mukono Roofing, 1,100,000', on: … }} on={…} />
 *   </StageGroup>
 *   status={{ text: '2 not found', tone: 'bad', chip: { text: '6 days', tone: 'warn' } }}  act={{ word: 'Tell', duo: phWhatsapp, tone: 'good', … }}
 *   status={{ text: '1 of 2 came', tone: 'good', bar: { done: 1, of: 2 } }}   status={{ text: 'Paid', tone: 'good', tick: true }}
 *   <ShowMore faces={[…]} n={2} on={…} />   the foot of a folded group
 *   <CustOrderRow aisle="roofing" title="Placed Mon 9:14" sub="#0545 · Iron sheet" amount={…} pill={{ text: 'Buying', tone: 'info' }} on={…} />
 */
import type { ComponentChildren, JSX } from 'preact';
import { STAGE_WORD } from '../core/names.ts';
import type { Stage } from '../core/types.ts';
import { Avatar, type Face } from './Avatar.tsx';
import { Chevron, GroupCard } from './ActRow.tsx';
import { Icon, type IconName } from './icons.tsx';
import { ItemSquare } from './ItemSquare.tsx';
import { fig } from './Money.tsx';
import { ActionPill } from './Pill.tsx';
import { GroupHead } from './SectionHead.tsx';
import { cx, type Fig } from './util.tsx';
import './stagegroup.css';

/** Each stage's dot (S05): identity, always with its word. */
export const STAGE_DOT: Record<Stage, string> = { checking: '#F5B26B', buying: '#9DB7E0', packing: '#7FA2D6', road: '#6FDCB0', delivered: '#C9C4BA' };

export function StageGroup(p: { stage: Stage; count: number; sum: Fig; children: ComponentChildren }): JSX.Element {
  return (
    <div class="ow-sgroup">
      <GroupHead dot={STAGE_DOT[p.stage]} title={STAGE_WORD[p.stage]} count={p.count} sum={p.sum} />
      <GroupCard>{p.children}</GroupCard>
    </div>
  );
}

export type RowTone = 'info' | 'warn' | 'bad' | 'good';

/**
 * The one status of a row: who decides (their face, info blue), or words in a tone (warn: Not paid yet).
 * chip: a small mono chip before the words ("6 days", "2+ days"); bar: the lines that came (Buying, "1 of 2 came"); tick: Paid.
 */
export interface RowStatus {
  text?: string;
  face?: Face;
  tone?: RowTone;
  chip?: { text: string; tone: 'warn' | 'bad' };
  bar?: { done: number; of: number };
  tick?: boolean;
}

export interface OrderRowProps {
  face: Face;
  name: string;
  /** "#0553". */
  no: string;
  status?: RowStatus;
  amount: Fig;
  /** When it was placed ("10:16"); with no act. */
  time?: string;
  /** The one act on the row (it replaces the time and chevron); duo: an icon before the word (Tell, the WhatsApp disc). */
  act?: { word: string; amount?: Fig; duo?: string; label: string; on: () => void; tone?: 'warn' | 'good' | 'info' | 'bad' };
  on: () => void;
}

function Status(p: { s: RowStatus }): JSX.Element {
  const s = p.s, tone = s.tone || (s.face ? 'info' : 'warn');
  const words = s.text ? <span class={cx('ow-orow-w', tone)}>{s.text}</span> : null;
  return (
    <>
      {s.chip && <span class={cx('mono ow-orow-chip', s.chip.tone)}>{s.chip.text}</span>}
      {s.bar
        ? <span class="ow-orow-st bar"><span aria-hidden="true" class="ow-orow-bar">{Array.from({ length: s.bar.of }, (_, i) => <span key={i} class={i < (s.bar as { done: number }).done ? 'on' : ''} />)}</span>{words}</span>
        : s.face || s.tick
          ? <span class={cx('ow-orow-st', s.tick && 'tick')}>{s.face && <Avatar {...s.face} size={18} />}{s.tick && <Icon name="check" size={11} stroke={3.2} />}{words}</span>
          : words}
    </>
  );
}

export function OrderRow(p: OrderRowProps): JSX.Element {
  const st = p.status;
  const left = (
    <>
      <Avatar {...p.face} size={40} />
      <span class="ow-orow-t">
        <span class="ow-orow-n">{p.name}</span>
        <span class="mono ow-orow-l">{p.no}{st && (st.text || st.chip) && <><span aria-hidden="true">·</span><Status s={st} /></>}</span>
      </span>
    </>
  );
  if (p.act) {
    const a = p.act;
    return (
      <div class="ow-orow">
        <button type="button" class="ow-orow-main" onClick={p.on}>{left}</button>
        <div class="ow-orow-r act">
          <span class="mono ow-orow-a">{fig(p.amount)}</span>
          <button type="button" class="ow-orow-act" aria-label={a.label} onClick={a.on}><ActionPill tone={a.tone || 'warn'} word={a.word} amount={a.amount} duo={a.duo} h={30} /></button>
        </div>
      </div>
    );
  }
  return (
    <div class="ow-orow">
      <button type="button" class="ow-orow-main" onClick={p.on}>
        {left}
        <span class="ow-orow-r"><span class="mono ow-orow-a">{fig(p.amount)}</span>{p.time && <span class="mono ow-orow-time">{p.time}</span>}</span>
        <Chevron />
      </button>
    </div>
  );
}

/** The foot of a folded group (OR01, OR02): the faces of what is folded, "Show 2 more", a chevron down. */
export function ShowMore(p: { faces: Face[]; n: number; on: () => void }): JSX.Element {
  return (
    <button type="button" class="ow-more" onClick={p.on}>
      {p.faces.length > 0 && <span aria-hidden="true" class="ow-more-f">{p.faces.map((f, i) => <Avatar key={i} {...f} size={24} class="ow-more-a" />)}</span>}
      {`Show ${p.n} more`}<Icon name="chevron-down" size={14} stroke={2.4} />
    </button>
  );
}

/** Where one order is, 22 tall (Buying, Paid ✓, Owes, Void): on a customer's order row, the twin card, a struck tile. */
export function OrderPill(p: { tone: 'info' | 'good' | 'warn' | 'bad'; tick?: boolean; children: ComponentChildren }): JSX.Element {
  return <span class={cx('ow-corow-p', p.tone)}>{p.tick && <Icon name="check" size={11} stroke={3.2} />}{p.children}</span>;
}

/** A customer's own order (OR03, Find): the item's square or a grey tile, when, the number and what, the amount and a pill. */
export function CustOrderRow(p: { aisle?: string; icon?: IconName; title: string; sub: string; amount: number; struck?: boolean; pill: { text: string; tone: 'info' | 'good' | 'warn' | 'bad'; tick?: boolean }; on: () => void }): JSX.Element {
  return (
    <button type="button" class="ow-corow" onClick={p.on}>
      {p.aisle ? <ItemSquare aisle={p.aisle} size={40} /> : <span aria-hidden="true" class="ow-corow-ic"><Icon name={p.icon || 'receipt'} size={20} stroke={1.9} /></span>}
      <span class="ow-orow-t"><span class="ow-orow-n">{p.title}</span><span class="mono ow-corow-s">{p.sub}</span></span>
      <span class="ow-corow-r">{p.struck ? <s class="mono ow-orow-a ow-corow-x">{fig(p.amount)}</s> : <span class="mono ow-orow-a">{fig(p.amount)}</span>}<OrderPill tone={p.pill.tone} tick={p.pill.tick}>{p.pill.text}</OrderPill></span>
    </button>
  );
}
