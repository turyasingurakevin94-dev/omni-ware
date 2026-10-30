/*
 * OR15, OR16 · A payment that brought more than the bills (Nansana: 560,000 cleared 470,000; 90,000
 * over). Grace picks what the customer wants, Give change (the default) or Deposit, and sends it to
 * Esther, who settles it (decision-rights: Accounts). Once sent: where it is, Undo, tell by SMS.
 */
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { firstWord, phone9 } from '../../../core/names.ts';
import { clock, dayOf } from '../../../core/time.ts';
import type { Books, Payment } from '../../../core/types.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { FullSheet, SheetHead } from '../../../ui/FullSheet.tsx';
import { Icon, type IconName } from '../../../ui/icons.tsx';
import { toast } from '../../../ui/toast.tsx';
import { nav } from '../shell/nav.ts';
import { act, books, now } from '../shell/store.ts';
import type { ScreenProps } from '../shell/types.ts';
import { SendBtn } from './Change.tsx';
import { byRole, faceOfMember, overAsk, overOf } from './data.ts';
import './sheets.css';

const M: Record<Payment['method'], { word: string; icon: IconName }> = { cash: { word: 'Cash', icon: 'cash' }, momo: { word: 'Mobile', icon: 'mobile' }, bank: { word: 'Bank', icon: 'bank' } };

export function PaidOverScreen(p: ScreenProps): JSX.Element {
  const b = books.value, x = b && b.payments.find((y) => y.id === Number(p.params.payment));
  if (!b || !x) return <FullSheet onBack={nav.back} backLabel="Back" head={<div class="ow-shead" />}><p class="or-gone">{b ? 'This payment is no longer in the books' : ''}</p></FullSheet>;
  return <PaidOver b={b} x={x} />;
}

function PaidOver(p: { b: Books; x: Payment }): JSX.Element {
  const { b, x } = p, t = now.value, c = b.customers.find((y) => y.id === x.customerId) || null;
  const [how, setHow] = useState<'change' | 'deposit'>('change');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(0);
  useEffect(() => { if (!sent) return undefined; const k = window.setTimeout(() => setSent(0), 10000); return () => clearTimeout(k); }, [sent]);
  const { cleared, over } = overOf(b, x), asked = overAsk(b, x);
  const who = c ? firstWord(c.name) : 'They', acc = byRole(b, 'accounts'), an = firstWord(acc?.name || 'Accounts');
  const m = M[x.method], when = `${m.word} · ${dayOf(x.at) === dayOf(t) ? 'today ' : ''}${clock(x.at)}`, owes = c ? Math.max(0, c.owes) : 0;
  const askedHow = asked && (asked as unknown as { want?: { how?: string } }).want?.how === 'deposit' ? 'deposit' : how;
  const send = async () => {
    setBusy(true);
    try {
      // 0165 allows what 'over' on payment_asks; the DataSource's type lists the four corrections only (asked of the lead).
      const r = await act<{ id: string }>('askPaymentFix', { paymentId: x.id, what: 'over' as 'amount', want: { over, how }, note: '' });
      if (r.kept) toast.show('Kept on this phone', { kind: 'warn' }); else setSent(Date.now());
    } catch (e) { toast.show((e as Error).message, { kind: 'error' }); } finally { setBusy(false); }
  };
  const undo = () => { setSent(0); if (asked) act('withdrawPaymentAsk', asked.id).catch((e) => toast.show((e as Error).message, { kind: 'error' })); };
  const step = (k: 'ok' | 'face' | 'to', title: string, sub: string, line: boolean, tone = '') => (
    <div class="or-step">
      {k === 'ok' ? <span aria-hidden="true" class="or-step-ok"><Icon name="check" size={13} stroke={3} /></span>
        : k === 'face' && acc ? <span aria-hidden="true" class="or-step-face"><Avatar {...faceOfMember(acc)} size={28} font={11} style={{ boxShadow: '0 0 0 2px #F5B26B' }} /></span>
          : <span aria-hidden="true" class="or-step-to" />}
      {line && <span aria-hidden="true" class="or-step-line" />}
      <span class={'or-step-t ' + tone}><span>{title}</span><span>{sub}</span></span>
    </div>
  );
  const sms = `sms:${c && phone9(c.phone) ? '+256' + phone9(c.phone) : ''}?body=${encodeURIComponent(`Hello ${who}, you paid ${x.amount.toLocaleString('en-US')}: ${cleared.toLocaleString('en-US')} cleared your bills and ${over.toLocaleString('en-US')} is over. ${askedHow === 'deposit' ? 'We keep it for your next order.' : 'We give it back to you.'}`)}`;
  return (
    <FullSheet onBack={nav.back} backLabel="Back" head={(
      <SheetHead face={c ? { initials: c.initials, tint: c.tint } : { initials: 'WI', tint: 't4' }} name={c ? c.name : 'Walk-in'} sub={when} subMono phone={c?.phone} callLabel={`Call ${c ? c.name : ''}`} onClose={nav.back}>
        <div class="or-over">
          <span class="or-over-h"><span><span>{`${who} paid`}</span><span class="mono">{x.amount.toLocaleString('en-US')}</span></span>
            <span class="or-over-p"><Icon name="check" size={11} stroke={3.2} />{`Owes ${owes.toLocaleString('en-US')}`}</span></span>
          <span role="img" aria-label={`${cleared.toLocaleString('en-US')} cleared the bills, ${over.toLocaleString('en-US')} is over`} class="or-over-bar"><span style={{ flex: cleared }} /><span style={{ flex: over }} /></span>
          <div class="or-over-t">
            <span><span>The bills · cleared</span><span class="mono">{cleared.toLocaleString('en-US')}</span></span>
            <span><span>Paid over</span><span class="mono">{over.toLocaleString('en-US')}</span></span>
          </div>
        </div>
      </SheetHead>
    )}>
      <div class="or-prow"><span aria-hidden="true" class="w"><Icon name={m.icon} size={18} stroke={2} /></span><span><span>{when}</span><span>cleared the bills first</span></span><span class="mono">{x.amount.toLocaleString('en-US')}</span></div>
      {asked ? (
        <>
          <div class="or-prow"><span aria-hidden="true" class="g"><Icon name={askedHow === 'deposit' ? 'bank' : 'cash'} size={18} stroke={2} /></span><span><span>{askedHow === 'deposit' ? 'Deposit' : 'Give change'}</span><span>{`what ${who} wants`}</span></span><span class="mono g">{over.toLocaleString('en-US')}</span></div>
          <div class="or-asks p12">
            <div class="or-asks-h"><span>{`Sent to ${an}`}</span><span class="or-wait">Waiting</span></div>
            {step('ok', `You picked ${askedHow === 'deposit' ? 'deposit' : 'give change'}`, `${over.toLocaleString('en-US')} · ${clock(asked.at)}`, true)}
            {step('face', `${an} settles it`, askedHow === 'deposit' ? `${who} keeps ${over.toLocaleString('en-US')} for the next bill` : `${who} gets ${over.toLocaleString('en-US')} back`, true, 'warn')}
            {step('to', `${who} still owes ${owes.toLocaleString('en-US')}`, 'nothing else changes', false, 'soft')}
          </div>
          <div class="or-send"><a href={sms} class="or-btn-w h52"><Icon name="message" size={18} stroke={2} />{`Tell ${who} by SMS`}</a></div>
          {sent > 0 && (
            <div role="status" class="ow-toast undo or-toast">
              <span class="ow-toast-disc" aria-hidden="true"><Icon name="check" size={15} stroke={3} /></span>
              <span>{`Sent to ${an}`}</span>
              <button type="button" class="ow-toast-undo" onClick={undo}>Undo</button>
            </div>
          )}
        </>
      ) : (
        <>
          <div role="radiogroup" aria-label={`What ${who} wants`} class="or-wants">
            <span class="or-label">{`What ${who} wants`}</span>
            <div>
              {(['change', 'deposit'] as const).map((k) => (
                <label key={k} class={how === k ? 'on' : ''}>
                  <input type="radio" name="settle" checked={how === k} onChange={() => setHow(k)} />
                  <span aria-hidden="true" class="or-wants-r" />
                  <span aria-hidden="true" class="or-wants-i"><Icon name={k === 'change' ? 'cash' : 'bank'} size={20} stroke={1.9} /></span>
                  <span class="or-wants-w">{k === 'change' ? 'Give change' : 'Deposit'}</span>
                  <span class="mono or-wants-v">{over.toLocaleString('en-US')}</span>
                  <span class="or-wants-n">{k === 'change' ? 'the default' : 'next bill uses it first'}</span>
                </label>
              ))}
            </div>
          </div>
          <div class="or-asks p12 g6">
            <span class="or-asks-k">What happens next</span>
            {step('to', `${an} settles it`, 'gives the change, or keeps the deposit', true, 'soft')}
            {step('to', `${who} still owes ${owes.toLocaleString('en-US')}`, 'the bills stay cleared', false, 'soft')}
          </div>
          <SendBtn busy={busy} on={send}>{`Send to ${an}`}</SendBtn>
        </>
      )}
    </FullSheet>
  );
}
