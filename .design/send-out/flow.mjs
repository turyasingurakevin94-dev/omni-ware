/* Drives the SHIPPED send-out pane the way a hand does: opens a packed
   order, picks who carries it, types where the form asks, presses the
   move, then looks at the record. Prints one line per step so a failure
   names the step it failed at. */
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const here = new URL('.', import.meta.url).pathname;
const root = here.replace('/.design/send-out/', '/');
const seed = fs.readFileSync(root + '.design/order-open/board-seed.js', 'utf8');
let bad = 0;
const ok = (yes, what, got)=>{ if(!yes) bad++; console.log((yes?'ok   ':'FAIL ') + what + (got===undefined?'':'  → ' + JSON.stringify(got))); };

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage({viewport:{width:1440, height:900}, deviceScaleFactor:1});
await p.addInitScript(()=>{ window.supabase = { createClient: ()=> ({
  auth:{ getSession: async()=>({data:{session:null}}), onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}), signOut: async()=>({}) },
  from: ()=>({ select: ()=>({ eq: ()=>({ maybeSingle: async()=>({data:null}), single: async()=>({data:null}) }), order: ()=>({ limit: async()=>({data:[]}) }) }), upsert: async()=>({data:null,error:null}), insert: async()=>({data:null,error:null}), update: ()=>({ eq: async()=>({data:null,error:null}) }) }),
  channel: ()=>({ on(){return this;}, subscribe(){return this;} }), removeChannel(){},
}) }; });
const errs=[]; p.on('pageerror', e=> errs.push(String(e).slice(0,200)));
await p.goto('file://' + root + 'index.html');
await p.waitForTimeout(1400);
await p.evaluate(()=>{ try{ hideAuthOverlay(); }catch(e){} document.body.classList.remove('app-loading');
  try{ if(typeof data === 'undefined' || !data) data = seedData(); }catch(e){}
  try{ if(!data.savedQuotes) data.savedQuotes = []; }catch(e){} });
await p.evaluate(seed);
await p.evaluate(()=>{ try{ renderSavedQuotes(); }catch(e){} });

/* 0 — THE ROUTE FROM THE DASHBOARD. The lane card is the door (one tap,
   the whole card), and what it opens is the question with the move under
   it. That is the button the owner asked for: not a menu item, and not
   a control buried in the phone's row on a screen a console never shows. */
await p.evaluate(()=>{ try{ goToTab('quote-saved'); }catch(e){} });
await p.waitForTimeout(300);
const s0 = await p.evaluate(()=>{
  const card = document.querySelector('.ow-ot-card[data-id="364"]');
  return { there: !!card, seen: !!(card && card.offsetParent),
    lane: card ? ((card.closest('.ow-ot-lane') || {}).querySelector
      ? card.closest('.ow-ot-lane').querySelector('.ow-ot-lh-n').textContent.trim() : '') : '',
    act: card ? card.dataset.act : '' };
});
ok(s0.there && s0.seen, 'the order has a card on the console board', s0);
ok(/Prepar/i.test(s0.lane), 'in the lane it is actually in', s0.lane);
ok(s0.act === 'preview', 'and the whole card is the door');
await p.evaluate(()=>{ document.querySelector('.ow-ot-card[data-id="364"]').click(); });
await p.waitForTimeout(350);
const s0b = await p.evaluate(()=> ({
  pane: !!document.querySelector('#otDlg .ow-ld[data-load]'),
  act: (document.querySelector('#otDlg .ow-dlg-f .btn-accent')||{}).textContent || '',
}));
ok(s0b.pane, 'one tap from the board and the question is open');
ok(s0b.act.trim() === 'Send it out', 'with the move to Out under it', s0b.act.trim());
await p.evaluate(()=> otDlgClose());
await p.waitForTimeout(150);

/* 1 — a packed order in Preparing opens on the question. */
await p.evaluate(()=> openOrderPreview(364));
await p.waitForTimeout(250);
const s1 = await p.evaluate(()=> ({
  pane: !!document.querySelector('#otDlg .ow-ld[data-load]'),
  head: (document.querySelector('#otDlg .ow-op-lh')||{}).textContent || '',
  cards: [...document.querySelectorAll('#otDlg .ow-ld-o')].map(e=> e.querySelector('.ow-ld-n').textContent),
  on: [...document.querySelectorAll('#otDlg .ow-ld-o.ow-on')].length,
  fields: [...document.querySelectorAll('#otDlg [data-car]:not([type=hidden])')].map(e=> e.dataset.car),
  act: (document.querySelector('#otDlg .ow-dlg-f .btn-accent')||{}).textContent || '',
  off: !!document.querySelector('#otDlg .ow-dlg-f .btn-accent[disabled]'),
  note: (document.querySelector('#otDlg .ow-dlg-n')||{}).textContent || '',
  accents: document.querySelectorAll('#otDlg .btn-accent').length,
}));
ok(s1.pane, 'the carrier pane replaces the lines');
ok(/carrying/i.test(s1.head), 'and the pane is headed by the question', s1.head.trim());
ok(s1.cards.length >= 3, 'it names the people first', s1.cards);
ok(s1.on === 0, 'nothing is chosen yet');
ok(s1.fields.length === 0, 'and it asks nothing until something is');
ok(s1.act.trim() === 'Send it out', 'the move is the accent', s1.act.trim());
ok(s1.off, 'and it is dead until the question is answered');
ok(s1.accents === 1, 'exactly one accent on the screen', s1.accents);
ok(/not packed|packed/i.test(s1.note), 'the foot says what sending it does', s1.note.trim());
await p.locator('#otDlg .ow-dlg').screenshot({path: here + 'appNow.png'});

/* 2 — one of ours needs nothing more, so the move goes live at once. */
await p.evaluate(()=>{ document.querySelector('#otDlg .ow-ld-o[data-pick^="staff:"]').click(); });
await p.waitForTimeout(200);
const s2 = await p.evaluate(()=> ({
  on: [...document.querySelectorAll('#otDlg .ow-ld-o.ow-on')].map(e=> e.dataset.pick),
  fields: [...document.querySelectorAll('#otDlg [data-car]:not([type=hidden])')].map(e=> e.dataset.car),
  off: !!document.querySelector('#otDlg .ow-dlg-f .btn-accent[disabled]'),
}));
ok(s2.on.length === 1 && s2.on[0].indexOf('staff:') === 0, 'picking one of ours marks that card', s2.on);
ok(s2.fields.length === 0, 'and asks nothing further');
ok(!s2.off, 'the move is live');
await p.locator('#otDlg .ow-dlg').screenshot({path: here + 'appOurs.png'});

/* 3 — hired transport asks its three, and goes dead until they are there. */
await p.evaluate(()=>{ document.querySelector('#otDlg .ow-ld-o[data-pick="hired"]').click(); });
await p.waitForTimeout(200);
const s3 = await p.evaluate(()=> ({
  fields: [...document.querySelectorAll('#otDlg [data-car]:not([type=hidden])')].map(e=> e.dataset.car),
  off: !!document.querySelector('#otDlg .ow-dlg-f .btn-accent[disabled]'),
}));
ok(JSON.stringify(s3.fields) === '["name","what","phone"]', 'hired transport asks driver, vehicle, phone', s3.fields);
ok(s3.off, 'and the move is dead again');

/* 4 — typing survives the redraw a re-pick causes. */
await p.fill('#otDlg [data-car="name"]', 'Kasule');
await p.fill('#otDlg [data-car="what"]', 'Fuso UAX 123K');
await p.evaluate(()=>{ document.querySelector('#otDlg .ow-ld-o[data-pick="client"]').click(); });
await p.waitForTimeout(150);
await p.evaluate(()=>{ document.querySelector('#otDlg .ow-ld-o[data-pick="hired"]').click(); });
await p.waitForTimeout(200);
const s4 = await p.evaluate(()=> ({
  name: (document.querySelector('#otDlg [data-car="name"]')||{}).value,
  what: (document.querySelector('#otDlg [data-car="what"]')||{}).value,
  off: !!document.querySelector('#otDlg .ow-dlg-f .btn-accent[disabled]'),
}));
ok(s4.name === 'Kasule' && s4.what === 'Fuso UAX 123K', 'what was typed survives changing the answer twice', s4);
ok(s4.off, 'still dead — the phone has not been given');
await p.fill('#otDlg [data-car="phone"]', '0700 123 456');
await p.waitForTimeout(150);
ok(!(await p.evaluate(()=> !!document.querySelector('#otDlg .ow-dlg-f .btn-accent[disabled]'))),
  'the act answers the typing itself, without anything being pressed');
await p.evaluate(()=>{ otDlgDraw(); });
await p.waitForTimeout(200);
const s4b = await p.evaluate(()=> ({
  vals: ['name','what','phone'].map(k=> (document.querySelector(`#otDlg [data-car="${k}"]`)||{}).value),
  off: !!document.querySelector('#otDlg .ow-dlg-f .btn-accent[disabled]'),
}));
ok(JSON.stringify(s4b.vals) === '["Kasule","Fuso UAX 123K","0700 123 456"]' && !s4b.off,
  'and a redraw from anywhere finds all three still there', s4b);
await p.locator('#otDlg .ow-dlg').screenshot({path: here + 'appHired.png'});

/* 5 — pressing it moves the order and writes who has it. */
await p.evaluate(()=>{ document.querySelector('#otDlg .ow-dlg-f .btn-accent').click(); });
await p.waitForTimeout(400);
const s5 = await p.evaluate(()=>{ const q = data.savedQuotes.find(x=> x.id === 364);
  return { status: q.status, carrier: q.carrier, picked: q.pickingStatus, open: !!document.querySelector('#otDlg') }; });
ok(s5.status === 'pending_delivery', 'the order is out for delivery', s5.status);
ok(s5.carrier && s5.carrier.name === 'Kasule' && s5.carrier.phone === '0700 123 456', 'with who is carrying it on the record', s5.carrier);
ok(s5.picked === 'done', 'and the pick is closed behind it', s5.picked);

/* 6 — reopened, the pane is the answer. */
await p.evaluate(()=> openOrderPreview(364));
await p.waitForTimeout(250);
const s6 = await p.evaluate(()=> ({
  gone: !!document.querySelector('#otDlg .ow-ld-gone'),
  who: (document.querySelector('#otDlg .ow-ld-gone-n')||{}).textContent || '',
  sub: (document.querySelector('#otDlg .ow-ld-gone-s')||{}).textContent || '',
  act: (document.querySelector('#otDlg .ow-dlg-f .btn-accent')||{}).textContent || '',
  ghosts: [...document.querySelectorAll('#otDlg .ow-ld-gone .btn')].map(e=> e.textContent.trim()),
  accents: document.querySelectorAll('#otDlg .btn-accent').length,
}));
ok(s6.gone, 'the pane becomes the answer');
ok(/Kasule/.test(s6.who), 'naming who has it', s6.who.trim());
ok(/0700/.test(s6.sub), 'and how to reach them', s6.sub.trim());
ok(s6.act.trim() === 'Delivered', 'the accent moves on to the next real move', s6.act.trim());
ok(s6.ghosts.some(t=> /Somebody else/.test(t)), 'with a quiet way to correct it', s6.ghosts);
ok(s6.accents === 1, 'still exactly one accent', s6.accents);
await p.locator('#otDlg .ow-dlg').screenshot({path: here + 'appGone.png'});

/* 7 — "Somebody else" goes back to the question, on an order already out. */
await p.evaluate(()=>{ [...document.querySelectorAll('#otDlg .ow-ld-gone .btn')].find(e=> /Somebody else/.test(e.textContent)).click(); });
await p.waitForTimeout(250);
const s7 = await p.evaluate(()=> ({
  pane: !!document.querySelector('#otDlg .ow-ld[data-load]'),
  act: (document.querySelector('#otDlg .ow-dlg-f .btn-accent')||{}).textContent || '',
}));
ok(s7.pane, 'it reopens the question');
ok(s7.act.trim() === 'That is who has it', 'and the move says what it now does', s7.act.trim());

/* 8 — the phone design draws the same pane, not a reflow of this one. */
await p.setViewportSize({width: 390, height: 844});
await p.waitForTimeout(300);
const s8 = await p.evaluate(()=>{ const g = document.querySelector('#otDlg .ow-ld-g');
  const cs = g ? getComputedStyle(g) : null;
  const d = document.querySelector('#otDlg .ow-dlg');
  return { cols: cs ? cs.gridTemplateColumns.split(' ').length : 0,
    over: d ? d.getBoundingClientRect().width > window.innerWidth + 1 : false,
    scroll: document.documentElement.scrollWidth > window.innerWidth + 1 }; });
ok(s8.cols === 1, 'on a phone the choices stack into one column', s8.cols);
ok(!s8.over && !s8.scroll, 'and nothing runs off the side', s8);
await p.locator('#otDlg .ow-dlg').screenshot({path: here + 'appPhone.png'});

console.log(errs.length ? 'PAGE ERRORS: ' + errs.slice(0,3).join(' | ') : 'no page errors');
console.log(bad ? bad + ' FAILED' : 'all send-out flow checks passed.');
await b.close();
process.exit(bad ? 1 : 0);
