/*
 * Fix a price or a phone (Suppliers.dc.html phone 3): the sheet over the
 * supplier. Price: what the list says and how old it is, what they say now
 * (type it or step it by 500), "Save · supplier told me" puts it straight
 * on the list (price.confirm; Moses sees it, nothing waits). "Still 41,000"
 * confirms the list's price in one tap. Phone: a number they gave goes to
 * Moses (Sourcing keeps supplier details).
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { phoneOk, phoneText } from '../../../core/names.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Button } from '../../../ui/Button.tsx';
import { AisleIcon, Icon } from '../../../ui/icons.tsx';
import { fig } from '../../../ui/Money.tsx';
import { toast } from '../../../ui/toast.tsx';
import { cx } from '../../../ui/util.tsx';
import { nav } from '../shell/nav.ts';
import { act, books, now, online } from '../shell/store.ts';
import { byRole, first, SupTile } from './parts.tsx';
import { FRESH_DAYS, ageDays, ageWord, boughtFrom } from './rules.ts';
import '../../../ui/sheet.css';
import './fix.css';

type Tab = 'price' | 'phone';
type Send = 'idle' | 'save' | 'still';

const STEP = 500;
const digits = (v: string): number | null => { const d = v.replace(/[^0-9]/g, ''); return d ? Math.min(99999999, Number(d)) : null; };

export function Fix(p: { params: Record<string, unknown> }): JSX.Element {
  const b = books.value, sid = String(p.params.id || ''), item = String(p.params.item || '');
  const s = b ? b.suppliers.find((x) => x.id === sid) : null;
  const x = b && s ? boughtFrom(b, sid, now.value).find((y) => y.price.item === item) || null : null;
  const [tab, setTab] = useState<Tab>(x ? 'price' : 'phone');
  const [val, setVal] = useState<number | null>(null);
  const [tel, setTel] = useState('');
  const [send, setSend] = useState<Send>('idle');
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState<{ price: number } | null>(null);
  if (!b || !s) return <main class="ow-b-suppliers-fix"><p class="ow-b-suppliers-gone">This supplier is not on the list</p></main>;

  const mosesM = byRole(b, 'sourcing'), moses = first(mosesM, 'Sourcing');
  const list = x ? x.price.price : 0, days = x ? ageDays(x.price.at, now.value) : 0, diff = val != null && x ? val - list : 0;
  const pct = list ? Math.round((Math.abs(diff) / list) * 100) : 0;

  const save = async (price: number, how: Send) => {
    if (!x) return;
    setSend(how); setFailed(null);
    try {
      const r = await act('confirmPrice', sid, x.price.productId, x.price.item, price);
      if (r.kept) toast.show('No signal · saved on this phone', { kind: 'warn', sub: `${moses} sees it when back` });
      else toast.show(`On the list · ${fig(price)}`, { sub: `${x.price.item} · ${moses} sees it` });
      nav.back();
    } catch {
      setFailed({ price }); setSend('idle');
    }
  };
  const sendPhone = async () => {
    setSend('save');
    try {
      const r = await act('suggestPhone', sid, tel.trim());
      if (r.kept) toast.show('No signal · saved on this phone', { kind: 'warn', sub: `${moses} sees it when back` });
      setSent(true);
    } catch (e) {
      toast.show('Not sent', { kind: 'error', sub: String((e as Error).message || e), retry: () => { void sendPhone(); } });
    } finally { setSend('idle'); }
  };
  const step = (d: number) => setVal(Math.max(0, (val ?? list) + d));
  const telOk = phoneOk(tel) && phoneText(tel) !== phoneText(s.phone), price = tab === 'price' && !!x;

  return (
    <main class="ow-b-suppliers-fix">
      <div class="ow-b-suppliers-fix-under" aria-hidden="true"><SupTile name={s.name} size={32} /><span>{s.name}</span></div>
      <section class="ow-b-suppliers-fix-sheet" role="dialog" aria-label={x ? `Fix ${x.price.item}` : `Fix ${s.name}`}>
        <span aria-hidden="true" class="ow-grab" />
        <div class="ow-b-suppliers-fix-h">
          {price && x ? <span class="ow-b-suppliers-fix-ic"><AisleIcon aisle={x.price.item} size={22} color="#1C2233" /></span> : <SupTile name={s.name} size={44} />}
          <span class="ow-b-suppliers-fix-ht">
            <h2>{price && x ? x.price.item : s.name}</h2>
            <span>{price && x ? `${s.name} · per ${x.price.unit}` : `${s.place} · supplier`}</span>
          </span>
          <button type="button" class="ow-x-tile" aria-label="Close" onClick={() => nav.back()}><Icon name="close" size={16} stroke={2.2} /></button>
        </div>

        <div role="tablist" aria-label="Fix" class="ow-b-suppliers-seg">
          <button type="button" role="tab" aria-selected={tab === 'price'} disabled={!x} class={cx(tab === 'price' && 'on')} onClick={() => setTab('price')}><Icon name="tag" size={17} stroke={2} />Price</button>
          <button type="button" role="tab" aria-selected={tab === 'phone'} class={cx(tab === 'phone' && 'on')} onClick={() => setTab('phone')}><Icon name="phone" size={17} stroke={2} />Phone</button>
        </div>

        {price && x && (
          <>
            <div class="ow-b-suppliers-onlist">
              <span><span class="ow-b-suppliers-cap">On the list</span><span class="mono">{fig(list)} <small>UGX</small></span></span>
              <span class={cx('ow-b-suppliers-old', days <= FRESH_DAYS && 'fresh')}><Icon name="clock" size={14} stroke={2} />
                {days ? <><span class="mono">{ageWord(days)}</span> old</> : 'Today'}</span>
            </div>
            <div class="ow-b-suppliers-say">
              <span class="ow-b-suppliers-cap">They say now</span>
              <div class="ow-b-suppliers-say-row">
                <button type="button" class="ow-b-suppliers-pm" aria-label={`${fig(STEP)} less`} onClick={() => step(-STEP)}><Icon name="minus" size={20} stroke={2.2} /></button>
                <label class={cx('ow-b-suppliers-amt', val == null && 'empty')}>
                  <input class="mono" inputMode="numeric" aria-label="Their price now" placeholder="—"
                    value={val == null ? '' : fig(val)} onInput={(e) => setVal(digits((e.target as HTMLInputElement).value))} />
                  <span class="mono">UGX</span>
                </label>
                <button type="button" class="ow-b-suppliers-pm" aria-label={`${fig(STEP)} more`} onClick={() => step(STEP)}><Icon name="plus" size={20} stroke={2.2} /></button>
              </div>
              {val != null && diff !== 0 && (
                <span class={cx('ow-b-suppliers-diff', diff < 0 && 'down')}>
                  <Icon name="trend" size={13} stroke={2.2} /><span class="mono">{(diff > 0 ? '+' : '−') + fig(Math.abs(diff))}</span>
                  {` · ${diff > 0 ? 'Up' : 'Down'} `}<span class="mono">{`${pct}%`}</span>
                </span>
              )}
            </div>
            <button type="button" class="ow-b-suppliers-still" aria-busy={send === 'still' || undefined} disabled={send !== 'idle'} onClick={() => { void save(list, 'still'); }}>
              {send === 'still' ? <span class="ow-b-suppliers-spin" aria-hidden="true" /> : <Icon name="check" size={18} stroke={2.2} />}
              <span>Still <span class="mono">{fig(list)}</span></span>
            </button>
          </>
        )}

        {tab === 'phone' && (
          <>
            <div class="ow-b-suppliers-onlist">
              <span><span class="ow-b-suppliers-cap">On the list</span><span class="mono tel">{phoneText(s.phone) || '—'}</span></span>
              {s.whatsapp && <span class="ow-b-suppliers-old fresh">WhatsApp</span>}
            </div>
            <label class="ow-b-suppliers-tel">
              <span class="ow-b-suppliers-cap">New number</span>
              <input class={cx('mono', 'ow-b-suppliers-tel-f')} type="tel" inputMode="tel" aria-label={`New number for ${s.name}`} readOnly={sent}
                value={tel} onInput={(e) => setTel((e.target as HTMLInputElement).value)} />
            </label>
            {sent && <div role="status" class="ow-b-suppliers-sent">{`Sent · ${moses} checks it, then the list changes`}</div>}
          </>
        )}

        <span class="ow-b-suppliers-fill" />
        {failed && x && (
          <div role="alert" class="ow-b-suppliers-err">
            <Icon name="warning" size={20} stroke={2} />
            <span><b>Not saved</b><span class="mono">{`${fig(failed.price)} · ${x.price.item}`}</span></span>
            <button type="button" onClick={() => { void save(failed.price, failed.price === list ? 'still' : 'save'); }}>Try again</button>
          </div>
        )}
        {failed && x && <span class="ow-b-suppliers-err-u">On the list: <b>still <span class="mono">{fig(list)}</span></b></span>}
        {!online.value && <span class="ow-b-suppliers-later"><Icon name="bell" size={14} stroke={2} />{`${moses} sees it when back`}</span>}
        {price ? (
          <div class="ow-b-suppliers-flow" role="img" aria-label={`Saved straight to the price list; ${moses} sees it, nothing waits`}>
            <Avatar initials={b.me.initials} tint="me" size={32} />
            <span class={cx('ow-b-suppliers-flow-l', send !== 'idle' && 'going')} />
            <span class="ow-b-suppliers-flow-ic"><Icon name="tag" size={18} stroke={2} /></span>
            {send === 'idle' && <span class="ow-b-suppliers-flow-t">On the list today · <b>{`${moses} sees it`}</b></span>}
          </div>
        ) : (
          <div class="ow-b-suppliers-flow" role="img" aria-label={`${moses} sees it as a suggestion`}>
            <Avatar initials={b.me.initials} tint="me" size={32} />
            <span class="ow-b-suppliers-flow-l dash" />
            {mosesM && <Avatar initials={mosesM.initials} tint={mosesM.tint} size={32} />}
            <span class="ow-b-suppliers-flow-t">{`${moses} sees it · `}<b>a suggestion</b></span>
          </div>
        )}
        {price
          ? <Button h={52} state={send === 'save' ? 'sending' : val == null || send !== 'idle' ? 'disabled' : 'idle'} onClick={() => { if (val != null) void save(val, 'save'); }}>
            {val == null ? 'Type their price' : 'Save · supplier told me'}
          </Button>
          : sent
            ? <Button h={52} onClick={() => nav.back()}>Done</Button>
            : <Button h={52} state={send === 'save' ? 'sending' : telOk ? 'idle' : 'disabled'} onClick={() => { void sendPhone(); }}>{`Send to ${moses}`}</Button>}
      </section>
    </main>
  );
}
