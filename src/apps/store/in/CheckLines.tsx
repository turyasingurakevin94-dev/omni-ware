/*
 * The check-in's lines (IN02, IN03, IN05, IN09, IN10): a line row (counted, or not yet), a line
 * the Buyer could not find, a group gathered into one row once all of it is counted, and the open
 * line: quick tiles in the unit you can see (or stacks of ten with the loose ones on a stepper), then,
 * when the count is unlike the Buyer's, the two bars and why. Blind: the Buyer's figure shows only
 * once a line is counted and differs. Rules: core/store/checkin.ts.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { counted } from '../../../core/names.ts';
import { differs, quickTiles, whyChips, type CheckLine } from '../../../core/store/checkin.ts';
import { Avatar, type Face } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { ItemArt } from '../../../ui/ItemArt.tsx';
import { Stepper } from '../../../ui/Stepper.tsx';
import { cx } from '../../../ui/util.tsx';

/** The mark at the end of a row: counted, differs (Ruth decides), not counted yet. */
export function Mark(p: { kind: 'ok' | 'diff' | 'todo' | 'no'; label: string }): JSX.Element {
  return (
    <span role="img" aria-label={p.label} class={cx('in-mark', p.kind)}>
      {p.kind === 'ok' && <Icon name="check" size={12} stroke={3.2} />}
      {p.kind === 'diff' && '!'}
      {p.kind === 'no' && <Icon name="close" size={11} stroke={3.4} />}
    </span>
  );
}

/** A line, closed: its picture, its name and where it came from (or its count), then its mark. */
export function LineRow(p: { l: CheckLine; count?: number; sub?: string; who?: Face; on?: () => void; label?: string }): JSX.Element {
  const c = p.count, d = differs(p.l, c);
  const right = c == null
    ? <Mark kind="todo" label="Not counted yet" />
    : p.who
      ? <span class="in-line-r f"><Avatar {...p.who} size={24} /><Mark kind="ok" label={p.label || 'Checked in'} /></span>
      : <span class="in-line-r"><span class="in-qty">{c}<span>{p.l.unit}</span></span><Mark kind={d ? 'diff' : 'ok'} label={d ? 'Differs, Ruth decides' : 'Counted'} /></span>;
  return (
    <button type="button" class="in-line" aria-label={c == null ? `${p.l.name.split(' · ')[0]}, not counted yet` : undefined} onClick={p.on}>
      <ItemArt name={p.l.name} size={40} />
      <span class="in-line-t"><span>{p.l.name}</span><span class="mono">{p.sub ?? (c != null && p.who ? `${c} ${p.l.unit}` : p.l.supplier)}</span></span>
      {right}
    </button>
  );
}

/** A line the Buyer could not find: struck through, and who tells the customer. */
export function GoneRow(p: { l: CheckLine; tells: string }): JSX.Element {
  return (
    <div class="in-gone">
      <span aria-hidden="true" class="in-gone-sq"><Icon name="close" size={16} stroke={2.4} /></span>
      <span class="in-line-t"><span>{`${p.l.name.split(' · ')[0]} · ${p.l.asked} ${p.l.unit}`}</span><span>{`not found · ${p.tells}`}</span></span>
      <Mark kind="no" label="Not found" />
    </div>
  );
}

/** A group all counted, in one row: the pictures stacked, what came, the customer's face, its mark. */
export function GroupRow(p: { title: string; lines: CheckLine[]; words: string; face: Face; kind: 'ok' | 'diff'; label?: string; on?: () => void }): JSX.Element {
  const ls = p.lines.filter((l) => !l.notFound);
  return (
    <button type="button" class="in-line" aria-label={p.label} onClick={p.on}>
      {ls.length > 1
        ? <span aria-hidden="true" class="in-stack"><span><ItemArt name={ls[0].name} size={36} radius={11} /></span><span><ItemArt name={ls[1].name} size={36} radius={11} /></span></span>
        : <ItemArt name={ls[0] ? ls[0].name : ''} size={40} />}
      <span class="in-line-t"><span>{p.title}</span><span class="mono">{p.words}</span></span>
      <span class="in-line-r f"><Avatar {...p.face} size={24} /><Mark kind={p.kind} label={p.kind === 'ok' ? (ls.length > 1 ? 'Both counted' : 'Counted') : 'Differs, Ruth decides'} /></span>
    </button>
  );
}

/** The open line: count it (tiles), or, once it differs, say why. */
export function OpenLine(p: {
  l: CheckLine; nth: number; of: number; count: number | undefined; why: string | undefined; ruth: Face; ruthName: string; denisName: string;
  onCount: (n: number, close: boolean) => void; onWhy: (w: string) => void;
  /** What sits right of the name when there is no "line 2 of 3" (the delivery's Torn?). */
  aside?: JSX.Element | null;
}): JSX.Element {
  const { l } = p, [other, setOther] = useState(false), t = quickTiles(l.expected), c = p.count;
  if (c != null && differs(l, c) && p.why !== 'I miscounted') {
    const diff = Math.abs(c - l.expected), max = Math.max(c, l.expected) || 1;
    return (
      <div class="in-card open-amber">
        <div class="in-open-h">
          <ItemArt name={l.name} size={56} radius={14} />
          <div class="in-open-t"><span>{l.name}</span><span class="in-open-s warn">{`${diff} ${l.unit} differ · why?`}</span></div>
          <span class="in-pill t-warn mono in-cnt">{`${c} ${l.unit}`}</span>
        </div>
        <div class="in-cmp" role="img" aria-label={`You counted ${counted(c, l.unit)}. ${p.denisName} bought ${counted(l.expected, l.unit)}. ${diff} differ`}>
          <b>You</b><i><i style={{ width: `${(c / max) * 100}%` }} /></i><span class="mono">{`${c} ${l.unit}`}</span>
          <b class="d">{p.denisName}</b><i class="d" style={{ width: `${(l.expected / max) * 100}%` }} /><span class="mono d">{`${l.expected} ${l.unit}`}</span>
        </div>
        <div class="in-why" role="group" aria-label="Why it differs">
          {whyChips(c, l.expected).map((w) => <button key={w} type="button" class="in-chip" aria-pressed={p.why === w} onClick={() => p.onWhy(w)}>{w}</button>)}
        </div>
        <span class="in-by"><Avatar {...p.ruth} size={20} />{`${p.ruthName} decides the difference`}</span>
      </div>
    );
  }
  const unitWord = (n: number) => `${n} ${l.unit}`;
  return (
    <div class="in-card open-navy">
      <div class="in-open-h">
        <ItemArt name={l.name} size={56} radius={14} />
        <div class="in-open-t">
          <span>{l.name}</span>
          <span class="in-open-s"><Icon name="eye-off" size={14} stroke={2} />{t.kind === 'stack' ? `Tap the stacks of ${t.step} you see` : 'How many came off?'}</span>
        </div>
        {p.of > 1 ? <span class="mono in-of">{`line ${p.nth} of ${p.of}`}</span> : p.aside}
      </div>
      {t.kind === 'few' ? (
        <div class="in-tiles" role="group" aria-label={`How many ${l.unit}s`}>
          {t.values.map((v) => (
            <button key={v} type="button" class={cx('in-tile', c === v && !other && 'on')} aria-label={unitWord(v)} aria-pressed={c === v && !other ? 'true' : undefined} onClick={() => { setOther(false); p.onCount(v, true); }}>
              <span class="mono">{v}</span><span>{l.unit}</span>
            </button>
          ))}
          <button type="button" class="in-tile other" aria-pressed={other} onClick={() => { setOther(true); p.onCount(c ?? 5, false); }}><Icon name="plus" size={16} stroke={2.4} /><span>Other</span></button>
        </div>
      ) : (
        <div class="in-tiles stack" role="group" aria-label={`${l.unit}s in stacks of ${t.step}`}>
          {t.values.map((v) => (
            <button key={v} type="button" class={cx('in-stk', c != null && v < c && 'under', c === v && 'on')} aria-label={`${v} ${l.unit}s`} aria-pressed={c === v ? 'true' : undefined} onClick={() => p.onCount(v, false)}>
              <span class="mono">{v}</span>
            </button>
          ))}
        </div>
      )}
      {(t.kind === 'stack' || other) && (
        <div class="in-loose">
          <span>{t.kind === 'stack' ? `Loose ${l.unit}s on top` : 'How many'}</span>
          <Stepper value={c ?? 0} unit={l.unit} what={`${l.unit}s`} onChange={(n) => p.onCount(n, false)} />
        </div>
      )}
    </div>
  );
}
