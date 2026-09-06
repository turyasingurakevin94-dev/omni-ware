/* Renders each artboard standalone at its real 600x800 and tiles them,
   so the fit can be judged before anyone else sees it. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs'; import path from 'path'; import {fileURLToPath} from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const names = ['Now','Main','Band','PriceFirst','Cards','Leader'];
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
for (const n of names) {
  const src = fs.readFileSync(path.join(here, n + '.dc.html'), 'utf8')
    .replace(/<script src="\.\/support\.js"><\/script>/, '')
    .replace(/<\/?x-dc>/g, '').replace(/<\/?helmet>/g, '');
  const f = path.join(here, `.preview-${n}.html`);
  fs.writeFileSync(f, src);
  const p = await b.newPage({viewport:{width:600,height:800}});
  await p.goto('file://' + f);
  await p.waitForTimeout(700);
  const box = await p.evaluate(()=>{ const w=document.querySelector('.w');
    return { h: w.scrollHeight, over: w.scrollHeight > 800 }; });
  await p.screenshot({path: path.join(here, `shot-${n}.png`)});
  console.log(n.padEnd(11), 'content', box.h, box.over ? 'OVERFLOWS' : 'fits');
  await p.close(); fs.unlinkSync(f);
}
await b.close();
