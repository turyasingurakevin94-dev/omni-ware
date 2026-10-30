/*
 * The order's foot (SL07, SL23–SL25): how they pay (Cash, or Credit at the
 * shop's rate: ONE "Credit charge" line, src/core/money.ts), what holds a
 * credit order for the Manager (no limit, over the limit, a bill past the
 * hold), the picture on WhatsApp, and "Add a charge".
 * Credit is the Manager's to give (decision-rights): the order places now
 * and waits in Checking for her.
 */
import type { JSX } from 'preact';
import { openCharges, short } from '../../../core/money.ts';
import { orderNo } from '../../../core/names.ts';
import type { Books, Customer } from '../../../core/types.ts';
import { avatarStyle } from '../../../ui/Avatar.tsx';
import { Duo, Icon, phWhatsapp } from '../../../ui/icons.tsx';
import { fig } from '../../../ui/Money.tsx';
import { first } from './insights.ts';
import { cur, setCredit, setPic, sums } from './model.ts';
import { manager, type Who } from './people.ts';
import { openCharge } from './sheets.tsx';
import './foot.css';

const DAY_MONTH = (day: string) => `${Number(day.slice(8))} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(day.slice(5, 7)) - 1]}`;

/** The one "Credit charge" line, with the order's lines. */
export function CreditLine(p: { b: Books }): JSX.Element | null {
  const s = sums.value;
  if (!s || !(s.credit > 0)) return null;
  return (
    <a href="#" class="sl-line" onClick={(e) => { e.preventDefault(); document.querySelector('.sl-foot')?.scrollIntoView({ block: 'center' }); }}>
      <span aria-hidden="true" class="sl-credit-ic"><Icon name="cash" size={20} stroke={1.9} /></span>
      <span class="sl-line-t"><span class="sl-line-n">Credit charge</span><span class="mono sl-line-s">{`${p.b.settings.creditPct}% `}<span class="ow-word">of</span>{` ${fig(s.cash)}`}</span></span>
      <span class="mono sl-chip warn sl-credit-a">{fig(s.credit, false, true)}</span>
    </a>
  );
}

function RuthHead(p: { m: Who; title: string }): JSX.Element {
  return (
    <div class="sl-hold-h">
      <span aria-hidden="true" style={avatarStyle({ initials: p.m.initials, tint: p.m.tint, size: 32, font: 12 })} class="ow-av">{p.m.initials}</span>
      <span class="sl-hold-t"><span>{p.title}</span><span>it places now · waits in Checking for her</span></span>
    </div>
  );
}

/** Why a credit order waits for the Manager, as a picture. */
function Hold(p: { b: Books; c: Customer }): JSX.Element | null {
  const s = sums.value, b = p.b, c = p.c, m = manager(b);
  if (!s || !s.hold) return null;
  const h = s.hold, total = s.total;
  if (h.noLimit) {
    return (
      <div class="sl-hold">
        <RuthHead m={m} title={`No limit set · ${m.first} decides`} />
        <div role="img" aria-label={`This order ${fig(total)} on credit; no limit set`} class="sl-hold-nl">
          <span class="sl-hold-nlb"><span /><span /></span>
          <span class="sl-hold-nlw">this <span class="mono">{short(total, 2)}</span> · limit <span class="mono">?</span></span>
        </div>
      </div>
    );
  }
  if (h.over && c.creditLimit) {
    const owes = Math.max(0, c.owes), all = owes + total, lim = c.creditLimit, over = all - lim;
    const a = Math.round((1000 * owes) / all) / 10, at = Math.round((1000 * lim) / all) / 10;
    return (
      <div class="sl-hold">
        <RuthHead m={m} title={`Over the limit · ${m.first} decides`} />
        <div role="img" aria-label={`Owes ${fig(owes)}, this order ${fig(total)}, limit ${fig(lim)}: ${fig(over)} over`} class="sl-hold-bar">
          <div class="sl-hold-ov"><span style={{ width: `${a}%` }} /><span style={{ width: `${Math.round(10 * (at - a - 0.4)) / 10}%` }} /><span /><i aria-hidden="true" style={{ left: `${at}%` }} /></div>
          <div class="sl-hold-l"><span>owes <span class="mono">{short(owes)}</span> + this <span class="mono">{short(total, 2)}</span></span><span class="bad"><span class="mono">{fig(over)}</span> over <span class="mono">{short(lim)}</span></span></div>
        </div>
      </div>
    );
  }
  const bill = openCharges(c)[0], hold = b.settings.holdDays, weeks = Math.max(1, Math.ceil(h.age / 7)), okW = Math.floor(hold / 7);
  return (
    <div class="sl-hold">
      <RuthHead m={m} title={`A bill ${h.age} days old · ${m.first} decides`} />
      <div role="img" aria-label={`Bill ${bill && bill.orderId ? orderNo(bill.orderId) : ''} is ${h.age} days old; credit stops after ${hold} days`} class="sl-hold-bar">
        <div class="sl-hold-wk">{Array.from({ length: weeks }, (_, i) => <span key={i} class={i < okW ? '' : 'bad'} />)}<i aria-hidden="true" style={{ left: `calc(${Math.round((1000 * hold) / h.age) / 10}% - 1px)` }} /></div>
        <div class="sl-hold-l"><span>bill <span class="mono">{bill && bill.orderId ? orderNo(bill.orderId) : ''}</span>{bill ? ` · ${DAY_MONTH(bill.day)}` : ''}</span><span class="bad"><span class="mono">{h.age}</span> days · stop at <span class="mono">{hold}</span></span></div>
      </div>
    </div>
  );
}

export function Foot(p: { b: Books; c: Customer | null }): JSX.Element | null {
  const x = cur.value, b = p.b, c = p.c, m = manager(b);
  if (!x) return null;
  const who = c ? first(c.name) : 'them', pct = b.settings.creditPct;
  return (
    <div class="sl-foot">
      {c && pct > 0 && (
        <div class="sl-foot-r">
          <span aria-hidden="true" class={'sl-foot-ic' + (x.credit ? ' warn' : '')}><Icon name="cash" size={20} stroke={1.8} /></span>
          <span class="sl-foot-t"><span>Pays</span><span>{c.owes > 0 ? `owes ${short(c.owes)}` : 'owes nothing'}</span></span>
          <div role="radiogroup" aria-label={`How ${who} pays`} class="sl-pays">
            <button type="button" role="radio" aria-checked={!x.credit} class={!x.credit ? 'on' : ''} onClick={() => setCredit(false)}>Cash</button>
            <button type="button" role="radio" aria-checked={x.credit} class={x.credit ? 'on' : ''} onClick={() => setCredit(true)}>
              <span class="sl-pays-c">Credit <span class="mono">{`+${pct}%`}</span><span aria-label={`${m.first} decides`} class="sl-pays-av" style={avatarStyle({ initials: m.initials, tint: m.tint, size: 22, font: 11 })}>{m.initials}</span></span>
            </button>
          </div>
        </div>
      )}
      {c && x.credit && <Hold b={b} c={c} />}
      {c && x.chatId != null && (
        <div class="sl-foot-r">
          <span aria-hidden="true" class="sl-foot-ic good"><Duo i={phWhatsapp} size={20} color="#0F6B43" /></span>
          <span class="sl-foot-t"><span>{`Picture to ${who}`}</span><span>on WhatsApp, as you place it</span></span>
          <button type="button" role="switch" aria-checked={x.pic} aria-label={`Send the order picture to ${who}`} class="sl-switch" onClick={() => setPic(!x.pic)}><span aria-hidden="true" class={x.pic ? 'on' : ''}><span /></span></button>
        </div>
      )}
      {!x.credit && (
        <a href="#" class="sl-foot-r" onClick={(e) => { e.preventDefault(); openCharge(); }}>
          <span aria-hidden="true" class="sl-foot-ic info"><Icon name="plus" size={20} stroke={2} /></span>
          <span class="sl-foot-t"><span>Add a charge</span><span>{b.settings.services.filter((s) => !/^delivery/.test(s.id)).map((s) => s.label.toLowerCase()).join(' · ')}</span></span>
          <span class="sl-foot-go"><Icon name="chevron-right" size={16} stroke={2.4} /></span>
        </a>
      )}
    </div>
  );
}
