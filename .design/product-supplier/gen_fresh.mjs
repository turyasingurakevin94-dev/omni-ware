import fs from 'fs';
const SUP=[['S001','Kirinya Steel'],['S002','Mukwano Building'],['S003','Nakawa Hardware'],['S004','Bwaise Paints']];
const PROD=[['P001','Cement (Tororo 50kg)','Bag'],['P002','Iron Sheets (28 gauge, plain)','Sheet'],
 ['P003','Steel Nails 3 inch','Kg'],['P004','PVC Pipe 1 inch','Length (3m)'],
 ['P005','Gloss Paint - White','Litre'],['P006','Barbed Wire','Roll']];
const PRICES=[['P001','S001',38500,66,'1 Jul'],['P001','S002',37000,62,'5 Jul'],['P001','S003',39000,65,'2 Jul'],
 ['P002','S001',62000,66,'1 Jul'],['P002','S004',60500,64,'3 Jul'],['P003','S002',6200,63,'4 Jul'],
 ['P003','S003',6000,61,'6 Jul'],['P004','S003',15500,65,'2 Jul'],['P004','S004',16000,65,'2 Jul'],
 ['P005','S004',11250,63,'4 Jul'],['P005','S002',11125,60,'7 Jul'],['P006','S001',21000,66,'1 Jul']];
const n=x=>x.toLocaleString('en-US');
const NW=230, CW=157;
let out=`      <div style="display:flex;border-bottom:1px solid #CFD5DA;background:#F7F9FB">
        <div style="width:${NW}px;flex:none;padding:8px 12px" class="lbl">PRODUCT</div>\n`;
for(const [,s] of SUP) out+=`        <div style="width:${CW}px;flex:none;padding:8px 12px;border-left:1px solid #E3E7EA"><div class="trunc" style="font-size:12px;font-weight:600" title="${s}">${s}</div></div>\n`;
out+=`      </div>\n`;
for(const [pid,pn,unit] of PROD){
  out+=`      <div style="display:flex;border-bottom:1px solid #E3E7EA">
        <div style="width:${NW}px;flex:none;padding:9px 12px;min-width:0">
          <div class="trunc" style="font-size:13px;font-weight:500" title="${pn}">${pn}</div>
          <div class="cap">per ${unit}</div>
        </div>\n`;
  for(const [sid] of SUP){
    const q=PRICES.find(p=>p[0]===pid&&p[1]===sid);
    if(!q){ out+=`        <div style="width:${CW}px;flex:none;padding:9px 12px;border-left:1px solid #E3E7EA;background:#F7F9FB;display:flex;align-items:center;justify-content:center">
          <span class="cap">never asked</span>
        </div>\n`; }
    else { out+=`        <div style="width:${CW}px;flex:none;padding:9px 12px;border-left:1px solid #E3E7EA;background:#F7E4E2;text-align:right">
          <div class="mono" style="font-size:15px;font-weight:600;color:#7F1D1A">${q[3]}d</div>
          <div class="cap">${q[4]} &middot; <span class="mono">${n(q[2])}</span></div>
        </div>\n`; }
  }
  out+=`      </div>\n`;
}
fs.writeFileSync('_fresh.html',out); console.log('ok');
