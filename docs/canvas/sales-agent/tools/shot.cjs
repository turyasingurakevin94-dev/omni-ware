// Render one or more .dc.html artboards (literal markup) to PNG.
// usage: node shot.cjs out_dir file1.dc.html [file2 ...]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const [out, ...files] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const b = await chromium.launch(proxy ? { proxy } : {});
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    const m = src.match(/"\$preview":\{"width":(\d+),"height":(\d+)\}/);
    const w = m ? +m[1] : 390, h = m ? +m[2] : 844;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
    const p = await ctx.newPage();
    const html = src.replace('<script src="./support.js"></script>', '').replace(/<script type="text\/x-dc"[\s\S]*?<\/script>/, '')
      .replace(/<x-dc>/g, '<div class="xdc">').replace(/<\/x-dc>/g, '</div>').replace(/<helmet>/g, '').replace(/<\/helmet>/g, '');
    await p.setContent(html, { waitUntil: 'load', timeout: 20000 }).catch(() => {});
    await p.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
    await p.waitForTimeout(400);
    const fonts = await p.evaluate(() => [...document.fonts].filter(x => x.status === 'loaded').map(x => x.family + x.weight).length);
    const o = path.join(out, path.basename(f).replace('.dc.html', '.png'));
    await p.screenshot({ path: o, clip: { x: 0, y: 0, width: w, height: h } });
    console.log(o, w + 'x' + h, 'fonts:' + fonts);
    await ctx.close();
  }
  await b.close();
})();
