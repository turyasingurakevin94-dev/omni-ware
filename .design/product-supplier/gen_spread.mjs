import fs from 'fs';
const S={S001:'Kirinya',S002:'Mukwano',S003:'Nakawa',S004:'Bwaise'};
const ROWS=[
 {n:'Cement (Tororo 50kg)',u:'Bag',q:[['S002',37000],['S001',38500],['S003',39000]]},
 {n:'Steel Nails 3 inch',u:'Kg',q:[['S003',6000],['S002',6200]]},
 {n:'PVC Pipe 1 inch',u:'Length (3m)',q:[['S003',15500],['S004',16000]]},
 {n:'Iron Sheets (28 gauge, plain)',u:'Sheet',q:[['S004',60500],['S001',62000]]},
 {n:'Gloss Paint - White',u:'Litre',q:[['S002',11125],['S004',11250]]},
 {n:'Barbed Wire',u:'Roll',q:[['S001',21000]]},
];
const MAX=6, W=400, px=p=>Math.round(p/MAX*W*100)/100;
const n=x=>x.toLocaleString('en-US');
let out='';
for(const r of ROWS){
  const lo=r.q[0][1], hi=r.q[r.q.length-1][1];
  const pcts=r.q.map(([sid,v])=>({sid,v,p:(v-lo)/lo*100}));
  const maxp=pcts[pcts.length-1].p;
  const single=r.q.length===1;
  let dots='';
  if(!single) dots+=`<div style="position:absolute;left:0;top:17px;width:${px(maxp)}px;height:2px;background:#CFD5DA"></div>`;
  for(const d of pcts){
    const best=d.p===0;
    dots+=`<div title="${S[d.sid]} &middot; ${n(d.v)} per ${r.u}" style="position:absolute;left:${px(d.p)}px;top:12px;width:12px;height:12px;margin-left:-6px;border-radius:999px;background:${best?'#14171B':'#FFFFFF'};border:2px solid ${best?'#14171B':'#8A939C'};box-sizing:border-box;box-shadow:0 0 0 2px #FFFFFF"></div>`;
  }
  // direct labels: cheapest and dearest only
  dots+=`<div class="cap" style="position:absolute;left:0;top:30px;white-space:nowrap"><b style="font-weight:600;color:#14171B">${S[pcts[0].sid]}</b> <span class="mono">${n(lo)}</span></div>`;
  const right = single
   ? `<div style="font-size:12px;color:#7F1D1A;font-weight:600">no rival quote</div><div class="cap">you cannot know if this is dear</div>`
   : `<div class="mono" style="font-size:14px">${n(hi-lo)}</div><div class="cap">per ${r.u} &middot; ${maxp.toFixed(1)}% dearer at ${S[pcts[pcts.length-1].sid]}</div>`;
  out+=`        <div style="display:flex;align-items:center;border-bottom:1px solid #E3E7EA;padding:8px 12px;gap:12px">
          <div style="width:212px;flex:none;min-width:0">
            <div class="trunc" style="font-size:13px;font-weight:500" title="${r.n}">${r.n}</div>
            <div class="cap">${r.q.length} quote${r.q.length>1?'s':''}</div>
          </div>
          <div style="position:relative;width:${W}px;height:52px;flex:none">${dots}</div>
          <div style="flex:1;min-width:0;text-align:right">${right}</div>
        </div>\n`;
}
fs.writeFileSync('_spread.html',out); console.log('ok');
