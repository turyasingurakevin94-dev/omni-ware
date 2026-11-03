/*
 * The customer sheet's navy head (CU10, CU11, CU13): the due ring, the name,
 * Call and ×, then the money picture that fits what they owe:
 *   AgeTrack     under the hold: the bills as dots on the road to the 21-day hold (CU10)
 *   SplitHead    some of it is being checked: to collect vs being checked (CU11)
 *   ApartHead    the bills say more than the balance: Esther is checking (CU13)
 */
import type { ComponentChildren, JSX } from 'preact';
import { fig } from '../../../ui/Money.tsx';
import { SplitBar } from '../../../ui/Bar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { Tap } from '../../../ui/util.tsx';
import { short as shortMoney } from '../../../core/money.ts';
import { TINTS } from '../../../core/names.ts';
import type { Customer, Member } from '../../../core/types.ts';
import type { Bill, RingTone } from './data.ts';
import { BigRing } from './local-rings.tsx';

export function CustHead(p: { c: Customer; sub: string; tone: RingTone; fill: number; onClose: () => void; children?: ComponentChildren }): JSX.Element {
  const c = p.c;
  return (
    <div class="ow-shead cu-head">
      <span aria-hidden="true" class="ow-shead-grab" />
      <div class="ow-shead-row">
        <BigRing initials={c.initials} tint={c.tint} tone={p.tone} fill={p.fill} />
        <div class="ow-shead-t"><span class="ow-shead-n">{c.name}</span>{p.sub && <span class="ow-shead-s">{p.sub}</span>}</div>
        {c.phone && <Tap href={'tel:+256' + c.phone.replace(/\D/g, '').replace(/^0/, '')} label={`Call ${c.name}`} class="ow-shead-call"><Icon name="phone" size={18} stroke={2} /></Tap>}
        <Tap on={p.onClose} label="Close" class="ow-shead-x"><Icon name="close" size={16} stroke={2.2} /></Tap>
      </div>
      {p.children}
    </div>
  );
}

/** CU10 · Owes, the credit it sits in (the Manager's), and the bills on the road to the hold. */
export function AgeTrack(p: { owes: number; bills: Bill[]; limit: number | null; manager: string; hold: number }): JSX.Element {
  // 30 days, or out to the oldest bill when it is older (Kyaligonza's 54 days sit at '54 d', CU17).
  const SPAN = Math.max(30, ...p.bills.map((b) => b.age)), at = (d: number) => Math.min(100, (d / SPAN) * 100), holdAt = at(p.hold);
  const max = Math.max(...p.bills.map((b) => b.left));
  const used = p.limit ? Math.round((p.owes / p.limit) * 100) : 0;
  const n = p.bills.length, ages = p.bills.slice().sort((a, b) => a.age - b.age);
  const left = p.bills.length ? p.hold - p.bills[0].age : 0;
  const hold = left >= 0 ? `The ${p.hold}-day hold is ${left} days away.` : `Past the ${p.hold}-day hold by ${-left} days.`;
  const label = `${n === 1 ? 'One bill' : `${['', 'One', 'Two', 'Three', 'Four', 'Five'][n] || n} bills`}: ${ages.map((b) => `${fig(b.left)} is ${b.age} days old`).join(', ')}. ${hold}`;
  return (
    <>
      <div class="cu-owes">
        <span class="cu-owes-k"><span>Owes</span><span class="mono">{fig(p.owes)}</span></span>
        {p.limit ? (
          <span class="cu-credit">
            <span><Icon name="lock" size={12} stroke={2.2} />credit <b class="mono">{shortMoney(p.limit)}</b>{` · ${p.manager}`}</span>
            <span aria-hidden="true" class="cu-credit-bar"><span style={{ width: `${used}%` }} /></span>
          </span>
        ) : <span class="cu-credit"><span><Icon name="lock" size={12} stroke={2.2} />No limit set</span></span>}
      </div>
      <div role="img" aria-label={label} class="cu-track">
        <div class="cu-track-road">
          <span class="cu-tr-base" />
          <span class="cu-tr-in" style={{ width: `${holdAt.toFixed(1)}%` }} />
          <span class="cu-tr-hold" style={{ left: `${holdAt.toFixed(1)}%` }} />
          <span class="cu-tr-past" style={{ left: `${holdAt.toFixed(1)}%` }} />
          {ages.map((b) => {
            const s = b.left === max ? 22 : 16, x = at(b.age).toFixed(1);
            return [
              <span key={'d' + b.id} class="cu-tr-dot" style={{ left: `calc(${x}% - ${(s / 2).toFixed(1)}px)`, top: `${(30 - s / 2).toFixed(1)}px`, width: `${s}px`, height: `${s}px` }} />,
              <span key={'l' + b.id} class="cu-tr-fig mono" style={{ left: `${x}%` }}>{shortMoney(b.left)}</span>,
            ];
          })}
        </div>
        <div class="cu-track-l"><span>today</span><span style={{ left: `${holdAt.toFixed(1)}%` }}>{`${p.hold}-day hold`}</span><span>{`${SPAN} d`}</span></div>
      </div>
    </>
  );
}

/** CU11 · Owes, the oldest bill's age, and what to collect beside what Esther is checking. */
export function SplitHead(p: { owes: number; oldest: number; collect: number; checked: number; checker: Member; onChecked: () => void }): JSX.Element {
  const t = TINTS[p.checker.tint];
  return (
    <div class="cu-split">
      <div class="cu-owes">
        <span class="cu-owes-k"><span>Owes</span><span class="mono">{fig(p.owes)}</span></span>
        <span class="cu-oldest">oldest <b class="mono">{p.oldest}</b> days</span>
      </div>
      <SplitBar h={10} label={`${fig(p.collect)} to collect, ${fig(p.checked)} being checked`}
        parts={[{ value: p.collect, color: '#F5B26B' }, { value: p.checked, color: 'hatch' }]} />
      <div class="cu-split-tiles">
        <span class="cu-split-tile"><span>To collect</span><span class="mono amber">{fig(p.collect)}</span></span>
        <Tap on={p.onChecked} class="cu-split-tile">
          <span>Being checked</span><span class="mono blue">{fig(p.checked)}</span>
          <span class="cu-split-who"><span aria-hidden="true" class="cu-av22" style={{ background: t.bg, color: t.fg }}>{p.checker.initials}</span>{`${first(p.checker.name)} checks it`}</span>
        </Tap>
      </div>
    </div>
  );
}

/** CU13 · The balance says one thing, the open bills another: how far apart, and who is checking. */
export function ApartHead(p: { apart: number; owes: number; bills: Bill[]; checker: Member }): JSX.Element {
  const t = TINTS[p.checker.tint], sum = p.bills.reduce((s, b) => s + b.left, 0);
  return (
    <div role="img" class="cu-apart" aria-label={`Being checked: the balance says ${fig(p.owes)}; the open bills say ${fig(sum)}; ${fig(p.apart)} apart. ${first(p.checker.name)} is checking.`}>
      <div class="cu-owes">
        <span class="cu-owes-k"><span>Being checked</span><span class="cu-apart-fig"><span class="mono">{fig(p.apart)}</span><span>apart</span></span></span>
        <span class="cu-who-chip"><span aria-hidden="true" style={{ background: t.bg, color: t.fg }}>{p.checker.initials}</span>{first(p.checker.name)}</span>
      </div>
      <div class="cu-apart-grid">
        <span class="cu-apart-k"><span>Balance</span><span class="mono amber">{fig(p.owes)}</span></span>
        <span class="cu-apart-v"><span class="cu-apart-empty" /><span>what you can take</span></span>
        <span class="cu-apart-k"><span>Open bills</span><span class="mono">{fig(sum)}</span></span>
        <span class="cu-apart-v"><span class="cu-apart-bills">{p.bills.map((b) => <span key={b.id} style={{ flex: b.left }} />)}</span><span>{p.bills.map((b) => '#' + String(b.id).padStart(4, '0')).join(' · ')}</span></span>
      </div>
    </div>
  );
}

/** CU16 · Nothing owed: 0 in mint and All paid (CU06's words), or the deposit they keep. */
export function PaidUp(p: { deposit: number; limit: number | null; manager: string }): JSX.Element {
  return (
    <div class="cu-paidup">
      <div class="cu-owes">
        <span class="cu-owes-k"><span>{p.deposit ? 'Deposit · the next bill uses it' : 'Owes'}</span><span class="mono mint">{fig(p.deposit)}</span></span>
        <span class="cu-allpaid"><Icon name="check" size={13} stroke={3} />All paid</span>
      </div>
      {/* Their credit, as Kato's head says his (FACTS §3.1: Nansana "No limit set · Ruth decides"). */}
      <span class="cu-paidup-credit"><Icon name="lock" size={12} stroke={2.2} />
        {p.limit ? <>{'credit '}<b class="mono">{shortMoney(p.limit)}</b>{` · ${p.manager}`}</> : `No limit set · ${p.manager} decides`}</span>
    </div>
  );
}

/** "Esther" from "Esther Auma". */
export function first(name: string): string {
  return String(name || '').split(/\s+/)[0];
}

