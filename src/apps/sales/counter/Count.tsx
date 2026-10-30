/*
 * KC06 · Count what they gave (Other amount): tap each note they hand over, − takes one back.
 * KC20 · Type it: the S03 keypad in the same sheet, the figure in a field (no phone keyboard);
 * the note counts clear while a typed amount stands. KC23 · short: Short by, the missing note dashed.
 * Use puts the amount in the dock (KC07: the fourth tile; exactly the total is Exact).
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { Icon } from '../../../ui/icons.tsx';
import { Keypad } from '../../../ui/Keypad.tsx';
import { fig } from '../../../ui/Money.tsx';
import { LightSheet, sheet } from '../../../ui/sheet.tsx';
import { NOTES, notesFor } from '../../../core/money.ts';
import { TINTS } from '../../../core/names.ts';
import type { Tint } from '../../../core/types.ts';
import { sale, set } from './state.ts';
import './count.css';

/** Each note in its own soft (identity, as the notes are told apart in the hand). */
const TINT: Record<number, Tint> = { 50000: 't1', 20000: 't0', 10000: 't2', 5000: 't3', 2000: 't5', 1000: 't4' };

/** Give change, or Short by with the missing note dashed (KC06, KC23). */
function Diff(p: { counted: number; total: number; pad?: boolean }): JSX.Element | null {
  if (!p.counted) return null;
  const over = p.counted >= p.total, miss = p.total - p.counted;
  return (
    <span class={'kc-cnt-c' + (p.pad ? ' pad' : '') + (over ? '' : ' short')}>
      <span>{over ? 'Give change' : 'Short by'}</span>
      {over ? <span class="mono">{fig(p.counted - p.total)}</span> : (
        <span class="kc-cnt-sv">
          <span role="img" aria-label={`${fig(miss)} still to come`} class="kc-cnt-dash">{notesFor(Math.ceil(miss / 1000) * 1000).slice(0, 2).map((x, i) => <span key={i} class="mono">{fig(x)}</span>)}</span>
          <span class="mono">{fig(miss)}</span>
        </span>
      )}
    </span>
  );
}

export function CountSheet(p: { total: number }): JSX.Element {
  const start = sale.value.counted;
  const [n, setN] = useState<Record<number, number>>(() => {
    const m: Record<number, number> = {};
    if (start) notesFor(start).forEach((x) => { m[x] = (m[x] || 0) + 1; });
    return m;
  });
  /** The digits typed on the keypad; null: counting notes. */
  const [typed, setTyped] = useState<string | null>(null);
  const counted = typed != null ? Number(typed) || 0 : NOTES.reduce((t, x) => t + x * (n[x] || 0), 0);
  const over = counted >= p.total, top = Math.max(p.total, counted, 1);
  const bump = (x: number, d: number) => setN({ ...n, [x]: Math.max(0, (n[x] || 0) + d) });
  // Exactly the total is Exact (KC03's tile), not a fourth tile.
  const use = () => { if (!counted) return; set(counted === p.total ? { counted: null, given: 'exact' } : { counted, given: counted }); sheet.close(); };
  return (
    <LightSheet eyebrow={`Counter sale · ${fig(p.total)}`} title="Count what they gave" onClose={sheet.close}>
      {typed != null ? (
        <div class="kc-cnt-th">
          <label class="kc-cnt-field">
            <span>They gave</span>
            <input type="text" inputmode="none" readonly aria-label="How much they gave" class="mono" value={typed ? fig(Number(typed)) : ''} />
          </label>
          <Diff counted={counted} total={p.total} pad />
        </div>
      ) : (
        <div class="kc-cnt-h">
          <span class="kc-cnt-g"><span>They gave</span><span class="mono">{fig(counted)}</span></span>
          <Diff counted={counted} total={p.total} />
        </div>
      )}
      <div class="kc-cnt-b">
        <div role="img" aria-label={`Counted ${fig(counted)} for a sale of ${fig(p.total)}${over ? '' : `: ${fig(p.total - counted)} short`}`} class={'kc-cnt-bar' + (over || !counted ? '' : ' short')}>
          <span style={{ width: `${Math.round((Math.min(counted, top) / top) * 100)}%` }} />
          {!over && !!counted && <span class="hatch" style={{ left: `${Math.round((counted / top) * 100)}%` }} />}
          <span class="tick" style={over ? { left: `${Math.round((p.total / top) * 100)}%` } : { left: 'calc(100% - 2px)' }} />
        </div>
        <div class="kc-cnt-l"><span>{'Sale '}<span class="mono">{fig(p.total)}</span></span><span>{'Counted '}<span class="mono">{fig(counted)}</span></span></div>
      </div>
      {typed != null ? <Keypad value={typed} onChange={setTyped} max={9} /> : (
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
      )}
      <div class="kc-cnt-f">
        {typed != null
          ? <button type="button" class="kc-typeit" onClick={() => setTyped(null)}><Icon name="cash" size={18} stroke={2} />Count notes</button>
          // Typing replaces the notes: their counts clear while a typed amount stands.
          : <button type="button" class="kc-typeit" onClick={() => { setN({}); setTyped(counted ? String(counted) : ''); }}><Icon name="pen" size={18} stroke={2} />Type it</button>}
        <button type="button" class="kc-use" disabled={!counted} onClick={use}>{`Use ${fig(counted)}`}</button>
      </div>
    </LightSheet>
  );
}
