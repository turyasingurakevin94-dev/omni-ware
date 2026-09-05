import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
for(const f of process.argv.slice(2)){
  let s = fs.readFileSync(f,'utf8');
  const style = s.match(/<style>([\s\S]*?)<\/style>/)[1];
  const body = s.split('</helmet>')[1].split('</x-dc>')[0];
  const m = body.match(/width:(\d+)px;height:(\d+)px/);
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${style}</style></head><body style="margin:0">${body}</body></html>`;
  fs.writeFileSync('/tmp/_r.html', html);
  const p = await b.newPage({viewport:{width:+m[1], height:+m[2]}, deviceScaleFactor:1});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file:///tmp/_r.html');
  await p.waitForTimeout(1100);
  const d = await p.evaluate(()=>({sw:document.documentElement.scrollWidth, sh:document.documentElement.scrollHeight}));
  await p.screenshot({path: f.replace('.dc.html','.png')});
  console.log(f.replace('.dc.html','').padEnd(11), `frame ${m[1]}x${m[2]}`, `content ${d.sw}x${d.sh}`,
    (d.sw>+m[1]||d.sh>+m[2])?'  <-- OVERFLOW':'  ok', errs.length?('ERR '+errs[0]):'');
  await p.close();
}
await b.close();
