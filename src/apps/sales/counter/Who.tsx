/*
 * KC04 · Who is it for? A walk-in (chosen; no name on the receipt), or one of the customers due
 * today by their rhythm, or a name, phone or place; or a new customer.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { Avatar, RingAvatar } from '../../../ui/Avatar.tsx';
import { Duo, Icon, phClock, phSearch } from '../../../ui/icons.tsx';
import { fig } from '../../../ui/Money.tsx';
import { LightSheet, sheet } from '../../../ui/sheet.tsx';
import { phoneText } from '../../../core/names.ts';
import type { Customer } from '../../../core/types.ts';
import { nav } from '../shell/nav.ts';
import { books, now } from '../shell/store.ts';
import { dueOf } from './shop.ts';
import { sale, set } from './state.ts';
import './who.css';

export function openWho(): void {
  sheet.open(() => <WhoSheet />, { label: 'Who is it for?', top: 236 });
}

function pick(c: Customer | null): void {
  set({ customerId: c ? c.id : null });
  sheet.close();
}

function Row(p: { c: Customer; words: string; tone: 'due' | 'late' | null; last: boolean }): JSX.Element {
  const c = p.c;
  return (
    <a href="#" class={'kc-who-r' + (p.last ? ' last' : '')} onClick={(e) => { e.preventDefault(); pick(c); }}>
      {p.tone ? <RingAvatar initials={c.initials} tint={c.tint} tone={p.tone} fill={1} /> : <Avatar initials={c.initials} tint={c.tint} size={44} />}
      <span class="kc-who-t">
        <span class="kc-who-n">{c.name}</span>
        <span class={'kc-who-s' + (p.tone ? ' ' + p.tone : '')}>{p.words}</span>
      </span>
      {c.owes > 0 && <span class="kc-who-o"><span class="mono">{fig(c.owes, true)}</span><span>owes</span></span>}
    </a>
  );
}

function WhoSheet(): JSX.Element {
  const [text, setText] = useState('');
  const b = books.value;
  if (!b) return <LightSheet title="Who is it for?" onClose={sheet.close} ground><span /></LightSheet>;
  const chosen = sale.value.customerId, words = text.trim().toLowerCase(), digits = words.replace(/\D/g, '');
  const due = dueOf(b, now.value);
  const found = words ? b.customers.filter((c) => !c.qa && (c.name.toLowerCase().includes(words) || c.place.toLowerCase().includes(words) || (digits.length >= 3 && c.phone.replace(/\D/g, '').includes(digits)))).slice(0, 6) : [];
  const list = words ? found.map((c) => ({ c, words: [c.place, phoneText(c.phone)].filter(Boolean).join(' · '), tone: null })) : due.map((d) => ({ c: d.c, words: d.words, tone: d.late > 0 ? 'late' as const : 'due' as const }));
  return (
    <LightSheet title="Who is it for?" onClose={sheet.close} ground>
      <label class="kc-who-q">
        <Duo i={phSearch} size={19} color="#5F6980" />
        <input type="search" placeholder="Name, phone or place" aria-label="Customer name, phone or place" value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} />
      </label>
      <a href="#" class={'kc-walkin' + (chosen ? '' : ' on')} aria-current={chosen ? undefined : 'true'} onClick={(e) => { e.preventDefault(); pick(null); }}>
        <Avatar initials="WI" tint="t4" size={40} />
        <span class="kc-who-t"><span class="kc-who-n">Walk-in</span><span class="kc-who-s">Counter sale · no name on the receipt</span></span>
        {!chosen && <span aria-hidden="true" class="kc-walkin-ok"><Icon name="check" size={14} stroke={3.2} /></span>}
      </a>
      {!!list.length && (
        <div class="kc-who-g">
          {!words && (
            <div class="kc-who-gh">
              <Duo i={phClock} size={18} color="#5F6980" />
              <span>Who's due</span><span class="mono">{list.length}</span>
            </div>
          )}
          <div class="kc-who-l">{list.map((x, i) => <Row key={x.c.id} c={x.c} words={x.words} tone={x.tone} last={i === list.length - 1} />)}</div>
        </div>
      )}
      <div class="kc-who-f">
        <button type="button" class="kc-newc" onClick={() => { sheet.close(); nav.push('customers/new', { phone: digits || null, name: digits ? null : text.trim() || null }); }}>
          <Icon name="person-plus" size={18} stroke={2} />New customer
        </button>
      </div>
    </LightSheet>
  );
}
