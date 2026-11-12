/*
 * Found damaged, not reported yet (FACTS §4: "Iron sheet G28 · 3 pc bent, found 10:20 when packing #0552").
 * A note kept on this phone until it is reported: the books hold nothing until the report goes (README "Gaps").
 * The Shelf's "Found damaged" row, the item's sand card and the scanner's strip read it; the report form starts
 * from it (how many, the reason, the order it was found on). Pack may add one with noteFound().
 *
 * It is done once a report of that item is sent after it was found (any phone, any status), so a report made on
 * another phone clears it too. Kept in localStorage per shop; the demo starts with FACTS' bent sheets.
 */
import { computed, signal } from '@preact/signals';
import type { Ms } from '../../../core/types.ts';
import type { YardBooks } from '../../../core/store/types.ts';
import { books, isDemo, session } from '../shell/store.ts';

export interface Found { key: string; qty: number; why: 'damaged' | 'lost' | 'stolen'; note: string; at: Ms; orderId: number | null }

const KEY = () => `ow-store-found:${session.value ? session.value.shopId : ''}`;

function seed(): Found[] {
  if (!isDemo || typeof location === 'undefined') return [];
  const q = new URLSearchParams(location.search);
  if (['empty', 'yard-empty', 'first-day'].includes(q.get('state') || '')) return [];
  // FACTS §4: 3 pc bent, found 10:20 while packing #0552 (Sat 17 Oct 2026, Kampala).
  return [{ key: 'p-is28', qty: 3, why: 'damaged', note: 'bent', at: Date.parse('2026-10-17T10:20:00+03:00'), orderId: 552 }];
}

function read(): Found[] {
  if (isDemo) return seed();
  try { return JSON.parse(localStorage.getItem(KEY()) || '[]') as Found[]; } catch (_e) { return []; }
}

const notes = signal<Found[] | null>(null);
const all = (): Found[] => notes.value ?? read();

function save(l: Found[]): void {
  notes.value = l;
  if (isDemo) return;
  try { localStorage.setItem(KEY(), JSON.stringify(l)); } catch (_e) { /* private mode: kept for this visit */ }
}

/** Reported (on any phone) since it was found. */
const reported = (b: YardBooks, f: Found): boolean => b.reports.some((r) => r.key === f.key && r.createdAt >= f.at);

/** The notes still to report, oldest first. */
export const foundOpen = computed<Found[]>(() => {
  const b = books.value;
  return b ? all().filter((f) => !reported(b, f)).sort((x, y) => x.at - y.at) : [];
});

export const foundFor = (key: string): Found | null => foundOpen.value.find((f) => f.key === key) || null;

/** Pack (or the scanner) noted damage on the shelf. */
export function noteFound(f: Found): void { save([...all().filter((x) => x.key !== f.key), f]); }

/** The report went (or was kept to send): the note is done. */
export function foundDone(key: string): void { save(all().filter((x) => x.key !== key)); }
