/*
 * The New customer sheet as drawn (CU20–CU23): who it will be (the face and
 * three ticks), where it came from (their chat), the fields, the one already
 * saved when the name or number is theirs, and two buttons.
 */
import type { JSX, RefObject } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Duo, Icon, phWhatsapp, type IconName } from '../../../ui/icons.tsx';
import { cx } from '../../../ui/util.tsx';
import { short as shortMoney } from '../../../core/money.ts';
import { clock, dayOf } from '../../../core/time.ts';
import type { Books, Customer, CustomerKind } from '../../../core/types.ts';
import { rhythmOf, spaced } from './data.ts';
import { Ring44 } from './local-rings.tsx';

export interface Dup { kind: 'name' | 'phone'; c: Customer }
interface Act { word: string; on: () => void; icon?: IconName }

/** LOCAL PART · a hard hat in the 24-grid stroke style: the Contractor kind (the truck means Delivery). */
function HardHat(): JSX.Element {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 18h18M5 18v-2.5a7 7 0 0 1 14 0V18M10 9V6h4v3" /></svg>;
}

const KINDS: [CustomerKind, string][] = [['contractor', 'Contractor'], ['reseller', 'Reseller'], ['retail', 'Retail']];

/** Pronoun from a WhatsApp name, when it says one ("Mama Shine" → her). */
function whose(name: string): string {
  return /^(mama|mrs|ms|miss|sister|auntie|aunt|madam|maama|nnalongo)\b/i.test(name) ? 'her' : /^(mr|baba|brother|uncle|sir|ssebo|taata)\b/i.test(name) ? 'his' : 'their';
}

export function NewForm(p: {
  b: Books; today: string; name: string; onName: (v: string) => void; phone: string; onPhone: (v: string) => void; phoneRef: RefObject<HTMLInputElement>;
  phoneWarn: string | null; onPhoneBlur: () => void; onPhoneFocus: () => void; place: string; onPlace: (v: string) => void;
  kind: CustomerKind | null; onKind: (k: CustomerKind) => void; ruth: string; face: string;
  chat: { at: number; phone: string; name: string; filled: boolean; on: () => void } | null;
  dup: Dup | null; short9: boolean; top: number; busy: 'add' | 'sell' | null; onClose: () => void; acts: { left: Act; right: Act };
}): JSX.Element {
  const [focus, setFocus] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { const el = root.current && root.current.parentElement; if (el && el.classList.contains('ow-sheet')) el.style.top = `${p.top}px`; }, [p.top]);
  const ticks: [string, boolean][] = [['Name', !!p.name.trim()], ['Phone', p.phone.length === 9], ['Kind', !!p.kind]];
  const done = ticks.every(([, x]) => x), off = p.short9;
  const field = (k: string, warn = false) => cx('cu-nf-box', warn ? 'warn' : focus === k && 'focus');
  const dupCard = (d: Dup) => {
    const r = rhythmOf(p.b, d.c, p.today), orders = p.b.orders.filter((o) => o.customerId === d.c.id), today = orders.some((o) => dayOf(o.placedAt) === p.today);
    return (
      <div class="cu-dup">
        <span class="cu-dup-h"><Icon name="person" size={14} stroke={2.2} />{d.kind === 'name' ? 'Already saved · same name' : 'Same number · a number is saved once'}</span>
        <div class="cu-dup-who">
          <Ring44 initials={d.c.initials} tint={d.c.tint} tone={r.tone} fill={r.fill} />
          <span><span>{d.c.name}</span><span>{[d.c.place, `${orders.length} orders`, r.every ? `every ${r.every} days` : ''].filter(Boolean).join(' · ')}</span></span>
          {d.c.owes > 0 && <span class="cu-dup-f"><span class="mono">{shortMoney(d.c.owes)}</span><span>owes</span></span>}
        </div>
        <div class="cu-dup-tags">
          {d.c.kind && <span>{d.c.kind[0].toUpperCase() + d.c.kind.slice(1)}</span>}
          {d.c.phone && <span class={cx('mono', d.kind === 'phone' && 'hit')}>{d.c.phone}</span>}
          {d.kind === 'name' && today && <span>last order today</span>}
        </div>
      </div>
    );
  };
  return (
    <div ref={root} class="ow-lsheet cu-ls cu-nf">
      <button type="button" class="ow-grab" aria-label="Close" onClick={p.onClose} />
      <div class="ow-lsheet-h"><div class="ow-lsheet-ht"><h2>New customer</h2></div>
        <button type="button" class="ow-x-tile" aria-label="Close" onClick={p.onClose}><Icon name="close" size={16} stroke={2.2} /></button></div>
      <div class="ow-lsheet-b cu-nf-b">
        {!p.dup && (
          <div class="cu-nf-who">
            <span aria-hidden="true" class={cx('cu-nf-face', done && 'done')}>{p.face}</span>
            <span class="cu-nf-ticks">{ticks.map(([w, ok]) => <span key={w} class={ok ? 'ok' : undefined}><span aria-hidden="true">{ok && <Icon name="check" size={11} stroke={3.4} />}</span>{w}</span>)}</span>
          </div>
        )}
        {p.chat && (
          <button type="button" class="cu-nf-chat" onClick={p.chat.on}>
            <span aria-hidden="true"><Duo i={phWhatsapp} size={18} /></span>
            <span><span>{`From ${whose(p.chat.name)} chat · ${clock(p.chat.at)}`}</span><span class="mono">{`${p.chat.phone} · “${p.chat.name}”`}</span></span>
            <span aria-hidden="true" class="ow-chev"><Icon name="chevron-right" size={15} stroke={2.4} /></span>
          </button>
        )}
        <label class="cu-nf-f"><span>Name</span>
          <span class={field('name')}><input type="text" aria-label="Name" value={p.name} onFocus={() => setFocus('name')} onBlur={() => setFocus(null)} onInput={(e) => p.onName((e.target as HTMLInputElement).value)} /></span></label>
        {p.dup && p.dup.kind === 'name' && dupCard(p.dup)}
        <label class="cu-nf-f"><span>Phone</span>
          <span class={field('phone', !!p.phoneWarn)}>
            <span class="mono cu-nf-cc">+256</span>
            <input ref={p.phoneRef} type="tel" inputMode="numeric" class="mono" placeholder="7XX XXX XXX" aria-label="Phone number after +256" value={spaced(p.phone)}
              onFocus={() => { setFocus('phone'); p.onPhoneFocus(); }} onBlur={() => { setFocus(null); p.onPhoneBlur(); }} onInput={(e) => p.onPhone((e.target as HTMLInputElement).value)} />
            <span role="img" aria-label={`${p.phone.length} of 9 digits`} class="cu-nf-dots">
              {Array.from({ length: 9 }, (_, i) => <span key={i} class={i < p.phone.length ? (p.phone.length === 9 && !p.phoneWarn ? 'ok' : 'warn') : undefined} />)}
            </span>
          </span>
          {p.phoneWarn && <span class="cu-nf-warn"><Icon name="warning" size={14} stroke={2.2} />{p.phoneWarn}</span>}
        </label>
        {p.dup && p.dup.kind === 'phone' && dupCard(p.dup)}
        <label class="cu-nf-f"><span>Place · helps the driver</span>
          <span class={field('place')}><Icon name="pin" size={18} stroke={2} style={{ color: '#5F6980', flex: 'none' }} />
            <input type="text" placeholder="Area or landmark" aria-label="Place" value={p.place} onFocus={() => setFocus('place')} onBlur={() => setFocus(null)} onInput={(e) => p.onPlace((e.target as HTMLInputElement).value)} /></span></label>
        <div class="cu-nf-f"><span>Kind</span>
          <div role="radiogroup" aria-label="Kind of customer" class="cu-nf-kinds">
            {KINDS.map(([k, w]) => (
              <button key={k} type="button" role="radio" aria-checked={p.kind === k} class={p.kind === k ? 'on' : undefined} onClick={() => p.onKind(k)}>
                {k === 'contractor' ? <HardHat /> : <Icon name={k === 'reseller' ? 'store' : 'basket'} size={17} stroke={1.9} />}{w}
              </button>
            ))}
          </div>
          {!(p.dup && p.dup.kind === 'phone') && <span class="cu-nf-lock"><Icon name="lock" size={13} stroke={2.2} />{`You set it now · after this only ${p.ruth} changes it`}</span>}
        </div>
        <div class="cu-nf-acts">
          <button type="button" class="cu-nf-ghost" disabled={off} onClick={p.acts.left.on}>{p.acts.left.word}</button>
          <button type="button" class="cu-nf-go" disabled={off} onClick={p.acts.right.on}>
            {p.busy ? <span class="ow-spin" aria-hidden="true" /> : p.acts.right.icon && <Icon name={p.acts.right.icon} size={18} stroke={2.4} />}{p.busy ? 'Sending…' : p.acts.right.word}
          </button>
        </div>
      </div>
    </div>
  );
}
