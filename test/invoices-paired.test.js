#!/usr/bin/env node
'use strict';
/* The Together lens joins documents for display without merging their records. */
const assert = require('assert');
const {read, extractFunction} = require('./_extract');
const src = read('index.html');
const renderer = extractFunction(src,'renderInvoicesUnified','index.html');
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
const count = {textContent:''};
const elements = {
  invPairSalesWrap:wrap, inv_strip:strip, inv_pair_in_n:count,
  inv_doc_hide_voided:{checked:true},
};
const data = {
  savedQuotes:[
    {id:1,status:'completed',invoiced:true,invoicedAt:'2026-09-18',client:{name:'Ada'},items:[{productName:'Lamp'}],total:690000,amountPaid:0},
    {id:2,status:'completed',invoiced:true,invoicedAt:'2026-08-01',client:{name:'Ben'},items:[],total:500000,amountPaid:0},
  ],
  purchaseInvoices:[
    {id:1,quoteId:1,date:'2026-09-20',supplierName:'North',items:[],total:660000,amountPaid:0},
    {id:2,quoteId:null,date:'2026-09-20',supplierName:'Stock House',items:[],total:420000,amountPaid:100000},
    {id:3,quoteId:2,date:'2026-09-21',supplierName:'West',items:[],total:300000,amountPaid:0},
  ],
};
const names = [
  'document','data','invDocGetDateRange','searchTokens','matchesAllTokens','invoiceNumberLabel',
  'purchaseInvoiceNumberLabel','savedQuoteTotal','purchaseInvoiceTotal','purchaseInvoiceBalanceDue',
  'listPageSlice','listMoreButtonHTML','esc','invBillChip','invStatusChip','invBindDocActions',
  'invSyncStickyOffset','invSearchValue','revealPurchaseInvoice','openPiPaymentModal',
];
const values = [
  {getElementById:id=>elements[id]||null},data,
  ()=>({from:'2026-09-01',to:'2026-09-30'}),
  s=>s.toLowerCase().trim().split(/\s+/).filter(Boolean),
  (hay,tokens)=>tokens.every(t=>hay.includes(t)),
  q=>`INV-${q.id}`,pi=>`PINV-${pi.id}`,
  q=>q.total,pi=>pi.total,pi=>pi.total-pi.amountPaid,
  (_key,rows)=>rows,()=>'',s=>String(s),()=>'',()=>'',()=>{},()=>{},()=>'',()=>{},()=>{},
];
const render = new Function(...names,`let invUnifiedOpenKey=null; let invLastRows=[]; ${renderer}; return renderInvoicesUnified;`)(...values);

render('PINV-1');
assert.match(wrap.innerHTML,/INV-1/,'a bill-number search finds its parent sale');
assert.match(wrap.innerHTML,/PINV-1/,'the matching bill appears inside that sale');
assert.doesNotMatch(wrap.innerHTML,/PINV-2/,'unrelated stock purchases stay out of a specific search');
assert.match(strip.innerHTML,/690,000/,'collection total follows shown sales');
assert.match(strip.innerHTML,/660,000/,'payment total follows shown bills');

render('Stock House');
assert.match(wrap.innerHTML,/Stock purchase/,'unlinked restocks remain visible as their own rows');
assert.match(wrap.innerHTML,/PINV-2/);
assert.doesNotMatch(wrap.innerHTML,/INV-1/);

render('West');
assert.match(wrap.innerHTML,/INV-2/,'a bill dated in range brings its older linked sale into context');
assert.match(wrap.innerHTML,/PINV-3/);

console.log('Together invoice lens checks passed.');
