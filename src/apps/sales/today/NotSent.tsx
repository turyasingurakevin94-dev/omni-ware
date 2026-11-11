/*
 * Waiting to send (cross-app round 1, SAL-3; board SalesNotSent): every write this phone has not put on the
 * books yet, oldest first. A refused one says why, how many tries and since when, with Remove (asked first:
 * "Remove it from this phone?", glossary) and Try again; a waiting one has its pill. One that is not sent
 * never holds up the others (the outbox orders writes per order, draft or customer). Send now tries them all.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { money } from '../../../core/money.ts';
import { orderNo } from '../../../core/names.ts';
import type { Kept } from '../../../core/outbox.ts';
import { clock, dayLabel } from '../../../core/time.ts';
import type { Books } from '../../../core/types.ts';
import { IconTile } from '../../../ui/ActRow.tsx';
import { Button } from '../../../ui/Button.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { StatusPill } from '../../../ui/Pill.tsx';
import { LightSheet, sheet } from '../../../ui/sheet.tsx';
import { toast } from '../../../ui/toast.tsx';
import { manager } from '../sell/people.ts';
import { unlockById } from '../shell/placing.ts';
import { books, discardKept, flush, kept, retryKept } from '../shell/store.ts';
import './notsent.css';

type A = Record<string, unknown>;
const arg = (k: Kept, i = 0): unknown => (Array.isArray(k.args) ? k.args[i] : k.args);
const obj = (k: Kept, i = 0): A => { const v = arg(k, i); return v && typeof v === 'object' ? (v as A) : {}; };

/** What a kept write is, in Sales' words. */
export function keptTitle(b: Books | null, k: Kept): string {
  const ruth = b ? manager(b).first : 'the Manager';
  const client = (o: A) => String(((o.client || {}) as A).name || 'a customer');
  switch (k.kind) {
    case 'placeOrder': return `Place order · ${client(obj(k))}`;
    case 'counterSale': return `Counter sale · ${client(obj(k))}`;
    case 'askCancel': return `Ask ${ruth} to cancel ${orderNo(Number(arg(k)))}`;
    case 'askBill': return `Ask ${ruth} to ${obj(k).kind === 'credit' ? 'credit' : 'void'} ${orderNo(Number(obj(k).orderId))}`;
    case 'receivePayment': return `Payment · ${money(Number(obj(k).amount) || 0)}`;
    case 'recordPromise': return 'Promise to pay';
    case 'addCustomer': return `New customer · ${String(obj(k).name || '')}`;
    case 'askSourcing': return `Ask Sourcing · ${String(obj(k).name || '')}`;
    case 'send': case 'sendTemplate': case 'sendImage': case 'sendCatalog': return 'A message';
    case 'markPriceTold': return `Told the new price · ${orderNo(Number(arg(k)))}`;
    case 'setClientPhone': case 'assignOrder': case 'counterLines': return `A change to ${orderNo(Number(arg(k)))}`;
    default: return 'A change';
  }
}

const since = (at: number, now: number): string => (dayLabel(at) === dayLabel(now) ? clock(at) : dayLabel(at));

function Row(p: { k: Kept; now: number }): JSX.Element {
  const b = books.value, k = p.k, [ask, setAsk] = useState(false), [busy, setBusy] = useState(false);
  const title = keptTitle(b, k);
  if (k.state !== 'refused') {
    return (
      <div class="td-ns-row">
        <IconTile tone="warn" icon={k.state === 'sending' ? 'send' : 'clock'} />
        <span class="td-ns-t"><b>{title}</b><span>{k.state === 'sending' ? 'Sending…' : `waiting · kept ${since(k.at, p.now)}`}</span></span>
        {k.state === 'sending' ? <span class="td-ns-spin" aria-hidden="true" /> : <StatusPill tone="caution" icon="clock">Waiting</StatusPill>}
      </div>
    );
  }
  // A removed place unlocks its order under "Still open", to fix and place again (SAL-4).
  const remove = async () => { setBusy(true); await discardKept(k.id); if (k.kind === 'placeOrder' || k.kind === 'counterSale') unlockById(k.id); toast.show('Removed from this phone'); };
  return (
    <div class="td-ns-card" role="group" aria-label={`${title}: not sent`}>
      <div class="td-ns-card-h"><IconTile tone="bad" icon="warning" />
        <span class="td-ns-t"><b>{title}</b><span class="bad">Not sent · {k.reason || 'the books said no'}</span>
          <span><span class="mono">{k.tries}</span>{k.tries === 1 ? ' try' : ' tries'} · since {since(k.at, p.now)}</span></span></div>
      {ask ? (
        <div class="td-ns-ask" role="alertdialog" aria-label="Remove it from this phone?">
          <b>Remove it from this phone?</b><span>It never reached the books. Nothing else changes.</span>
          <div class="td-ns-two"><Button kind="ghost" h={48} fs={15} onClick={() => setAsk(false)}>Keep it</Button>
            <Button kind="red" h={48} fs={15} state={busy ? 'sending' : 'idle'} onClick={() => { void remove(); }}>Remove</Button></div>
        </div>
      ) : (
        <div class="td-ns-two"><Button kind="ghost" h={48} fs={15} icon="trash" onClick={() => setAsk(true)}>Remove</Button>
          <Button kind="ghost" h={48} fs={15} icon="undo" state={busy ? 'sending' : 'idle'} onClick={() => { setBusy(true); void retryKept(k.id).finally(() => setBusy(false)); }}>Try again</Button></div>
      )}
    </div>
  );
}

function NotSentSheet(p: { now: number }): JSX.Element {
  const list = kept.value, [busy, setBusy] = useState(false);
  const bad = list.filter((k) => k.state === 'refused').length, wait = list.length - bad;
  if (!list.length) {
    return <LightSheet ground title="Nothing waiting" eyebrow="Waiting to send" onClose={() => sheet.close()}
      foot={<Button kind="navy" onClick={() => sheet.close()}>Back to Today</Button>}><p class="td-ns-empty"><Icon name="check" size={18} />Everything is on the books.</p></LightSheet>;
  }
  return (
    <LightSheet ground eyebrow="Waiting to send" title={`${list.length} not on the books yet`} onClose={() => sheet.close()}
      foot={wait > 0 ? <Button kind="navy" icon="undo" state={busy ? 'sending' : 'idle'} onClick={() => { setBusy(true); void flush().finally(() => setBusy(false)); }}>Send now</Button> : undefined}>
      <div class="td-ns-pills">{bad > 0 && <StatusPill tone="bad"><span class="mono">{bad}</span>&nbsp;not sent</StatusPill>}
        {wait > 0 && <StatusPill tone="caution"><span class="mono">{wait}</span>&nbsp;waiting</StatusPill>}<span class="td-ns-old">oldest first</span></div>
      {list.map((k) => <Row key={k.id} k={k} now={p.now} />)}
      <p class="td-ns-note"><Icon name="lock" size={14} />One that is not sent never holds up the others.</p>
    </LightSheet>
  );
}

export function openNotSent(now: number): void {
  sheet.open(() => <NotSentSheet now={now} />, { label: 'Waiting to send', top: 212 });
}

/** The Needs-you row's words: "2 not sent" when the books refused one, else "Waiting to send". */
export function notSentWords(list: Kept[]): { title: string; sub: string } {
  const bad = list.filter((k) => k.state === 'refused').length, wait = list.length - bad;
  return bad
    ? { title: `${list.length} not sent`, sub: `${bad} the books refused${wait ? ` · ${wait} waiting` : ''}` }
    : { title: 'Waiting to send', sub: `${wait} kept on this phone · sending` };
}
