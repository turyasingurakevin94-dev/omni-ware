/*
 * SL17 · the shop delivers: their saved site (or another), the site phone
 * the driver calls, how far, when, and the shop's fee for the area (Sales
 * may change it: spec 04 Q2, the default). Done puts it in the dock.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { deliveryFor } from '../../../core/services.ts';
import { avatarStyle } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { fig } from '../../../ui/Money.tsx';
import { sheet } from '../../../ui/sheet.tsx';
import { books } from '../shell/store.ts';
import { Frame } from './Frame.tsx';
import { cur, setDelivery, type When } from './model.ts';
import { openAmount } from './sheets.tsx';
import './delivery.css';

const WHEN: [When, string, string][] = [['today-pm', 'Today', 'afternoon'], ['tomorrow-am', 'Tomorrow', 'morning'], ['tomorrow-pm', 'Tomorrow', 'afternoon']];

export function DeliverySheet(): JSX.Element | null {
  const b = books.value, x = cur.value;
  const c = b && x && x.customerId ? b.customers.find((y) => y.id === x.customerId) || null : null;
  const area = c ? c.place : '', sv = b ? deliveryFor(b.settings.services, area) : null;
  const had = x && x.delivery, oldFee = x ? x.charges.find((ch) => /^Delivery/.test(ch.label)) : null;
  const [where, setWhere] = useState(had ? had.where : c ? c.address : '');
  const [phone, setPhone] = useState(had ? had.phone : c ? c.phone : '');
  const [when, setWhen] = useState<When>(had ? had.when : 'today-pm');
  const [fee, setFee] = useState(oldFee ? oldFee.value : sv ? sv.value : 0);
  const [edit, setEdit] = useState<'where' | 'phone' | null>(null);
  if (!b || !x) return null;
  const driver = b.members.find((m) => m.role === 'driver' && m.presence) || b.members.find((m) => m.role === 'driver');
  const mins = sv ? sv.mins : undefined;
  const saved = !!c && where === c.address;
  const done = () => { setDelivery({ where, phone, when }, fee, area); sheet.close(); };
  return (
    <Frame title="The shop delivers" icon={<span aria-hidden="true" class="sl-dl-van"><Icon name="truck" size={22} stroke={1.9} /></span>} onClose={sheet.close} pad="14px 16px 20px"
      foot={<button type="button" class="sl-btn navy" onClick={done}><Icon name="check" size={18} stroke={2.6} />Done</button>}>
      <div class="sl-dl-card">
        <div class="sl-dl-r" onClick={() => setEdit('where')}>
          <span aria-hidden="true" class="sl-dl-pin"><Icon name="pin" size={20} stroke={2} /></span>
          <span class="sl-dl-t"><span class="good">Where{saved && <span class="sl-dl-saved">saved</span>}</span>
            {edit === 'where' ? <input class="sl-dl-in" value={where} aria-label="Where it goes" autoFocus onInput={(e) => setWhere((e.target as HTMLInputElement).value)} onBlur={() => setEdit(null)} />
              : <span class="b">{where.replace(/,\s*/, ' · ')}</span>}</span>
          <button type="button" class="sl-dl-pen" aria-label="Change where it goes" onClick={() => setEdit('where')}><Icon name="pen" size={18} stroke={2} /></button>
        </div>
        <div class="sl-dl-r" onClick={() => setEdit('phone')}>
          {c && <span aria-hidden="true" class="ow-av sl-dl-av" style={avatarStyle({ initials: c.initials, tint: c.tint, size: 40, font: 13 })}>{c.initials}</span>}
          <span class="sl-dl-t"><span>{`Site phone${driver ? ` · ${driver.name.split(' ')[0]} calls it` : ''}`}</span>
            {edit === 'phone' ? <input class="sl-dl-in mono" inputMode="tel" value={phone} aria-label="Site phone" autoFocus onInput={(e) => setPhone((e.target as HTMLInputElement).value)} onBlur={() => setEdit(null)} />
              : <span class="b"><span class="mono">{phone}</span></span>}</span>
          <button type="button" class="sl-dl-pen" aria-label="Change the site phone" onClick={() => setEdit('phone')}><Icon name="pen" size={18} stroke={2} /></button>
        </div>
      </div>
      <div role="img" aria-label={`${where.split(',')[0]}${mins ? `, about ${mins} minutes from the shop` : ''}`} class="sl-dl-map">
        <svg width="328" height="64" viewBox="0 0 328 64" aria-hidden="true"><path d="M0 46 C 60 40, 90 18, 150 24 S 250 50, 328 30" fill="none" stroke="#FFFFFF" stroke-width="9" stroke-linecap="round" /><path d="M40 40 C 90 34, 110 20, 160 26 S 240 44, 286 34" fill="none" stroke="#16203C" stroke-width="3" stroke-dasharray="2 6" stroke-linecap="round" /><path d="M120 0 L 140 64 M 230 0 L 214 64" stroke="#FFFFFF" stroke-width="5" /></svg>
        <span class="sl-dl-shop"><Icon name="store" size={16} stroke={2} /></span>
        <span class="sl-dl-dest"><Icon name="pin" size={16} stroke={2} /></span>
        {mins && <span class="mono sl-dl-mins">{`~${mins} m`}</span>}
      </div>
      <span class="sl-dl-h">When</span>
      <div class="sl-dl-when">
        {WHEN.map(([k, d, t]) => <button key={k} type="button" aria-pressed={when === k} class={when === k ? 'on' : ''} onClick={() => setWhen(k)}><span>{d}</span><span>{t}</span></button>)}
      </div>
      <button type="button" class="sl-dl-fee" aria-label="Change the delivery fee" onClick={() => openAmount({ title: 'Delivery fee', value: fee, verb: 'Use', onUse: (v) => { setFee(v); setDelivery({ where, phone, when }, v, area); } })}>
        <span class="sl-dl-t"><span class="b">Delivery fee</span><span>{sv ? `the shop’s fee for ${area}` : 'no fee set for this area'}</span></span>
        <span class="mono sl-dl-feev">{fig(fee, false, true)}</span><span class="sl-dl-penc"><Icon name="pen" size={18} stroke={2} /></span>
      </button>
    </Frame>
  );
}
