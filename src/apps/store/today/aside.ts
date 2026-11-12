/*
 * The returns this phone marked "It's set aside" today (TD28 → TD16). The books have no field for it,
 * so it is kept on the phone (ow-store-setaside:<day>) and goes with the close (W23 payload.shelved).
 */
import { dayOf } from '../../../core/time.ts';

const KEY = (n: number): string => `ow-store-setaside:${dayOf(n)}`;
export const readAside = (n: number): string[] => { try { return JSON.parse(localStorage.getItem(KEY(n)) || '[]'); } catch (_e) { return []; } };
export const keepAside = (n: number, ids: string[]): void => { try { localStorage.setItem(KEY(n), JSON.stringify(ids)); } catch (_e) { /* private mode */ } };
