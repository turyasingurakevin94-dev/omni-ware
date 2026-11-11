/*
 * Find on the Shelf (docs/spec/04-screens-store.md §4.5; store.html:5647–5700; NAV-03, NAV-05–07, STO-SPD-02).
 *
 *   findShelf(b, q, rank)   items whose name has every word typed, the best match first; orders by number,
 *                           customer or a line's item; "Did you mean" chips that narrow it ("wire nails")
 *   nearWord(b, q)          nothing found: the word on our shelf one or two letters off ("emalshon" → emulsion)
 *   closestTo(b, word, ...) the items nearest that word: those named by it, then the rest of its aisle worth a look
 *
 * A size like 1 1/4" is one word. Chips only with a query; a chip's count is its rows. 30 rows at a time.
 */
import type { ShelfItem, YardBooks, YardOrder } from './types.ts';

export const PAGE = 30;

const norm = (s: string): string => s.toLowerCase().replace(/[“”″]/g, '"').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
/** The words typed; "1 1/4"" stays one word. */
export const wordsOf = (q: string): string[] => norm(q).replace(/(\d) (\d\/\d)/g, '$1_$2').split(' ').filter(Boolean).map((w) => w.replace('_', ' '));

function lev(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; }
  }
  return d[b.length];
}

export interface Found {
  items: ShelfItem[];
  orders: YardOrder[];
  /** Narrower searches from what matched ("wire nails", "roofing nails"). */
  narrower: string[];
}

/** Every word typed is in the name. */
const hasAll = (name: string, words: string[]): boolean => { const n = norm(name); return words.every((w) => n.includes(w)); };

/**
 * `rank` orders items that match equally well (the screen's: something to say first — with Ruth, count due, on the
 * shelf, order in); the best match is the one whose name has the word earliest.
 */
export function findShelf(b: YardBooks, q: string, rank: (it: ShelfItem) => number = () => 0): Found {
  const words = wordsOf(q);
  if (!words.length) return { items: [], orders: [], narrower: [] };
  const at = (it: ShelfItem) => norm(it.name).indexOf(words[0]);
  const items = b.items.filter((it) => hasAll(it.name, words)).map((it, i) => ({ it, i, a: at(it), r: rank(it) }))
    .sort((x, y) => x.a - y.a || x.r - y.r || x.i - y.i).map((x) => x.it);
  const digits = q.replace(/[^0-9]/g, '');
  const keys = new Set(items.map((x) => x.key));
  const orders = b.orders.filter((o) => (digits.length >= 2 && /^#?\s*\d+$/.test(q.trim()) && String(o.id).includes(digits.replace(/^0+/, '')))
    || hasAll(o.client.name, words) || o.lines.some((l) => !l.dropped && keys.has(l.key)))
    .sort((x, y) => x.id - y.id);
  // "nails" → "wire nails", "roofing nails", "concrete nails": the word before what was typed, once each.
  const narrower: string[] = [];
  if (words.length === 1) items.forEach((it) => {
    const ws = norm(it.name).split(' '), i = ws.findIndex((w) => w.startsWith(words[0]));
    const p = i > 0 ? `${ws[i - 1]} ${ws[i]}` : '';
    if (p && /^[a-z]/.test(p) && !narrower.includes(p)) narrower.push(p);
  });
  return { items, orders, narrower: narrower.length > 1 ? narrower : [] };
}

/** The word on our shelf nearest what was typed (1–3 letters off, never the same word), or null. */
export function nearWord(b: Pick<YardBooks, 'items'>, q: string): string | null {
  const w = norm(q);
  if (w.length < 3) return null;
  let best: { word: string; d: number } | null = null;
  const seen = new Set<string>();
  b.items.forEach((it) => norm(it.name).split(/[^a-z]+/).forEach((x) => {
    if (x.length < 4 || seen.has(x)) return;
    seen.add(x);
    const d = lev(w, x);
    if (d > 0 && d <= Math.max(2, Math.floor(x.length / 3)) && (!best || d < best.d)) best = { word: x, d };
  }));
  return best ? (best as { word: string }).word : null;
}

/** The items nearest a word: those named by it, then the rest of their aisle that has something to say. */
export function closestTo(b: YardBooks, word: string, worth: (it: ShelfItem) => number, n = 3): ShelfItem[] {
  const named = b.items.filter((it) => hasAll(it.name, [norm(word)]));
  const aisle = named[0] ? named[0].category : null;
  const near = aisle ? b.items.filter((it) => it.category === aisle && !named.includes(it)).map((it, i) => ({ it, i, w: worth(it) }))
    .sort((x, y) => x.w - y.w || x.i - y.i).map((x) => x.it) : [];
  return [...named, ...near].slice(0, n);
}
