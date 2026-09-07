import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs'; import path from 'path'; import {fileURLToPath} from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const names = process.argv.slice(2);
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
for (const n of names) {
  const src = fs.readFileSync(path.join(here, n + '.dc.html'), 'utf8')
    .replace(/<script src="\.\/support\.js"><\/script>/, '')
    .replace(/<\/?x-dc>/g, '').replace(/<\/?helmet>/g, '')
    .replace(/<script data-dc-script[\s\S]*?<\/script>/, '');
  const f = path.join(here, `.pv-${n}.html`); fs.writeFileSync(f, src);
  const m = src.match(/class="app" style="width:(\d+)px;height:(\d+)px/);
  const p = await b.newPage({viewport:{width:+m[1], height:+m[2]}, deviceScaleFactor:1});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+f); await p.waitForTimeout(800);
  const over = await p.evaluate(()=>{const a=document.querySelector('.app');
    return {h:a.scrollHeight, bw:document.body.scrollWidth};});
  await p.screenshot({path: path.join(here, `shot-${n}.png`)});
  console.log(n.padEnd(10), JSON.stringify(over), errs.length?errs:'');
  await p.close(); fs.unlinkSync(f);
}
await b.close();
