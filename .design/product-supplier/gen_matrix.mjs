import fs from 'fs';
const SUP = [
  {id:'S001', name:'Kirinya Steel &amp; Hardware Ltd', short:'Kirinya Steel', loc:'Kampala Industrial Area'},
  {id:'S002', name:'Mukwano Building Supplies', short:'Mukwano Building', loc:'Kampala &ndash; Ben Kiwanuka St'},
  {id:'S003', name:'Nakawa Hardware Wholesalers', short:'Nakawa Hardware', loc:'Nakawa'},
  {id:'S004', name:'Bwaise Paints &amp; Fittings', short:'Bwaise Paints', loc:'Bwaise'},
];
const PROD = {
  P001:{name:'Cement (Tororo 50kg)', cat:'Cement', unit:'Bag'},
  P002:{name:'Iron Sheets (28 gauge, plain)', cat:'Roofing', unit:'Sheet'},
  P003:{name:'Steel Nails 3 inch', cat:'Nails &amp; Fasteners', unit:'Kg'},
  P004:{name:'PVC Pipe 1 inch', cat:'Plumbing', unit:'Length (3m)'},
  P005:{name:'Gloss Paint - White', cat:'Paint', unit:'Litre'},
  P006:{name:'Barbed Wire', cat:'Fencing', unit:'Roll'},
};
const PRICES = [
  ['P001','S001',38500,66],['P001','S002',37000,62],['P001','S003',39000,65],
  ['P002','S001',62000,66],['P002','S004',60500,64],
  ['P003','S002',6200,63],['P003','S003',6000,61],
  ['P004','S003',15500,65],['P004','S004',16000,65],
  ['P005','S004',11250,63],['P005','S002',11125,60],
  ['P006','S001',21000,66],
];
const n = x => x.toLocaleString('en-US');
const COLW = 178, NAMEW = 280, SPREADW = 178;

const rows = Object.keys(PROD).map(pid => {
  const qs = PRICES.filter(p=>p[0]===pid).sort((a,b)=>a[2]-b[2]);
  const lo = qs[0][2], hi = qs[qs.length-1][2];
  return {pid, qs, lo, hi, spread: hi-lo, pct: qs.length>1 ? ((hi-lo)/lo*100) : null};
}).sort((a,b)=> (b.pct ?? -1) - (a.pct ?? -1));

let out = '';
// column head
out += `      <div style="display:flex;border-bottom:1px solid #CFD5DA;background:#F7F9FB">
        <div style="width:${NAMEW}px;flex:none;padding:8px 12px" class="lbl">PRODUCT</div>\n`;
for (const s of SUP) {
  out += `        <div style="width:${COLW}px;flex:none;padding:8px 12px;border-left:1px solid #E3E7EA">
          <div class="trunc" style="font-size:12px;font-weight:600" title="${s.name}">${s.short}</div>
          <div class="cap trunc" title="${s.loc}">${s.loc}</div>
        </div>\n`;
}
out += `        <div style="width:${SPREADW}px;flex:none;padding:8px 12px;border-left:1px solid #E3E7EA;text-align:right">
          <div class="lbl">GAP TO DEAREST</div>
          <div class="cap">per ${'unit'}</div>
        </div>
      </div>\n`;

for (const r of rows) {
  const p = PROD[r.pid];
  out += `      <div style="display:flex;border-bottom:1px solid #E3E7EA;align-items:stretch">
        <div style="width:${NAMEW}px;flex:none;padding:9px 12px;min-width:0">
          <div class="trunc" style="font-size:14px;font-weight:500" title="${p.name}">${p.name}</div>
          <div class="cap">${p.cat} &middot; per ${p.unit} &middot; ${r.qs.length} of 4 quoting</div>
        </div>\n`;
  for (const s of SUP) {
    const q = r.qs.find(x=>x[1]===s.id);
    if (!q) {
      out += `        <div style="width:${COLW}px;flex:none;padding:9px 12px;border-left:1px solid #E3E7EA;background:#F7F9FB;display:flex;align-items:center;justify-content:flex-end">
          <span class="mono" style="color:#8A939C;font-size:14px">&mdash;</span>
        </div>\n`;
    } else {
      const best = q[2] === r.lo && r.qs.length > 1;
      out += `        <div style="width:${COLW}px;flex:none;padding:9px 12px 9px 10px;border-left:1px solid #E3E7EA;${best?'box-shadow:inset -2px 0 0 #1C6B58;':''}text-align:right">
          <div class="mono" style="font-size:14px;font-weight:${best?600:400}">${n(q[2])}</div>
          <div class="cap">${best?'cheapest &middot; ':''}${q[3]}d old</div>
        </div>\n`;
    }
  }
  const spreadCell = r.pct === null
    ? `<div style="font-size:12px;color:#7F1D1A;font-weight:600">no second price</div>
          <div class="cap">nothing to compare against</div>`
    : `<div class="mono" style="font-size:14px">${n(r.spread)}</div>
          <div class="cap">${r.pct.toFixed(1)}% of the cheapest</div>`;
  out += `        <div style="width:${SPREADW}px;flex:none;padding:9px 12px;border-left:1px solid #E3E7EA;text-align:right">
          ${spreadCell}
        </div>
      </div>\n`;
}
// footer
const foot = SUP.map(s => {
  const quotes = PRICES.filter(p=>p[1]===s.id).length;
  let cheapest = 0, unopposed = 0;
  for (const r of rows) if (r.qs[0][1] === s.id) { cheapest++; if (r.qs.length === 1) unopposed++; }
  return {s, quotes, cheapest, unopposed};
});
out += `      <div style="display:flex;background:#F7F9FB;border-top:1px solid #CFD5DA">
        <div style="width:${NAMEW}px;flex:none;padding:10px 12px" class="lbl">EACH SUPPLIER</div>\n`;
for (const f of foot) {
  const note = f.unopposed ? `${f.cheapest} unopposed` : `cheapest ${f.cheapest}`;
  out += `        <div style="width:${COLW}px;flex:none;padding:10px 12px;border-left:1px solid #E3E7EA;text-align:right">
          <div class="mono" style="font-size:13px">${f.quotes} of 6</div>
          <div class="cap">quoted &middot; ${note}</div>
        </div>\n`;
}
out += `        <div style="width:${SPREADW}px;flex:none;padding:10px 12px;border-left:1px solid #E3E7EA;text-align:right">
          <div class="mono" style="font-size:13px">12 of 24</div>
          <div class="cap">cells you have a price for</div>
        </div>
      </div>\n`;
fs.writeFileSync('_matrix.html', out);
console.log('rows in order:', rows.map(r=>PROD[r.pid].name.slice(0,20)+' '+(r.pct===null?'-':r.pct.toFixed(1))).join(' | '));
