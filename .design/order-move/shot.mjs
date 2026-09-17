// Renders a .dc.html artboard as a plain page and screenshots it at its
// declared frame size, so a canvas can be looked at before it is seeded.
//   node .design/shot.mjs .design/cashbook/Main.dc.html
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const files = process.argv.slice(2);
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
for(const f of files){
  let s = fs.readFileSync(f,'utf8');
  const style = s.match(/<style>([\s\S]*?)<\/style>/)[1];
  const link = s.match(/<link[^>]*>/)[0];
  const body = s.split('</helmet>')[1].split('</x-dc>')[0];
  const m = body.match(/width:(\d+)px;height:(\d+)px/);
  const html = `<!doctype html><html><head><meta charset="utf-8">${link}<style>*{box-sizing:border-box}${style}</style></head><body style="margin:0">${body}</body></html>`;
  const tmp = '/tmp/_r.html'; fs.writeFileSync(tmp, html);
  const p = await b.newPage({viewport:{width:+m[1], height:+m[2]}, deviceScaleFactor:1});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+tmp);
  await p.waitForTimeout(900);
  const out = f.replace('.dc.html','.png');
  await p.screenshot({path:out, fullPage:false});
  // does content overflow the frame?
  const over = await p.evaluate(()=>{const a=document.querySelector('.app')||document.querySelector('.ph')||document.body.firstElementChild;return {sh:a.scrollHeight, ch:a.clientHeight, bw:document.body.scrollWidth};});
  console.log(out, JSON.stringify(over), errs.length?errs:'');
  await p.close();
}
await b.close();
