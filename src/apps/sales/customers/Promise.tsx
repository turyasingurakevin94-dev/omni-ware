/*
 * CU15 · "Kato promises to pay": how much (the oldest bill, prefilled), by
 * which day (the week ahead, the day a bill reaches the hold marked), and
 * who sees it (the Manager). One write: recordPromise (payment_promises).
 */
import type { JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { Button } from '../../../ui/Button.tsx';
import { LightSheet, sheet } from '../../../ui/sheet.tsx';
import { toast } from '../../../ui/toast.tsx';
import { isDataError } from '../../../core/datasource.ts';
import { money } from '../../../core/money.ts';
import { counted, TINTS } from '../../../core/names.ts';
import { addDays, dayLabel, dayOf, daysApart, weekday } from '../../../core/time.ts';
import { act, books, now } from '../shell/store.ts';
import { role } from './Customer.tsx';
import { first } from './cust-head.tsx';
import { billNo, owingOf } from '../../../core/owing.ts';
import { short } from './data.ts';
import { AmountInput } from '../../../ui/PayMethod.tsx';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function openPromise(customerId: string): void {
  const b = books.value, c = b && b.customers.find((x) => x.id === customerId);
  if (!b || !c) return;
  sheet.open(() => <PromiseSheet customerId={customerId} />, { label: `${short(c.name)} promises to pay`, top: 340 });
}

function PromiseSheet(p: { customerId: string }): JSX.Element {
  const b = books.value!, c = b.customers.find((x) => x.id === p.customerId)!, today = dayOf(now.value);
  const m = owingOf(b, c, today), oldest = m.bills[0] || null, name = short(c.name), ruth = role(b, 'manager');
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const hold = m.hold && week.includes(m.hold) ? m.hold : null;
  const quick = [{ word: 'All', amount: m.owes }, ...(oldest && m.bills.length > 1 ? [{ word: billNo(oldest.id), amount: oldest.left }] : [])];
  const [amount, setAmount] = useState<number>(oldest && m.bills.length > 1 ? oldest.left : m.owes);
  const [chosen, setChosen] = useState<number | null>(quick.length - 1);
  const [on, setOn] = useState<string>(hold || week[week.length - 1]);
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const t = TINTS[ruth.tint], days = daysApart(today, on);

  const record = async () => {
    if (!(amount > 0)) { toast.show('Type how much', { kind: 'warn' }); return; }
    setBusy(true);
    try {
      const r = await act('recordPromise', { customerId: c.id, on, amount });
      sheet.close();
      toast.show(r.kept ? 'Not sent yet · sends with signal' : `Promise recorded · ${dayLabel(on)}`);
    } catch (e) {
      toast.show('Not recorded', { kind: 'error', sub: isDataError(e) ? e.message : '', retry: () => { void record(); } });
    } finally { setBusy(false); }
  };

  return (
    <LightSheet class="cu-ls" eyebrow={`${c.name} · owes ${money(m.owes)}`} title={`${name} promises to pay`} onClose={sheet.close} pad="12px 16px 20px" gap={12}
      foot={<Button icon="calendar" state={busy ? 'sending' : 'idle'} onClick={() => { void record(); }}>Record the promise</Button>}>
      <div class="cu-pr-amt">
        <span class="cu-k">How much</span>
        <AmountInput inputRef={field} value={amount} label={`How much ${name} promises`} onInput={(v) => { setAmount(v); setChosen(null); }} />
        <div role="radiogroup" aria-label="Quick amounts" class="cu-quick tall">
          {quick.map((q, i) => (
            <button key={q.word} type="button" role="radio" aria-checked={chosen === i} class={chosen === i ? 'on' : undefined} onClick={() => { setAmount(q.amount); setChosen(i); }}>
              {q.word + ' '}<b class="mono">{money(q.amount)}</b>
            </button>
          ))}
          <button type="button" role="radio" aria-checked={chosen == null} class={chosen == null ? 'on' : undefined} onClick={() => { setChosen(null); setAmount(0); field.current && field.current.focus(); }}>Other</button>
        </div>
      </div>
      <div class="cu-pr-when">
        <span class="cu-pr-when-h"><span>By when</span><b>{`${dayLabel(on)} · ${days === 0 ? 'today' : `in ${counted(days, 'day')}`}`}</b></span>
        <div role="radiogroup" aria-label="By when" class="cu-pr-days">
          {week.map((d) => {
            const dd = new Date(d + 'T00:00:00Z');
            return (
              <button key={d} type="button" role="radio" aria-checked={on === d} aria-label={`${weekday(d)} ${dd.getUTCDate()} ${MONTHS[dd.getUTCMonth()]}`} class={on === d ? 'on' : undefined} onClick={() => setOn(d)}>
                <span>{weekday(d)}</span><span class="mono">{dd.getUTCDate()}</span>
                {d === hold && <span aria-hidden="true" class="cu-pr-dot" />}
              </button>
            );
          })}
        </div>
        {hold && oldest && <span class="cu-pr-hold"><span aria-hidden="true" />{`${billNo(oldest.id)} reaches the ${b.settings.holdDays}-day hold that day`}</span>}
      </div>
      <div class="cu-who"><span aria-hidden="true" style={{ background: t.bg, color: t.fg }}>{ruth.initials}</span>{`On ${name}’s account · ${first(ruth.name)} sees it`}</div>
    </LightSheet>
  );
}
