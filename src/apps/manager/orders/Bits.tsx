/*
 * The Orders tab's small pieces, drawn once for its four pages (docs/canvas/manager/Orders.dc.html):
 *
 *   StageCols   the head's five stage columns: the count, the salespeople's tint dots, the navy-on-white
 *               "waits on you" badge; Delivered in mint; a lit column (Stuck p3)
 *   Clock       the stage clock bar on a row: the fill to now, the tick at the limit, red past it
 *   H2          a list heading: the title, its count after ("Checking 2"), an optional right word
 *   Told        the dashed line under a card: the face, "{who} see(s): {word}", the bell
 *   Ring        Bills itself: the 24 h ring, what is left of it
 *   Empty       "Nothing stuck · nothing to bill"
 */
import type { ComponentChildren, JSX } from 'preact';
import type { MOrder, Person, Stage } from '../../../core/manager/types.ts';
import { STAGE } from '../../../core/manager/words.ts';
import { TINTS } from '../../../core/names.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import type { StageCol } from '../../../core/manager/orders.ts';

export function StageCols(p: { cols: StageCol[]; tint: (o: MOrder) => string; lit?: Stage[]; on: (s: Stage) => void }): JSX.Element {
  return (
    <div class="mg-orders-cols">
      {p.cols.map((c) => {
        const done = c.stage === 'completed', lit = !!p.lit && p.lit.includes(c.stage);
        return (
          <button key={c.stage} type="button" class={'mg-orders-col' + (done ? ' done' : '') + (lit ? ' lit' : '')}
            aria-label={`${c.orders.length} ${STAGE[c.stage]}${c.need ? `, ${c.need} wait on you` : ''}`} onClick={() => p.on(c.stage)}>
            <span class="box">
              <b class="mono">{c.orders.length}</b>
              <span class="dots">{c.orders.slice(0, 3).map((o) => <i key={o.id} style={{ background: p.tint(o) }} />)}</span>
              {c.need > 0 && <span class="need mono">{c.need}</span>}
            </span>
            <span class="w">{STAGE[c.stage]}</span>
          </button>
        );
      })}
    </div>
  );
}

/** A person's tint colour (the dot in a column). */
export function tintBg(p: Person | null | undefined): string {
  return (TINTS[p ? p.tint : 't4'] || TINTS.t4).bg;
}

export function Clock(p: { fill: number; tick: number; over: boolean; text: string; h?: 4 | 8 }): JSX.Element {
  return (
    <div class={'mg-orders-clock' + (p.h === 8 ? ' big' : '')}>
      <span class="bar" aria-hidden="true">
        {p.over
          ? <><i class="to" style={{ width: `${p.tick}%` }} /><i class="past" style={{ left: `${p.tick}%`, width: `${Math.max(0, p.fill - p.tick)}%` }} /></>
          : <i class="ok" style={{ width: `${p.fill}%` }} />}
        <i class="tick" style={{ left: `${p.tick}%` }} />
      </span>
      {p.text && <span class={'t mono' + (p.over ? ' over' : '')}>{p.text}</span>}
    </div>
  );
}

export function H2(p: { title: string; count?: number; dot?: boolean; right?: string; id?: string }): JSX.Element {
  return (
    <div class="mg-orders-h2" id={p.id}>
      {p.dot && <i class="dot" aria-hidden="true" />}
      <h2>{p.title}</h2>
      {p.count != null && <span class="mono">{p.count}</span>}
      <span class="sp" />
      {p.right && <span class="r mono">{p.right}</span>}
    </div>
  );
}

export function Told(p: { face?: Person | null; who: string; word: string; card?: boolean; children?: ComponentChildren }): JSX.Element {
  return (
    <div class={p.card ? 'mg-orders-told card' : 'mg-orders-told'}>
      {p.card && p.face && <Avatar initials={p.face.initials} tint={p.face.tint} size={24} />}
      {!p.card && <Icon name="bell" size={14} stroke={2} />}
      <span class="t">{`${p.who}: `}<b>{p.word}</b>{p.children}</span>
      {p.card && <Icon name="bell" size={16} stroke={2} />}
    </div>
  );
}

/** Bills itself: the ring is what is left of the 24 h. */
export function Ring(p: { left: number }): JSX.Element {
  const c = 2 * Math.PI * 15, f = Math.max(0, Math.min(1, p.left));
  return (
    <span class="mg-orders-ring" aria-hidden="true">
      <svg width="38" height="38" viewBox="0 0 38 38">
        <circle cx="19" cy="19" r="15" fill="none" stroke="#F1EEE8" stroke-width="4" />
        <circle cx="19" cy="19" r="15" fill="none" stroke="#0F6B43" stroke-width="4" stroke-linecap="round" stroke-dasharray={`${(c * f).toFixed(1)} ${c.toFixed(1)}`} transform="rotate(-90 19 19)" />
      </svg>
      <span><Icon name="clock" size={14} stroke={2} /></span>
    </span>
  );
}

export function Empty(): JSX.Element {
  return (
    <div class="mg-orders-empty" role="status">
      <span class="tile"><Icon name="check" size={28} stroke={2.4} /></span>
      <span class="w">Nothing stuck · nothing to bill</span>
      <span class="bars" aria-hidden="true">{[0, 1, 2, 3, 4].map((i) => <i key={i} />)}</span>
      <span class="s"><Icon name="clock" size={14} stroke={2} />Bills itself at 24 h</span>
    </div>
  );
}

/** The sending ring inside a navy answer ("Nudging"). */
export function Spinner(p: { dark?: boolean }): JSX.Element {
  const c = p.dark ? '#5F6980' : '#FFFFFF';
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" class="mg-orders-spin" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" fill="none" stroke={p.dark ? 'rgba(95,105,128,.3)' : 'rgba(255,255,255,.3)'} stroke-width="2.6" />
      <path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5" fill="none" stroke={c} stroke-width="2.6" stroke-linecap="round" />
    </svg>
  );
}
