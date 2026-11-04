/*
 * Something wrong after the sale ("Fix it" on a delivered order): OR20 the choices, each saying
 * who decides; OR21 items coming back (Ruth gives the credit note); OR26 something else, in a few
 * words; OR24 which payment, OR25 what it should be (Esther corrects it). Sales asks, never fixes.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { orderOwes, orderTotal } from '../../../core/money.ts';
import { firstWord, orderNo } from '../../../core/names.ts';
import { clock, dayLabel, dayOf, weekday, daysApart, when as at } from '../../../core/time.ts';
import type { Books, Line, Method, Order, Payment } from '../../../core/types.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Chevron } from '../../../ui/ActRow.tsx';
import { Icon, type IconName } from '../../../ui/icons.tsx';
import { ItemSquare } from '../../../ui/ItemSquare.tsx';
import { LightSheet, sheet } from '../../../ui/sheet.tsx';
import { toast } from '../../../ui/toast.tsx';
import { act, books, chats, now } from '../shell/store.ts';
import { openTwice, SendBtn, Who } from './Change.tsx';
import { twinOf } from '../../../core/orders.ts';
import { byRole, custOf, faceOfMember, METHOD, nameOf, orderOf, owesNow, payFixAsks, shortName } from './data.ts';
import { chatFor } from './msg.ts';
import { StageDots } from './local-Track.tsx';
import './sheets.css';

const eyebrow = (b: Books, o: Order, word = 'Order') => `${word} ${orderNo(o.id)} · ${nameOf(b, o)}`;
const paysOf = (b: Books, o: Order): Payment[] => b.payments.filter((p) => p.orderId === o.id && !p.qa).sort((x, y) => x.at - y.at);
const when = (at: number, t: number) => (dayOf(at) === dayOf(t) ? `today ${clock(at)}` : daysApart(dayOf(at), dayOf(t)) < 7 ? weekday(at) : dayLabel(at));

/** Fix it: the Something wrong sheet (OR20); for an invoiced copy entered twice, OR23 straight away. Other tabs open it too. */
export function openWrong(id: number): void {
  const b = books.value, o = b && orderOf(b, id);
  if (!b || !o) return;
  const tw = twinOf(b.orders, o);
  if (tw && tw.copy.id === o.id && o.invoiced) { openTwice(id); return; }
  sheet.open(() => <WrongSheet id={id} />, { label: 'Something wrong', top: 322 });
}

function Reason(p: { tone: string; icon: IconName; title: string; sub: JSX.Element | string; on?: () => void; off?: boolean }): JSX.Element {
  const body = (
    <>
      <span aria-hidden="true" class={'or-row-ic ' + p.tone}><Icon name={p.icon} size={20} stroke={2} /></span>
      <span class="or-rsn-t"><span>{p.title}</span><span>{p.sub}</span></span>
      <Chevron />
    </>
  );
  return p.off || !p.on ? <div class="or-rsn off" aria-disabled="true">{body}</div> : <button type="button" class="or-rsn" onClick={p.on}>{body}</button>;
}

function WrongSheet(p: { id: number }): JSX.Element | null {
  const b = books.value, o = b && orderOf(b, p.id), t = now.value;
  if (!b || !o) return null;
  const ruth = byRole(b, 'manager'), rn = firstWord(ruth?.name || 'Manager'), rf = ruth && <Avatar {...faceOfMember(ruth)} size={18} />;
  const acc = byRole(b, 'accounts'), an = firstWord(acc?.name || 'Accounts'), pays = paysOf(b, o);
  const one = pays.length === 1 ? pays[0] : null, asked = !!one && payFixAsks(b, one).length > 0;
  return (
    <LightSheet class="or-sheet" ground eyebrow={eyebrow(b, o)} title="Something wrong" onClose={sheet.close} pad="12px 16px 22px" gap={8}>
      <div class="or-dots"><StageDots stage={o.stage} all={o.stage === 'delivered'} /></div>
      <Reason tone="info" icon="return" title="Items coming back" sub={<>{rf}{`${rn} gives the credit note`}</>} on={() => openReturn(o.id)} />
      <Reason tone="bad" icon="void" title="Cancel the bill" sub={<><Icon name="lock" size={13} stroke={2.2} />{o.stage === 'delivered' ? 'Delivered · use a return' : `${rn} decides`}</>} off={o.stage === 'delivered'} on={() => openTwice(o.id)} />
      <Reason tone="warn" icon="cash" title="Payment recorded wrong" off={!pays.length}
        sub={<>{acc && <Avatar {...faceOfMember(acc)} size={18} />}{one ? `${METHOD[one.method].word} ${one.amount.toLocaleString('en-US')} · ${asked ? 'asked' : when(one.at, t).split(' ')[0] === 'today' ? clock(one.at) : weekday(one.at)} · ${an} corrects it` : pays.length ? `${pays.length} payments · ${an} corrects it` : 'Nothing paid yet'}</>}
        on={() => (one && !asked ? openPayWrong(o.id, one.id, 'wrong') : openPayWhich(o.id))} />
      <Reason tone="" icon="note" title="Something else" sub={<>{rf}{`Tell ${rn} in a few words`}</>} on={() => openElse(o.id)} />
    </LightSheet>
  );
}

/** OR21 · which items come back and how many, why, and the credit it comes to. */
/** Back to the sheet this one was opened from: its Close, the scrim, a pull, the phone's back (never after a send). */
let sent = false;
const backTo = (open: () => void) => () => { if (!sent) open(); };
/** After a send: close for good. */
const done = () => { sent = true; sheet.close(); sent = false; };

export function openReturn(id: number): void {
  sheet.open(() => <ReturnSheet id={id} />, { label: 'Items coming back', top: 230, onClose: backTo(() => openWrong(id)) });
}

/** Fix it on an owing bill: the money is the question, so it asks Accounts: its one payment's fix, or which payment (OR24). */
export function openPayFix(id: number): void {
  const b = books.value, o = b && orderOf(b, id);
  if (!b || !o) return;
  const pays = paysOf(b, o);
  if (pays.length === 1 && !payFixAsks(b, pays[0]).length) openPayWrong(id, pays[0].id); else openPayWhich(id);
}

const WHY_BACK = ['Wrong size', 'Damaged', 'Not needed'];

function ReturnSheet(p: { id: number }): JSX.Element | null {
  const b = books.value, o = b && orderOf(b, p.id);
  const [qty, setQty] = useState<Record<number, number>>({});
  const [why, setWhy] = useState(-1);
  const [busy, setBusy] = useState(false);
  if (!b || !o) return null;
  const ruth = byRole(b, 'manager'), rn = firstWord(ruth?.name || 'Manager'), total = orderTotal(o);
  const lines = o.lines.filter((l) => l.state !== 'dropped' && l.qty > 0 && l.price != null);
  const amount = lines.reduce((a, l) => a + (qty[l.lineId] || 0) * (l.price as number), 0);
  const pick = (l: Line) => setQty({ ...qty, [l.lineId]: qty[l.lineId] ? 0 : 1 });
  const step = (l: Line, d: number) => setQty({ ...qty, [l.lineId]: Math.max(1, Math.min(l.qty, (qty[l.lineId] || 1) + d)) });
  const send = async () => {
    if (!(amount > 0) || why < 0) { toast.show(!(amount > 0) ? 'Tick what comes back' : 'Tap why they come back', { kind: 'warn' }); return; }
    setBusy(true);
    try {
      const note = lines.filter((l) => qty[l.lineId]).map((l) => `${l.name} ×${qty[l.lineId]}`).join(', ');
      const back = lines.filter((l) => qty[l.lineId]).map((l) => ({ idx: o.lines.indexOf(l), qty: qty[l.lineId] }));
      const r = await act('askBill', { orderId: o.id, kind: 'credit', amount, reason: WHY_BACK[why], note, lines: back });
      done();
      toast.show(r.kept ? 'Kept on this phone' : `Asked ${rn} for the credit note`, { kind: r.kept ? 'warn' : 'ok' });
    } catch (e) { toast.show((e as Error).message, { kind: 'error' }); } finally { setBusy(false); }
  };
  return (
    <LightSheet class="or-sheet" ground eyebrow={eyebrow(b, o)} title="Items coming back" onClose={sheet.close} pad="12px 16px 22px">
      <div class="or-back-l">
        {lines.map((l) => {
          const n = qty[l.lineId] || 0, aisle = b.items.find((i) => i.id === l.itemId)?.aisle || '';
          const row = (
            <button type="button" aria-pressed={n > 0} class="or-back-r" onClick={() => pick(l)}>
              <span aria-hidden="true" class={'or-box' + (n ? ' on' : '')}>{n > 0 && <Icon name="check" size={14} stroke={3} />}</span>
              <ItemSquare aisle={aisle} size={34} radius={9} icon={20} />
              <span class="ow-chk-t"><span class="ow-chk-n">{l.name}</span><span class="mono ow-chk-s or-chk-s">{`${l.qty} `}<span class="ow-word or-unit">{l.unit}</span>{` · ${(l.price as number).toLocaleString('en-US')}${l.qty > 1 ? ' each' : ''}`}</span></span>
            </button>
          );
          if (!n) return <div key={l.lineId} class="or-back-i">{row}</div>;
          return (
            <div key={l.lineId} class="or-back-i on">
              {row}
              <div class="or-back-s">
                <div class="or-stp">
                  <button type="button" aria-label="Fewer back" onClick={() => step(l, -1)}><Icon name="minus" size={18} stroke={2.2} /></button>
                  <span class="mono">{n}<span>{`of ${l.qty} ${l.unit}`}</span></span>
                  <button type="button" aria-label="More back" onClick={() => step(l, 1)}><Icon name="plus" size={18} stroke={2.2} /></button>
                </div>
                <span class="mono">{(n * (l.price as number)).toLocaleString('en-US')}</span>
              </div>
            </div>
          );
        })}
      </div>
      <span class="or-label">Why</span>
      <div role="group" aria-label="Why" class="or-pick">{WHY_BACK.map((w, i) => <button key={w} type="button" aria-pressed={i === why} class={i === why ? 'on' : ''} onClick={() => setWhy(i)}>{w}</button>)}</div>
      <div class="or-credit">
        <div><span>Credit to give back</span><span class="mono">{amount.toLocaleString('en-US')}</span></div>
        <span role="img" aria-label={`${amount.toLocaleString('en-US')} of the ${total.toLocaleString('en-US')} bill`} class="or-credit-bar">
          <span><i style={{ flex: amount }} /><i style={{ flex: Math.max(0, total - amount) }} /></span>
          <span><span>credit</span><span>{'of '}<b class="mono">{total.toLocaleString('en-US')}</b></span></span>
        </span>
        <span class="or-credit-who">{ruth && <Avatar {...faceOfMember(ruth)} size={20} />}{`${rn} gives it once the bill is out`}</span>
      </div>
      <SendBtn busy={busy} on={send}>{`Ask ${rn} for the credit note`}</SendBtn>
    </LightSheet>
  );
}

/** OR26 · something else: tap a reason, a few words, to Ruth. */
export function openElse(id: number): void {
  sheet.open(() => <ElseSheet id={id} />, { label: 'Something else', top: 340, onClose: backTo(() => openWrong(id)) });
}

const ELSE = ['Came late', 'Wrong place', 'Short'];

function ElseSheet(p: { id: number }): JSX.Element | null {
  const b = books.value, o = b && orderOf(b, p.id);
  const [pick, setPick] = useState(-1);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  if (!b || !o) return null;
  const ruth = byRole(b, 'manager'), rn = firstWord(ruth?.name || 'Manager');
  const choose = (i: number) => { setPick(i); setText((x) => `${ELSE[i]}: ${x.replace(/^[^:]{0,20}: ?/, '')}`); };
  const send = async () => {
    const c = chatFor(b, o, chats.value);
    if (!text.trim()) { toast.show('Say what happened', { kind: 'warn' }); return; }
    if (!c) { toast.show(`${shortName(b, o)} has no chat to note it on`, { kind: 'error' }); return; }
    setBusy(true);
    try {
      const r = await act('note', c.id, `@${rn} ${orderNo(o.id)} · ${text.trim()}`, ruth ? [ruth.id] : []);
      done();
      toast.show(r.kept ? 'Kept on this phone' : `Sent to ${rn}`, { kind: r.kept ? 'warn' : 'ok' });
    } catch (e) { toast.show((e as Error).message, { kind: 'error' }); } finally { setBusy(false); }
  };
  return (
    <LightSheet class="or-sheet" ground eyebrow={eyebrow(b, o)} title="Something else" onClose={sheet.close} pad="12px 16px 22px">
      <div role="group" aria-label="Tap one" class="or-pick">{ELSE.map((w, i) => <button key={w} type="button" aria-pressed={i === pick} class={i === pick ? 'on' : ''} onClick={() => choose(i)}>{w}</button>)}</div>
      <label class="or-say"><span>What happened, in a few words</span><textarea rows={2} value={text} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} /></label>
      {ruth && <Who face={faceOfMember(ruth)}>{`${rn} reads it and answers on the order`}</Who>}
      <SendBtn busy={busy} on={send}>{`Send to ${rn}`}</SendBtn>
    </LightSheet>
  );
}

/** OR24 · which payment on this bill: the bar of what is paid and owed, one row per payment. */
export function openPayWhich(id: number): void {
  sheet.open(() => <PayWhich id={id} />, { label: 'Which payment?', top: 330 });
}

function PayWhich(p: { id: number }): JSX.Element | null {
  const b = books.value, o = b && orderOf(b, p.id), t = now.value;
  if (!b || !o) return null;
  const pays = paysOf(b, o), total = orderTotal(o), owes = orderOwes(o), paid = pays.reduce((a, x) => a + x.amount, 0);
  const acc = byRole(b, 'accounts'), an = firstWord(acc?.name || 'Accounts');
  return (
    <LightSheet class="or-sheet" ground eyebrow={eyebrow(b, o, 'Bill')} title="Which payment?" onClose={sheet.close} pad="12px 16px 22px">
      <div role="img" aria-label={`Bill ${total.toLocaleString('en-US')}: ${paid.toLocaleString('en-US')} paid, ${owes.toLocaleString('en-US')} owed`} class="or-paid">
        <span>{pays.map((x) => <i key={x.id} style={{ flex: x.amount }} />)}{owes > 0 && <i class="o" style={{ flex: owes }} />}</span>
        <span><span>{'paid '}<b class="mono g">{paid.toLocaleString('en-US')}</b>{` in ${pays.length}`}</span><span>{'owes '}<b class="mono w">{owes.toLocaleString('en-US')}</b>{` of ${total.toLocaleString('en-US')}`}</span></span>
      </div>
      <div class="or-rows">
        {pays.map((x) => {
          const m = METHOD[x.method], by = b.members.find((mm) => mm.id === x.by), today = dayOf(x.at) === dayOf(t);
          const title = `${m.word} · ${today ? `today ${clock(x.at)}` : dayLabel(x.at)}`, head = <span class="s14">{title}</span>, ic = <span aria-hidden="true" class={'or-row-ic s40 ' + m.tone}><Icon name={m.icon} size={20} stroke={1.9} /></span>;
          const asked = payFixAsks(b, x);
          if (asked.length) {
            return (
              <div key={x.id} role="group" aria-disabled="true" aria-label={`${title}, ${x.amount.toLocaleString('en-US')}: asked of ${an}, waiting`} class="or-pay">
                {ic}
                <span class="or-row-t">{head}<span class="nw or-pay-asked">{acc && <Avatar {...faceOfMember(acc)} size={18} />}{`Asked · ${at(asked[0].at, t)}`}</span></span>
                <span class="or-pay-w"><span class="mono or-pay-a">{x.amount.toLocaleString('en-US')}</span><span class="or-wait">Waiting</span></span>
                <span aria-hidden="true" class="or-pay-gap" />
              </div>
            );
          }
          return (
            <button key={x.id} type="button" class="or-pay" onClick={() => openPayWrong(o.id, x.id, 'which')}>
              {ic}
              <span class="or-row-t">{head}
                <span class="nw">{by && <Avatar initials={by.initials} tint={by.tint} size={18} />}{`${firstWord(by?.name || '')}${x.method === 'momo' && x.ref ? ` · ID ${x.ref}` : today ? '' : ` · ${clock(x.at)}`}`}</span></span>
              <span class="mono or-pay-a">{x.amount.toLocaleString('en-US')}</span>
              <Chevron />
            </button>
          );
        })}
      </div>
      {acc && <Who face={faceOfMember(acc)}>{`${an} corrects it · nothing moves till then`}</Who>}
      <div class="ow-mtiles or-end">
        <div class="ow-mtile"><span class="ow-mtile-k">{`Bill ${orderNo(o.id)}`}</span><span class="ow-mtile-v"><span class="mono">{total.toLocaleString('en-US')}</span></span></div>
        <div class="ow-mtile t-warn"><span class="ow-mtile-k">Owes now</span><span class="ow-mtile-v"><span class="mono">{owes.toLocaleString('en-US')}</span></span></div>
      </div>
    </LightSheet>
  );
}

/** OR25 · the payment as recorded beside what it should be; the method; the ID; what they will owe after. */
export function openPayWrong(id: number, paymentId: number, from?: 'which' | 'wrong'): void {
  sheet.open(() => <PayWrong id={id} paymentId={paymentId} />, { label: 'Payment recorded wrong', top: 200, onClose: from ? backTo(() => (from === 'which' ? openPayWhich(id) : openWrong(id))) : undefined });
}

function PayWrong(p: { id: number; paymentId: number }): JSX.Element | null {
  const b = books.value, o = b && orderOf(b, p.id), x = b && b.payments.find((y) => y.id === p.paymentId);
  const [amt, setAmt] = useState(() => (x ? x.amount.toLocaleString('en-US') : ''));
  const [m, setM] = useState<Method>(() => (x ? x.method : 'cash'));
  const [ref, setRef] = useState(() => (x ? x.ref : ''));
  const [busy, setBusy] = useState(false);
  if (!b || !o || !x) return null;
  const c = custOf(b, o), acc = byRole(b, 'accounts'), an = firstWord(acc?.name || 'Accounts');
  const should = Number(amt.replace(/[^0-9]/g, '')) || 0, owes = owesNow(b, o), after = owes + (x.amount - should);
  const changed = should !== x.amount || m !== x.method, needRef = m !== 'cash' && !ref.trim();
  const send = async () => {
    if (payFixAsks(b, x).length) { toast.show(`Asked ${an} already`, { kind: 'warn' }); return; }
    if (!changed || needRef || !should) { toast.show(needRef ? 'Type the transaction ID' : 'Change the amount or how they paid', { kind: 'warn' }); return; }
    setBusy(true);
    try {
      const ids: string[] = [];
      if (m !== x.method || (m !== 'cash' && ref !== x.ref)) { const r = await act<{ id: string }>('askPaymentFix', { paymentId: x.id, what: 'method', want: { method: m, ref: m === 'cash' ? '' : ref.trim() }, note: '' }); if (!r.kept) ids.push(r.value.id); }
      if (should !== x.amount) { const r = await act<{ id: string }>('askPaymentFix', { paymentId: x.id, what: 'amount', want: { amount: should }, note: '' }); if (!r.kept) ids.push(r.value.id); }
      done();
      toast.show(`Asked ${an} to correct it`, { undo: ids.length ? () => { ids.forEach((id) => { void act('withdrawPaymentAsk', id); }); toast.show('Ask taken back'); } : undefined });
    } catch (e) { toast.show((e as Error).message, { kind: 'error' }); } finally { setBusy(false); }
  };
  return (
    <LightSheet class="or-sheet" ground eyebrow={eyebrow(b, o, 'Bill')} title="Payment recorded wrong" onClose={sheet.close} pad="12px 16px 22px">
      <div class="or-pcust">
        {c && <Avatar initials={c.initials} tint={c.tint} size={38} />}
        <span>{nameOf(b, o)}</span>
        <span><span class="mono">{owes.toLocaleString('en-US')}</span><span>owes now</span></span>
      </div>
      <div class="or-vs">
        <span class="or-vs-a"><span>Recorded</span><s class="mono">{x.amount.toLocaleString('en-US')}</s><span>{`${METHOD[x.method].word} · ${weekday(x.at)} ${clock(x.at)}`}</span></span>
        <span aria-hidden="true" class="or-vs-ch"><Icon name="chevron-right" size={18} stroke={2.4} /></span>
        <label class="or-vs-b"><span>Should be</span><input value={amt} inputmode="numeric" aria-label="The right amount" onInput={(e) => { const v = (e.target as HTMLInputElement).value.replace(/[^0-9]/g, ''); setAmt(v ? Number(v).toLocaleString('en-US') : ''); }} /><span>{METHOD[m].word}</span></label>
      </div>
      <div role="radiogroup" aria-label="How they paid" class="or-meth">
        {(['cash', 'momo', 'bank'] as Method[]).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={m === k} class={m === k ? 'on' : ''} onClick={() => setM(k)}><Icon name={METHOD[k].icon} size={18} />{METHOD[k].word}</button>
        ))}
      </div>
      {m !== 'cash' && (
        <label class="or-ref"><span>Transaction ID</span><input inputmode="numeric" value={ref} aria-label={m === 'momo' ? 'Mobile money transaction ID' : 'Bank transaction ID'} onInput={(e) => setRef((e.target as HTMLInputElement).value)} /></label>
      )}
      <div class="or-will">
        <div><span>They will owe</span><span><s class="mono">{owes.toLocaleString('en-US')}</s><span class="mono">{Math.max(0, after).toLocaleString('en-US')}</span></span></div>
        <span>{acc && <Avatar {...faceOfMember(acc)} size={20} />}{`after ${an}'s correction · ${Math.abs(x.amount - should).toLocaleString('en-US')} ${x.amount >= should ? 'less' : 'more'} paid`}</span>
      </div>
      <SendBtn busy={busy} on={send}>{`Ask ${an} to correct it`}</SendBtn>
    </LightSheet>
  );
}
