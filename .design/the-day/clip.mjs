import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [file, out, w, h, x, y, cw, ch] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: +w, height: +h } });
await p.goto('file://' + file); await p.waitForTimeout(1000);
await p.screenshot({ path: out, clip: { x:+x, y:+y, width:+cw, height:+ch } });
console.log('ok ' + out); await b.close();
