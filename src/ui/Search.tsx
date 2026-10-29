/*
 * Search fields (LANGUAGE.md §3 P05, P03; §6: the duotone magnifier in
 * every field). Light (on the warm ground): 48 tall, white with the
 * hairline, the mic as a 36 px navy disc; focused, a navy outline and the
 * mic gives way to a 40 px clear button. Navy (in a page head): 46 tall,
 * glass, the placeholder #8D99B5.
 *
 *   <Search placeholder="Add an item" label="Add an item: type its name" value={q} onInput={setQ} onMic={listen} />
 *   <Search tone="navy" placeholder="Name, phone or place" label="Find a customer" value={q} onInput={setQ} />
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { Duo, Icon, phMic, phSearch } from './icons.tsx';
import { cx } from './util.tsx';
import './search.css';

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
  autoFocus?: boolean;
  class?: string;
}

export function Search(p: SearchProps): JSX.Element {
  const [focus, setFocus] = useState(false);
  const navy = p.tone === 'navy', v = p.value || '';
  return (
    <label class={cx('ow-search', navy ? 'navy' : 'light', focus && 'focus', p.class)}>
      <Duo i={phSearch} size={navy ? 19 : 20} color={navy ? '#B3BCD2' : '#1C2233'} />
      <input type="search" placeholder={p.placeholder} aria-label={p.label} value={v} autoFocus={p.autoFocus}
        onInput={(e) => p.onInput && p.onInput((e.target as HTMLInputElement).value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && p.onEnter) p.onEnter((e.target as HTMLInputElement).value); }}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} />
      {!navy && (focus && v
        ? <button type="button" class="ow-search-clear" aria-label="Clear" onMouseDown={(e) => e.preventDefault()} onClick={() => p.onInput && p.onInput('')}><Icon name="close" size={15} stroke={2.4} style={{ color: '#5F6980' }} /></button>
        : p.onMic && <button type="button" class="ow-search-mic" aria-label="Say it" onClick={p.onMic}><Duo i={phMic} size={18} color="#FFFFFF" /></button>)}
    </label>
  );
}
