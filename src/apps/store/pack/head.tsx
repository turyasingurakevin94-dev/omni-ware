/*
 * The navy heads of the Pack screens. PackHead (PK02–PK05, PK11, PK12, PK16, PK18, PK19): the
 * customer, "#0552 · since 10:05", where the order came from and what its salesperson sees, then
 * one strip per line (packed ✓, the line now, short, dropped). StateHead (PK09, PK10, PK15, PK17,
 * PK21, PK22): the customer, a hairline, the order's state in big words and who it waits on.
 */
import type { ComponentChildren, JSX } from 'preact';
import { firstWord, orderNo } from '../../../core/names.ts';
import { customerFace, personFace, whoIs } from '../../../core/store/faces.ts';
import { aisleOf, lineMark, shortName, type LineMark } from '../../../core/store/pack.ts';
import type { YardBooks, YardLine, YardOrder } from '../../../core/store/types.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { SheetHead } from '../../../ui/FullSheet.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { cx } from '../../../ui/util.tsx';
import './head.css';

export type SeesTone = 'mint' | 'amber' | 'glass' | 'rose';

/** "From Grace" and the chip of what she sees ("Grace sees: Packing · 1 of 2"). */
export function FromRow(p: { b: YardBooks; o: YardOrder; sees: string; tone: SeesTone; lead?: ComponentChildren }): JSX.Element {
  const t = whoIs(p.b, p.o.takenBy);
  return (
    <div class="pk-from">
      {p.lead || (t && <><Avatar {...personFace(t)} size={24} onNavy style={{ boxShadow: '0 0 0 2px #16203C' }} /><span class="pk-from-w">{`From ${firstWord(t.name)}`}</span></>)}
      <span class={'pk-sees t-' + p.tone}>{p.sees}</span>
    </div>
  );
}

function Strip(p: { b: YardBooks; o: YardOrder; now: YardLine | null; marks?: Record<number, LineMark> }): JSX.Element {
  const o = p.o;
  const marks = o.lines.map((l) => (p.marks && p.marks[l.idx]) || lineMark(o, l, p.now));
  const said = marks.map((m, i) => `line ${i + 1} ${m === 'done' ? 'packed' : m === 'now' ? 'now' : m}`).join(', ');
  return (
    <div role="img" aria-label={`Line ${p.now ? o.lines.indexOf(p.now) + 1 : o.lines.length} of ${o.lines.length}: ${said}`} class="pk-strip" style={{ gridTemplateColumns: `repeat(${o.lines.length}, minmax(0, 1fr))` }}>
      {o.lines.map((l, i) => {
        const m = marks[i], a = aisleOf(p.b, l), nm = shortName(l.name);
        return (
          <span key={l.idx} class={'pk-strip-s m-' + m}>
            <span />
            <span>
              {(m === 'done' || m === 'short') && <Icon name="check" size={11} stroke={3} />}
              {m === 'dropped' && <Icon name="close" size={11} stroke={3} />}
              {m === 'dropped' ? `${nm} dropped` : a ? `${a.letter} · ${nm}` : nm}
            </span>
          </span>
        );
      })}
    </div>
  );
}

/** The pack card's head. `since`: "since 10:05" (claimed) or "waiting 39 m". */
export function PackHead(p: { b: YardBooks; o: YardOrder; since: string; sees: string; tone: SeesTone; now: YardLine | null; marks?: Record<number, LineMark>; onClose: () => void }): JSX.Element {
  const c = customerFace(p.o, p.b);
  return (
    <SheetHead face={c} name={c.name} sub={`${orderNo(p.o.id)} · ${p.since}`} subMono onClose={p.onClose} style={{ gap: '12px', padding: '10px 20px 16px' }}>
      <FromRow b={p.b} o={p.o} sees={p.sees} tone={p.tone} />
      <Strip b={p.b} o={p.o} now={p.now} marks={p.marks} />
    </SheetHead>
  );
}

/** A state head: the customer, a hairline, the big word and its tail, then who it waits on and what the other app sees. */
export function StateHead(p: { b: YardBooks; o: YardOrder; sub: string; word: string; tail?: string; tailTone?: 'rose' | 'soft'; who: ComponentChildren; sees: string; tone: SeesTone; onClose: () => void; children?: ComponentChildren }): JSX.Element {
  const c = customerFace(p.o, p.b);
  return (
    <SheetHead face={c} name={c.name} sub={p.sub} subMono onClose={p.onClose} style={{ gap: '12px', padding: '10px 20px 16px' }}>
      <div class="pk-state">
        <div class="pk-state-w"><b>{p.word}</b>{p.tail && <span class={cx('t-' + (p.tailTone || 'soft'))}>{p.tail}</span>}</div>
        {p.children}
        {p.sees && <FromRow b={p.b} o={p.o} sees={p.sees} tone={p.tone} lead={p.who} />}
      </div>
    </SheetHead>
  );
}
