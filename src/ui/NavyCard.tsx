/*
 * A navy card on the light ground, for a picture that lives on navy
 * (LANGUAGE.md §1.2 grounds): flat navy (the money split, S06), the page
 * head's radial (the stage bar as a filter key, S05), or the dark card's
 * radial (P09). Radius 22, padding 16.
 *
 *   <NavyCard><MoneySplit … /></NavyCard>
 *   <NavyCard ground="head"><StageBar counts={…} /></NavyCard>
 */
import type { ComponentChildren, JSX } from 'preact';
import './navycard.css';

export function NavyCard(p: { ground?: 'flat' | 'head' | 'dark'; children: ComponentChildren }): JSX.Element {
  return <div class={'ow-navycard ' + (p.ground || 'flat')}>{p.children}</div>;
}
