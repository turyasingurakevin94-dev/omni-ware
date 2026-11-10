/*
 * The demo as its own file, next/<role>-demo.js, loaded by the page only on
 * ?demo (tools/build-app.js). The page itself never carries the sample shop,
 * so its 80 KB budget is the real app's (spec 07 §4).
 */
import { demoSource } from './index.ts';

declare global {
  interface Window { owDemo?: { demoSource: typeof demoSource } }
}

window.owDemo = { demoSource };
