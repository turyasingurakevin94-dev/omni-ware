/*
 * Someone new: a hired driver we have never used (store-agent AD01 empty, AD03 filled, AD04 a landline;
 * opened from OU03's "Someone new · name, plate, phone"; a sheet over the run, not a route). Name, plate,
 * phone, each a 64 px row with its 40 px icon tile; the phone checked as a Ugandan mobile as it is typed
 * (load.ts hiredPhoneOk, spec §4.4 "The driver is remembered"); "Robert gets the drop on WhatsApp" (W8a,
 * nothing written). Navy "Robert drives" puts him on the run; the run's slide still commits (W8).
 * The sheet writes nothing, so it has no sending or not-saved state (AD manifest states_note).
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { firstWord, orderNo, phoneText } from '../../../core/names.ts';
import { orderFace, yardFace, shortName } from '../../../core/store/faces.ts';
import { hiredPhoneOk, type Direction } from '../../../core/store/load.ts';
import type { YardBooks } from '../../../core/store/types.ts';
import { Icon, type IconName } from '../../../ui/icons.tsx';
import { sheet } from '../../../ui/sheet.tsx';
import { cx } from '../../../ui/util.tsx';
import type { HiredPick } from './Hired.tsx';
import { AfterSlide, seller } from './parts.tsx';
import './someone.css';

const digits = (s: string): string => s.replace(/[^0-9]/g, '');

/** One field: the icon tile, its label (or what is wrong with it), the input, a mark at the end. */
function Field(p: { id: string; icon: IconName; tone: 'slate' | 'warm' | 'good' | 'bad'; label: string; value: string; ph: string; mono?: boolean;
  tel?: boolean; focus?: boolean; mark?: 'ok' | 'bad'; onInput: (v: string) => void }): JSX.Element {
  return (
    <label class={cx('sn-f', p.mark === 'bad' && 'bad')}>
      <span aria-hidden="true" class={cx('sn-i', p.tone)}><Icon name={p.icon} size={20} stroke={2} /></span>
      <span class="sn-t">
        <span class={cx('sn-l', p.mark)}>{p.label}</span>
        <input id={p.id} class={cx(p.mono && 'mono')} value={p.value} placeholder={p.ph} autoFocus={p.focus} autoComplete="off"
          inputMode={p.tel ? 'tel' : 'text'} type={p.tel ? 'tel' : 'text'} autoCapitalize={p.mono ? 'characters' : 'words'}
          onInput={(e) => p.onInput((e.currentTarget as HTMLInputElement).value)} />
      </span>
      {p.mark && <span role="img" aria-label={p.label} class={cx('sn-m', p.mark)}><Icon name={p.mark === 'ok' ? 'check' : 'warning'} size={13} stroke={p.mark === 'ok' ? 3.2 : 2.6} /></span>}
    </label>
  );
}

function SomeoneNewSheet(p: { d: Direction; b: YardBooks; onBack: () => void; onPick: (h: HiredPick) => void }): JSX.Element {
  const [name, setName] = useState(''), [plate, setPlate] = useState(''), [phone, setPhone] = useState('');
  const o = p.d.drops[0].o, from = seller(p.b, o), first = firstWord(name.trim());
  const n = digits(phone), ok = hiredPhoneOk(phone), landline = !ok && n.length >= 10;
  const missing = !first ? 'name' : !ok ? 'phone' : null;
  const go = () => {
    if (missing) { const el = document.getElementById(missing === 'name' ? 'sn-name' : 'sn-phone'); if (el) el.focus(); return; }
    p.onPick({ name: name.trim(), phone: n, what: plate.trim().toUpperCase() });
    sheet.close();
  };
  return (
    <div class="ow-lsheet sn">
      <span aria-hidden="true" class="ow-grab" />
      <div class="ow-lsheet-h sn-h">
        <button type="button" class="ow-x-tile" aria-label="Back to the hired drivers" onClick={p.onBack}><Icon name="back" size={16} stroke={2.2} /></button>
        <div class="ow-lsheet-ht sn-ht"><span class="ow-lsheet-eye">{`${p.d.name.replace(' way', '')} · ${p.d.drops.map((x) => orderNo(x.o.id)).join(' ')} · hired`}</span><h2>Someone new</h2></div>
        <button type="button" class="ow-x-tile" aria-label="Close" onClick={sheet.close}><Icon name="close" size={16} stroke={2.2} /></button>
      </div>
      <div class="ow-lsheet-b sn-b">
        <div role="group" aria-label="Someone new" class="sn-fs">
          <Field id="sn-name" icon="person" tone="slate" label="Name" value={name} ph="First and last name" focus onInput={setName} />
          <Field id="sn-plate" icon="truck" tone="warm" label="Plate" value={plate} ph="UAX 000A" mono onInput={setPlate} />
          <Field id="sn-phone" icon="phone" tone={landline ? 'bad' : 'good'} label={ok ? 'Phone checked' : landline ? 'Not a mobile number' : 'Phone'}
            value={phone} ph="07__ ___ ___" mono tel mark={ok ? 'ok' : landline ? 'bad' : undefined}
            onInput={(v) => setPhone(digits(v).length >= 10 ? phoneText(v) : v)} />
        </div>
        <div class={cx('sn-wa', ok && first ? 'good' : landline ? 'bad' : '')}>
          <Icon name="whatsapp" size={18} stroke={1.9} />
          <span>{landline ? 'No drop on WhatsApp to a landline' : ok && first ? `${first} gets the drop on WhatsApp` : 'The driver gets the drop on WhatsApp'}</span>
        </div>
        <AfterSlide ground="#FFFFFF" faces={[...(from ? [yardFace(p.b, from)] : []), ...p.d.drops.map((x) => orderFace(x.o, p.b))]}
          who={[from ? firstWord(from.name) : null, ...p.d.drops.map((x) => shortName(x.o))].filter(Boolean).join(' and ')} what={`On the road · ${first || 'name'} (hired)`} />
        <button type="button" class={cx('sn-go', missing && 'off')} aria-disabled={missing ? 'true' : undefined} onClick={go}>
          <Icon name="truck" size={18} stroke={2} />{missing === 'name' ? 'Add a name first' : missing === 'phone' ? 'Fix the phone first' : `${first} drives`}
        </button>
      </div>
    </div>
  );
}

/** AD01: Someone new over the run; Back returns to the hired drivers (OU03). */
export function openSomeoneNew(d: Direction, b: YardBooks, onBack: () => void, onPick: (h: HiredPick) => void): void {
  sheet.open(() => <SomeoneNewSheet d={d} b={b} onBack={onBack} onPick={onPick} />, { label: 'Someone new', top: 236 });
}
