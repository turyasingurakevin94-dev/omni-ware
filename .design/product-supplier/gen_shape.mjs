import fs from 'fs';
const PRODS=['Cement','Iron Sheets','Nails','PVC Pipe','Paint','Barbed Wire'];
const CARDS=[
 {n:'Kirinya Steel &amp; Hardware Ltd',l:'Kampala Industrial Area',note:'Good for steel, cement',
  cells:['q','q','','','','o'], cats:'Cement &middot; Roofing &middot; Fencing', best:1, unop:true,
  read:'The steel yard. The only place quoting fencing &mdash; and never the cheapest on either product it shares.'},
 {n:'Mukwano Building Supplies',l:'Kampala &ndash; Ben Kiwanuka St',note:'Fast delivery',
  cells:['b','','q','','b',''], cats:'Cement &middot; Nails &amp; Fasteners &middot; Paint', best:2, unop:false,
  read:'The general merchant. Cheapest on cement and paint, and the freshest quotes in the book.'},
 {n:'Nakawa Hardware Wholesalers',l:'Nakawa',note:'Bulk discounts above 50 bags',
  cells:['q','','b','b','',''], cats:'Cement &middot; Nails &amp; Fasteners &middot; Plumbing', best:2, unop:false,
  read:'The wholesaler. Cheapest on the two small-unit lines &mdash; and the bulk break is not in these prices.'},
 {n:'Bwaise Paints &amp; Fittings',l:'Bwaise',note:'Paints and plumbing fittings',
  cells:['','b','','q','q',''], cats:'Roofing &middot; Plumbing &middot; Paint', best:1, unop:false,
  read:'The finishes shop. Cheapest on iron sheets, which is the one line it does not describe itself by.'},
];
const cell=(k,label)=>{
  const st = k==='b' ? 'background:#14171B;border:1px solid #14171B'
    : k==='o' ? 'background:#7F1D1A;border:1px solid #7F1D1A'
    : k==='q' ? 'background:#FFFFFF;border:1px solid #8A939C'
    : 'background:#F7F9FB;border:1px solid #E3E7EA';
  return `<div title="${label}" style="flex:1;height:26px;border-radius:4px;box-sizing:border-box;${st}"></div>`;
};
let out='';
for(const c of CARDS){
  out+=`      <div class="pan" style="padding:12px 14px;display:flex;flex-direction:column;gap:9px">
        <div style="min-width:0">
          <div class="trunc" style="font-size:14px;font-weight:600" title="${c.n}">${c.n}</div>
          <div class="cap trunc">${c.l}</div>
        </div>
        <div style="display:flex;gap:4px">${c.cells.map((k,i)=>cell(k,PRODS[i])).join('')}</div>
        <div style="display:flex;gap:4px">${PRODS.map(p=>`<div class="cap trunc" style="flex:1;font-size:11px;text-align:center" title="${p}">${p}</div>`).join('')}</div>
        <div style="display:flex;gap:14px;border-top:1px solid #E3E7EA;padding-top:8px">
          <div><div class="mono" style="font-size:16px;font-weight:600">3</div><div class="cap">of 6 quoted</div></div>
          <div><div class="mono" style="font-size:16px;font-weight:600">${c.best}</div><div class="cap">cheapest${c.unop?', unopposed':''}</div></div>
          <div style="flex:1;min-width:0"><div class="cap">THEIR NOTE IN THE BOOK</div><div class="trunc" style="font-size:12px" title="${c.note}">&ldquo;${c.note}&rdquo;</div></div>
        </div>
        <div class="cap" style="line-height:1.45">${c.read}</div>
      </div>\n`;
}
fs.writeFileSync('_shape.html',out); console.log('ok');
