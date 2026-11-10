/*
 * Today's rows (board Today): one row per supplier, its one next step on the row.
 *
 *   <AskRow g={…} />      Needs you: the navy Ask pill. WhatsApp: one tap writes the message, opens
 *                         WhatsApp and marks every line Asked. No WhatsApp: the Ask sheet (call, then the answer).
 *   <ReplyRow g={…} />    Replies due: "Yes · same" (they have it all at the same price); late (30 min) → "Ask again".
 *   <FromChip …/>         where the work came from in Sales: the seller's dot and #0550
 *   <Sees …/>             what Sales gets back: "Grace sees  Found · 09:25"
 *
 * States: pressed (the pill darkens, 95%), sending (a ring in the pill), error (a red edge,
 * the refused reason and Try again). A write kept on the phone (no signal) is not an error:
 * the offline band says it waits to send.
 */
import type { ComponentChildren, JSX } from 'preact';
import { useState } from 'preact/hooks';
import type { LineRef, SupplierGroup } from '../../../core/buyer/rules.ts';
import type { BOrder, BuyerBooks } from '../../../core/buyer/types.ts';
import { orderNo } from '../../../core/names.ts';
import { TINTS } from '../../../core/names.ts';
import type { Member } from '../../../core/types.ts';
import { IconTile } from '../../../ui/ActRow.tsx';
import { Icon, type IconName } from '../../../ui/icons.tsx';
import { toast } from '../../../ui/toast.tsx';
import { cx } from '../../../ui/util.tsx';
import { act, session } from '../shell/store.ts';
import { openAskSheet } from './AskSheet.tsx';
import { openNotFound } from '../orders/NotFound.tsx';
import { askText, firstName, hm, sellersOf, seeWord, waOf } from './rules.ts';

/** The board's eye ("… sees"): not in src/ui/icons.tsx yet. */
export function Eye(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** The seller's 12 px dot: their tint with their ink as a ring. */
export function Dot(p: { m: Member | undefined }): JSX.Element {
  const t = TINTS[p.m ? p.m.tint : 't4'] || TINTS.t4;
  return <i aria-hidden="true" class="ow-b-today-dot" style={{ background: t.bg, boxShadow: `inset 0 0 0 2px ${t.fg}` }} />;
}

export function FromChip(p: { b: BuyerBooks; o: BOrder; name?: boolean; navy?: boolean }): JSX.Element {
  const m = p.b.team.find((x) => x.id === p.o.sellerId), who = m ? firstName(m) : 'Sales';
  return (
    <span class={cx('ow-b-today-from', p.navy && 'navy')} aria-label={`From ${who}, order ${orderNo(p.o.id).slice(1)}`}>
      <Dot m={m} />{p.name && `${who} · `}<span class="mono">{orderNo(p.o.id)}</span>
    </span>
  );
}

export type ChipTone = 'good' | 'warn' | 'bad' | 'neutral';
export function Chip(p: { tone: ChipTone; children: ComponentChildren; icon?: IconName }): JSX.Element {
  return <span class={'ow-b-today-chip ' + p.tone}>{p.icon && <Icon name={p.icon} size={12} stroke={2.2} />}{p.children}</span>;
}

/** "Grace sees" and what Sales sees, as chips. */
export function Sees(p: { who: Member[]; children: ComponentChildren; class?: string; tail?: ComponentChildren }): JSX.Element | null {
  if (!p.who.length) return null;
  return <div class={cx('ow-b-today-sees', p.class)}><Eye />{seeWord(p.who)}{p.children}{p.tail}</div>;
}

type RowState = 'idle' | 'sending' | 'error';

/** One write from a row: sending, then a toast, or the refused reason on the row. */
function useWrite(): [RowState, string, (run: () => Promise<{ kept: boolean }>, ok: string, sub?: string) => void] {
  const [st, setSt] = useState<RowState>('idle');
  const [why, setWhy] = useState('');
  const go = (run: () => Promise<{ kept: boolean }>, ok: string, sub?: string) => {
    setSt('sending');
    run().then((r) => {
      setSt('idle');
      toast.show(r.kept ? 'Kept on this phone' : ok, r.kept ? { kind: 'warn', sub: 'It sends when the signal comes back' } : { sub });
    }).catch((e: unknown) => { setWhy(String((e as Error).message || e)); setSt('error'); });
  };
  return [st, why, go];
}

const Spin = () => <span aria-hidden="true" class="ow-spin ow-b-today-spin" />;

/** The navy pill on the row. */
function Pill(p: { st: RowState; word: ComponentChildren; sending?: string; label: string; on: () => void; icon?: IconName }): JSX.Element {
  const busy = p.st === 'sending';
  return (
    <button type="button" class={cx('ow-b-today-pill', busy && 'busy')} aria-label={p.st === 'error' ? `Try again: ${p.label}` : p.label}
      aria-busy={busy || undefined} onClick={busy ? undefined : p.on}>
      {busy ? <><Spin />{p.sending || 'Sending…'}</> : p.st === 'error' ? <><Icon name="undo" size={14} stroke={2.4} />Try again</>
        : <>{p.icon && <Icon name={p.icon} size={14} stroke={2.4} />}{p.word}</>}
    </button>
  );
}

function linesWord(g: SupplierGroup): string {
  if (g.lines.length === 1) { const l = g.lines[0].line; return `${l.name} · ${l.qty}`; }
  return `${g.lines.length} lines`;
}

/** Open WhatsApp with the message now (inside the tap, so the phone allows it), then mark it asked. */
function whatsapp(g: SupplierGroup): void {
  const shop = session.value ? session.value.shopName : 'the shop';
  window.open(waOf(g.supplier.phone, askText(g, shop)), '_blank', 'noopener');
}

export function AskRow(p: { b: BuyerBooks; g: SupplierGroup }): JSX.Element {
  const { g } = p, s = g.supplier;
  const [st, why, go] = useWrite();
  const ask = () => {
    if (!s.whatsapp) { openAskSheet(p.b, g); return; }
    whatsapp(g);
    go(() => act('ask', s.id, 'whatsapp'), `Asked ${s.name}`);
  };
  return (
    <div class={cx('ow-b-today-row', st === 'error' && 'error')}>
      <IconTile tone={st === 'error' ? 'bad' : 'warn'} icon={st === 'error' ? 'warning' : 'message'} />
      <div class="ow-b-today-row-t">
        <span class="ow-b-today-row-name">{s.name}</span>
        {st === 'error' ? <span class="mono ow-b-today-row-why">{`Not saved · ${why}`}</span> : (
          <span class="ow-b-today-row-sub">
            {g.orders.slice(0, 2).map((o) => <FromChip key={o.id} b={p.b} o={o} />)}
            <span class="mono">{linesWord(g)}</span>
          </span>
        )}
      </div>
      <Pill st={st} word="Ask" sending={s.whatsapp ? 'WhatsApp' : undefined} on={ask}
        label={`Ask ${s.name}${s.whatsapp ? ' on WhatsApp' : ''}, ${g.lines.length} line${g.lines.length === 1 ? '' : 's'}`} />
    </div>
  );
}

export function ReplyRow(p: { b: BuyerBooks; g: SupplierGroup }): JSX.Element {
  const { g } = p, s = g.supplier, who = sellersOf(p.b, g.orders);
  const [st, why, go] = useWrite();
  const yes = () => go(() => act('answerYes', s.id), `${s.name} · Found`, who.length ? `${seeWord(who)} it` : undefined);
  const again = () => {
    if (!s.whatsapp) { openAskSheet(p.b, g); return; }
    whatsapp(g);
    go(() => act('ask', s.id, 'whatsapp'), `Asked ${s.name} again`);
  };
  return (
    <div class={cx('ow-b-today-row', 'reply', st === 'error' && 'error')}>
      <IconTile tone={st === 'error' ? 'bad' : g.late ? 'warn' : 'neutral'} icon={st === 'error' ? 'warning' : 'clock'} />
      <div class="ow-b-today-row-t">
        <span class="ow-b-today-row-name">{s.name}</span>
        {st === 'error' ? <span class="mono ow-b-today-row-why">{`Not saved · ${why}`}</span> : (
          <>
            {g.askedAt != null && <span class={cx('mono ow-b-today-row-at', g.late && 'late')}>{`Asked · ${hm(g.askedAt)}`}</span>}
            <span class="ow-b-today-row-sub">{g.orders.slice(0, 3).map((o) => <FromChip key={o.id} b={p.b} o={o} />)}</span>
          </>
        )}
      </div>
      {g.late
        ? <Pill st={st} word="Ask again" on={again} label={`Ask ${s.name} again`} />
        : <Pill st={st} word="Yes · same" icon="check" on={yes} label={`${s.name} said yes, same price`} />}
    </div>
  );
}

/** Needs you (board Additions2, phone I): a line a supplier said no to; the pill opens the Not found sheet. */
export function NotFoundRow(p: { b: BuyerBooks; r: LineRef }): JSX.Element {
  const { order, line } = p.r, sup = p.b.suppliers.find((s) => s.id === line.supplierId);
  const seller = p.b.team.find((m) => m.id === order.sellerId), who = sup ? sup.name.split(' ')[0] : 'They';
  return (
    <>
      <div class="ow-b-today-row nf">
        <IconTile tone="bad" icon="close" />
        <div class="ow-b-today-row-t">
          <span class="ow-b-today-row-name">{line.name}</span>
          <span class="mono ow-b-today-row-at">{`${who} said no · ${orderNo(order.id)}`}</span>
        </div>
        <button type="button" class="ow-b-today-pill" aria-label={`${line.name} not found for order ${orderNo(order.id).slice(1)}: choose what next`}
          onClick={() => openNotFound(order.id, line.key)}>Not found ›</button>
      </div>
      {seller && <div class="ow-b-today-sees"><Icon name="bell" size={14} stroke={2} />{`${firstName(seller)} sees: `}<b class="ow-b-today-nf-w">Not found</b></div>}
    </>
  );
}
