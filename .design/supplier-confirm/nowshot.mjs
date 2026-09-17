/* What ships today: the supplier-confirm modal, which exists and works —
   reached only through a row the board no longer draws. */
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const here='/home/user/omni-ware/.design/supplier-confirm/';
const seed=fs.readFileSync('/home/user/omni-ware/.design/order-open/board-seed.js','utf8');
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const shots=[
  ['Modal', "openSupplierConfirmModal(365)", '#supplierConfirmModal .modal'],
  ['Dialog', "openOrderPreview(365)", '.ow-dlg'],
];
for(const [name,call,sel] of shots){
  const p=await b.newPage({viewport:{width:1440,height:900}});
  await p.addInitScript(()=>{window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null})})})}),channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel(){}})};});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,140)));
  await p.goto('file:///home/user/omni-ware/index.html'); await p.waitForTimeout(1400);
  await p.evaluate(()=>{try{hideAuthOverlay();}catch(e){} document.body.classList.remove('app-loading'); try{if(typeof data==='undefined'||!data)data=seedData();}catch(e){}});
  await p.evaluate(seed);
  /* Order 365 buys one line in from Roto Industry, so it has somebody to ask. */
  await p.evaluate(()=>{try{renderSavedQuotes();}catch(e){}});
  await p.evaluate(call); await p.waitForTimeout(500);
  const el=await p.$(sel);
  const out=here+'now'+name+'.png';
  try{ if(el) await el.screenshot({path:out,timeout:4000}); else await p.screenshot({path:out}); }
  catch(e){ await p.screenshot({path:out}); }
  const box=el?await el.boundingBox():null;
  console.log(name, box?`${Math.round(box.width)}×${Math.round(box.height)}`:'NOT FOUND', errs.slice(0,1).join(''));
  await p.close();
}
await b.close();
