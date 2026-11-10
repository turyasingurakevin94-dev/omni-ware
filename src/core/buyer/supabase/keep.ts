/*
 * What the Buyer says on the trip that buyer.html keeps on the phone only,
 * until the hand-in (docs/spec/04-screens-buyer-data.md §0a, §7 #3).
 *
 *   ow-buyer-pay:<uid>               the same key and shape buyer.html uses (4105):
 *                                    tripPay[tripId] = { amount, noReceipt, done, … }, so a
 *                                    round begun on one app can be finished on the other
 *   ow-buyer-off:<uid>:<shop>        the planned trip's stops taken off before the cash ask
 *                                    (buyer.html keeps this in the screen only: planSel 3473)
 *
 * localStorage, like buyer.html; private mode or a full store keeps nothing and says nothing.
 */
export interface StopPay { amount?: number | null; noReceipt?: boolean; done?: string | null; skip?: boolean; own?: boolean; photo?: { path: string; at: string } | null }
export interface Keep { pay: Record<string, StopPay>; off: string[] }

const payKey = (uid: string) => 'ow-buyer-pay:' + uid;
const offKey = (uid: string, shop: string) => 'ow-buyer-off:' + uid + ':' + shop;

function get<T>(k: string, empty: T): T {
  try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v && typeof v === 'object' ? v as T : empty; } catch (_e) { return empty; }
}
function put(k: string, v: unknown): void {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch (_e) { /* nothing kept */ }
}

export function loadKeep(uid: string, shop: string): Keep {
  const off = get<unknown>(offKey(uid, shop), []);
  return { pay: get<Record<string, StopPay>>(payKey(uid), {}), off: Array.isArray(off) ? off.map(String) : [] };
}

export function setStopPay(uid: string, tripId: string, patch: StopPay | null): void {
  const all = get<Record<string, StopPay>>(payKey(uid), {});
  if (patch == null) delete all[tripId]; else all[tripId] = { ...(all[tripId] || {}), ...patch };
  put(payKey(uid), all);
}

export function setOff(uid: string, shop: string, off: string[]): void {
  put(offKey(uid, shop), [...new Set(off.map(String))]);
}
