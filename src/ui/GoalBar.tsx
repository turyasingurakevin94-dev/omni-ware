/*
 * P02c · The goal bar (Sales+Buyer cross-app round 1, SAL-2; board XR1Goal): what is sold is solid,
 * what is on the move (placed, not delivered) is hatched, a 2 px gap between them. Nothing is drawn
 * for 0% sold; above 0 the sold part is at least 4 px, so 1% never looks like 0%. One part for the
 * three places the goal shows: the hero (navy), the busy-day strip (light) and the scrolled top bar.
 *
 *   <GoalBar pct={36} movePct={9} />                 on navy, 8 px
 *   <GoalBar pct={0} movePct={9} light h={6} />      on white (the strip)
 *   <MoveSwatch />                                   the hatch as a key (the "on the move" door)
 */
import type { JSX } from 'preact';
import { barW, cx } from './util.tsx';
import './goalbar.css';

export function GoalBar(p: { pct: number; movePct: number; light?: boolean; h?: number }): JSX.Element {
  return (
    <span aria-hidden="true" class={cx('ow-goalbar', p.light && 'light')} style={{ height: `${p.h || 8}px` }}>
      {p.pct > 0 && <span class="sold" style={{ width: barW(p.pct) }} />}
      {p.movePct > 0 && <span class="move" style={{ width: barW(p.movePct, p.pct) }} />}
    </span>
  );
}

export function MoveSwatch(): JSX.Element {
  return <i aria-hidden="true" class="ow-goalbar-swatch" />;
}
