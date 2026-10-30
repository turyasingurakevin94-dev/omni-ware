/*
 * The order picture Tell sends with its words as the caption (OR10 "Order picture · #0552 as it
 * stands"; docs/spec/04-screens-sales.md §4, from sales.html:6331-6410 ordDrawPicture and 6474):
 * the shop's letterhead, ORDER #0552, each line with its state (not found struck, a new price with
 * the old one struck, a price coming), then what is to pay. Never an invoice: Sales cannot raise one.
 */
import { lineTotal, orderTotal } from '../../../core/money.ts';
import { STAGE_WORD, orderNo } from '../../../core/names.ts';
import { dayLabel } from '../../../core/time.ts';
import type { Books, Order } from '../../../core/types.ts';
import { nameOf } from './data.ts';

const SANS = 'Figtree, system-ui, sans-serif', MONO = '"IBM Plex Mono", ui-monospace, monospace';
const INK = '#1C2233', MUTE = '#5F6980', RED = '#C93A30', f = (n: number) => Math.round(n).toLocaleString('en-US');

export function orderPicture(b: Books, o: Order, now: number): Promise<Blob> {
  const rows = o.lines.filter((l) => l.qty > 0), w = 640, rowH = 46, top = 132, h = top + rows.length * rowH + 150;
  const cv = document.createElement('canvas');
  cv.width = w * 2; cv.height = h * 2;
  const c = cv.getContext('2d') as CanvasRenderingContext2D;
  c.scale(2, 2);
  const text = (s: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = 'left') => { c.font = font; c.fillStyle = color; c.textAlign = align; c.fillText(s, x, y); };
  const line = (y: number, color: string, wd: number, dash: number[] = []) => { c.strokeStyle = color; c.lineWidth = wd; c.setLineDash(dash); c.beginPath(); c.moveTo(32, y); c.lineTo(w - 32, y); c.stroke(); c.setLineDash([]); };
  c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, w, h);
  c.fillStyle = RED; c.fillRect(0, 0, w, 6);
  text(b.shop.name, 32, 48, `700 22px ${SANS}`, INK);
  text(`ORDER ${orderNo(o.id)}`, 32, 70, `700 13px ${SANS}`, RED);
  text(`to ${nameOf(b, o)}`, 32, 90, `600 12px ${SANS}`, MUTE);
  text(STAGE_WORD[o.stage], w - 32, 48, `700 13px ${SANS}`, INK, 'right');
  text(dayLabel(now), w - 32, 70, `600 12px ${SANS}`, MUTE, 'right');
  line(108, INK, 1.5);
  let y = top;
  rows.forEach((l, i) => {
    const gone = l.state === 'dropped', rv = l.priceReview, was = !gone && rv && rv.state === 'changed' && rv.was ? rv.was * l.qty : null;
    const tag = gone ? '' : l.price == null ? 'BEING CONFIRMED' : l.state === 'waiting' ? 'ON THE WAY' : was != null ? `NEW PRICE · ${f(rv?.price || 0)} EACH` : '';
    const base = y + (tag ? 10 : 18), ink = gone ? '#8A93A3' : INK;
    text(`${f(l.qty)} ${l.unit}`, 32, base, `600 13px ${MONO}`, ink);
    text(l.name, 120, base, `700 14px ${SANS}`, ink);
    if (gone) { const nw = c.measureText(l.name).width; c.strokeStyle = '#8A93A3'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(120, base - 5); c.lineTo(120 + nw, base - 5); c.stroke(); }
    if (tag) text(tag, 120, base + 16, `700 10px ${SANS}`, was != null ? '#1A5A8A' : l.state === 'waiting' ? '#3A3F9B' : '#95530C');
    if (gone) text('NOT FOUND', w - 32, base, `700 11px ${SANS}`, '#8E2A22', 'right');
    else if (l.price == null) text('Price coming', w - 32, base, `700 12px ${SANS}`, '#95530C', 'right');
    else {
      text(f(lineTotal(l)), w - 32, base, `600 14px ${MONO}`, INK, 'right');
      if (was != null) { const aw = c.measureText(f(lineTotal(l))).width; text(f(was), w - 44 - aw, base, `500 12px ${MONO}`, '#8A93A3', 'right'); }
    }
    if (i < rows.length - 1) line(y + rowH - 8, '#E2DED6', 1, [4, 3]);
    y += rowH;
  });
  y += 4; line(y, INK, 1.5); y += 32;
  const total = orderTotal(o), due = Math.max(0, total - o.paid), settled = total > 0 && due === 0;
  // A voided bill is never to pay: the picture says VOID and nothing owed (OR29).
  text(o.voided ? 'VOID · NOTHING OWED' : settled ? 'PAID' : o.paid > 0 ? 'LEFT TO PAY' : 'TO PAY', 32, y, `800 14px ${SANS}`, INK);
  text(`UGX ${f(o.voided ? 0 : settled ? total : due)}`, w - 32, y, `700 20px ${MONO}`, settled || o.voided ? '#0F6B43' : RED, 'right');
  y += 40;
  text({ checking: 'We are confirming your order with our suppliers.', buying: 'We are bringing in your order.', packing: 'We are packing your order.', road: 'Your order is on the way.', delivered: 'Your order is delivered.' }[o.stage], 32, y, `500 12px ${SANS}`, MUTE);
  text([b.shop.name, b.settings.shopPhone].filter(Boolean).join(' · '), 32, y + 20, `600 12px ${SANS}`, MUTE);
  return new Promise((resolve, reject) => cv.toBlob((x) => (x ? resolve(x) : reject(new Error('Could not draw the order'))), 'image/png'));
}
