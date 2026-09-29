#!/usr/bin/env node
'use strict';
/* The Together lens joins documents for display without merging their records. */
const assert = require('assert');
const {read, extractFunction} = require('./_extract');
const src = read('index.html');
const renderer = extractFunction(src,'renderInvoicesUnified','index.html');
/* The insights and the two panels read the same facts the list does,
   and live beside the renderer as functions of their own. */
const helpers = ['invUDays','invULastPaid','invUInsightsHTML','invUPanelsHTML','invSupHue','invSalesStatus','invTermsOf','invDayMon']
  .map(n=>extractFunction(src,n,'index.html')).join('\n');
const route = extractFunction(src,'invRenderSide','index.html');
const sales = extractFunction(src,'renderInvoices','index.html');
const buys = extractFunction(src,'renderPurchaseInvoices','index.html');

assert.match(src,/data-side="paired">Together/);
assert.match(route,/renderInvoicesUnified\(invSearchValue\(\)\)/);
assert.match(sales,/invRangedInvoices\(filter\)/);
assert.match(buys,/purchaseInvoices/);
assert.match(src,/id="inv_register_pan"/);
assert.match(src,/id="inv_buys_pane"/);
assert.doesNotMatch(renderer,/\bKept\b|Left after bills/);

const wrap = {innerHTML:'',querySelectorAll:()=>[]};
const strip = {innerHTML:''};
const attention = {innerHTML:'',querySelectorAll:()=>[]};
const panels = {innerHTML:'',querySelectorAll:()=>[]};
const count = {textContent:''};
const elements = {
  invPairSalesWrap:wrap, inv_u_insights:strip, inv_u_attention:attention, inv_u_panels:panels, inv_pair_in_n:count,
  inv_doc_hide_voided:{checked:true},
};
const data = {
  savedQuotes:[
    {id:1,status:'completed',invoiced:true,invoicedAt:'2026-09-18',client:{name:'Ada'},items:[{productName:'Lamp'}],total:690000,amountPaid:100000},
    {id:2,status:'completed',invoiced:true,invoicedAt:'2026-08-01',client:{name:'Ben'},items:[],total:500000,amountPaid:0},
  ],
  purchaseInvoices:[
    {id:1,quoteId:1,date:'2026-09-20',dueDate:'2026-09-23',supplierName:'North',items:[],total:660000,amountPaid:160000},
    {id:2,quoteId:null,date:'2026-09-20',supplierName:'Stock House',items:[],total:420000,amountPaid:100000},
    {id:3,quoteId:2,date:'2026-09-21',supplierName:'West',items:[],total:300000,amountPaid:0},
  ],
};
const names = [
  'document','data','invDocGetDateRange','searchTokens','matchesAllTokens','invoiceNumberLabel',
  'purchaseInvoiceNumberLabel','savedQuoteTotal','purchaseInvoiceTotal','purchaseInvoiceBalanceDue',
  'listPageSlice','listMoreButtonHTML','esc','invBillChip','invStatusChip','invBindDocActions',
  'invSyncStickyOffset','invSearchValue','revealPurchaseInvoice','openPiPaymentModal',
  'purchaseInvoiceFindings','todayISO','quoteItemSellPrice','orderLineIsBoughtIn','nameInitials',
  'fmtShortDate','invoiceOpenDays','openPiDocPopup','goToTab','toast',
];
const values = [
  {getElementById:id=>elements[id]||null},data,
  ()=>({from:'2026-09-01',to:'2026-09-30'}),
  s=>s.toLowerCase().trim().split(/\s+/).filter(Boolean),
  (hay,tokens)=>tokens.every(t=>hay.includes(t)),
  q=>`INV-${q.id}`,pi=>`PINV-${pi.id}`,
  q=>q.total,pi=>pi.total,pi=>pi.total-pi.amountPaid,
  (_key,rows)=>rows,()=>'',s=>String(s),()=>'',()=>'',()=>{},()=>{},()=>'',()=>{},()=>{},
  bills=>({count:bills.length, ids:new Map(bills.map(b=>[b.id,{kind:'warn'}]))}),()=> '2026-09-24',
  it=>Number(it.sellPrice)||0, it=>!!(it && it.supplierId && it.supplierId!=='__stock__'),
  n=>String(n||'?').slice(0,1).toUpperCase(),
  d=>String(d),
  ()=>null, ()=>{}, ()=>{}, ()=>{},
];
const lens = new Function(...names,`let invUnifiedOpenKey='s1'; let invUnifiedShow='all'; let invUnifiedMore=0; let invLastRows=[]; ${helpers}; ${renderer};
  return {render:renderInvoicesUnified, show:k=>{ invUnifiedShow = k; }};`)(...values);
const render = lens.render;

render('PINV-1');
assert.match(wrap.innerHTML,/INV-1/,'a bill-number search finds its parent sale');
assert.match(wrap.innerHTML,/PINV-1/,'the matching bill appears inside that sale');
assert.match(wrap.innerHTML,/inv-u-flow/,'the expanded sale displays the document relationship');
assert.doesNotMatch(wrap.innerHTML,/PINV-2/,'unrelated stock purchases stay out of a specific search');
/* THE STRIP'S THREE TOTALS WERE THE REGISTERS' OWN -- to collect, to
   pay, and the cash between -- said a third time. What replaced them is
   what only the pair can say, and the cash position survives as the Held
   and Fronted cards: sale 1 took 100,000 in and paid 160,000 out on its
   bill, so the shop has fronted 60,000 on one sale. */
assert.match(strip.innerHTML,/Fronted to suppliers<\/span><span>1 sale<\/span><\/p><p class="inv-hf-v">60,000/,'the cash position survives as the fronted card');
assert.match(strip.innerHTML,/Held for suppliers<\/span><span>0 sales/,'and nothing is held when no customer has paid ahead');
assert.match(strip.innerHTML,/Who pays first/,'the insights time both sides of the counter');
/* SHOW, AS THE OWNER DREW IT: Everything, Still to collect, Past terms,
   Cash went out first and Bills to review, each with how many and what
   they come to. "Bills due or late" left the row: when a bill falls due
   is the Purchases lens's calendar now, where it is drawn by the day.
   The sum sits in a span of its own and the long label beside a short
   one, because the phone draws the same chips as name and count only. */
assert.match(attention.innerHTML,/Still to collect <b>1<span class="inv-att-sum"> · 590,000<\/span><\/b>/,'what is still to collect is a count and a sum');
assert.match(attention.innerHTML,/Cash went out first<\/span><span class="inv-lbl-ph">Cash out first<\/span> <b>1<span class="inv-att-sum"> · −60,000<\/span><\/b>/,'paying a supplier ahead of the customer is its own filter, with the money fronted');
assert.match(attention.innerHTML,/Bills to review <b>1<\/b>/,'the existing bill findings feed the same row');
/* The owed bill is matched to its sale, under the customer it waits on,
   and the act offered is to chase the customer. */
assert.match(panels.innerHTML,/Waiting on the customer[\s\S]*PINV-1[\s\S]*INV-1[\s\S]*Chase/,'an owed bill is matched to the sale it waits on');
assert.doesNotMatch(wrap.innerHTML,/Sale less linked bills/,'an incomplete cost difference is not presented as profit');
/* THE BILL TAGS. Sale 690,000 with 100,000 in; one bill of 660,000 with
   160,000 paid. The bill is a tag in its supplier's colour, pale because
   it is still owed. */
assert.match(wrap.innerHTML,/class="inv-chips"/,'each sale carries its bills as tags');
assert.match(wrap.innerHTML,/class="inv-chip inv-sup-\d" title="PINV-1 · North · 660,000 · owed">N 660k</,'an owed bill is a pale tag naming its supplier and amount');
assert.doesNotMatch(wrap.innerHTML,/inv-chip inv-sup-\d is-paid" title="PINV-1/,'and it is not drawn as paid while money is still owed on it');
assert.match(wrap.innerHTML,/<span class="inv-u-pct">14% paid<\/span>/,'how much the customer has paid is said on the row');
/* One supplier, one colour: the row's tag and the opened line's bill
   carry the same hue class, so the eye can follow a supplier across. */
assert.match(wrap.innerHTML,/<span class="inv-u-diff"><span class="inv-u-value">30,000<\/span>/,'sale − bills has a column of its own');
assert.match(wrap.innerHTML,/inv-u-value inv-u-neg"[^>]*>−60,000</,'and cash so far goes below zero when the supplier was paid first');
assert.match(wrap.innerHTML,/inv-x-arr/,'the open sale joins each line to its bill with an arrow');
assert.match(wrap.innerHTML,/From stock<\/span>/,'a line with no supplier is named as shelf stock, not treated as costless');
assert.match(wrap.innerHTML,/on no bill/,'and its cost is said to be on no bill, not zero');
/* SHOW narrows the list and says so when nothing is left. */
lens.show('front');
render('');
assert.match(wrap.innerHTML,/INV-1</,'the fronted filter keeps the sale whose supplier was paid first');
lens.show('late');
render('');
assert.match(wrap.innerHTML,/Nothing here is past terms/,'an empty filter says so rather than showing a blank');
lens.show('all');

/* THE LIST IS SALES AND THE BILLS THEY RAISED -- the canvas's table --
   so a restock with no sale behind it is not a row here: it is a bill
   for the shelf, and the Purchases lens lists it. */
render('Stock House');
assert.doesNotMatch(wrap.innerHTML,/INV-1</);
assert.match(wrap.innerHTML,/No invoices matched/,'a search that matches only a restock says nothing here matched');

render('West');
assert.match(wrap.innerHTML,/INV-2/,'a bill dated in range brings its older linked sale into context');
assert.match(wrap.innerHTML,/PINV-3/);

console.log('Together invoice lens checks passed.');
