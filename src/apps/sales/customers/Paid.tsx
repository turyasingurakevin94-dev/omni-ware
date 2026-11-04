/*
 * customers/paid { id } · Paid (CU40–CU47: kept, refused, thrown away). The tick, who paid how much and
 * how, the change to hand back now (cash over), the receipt slip (bill by
 * bill, a deposit kept, what they owe now), whether the receipt reached
 * them (or Send by SMS, Try again), and the one way out: Back to Today.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { toast } from '../../../ui/toast.tsx';
import { EndOfFlow } from '../../../ui/Moment.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { money } from '../../../core/money.ts';
import { orderNo, TINTS } from '../../../core/names.ts';
import { clock, dayOf } from '../../../core/time.ts';
import type { Tint } from '../../../core/types.ts';
import { nav } from '../shell/nav.ts';
import { books, flush, now } from '../shell/store.ts';
import type { ScreenProps } from '../shell/types.ts';
import { moneyOf, short } from './data.ts';
import { dm } from './pay-parts.tsx';
import { paidResults, receiptText, sendReceipt, throwAway, type Paid } from './paid-store.ts';
import './paid.css';

const HOW = { cash: 'Cash', momo: 'Mobile', bank: 'Bank' } as const;
const refShort = (r: string) => (r.length > 10 ? `${r.slice(0, 4)}…${r.slice(-4)}` : r);

export function PaidScreen(p: ScreenProps): JSX.Element {
  const r = paidResults.value[String(p.params.id)];
  if (!r) return <main class="cu-paid"><EndOfFlow on={nav.home} /></main>;
  return <PaidView p={r} />;
}

function PaidView(props: { p: Paid }): JSX.Element {
  const p = props.p, b = books.value, name = short(p.name), t = TINTS[p.tint as Tint] || TINTS.t4;
  const how = p.method === 'cash'
    ? (p.deposit ? `Cash · ${name} said keep ${money(p.deposit)}` : 'Cash')
    : `${HOW[p.method]}${p.ref ? ` · ${p.method === 'momo' ? 'ID' : 'ref'} ${refShort(p.ref)}` : ''}`;
  const pct = p.before ? Math.round(((p.before - p.after) / p.before) * 100) : 100;
  const stamp = `${dm(dayOf(p.at))} · ${clock(p.at)}`;
  // Refused or thrown away: what they owe now, from the books, never the figure from when Grace slid.
  const c = b && p.customerId ? b.customers.find((x) => x.id === p.customerId) || null : null;
  const owesNow = b && c ? moneyOf(b, c, dayOf(now.value)).owes : p.before;
  const refused = p.kept && !!p.refused;
  // Why it was refused: someone else's payment of theirs since Grace slid (CU46: Brian took 120,000 at 10:50).
  const since = b && c && refused ? b.payments.filter((x) => x.customerId === c.id && !x.qa && x.by && x.by !== b.me.id && x.at >= p.at).sort((x, y) => y.at - x.at)[0] : null;
  const by = since && b ? b.members.find((m) => m.id === since.by) || null : null;
  const byT = by ? TINTS[by.tint as Tint] || TINTS.t4 : null;
  // Try again: a tap is never silent. Still kept after the try: say so (CU45).
  const [trying, setTrying] = useState(false);
  const again = async () => {
    setTrying(true);
    try { await flush(); } catch (_e) { /* still kept */ } finally { setTrying(false); }
    const now0 = paidResults.value[p.key];
    if (now0 && now0.kept && !now0.refused) toast.show('Still no signal', { kind: 'warn' });
  };
  const sms = () => {
    const text = b ? receiptText(p, b.shop.name) : '';
    window.location.href = `sms:${p.phone.replace(/\s/g, '')}?body=${encodeURIComponent(text)}`;
  };
  return (
    <main class={refused || p.discarded ? 'cu-paid stay' : 'cu-paid'}>
      <div class="cu-paid-x"><button type="button" aria-label="Close" onClick={nav.home}><Icon name="close" size={16} stroke={2.2} /></button></div>
      <div class="cu-paid-top">
        <span aria-hidden="true" class={refused ? 'cu-paid-tick refused' : p.kept || p.discarded ? 'cu-paid-tick kept' : 'cu-paid-tick'}>
          <Icon name={refused ? 'warning' : p.kept ? 'clock' : p.discarded ? 'close' : 'check'} size={refused ? 32 : 34} stroke={p.kept ? 2.4 : 2.8} /></span>
        <h1>{refused || p.discarded ? 'Not recorded' : p.kept ? 'Not sent yet' : 'Paid'}</h1>
        <span class="cu-paid-who"><span aria-hidden="true" style={{ background: t.bg, color: t.fg }}>{p.initials}</span><span>{p.name}</span><span class="mono">{money(p.amount)}</span></span>
        <span class="cu-paid-how">{how}</span>
      </div>
      {p.change > 0 && (
        <div class="cu-paid-change">
          <span aria-hidden="true"><Icon name="cash" size={22} stroke={2} /></span>
          <span><span>Give change now</span><span>they gave <b class="mono">{money(p.given)}</b></span></span>
          <b class="mono">{money(p.change)}</b>
        </div>
      )}
      <div class="cu-slip">
        <div class="cu-slip-edge top" />
        <div class="cu-slip-b">
          <div class="cu-slip-h"><span>{(b ? b.shop.name : '').toUpperCase()}</span><span class="mono">{stamp}</span></div>
          {p.lines.map((l) => (
            <div key={l.id} class={p.kept || p.discarded ? 'cu-slip-l hollow' : 'cu-slip-l'}><span aria-hidden="true"><Icon name="check" size={11} stroke={3.2} /></span>
              <span>{`${orderNo(l.id)} `}<span>{dm(l.day)}</span></span><span class="mono">{money(l.amount)}</span></div>
          ))}
          {p.deposit > 0 && (
            <div class="cu-slip-l dep"><span aria-hidden="true" /><span>Deposit <span>next bill uses it</span></span><span class="mono">{money(p.deposit)}</span></div>
          )}
          <div class="cu-slip-t"><span>{refused || p.discarded ? 'Not recorded' : p.kept ? 'To record' : 'Paid'}</span><span class="mono">{money(p.amount)}</span></div>
          {refused ? null : p.discarded
            // Thrown away: what the books say now, nothing struck, nothing filled (CU47).
            ? <div class="cu-slip-o gone"><span>Still owes</span><span aria-hidden="true" /><b class="mono">{money(owesNow)}</b></div>
            : <div class={p.kept ? 'cu-slip-o kept' : 'cu-slip-o'}><span>{p.kept ? 'Once it records' : 'Owes now'}</span><span aria-hidden="true"><span style={{ width: `${pct}%` }} /></span><s class="mono">{money(p.before)}</s><b class="mono">{money(p.after)}</b></div>}
        </div>
        <div class="cu-slip-edge bottom" />
      </div>
      {refused && (
        // CU46: the shop said no. Its reason, word for word; why, with the books' figure; Fix it or Throw it away.
        <div class="cu-rc failed">
          <span class="cu-rc-row"><span aria-hidden="true" class="cu-rc-ic bad"><Icon name="warning" size={20} stroke={2} /></span>
            <span class="cu-rc-t"><span>The shop said no</span><span>{`“${p.refused}”`}</span></span></span>
          <span class="cu-rc-why">
            {by && byT && <span aria-hidden="true" style={{ background: byT.bg, color: byT.fg }}>{by.initials}</span>}
            <span>{since && by ? <><span>{`${by.name.split(/\s+/)[0]} took `}<b class="mono">{money(since.amount)}</b>{` at ${clock(since.at)}`}</span>
              <span>{`so ${name} owes `}<b class="mono">{money(owesNow)}</b>{' now'}</span></>
              : <span>{`${name} owes `}<b class="mono">{money(owesNow)}</b>{' now'}</span>}</span>
          </span>
          <span class="cu-rc-acts">
            {p.customerId && p.keptId && <button type="button" class="cu-rc-sms" onClick={() => nav.push('customers/pay', { customer: p.customerId as string, fix: p.keptId as string, paid: p.key })}><Icon name="pen" size={17} stroke={2.2} />Fix it</button>}
            <button type="button" class="cu-rc-again" onClick={() => throwAway(p.key)}><Icon name="trash" size={15} stroke={2.2} />Throw it away</button>
          </span>
        </div>
      )}
      {refused && <span class="cu-paid-where"><Icon name="today" size={14} stroke={2} />Also on Today · Not sent</span>}
      {p.kept && !refused && (
        <div class="cu-rc failed">
          <span class="cu-rc-row"><span aria-hidden="true" class="cu-rc-ic warn"><Icon name="offline" size={20} stroke={2} /></span>
            <span class="cu-rc-t"><span>Records when signal comes back</span><span>{p.receipt.state === 'waiting' ? `The receipt goes to ${name} once it records` : 'It goes by itself'}</span></span></span>
          <span class="cu-rc-acts"><button type="button" class="cu-rc-again" disabled={trying} onClick={() => { void again(); }}><Icon name="undo" size={15} stroke={2.2} />{trying ? 'Trying…' : 'Try again'}</button></span>
        </div>
      )}
      {p.receipt.state === 'failed' ? (
        <div class="cu-rc failed">
          <span class="cu-rc-row"><span aria-hidden="true" class="cu-rc-ic warn"><Icon name="receipt" size={20} stroke={2} /></span>
            <span class="cu-rc-t"><span>Receipt not sent yet</span><span>{`WhatsApp can’t reach ${name} now`}</span></span></span>
          <span class="cu-rc-acts">
            <button type="button" class="cu-rc-sms" onClick={sms}><Icon name="message" size={17} stroke={2.2} />Send by SMS</button>
            <button type="button" class="cu-rc-again" onClick={() => { if (b) void sendReceipt(p.key, b.shop.name, now.value); }}><Icon name="undo" size={15} stroke={2.2} />Try again on WhatsApp</button>
          </span>
        </div>
      ) : p.receipt.state !== 'off' && p.receipt.state !== 'waiting' && (
        <div class="cu-rc">
          <span aria-hidden="true" class="cu-rc-ic"><Icon name="receipt" size={20} stroke={2} /></span>
          <span class="cu-rc-t"><span>{p.receipt.state === 'sent' ? `Receipt sent to ${name}` : `Sending the receipt to ${name}`}</span>
            <span>{p.receipt.state === 'sent' && p.receipt.at ? `WhatsApp · sent ${clock(p.receipt.at)}` : 'WhatsApp · sending'}</span></span>
          {p.receipt.state === 'sent' && <span aria-hidden="true" class="cu-rc-read"><Icon name="check" size={14} stroke={2.6} /><span><Icon name="check" size={14} stroke={2.6} /></span></span>}
        </div>
      )}
      {/* An error never leaves by itself (CU46), and nor does a payment thrown away while the cash is still in hand (CU47). */}
      <EndOfFlow on={nav.home} ms={refused || p.discarded ? undefined : 8000} />
    </main>
  );
}
