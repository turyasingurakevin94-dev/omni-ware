/*
 * Search fields (LANGUAGE.md §3 P05, P03; §6: the duotone magnifier in
 * every field). Light (on the warm ground): 48 tall, white with the
 * hairline, the mic as a 36 px navy disc; focused, a 1.5 px navy border
 * with a soft ring, and the mic gives way to the clear. Navy (in a page
 * head): 46 tall, glass, the placeholder #8D99B5.
 *
 *   <Search placeholder="Add an item" label="Add an item: type its name" value={q} onInput={setQ} onMic={listen} />
 *   <Search tone="navy" placeholder="Name, phone or place" label="Find a customer" value={q} onInput={setQ} />
 *
 * One clear and one mic, wherever a field has them: ClearButton and MicButton,
 * each a 44 × 44 target around the disc the boards draw, taking no more room
 * than the disc (so nothing moves). The disc is the board's: 40 on light (44
 * on Today's Find), 32 or 26 on navy, 26 on a light sheet's field.
 *   <ClearButton label="Clear" tight on={() => setQ('')} />
 *   <ClearButton navy disc={32} icon={15} label="Clear" on={…} />
 *   <MicButton on={listen} />
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { Duo, Icon, phMic, phSearch } from './icons.tsx';
import { cx } from './util.tsx';
import './search.css';

export interface ClearButtonProps {
  label: string;
  on: () => void;
  /** On navy: a glass disc, a white ×. */
  navy?: boolean;
  /** The disc the board draws: 40 on light by default, 32 on navy; 26 a small one, 44 Today's Find. */
  disc?: number;
  /** The ×'s box and stroke (15 at 2.4 by default; 12 at 2.8 in a 26 disc; 14 at 2.4). */
  icon?: number;
  stroke?: number;
  /** The disc's fill, when not the tone's own (navy: .14 glass; light: #F1EEE8). */
  fill?: string;
  /** Keep the field's focus when tapped (the field stays open for the next word). */
  keepFocus?: boolean;
  /** Take only the disc's room in the row (where the board draws a 40 px button in its place). */
  tight?: boolean;
  class?: string;
}

/** The one clear: a 44 × 44 target; the disc inside it is the board's (`tight`: it takes only the disc's room in the row). */
export function ClearButton(p: ClearButtonProps): JSX.Element {
  const d = p.disc || (p.navy ? 32 : 40), i = p.icon || (d <= 26 ? 12 : 15);
  return (
    <button type="button" class={cx('ow-clear', p.navy && 'navy', p.class)} aria-label={p.label}
      style={p.tight ? { margin: `0 ${(d - 44) / 2}px` } : undefined} onMouseDown={p.keepFocus ? (e) => e.preventDefault() : undefined} onClick={p.on}>
      <span style={{ width: `${d}px`, height: `${d}px`, background: p.fill }}><Icon name="close" size={i} stroke={p.stroke || (d <= 26 ? 2.8 : 2.4)} /></span>
    </button>
  );
}

/** "Say it": the 36 px navy disc with the mic, in a 44 × 44 target that takes 36 of the row. */
export function MicButton(p: { on: () => void; label?: string }): JSX.Element {
  return (
    <button type="button" class="ow-mic" aria-label={p.label || 'Say it'} onClick={p.on}>
      <span><Duo i={phMic} size={18} color="#FFFFFF" /></span>
    </button>
  );
}

export interface SearchProps {
  tone?: 'light' | 'navy';
  placeholder: string;
  /** The field's aria-label. */
  label: string;
  value?: string;
  onInput?: (v: string) => void;
  onEnter?: (v: string) => void;
  /** "Say it": the mic disc (light only). */
  onMic?: () => void;
  /** Navy: once typed, the ring turns white and a Clear disc takes the words away (OR03). */
  onClear?: () => void;
  autoFocus?: boolean;
  class?: string;
}

export function Search(p: SearchProps): JSX.Element {
  const [focus, setFocus] = useState(false);
  const navy = p.tone === 'navy', v = p.value || '', typed = navy && !!p.onClear && !!v;
  return (
    <label class={cx('ow-search', navy ? 'navy' : 'light', focus && 'focus', typed && 'typed', p.class)}>
      <Duo i={phSearch} size={navy ? 19 : 20} color={typed ? '#FFFFFF' : navy ? '#B3BCD2' : '#1C2233'} />
      <input type="search" placeholder={p.placeholder} aria-label={p.label} value={v} autoFocus={p.autoFocus}
        onInput={(e) => p.onInput && p.onInput((e.target as HTMLInputElement).value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && p.onEnter) p.onEnter((e.target as HTMLInputElement).value); }}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} />
      {typed && <ClearButton navy disc={32} label="Clear" on={p.onClear as () => void} />}
      {!navy && (focus && v
        ? <ClearButton label="Clear the search" keepFocus tight on={() => p.onInput && p.onInput('')} />
        : p.onMic && <MicButton on={p.onMic} />)}
    </label>
  );
}
