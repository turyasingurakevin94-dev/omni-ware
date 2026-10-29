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
  return String(name || '').trim().split(/\s+/)[0] || '';
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
  me: { bg: '#16203C', fg: '#FFFFFF' },
};

/** "#0552" (spec 05 §7; sales.html:4601 orderNo). */
export function orderNo(id: number): string {
  return '#' + String(id).padStart(4, '0');
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
