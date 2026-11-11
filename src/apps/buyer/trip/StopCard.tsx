/*
 * The stop the Buyer is at (TripOn.dc.html): its lines, a navy "Got it all"
 * (every line's qty, paid as planned: one tap) and a quieter "Short" that
 * opens a stepper per line (got N of M) and what was paid. The amount pill
 * opens the paid field alone (paid differently). Done writes the stop.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import type { StopCount } from '../../../core/buyer/source.ts';
import { shortWord } from '../../../core/buyer/rules.ts';
import type { BuyerBooks, Stop } from '../../../core/buyer/types.ts';
import { counted, firstWord, orderNo } from '../../../core/names.ts';
import { Button } from '../../../ui/Button.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { fig } from '../../../ui/Money.tsx';
import { Callout } from '../../../ui/Notice.tsx';
import { Stepper } from '../../../ui/Stepper.tsx';
import { cx } from '../../../ui/util.tsx';
import { memberOf, stopLines, supplierOf } from './model.ts';
import { OrderChip } from './parts.tsx';
import './on.css';

type Mode = 'plain' | 'short' | 'paid';

export interface StopCardProps {
  b: BuyerBooks;
  n: number;
  stop: Stop;
  /** Cash in hand before this stop. */
  inHand: number;
  onDone: (counts: StopCount[], paid: number) => Promise<void>;
}

const digits = (s: string): number | null => { const d = s.replace(/[^0-9]/g, ''); return d ? Number(d) : null; };

export function StopCard(p: StopCardProps): JSX.Element {
  const rows = stopLines(p.b, p.stop), sup = supplierOf(p.b, p.stop.supplierId);
  const name = sup ? sup.name : 'Supplier';
  // A cancel asked after the cash (BUY-1, board XR1Hold "Already on the trip"): its lines start at 0, don't buy them;
  // Ruth cancels after the hand-in (0177 refuses a cancel on a live trip).
  const anyHeld = rows.some((r) => !!r.order.hold);
  const [mode, setMode] = useState<Mode>(anyHeld ? 'short' : 'plain');
  const [got, setGot] = useState<Record<string, number>>(() => Object.fromEntries(rows.map((r) => [r.order.id + r.line.key, r.order.hold ? 0 : r.line.qty])));
  const [typed, setTyped] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'error'>('idle');
  const [why, setWhy] = useState('');

  const counts = (all: boolean): StopCount[] => rows.map((r) => ({ orderId: r.order.id, key: r.line.key, got: all ? r.line.qty : got[r.order.id + r.line.key] }));
  const auto = rows.reduce((t, r) => t + got[r.order.id + r.line.key] * r.line.cost, 0);
  const paid = typed != null ? digits(typed) : mode === 'short' ? auto : p.stop.planned;
  const shorts = rows.filter((r) => got[r.order.id + r.line.key] < r.line.qty);
  // Paid differently hides the lines: the head says what the payment is for (phone 3, "20 bag · #0550").
  const what = [rows.length === 1 ? `${rows[0].line.qty} ${rows[0].line.unit}` : counted(rows.length, 'line'), ...[...new Set(rows.map((r) => r.order.id))].map(orderNo)].join(' · ');

  const go = async (c: StopCount[], amount: number) => {
    setState('sending'); setWhy('');
    try { await p.onDone(c, amount); } catch (e) { setState('error'); setWhy(String((e as Error).message || e)); return; }
    setState('idle');
  };
  const done = () => { if (paid != null) void go(counts(mode !== 'short'), paid); };
  const allIn = () => { void go(counts(true), p.stop.planned); };

  const field = (
    <label class="ow-b-on-paid">
      <span>Paid</span>
      <span class="ow-b-on-field"><span class="mono">UGX</span>
        <input class="mono" inputMode="numeric" autoFocus value={typed ?? (paid != null ? fig(paid) : '')} aria-label={`Paid at ${name}`}
          onInput={(e) => { const d = digits((e.target as HTMLInputElement).value); setTyped(d == null ? '' : fig(d)); }} />
      </span>
    </label>
  );

  return (
    <div class="ow-b-on-card">
      <div class="ow-b-on-head">
        <span class="mono ow-b-on-n now">{p.n}</span>
        <span class="ow-b-on-t"><b>{name}</b><span class="mono">{mode === 'paid' ? what : `${sup ? sup.place : ''} · now`}</span></span>
        {mode === 'short' ? <span class="ow-b-on-short">Short</span>
          : mode === 'plain' && (
            <button type="button" class="mono ow-b-on-pay" onClick={() => setMode('paid')} aria-label={`Pay ${fig(p.stop.planned)}. Tap if you paid a different amount`}>
              {fig(p.stop.planned)}<Icon name="pen" size={14} stroke={2} />
            </button>
          )}
      </div>
      {mode !== 'paid' && rows.map((r) => {
        const k = r.order.id + r.line.key, g = got[k];
        return (
          <div key={k} class="ow-b-on-line">
            <div class="ow-b-on-lrow">
              <span class="ow-b-on-lt"><span>{r.line.name}</span><OrderChip who={memberOf(p.b, r.order.sellerId)} id={r.order.id} />
                {r.order.hold && <span class="ow-b-on-hold"><Icon name="pause" size={13} stroke={2.2} />Cancel asked · don't buy</span>}</span>
              {mode === 'short'
                ? <Stepper value={g} unit={`of ${r.line.qty}`} min={0} max={r.line.qty} what={`${r.line.name} for ${orderNo(r.order.id)}`} onChange={(v) => setGot({ ...got, [k]: v })} />
                : <span class="mono ow-b-on-qty">{r.line.qty} <small>{r.line.unit}</small></span>}
            </div>
            {mode === 'short' && <span class="ow-b-on-lbar" aria-hidden="true"><i class={cx(g < r.line.qty && 'short')} style={{ width: `${r.line.qty ? (g / r.line.qty) * 100 : 0}%` }} /></span>}
          </div>
        );
      })}
      {mode === 'short' && (typed == null
        ? <button type="button" class="ow-b-on-payrow" onClick={() => setTyped(fig(auto))} aria-label={`Pay ${fig(auto)}. Tap to type what you paid`}>
            <span>Pay</span><span>{auto !== p.stop.planned && <s class="mono">{fig(p.stop.planned)}</s>}<b class="mono">{fig(auto)}</b></span>
          </button>
        : field)}
      {mode === 'paid' && field}
      {mode === 'paid' && <PaidFacts planned={p.stop.planned} paid={paid} inHand={p.inHand} perUnit={rows.length === 1 ? { qty: rows[0].line.qty, unit: rows[0].line.unit } : null} />}
      {mode === 'short' && shorts.length > 0 && (
        <Callout tone="warn" icon="bell">
          {`${firstWord(memberOf(p.b, shorts[0].order.sellerId)?.name || 'Sales')} sees: `}<b>{shortWord(got[shorts[0].order.id + shorts[0].line.key], shorts[0].line.qty)}</b>
        </Callout>
      )}
      {state === 'error' && (
        <div class="ow-b-on-err" role="alert">
          <Icon name="warning" size={18} stroke={2} /><span>Not saved</span>
          <button type="button" onClick={mode === 'plain' ? allIn : done}>Try again</button>
        </div>
      )}
      {state === 'error' && why && <span class="ow-b-on-why">{why}</span>}
      {mode === 'plain' ? (
        <div class="ow-b-on-acts">
          <Button h={48} fs={15} icon={state === 'sending' ? undefined : 'check'} state={state === 'sending' ? 'sending' : 'idle'} onClick={allIn} label={`Got it all at ${name}`}>Got it all</Button>
          {state !== 'sending' && <button type="button" class="ow-b-on-shortbtn" onClick={() => setMode('short')} aria-label={`Short at ${name}`}><Icon name="minus" size={16} stroke={2.2} />Short</button>}
        </div>
      ) : (
        <Button h={48} fs={15} state={state === 'sending' ? 'sending' : paid == null ? 'disabled' : 'idle'} onClick={done}>Done</Button>
      )}
    </div>
  );
}

/** Paid differently: the plan struck, the difference, per unit and what is left in hand. */
function PaidFacts(p: { planned: number; paid: number | null; inHand: number; perUnit: { qty: number; unit: string } | null }): JSX.Element {
  const diff = p.paid == null ? 0 : p.paid - p.planned;
  return (
    <>
      <div class="ow-b-on-plan">
        <span class="mono">{p.paid != null && diff !== 0 ? <s>{fig(p.planned)}</s> : fig(p.planned)} planned</span>
        {p.paid != null && diff !== 0 && <span class={cx('mono ow-b-on-diff', diff > 0 && 'over')}>{fig(diff, false, true)}</span>}
      </div>
      {p.paid != null && (
        <div class="ow-b-on-tiles">
          {p.perUnit && p.perUnit.qty > 0 && <span><b class="mono">{fig(Math.round(p.paid / p.perUnit.qty))}</b><small>{`per ${p.perUnit.unit}`}</small></span>}
          <span><b class="mono">{fig(p.inHand - p.paid)}</b><small>left in hand</small></span>
        </div>
      )}
    </>
  );
}
