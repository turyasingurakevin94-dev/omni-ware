/*
 * The pieces of a blind count (SH10–SH19, SH25): the strip that says it is blind and goes to Ruth only, a card
 * per unit you can see (closed cartons · loose, open carton), what Ruth gets, and the keypad.
 *
 *   <BlindRow ruth={ruth} />
 *   <Levels levels={L} values={v} active={i} onPick={setI} item={it} />
 *   <Seen levels={L} values={v} unit="ctn" />            "You see 17 ctn + 0 kg › Ruth gets 17 ctn"
 *   <Pad onKey={k} off={sending} />                       1–9, +1, 0, delete; a key pressed shows its ring a moment (SH19)
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { inLineUnit, type Level } from '../../../core/store/counts.ts';
import type { ShelfItem, YardPerson } from '../../../core/store/types.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { cx } from '../../../ui/util.tsx';
import { Glyph } from './glyphs.tsx';
import { unitWord } from './parts.tsx';
import './count.css';

export function BlindRow(p: { ruth: YardPerson }): JSX.Element {
  return (
    <div class="sh-blind">
      <span aria-hidden="true"><Icon name="blind" size={19} stroke={2} /></span>
      <span><span>Blind count</span><span>no figures shown</span></span>
      <span class="sh-blind-r"><Avatar initials={p.ruth.initials} tint={p.ruth.tint} size={24} font={11} />{`to ${p.ruth.name.split(' ')[0]} only`}</span>
    </div>
  );
}

/** "Closed cartons · 25 kg each", "Loose, open carton · weigh or guess", "Bundles of 20", "Loose pieces". */
function levelWords(it: ShelfItem, L: Level[], i: number): [string, string] {
  const l = L[i], last = i === L.length - 1;
  if (L.length === 1) return [`${unitWord(l.unit, 2)[0].toUpperCase()}${unitWord(l.unit, 2).slice(1)}`, 'count what you see'];
  if (l.per > 1) return [`${unitWord(l.unit, 2)[0].toUpperCase()}${unitWord(l.unit, 2).slice(1)} of ${l.per}`, 'whole, closed'];
  if (!last) return [`Closed ${unitWord(l.unit === 'ctn' ? 'ctn' : l.unit, 2)}`, it.loose ? `${it.loose.per} ${it.loose.unit} each` : 'whole'];
  return it.loose ? [`Loose, open ${unitWord(L[0].unit)}`, 'weigh or guess'] : [`Loose ${unitWord(l.unit, 2)}`, 'count them'];
}

export function Levels(p: { it: ShelfItem; levels: Level[]; values: (number | null)[]; active: number; onPick: (i: number) => void; caret: boolean }): JSX.Element {
  return (
    <div class={cx('sh-levels', p.levels.length === 1 && 'one')}>
      {p.levels.map((l, i) => {
        const [t, s] = levelWords(p.it, p.levels, i), on = i === p.active;
        // Once a count has begun, a level not touched counts as none (0), not unknown.
        const v = p.values[i] ?? (p.values.some((x) => x != null) ? 0 : null);
        return (
          <button key={i} type="button" aria-pressed={on} class={cx('sh-level', on && 'on')} onClick={() => p.onPick(i)} aria-label={`${t}: ${v == null ? 'not counted' : `${v} ${l.unit}`}`}>
            <span class="sh-level-h"><span aria-hidden="true" class="sh-level-i"><Glyph g="carton" size={20} stroke={1.8} /></span><span>{t}</span></span>
            <span class="sh-level-v">{v == null ? <span class="dash" /> : <span class="mono">{v}</span>}{on && p.caret && <span aria-hidden="true" class="caret" />}<span>{l.unit}</span></span>
            <span class="sh-level-s">{s}</span>
          </button>
        );
      })}
    </div>
  );
}

/** What you see, and what Ruth gets in the books' unit. Nothing counted: "You counted nothing yet". */
export function Seen(p: { levels: Level[]; values: (number | null)[]; unit: string }): JSX.Element {
  if (p.values.every((v) => v == null)) return <div class="sh-seen none"><Icon name="tally" size={15} stroke={2} /><span>You counted nothing yet</span></div>;
  const you = p.levels.map((l, i) => `${p.values[i] || 0} ${l.unit}`).join(' + ');
  return (
    <div class="sh-seen">
      <span>You see</span><b class="mono">{you}</b><span aria-hidden="true" class="sh-seen-a"><Icon name="chevron-right" size={14} stroke={2.2} /></span>
      <span>Ruth gets</span><b class="mono">{`${inLineUnit(p.levels, p.values)} ${p.unit}`}</b>
    </div>
  );
}

export type Key = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '+1' | 'del';

export function Pad(p: { onKey: (k: Key) => void; off: boolean; plusLabel: string }): JSX.Element {
  const [hit, setHit] = useState<string | null>(null);
  const press = (k: Key) => { if (p.off) return; setHit(k); window.setTimeout(() => setHit((h) => (h === k ? null : h)), 700); p.onKey(k); };
  const keys: Key[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '+1', '0', 'del'];
  return (
    <div class={cx('sh-pad', p.off && 'off')}>
      {keys.map((k) => (
        <button key={k} type="button" disabled={p.off} aria-pressed={hit === k ? true : undefined} class={cx(k === '+1' || k === 'del' ? 'soft' : '', hit === k && 'hit')}
          aria-label={k === 'del' ? 'Delete' : k === '+1' ? p.plusLabel : undefined} onClick={() => press(k)}>
          {k === 'del' ? <Icon name="backspace" size={22} stroke={1.9} /> : k}
        </button>
      ))}
    </div>
  );
}

/** A key on the values: digits type into the active level, +1 adds one, delete takes the last digit. */
export function typed(v: number | null, k: Key): number | null {
  if (k === '+1') return (v || 0) + 1;
  if (k === 'del') { const s = String(v ?? '').slice(0, -1); return s ? Number(s) : null; }
  const s = `${v ?? ''}${k}`.replace(/^0+(?=\d)/, '');
  return s.length > 5 ? v : Number(s);
}
