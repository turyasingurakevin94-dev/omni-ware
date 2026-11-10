/*
 * Change or cancel before the bill (OR17, OR18), and an order entered twice (OR19 live: ask Ruth to
 * cancel the copy; OR23 invoiced: ask Ruth to void it). Sales asks; the Manager decides
 * (decision-rights: cancels and voids are hers). Asking is undone from the toast (withdraw).
 */
import type { ComponentChildren, JSX } from 'preact';
import { useState } from 'preact/hooks';
import { orderTotal } from '../../../core/money.ts';
import { counted, firstWord, orderNo, STAGE_WORD, STAGES } from '../../../core/names.ts';
import { clock, weekday } from '../../../core/time.ts';
import type { Books, Order } from '../../../core/types.ts';
import { Avatar, type Face } from '../../../ui/Avatar.tsx';
import { Chevron } from '../../../ui/ActRow.tsx';
import { Icon, STAGE_ICON } from '../../../ui/icons.tsx';
import { ItemSquare } from '../../../ui/ItemSquare.tsx';
import { LightSheet, sheet } from '../../../ui/sheet.tsx';
import { toast } from '../../../ui/toast.tsx';
import { act, books, now } from '../shell/store.ts';
import { twinOf } from '../../../core/orders.ts';
import { byRole, faceOfMember, nameOf, openAsk, orderOf, shortItem, shortName } from './data.ts';
import { StageDots } from '../../../ui/Track.tsx';
import './sheets.css';

const eyebrow = (b: Books, o: Order) => `Order ${orderNo(o.id)} · ${nameOf(b, o)}`;
const ruthOf = (b: Books) => byRole(b, 'manager');

/** A face and a line under it: who does the next step. */
export function Who(p: { face?: Face; children: ComponentChildren }): JSX.Element {
  return <div class="or-who">{p.face && <Avatar {...p.face} size={24} />}<span>{p.children}</span></div>;
}

/** The one navy button that sends an ask. */
export function SendBtn(p: { busy: boolean; on: () => void; children: ComponentChildren }): JSX.Element {
  return (
    <div class="or-send">
      <button type="button" class="or-btn-n" onClick={p.on} disabled={p.busy}>{p.busy ? <span class="ow-spin" aria-hidden="true" /> : <Icon name="send" size={18} stroke={2} />}{p.busy ? 'Sending…' : p.children}</button>
    </div>
  );
}

/** Send an ask, close the sheet, say so with Undo (the ask taken back). */
async function ask(run: () => Promise<{ kept: boolean; value?: unknown }>, said: string, undo: ((id: string) => void) | null, setBusy: (v: boolean) => void): Promise<void> {
  setBusy(true);
  try {
    const r = await run();
    sheet.close();
    const id = !r.kept && r.value && typeof r.value === 'object' ? (r.value as { id: string }).id : '';
    toast.show(r.kept ? 'Kept on this phone' : said, { kind: r.kept ? 'warn' : 'ok', undo: id && undo ? () => undo(id) : undefined });
  } catch (e) { toast.show((e as Error).message, { kind: 'error' }); } finally { setBusy(false); }
}
const takeBack = (id: string) => { act('withdrawBillAsk', id).then(() => toast.show('Ask taken back'), (e) => toast.show((e as Error).message, { kind: 'error' })); };

/** OR17 · what can still change at this stage; or, for a copy entered twice, OR19 straight away. */
export function openChange(id: number): void {
  const b = books.value, o = b && orderOf(b, id);
  if (!b || !o) return;
  const tw = twinOf(b.orders, o);
  if (tw && tw.copy.id === o.id) { openTwice(id); return; }
  sheet.open(() => <ChangeSheet id={id} />, { label: 'Change this order', top: 430 });
}

function ChangeSheet(p: { id: number }): JSX.Element | null {
  const b = books.value, o = b && orderOf(b, p.id);
  if (!b || !o) return null;
  const ruth = ruthOf(b), rn = firstWord(ruth?.name || 'Manager'), rf = ruth ? faceOfMember(ruth) : undefined, at = STAGES.indexOf(o.stage);
  const asked = openAsk(b, o, 'cancel');
  return (
    <LightSheet class="or-sheet or-full" ground eyebrow={eyebrow(b, o)} title="Change this order" onClose={sheet.close} pad="12px 16px 26px">
      <div role="img" aria-label={`${STAGE_WORD[o.stage]} now. Until it is delivered ${rn} can cancel it; after that it is a return`} class="or-smap">
        <div class="or-smap-g">
          {STAGES.map((s, i) => (
            <span key={s} class={i === at ? 'now' : s === 'delivered' ? 'ret' : i < at ? 'past' : ''}>
              <span><Icon name={STAGE_ICON[s]} size={15} stroke={2.2} /></span><b>{STAGE_WORD[s]}</b>
            </span>
          ))}
        </div>
        <div class="or-smap-g"><span class="or-smap-c"><i /><b>{`${rn} cancels it`}</b></span><span class="or-smap-r"><i /><b>Return</b></span></div>
      </div>
      <div class="or-rows">
        {asked ? (
          <div class="or-row">
            <span aria-hidden="true" class="or-row-ic bad"><Icon name="close" size={19} stroke={2.2} /></span>
            <span class="or-row-t"><span class="bad wt">Cancel asked<span class="or-wait">Waiting</span></span><span class="nw">{rf && <Avatar {...rf} size={18} />}{`${rn} · ${clock(asked.at)}`}</span></span>
            <button type="button" class="or-undo" aria-label="Undo the cancel ask" onClick={() => takeBack(asked.id)}><span><Icon name="undo" size={14} stroke={2.4} />Undo</span></button>
          </div>
        ) : (
          <button type="button" class="or-row" onClick={() => openCancel(o.id)}>
            <span aria-hidden="true" class="or-row-ic bad"><Icon name="close" size={19} stroke={2.2} /></span>
            <span class="or-row-t"><span class="bad">Cancel order</span><span>{rf && <Avatar {...rf} size={18} />}{`${rn} decides · ${o.paid > 0 ? `${o.paid.toLocaleString('en-US')} paid` : 'nothing paid yet'}`}</span></span>
            <Chevron />
          </button>
        )}
        <div class="or-row off" aria-disabled="true">
          <span aria-hidden="true" class="or-row-ic"><Icon name="pen" size={19} stroke={2} /></span>
          <span class="or-row-t"><span>Edit items</span><span class="soft">{rf && <Avatar {...rf} size={18} />}{`${rn} changes items in ${STAGE_WORD[o.stage]}`}</span></span>
        </div>
      </div>
    </LightSheet>
  );
}

const WHY = (who: string) => [`${who} changed their mind`, 'Entered twice', 'Wrong items or how many', 'Something else'];

/** OR18 · cancel before the bill: what it is, what is paid, who decides; why; ask Ruth. */
export function openCancel(id: number): void {
  sheet.open(() => <CancelSheet id={id} />, { label: 'Cancel this order?', top: 196 });
}

function CancelSheet(p: { id: number }): JSX.Element | null {
  const b = books.value, o = b && orderOf(b, p.id);
  const [why, setWhy] = useState(0);
  const [busy, setBusy] = useState(false);
  if (!b || !o) return null;
  const ruth = ruthOf(b), rn = firstWord(ruth?.name || 'Manager'), store = byRole(b, 'store'), list = WHY(shortName(b, o));
  return (
    <LightSheet class="or-sheet" ground eyebrow={eyebrow(b, o)} title="Cancel this order?" onClose={sheet.close} pad="12px 16px 22px">
      <div class="or-trio">
        <span><span>Order</span><span class="mono">{orderTotal(o).toLocaleString('en-US')}</span></span>
        <span><span>Paid</span><span class="mono good">{o.paid.toLocaleString('en-US')}</span></span>
        <span><span>Decides</span><span class="mono"><span class="or-trio-who">{ruth && <Avatar {...faceOfMember(ruth)} size={22} />}<span>{rn}</span></span></span></span>
      </div>
      <span class="or-label">{`Why · ${rn} sees it`}</span>
      <div role="radiogroup" aria-label="Why" class="or-radios">
        {list.map((w, i) => (
          <label key={w} class={i === why ? 'on' : ''}>
            <input type="radio" name="why" checked={i === why} onChange={() => setWhy(i)} /><span aria-hidden="true" />{w}
          </label>
        ))}
      </div>
      {store && <Who face={faceOfMember(store)}>{`If anything was packed, ${firstWord(store.name)} puts it back`}</Who>}
      <div class="or-two h">
        <button type="button" class="or-btn-w" onClick={sheet.close}>Keep order</button>
        <button type="button" class="or-btn-n" disabled={busy} onClick={() => ask(() => act('askCancel', o.id, list[why]), `Asked ${rn} to cancel ${orderNo(o.id)}`, takeBack, setBusy)}>{busy ? 'Sending…' : `Ask ${rn} to cancel`}</button>
      </div>
    </LightSheet>
  );
}

/** OR19, OR23 · the two side by side, what makes them the same, and ask Ruth to cancel (or void) the copy. */
export function openTwice(id: number): void {
  const b = books.value, o = b && orderOf(b, id), tw = b && o && twinOf(b.orders, o);
  if (!b || !o || !tw) return;
  sheet.open(() => <TwiceSheet id={tw.copy.id} />, { label: 'Entered twice?', top: 150 });
}

function Card(p: { b: Books; o: Order; copy?: boolean; t: number }): JSX.Element {
  const { b, o } = p, by = b.members.find((m) => m.id === o.placedBy);
  return (
    <div class={'or-tw' + (p.copy ? ' copy' : '')}>
      <span class="or-tw-h"><b class="mono">{orderNo(o.id)}</b>{p.copy && <span class="or-tw-pill">Copy</span>}</span>
      {o.invoiced && o.invoicedAt
        ? <span class="or-tw-s">{'Invoice · '}<span class="mono">{`${weekday(o.invoicedAt)} ${clock(o.invoicedAt)}`}</span></span>
        : <span class="or-tw-s"><span class="mono">{clock(o.placedAt)}</span>{` · ${firstWord(by?.name || '')}`}</span>}
      <span class="or-tw-l">
        {o.lines.map((l) => (
          <span key={l.lineId}><ItemSquare aisle={b.items.find((i) => i.id === l.itemId)?.aisle || ''} size={26} radius={7} icon={15} /><span class="mono">{l.qty}</span><span>{shortItem(l.name)}</span></span>
        ))}
      </span>
      <span class="mono or-tw-t">{orderTotal(o).toLocaleString('en-US')}</span>
    </div>
  );
}

function TwiceSheet(p: { id: number }): JSX.Element | null {
  const b = books.value, o = b && orderOf(b, p.id), tw = b && o && twinOf(b.orders, o), t = now.value;
  const [busy, setBusy] = useState(false);
  if (!b || !o || !tw) return null;
  const { orig, copy } = tw, ruth = ruthOf(b), rn = firstWord(ruth?.name || 'Manager'), rf = ruth ? faceOfMember(ruth) : undefined, store = byRole(b, 'store');
  const mins = Math.max(1, Math.round(Math.abs(copy.placedAt - orig.placedAt) / 60000)), apart = `${counted(mins, 'minute')} apart`;
  const billed = copy.invoiced, paidOn = [orig, copy].filter((x) => x.paid > 0);
  const checks = billed
    ? ['Same customer, same items', `Both invoiced, ${apart}`, paidOn.length === 1 ? `Paid once, on ${orderNo(paidOn[0].id)}` : paidOn.length ? 'Both paid' : 'Nothing paid']
    : ['Same customer', 'Same items, same total', `${apart} · ${copy.paid + orig.paid > 0 ? 'paid' : 'nothing paid'}`];
  const send = () => (billed
    ? ask(() => act('askBill', { orderId: copy.id, kind: 'void', amount: orderTotal(copy), reason: 'Raised twice', note: `Entered twice: the same as ${orderNo(orig.id)}` }), `Asked ${rn} to void ${orderNo(copy.id)}`, takeBack, setBusy)
    : ask(() => act('askCancel', copy.id, 'Entered twice'), `Asked ${rn} to cancel ${orderNo(copy.id)}`, takeBack, setBusy));
  return (
    <LightSheet class="or-sheet" ground eyebrow={eyebrow(b, copy)} title="Entered twice?" onClose={sheet.close} pad="12px 16px 22px">
      <div class="or-tws"><Card b={b} o={orig} t={t} /><Card b={b} o={copy} copy t={t} /></div>
      <div class="or-checks">{checks.map((c) => <div key={c}><span aria-hidden="true"><Icon name="check" size={11} stroke={3.2} /></span><span>{c}</span></div>)}</div>
      <div class="or-dots"><StageDots stage={copy.stage} all={copy.stage === 'delivered'} skipped={copy.stageLog.some((x) => x.stage === 'checking') ? [] : STAGES.slice(0, STAGES.indexOf(copy.stage)).filter((s) => !copy.stageLog.some((x) => x.stage === s))} /></div>
      {billed ? <Who face={rf}>{`${rn} voids ${orderNo(copy.id)} · ${copy.paid > 0 ? 'the money goes back' : 'nothing to give back'}`}</Who> : <>
        <Who face={rf}>{`${rn} cancels ${orderNo(copy.id)}`}</Who>
        {store && <Who face={faceOfMember(store)}>{`${firstWord(store.name)} puts back what was packed`}</Who>}
      </>}
      <SendBtn busy={busy} on={send}>{`Ask ${rn} to ${billed ? 'void' : 'cancel'} ${orderNo(copy.id)}`}</SendBtn>
    </LightSheet>
  );
}
