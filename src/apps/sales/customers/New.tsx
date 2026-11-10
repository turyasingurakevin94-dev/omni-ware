/*
 * customers/new { phone?, name?, chat? } · New customer (CU20–CU23), a sheet
 * over the list. Name, phone (+256 and 9 digits, a dot per digit), place,
 * kind (Sales sets it once; after that only the Manager changes it). A name
 * or number already saved is caught before it is saved twice. One write:
 * addCustomer; "Add and sell" goes straight on to the order.
 */
import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { sheet } from '../../../ui/sheet.tsx';
import { toast } from '../../../ui/toast.tsx';
import { isDataError } from '../../../core/datasource.ts';
import { initials, phone9 } from '../../../core/names.ts';
import { dayOf } from '../../../core/time.ts';
import type { Customer, CustomerKind } from '../../../core/types.ts';
import { nav } from '../shell/nav.ts';
import { act, books, chats, now } from '../shell/store.ts';
import type { ScreenProps } from '../shell/types.ts';
import { role } from './Customer.tsx';
import { first } from './cust-head.tsx';
import { nine, short, spaced } from './data.ts';
import { ListScreen } from './List.tsx';
import { NewForm, type Dup } from './new-form.tsx';
import './new.css';

/** Set when the sheet closes because the screen is going somewhere else (so it does not also go back). */
let leaving = false;
function leave(): void { leaving = true; sheet.close(); }

export function NewScreen(p: ScreenProps): JSX.Element {
  // The list stays behind the sheet, as the board draws it; the sheet is the screen's own layer.
  useEffect(() => {
    leaving = false;
    sheet.open(() => <NewSheet params={p.params} />, { label: 'New customer', onClose: () => { if (!leaving) nav.back(); } });
    return () => { leaving = true; if (sheet.isOpen) sheet.close(); };
  }, []);
  return <ListScreen params={{}} />;
}

function NewSheet(p: { params: ScreenProps['params'] }): JSX.Element {
  // The form opens while the books are still coming (CU08 links to CU20); it saves once they are here.
  const b = books.value, cb = chats.value, me = b ? b.me.id : '';
  const fromChat = p.params.chat != null ? (cb ? cb.chats.find((c) => c.id === Number(p.params.chat)) : null) : null;
  // The newest chat from a number nobody has saved yet: offered to fill from (CU20).
  const unknown = cb ? cb.chats.filter((c) => !c.customerId && c.lastInAt && (!c.ownerId || c.ownerId === me)).sort((x, y) => (y.lastInAt || 0) - (x.lastInAt || 0))[0] || null : null;
  // The chat it was opened from wins; else the newest unknown chat, but only when no number came in or it is that chat's.
  const asked = nine(String(p.params.phone || ''));
  const chat = fromChat || (unknown && (!asked || nine(unknown.phone) === asked) ? unknown : null);
  const [name, setName] = useState(String(p.params.name || (fromChat ? fromChat.profileName : '') || ''));
  const [phone, setPhone] = useState(nine(String(p.params.phone || (fromChat ? fromChat.phone : '') || '')));
  const [place, setPlace] = useState('');
  const [kind, setKind] = useState<CustomerKind | null>('retail');
  const [picked, setPicked] = useState(false);
  const [phoneOut, setPhoneOut] = useState(false);
  const [busy, setBusy] = useState<'add' | 'sell' | null>(null);
  // "Add as new" (CU21 → CU20): the same-name card is put away; the form, with the name kept, needs a phone like any other.
  const [asNew, setAsNew] = useState('');
  // Saving was tried with no number, or a short one: refused as CU22 refuses it (the warning, both buttons off).
  const [tried, setTried] = useState(false);
  const phoneEl = useRef<HTMLInputElement>(null);

  const all = b ? b.customers.filter((c) => !c.qa) : [];
  const sameName = name.trim() && name.trim().toLowerCase() !== asNew ? all.find((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase()) || null : null;
  const sameNum = phone.length === 9 ? all.find((c) => phone9(c.phone) === phone || phone9(c.phone2) === phone) || null : null;
  // The kind of the one already saved, until Sales picks one.
  const k = !picked && sameName && sameName.kind ? sameName.kind : kind;
  const short9 = phone.length < 9 && (phone.length > 0 || tried);
  const dup: Dup | null = sameNum ? { kind: 'phone', c: sameNum } : sameName ? { kind: 'name', c: sameName } : null;
  const today = dayOf(now.value);
  const left = 9 - phone.length;
  const warn = sameNum ? `This number is already ${sameNum.name}` : short9 && (phoneOut || tried) ? `${left} more ${left > 1 ? 'digits' : 'digit'} · a number has 9 after +256` : null;

  const add = async (then: 'add' | 'sell'): Promise<void> => {
    if (busy) return;
    if (!b) { toast.show('Getting your customers', { kind: 'warn', sub: 'Save once they are here' }); return; }
    if (!name.trim()) { toast.show('Type their name', { kind: 'warn' }); return; }
    // A customer is saved with their number (CU22 refuses a short one; an empty one too).
    if (phone.length !== 9) { setTried(true); return; }
    setBusy(then);
    try {
      const r = await act<Customer>('addCustomer', { name: name.trim(), phone: '0' + spaced(phone), place: place.trim(), kind: k });
      leave();
      if (r.kept) { nav.back(); toast.show('Not sent yet · saved with signal'); return; }
      if (then === 'sell') nav.replace('sell/order', { customer: r.value.id, ...(chat ? { from: 'chat', chat: chat.id } : {}), ...(typeof p.params.items === 'string' ? { items: p.params.items } : {}) });
      else { nav.back(); toast.show(`${r.value.name} added`); }
    } catch (e) {
      toast.show('Not added', { kind: 'error', sub: isDataError(e) ? e.message : '', retry: () => { void add(then); } });
    } finally { setBusy(null); }
  };
  const open = (c: Customer) => { leave(); nav.replace('customers/customer', { id: c.id }); };

  return (
    <NewForm b={b} today={today} name={name} onName={setName} phone={phone} onPhone={(v) => setPhone(nine(v))} phoneRef={phoneEl}
      phoneWarn={warn}
      onPhoneBlur={() => setPhoneOut(true)} onPhoneFocus={() => setPhoneOut(false)}
      place={place} onPlace={setPlace} kind={k} onKind={(x) => { setKind(x); setPicked(true); }}
      ruth={b ? first(role(b, 'manager').name) : 'the Manager'} face={initials(name || '?')}
      chat={dup ? null : chat ? { at: chat.lastInAt || 0, phone: chat.phone, name: chat.profileName, filled: !!fromChat || (phone === nine(chat.phone) && name === chat.profileName), on: () => {
        if (!fromChat && !(phone === nine(chat.phone) && name === chat.profileName)) { setName(chat.profileName); setPhone(nine(chat.phone)); setTimeout(() => phoneEl.current && phoneEl.current.focus(), 0); return; }
        leave(); nav.replace('chats/chat', { id: chat.id });
      } } : null}
      dup={dup} short9={short9} busy={busy} onClose={() => sheet.close()}
      acts={dup && dup.kind === 'phone'
        ? { left: { word: `It’s ${short(dup.c.name)}`, on: () => open(dup.c) }, right: { word: 'Change number', icon: 'pen', on: () => { setPhone(''); phoneEl.current && phoneEl.current.focus(); } } }
        : dup ? { left: { word: 'Add as new', on: () => { setAsNew(name.trim().toLowerCase()); setTimeout(() => phoneEl.current && phoneEl.current.focus(), 0); } }, right: { word: `Use ${short(dup.c.name)}`, icon: 'check', on: () => open(dup.c) } }
          : { left: { word: 'Just add', on: () => { void add('add'); } }, right: { word: 'Add and sell', icon: 'plus', on: () => { void add('sell'); } } }} />
  );
}
