/*
 * The order's picture on WhatsApp, sent as it is placed (SL07 "Picture to
 * Kato"; SL28 "Picture sent", SL29 "Picture not sent yet · Try again"):
 * the order drawn as the customer reads it (sales.html:6353 ordDrawPicture:
 * the shop, the number, each line, the total; a price coming says so), then
 * act('sendPicture'), so no signal keeps it to send again.
 */
import { signal } from '@preact/signals';
import { extraRows, lineTotal, money, orderTotal } from '../../../core/money.ts';
import { orderNo } from '../../../core/names.ts';
import type { Order } from '../../../core/types.ts';
import { act, books } from '../shell/store.ts';

export interface PicState { state: 'sending' | 'sent' | 'failed'; chatId: number }

export const pictures = signal<Map<number, PicState>>(new Map());
/** The order just placed, until the books read it back. */
export const lastPlaced = signal<Order | null>(null);

function set(id: number, p: PicState): void {
  const m = new Map(pictures.value);
  m.set(id, p);
  pictures.value = m;
}

/** The order as a PNG, 640 wide. */
export function drawOrder(o: Order, shop: string): Promise<Blob> {
  const rows = o.lines.filter((l) => l.qty > 0 && l.state !== 'dropped'), extra = extraRows(o), h = 150 + (rows.length + extra.length) * 46 + 90;
  const cv = document.createElement('canvas');
  cv.width = 640; cv.height = h;
  const g = cv.getContext('2d');
  if (!g) return Promise.reject(new Error('Could not draw the order'));
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, 640, h);
  g.fillStyle = '#16203C'; g.fillRect(0, 0, 640, 110);
  g.fillStyle = '#FFFFFF'; g.font = '700 30px Figtree, sans-serif'; g.fillText(shop, 32, 52);
  g.fillStyle = '#B3BCD2'; g.font = '600 22px Figtree, sans-serif'; g.fillText(`Order ${orderNo(o.id)} · ${o.client.name}`, 32, 88);
  let y = 150;
  g.textBaseline = 'middle';
  const row = (left: string, sub: string, right: string, bold = false) => {
    g.fillStyle = '#1C2233'; g.font = `${bold ? 700 : 600} 22px Figtree, sans-serif`; g.textAlign = 'left'; g.fillText(left, 32, y);
    if (sub) { g.fillStyle = '#5F6980'; g.font = '400 18px "IBM Plex Mono", monospace'; g.fillText(sub, 360, y); }
    g.fillStyle = '#1C2233'; g.font = `600 22px "IBM Plex Mono", monospace`; g.textAlign = 'right'; g.fillText(right, 608, y);
    y += 46;
  };
  rows.forEach((l) => row(l.name, `${l.qty} × ${l.price == null ? '…' : money(l.price)}`, l.price == null ? 'Price coming' : money(lineTotal(l))));
  extra.forEach((r) => row(r.label, '', money(r.amount)));
  g.fillStyle = '#E6E3DD'; g.fillRect(32, y - 18, 576, 2); y += 18;
  row('Total', '', money(orderTotal(o)), true);
  return new Promise((resolve, reject) => cv.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not draw the order'))), 'image/png'));
}

/** Draw and send; the Placed screen shows how it went. */
export async function sendPicture(o: Order, chatId: number): Promise<void> {
  lastPlaced.value = o;
  set(o.id, { state: 'sending', chatId });
  try {
    const b = books.value, png = await drawOrder(o, b ? b.shop.name : 'Your order');
    const r = await act('sendPicture', chatId, png, `${b ? b.shop.name : 'Your order'} · order ${orderNo(o.id)}`);
    set(o.id, { state: r.kept ? 'failed' : 'sent', chatId });
  } catch (_e) {
    set(o.id, { state: 'failed', chatId });
  }
}
