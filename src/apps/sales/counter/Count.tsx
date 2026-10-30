/*
 * KC06 · Count what they gave (Other amount): tap each note they hand over, − takes one back, or
 * type it. The bar shows what is counted against the sale; Use puts it in the dock as the fourth
 * tile (KC07: short; or the change to give).
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { Icon } from '../../../ui/icons.tsx';
import { fig } from '../../../ui/Money.tsx';
import { LightSheet, sheet } from '../../../ui/sheet.tsx';
import { NOTES, notesFor } from '../../../core/money.ts';
import { TINTS } from '../../../core/names.ts';
import type { Tint } from '../../../core/types.ts';
import { sale, set } from './state.ts';
import './count.css';

/** Each note in its own soft (identity, as the notes are told apart in the hand). */
const TINT: Record<number, Tint> = { 50000: 't1', 20000: 't0', 10000: 't2', 5000: 't3', 2000: 't5', 1000: 't4' };

export function CountSheet(p: { total: number }): JSX.Element {
  const start = sale.value.counted;
  const [n, setN] = useState<Record<number, number>>(() => {
    const m: Record<number, number> = {};
    if (start) notesFor(start).forEach((x) => { m[x] = (m[x] || 0) + 1; });
    return m;
  });
  const [typed, setTyped] = useState<string | null>(null);
  const counted = typed != null ? Number(typed.replace(/[^0-9]/g, '')) || 0 : NOTES.reduce((t, x) => t + x * (n[x] || 0), 0);
  const over = counted >= p.total, top = Math.max(p.total, counted, 1);
  const bump = (x: number, d: number) => { setTyped(null); setN({ ...n, [x]: Math.max(0, (n[x] || 0) + d) }); };
  // Exactly the total is Exact (KC03's tile), not a fourth tile.
  const use = () => { if (!counted) return; set(counted === p.total ? { counted: null, given: 'exact' } : { counted, given: counted }); sheet.close(); };
  return (
    <LightSheet eyebrow={`Counter sale · ${fig(p.total)}`} title="Count what they gave" onClose={sheet.close}>
      <div class="kc-cnt-h">
        <span class="kc-cnt-g">
          <span>They gave</span>
          {typed != null
            ? <input class="mono" inputmode="numeric" aria-label="How much they gave" autoFocus value={typed} onInput={(e) => setTyped((e.target as HTMLInputElement).value)} />
            : <span class="mono">{fig(counted)}</span>}
        </span>
        {counted > 0 && (
          <span class={'kc-cnt-c' + (over ? '' : ' short')}>
            <span>{over ? 'Give change' : 'Short by'}</span>
            {over ? <span class="mono">{fig(counted - p.total)}</span> : (
              <span class="kc-cnt-sv">
                <span role="img" aria-label={`${fig(p.total - counted)} still to come`} class="kc-cnt-dash">{notesFor(Math.ceil((p.total - counted) / 1000) * 1000).slice(0, 2).map((x, i) => <span key={i} class="mono">{fig(x)}</span>)}</span>
                <span class="mono">{fig(p.total - counted)}</span>
              </span>
            )}
          </span>
        )}
      </div>
      <div class="kc-cnt-b">
        <div role="img" aria-label={`Counted ${fig(counted)} for a sale of ${fig(p.total)}${over ? '' : `: ${fig(p.total - counted)} short`}`} class={'kc-cnt-bar' + (over || !counted ? '' : ' short')}>
          <span style={{ width: `${Math.round((Math.min(counted, top) / top) * 100)}%` }} />
          {!over && !!counted && <span class="hatch" style={{ left: `${Math.round((counted / top) * 100)}%` }} />}
          <span class="tick" style={over ? { left: `${Math.round((p.total / top) * 100)}%` } : { left: 'calc(100% - 2px)' }} />
        </div>
        <div class="kc-cnt-l"><span>{'Sale '}<span class="mono">{fig(p.total)}</span></span><span>{'Counted '}<span class="mono">{fig(counted)}</span></span></div>
      </div>
      <div role="group" aria-label="Tap each note they hand over" class="kc-notes">
        {NOTES.map((x) => {
          const c = n[x] || 0, t = TINTS[TINT[x]];
          return (
            <div key={x} class="kc-note">
              <button type="button" class="mono" aria-label={`Add a ${fig(x)} note${c ? `, ${c} so far` : ''}`} onClick={() => bump(x, 1)}
                style={{ background: t.bg, color: t.fg, boxShadow: c ? `inset 0 0 0 2px ${t.fg}` : undefined }}>{fig(x)}</button>
              {!!c && <span aria-hidden="true" class="kc-note-n mono">{`×${c}`}</span>}
              {!!c && <button type="button" class="kc-note-m" aria-label={`One ${fig(x)} note fewer`} onClick={() => bump(x, -1)}><span style={{ color: t.fg }}><Icon name="minus" size={14} stroke={2.6} /></span></button>}
            </div>
          );
        })}
      </div>
      <div class="kc-cnt-f">
        <button type="button" class="kc-typeit" onClick={() => setTyped(typed != null ? null : String(counted || ''))}><Icon name="pen" size={18} stroke={2} />Type it</button>
        <button type="button" class="kc-use" disabled={!counted} onClick={use}>{`Use ${fig(counted)}`}</button>
      </div>
    </LightSheet>
  );
}
