/*
 * customers/pay { customer, bills? } or { order } · Take payment (CU30–CU36).
 * How much (all of it prefilled, a bill, or typed), how (Cash · Mobile ·
 * Bank; Mobile needs its transaction ID, Q6), what it pays bill by bill,
 * and for cash what they gave: change, or a deposit they keep. One slide,
 * one write: receive_payment through act(), so with no signal it is kept on
 * the phone. A walk-in who pays part names who owes the rest.
 * Every figure is money.ts's: payPlan, settleOver, changeFor, orderOwes.
 */
import type { JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { FullSheet, SheetHead } from '../../../ui/FullSheet.tsx';
import { MethodPicker } from '../../../ui/PayMethod.tsx';
import { toast } from '../../../ui/toast.tsx';
import { isDataError, type PayArgs, type PayResult } from '../../../core/datasource.ts';
import { changeFor, money, orderOwes, payPlan, settleOver } from '../../../core/money.ts';
import { orderNo } from '../../../core/names.ts';
import { dayOf } from '../../../core/time.ts';
import type { Books, Customer, Method, Order } from '../../../core/types.ts';
import { nav } from '../shell/nav.ts';
import { act, books, now } from '../shell/store.ts';
import type { ScreenProps } from '../shell/types.ts';
import { role } from './Customer.tsx';
import { first } from './cust-head.tsx';
import { moneyOf, short, type Bill } from './data.ts';
import { AmountInput } from './local-amount.tsx';
import { OrderCard, OverCard, PaysCard, QuickAmounts, RefField, type PaysRow } from './pay-parts.tsx';
import { PayDock } from './pay-dock.tsx';
import { putPaid, sendReceipt, type Paid } from './paid-store.ts';
import { shareFor, WalkinWho, whoOptions, whoPicked } from './pay-walkin.tsx';
import './customers.css';
import './pay.css';

export function PayScreen(p: ScreenProps): JSX.Element {
  const b = books.value;
  const c = b && p.params.customer ? b.customers.find((x) => x.id === p.params.customer) || null : null;
  const o = b && p.params.order != null ? b.orders.find((x) => x.id === Number(p.params.order)) || null : null;
  if (!b || (!c && !o)) return <FullSheet onBack={() => nav.back()} backLabel="Back" head={<div class="ow-shead"><span aria-hidden="true" class="ow-shead-grab" /></div>} />;
  return <Pay b={b} c={c} o={o} bills={p.params.bills != null ? String(p.params.bills).split(',').map(Number).filter((n) => n > 0) : null} />;
}

/** The two likely notes above a figure: the next half and whole of its leading place (420,000 → 450,000 · 500,000; 52,000 → 55,000 · 60,000). */
export function notesFor(n: number): number[] {
  if (!(n > 0)) return [];
  const place = Math.pow(10, Math.floor(Math.log10(n))), out: number[] = [];
  [place / 2, place, place * 2].forEach((s) => { const v = Math.ceil((n + 1) / s) * s; if (v > n && !out.includes(v)) out.push(v); });
  return out.slice(0, 2);
}

function Pay(p: { b: Books; c: Customer | null; o: Order | null; bills: number[] | null }): JSX.Element {
  const { b, c, o } = p, today = dayOf(now.value), esther = role(b, 'accounts');
  const m = c ? moneyOf(b, c, today) : null;
  const open: Bill[] = m ? m.bills.filter((x) => !x.checked) : [];
  const owes = m ? m.owes : o ? orderOwes(o) : 0, take = m ? m.take : owes;
  const name = c ? short(c.name) : o ? o.client.name || 'Walk-in' : '';
  const initPicks = p.bills ? p.bills.filter((id) => open.some((x) => x.id === id)) : null;
  const sumOf = (ids: number[]) => open.filter((x) => ids.includes(x.id)).reduce((s, x) => s + x.left, 0);

  const [picks, setPicks] = useState<number[] | null>(initPicks && initPicks.length ? initPicks : null);
  const [amount, setAmount] = useState<number>(initPicks && initPicks.length ? sumOf(initPicks) : take);
  const [other, setOther] = useState(false);
  const [method, setMethod] = useState<Method>('cash');
  const [ref, setRef] = useState('');
  const [given, setGiven] = useState<number | 'exact'>('exact');
  const [how, setHow] = useState<'change' | 'deposit'>('change');
  const [receipt, setReceipt] = useState(true);
  const [who, setWho] = useState<string | null>(o && whoPicked.value && whoPicked.value.order === o.id ? whoPicked.value.id : null);
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLInputElement>(null);

  // The quick amounts: all of it, one bill (the picked one, else the oldest), or typed.
  const chipBill = picks && picks.length === 1 ? open.find((x) => x.id === picks[0]) : open[0];
  const opts = [{ word: 'All', amount: take }, ...(c && open.length > 1 && chipBill ? [{ word: orderNo(chipBill.id), amount: chipBill.left }] : [])];
  const chosen = other ? null : !picks && amount === take ? 0 : picks && picks.length === 1 && opts.length > 1 && amount === opts[1].amount ? 1 : null;

  // What it pays: over the ticked bills (or all, oldest first).
  const payable = picks ? sumOf(picks) : take;
  const handed = method === 'cash' && given !== 'exact' ? given : amount;
  const plan = payPlan(payable, handed);
  const choice = method !== 'cash' ? amount > payable : amount >= payable && handed > payable;
  const settle = choice ? settleOver(payable, handed, how) : { moneyIn: Math.min(amount, payable), change: method === 'cash' ? Math.max(0, changeFor(amount, handed)) : 0, deposit: 0, refused: false };
  let left = Math.min(amount, payable);
  const rows: PaysRow[] = open.map((x) => {
    const on = !picks || picks.includes(x.id), applied = on ? Math.min(left, x.left) : 0;
    if (on) left -= applied;
    return { id: x.id, day: x.day, age: x.age, left: x.left, applied, on };
  });
  const applied = Math.min(amount, payable), after = Math.max(0, owes - applied);

  const toggle = (id: number) => {
    const cur = picks || open.map((x) => x.id), next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id].sort((x, y) => open.findIndex((z) => z.id === x) - open.findIndex((z) => z.id === y));
    const all = next.length === open.length;
    setPicks(all ? null : next); setAmount(all ? take : sumOf(next)); setOther(false); setGiven('exact');
  };
  const pick = (i: number) => {
    setOther(false); setGiven('exact');
    if (i === 0) { setPicks(null); setAmount(take); } else if (chipBill) { setPicks([chipBill.id]); setAmount(chipBill.left); }
  };

  // Walk-in: what is left on the order, and who owes it.
  const walkLeft = o && !c ? Math.max(0, owes - amount) : 0;
  const whos = o && !c && walkLeft > 0 ? whoOptions(b, o) : [];
  const whoC = who ? b.customers.find((x) => x.id === who) || null : null;

  const words = !(amount > 0) ? 'Type the amount' : method === 'momo' && !ref.trim() ? 'Type the transaction ID'
    : walkLeft > 0 && !whoC ? `Name who owes ${money(walkLeft)} first` : null;
  /** What goes in the books: what clears the debt, or with a deposit all they handed over (settleOver). */
  const record = settle.moneyIn;

  const commit = async (): Promise<void> => {
    if (words || busy) return;
    setBusy(true);
    const over = choice ? how : null;
    const args: PayArgs = { customerId: c ? c.id : null, orderId: c ? null : o ? o.id : null, amount: over === 'deposit' ? handed : over === 'change' ? record : amount, method, ref: method === 'cash' ? '' : ref.trim(), picks: c ? picks : null, over };
    try {
      if (o && !c && whoC) await act('assignOrder', o.id, whoC.id);
      const r = await act<PayResult>('receivePayment', args);
      const key = 'p' + now.value + '-' + Math.random().toString(36).slice(2, 6);
      const lines = r.kept ? rows.filter((x) => x.applied > 0).map((x) => ({ id: x.id, day: x.day, amount: x.applied }))
        : r.value.payments.filter((x) => x.orderId != null).map((x) => ({ id: x.orderId as number, day: (open.find((z) => z.id === x.orderId) || { day: x.day }).day, amount: x.amount }));
      const who0 = c || whoC;
      const paid: Paid = {
        key, customerId: who0 ? who0.id : null, name: who0 ? who0.name : name, initials: who0 ? who0.initials : 'WI', tint: who0 ? who0.tint : 't4', phone: who0 ? who0.phone : o ? o.client.phone : '',
        amount: r.kept ? args.amount : r.value.amount, method, ref: args.ref, lines: o && !c ? [{ id: o.id, day: dayOf(o.placedAt), amount: args.amount }] : lines,
        before: owes, after: Math.max(0, r.kept ? after : c ? r.value.after : owes - args.amount), change: settle.change, given: method === 'cash' ? handed : 0, deposit: settle.deposit, at: now.value, kept: r.kept,
        receipt: { state: receipt && c && !r.kept ? 'sending' : 'off', at: null, chatId: null },
      };
      putPaid(paid);
      nav.replace('customers/paid', { id: key });
      if (paid.receipt.state === 'sending') void sendReceipt(key, b.shop.name, now.value);
    } catch (e) {
      toast.show('Nothing was recorded', { kind: 'error', sub: isDataError(e) ? e.message : String(e), retry: () => { void commit(); } });
    } finally { setBusy(false); }
  };

  const sub = c ? `${c.name} · owes ${money(owes)}` : o ? `${o.client.name || 'Walk-in'} · ${orderNo(o.id)} · ${money(owes)}` : '';
  const face = c ? { initials: c.initials, tint: c.tint } : { initials: 'WI', tint: 't4' as const };
  return (
    <FullSheet onBack={() => nav.back()} backLabel="Back" head={<SheetHead face={face} name="Take payment" sub={sub} onClose={() => nav.back()} />}
      foot={<PayDock method={method} given={given} notes={notesFor(amount)} onGiven={setGiven} amount={amount} owes={owes} after={after} payable={payable}
        over={choice ? { how, amount: plan.over } : null} change={settle.change} record={choice ? record : amount}
        receipt={c ? { on: receipt, label: `Send ${name} the receipt on WhatsApp`, toggle: () => setReceipt(!receipt) } : null}
        walkin={o && !c ? { id: o.id, total: owes, who: whoC ? { name: short(whoC.name), owes: whoC.owes + shareFor(b, walkLeft).share } : null, left: walkLeft } : null}
        words={words} sending={busy} onCommit={commit} />}>
      <div class="cu-amt-card">
        <label class="cu-amt-l"><span class="cu-k">{`${name} pays now`}</span>
          <AmountInput inputRef={field} value={amount} label={`Amount ${name} pays now`} onInput={(v) => { setAmount(v); setOther(true); setGiven('exact'); }} /></label>
        <QuickAmounts opts={opts} chosen={chosen} onPick={pick} onOther={() => { setOther(true); setPicks(null); if (field.current) { field.current.focus(); field.current.select(); } }} />
      </div>
      <MethodPicker value={method} onChange={(x) => { setMethod(x); setGiven('exact'); }} />
      {method === 'momo' && <RefField label="Transaction ID" value={ref} placeholder="from their SMS" warn={ref.trim() ? null : 'Mobile needs its transaction ID'} onInput={setRef} />}
      {method === 'bank' && <RefField label="Bank reference" value={ref} placeholder="if there is one" warn={null} onInput={setRef} />}
      {o && !c && <OrderCard id={o.id} where={o.client.name === 'Walk-in' || !o.client.name ? 'walk-in · at the gate' : 'at the gate'} status={o.stage === 'road' && !o.deliverTo ? 'Ready to collect' : null} paid={Math.min(amount, owes)} total={owes} />}
      {o && !c && walkLeft > 0 && <WalkinWho b={b} o={o} left={walkLeft} opts={whos} chosen={who} onPick={setWho} />}
      {c && (choice
        ? <OverCard pays={payable} over={plan.over} bills={rows.filter((x) => x.on).map((x) => x.id)} how={how} onHow={setHow} name={name} checker={{ initials: esther.initials, tint: esther.tint, name: first(esther.name) }} />
        : open.length > 0 && <PaysCard rows={rows} pick={!!picks} onToggle={toggle} />)}
    </FullSheet>
  );
}
