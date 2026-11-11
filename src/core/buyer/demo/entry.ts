/* next/buyer-demo.js: the Buyer's sample shop, loaded only on ?demo (src/apps/buyer/shell/store.ts). */
import { buyerDemo } from './index.ts';

(window as unknown as { owBuyerDemo: unknown }).owBuyerDemo = { buyerDemo };
