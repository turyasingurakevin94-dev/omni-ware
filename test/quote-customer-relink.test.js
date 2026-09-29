#!/usr/bin/env node
'use strict';
/* An order re-saved under another customer's name moves to that customer,
   debt and all. INV-0391 was saved for B110 Original, then re-saved as
   Eddy Shauriyako's: the lists showed Eddy while B110's statement and
   balance kept the sale, because the save held on to the first link. */
const assert = require('assert');
const {read, extractFunction} = require('./_extract');
const src = read('index.html');
const fns = ['relinkQuoteCustomer','applyInvoiceDebtCharge','resolveInvoiceCustomer','syncInvoiceDebtCharge','invoiceDebtDesired','invoiceBalanceDue']
  .map(n=>extractFunction(src, n, 'index.html')).join('\n');

function world(){
  const data = {customers:[
    {id:'C117', name:'B110 Original', phone:'0773909679', debt:630000, debtLog:[{type:'charge', amount:630000, quoteId:391}]},
    {id:'C955', name:'Eddy Shauriyako', phone:'0756101130', debt:0, debtLog:[]},
  ]};
  let n = 1;
  const api = new Function('data','savedQuoteTotal','invoiceNumberLabel','todayISO','allocRowId','generateCustomerId',
    `${fns}; return {relinkQuoteCustomer, syncInvoiceDebtCharge};`)(
    data, q=>q.items.reduce((s,i)=>s+i.qty*i.sellPrice,0), q=>'INV-'+String(q.id).padStart(4,'0'),
    ()=>'2026-09-29', ()=>n++, ()=>'C999');
  return {data, ...api};
}
const order = (name, cid)=>({id:391, invoiced:true, voided:false, amountPaid:0, customerId:cid, debtCharged:630000,
  client:{name, phone:''}, items:[{qty:1, sellPrice:630000}]});

{
  const w = world(); const q = order('Eddy Shauriyako', 'C117');
  w.relinkQuoteCustomer(q); w.syncInvoiceDebtCharge(q);
  assert.strictEqual(q.customerId, 'C955'); console.log('ok     - a renamed order links to the customer the name names');
  assert.strictEqual(w.data.customers[0].debt, 0); console.log('ok     - the old customer is no longer charged for it');
  assert.strictEqual(w.data.customers[1].debt, 630000); console.log('ok     - the new customer carries the debt, once');
}
{
  const w = world(); const q = order('b110 original ', 'C117');
  w.relinkQuoteCustomer(q); w.syncInvoiceDebtCharge(q);
  assert.strictEqual(q.customerId, 'C117'); assert.strictEqual(w.data.customers[0].debt, 630000);
  console.log('ok     - the same name, in another case or with a space, keeps its link and its debt');
}
{
  const w = world(); const q = order('Walk-in Wanjiku', 'C117');
  w.relinkQuoteCustomer(q); w.syncInvoiceDebtCharge(q);
  assert.strictEqual(q.customerId, 'C999'); assert.strictEqual(w.data.customers[0].debt, 0);
  console.log('ok     - a name nobody has yet becomes a new customer, and the old one is cleared');
}
console.log('\nAll quote customer relink checks passed.');
