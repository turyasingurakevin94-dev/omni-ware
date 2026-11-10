/*
 * Reading a chat so Sales acts in one tap (the chat boards CH10, CH14, CH15, CH20, CH30):
 *   wantsToBuy   their words (or their photo's caption) read as items on the shelf ("Iron sheet G28 · 3m")
 *   saysPaid     "I sent 165,000 on Mobile this morning" read as an amount, a method and when
 *   readyAnswers the answers to what they just asked, from their open order ("Yes, to the Ntinda site")
 *   giveNote     the note a teammate needs when the chat is given (the order, where, what Kato still needs to hear)
 *   openOrder    the order the chat is about: the one last named in it, else their newest live one
 * Words follow GLOSSARY: Packing, On the road; money in full where someone acts on it.
 */
import { money, orderTotal } from '../../../core/money.ts';
import { firstWord, orderNo } from '../../../core/names.ts';
import { priceUntold } from '../../../core/orders.ts';
import { clock } from '../../../core/time.ts';
import type { Books, Customer, Item, Message, Method, Ms, Order } from '../../../core/types.ts';

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9"]+/g, ' ').trim().split(' ').filter(Boolean);
const stem = (w: string) => w.replace(/s$/, '');
/** What an item is, in one word: "Iron sheet G28 · 3m" → "sheet". */
const noun = (name: string) => (name.split(' · ')[0].split(' ').filter((w) => !/^G\d+$/i.test(w)).pop() || '').toLowerCase();

/** Items their words name: every word of the item's kind ("iron sheet") and its size ("3m") are in what they said. The fullest shelf first. */
export function wantsToBuy(b: Books, text: string): Item[] {
  const said = new Set(words(text).map(stem));
  const hits = b.items.filter((it) => {
    const [kind, size] = it.name.split(' · ');
    const k = words(kind).filter((w) => !/^g\d+$/.test(w)).map(stem);
    if (!k.length || !k.every((w) => said.has(w))) return false;
    return !size || words(size).some((w) => said.has(stem(w)));
  });
  return hits.filter((it) => it.price != null).sort((x, y) => (y.onShelf || 0) - (x.onShelf || 0)).slice(0, 1);
}

export interface SaysPaid { amount: number; method: Method | null; when: string; at: Ms }

/** "I sent 165,000 on Mobile this morning." → 165,000 · Mobile · this morning. */
export function saysPaid(m: Message | null): SaysPaid | null {
  if (!m || m.dir !== 'in' || !m.body) return null;
  const t = m.body.toLowerCase();
  if (!/\b(sent|paid|send|deposited|transferred)\b/.test(t)) return null;
  const n = t.match(/(\d{1,3}(?:,\d{3})+|\d{4,})/);
  if (!n) return null;
  const method: Method | null = /mobile|momo|mtn|airtel/.test(t) ? 'momo' : /bank/.test(t) ? 'bank' : /cash/.test(t) ? 'cash' : null;
  const when = (t.match(/this morning|this afternoon|today|yesterday|last night/) || [''])[0];
  return { amount: Number(n[1].replace(/,/g, '')), method, when, at: m.at };
}

export const METHOD_WORD: Record<Method, string> = { cash: 'Cash', momo: 'Mobile', bank: 'Bank' };

/** The order the chat is about: the one last named in it ("#0552"), else their newest live one. */
export function openOrder(b: Books, cust: Customer | null, msgs: Message[]): Order | null {
  if (!cust) return null;
  const live = b.orders.filter((o) => o.customerId === cust.id && !o.cancelled && !o.voided && o.stage !== 'delivered');
  for (let i = msgs.length - 1; i >= 0; i--) {
    const hit = msgs[i].body.match(/#0*(\d{3,})/);
    const o = hit && live.find((x) => x.id === Number(hit[1]));
    if (o) return o;
  }
  return live.sort((x, y) => y.placedAt - x.placedAt)[0] || null;
}

/** "Ntinda site" from "Ntinda site, Plot 12, Ntinda Rd". */
const placeOf = (o: Order | null) => (o && o.deliverTo ? o.deliverTo.split(',')[0].trim() : '');

/** When it comes, from where it is: packed by midday comes this afternoon. */
function comes(o: Order, now: Ms): string {
  const h = Number(clock(now).split(':')[0]);
  if (o.stage === 'road') return 'It is on the way';
  if (o.stage === 'packing') return h < 12 ? 'It comes this afternoon' : 'It comes tomorrow';
  return '';
}

export interface Answer { text: string; smart?: boolean }

/** Answers to what they just asked. */
export function readyAnswers(b: Books, cust: Customer | null, msgs: Message[], now: Ms): Answer[] {
  const last = msgs[msgs.length - 1];
  if (!last || last.dir !== 'in') return [];
  const t = last.body.toLowerCase(), out: Answer[] = [];
  const o = openOrder(b, cust, msgs), place = placeOf(o);
  if (o && place && t.includes(place.toLowerCase().split(' ')[0]) && /\b(come|deliver|bring|send)\b/.test(t)) out.push({ text: `Yes, to the ${place}`, smart: true });
  if (o && /\b(come|when|deliver|bring)\b/.test(t)) { const w = comes(o, now); if (w) out.push({ text: w }); }
  if (!out.length) {
    const it = wantsToBuy(b, last.body)[0];
    if (it && (it.onShelf || 0) > 0) out.push({ text: `How many ${noun(it.name)}s?` }, { text: 'Yes, we have it' });
  }
  return out;
}

/** What the teammate needs: the order and its stage, where and when it goes, and a price the customer has not heard yet. */
export function giveNote(b: Books, cust: Customer | null, msgs: Message[], now: Ms): string {
  const o = openOrder(b, cust, msgs);
  if (!o) return '';
  const parts = [`${orderNo(o.id)} ${o.stage === 'road' ? 'on the road' : o.stage}`];
  const place = placeOf(o), w = comes(o, now);
  if (place) parts.push(`${place}${w ? ' ' + w.replace(/^It (comes|is) /, '') : ''}`);
  const total = orderTotal(o), changed = o.lines.find(priceUntold);
  if (changed && o.toldTotal != null && o.toldTotal !== total) {
    parts.push(`tell ${cust ? firstWord(cust.name) : 'them'} the ${noun(changed.name)} price (${money(total)})`); // never guess him or her from a name (the lead's ruling)
  }
  return parts.join(' · ');
}
