/*
 * Finding what was typed or said: a customer by name, phone or place (or
 * the one a letter or two off: SL02), and items from words like
 * "40 sheets" (SL08), "20 kg wire nails 4"" (SL15) or "forty sheets of G28
 * and two cartons of four inch nails" (SL10). Nothing here decides a price.
 */
import { phone9 } from '../../../core/names.ts';
import type { Books, Customer, Item, SourcingAsk } from '../../../core/types.ts';

const norm = (s: string) => s.toLowerCase().replace(/[“”"]/g, '"').replace(/\s+/g, ' ').trim();

function lev(a: string, b: string): number {
  const m = a.length, n = b.length, d = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= n; j++) {
      const t = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = t;
    }
  }
  return d[n];
}

/** Where a typo sits in the real word: the letter that differs, or the one before a missing letter. */
function typoAt(typed: string, real: string): number {
  let p = 0;
  while (p < typed.length && p < real.length && typed[p] === real[p]) p++;
  return real.length > typed.length ? Math.max(0, p - 1) : p;
}

/** A customer by what was typed: a match, or the nearest name 1–2 letters off. */
export function findCustomer(b: Books, q: string): { c: Customer; off: number; mark: number } | null {
  const t = norm(q), digits = phone9(q) || q.replace(/\D/g, '');
  const pool = b.customers.filter((c) => !c.qa);
  const hit = pool.find((c) => norm(c.name).includes(t) || (digits.length >= 4 && c.phone.replace(/\D/g, '').includes(digits)) || (!!c.place && norm(c.place) === t));
  if (hit) return { c: hit, off: 0, mark: -1 };
  let best: { c: Customer; off: number } | null = null;
  pool.forEach((c) => { const d = lev(t, norm(c.name)); if (d <= 2 && (!best || d < best.off)) best = { c, off: d }; });
  if (!best) return null;
  const got = best as { c: Customer; off: number };
  return { ...got, mark: typoAt(t, norm(got.c.name)) };
}

/* ---------------- items ---------------- */

const NUM: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100,
};
/** Unit words people say, as the shop's units. */
const UNIT: Record<string, string> = {
  pcs: 'pc', pc: 'pc', pieces: 'pc', piece: 'pc', bags: 'bag', bag: 'bag', cartons: 'ctn', carton: 'ctn', ctn: 'ctn', ctns: 'ctn',
  kg: 'kg', kgs: 'kg', kilos: 'kg', tins: 'tin', tin: 'tin', pairs: 'pair', pair: 'pair', boxes: 'box', box: 'box', sets: 'set',
};

/** "forty" → 40, "4" → 4; "four inch" → 4". */
function words(s: string): string[] {
  const ws = norm(s).split(/[\s,?!]+/).filter(Boolean).map((w) => (NUM[w] != null ? String(NUM[w]) : w));
  // "4 inch", "four inch", "4in" → 4"
  return ws.reduce<string[]>((out, w) => {
    const m = w.match(/^(\d+(?:\.\d+)?)(?:in|inch)$/);
    if (m) out.push(m[1] + '"');
    else if ((w === 'inch' || w === 'in') && out.length && /^\d+(\.\d+)?$/.test(out[out.length - 1])) out[out.length - 1] += '"';
    else out.push(w);
    return out;
  }, []);
}
const stem = (w: string) => w.replace(/(es|s)$/, '').replace(/"$/, '"');
const nameWords = (it: Item) => words(it.name.replace(/·/g, ' ')).map(stem);

export interface Asked { qty: number | null; unit: string | null; words: string[]; text: string }

/** "40 sheets" → ×40 · sheets; "20 kg wire nails 4"" → ×20 kg · wire nails 4". */
export function readAsk(text: string): Asked {
  const w = words(text.replace(/\bof\b/gi, ' ').replace(/(\d+)\s*inch\b/gi, '$1"'));
  let qty: number | null = null, unit: string | null = null;
  const rest: string[] = [];
  w.forEach((x) => {
    if (qty == null && /^\d+$/.test(x) && !/"$/.test(x)) { qty = Number(x); return; }
    if (qty != null && !unit && UNIT[x]) { unit = UNIT[x]; return; }
    if (x === 'and' || x === 'the' || x === 'a') return;
    rest.push(x);
  });
  return { qty, unit, words: rest, text };
}

/** How well an item's name answers the words: every word must be in it. */
function fits(it: Item, ws: string[]): boolean {
  const n = nameWords(it), full = norm(it.name);
  return ws.length > 0 && ws.every((w) => n.includes(stem(w)) || (w.length > 2 && full.includes(stem(w))));
}

/** What fills the asked count best: on the shelf, then ordered in, then a part, then out. */
function fill(it: Item, qty: number): number {
  if (it.onShelf != null && it.onShelf >= qty) return 0;
  if (it.orderIn) return 1;
  if (it.onShelf) return 2;
  return 3;
}

/** The items that answer an ask: theirs first (rank 2), what they had this week (1), then what fills the count best. */
export function findItems(b: Books, a: Asked, rank: (key: string) => number = () => 0): Item[] {
  if (!a.words.length) return [];
  const hits = b.items.filter((it) => fits(it, a.words) && (!a.unit || it.unit === a.unit || it.packUnit === a.unit || nameWords(it).includes(a.unit)));
  const key = (it: Item) => `${it.id}::${it.variantIdx ?? ''}`, q = a.qty || 1;
  return hits.sort((x, y) => rank(key(y)) - rank(key(x)) || fill(x, q) - fill(y, q));
}

/** Nothing called that: the items that share a word with it (SL09 "closest in the shop"). */
export function closest(b: Books, a: Asked, n = 2): Item[] {
  const ws = a.words.filter((w) => w.length > 2);
  return b.items.filter((it) => ws.some((w) => nameWords(it).includes(stem(w)))).slice(0, n);
}

/** An ask already made of Sourcing that is this one, a letter or two off ("tile cuter" → "Tile cutter 600mm"). */
export function sameAsk(asks: SourcingAsk[], a: Asked): SourcingAsk | null {
  const t = a.words.join(' ');
  return asks.find((x) => x.status !== 'dropped' && lev(t, norm(x.name).split(' ').slice(0, a.words.length).join(' ')) <= 2) || null;
}

/** Said aloud: "forty sheets of G28 and two cartons of four inch nails" → two asks. */
export function readSaid(text: string): Asked[] {
  return text.split(/\band\b|,/i).map((s) => readAsk(s)).filter((a) => a.words.length > 0);
}
