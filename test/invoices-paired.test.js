#!/usr/bin/env node
'use strict';
/* The Together lens joins documents for display without merging their records. */
const assert = require('assert');
const {read, extractFunction} = require('./_extract');
const src = read('index.html');
const renderer = extractFunction(src,'renderInvoicesUnified','index.html');
/* The insights and the two panels read the same facts the list does,
   and live beside the renderer as functions of their own. */
const helpers = ['invUDays','invULastPaid','invUInsightsHTML','invUPanelsHTML']
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
  'fmtShortDate',
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
];
const lens = new Function(...names,`let invUnifiedOpenKey='s1'; let invUnifiedShow='all'; let invLastRows=[]; ${helpers}; ${renderer};
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
/* THE ATTENTION ROW'S COUNTS ARE NOW THE FILTERS they described, each
   with its number; the due date and the findings still feed them. */
assert.match(attention.innerHTML,/Bills due or late <b>1<\/b>/,'an explicit bill due date becomes a visible count');
assert.match(attention.innerHTML,/Bills to review <b>1<\/b>/,'the existing bill findings feed the same row');
/* The owed bill is matched to its sale, under the customer it waits on. */
assert.match(panels.innerHTML,/Waiting on the customer[\s\S]*PINV-1[\s\S]*INV-1/,'an owed bill is matched to the sale it waits on');
assert.doesNotMatch(wrap.innerHTML,/Sale less linked bills/,'an incomplete cost difference is not presented as profit');
/* THE BILL TAGS. Sale 690,000 with 100,000 in; one bill of 660,000 with
   160,000 paid. The bill is a tag in its supplier's colour, pale because
   it is still owed; what the customer has paid is the line under the
   figure still open. */
assert.match(wrap.innerHTML,/class="inv-chips"/,'each sale carries its bills as tags');
assert.match(wrap.innerHTML,/class="inv-chip inv-sup-\d" title="PINV-1 · North · 660,000 · owed">N 660k</,'an owed bill is a pale tag naming its supplier and amount');
assert.doesNotMatch(wrap.innerHTML,/inv-chip inv-sup-\d is-paid" title="PINV-1/,'and it is not drawn as paid while money is still owed on it');
assert.match(wrap.innerHTML,/inv-u-rcv" aria-hidden="true"><i style="width:14\.49%"/,'what the customer paid is a line under the open figure');
/* One supplier, one colour: the tag and the bill card carry the same hue
   class, so the eye can follow a supplier across. */
{
  const hue = /inv-chip (inv-sup-\d)" title="PINV-1/.exec(wrap.innerHTML)[1];
  assert.match(wrap.innerHTML,new RegExp(`class="inv-b-bill ${hue}`),'the bill card wears its supplier\'s colour');
}
assert.match(wrap.innerHTML,/30,000<\/span><span class="inv-u-sub">sale − bills/,'the difference is named as one between documents');
assert.match(wrap.innerHTML,/−60,000 fronted/,'paying a supplier ahead of the customer shows as fronted cash');
assert.match(wrap.innerHTML,/inv-b-joins/,'the open sale joins its lines to its bills');
assert.match(wrap.innerHTML,/from the shelf · no bill/,'a line with no supplier is named as shelf stock, not treated as costless');
/* SHOW narrows the list and says so when nothing is left. */
lens.show('shelf');
render('');
assert.match(wrap.innerHTML,/PINV-2/,'the shelf filter keeps the restock');
assert.doesNotMatch(wrap.innerHTML,/INV-1</,'and lets no sale through');
lens.show('stock');
render('');
assert.match(wrap.innerHTML,/Nothing here is from stock/,'an empty filter says so rather than showing a blank');
lens.show('all');

render('Stock House');
assert.match(wrap.innerHTML,/Stock purchase/,'unlinked restocks remain visible as their own rows');
assert.match(wrap.innerHTML,/PINV-2/);
assert.doesNotMatch(wrap.innerHTML,/INV-1/);

render('West');
assert.match(wrap.innerHTML,/INV-2/,'a bill dated in range brings its older linked sale into context');
assert.match(wrap.innerHTML,/PINV-3/);

console.log('Together invoice lens checks passed.');
