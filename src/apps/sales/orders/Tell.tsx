/*
 * OR10, OR11 · Tell the customer about their order: the message as they will read it (built from
 * the order, the words editable in place), the order's picture, then WhatsApp or SMS. When their
 * chat is shut (24 hours past their last message), WhatsApp opens with it typed, and SMS leads.
 */
import type { JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { orderNo, phone9 } from '../../../core/names.ts';
import { replyWindow, weekday, clock } from '../../../core/time.ts';
import { Duo, Icon, phWhatsapp } from '../../../ui/icons.tsx';
import { LightSheet, sheet } from '../../../ui/sheet.tsx';
import { toast } from '../../../ui/toast.tsx';
import { act, books, chats, now } from '../shell/store.ts';
import { custOf, nameOf, orderOf, shortName } from './data.ts';
import { chatFor, tellText } from './msg.ts';
import { MonoText } from './OrderParts.tsx';
import { orderPicture } from './picture.ts';
import './sheets.css';

export function openTell(id: number): void {
  const b = books.value, o = b && orderOf(b, id);
  if (!b || !o) return;
  const c = chatFor(b, o, chats.value), shut = !c || !replyWindow(c.lastInAt, now.value).open;
  sheet.open(() => <TellSheet id={id} />, { label: `Tell ${shortName(b, o)}`, top: shut ? 330 : 260 });
}

function TellSheet(p: { id: number }): JSX.Element | null {
  const b = books.value, o = b && orderOf(b, p.id), t = now.value;
  const [text, setText] = useState(() => (b && o ? tellText(b, o) : ''));
  const [pic, setPic] = useState(true);
  const [busy, setBusy] = useState(false);
  const words = useRef<HTMLSpanElement>(null);
  if (!b || !o) return null;
  const who = shortName(b, o), c = chatFor(b, o, chats.value), w = c ? replyWindow(c.lastInAt, t) : null, shut = !w || !w.open;
  const phone = custOf(b, o)?.phone || o.client.phone, p9 = phone9(phone), body = encodeURIComponent(text);
  const sms = `sms:${p9 ? '+256' + p9 : ''}${text ? `?body=${body}` : ''}`;
  const send = async () => {
    if (!c) return;
    setBusy(true);
    try {
      const r = pic && !shut ? await act('sendImage', c.id, await orderPicture(b, o, now.value), text) : await act('send', c.id, text);
      sheet.close();
      toast.show(r.kept ? 'Kept on this phone' : `Sent to ${who}`, { kind: r.kept ? 'warn' : 'ok', sub: r.kept ? 'It goes when there is signal' : undefined });
    } catch (e) { toast.show((e as Error).message, { kind: 'error', retry: send }); } finally { setBusy(false); }
  };
  const edit = () => { const el = words.current; if (el) { el.focus(); const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s?.removeAllRanges(); s?.addRange(r); } };
  return (
    <LightSheet class="or-sheet" ground eyebrow={`Order ${orderNo(o.id)} · ${nameOf(b, o)}`} title={`Tell ${who}`} onClose={sheet.close} pad="12px 16px 22px">
      {shut && c && c.lastInAt && (
        <div role="status" class="or-shut">
          <span class="or-shut-a"><Icon name="lock" size={16} stroke={2.2} />Chat shut · <span class="mono">{`${w ? w.daysShut : 0} days`}</span></span>
          <span class="or-shut-b">{`last wrote ${weekday(c.lastInAt)} `}<span class="mono">{clock(c.lastInAt)}</span></span>
        </div>
      )}
      <div class="or-chat">
        <div class="or-bub">
          <span class="or-bub-who">{b.me.name.split(' ')[0]}</span>
          <span key={text} ref={words} contentEditable aria-label="The message" class="or-bub-t" onBlur={(e) => setText((e.target as HTMLElement).innerText.trim())}><MonoText text={text} /></span>
          <span class="mono or-bub-at">now</span>
        </div>
        <button type="button" aria-label="Change the message" class="or-edit" onClick={edit}><span><Icon name="pen" size={15} stroke={2.2} />Edit words</span></button>
      </div>
      {!shut && (
        <label class="or-pic">
          <span aria-hidden="true" class="or-pic-doc"><span /><span /><span /><span /><span /></span>
          <span class="or-pic-t"><span>Order picture</span><span>{`${orderNo(o.id)} as it stands`}</span></span>
          <input type="checkbox" checked={pic} aria-label="Send the order picture" onChange={(e) => setPic((e.target as HTMLInputElement).checked)} />
          <span aria-hidden="true" class={'or-tog' + (pic ? ' on' : '')}><span /></span>
        </label>
      )}
      {shut ? (
        <div class="or-two s">
          <a href={`https://wa.me/${p9 ? '256' + p9 : ''}?text=${body}`} target="_blank" rel="noopener" class="or-btn-w s"><Icon name="whatsapp" size={18} stroke={2} />WhatsApp</a>
          <a href={sms} class="or-btn-n"><Icon name="message" size={18} stroke={2} />Send as SMS</a>
        </div>
      ) : (
        <div class="or-two">
          <a href={sms} class="or-btn-w s"><Icon name="message" size={18} stroke={2} />Send as SMS</a>
          <button type="button" class="or-btn-g" onClick={send} disabled={busy}><Duo i={phWhatsapp} size={20} />{busy ? 'Sending…' : 'Send on WhatsApp'}</button>
        </div>
      )}
    </LightSheet>
  );
}
