/*
 * Which shop this phone opens when one sign-in opens more than one (TD28 "Which shop?", SAL-019): the person's
 * choice, kept on this phone until sign-out, as sales.html's chooseShop did. One place for the key.
 */
const KEY = 'ow-sales-shop';

export function chosenShop(): string | null {
  try { return localStorage.getItem(KEY); } catch (_e) { return null; }
}

export function chooseShopOnPhone(shopId: string): void {
  try { localStorage.setItem(KEY, shopId); } catch (_e) { /* storage refused: asked again next time */ }
}

export function forgetShop(): void {
  try { localStorage.removeItem(KEY); } catch (_e) { /* nothing kept */ }
}
