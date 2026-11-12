// Build helper (not shipped): a 360×780 shot of next/manager.html. NODE_PATH=$(npm root -g) node tools/manager-shot.cjs '?demo' out.png [click selectors…]
// node mshot.cjs '<query>' out.png [clicks...]: next/manager.html at 360x780; clicks are CSS or text= selectors.
const { chromium } = require('playwright');
(async () => {
  const [q, out, ...clicks] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
  p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  await p.goto('file:///home/user/omni-ware/next/manager.html' + q);
  await p.waitForTimeout(900);
  for (const c of clicks) { if (c.startsWith('wait:')) { await p.waitForTimeout(+c.slice(5)); continue; } await p.locator(c).first().click(); await p.waitForTimeout(500); }
  await p.screenshot({ path: out });
  await b.close();
})();
