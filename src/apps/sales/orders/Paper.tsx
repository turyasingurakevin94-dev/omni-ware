/*
 * orders/receipt { id } · the order's paper (OR34–OR37), what the Receipt tile opens: KC16's slip over the order,
 * the line that says whether its prices are final (the order screen's own pendingOf), and where it goes:
 *   their chat, open      Send on WhatsApp (the order picture with these words), which tells a new price (Q17)
 *   their chat, shut      Share the picture, or Save image (OR36)
 *   no chat               the phone field (theirs filled in), then WhatsApp opens typed; Send waits for a number (OR37)
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { lineTotal, orderOwes, orderTotal } from '../../../core/money.ts';
import { firstWord, orderNo, phone9, phoneText } from '../../../core/names.ts';
import { twinOf } from '../../../core/orders.ts';
import { clock, dayLabel, dayOf, replyWindow } from '../../../core/time.ts';
import type { Books, Order } from '../../../core/types.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { PRICE_COMING, isPriced } from '../../../ui/Money.tsx';
import { FullSheet } from '../../../ui/FullSheet.tsx';
import { Duo, Icon, phWhatsapp } from '../../../ui/icons.tsx';
import { toast } from '../../../ui/toast.tsx';
import { nav } from '../shell/nav.ts';
import { act, books, chats, now } from '../shell/store.ts';
import type { ScreenProps } from '../shell/types.ts';
import { byRole, custOf, faceOf, faceOfMember, member, nameOf, orderOf, shortName } from './data.ts';
import { Slip, SlipHead, type SlipProps } from '../../../ui/Slip.tsx';
import { chatFor, tellsPrice } from './msg.ts';
import { orderPicture } from './picture.ts';
import { freshPrice, pendingOf } from './view.ts';
import './paper.css';

const f = (n: number) => Math.round(n).toLocaleString('en-US');
const HOW = { cash: 'cash', momo: 'mobile', bank: 'bank' } as const;
/** "17 Oct 2026", as KC16 dates its paper. */
const longDay = (ms: number) => `${dayLabel(ms).split(' ').slice(1).join(' ')} ${dayOf(ms).slice(0, 4)}`;

/** The paper's words and figures, from the order alone (the slip draws them; Send writes them). */
export interface Under { tone: string; key: string; rest: string; at?: string; after?: string }
export function paperOf(b: Books, o: Order): SlipProps & { under: Under | null } {
  const at = o.invoicedAt || o.placedAt, total = orderTotal(o), owes = o.voided ? 0 : orderOwes(o);
  // A line with no price yet is never 0 (ui/Money.tsx), and the paper is not final while one waits (OR35's words).
  const unpriced = o.voided ? 0 : o.lines.filter((l) => l.qty > 0 && l.state !== 'dropped' && !isPriced(l.price)).length;
  const stands = !o.voided && (pendingOf(o) || unpriced > 0);
  const methods = [...new Set(o.payments.map((x) => HOW[x.method]))];
  const pill = o.voided ? { text: 'Void · nothing owed', tone: 'bad' as const }
    : total > 0 && o.paid >= total ? { text: `Paid · ${methods.join(' + ') || 'cash'}`, tone: 'good' as const, tick: true }
    : { text: 'Not paid yet', tone: 'warn' as const };
  const rn = firstWord(byRole(b, 'manager')?.name || 'Manager');
  let under: Under | null = null;
  if (o.voided) {
    const tw = twinOf(b.orders, o, true), by = firstWord(member(b, o.voidedBy)?.name || rn), t = o.voidedAt;
    under = { tone: 'bad', key: `${by} voided it`, rest: t ? ` ${dayOf(t) === dayOf(now.value) ? 'today' : dayLabel(t)} ` : '', at: t ? clock(t) : undefined, after: tw && tw.orig.id !== o.id ? ` · the copy of ${orderNo(tw.orig.id)}` : '' };
  } else if (stands) {
    const fr = freshPrice(o), n = unpriced;
    under = { tone: 'info', key: 'As it stands', rest: !n && fr && fr.priceReview ? ` · ${rn} set ${f(fr.priceReview.price)} · not told yet` : ` · ${rn} decides ${n || 1} price${n > 1 ? 's' : ''}` };
  } else {
    const l = o.lines.filter((x) => x.priceReview && x.state !== 'dropped').sort((x, y) => (y.priceReview?.at || 0) - (x.priceReview?.at || 0))[0], r = l && l.priceReview;
    if (l && r) under = { tone: 'ink', key: 'Prices final', rest: ` · ${firstWord(member(b, r.by)?.name || rn)} ${r.price === l.shopPrice ? 'kept' : 'set'} ${f(r.price)} at `, at: clock(r.at) };
  }
  return {
    shop: b.shop.name, word: o.invoiced ? 'Bill' : 'Order', no: orderNo(o.id), stands,
    day: longDay(at), at: clock(at), forName: nameOf(b, o),
    lines: o.lines.filter((l) => l.qty > 0).map((l) => ({ key: l.lineId, qty: f(l.qty), unit: l.unit, name: l.name, rate: isPriced(l.price) ? f(l.price) : '…', amount: isPriced(l.price) ? f(lineTotal(l)) : PRICE_COMING, gone: l.state === 'dropped' })),
    total: f(total), struck: o.voided,
    rows: [['Paid so far', f(o.voided ? 0 : o.paid)], ['Owes on it', f(owes), owes > 0]],
    pill, foot: member(b, o.placedBy) ? `Taken by ${member(b, o.placedBy)?.name}` : undefined, under,
  };
}

/** What goes with the picture: the paper in words. */
function paperText(p: ReturnType<typeof paperOf>): string {
  return [`${p.shop} · ${p.word} ${p.no}${p.stands ? ' · as it stands' : ''}`, `${p.day} · ${p.at} · For: ${p.forName}`,
    ...p.lines.map((l) => (l.gone ? `${l.qty} ${l.unit} ${l.name} · not found` : `${l.qty} ${l.unit} ${l.name} × ${l.rate} = ${l.amount}`)),
    `Total UGX ${p.total}${p.struck ? ' · void' : ''}`, ...p.rows.map(([k, v]) => `${k} ${v}`), p.pill.text].join('\n');
}

export function PaperScreen(p: ScreenProps): JSX.Element {
  const b = books.value, o = b && orderOf(b, Number(p.params.id));
  if (!b || !o) return <FullSheet onBack={nav.back} backLabel="Back to the order" head={<div class="ow-shead" />}><p class="or-gone">{b ? 'This order is no longer in the books' : ''}</p></FullSheet>;
  return <PaperBody b={b} o={o} />;
}

function PaperBody(p: { b: Books; o: Order }): JSX.Element {
  const { b, o } = p, paper = paperOf(b, o), text = paperText(paper), who = shortName(b, o);
  const c = custOf(b, o), chat = chatFor(b, o, chats.value), win = chat ? replyWindow(chat.lastInAt, now.value) : null;
  const known = phoneText(c?.phone || o.client.phone || (chat ? chat.phone : ''));
  const [phone, setPhone] = useState(known);
  const [busy, setBusy] = useState(false);
  const picture = () => orderPicture(b, o, now.value);
  const send = async () => {
    if (!chat) return;
    const price = !!tellsPrice(b, o);
    setBusy(true);
    try {
      const r = await act('sendImage', chat.id, await picture(), text);
      // The paper told them the new price (sent, or kept to go with signal), as an order's Tell does (Q17).
      if (price) await act('markPriceTold', o.id);
      nav.back();
      toast.show(r.kept ? 'Kept on this phone' : `Sent to ${who}`, { kind: r.kept ? 'warn' : 'ok', sub: r.kept ? 'It goes when there is signal' : undefined });
    } catch (e) { toast.show((e as Error).message, { kind: 'error', retry: () => { void send(); } }); } finally { setBusy(false); }
  };
  const typed = async () => {
    const n = phone9(phone);
    if (n.length !== 9) return;
    if (n !== phone9(known)) { try { await act('setClientPhone', o.id, phoneText(phone)); } catch (_e) { /* the paper still goes */ } }
    window.open(`https://wa.me/256${n}?text=${encodeURIComponent(text)}`, '_blank');
  };
  const share = async () => {
    const blob = await picture(), file = new File([blob], `${paper.word}-${paper.no.slice(1)}.png`, { type: 'image/png' });
    const nv = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean; share?: (d: { files?: File[]; text: string; title: string }) => Promise<void> };
    if (nv.share) { try { await nv.share({ ...(nv.canShare && nv.canShare({ files: [file] }) ? { files: [file] } : {}), title: `${paper.word} ${paper.no}`, text }); } catch (_e) { /* they closed it */ } return; }
    save(blob);
  };
  const save = (blob: Blob) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${paper.word}-${paper.no.slice(1)}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
  const contacts = async () => {
    const cs = (navigator as Navigator & { contacts?: { select: (p: string[]) => Promise<{ tel?: string[] }[]> } }).contacts;
    if (!cs) { (document.querySelector('.or-pp-phone input') as HTMLInputElement | null)?.focus(); return; }
    try { const r = await cs.select(['tel']); if (r[0] && r[0].tel && r[0].tel[0]) setPhone(phoneText(r[0].tel[0])); } catch (_e) { /* none picked */ }
  };
  const face = faceOf(b, o), ruth = byRole(b, 'manager');
  return (
    <FullSheet onBack={nav.back} backLabel="Back to the order" ground="#FFFFFF" pad="16px" gap={12} shadow
      head={(
        <SlipHead eyebrow={`${paper.word} ${paper.no} · ${nameOf(b, o)}`} title="Receipt" onClose={nav.back} />
      )}>
      <div class="or-pp-box">
        <Slip {...paper} />
        {paper.under && (
          <div class="or-pp-under">{ruth && <Avatar {...faceOfMember(ruth)} size={24} font={11} />}
            <span><b class={paper.under.tone}>{paper.under.key}</b>{paper.under.rest}{paper.under.at && <span class="mono">{paper.under.at}</span>}{paper.under.after}</span></div>
        )}
      </div>
      {chat ? (
        <div role="group" aria-label={`It goes to ${nameOf(b, o)}${known ? `, ${known}` : ''}: ${win && win.open ? 'on WhatsApp' : `the chat is shut ${win ? win.daysShut : 0} days, so share the picture`}`} class="or-pp-to">
          <Avatar {...face} size={32} font={12} />
          <span class="or-pp-to-t"><span>{nameOf(b, o)}</span>
            <span class="mono">{known}{win && !win.open && <>{' · '}<span class="or-pp-shut"><Icon name="lock" size={13} stroke={2.4} />{'chat shut · '}<span class="mono">{`${win.daysShut} days`}</span></span></>}</span></span>
          {win && win.open && <span class="or-pp-chat">their chat</span>}
        </div>
      ) : (
        <div class="or-pp-phone-r">
          <label class="or-pp-phone"><span>Their phone</span>
            <input type="tel" inputmode="tel" placeholder="07…" aria-label="Their phone number" value={phone} autoFocus={!phone} onInput={(e) => setPhone((e.target as HTMLInputElement).value)} /></label>
          <button type="button" class="or-pp-contacts" onClick={() => void contacts()}><Icon name="person" size={18} stroke={1.9} />Contacts</button>
        </div>
      )}
      {chat && win && !win.open ? (
        <div class="or-pp-two">
          <button type="button" class="or-pp-share" onClick={() => void share()}><Icon name="share" size={18} stroke={1.9} />Share</button>
          <button type="button" class="or-pp-save" onClick={() => { void picture().then(save); }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>Save image</button>
        </div>
      ) : (
        <button type="button" class="or-pp-wa" disabled={busy || (!chat && phone9(phone).length !== 9)} onClick={() => void (chat ? send() : typed())}>
          <Duo i={phWhatsapp} size={20} color="#FFFFFF" />{busy ? 'Sending…' : 'Send on WhatsApp'}</button>
      )}
    </FullSheet>
  );
}
