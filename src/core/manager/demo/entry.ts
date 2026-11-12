/* manager-demo.js: the Manager's sample day, loaded only on ?demo (src/apps/manager/shell/store.ts). */
import { managerDemo } from './index.ts';

(window as unknown as { owManagerDemo: unknown }).owManagerDemo = { managerDemo };
