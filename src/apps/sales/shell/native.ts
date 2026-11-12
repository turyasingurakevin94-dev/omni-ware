/*
 * The Sales app's native layer: the shared one (src/native/start.ts) on Sales' own page, key, build id
 * and stack. Inert in a browser and in the demo.
 */
import type { NativeApp } from '../../../native/update.ts';
import { inPhoneApp, startNative as start } from '../../../native/start.ts';
import { sheet } from '../../../ui/sheet.tsx';
import { nav, stack } from './nav.ts';
import { isDemo } from './store.ts';

export { inPhoneApp };

export const SALES_APP: NativeApp = {
  role: 'sales',
  // The new app's own page, not the root sales.html: the root is the old app until Sales is switched, and the
  // safety rule refuses it, so an installed APK never took a fix and every change needed a new APK (Kevin, 10 Nov
  // 2026: "dont always build the new apk"). next/ is built from src/ on every change.
  source: 'https://omni-ware.vercel.app/next/sales.html',
  key: 'ow-sales-bundle',
  build: 'owSalesBuild',
};

/** Back reads this app's own sheet and stack. */
export function startNative(): void {
  start({
    app: SALES_APP,
    isDemo,
    back: () => ({
      sheetOpen: sheet.isOpen,
      depth: stack.value.length,
      rootId: stack.value[0].id,
      closeSheet: () => sheet.close(),
      pop: () => nav.back(),
      today: () => nav.home(),
    }),
  });
}
