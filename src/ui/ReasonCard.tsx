/*
 * S07 · The return / void picker, "Something wrong" (LANGUAGE.md §5.2 S07):
 * three reason cards, each saying who decides. Opened from the "Fix it" act
 * on an order; above them the order's StageDots, so the person sees what is
 * still possible (a Delivered order cannot be cancelled: that card is at 50%
 * with "Delivered · use a return").
 *
 *   <ReasonCard kind="return" on={…} />           Items coming back · Ruth gives the credit note
 *   <ReasonCard kind="void" on={…} />             Cancel the bill · Ruth decides
 *   <ReasonCard kind="payment" on={…} />          Payment recorded wrong · Esther corrects it
 *   <ReasonCard kind="void" off="Delivered · use a return" />
 * Names come from the people (decision-rights: the Manager, Accounts): pass `sub` with their name.
 */
import type { JSX } from 'preact';
import { Chevron, IconTile, type TileTone } from './ActRow.tsx';
import type { IconName } from './icons.tsx';
import { Tap, cx } from './util.tsx';
import './reasoncard.css';

const KIND: Record<'return' | 'void' | 'payment', { tone: TileTone; icon: IconName; title: string; sub: string }> = {
  return: { tone: 'info', icon: 'return', title: 'Items coming back', sub: 'Ruth gives the credit note' },
  void: { tone: 'bad', icon: 'void', title: 'Cancel the bill', sub: 'Ruth decides' },
  payment: { tone: 'warn', icon: 'cash', title: 'Payment recorded wrong', sub: 'Esther corrects it' },
};

export interface ReasonCardProps {
  kind: 'return' | 'void' | 'payment';
  title?: string;
  sub?: string;
  on?: () => void;
  /** Not possible now: the card at 50% with this line instead. */
  off?: string;
}

export function ReasonCard(p: ReasonCardProps): JSX.Element {
  const k = KIND[p.kind];
  const body = (
    <>
      <IconTile tone={k.tone} icon={k.icon} size={42} />
      <span class="ow-reason-t"><span>{p.title || k.title}</span><span>{p.off || p.sub || k.sub}</span></span>
      {!p.off && <Chevron />}
    </>
  );
  return p.off || !p.on
    ? <div class={cx('ow-reason', p.off && 'off')} aria-disabled={p.off ? 'true' : undefined}>{body}</div>
    : <Tap on={p.on} class="ow-reason">{body}</Tap>;
}
