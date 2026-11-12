/*
 * Names, initials, tints and phone numbers, said one way (BRIEF.md "Copy":
 * the person's display name, order numbers as #0550, phones as 0772 418 220).
 */
import type { Stage, Tint } from './types.ts';

/** "Kato Construction" → "KC"; "Kyaligonza & Sons" → "KS"; "Ssali" → "SS" (sales.html initials). */
export function initials(name: string): string {
  const w = String(name || '?').replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!w.length) return '?';
  return (w[0][0] + (w[1] ? w[1][0] : w[0][1] || '')).toUpperCase();
}

/** "Ruth Nakato" → "Ruth". */
export function firstWord(name: string): string {
  const n = String(name || '').trim();
  // A role standing in for a name ("The store", "The manager") is kept whole: never "The packs it" (SAL-6).
  if (/^the\s/i.test(n)) return n;
  return n.split(/\s+/)[0] || '';
}

/** A tint for someone the canvas did not cast: the same name always gets the same tint (t0–t5). */
export function tintFor(key: string): Tint {
  let h = 0;
  for (const c of String(key || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (['t0', 't1', 't2', 't3', 't4', 't5'] as const)[h % 6];
}

/** LANGUAGE.md §1.1 avatar tints: background and initials. */
export const TINTS: Record<Tint, { bg: string; fg: string }> = {
  t0: { bg: '#DCEAF8', fg: '#1A5A8A' },
  t1: { bg: '#F6E4F1', fg: '#7A3268' },
  t2: { bg: '#DDF1EE', fg: '#0E5E57' },
  t3: { bg: '#E4E6FA', fg: '#3A3F9B' },
  t4: { bg: '#E8EBF0', fg: '#3D4A5C' },
  t5: { bg: '#FDEEE1', fg: '#7A4A02' },
  // The Manager canvas's cast (docs/canvas/manager/BRIEF.md): Musa's mint, and the neutral tile of customers, suppliers, Moses and Peter.
  t6: { bg: '#E4F4EA', fg: '#0F6B43' },
  n: { bg: '#F1EEE8', fg: '#1C2233' },
  me: { bg: '#16203C', fg: '#FFFFFF' },
};

/** "#0552" (spec 05 §7; sales.html:4601 orderNo). */
export function orderNo(id: number): string {
  return '#' + String(id).padStart(4, '0');
}

/** A count and its word, one rule for the plural: "1 line", "2 lines", "1 day", "3 days". */
export function counted(n: number, word: string): string {
  return `${n} ${plural(n, word)}`;
}

/** "Lubowa Builders" → "Lubowa Builders’", "Kato Construction" → "Kato Construction’s" (a control's name: "Open Lubowa Builders’ chat"). */
export function possessive(name: string): string {
  return /s$/i.test(name.trim()) ? `${name.trim()}’` : `${name.trim()}’s`;
}

/** The word for n of them, when the number is drawn apart ("<b>1</b> chat", "<b>3</b> chats"). */
export function plural(n: number, word: string): string {
  return n === 1 ? word : `${word}s`;
}

/** How long a chat has been shut: "today", "1 day", "3 days" (never "0 days"). */
export function shutFor(days: number): string {
  return days > 0 ? counted(days, 'day') : 'today';
}

/** A name as a control's label says it: "&" spoken as "and" ("Kyaligonza and Sons. Change customer", SL01, CU01). */
export function sayName(name: string): string {
  return name.replace(/\s*&\s*/g, ' and ');
}

/**
 * An item's name as a control's label says it: inches are the word "inch", never the mark, which cuts a
 * label short ("Add Wire nails 4 inch · 25kg ctn", "Add PVC pipe ½ inch · 6m"; SL04, SL05, KC01).
 */
export function sayItem(name: string): string {
  return name.replace(/\s*(″|")/g, ' inch');
}

/** "INV-0552" (sales.html:4600 invoiceLabel). */
export function invoiceNo(id: number): string {
  return 'INV-' + String(id).padStart(4, '0');
}

/** The last 9 digits, how numbers are matched (sales.html phone9). */
export function phone9(p: string): string {
  const d = String(p || '').replace(/[^0-9]/g, '');
  return d.length >= 9 ? d.slice(-9) : '';
}

/** "0772 418 220" from any way it was typed or stored (256772418220, +256 772…); others with their +. */
export function phoneText(p: string): string {
  const d = String(p || '').replace(/[^0-9]/g, '');
  if (!d) return '';
  const local = d.startsWith('256') && d.length === 12 ? '0' + d.slice(3) : d.length === 9 ? '0' + d : d;
  if (/^0\d{9}$/.test(local)) return local.replace(/^(0\d{3})(\d{3})(\d{3})$/, '$1 $2 $3');
  return '+' + d;
}

/** A Ugandan mobile as people type it: 07… with 10 digits, or +256 and 9 more (sales.html phoneOk). */
export function phoneOk(p: string): boolean {
  const d = String(p || '').replace(/[^0-9+]/g, '');
  return /^0\d{9}$/.test(d) || /^\+?256\d{9}$/.test(d);
}

/** The words for the five stages (GLOSSARY: Checking · Buying · Packing · On the road · Delivered). */
export const STAGE_WORD: Record<Stage, string> = {
  checking: 'Checking',
  buying: 'Buying',
  packing: 'Packing',
  road: 'On the road',
  delivered: 'Delivered',
};

export const STAGES: Stage[] = ['checking', 'buying', 'packing', 'road', 'delivered'];

/** saved_quotes.status ↔ stage (spec 01 §1a). */
export const STATUS_OF: Record<Stage, string> = {
  checking: 'draft',
  buying: 'awaiting_goods',
  packing: 'preparing',
  road: 'pending_delivery',
  delivered: 'completed',
};

export function stageOf(status: string): Stage {
  switch (status) {
    case 'awaiting_goods': return 'buying';
    case 'preparing': return 'packing';
    case 'pending_delivery': return 'road';
    case 'completed': return 'delivered';
    default: return 'checking';
  }
}

/** A generic name is never a customer (spec 02 §5.2, 0139 ow_generic_client). */
export function isGenericName(name: string): boolean {
  const n = String(name || '').trim().toLowerCase();
  return !n || /^(walk-?in|cash (sale|customer|client)|counter (sale|customer)|customer|client|unknown|n\/a|none|-+|\.+)$/.test(n);
}

/** A login handle, not a name: has an @, or is one word with a digit ("grace2", "musa.k1") (store.html:1354 looksHandle). */
export function looksHandle(name: string): boolean {
  const n = String(name || '').trim();
  return n.includes('@') || (/\d/.test(n) && !/\s/.test(n));
}

/**
 * One name per person (store.html:1366 personName; WORD-01, STO-WORD-11): the first of the names given
 * that is a real name (the one they chose, their staff record's, the one stored with the row), else the
 * role's word ("The manager"), else "A colleague". Never an email handle, never "Someone".
 */
export function personName(names: (string | null | undefined)[], roleWord: string | null = null): string {
  const hit = names.map((n) => String(n || '').trim()).find((n) => n && !looksHandle(n));
  return hit || roleWord || 'A colleague';
}
