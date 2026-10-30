/*
 * SL04 · an order built from what they asked on WhatsApp: their words over
 * the lines, with what the app read in them marked ("G28 iron sheets",
 * "60 pcs"), and how long they have waited for a reply.
 */
import type { JSX } from 'preact';
import { howLong } from '../../../core/time.ts';
import type { Books, Customer, Message } from '../../../core/types.ts';
import { Duo, phWhatsapp } from '../../../ui/icons.tsx';
import { chats, now } from '../shell/store.ts';
import { findItems, readAsk } from './find.ts';
import { first, theirItems } from './insights.ts';
import { add, cur } from './model.ts';

/** Their newest words on the chat, while they wait for a reply. */
function asked(chatId: number): Message | null {
  const cb = chats.value;
  if (!cb) return null;
  const all = cb.recent.filter((m) => m.chatId === chatId).sort((a, b) => b.at - a.at), last = all[0];
  return last && last.dir === 'in' && last.kind === 'text' ? last : null;
}

/** Fill the order from their message (CH22 → "New order" from the chat). */
export function fromChat(b: Books, chatId: number): void {
  const m = asked(chatId), x = cur.value;
  if (!m || !x) return;
  const c = x.customerId ? b.customers.find((y) => y.id === x.customerId) || null : null;
  m.body.split(/\band\b|;/i).forEach((part) => {
    const a = readAsk(part), it = findItems(b, a, c ? theirItems(b, c) : new Set())[0];
    if (it && it.price != null) add(it, a.qty || 1);
  });
}

/** Their words with what was read in them marked. */
function Marked(p: { text: string; words: string[]; count: string[] }): JSX.Element {
  const keep = new Set([...p.words, ...p.count].map((w) => w.toLowerCase()));
  const parts = p.text.split(/(\s+|,|\?|!|\.)/).filter((t) => t !== '');
  const out: (string | JSX.Element)[] = [];
  let run: string[] = [];
  const flush = (k: number) => { if (run.length) { out.push(<mark key={k}>{run.join('').trim()}</mark>); if (/\s$/.test(run.join(''))) out.push(' '); } run = []; };
  parts.forEach((t, i) => {
    const w = t.toLowerCase().replace(/(es|s)$/, '');
    if (keep.has(t.toLowerCase()) || keep.has(w)) run.push(t);
    else if (/^\s+$/.test(t) && run.length) run.push(t);
    else { flush(i); out.push(t); }
  });
  flush(parts.length);
  return <>{out}</>;
}

export function ChatAsk(p: { b: Books; c: Customer | null }): JSX.Element | null {
  const x = cur.value, m = x && x.chatId != null ? asked(x.chatId) : null;
  if (!m || !p.c) return null;
  const a = readAsk(m.body), it = findItems(p.b, a, theirItems(p.b, p.c))[0];
  const words = it ? m.body.split(/[\s,?!.]+/).filter((w) => w && it.name.toLowerCase().includes(w.toLowerCase().replace(/(es|s)$/, ''))) : [];
  const count = m.body.match(/\d+\s*[a-z]*/i);
  return (
    <div class="sl-asked">
      <span aria-hidden="true" class="sl-asked-ic"><Duo i={phWhatsapp} size={18} color="#0F6B43" /></span>
      <span class="sl-asked-t"><span>{`${first(p.c.name)} asked`}</span><span><Marked text={m.body} words={words} count={count ? count[0].split(/\s+/) : []} /></span></span>
      <span class="mono sl-asked-w">{howLong(m.at, now.value)}</span>
    </div>
  );
}
