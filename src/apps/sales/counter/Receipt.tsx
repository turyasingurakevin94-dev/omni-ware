/*
 * KC16 · Receipt, a full sheet over Sold: the paper as the walk-in gets it, their phone, Send on
 * WhatsApp (the phone is kept on the sale), Share, Save image.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { FullSheet } from '../../../ui/FullSheet.tsx';
import { Duo, Icon, phWhatsapp } from '../../../ui/icons.tsx';
import { fig } from '../../../ui/Money.tsx';
import { toast } from '../../../ui/toast.tsx';
import { lineTotal, orderTotal } from '../../../core/money.ts';
import { orderNo, phone9, phoneText } from '../../../core/names.ts';
import { clock, dayOf } from '../../../core/time.ts';
import { nav } from '../shell/nav.ts';
import { act, books } from '../shell/store.ts';
import type { ScreenProps } from '../shell/types.ts';
import { saleOf } from './Sold.tsx';
import './receipt.css';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const longDay = (ms: number) => { const [y, m, d] = dayOf(ms).split('-').map(Number); return `${d} ${MON[m - 1]} ${y}`; };
const METHOD = { cash: 'cash', momo: 'mobile', bank: 'bank' } as const;

export function Receipt(p: ScreenProps): JSX.Element {
  const id = Number(p.params.id), s = saleOf(id), b = books.value;
  const [phone, setPhone] = useState(s && s.o.client.phone ? phoneText(s.o.client.phone) : '');
  if (!s || !b) return <main aria-busy="true" />;
  const o = s.o, total = orderTotal(o), at = o.invoicedAt || o.placedAt, change = s.method === 'cash' ? Math.max(0, s.given - total) : 0;
  const seller = b.members.find((m) => m.id === o.placedBy), name = o.client.name || 'Walk-in';
  const text = [
    `${b.shop.name} · Counter sale ${orderNo(id)}`, `${longDay(at)} · ${clock(at)} · For: ${name}`,
    ...o.lines.map((l) => `${l.qty} ${l.unit} ${l.name} × ${fig(l.price || 0)} = ${fig(lineTotal(l))}`),
    `Total UGX ${fig(total)}`, ...(change ? [`Cash given ${fig(s.given)} · Change ${fig(change)}`] : []),
    `Paid · ${METHOD[s.method]}${s.ref ? ` · ID ${s.ref}` : ''}`, seller ? `Sold by ${seller.name}` : '',
  ].filter(Boolean).join('\n');
  const send = async () => {
    const n = phone9(phone);
    if (n.length !== 9) { toast.show('Type their phone', { kind: 'warn' }); return; }
    try { await act('setClientPhone', id, phoneText(phone)); } catch (_e) { /* the receipt still goes */ }
    window.open(`https://wa.me/256${n}?text=${encodeURIComponent(text)}`, '_blank');
    nav.back();
  };
  const share = async () => {
    const nav2 = navigator as Navigator & { share?: (d: { title: string; text: string }) => Promise<void> };
    if (nav2.share) { try { await nav2.share({ title: `Receipt ${orderNo(id)}`, text }); } catch (_e) { /* they closed it */ } return; }
    try { await navigator.clipboard.writeText(text); toast.show('Copied'); } catch (_e) { toast.show('Copied', { kind: 'warn' }); }
  };
  const contacts = async () => {
    const c = (navigator as Navigator & { contacts?: { select: (p: string[]) => Promise<{ tel?: string[] }[]> } }).contacts;
    if (!c) { (document.querySelector('.kc-phone input') as HTMLInputElement | null)?.focus(); return; }
    try { const r = await c.select(['tel']); if (r[0] && r[0].tel && r[0].tel[0]) setPhone(phoneText(r[0].tel[0])); } catch (_e) { /* none picked */ }
  };
  return (
    <FullSheet shadow onBack={() => nav.back()} backLabel="Back to Sold" ground="#FFFFFF" pad="16px" gap={12}
      head={(
        <div class="kc-rhead">
          <span aria-hidden="true" class="kc-rgrab" />
          <div class="ow-lsheet-h">
            <div class="ow-lsheet-ht"><span class="ow-lsheet-eye">{`Counter sale · ${orderNo(id)}`}</span><h2>Receipt</h2></div>
            <button type="button" class="ow-x-tile" aria-label="Close" onClick={() => nav.back()}><Icon name="close" size={16} stroke={2.2} /></button>
          </div>
        </div>
      )}>
      <div class="kc-paperbox">
        <div class="kc-paper" id="kc-paper">
          <div class="kc-paper-h">
            <span><b>{b.shop.name}</b><span>{'Counter sale · '}<span class="mono">{orderNo(id)}</span></span></span>
            <span class="r"><span>{`${longDay(at)} · `}<span class="mono">{clock(at)}</span></span><b>{`For: ${name}`}</b></span>
          </div>
          <div>
            <div class="kc-tbl kc-tbl-h"><span>QTY</span><span>ITEM</span><span>RATE</span><span>AMOUNT</span></div>
            {o.lines.map((l) => (
              <div key={l.lineId} class="kc-tbl">
                <span class="mono b">{`${fig(l.qty)} `}<span class="ow-word">{l.unit}</span></span>
                <span class="n">{l.name}</span>
                <span class="mono soft">{fig(l.price || 0)}</span>
                <span class="mono b">{fig(lineTotal(l))}</span>
              </div>
            ))}
          </div>
          <div class="kc-paper-t"><span>Total</span><span class="mono">{`UGX ${fig(total)}`}</span></div>
          {s.method === 'cash' && s.given > 0 && (
            <div class="kc-paper-g">
              <span>Cash given</span><span class="r"><span class="mono">{fig(s.given)}</span></span>
              <span>Change</span><span class="r"><span class="mono">{fig(change)}</span></span>
            </div>
          )}
          {s.method !== 'cash' && !!s.ref && <div class="kc-paper-g"><span>Transaction ID</span><span class="r"><span class="mono">{s.ref}</span></span></div>}
          <div class="kc-paper-f">
            <span class="kc-paid-l"><Icon name="check" size={11} stroke={3.2} />{`Paid · ${METHOD[s.method]}`}</span>
            {seller && <span>{`Sold by ${seller.name}`}</span>}
          </div>
        </div>
      </div>
      <div class="kc-phone-r">
        <label class="kc-phone">
          <span>Their phone</span>
          <input type="tel" inputmode="tel" aria-label="Their phone number" value={phone} onInput={(e) => setPhone((e.target as HTMLInputElement).value)} />
        </label>
        <button type="button" class="kc-contacts" onClick={() => void contacts()}><Icon name="person" size={18} stroke={1.9} />Contacts</button>
      </div>
      <button type="button" class="kc-wa" onClick={() => void send()}><Duo i={phWhatsapp} size={20} color="#FFFFFF" />Send on WhatsApp</button>
      <div class="kc-two">
        <button type="button" onClick={() => void share()}><Icon name="share" size={18} stroke={1.9} />Share</button>
        <button type="button" onClick={() => saveImage(text, id)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>Save image</button>
      </div>
    </FullSheet>
  );
}

/** The receipt as a picture to keep: its words on white, saved as a PNG. */
function saveImage(text: string, id: number): void {
  const lines = text.split('\n'), c = document.createElement('canvas'), w = 720, h = 80 + lines.length * 40;
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  if (!x) return;
  x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, w, h);
  x.fillStyle = '#1C2233'; x.font = '600 26px "IBM Plex Mono", monospace';
  lines.forEach((l, i) => x.fillText(l, 32, 56 + i * 40, w - 64));
  const a = document.createElement('a');
  a.href = c.toDataURL('image/png'); a.download = `receipt-${String(id).padStart(4, '0')}.png`; a.click();
}
