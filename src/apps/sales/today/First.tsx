/*
 * TD06 · A new salesperson's first day: Get going (signed in, alerts, the first order), the ghost
 * of On the move, one way in (Turn on alerts), and what the shop sells most, last month.
 */
import type { JSX } from 'preact';
import type { Books, Ms } from '../../../core/types.ts';
import { ItemSquare } from '../../../ui/ItemSquare.tsx';
import { Icon, STAGE_ICON } from '../../../ui/icons.tsx';
import { STAGE_WORD } from '../../../core/names.ts';
import { Tap } from '../../../ui/util.tsx';
import { nav } from '../shell/nav.ts';
import { LIVE, shopAisles } from './data.ts';
import { go } from './go.ts';
import { useLocal } from './local.ts';

/** What the shop sells most: the first three of its aisles, busiest first (data.ts shopAisles). */
export function sellsMost(b: Books, n = 3): string[] {
  return shopAisles(b).slice(0, n).map((a) => a.name);
}

/** The aisle a thing asked of Sourcing most likely sits in, by its words (its icon on the ask). */
export function askAisle(name: string): string {
  const w = name.toLowerCase();
  return /pump|pipe|tap|ppr|valve/.test(w) ? 'Plumbing' : /fan|bulb|light|cable|socket|switch|solar/.test(w) ? 'Electrical' : /tile/.test(w) ? 'Tiles'
    : /paint|emulsion/.test(w) ? 'Paint' : /hinge|lock|door|handle/.test(w) ? 'Doors & locks' : /nail|screw|bolt/.test(w) ? 'Fasteners' : '';
}

export function First(p: { b: Books; now: Ms }): JSX.Element {
  const L = useLocal(), steps = [
    { done: true, icon: 'check' as const, title: 'Sign in', sub: 'done today' },
    { done: L.alerts, icon: 'bell' as const, title: 'Turn on alerts', sub: 'hear when a customer writes' },
    { done: false, icon: 'person' as const, title: 'Take your first order', sub: 'pick a customer · add items · slide', on: () => go('sell') },
  ];
  const aisles = sellsMost(p.b);
  return (
    <main class="td-main">
      <div class="ow-sec"><h2>Get going</h2><span class="mono ow-sec-meta good">{`${steps.filter((s) => s.done).length} of ${steps.length}`}</span></div>
      <div class="ow-group p14 td-steps">
        {steps.map((s) => {
          const inner = (
            <>
              <span aria-hidden="true" class={'td-step-disc' + (s.done ? ' done' : '')}><Icon name={s.done ? 'check' : s.icon} size={15} stroke={s.done ? 3 : 2} /></span>
              <span class="td-step-t">{s.done ? <s>{s.title}</s> : <span>{s.title}</span>}<span>{s.sub}</span></span>
              {s.on && <span aria-hidden="true" class="ow-chev"><Icon name="chevron-right" size={16} stroke={2.2} /></span>}
            </>
          );
          return s.on ? <Tap key={s.title} on={s.on} class="td-step">{inner}</Tap> : <div key={s.title} class="td-step">{inner}</div>;
        })}
      </div>
      <div class="td-ghost">
        <div class="td-ghost-h"><span>On the move</span><span>fills as you sell</span></div>
        <div aria-hidden="true" class="td-ghost-grid">{LIVE.map((s) => <span key={s}><Icon name={STAGE_ICON[s]} size={16} stroke={1.8} />{STAGE_WORD[s]}</span>)}</div>
      </div>
      {!L.alerts && <Tap on={() => nav.push('today/you')} class="td-alerts"><Icon name="bell" size={18} stroke={2} />Turn on alerts</Tap>}
      {aisles.length > 0 && (
        <Tap on={() => go('sell/order')} class="td-most">
          <span class="td-most-t"><span>Sells most</span><span>the shop, last month</span></span>
          <span class="td-most-ic">{aisles.map((a) => <ItemSquare key={a} aisle={a} size={34} icon={20} />)}</span>
          <span aria-hidden="true" class="ow-chev"><Icon name="chevron-right" size={16} stroke={2.2} /></span>
        </Tap>
      )}
    </main>
  );
}
