import fs from 'fs';
const SUP=[
 {id:'S001',s:'Kirinya Steel',full:'Kirinya Steel &amp; Hardware Ltd',l:'Kampala Industrial Area'},
 {id:'S002',s:'Mukwano Building',full:'Mukwano Building Supplies',l:'Kampala &ndash; Ben Kiwanuka St'},
 {id:'S003',s:'Nakawa Hardware',full:'Nakawa Hardware Wholesalers',l:'Nakawa'},
 {id:'S004',s:'Bwaise Paints',full:'Bwaise Paints &amp; Fittings',l:'Bwaise'}];
const PROD=[{id:'P001',n:'Cement (Tororo 50kg)',c:'Cement'},{id:'P002',n:'Iron Sheets (28 gauge, plain)',c:'Roofing'},
 {id:'P003',n:'Steel Nails 3 inch',c:'Nails &amp; Fasteners'},{id:'P004',n:'PVC Pipe 1 inch',c:'Plumbing'},
 {id:'P005',n:'Gloss Paint - White',c:'Paint'},{id:'P006',n:'Barbed Wire',c:'Fencing'}];
const PRICES=[['P001','S001',38500],['P001','S002',37000],['P001','S003',39000],['P002','S001',62000],
 ['P002','S004',60500],['P003','S002',6200],['P003','S003',6000],['P004','S003',15500],['P004','S004',16000],
 ['P005','S004',11250],['P005','S002',11125],['P006','S001',21000]];
const cheapest={}; for(const p of PROD){const q=PRICES.filter(x=>x[0]===p.id).sort((a,b)=>a[2]-b[2]);
  cheapest[p.id]={sup:q[0][1], only:q.length===1};}

const SW=176, SX=16, PX=590, PW=252, SH=58, PH=52;
const sy=i=>96+i*132, py=i=>72+i*100;
const LX=SX+SW, RX=PX;
let links='';
// draw non-cheapest first so cheapest sits on top
const ordered=[...PRICES].sort((a,b)=>{
  const ac=cheapest[a[0]].sup===a[1], bc=cheapest[b[0]].sup===b[1]; return (ac?1:0)-(bc?1:0);});
for(const [pid,sid] of ordered){
  const i=SUP.findIndex(s=>s.id===sid), j=PROD.findIndex(p=>p.id===pid);
  const y1=sy(i)+SH/2, y2=py(j)+PH/2, mid=(LX+RX)/2;
  const isBest=cheapest[pid].sup===sid, only=cheapest[pid].only;
  const stroke = only ? '#7F1D1A' : (isBest ? '#14171B' : '#CFD5DA');
  const w = only ? 2.5 : (isBest ? 2 : 1);
  const dash = only ? '' : '';
  links+=`    <path d="M${LX} ${y1} C${mid} ${y1}, ${mid} ${y2}, ${RX} ${y2}" fill="none" stroke="${stroke}" stroke-width="${w}"${dash}/>\n`;
}
let boxes='';
SUP.forEach((s,i)=>{
  const n=PRICES.filter(p=>p[1]===s.id).length;
  const best=PROD.filter(p=>cheapest[p.id].sup===s.id).length;
  boxes+=`    <foreignObject x="${SX}" y="${sy(i)}" width="${SW}" height="${SH}">
      <div xmlns="http://www.w3.org/1999/xhtml" style="box-sizing:border-box;height:${SH}px;background:#FFFFFF;border:1px solid #CFD5DA;border-radius:6px;padding:8px 10px">
        <div class="trunc" style="font-size:13px;font-weight:600" title="${s.full}">${s.s}</div>
        <div class="cap trunc" title="${s.l}">${s.l}</div>
        <div class="cap mono" style="margin-top:2px">${n} quotes &middot; best on ${best}</div>
      </div>
    </foreignObject>\n`;
});
PROD.forEach((p,j)=>{
  const q=PRICES.filter(x=>x[0]===p.id);
  const only=q.length===1;
  boxes+=`    <foreignObject x="${PX}" y="${py(j)}" width="${PW}" height="${PH}">
      <div xmlns="http://www.w3.org/1999/xhtml" style="box-sizing:border-box;height:${PH}px;background:#FFFFFF;border:1px solid ${only?'#7F1D1A':'#CFD5DA'};border-radius:6px;padding:7px 10px">
        <div class="trunc" style="font-size:13px;font-weight:500" title="${p.n}">${p.n}</div>
        <div class="cap trunc">${p.c} &middot; <span class="mono">${q.length}</span> supplier${q.length>1?'s':''}${only?' &mdash; the only one':''}</div>
      </div>
    </foreignObject>\n`;
});
fs.writeFileSync('_ribbon.svg', links+boxes);
console.log('ok');
