/* next/store-demo.js: the Store's sample day, loaded only on ?demo (src/apps/store/shell/store.ts). */
import { storeDemo } from './index.ts';

(window as unknown as { owStoreDemo: unknown }).owStoreDemo = { storeDemo };
