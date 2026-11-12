// Print the height the content of a .dc.html board needs (bottom of the root's last child + 48).
// usage: node measure.cjs file.dc.html
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const f = process.argv[2];
  const src = fs.readFileSync(f, 'utf8');
  const m = src.match(/"\$preview":\{"width":(\d+),"height":(\d+)\}/);
  const w = +m[1];
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: w, height: 800 } })).newPage();
  const html = src.replace('<script src="./support.js"></script>', '').replace(/<script type="text\/x-dc"[\s\S]*?<\/script>/, '')
    .replace(/<x-dc>/g, '<div class="xdc">').replace(/<\/x-dc>/g, '</div>').replace(/<helmet>/g, '').replace(/<\/helmet>/g, '');
  await p.setContent(html, { waitUntil: 'load', timeout: 20000 }).catch(() => {});
  await p.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
  await p.waitForTimeout(300);
  const h = await p.evaluate(() => {
    const root = document.querySelector('.xdc > div');
    let max = 0; const top = root.getBoundingClientRect().top;
    for (const c of root.children) max = Math.max(max, c.getBoundingClientRect().bottom - top);
    return Math.ceil(max);
  });
  console.log(h + 48);
  await b.close();
})();
