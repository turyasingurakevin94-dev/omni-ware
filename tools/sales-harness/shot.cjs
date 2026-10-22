/* Open sales.html with the fake Supabase (stub.js) and screenshot it at phone size.
   Serve the repo first:   python3 -m http.server 8790   (from the repo root)
   Then:  PW=<path to playwright> OUT=<dir> node tools/sales-harness/shot.cjs
   Each step is [name, js]: the js runs in the page (S, ACT, render, push, openSheet … are globals). */
const { chromium } = require(process.env.PW || 'playwright');
const fs = require('fs'), path = require('path');
const OUT = process.env.OUT || '.', STUB = fs.readFileSync(path.join(__dirname, 'stub.js'), 'utf8');
const STEPS = [
  ['today', "S.stack = []; S.view = 'today'; render()"],
  ['orders', "S.stack = []; S.view = 'orders'; render()"],
  ['customers', "S.stack = []; S.view = 'customers'; render()"],
  ['chats', "S.stack = []; S.view = 'chats'; render()"],
  ['me', "S.stack = []; S.view = 'me'; render()"],
];
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/supabase.js', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: STUB }));
  await p.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
  await p.goto('http://localhost:8790/sales.html', { waitUntil: 'load' }); await p.waitForTimeout(1500);
  for (const [n, js] of STEPS) { await p.evaluate(js); await p.waitForTimeout(600); await p.screenshot({ path: `${OUT}/${n}.png` }); }
  console.log('page errors:', JSON.stringify(errs)); await b.close();
})();
