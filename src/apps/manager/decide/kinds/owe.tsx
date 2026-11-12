/*
 * The credit kinds' shared evidence (MoneyCredit p1–p4): the would-owe gauge (what they owe in
 * navy, this order hatched, the limit marked dashed), its legend, the facts list, and the dock's
 * limit chips (credit.ts limitChoices / limitChip). Used by credit.tsx, storecredit.tsx, limit.tsx.
 */
import type { JSX } from 'preact';
import { money } from '../../../../core/money.ts';
import { limitChip } from '../../../../core/manager/credit.ts';
import { gaugePct } from '../../../../core/manager/decide-money.ts';
import type { LimitPick } from '../../../../core/manager/source.ts';
import type { UGX } from '../../../../core/manager/types.ts';
import { Icon, type IconName } from '../../../../ui/icons.tsx';
import './owe.css';

export interface Part { v: UGX; k: string; hatch?: boolean }
export interface GMark { v: UGX; label: string; tone: 'good' | 'ink' }

/** "Would owe 2,501,500": the bar against `max`, the limit marks, the legend. */
export function OweGauge(p: { label: string; parts: Part[]; max: UGX; marks?: GMark[]; legend?: boolean; children?: JSX.Element | null }): JSX.Element {
  const sum = p.parts.reduce((s, x) => s + x.v, 0);
  const marks = p.marks || [];
  return (
    <div class="mg-card mg-ow">
      <div class="mg-card-h"><span>{p.label}</span><b class="mg-big">{money(sum)}</b></div>
      <div class="mg-ow-bar" role="img" aria-label={`${p.label} ${money(sum)}${marks.map((m) => `, ${m.label}`).join('')}`}>
        <div class="t">{p.parts.map((x, i) => <i key={i} class={x.hatch ? 'h' : ''} style={{ width: `${gaugePct(x.v, p.max)}%` }} />)}</div>
        {marks.map((m, i) => <i key={i} class={'mk ' + m.tone} style={{ left: `${gaugePct(m.v, p.max)}%` }} />)}
      </div>
      {marks.length > 0 && (
        <div class="mg-ow-ml">{marks.map((m, i) => <span key={i} class={m.tone} style={{ left: `${gaugePct(m.v, p.max)}%` }}>{m.label}</span>)}</div>
      )}
      {p.children}
      {p.legend !== false && (
        <div class="mg-ow-leg">
          {p.parts.map((x) => <span key={x.k}><i class={x.hatch ? 'h' : ''} />{x.k} <b class="mg-mono">{money(x.v)}</b></span>)}
        </div>
      )}
    </div>
  );
}

/** A card of fact rows: an icon, the words, the figure. */
export function Facts(p: { rows: { icon: IconName; k: string; v: string }[] }): JSX.Element {
  return (
    <div class="mg-card mg-ow-facts">
      {p.rows.map((r) => <div key={r.k}><Icon name={r.icon} size={16} stroke={2} /><span>{r.k}</span><b class="mg-mono">{r.v}</b></div>)}
    </div>
  );
}

/** The dock's limit chips: one picked (or none: the answer waits). A second tap on the picked one clears it. */
export function LimitChips(p: { choices: LimitPick[]; on: number | null; set: (i: number | null) => void; clear?: boolean }): JSX.Element {
  return (
    <div class="mg-segs" role="radiogroup" aria-label="Limit and terms">
      {p.choices.map((x, i) => (
        <button key={x.limit} type="button" role="radio" aria-checked={p.on === i ? 'true' : 'false'}
          aria-label={`Limit ${money(x.limit)}, ${x.days} days`}
          onClick={() => p.set(p.on === i && p.clear ? null : i)}>{limitChip(x.limit, x.days)}</button>
      ))}
    </div>
  );
}
