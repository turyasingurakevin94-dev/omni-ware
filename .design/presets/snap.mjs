import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [file,out,w,h] = process.argv.slice(2);
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage({viewport:{width:+w,height:+h},deviceScaleFactor:1});
const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('file://'+file); await p.waitForTimeout(900);
await p.screenshot({path:out});
console.log(JSON.stringify(await p.evaluate(()=>{const a=document.querySelector('.app');return{sh:a.scrollHeight,ch:a.clientHeight,bw:document.body.scrollWidth};})), errs);
await b.close();
