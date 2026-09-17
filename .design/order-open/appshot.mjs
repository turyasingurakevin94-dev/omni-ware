/* Opens the SHIPPED dialogs and photographs them, so the app can be held
   against the artboards it was drawn from rather than described.
     node .design/order-open/appshot.mjs preview 365 680 420
   Seeds the same eleven orders the artboards were drawn over, so the two
   pictures show the same morning. */
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const here = new URL('.', import.meta.url).pathname;
const seed = fs.readFileSync(here + 'board-seed.js', 'utf8');
const shots = [
  ['Preview',  'openOrderPreview(365)',  680, 460],
  ['Busy',     'openOrderPreview(367)',  680, 560],
  ['Menu',     "openOrderPreview(365); otDlgAct('menu', document.querySelector('[data-dlg=menu]'))", 680, 460],
  ['Buying',   'openBuyingList()',       900, 520],
  ['Runs',     'openDeliveryRuns()',     900, 520],
  ['Short',    "openPickShortfallModal(367, false)", 560, 320],
];
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
for(const [name, call, w, h] of shots){
  const p = await b.newPage({viewport:{width:1440, height:Math.max(900, h + 200)}, deviceScaleFactor:1});
  await p.addInitScript(()=>{ window.supabase = { createClient: ()=> ({
    auth:{ getSession: async()=>({data:{session:null}}), onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}), signOut: async()=>({}) },
    from: ()=>({ select: ()=>({ eq: ()=>({ maybeSingle: async()=>({data:null}), single: async()=>({data:null}) }), order: ()=>({ limit: async()=>({data:[]}) }) }) }),
    channel: ()=>({ on(){return this;}, subscribe(){return this;} }), removeChannel(){},
  }) }; });
  const errs=[]; p.on('pageerror', e=> errs.push(String(e).slice(0,160)));
  await p.goto('file://' + here.replace('/.design/order-open/','/') + 'index.html');
  await p.waitForTimeout(1400);
  await p.evaluate(()=>{ try{ hideAuthOverlay(); }catch(e){} document.body.classList.remove('app-loading');
    try{ if(typeof data === 'undefined' || !data) data = seedData(); }catch(e){}
    try{ if(!data.savedQuotes) data.savedQuotes = []; }catch(e){} });
  await p.evaluate(seed);
  await p.evaluate(()=>{ try{ renderSavedQuotes(); }catch(e){} });
  await p.evaluate(call);
  await p.waitForTimeout(500);
  const el = (await p.$('#pickShortModal.show .modal')) || (await p.$('.ow-dlg'));
  const out = here + 'app' + name + '.png';
  try{ if(el) await el.screenshot({path: out, timeout: 4000}); else await p.screenshot({path: out}); }
  catch(e){ await p.screenshot({path: out}); }
  const box = el ? await el.boundingBox() : null;
  const cls = el ? await el.getAttribute('class') : '';
  if(process.env.DBG) console.log('   class=', cls);
  console.log(name, box ? `${Math.round(box.width)}×${Math.round(box.height)}` : 'NO DIALOG', errs.slice(0,2).join(' | '));
  await p.close();
}
await b.close();
