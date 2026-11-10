/*
 * Opening another tab's screen, only through a ROUTES.md id. Until that tab's
 * builder registers the id, the tab's own root opens instead (never a dead tap).
 */
import { nav, screen } from '../shell/nav.ts';
import type { Params, TabId } from '../shell/types.ts';

export function go(id: string, params: Params = {}): void {
  if (screen(id)) { nav.push(id, params); return; }
  const root = id.split('/')[0];
  if (screen(root)) {
    if (root === 'today' || root === 'chats' || root === 'orders' || root === 'customers') nav.tab(root as TabId);
    else nav.push(root);
  }
}

/** ROUTES `items`: what to put on the order, as Sell reads it (a JSON list of { itemId, qty }). */
export function itemsParam(itemId: string, qty: number = 1): string {
  return JSON.stringify([{ itemId, qty }]);
}

/** A phone number for tel: (0772 418 220 → +256772418220). */
export function tel(phone: string): string {
  const d = phone.replace(/[^0-9]/g, '');
  return d.startsWith('0') ? '+256' + d.slice(1) : '+' + d;
}
