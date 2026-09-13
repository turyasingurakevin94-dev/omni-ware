// Same as .design/shot.mjs, but renders the temp page INSIDE this folder
// so an artboard's relative <img src="before-home.jpg"> resolves -- which
// is how the canvas itself resolves a files entry by filename.
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs'; import path from 'path';
const DIR = path.dirname(new URL(import.meta.url).pathname);
const files = process.argv.slice(2);
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
for(const f of files){
  const s = fs.readFileSync(path.join(DIR,f),'utf8');
  const style = s.match(/<style>([\s\S]*?)<\/style>/)[1];
  const link = s.match(/<link[^>]*>/)[0];
  const body = s.split('</helmet>')[1].split('</x-dc>')[0];
  const m = body.match(/width:(\d+)px;height:(\d+)px/);
  const html = `<!doctype html><html><head><meta charset="utf-8">${link}<style>*{box-sizing:border-box}${style}</style></head><body style="margin:0">${body}</body></html>`;
  const tmp = path.join(DIR, '_r.html'); fs.writeFileSync(tmp, html);
  const p = await b.newPage({viewport:{width:+m[1], height:+m[2]}, deviceScaleFactor:1});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+tmp);
  await p.waitForTimeout(900);
  const out = path.join(DIR, f.replace('.dc.html','.png'));
  await p.screenshot({path:out, fullPage:false});
  const over = await p.evaluate(()=>{
    const a=document.querySelector('.app');
    const broken=[...document.images].filter(i=>!i.naturalWidth).map(i=>i.getAttribute('src'));
    return {sh:a.scrollHeight, ch:a.clientHeight, bw:document.body.scrollWidth, broken};
  });
  console.log(path.basename(out), JSON.stringify(over), errs.length?errs:'');
  await p.close();
}
fs.unlinkSync(path.join(DIR,'_r.html'));
await b.close();
