/*
 * The pieces of Take payment (CU30–CU36) that S02 does not draw: the quick
 * amounts, the reference field, what the money pays bill by bill, the
 * paid-over split and its choice, the walk-in's order and who owes the rest.
 */
import { billNo } from '../../../core/owing.ts';
import type { ComponentChildren, JSX } from 'preact';
import { Duo, Icon, phSearch } from '../../../ui/icons.tsx';
import { cx } from '../../../ui/util.tsx';
import { money } from '../../../core/money.ts';
import { orderNo, TINTS } from '../../../core/names.ts';
import type { Tint } from '../../../core/types.ts';

/** "All 420,000 · #0531 300,000 · Other": 36 visible inside a 44 target (S02). */
export function QuickAmounts(p: { opts: { word: string; amount: number }[]; chosen: number | null; onPick: (i: number) => void; onOther: () => void }): JSX.Element {
  const b = (on: boolean, inner: ComponentChildren, click: () => void, key: string) => (
    <button key={key} type="button" role="radio" aria-checked={on} class="cu-q36" onClick={click}><span class={cx(on && 'on')}>{inner}</span></button>
  );
  return (
    <div role="radiogroup" aria-label="Quick amounts" class="cu-quick36">
      {p.opts.map((o, i) => b(p.chosen === i, <>{o.word + ' '}<b class="mono">{money(o.amount)}</b></>, () => p.onPick(i), o.word))}
      {b(p.chosen == null, 'Other', p.onOther, 'other')}
    </div>
  );
}

/** The transaction ID (Mobile: needed, Q6) or the bank reference (if there is one). */
export function RefField(p: { label: string; value: string; placeholder: string; warn: string | null; onInput: (v: string) => void }): JSX.Element {
  return (
    <div class="cu-ref-w">
      <label class={cx('cu-ref', p.warn && 'warn')}>
        <span>{p.label}</span>
        <input type="text" autocomplete="off" class="mono" aria-label={p.label} placeholder={p.placeholder} value={p.value} onInput={(e) => p.onInput((e.target as HTMLInputElement).value)} />
      </label>
      {p.warn && <span class="cu-ref-warn"><Icon name="warning" size={14} stroke={2.2} />{p.warn}</span>}
    </div>
  );
}

export interface PaysRow { id: number; day: string; age: number; left: number; applied: number; on: boolean; /** A live order held for the money, not a bill (SL30's #0551). */ order?: boolean }

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const dm = (day: string) => { const d = new Date(day + 'T00:00:00Z'); return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`; };

/** What it pays, bill by bill: a tick, the bill, how much of it this clears. */
export function PaysCard(p: { rows: PaysRow[]; pick: boolean; onToggle: (id: number) => void }): JSX.Element {
  const clear = p.rows.filter((r) => r.on && r.applied >= r.left).length, picked = p.rows.filter((r) => r.on).length;
  const chip = p.pick ? { t: `${picked} picked`, c: 'neutral' } : { t: `${clear} of ${p.rows.length} clear`, c: clear === p.rows.length ? 'good' : 'warn' };
  return (
    <div class="cu-pays">
      <div class="cu-pays-h"><span>{p.pick ? 'What it pays · you pick' : 'What it pays · oldest first'}</span><span class={'cu-chip ' + chip.c}>{chip.t}</span></div>
      {p.rows.map((r) => {
        const pct = r.left ? Math.round((Math.min(r.applied, r.left) / r.left) * 100) : 0, full = r.applied >= r.left;
        const tag = !r.on || !(r.applied > 0) ? { t: 'not this time', c: 'neutral' } : full ? { t: 'clears', c: 'good' } : { t: `${money(r.left - r.applied)} left`, c: 'warn' };
        return (
          <button key={r.id} type="button" role="checkbox" aria-checked={r.on} aria-label={`${billNo(r.id)}, ${money(r.left)}`} class="cu-pay-row" onClick={() => p.onToggle(r.id)}>
            <span aria-hidden="true" class={cx('cu-tick', r.on && 'on')}>{r.on && <Icon name="check" size={13} stroke={3.2} />}</span>
            <span class={cx('cu-pay-t', !r.on && 'off')}>
              <span><span>{`${billNo(r.id)} `}<span>{r.order ? 'the order · not paid yet' : `${dm(r.day)} · ${r.age} days`}</span></span><span class="mono">{money(r.left)}</span></span>
              <span><span aria-hidden="true" class="cu-pay-bar"><span style={{ width: `${pct}%`, background: full ? '#0F6B43' : '#95530C' }} /></span><span class={'cu-tag ' + tag.c}>{tag.t}</span></span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** They gave more than they pay now: the split, and Give change or Deposit (CU35, CU36). */
export function OverCard(p: { pays: number; over: number; bills: number[]; how: 'change' | 'deposit'; onHow: (h: 'change' | 'deposit') => void; name: string; checker: { initials: string; tint: Tint; name: string } }): JSX.Element {
  const what = p.bills.length === 2 ? `${billNo(p.bills[0])} and ${billNo(p.bills[1])}` : p.bills.length === 1 ? billNo(p.bills[0]) : p.bills.map(billNo).join(', ');
  const word = p.how === 'change' ? 'change' : 'deposit', t = TINTS[p.checker.tint];
  const opt = (h: 'change' | 'deposit', label: string) => (
    <button type="button" role="radio" aria-checked={p.how === h} class={cx('cu-over-o', p.how === h && 'on')} onClick={() => p.onHow(h)}>
      <span aria-hidden="true" class="cu-choice-dot">{p.how === h && <Icon name="check" size={13} stroke={3.2} />}</span><span>{label}</span>
    </button>
  );
  return (
    <>
      <div class="cu-over">
        <span role="img" aria-label={`They gave ${money(p.pays + p.over)}: ${money(p.pays)} pays ${p.bills.length === 2 ? 'both bills' : what}, ${money(p.over)} is ${word}`} class="cu-over-bar">
          <span style={{ flex: Math.round(p.pays / 1000) }} /><span class={p.how} style={{ flex: Math.round(p.over / 1000) }} />
        </span>
        <span class="cu-over-l"><span><b class="mono">{money(p.pays)}</b>{` pays ${what}`}</span><span><b class="mono">{money(p.over)}</b>{` ${word}`}</span></span>
      </div>
      <div role="radiogroup" aria-label={`The ${money(p.over)} over`} class="cu-over-os">{opt('change', 'Give change')}{opt('deposit', 'Deposit')}</div>
      <span class="cu-over-note"><span aria-hidden="true" style={{ background: t.bg, color: t.fg }}>{p.checker.initials}</span>
        {p.how === 'change' ? `Change unless ${p.name} says keep it · ${p.checker.name} sees it` : `${p.name} says keep it · next bill uses it first · ${p.checker.name} sees it`}</span>
    </>
  );
}

/** The walk-in's order: where it is, and how much of it this pays (CU34). */
export function OrderCard(p: { id: number; where: string; status: string | null; paid: number; total: number }): JSX.Element {
  const pct = p.total ? Math.round((p.paid / p.total) * 100) : 0;
  return (
    <div class="cu-ordc">
      <span class="cu-ordc-h"><span>{`${orderNo(p.id)} `}<span>{p.where}</span></span>{p.status && <span class="cu-chip good">{p.status}</span>}</span>
      <span class="cu-ordc-b"><span role="img" aria-label={`${money(p.paid)} of ${money(p.total)}`} class="cu-pay-bar"><span style={{ width: `${pct}%`, background: '#95530C' }} /></span><span class="mono">{`${money(p.paid)} of ${money(p.total)}`}</span></span>
    </div>
  );
}

export interface WhoOpt { id: string; initials: string; tint: Tint; name: string; sub: string; owes: number }

/** "6,000 left · who owes it?": the likely ones, the chosen one's share with its credit charge, and where it leaves them. */
export function WhoCard(p: { left: number; opts: WhoOpt[]; chosen: string | null; onPick: (id: string) => void; onFind: () => void; share: number; credit: { owes: number; limit: number | null; label: string } | null }): JSX.Element {
  return (
    <div class="cu-who-card">
      <span class="cu-who-h"><span><b class="mono">{money(p.left)}</b> left · who owes it?</span>
        <button type="button" aria-label="Find someone else" onClick={p.onFind}><Duo i={phSearch} size={18} color="#5F6980" /></button></span>
      <div role="radiogroup" aria-label="Who owes the rest" class="cu-who-list">
        {p.opts.map((o) => {
          const t = TINTS[o.tint], on = p.chosen === o.id, cr = p.credit;
          return [
            <button key={o.id} type="button" role="radio" aria-checked={on} onClick={() => p.onPick(o.id)}>
              <span aria-hidden="true" class="cu-who-av" style={{ background: t.bg, color: t.fg }}>{o.initials}</span>
              <span class="cu-who-t"><span>{o.name}</span><span>{o.sub}</span></span>
              {on && <span class="mono cu-who-amt">{money(p.share)}</span>}
              <span aria-hidden="true" class={cx('cu-choice-dot', on && 'on')}>{on && <Icon name="check" size={13} stroke={3.2} />}</span>
            </button>,
            // What the chosen one would owe, under their own row.
            on && cr && cr.limit ? (
              <span key={`${o.id}-credit`} role="img" aria-label={cr.label} class="cu-who-credit">
                <span aria-hidden="true"><span style={{ flex: Math.round(cr.owes / 1000) }} /><span style={{ flex: Math.max(1, Math.round(p.share / 1000)) }} /><span style={{ flex: Math.max(0, Math.round((cr.limit - cr.owes - p.share) / 1000)) }} /></span>
                <span>{'then owes '}<b class="mono">{money(cr.owes + p.share)}</b>{` of ${cr.limit >= 1e6 ? `${cr.limit / 1e6}M` : money(cr.limit)}`}</span>
              </span>
            ) : null,
          ];
        })}
      </div>
    </div>
  );
}
