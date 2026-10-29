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
 */
import type { ComponentChildren, JSX } from 'preact';
import { STAGE_WORD } from '../core/names.ts';
import type { Stage } from '../core/types.ts';
import { Avatar, type Face } from './Avatar.tsx';
import { Chevron, GroupCard } from './ActRow.tsx';
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

export interface OrderRowProps {
  face: Face;
  name: string;
  /** "#0553". */
  no: string;
  /** The one status: who decides (their face, info blue), or words in a tone (warn: Not paid yet). */
  status?: { text: string; face?: Face; tone?: 'info' | 'warn' | 'bad' | 'good' };
  amount: Fig;
  /** When it was placed ("10:16"); with no act. */
  time?: string;
  /** The one act on the row (it replaces the time and chevron). */
  act?: { word: string; amount?: Fig; label: string; on: () => void; tone?: 'warn' | 'good' | 'info' | 'bad' };
  on: () => void;
}

export function OrderRow(p: OrderRowProps): JSX.Element {
  const st = p.status;
  const left = (
    <>
      <Avatar {...p.face} size={40} />
      <span class="ow-orow-t">
        <span class="ow-orow-n">{p.name}</span>
        <span class="mono ow-orow-l">{p.no}
          {st && <><span aria-hidden="true">·</span>
            <span class="ow-orow-st">{st.face && <Avatar {...st.face} size={18} />}<span class={cx('ow-orow-w', st.tone || (st.face ? 'info' : 'warn'))}>{st.text}</span></span></>}
        </span>
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
          <button type="button" class="ow-orow-act" aria-label={a.label} onClick={a.on}><ActionPill tone={a.tone || 'warn'} word={a.word} amount={a.amount} h={30} /></button>
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
