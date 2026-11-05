/*
 * SL01 · Who is it for? (the red +), and SL02 · a typo: the customer they
 * meant. A light sheet over the screen it was opened from: the counter and
 * a walk-in, the orders still open, a new number asking on WhatsApp, who is
 * due; typing finds a customer by name, phone or place, or the one a letter
 * or two off. Every row starts the order (or opens its own screen).
 */
import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { cashTotal, orderTotal, short } from '../../../core/money.ts';
import { addDays, dayLabel, howLong } from '../../../core/time.ts';
import type { Books, Customer } from '../../../core/types.ts';
import { avatarStyle, RingAvatar } from '../../../ui/Avatar.tsx';
import { Duo, Icon, phArrowR, phBasket, phClock, phSearch, phUserPlus, phWhatsapp } from '../../../ui/icons.tsx';
import { fig } from '../../../ui/Money.tsx';
import { useDragClose } from '../../../ui/sheet.tsx';
import { nav, screen, stack } from '../shell/nav.ts';
import { books, chats, drafts, now } from '../shell/store.ts';
import { dueWords } from '../../../core/customers.ts';
import { dayWord, first, lastOrder, ordersOf, rhythmOf, whosDue } from './insights.ts';
import { findCustomer } from '../../../core/find.ts';
import './who.css';
import { ClearButton } from '../../../ui/Search.tsx';

/** The screen it was opened over, drawn under the sheet (TD01 behind SL02). */
export function Under(): JSX.Element | null {
  const s = stack.value, below = s[s.length - 2], def = below && screen(below.id);
  if (!def) return null;
  const V = def.view;
  return <div class="sl-under" aria-hidden="true" inert><V params={below.params} /></div>;
}

/** What a tap on the sheet chooses. As the red +, it opens that screen; over an order, the order decides (SL26). */
export type Pick = { kind: 'customer'; id: string } | { kind: 'walkin' } | { kind: 'draft'; key: string } | { kind: 'counter' } | { kind: 'new'; name?: string; phone?: string };

/** The red +: each choice opens its screen in place of the sheet. */
function open(x: Pick): void {
  if (x.kind === 'customer') nav.replace('sell/order', { customer: x.id });
  else if (x.kind === 'walkin') nav.replace('sell/order', { customer: '' });
  else if (x.kind === 'draft') nav.replace('sell/order', { draft: x.key });
  else if (x.kind === 'counter') nav.replace('counter');
  else nav.replace('customers/new', { ...(x.name ? { name: x.name } : {}), ...(x.phone ? { phone: x.phone } : {}) });
}

/** The sheet's body: the search and what it finds, or the lists. */
export function WhoBody(p: { b: Books | null; pick: (x: Pick) => void }): JSX.Element {
  const [q, setQ] = useState(''), typing = q.trim().length > 0;
  return (
    <div class={'sl-who-b' + (typing ? ' typing' : '')}>
      <label class={'sl-who-q' + (typing ? ' on' : '')}>
        <Duo i={phSearch} size={19} color="#5F6980" />
        <input type="search" placeholder="Name, phone or place" aria-label="Customer name, phone or place" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
        {typing && <ClearButton label="Clear" tight on={() => setQ('')} />}
      </label>
      {p.b && (typing ? <Found b={p.b} q={q.trim()} pick={p.pick} /> : <Lists b={p.b} pick={p.pick} />)}
    </div>
  );
}

export function Who(): JSX.Element {
  const b = books.value, box = useRef<HTMLDivElement>(null), scrim = useRef<HTMLDivElement>(null);
  useDragClose(box, () => nav.back(), scrim);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') nav.back(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  return (
    <div class="sl-who">
      <Under />
      <div ref={scrim} class="ow-scrim sl-who-scrim" role="button" tabIndex={0} aria-label="Back to Today" onClick={() => nav.back()} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nav.back(); } }} />
      <div ref={box} class="sl-who-sheet" role="dialog" aria-modal="true" aria-label="Who is it for?">
        <span aria-hidden="true" class="ow-grab" />
        <div class="ow-lsheet-h">
          <div class="ow-lsheet-ht"><h2>Who is it for?</h2></div>
          <button type="button" class="ow-x-tile" aria-label="Close" onClick={() => nav.back()}><Icon name="close" size={16} stroke={2.2} /></button>
        </div>
        <WhoBody b={b} pick={open} />
      </div>
    </div>
  );
}

function Lists(p: { b: Books; pick: (x: Pick) => void }): JSX.Element {
  const b = p.b, t = now.value, due = whosDue(b, t), open = drafts.value.slice().sort((x, y) => x.at - y.at);
  const cb = chats.value, asking = cb ? cb.chats.filter((c) => !c.customerId && !c.ownerId && c.lastInAt && (!c.lastReadAt || c.lastReadAt < c.lastInAt)) : [];
  // Their newest message that has words (a photo with no caption has none: SL01).
  const said = (id: number) => {
    const m = cb ? cb.recent.filter((x) => x.chatId === id && x.dir === 'in' && !!x.body && !!x.body.trim()).sort((x, y) => y.at - x.at)[0] : null;
    return m ? (m.body.match(/^[^?.!]*[?.!]?/) || [''])[0] : '';
  };
  return (
    <>
      <div class="sl-who-two">
        <a href="#" class="sl-who-tile" onClick={(e) => { e.preventDefault(); p.pick({ kind: 'counter' }); }}>
          <span aria-hidden="true" class="sl-who-ic good"><Icon name="cash" size={20} stroke={1.9} style={{ color: '#0F6B43' }} /></span>
          <span class="sl-who-tt"><span>Counter sale</span><span>pay and go</span></span>
        </a>
        <a href="#" class="sl-who-tile" onClick={(e) => { e.preventDefault(); p.pick({ kind: 'walkin' }); }}>
          <span aria-hidden="true" class="sl-who-ic slate"><Icon name="store" size={20} stroke={1.9} style={{ color: '#3D4A5C' }} /></span>
          <span class="sl-who-tt"><span>Walk-in order</span><span>no name needed</span></span>
        </a>
      </div>
      {open.length > 0 && (
        <div class="sl-who-g">
          <div class="sl-who-gh"><Duo i={phBasket} size={18} color="#95530C" /><span>Still open</span><span class="mono">{open.length}</span></div>
          <div class="sl-who-open">
            {open.map((d) => {
              const c = d.customerId ? b.customers.find((x) => x.id === d.customerId) : null, n = d.lines.length;
              return (
                <a key={d.key} href="#" class="sl-who-orow" onClick={(e) => { e.preventDefault(); p.pick({ kind: 'draft', key: d.key }); }}>
                  <span aria-hidden="true" class="ow-av" style={{ ...avatarStyle({ initials: '', tint: c ? c.tint : 't4', size: 36, font: 12 }), boxShadow: '0 0 0 2px #FDEEE1, 0 0 0 3.5px #95530C' }}>{c ? c.initials : 'WI'}</span>
                  <span class="sl-who-ot"><span>{d.client.name}</span><span class="mono">{`${n} item${n === 1 ? '' : 's'} · ${fig(cashTotal({ lines: d.lines, charges: d.charges, discount: 0 }))}`}</span></span>
                  <span class="sl-who-resume">Resume<Duo i={phArrowR} size={14} color="#FFFFFF" /></span>
                </a>
              );
            })}
          </div>
        </div>
      )}
      {asking.length > 0 && (
        <div class="sl-who-g">
          <div class="sl-who-gh"><Duo i={phWhatsapp} size={18} color="#0F6B43" /><span>Asking on WhatsApp</span><span class="mono">{asking.length}</span></div>
          {asking.map((c) => (
            <a key={c.id} href="#" class="sl-who-ask" onClick={(e) => { e.preventDefault(); p.pick({ kind: 'new', phone: c.phone, name: c.profileName }); }}>
              <span aria-hidden="true" class="sl-who-anon"><Icon name="person" size={20} stroke={1.9} /></span>
              <span class="sl-who-at"><span><span class="mono">{c.phone}</span><span class="sl-who-new">new</span></span><span>{`“${said(c.id)}”`}</span></span>
              <span class="mono sl-who-wait">{howLong(c.lastInAt as number, t)}</span>
            </a>
          ))}
        </div>
      )}
      {due.length > 0 && (
        <div class="sl-who-g">
          <div class="sl-who-gh"><Duo i={phClock} size={18} color="#5F6980" /><span>Who's due</span><span class="mono">{due.length}</span></div>
          <div class="sl-who-due">
            {due.map(({ c, r }) => (
              <a key={c.id} href="#" class="sl-who-drow" onClick={(e) => { e.preventDefault(); p.pick({ kind: 'customer', id: c.id }); }}>
                <RingAvatar face={{ initials: c.initials, tint: c.tint }} tone={r.late === 0 ? 'due' : 'late'} fill={1} />
                <span class="sl-who-dt"><span>{c.name}</span><span class={r.late === 0 ? 'due' : 'late'}>{dueWords(r)}</span></span>
                {c.owes > 0 && <span class="sl-who-owes"><span class="mono">{short(c.owes)}</span><span>owes</span></span>}
              </a>
            ))}
          </div>
        </div>
      )}
      <a href="#" class="sl-who-new-c" onClick={(e) => { e.preventDefault(); p.pick({ kind: 'new' }); }}><Duo i={phUserPlus} size={20} color="#FFFFFF" />New customer</a>
    </>
  );
}

/** SL02: the customer they meant, as one card; "Add … as new" under it. */
function Found(p: { b: Books; q: string; pick: (x: Pick) => void }): JSX.Element {
  const b = p.b, hit = findCustomer(b, p.q);
  return (
    <>
      {hit && <Card b={b} c={hit.c} off={hit.off} mark={hit.mark} pick={p.pick} />}
      <a href="#" class="sl-who-add" onClick={(e) => { e.preventDefault(); p.pick({ kind: 'new', name: p.q }); }}>
        <Icon name="person-plus" size={18} stroke={2} />{`Add “${p.q}” as new`}
      </a>
    </>
  );
}

function Card(p: { b: Books; c: Customer; off: number; mark: number; pick: (x: Pick) => void }): JSX.Element {
  const b = p.b, c = p.c, t = now.value, r = rhythmOf(b, c, t), last = lastOrder(b, c.id), n = ordersOf(b, c.id).length, late = r.late;
  const fill = r.since != null && r.every ? Math.min(1, r.since / r.every) : 0;
  const due = late == null || !r.last || !r.every ? '' : late > 0 ? `${late} day${late === 1 ? '' : 's'} late` : late === 0 ? 'Due today' : `Due ${dayLabel(addDays(r.last, r.every))}`;
  const name = p.mark >= 0 ? <>{c.name.slice(0, p.mark)}<mark>{c.name[p.mark]}</mark>{c.name.slice(p.mark + 1)}</> : c.name;
  return (
    <>
      {p.off > 0 && <div class="sl-who-dym"><span>Did you mean</span><span class="mono">{`${p.off} letter${p.off === 1 ? '' : 's'} off`}</span></div>}
      <div class="sl-who-card">
        <div class="sl-who-ch">
          <span aria-hidden="true" class="sl-who-ring">
            <svg width="52" height="52" viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" fill="none" stroke="#EFECE6" stroke-width="3" />
              <circle cx="26" cy="26" r="24" fill="none" stroke={late != null && late > 0 ? '#95530C' : late === 0 ? '#0F6B43' : '#9AA1AE'} stroke-width="3" stroke-linecap="round" stroke-dasharray={`${Math.max(8, Math.round(150.8 * fill))} 150.8`} transform="rotate(-90 26 26)" /></svg>
            <span style={avatarStyle({ initials: c.initials, tint: c.tint, size: 40, font: 14 })}>{c.initials}</span>
          </span>
          <span class="sl-who-ct"><span>{name}</span><span>{`${due}${r.every ? ` · every ${r.every} days` : ''}`}</span><span class="mono">{[c.place, c.phone].filter(Boolean).join(' · ')}</span></span>
        </div>
        <div class="sl-who-stats">
          <span><b class="mono">{n}</b><span>orders</span></span>
          <span class={c.owes > 0 ? 'owes' : ''}><b class="mono">{short(Math.max(0, c.owes))}</b><span>owes</span></span>
          {last && <span><b class="mono">{short(orderTotal(last))}</b><span>{`last · ${dayWord(last.placedAt, t)}`}</span></span>}
        </div>
        <a href="#" class="sl-who-go" onClick={(e) => { e.preventDefault(); p.pick({ kind: 'customer', id: c.id }); }}><Icon name="plus" size={18} stroke={2.4} />{`New order for ${first(c.name)}`}</a>
      </div>
    </>
  );
}
