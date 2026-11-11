/*
 * Big text (You, TD12; STO-A11Y-01: the whole scale at least 1.2×, controls 52 px).
 * Kept on this phone (ow-store-prefs, store.html:1022), never in the books. The shell
 * marks <html class="ow-big">; app.css scales the frame. The demo's &big=1 turns it on.
 */
import { effect, signal } from '@preact/signals';

const KEY = 'ow-store-prefs';

function read(): { big: boolean } {
  try { return { big: !!JSON.parse(localStorage.getItem(KEY) || '{}').big }; } catch (_e) { return { big: false }; }
}

export const bigText = signal<boolean>(typeof window !== 'undefined' && (read().big || /[?&]demo/.test(location.search) && /[?&]big=1(&|$)/.test(location.search)));

export function setBig(on: boolean): void {
  bigText.value = on;
  try { const p = JSON.parse(localStorage.getItem(KEY) || '{}'); p.big = on; localStorage.setItem(KEY, JSON.stringify(p)); } catch (_e) { /* private mode */ }
}

if (typeof document !== 'undefined') effect(() => { document.documentElement.classList.toggle('ow-big', bigText.value); });
