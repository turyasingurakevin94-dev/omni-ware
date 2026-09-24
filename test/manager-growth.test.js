'use strict';
const assert = require('node:assert/strict');
const {read, extractFunction, compileScope} = require('./_extract');
const src = read('index.html');
assert.ok(read('api/assistant.js').includes('Preserve the standing objective. Read growth_opportunities when enabled.'), 'owner objective and evidence-based queue stay in the Manager contract');
const day = 86400000, now = Date.parse('2026-09-22T12:00:00Z');
const iso = ago=> new Date(now - ago * day).toISOString();
const names = ['targetMarginPct','managerPurchaseHistory','managerGrowthBaseline','managerGrowthOffer',
  'managerGrowthSettings','managerGrowthCandidates','managerGrowthRead','managerGrowthPhone',
  'managerProposalKey','managerInsertProposals','dashGoingQuietCustomers','customerOrdersFor'];
const invoice = (id,cid,ago,extra={})=> ({id,customerId:cid,invoiced:true,invoicedTs:now-ago*day,...extra});
function build(over={}){
  const data = {customers:[{id:1,name:'Same',phone:'0772123456'},{id:2,name:'Same',phone:'0772654321'}],
    savedQuotes:[],presetManager:{growthEnabled:true},...over.data};
  return compileScope(names.map(n=>extractFunction(src,n)), {
    data, THIN_MARGIN_PCT:10, MANAGER_OBJECTIVES:{growth:'Growth',cash:'Cash'}, currentShopId:'shop-1',
    Date, Map, Set, Math, Number, String, Array, Object, Promise,
    contactPhones:c=>c && c.phone ? [c.phone] : [], productById:id=>({id,name:'Cement'}),
    productVariantLabel:()=> 'Cement', getStockQty:()=> 20,
    briefPriceFor:()=>({price:120,cost:100,source:'shelf'}),
    stockMoveOnRowUnit:(id, variant, qty)=>({joined:true,unit:'base',qty:Number(qty)}),
    stockKey:(id, variant)=>String(id)+':'+String(variant),
    followUpClientsToContact:()=>[], followUpsForCustomer:()=>[], briefQueue:()=>[],
    followUpAlreadyBought:()=>false, followUpSubject:()=>({product:{id:'p'},variantIdx:null}),
    briefPlainLine:()=> 'They usually buy cement.', customerBookRow:c=>({id:c.id}), briefHeldBack:()=>null,
    sb:{from:()=>{const q={};['select','eq','order'].forEach(k=>q[k]=()=>q);
      q.in=async()=>({data:[]}); return q;}},
    ...over, data,
  },names);
}
(async()=>{
  const fixtures = [invoice(1,1,50),invoice(2,'1',40),invoice(3,2,10),
    invoice(4,null,1,{client:{name:'Same'}}), invoice(5,1,0,{invoiced:false}),
    invoice(6,1,1,{voided:true}),invoice(7,1,2,{cancelledAt:123}),
    invoice(8,1,1,{invoicedTs:null,createdAt:iso(1)}),invoice(9,1,-10)];
  let s=build({data:{savedQuotes:fixtures}});
  let h=s.managerPurchaseHistory(now);
  assert.equal(h.byCustomer.get('1').length,2,'quotes, voids and cancellations are not purchases');
  assert.equal(h.coverage.missingCustomer,1,'ambiguous legacy names are visible, not merged');
  assert.equal(h.coverage.missingDate,1,'save date cannot substitute for invoice date');
  assert.equal(h.coverage.futureDate,1);
  let b=s.managerGrowthBaseline(now);
  assert.equal(b.recentMatureCohort.eligible,1,'recent customers have not had 30 days yet');
  assert.equal(b.recentMatureCohort.returned,1);
  assert.equal(b.priorMatureCohort.rate,null,'empty cohorts have no rate');
  assert.equal(s.customerOrdersFor(2).length,1,'name collision cannot leak purchases');
  assert.equal(s.dashGoingQuietCustomers().length,1,'invoiced dates establish the quiet customer');
  s=build({data:{savedQuotes:[invoice(1,1,45,{createdAt:iso(50)}),{id:2,createdAt:iso(45)},
    {id:3,createdAt:iso(40),voided:true},invoice(4,2,40,{createdAt:iso(40),counterSale:true})]}});
  b=s.managerGrowthBaseline(now);
  assert.equal(b.quotes.eligible,3,'counter sales do not inflate quote conversion');
  assert.equal(b.quotes.converted,1);assert.equal(b.quotes.pending,1);assert.equal(b.quotes.cancelled,1);
  assert.equal(build().managerGrowthOffer('p',null,2).qty,2);
  assert.equal(build({getStockQty:()=>1}).managerGrowthOffer('p',null,2),null,'required quantity must be available');
  for(const px of [{price:100,cost:100},{price:90,cost:100},{price:120,cost:null},{price:120,cost:100,packCost:{}}]){
    assert.equal(build({briefPriceFor:()=>px}).managerGrowthOffer('p',null,1),null,'uncertain or non-positive margin excluded');
  }
  assert.equal(build({data:{presetTargetMarginPct:20}}).managerGrowthOffer('p',null,1),null,'shop margin floor respected');
  const news=()=>[{customerId:1,items:[{followUp:{id:8,qty:2},reasons:[{kind:'back_in_stock',text:'Cement is back.'}]},
    {followUp:{id:8,qty:2},reasons:[{kind:'back_in_stock',text:'Cement is back.'}]}]}];
  s=build({followUpClientsToContact:news});
  assert.equal(s.managerGrowthCandidates(now).length,1);
  assert.equal(s.managerGrowthCandidates(now)[0].offers.length,1,'duplicate trigger grouped once per customer');
  assert.equal(build({followUpClientsToContact:news,followUpsForCustomer:()=>[{contacts:[{at:iso(1)}]}]})
    .managerGrowthCandidates(now).length,0,'recent contact suppressed across follow-ups');
  assert.equal(build({followUpClientsToContact:news,followUpAlreadyBought:()=>true}).managerGrowthCandidates(now).length,0);
  const draft = {id:77,customerId:1,status:'draft',savedAt:iso(10),items:[
    {productId:'p',variantIdx:null,qty:12,unit:'base'},
    {productId:'p',variantIdx:null,qty:12,unit:'base'}]};
  assert.equal(build({data:{savedQuotes:[draft]}}).managerGrowthCandidates(now).length,0,
    'repeated quote lines cannot each consume the same stock');
  let queries=0;
  const db=(answer)=>({from:()=>{const q={};q.select=q.eq=()=>q;q.in=async(k,phones)=>{
    queries++;assert.equal(phones[0],'256772123456');return answer;};return q;}});
  assert.equal((await build({followUpClientsToContact:news,sb:db({data:[{opt_out:true}]})}).managerGrowthRead()).opportunities.length,0);
  assert.equal((await build({followUpClientsToContact:news,sb:db({error:{message:'offline'}})}).managerGrowthRead()).state,'contact_check_unavailable');
  assert.equal((await build({followUpClientsToContact:news,sb:db({data:[]})}).managerGrowthRead()).opportunities.length,1);
  queries=0;
  assert.equal((await build({data:{presetManager:{}},sb:db({data:[]})}).managerGrowthRead()).state,'disabled');
  assert.equal(queries,0,'disabled rollout does not read contact data');
  assert.equal(build().managerGrowthPhone('+256 772 123456'),'256772123456');
  assert.equal(build().managerGrowthPhone('123'),null);
  const inserted=[];
  const proposals=build({sb:{from:()=>{const q={};q.select=q.eq=q.order=()=>q;
    q.range=async()=>({data:[{kind:'play',body:{name:'Price the top sellers'}}]});
    q.insert=async rows=>{inserted.push(...rows);return {error:null};};return q;}}});
  await proposals.managerInsertProposals([{kind:'play',body:{name:' PRICE: the top sellers! '}},
    {kind:'play',body:{name:'Follow up'}},{kind:'play',body:{name:'follow-up'}}]);
  assert.equal(inserted.length,1,'existing and within-response pending duplicates are suppressed');
  console.log('Manager growth: all behavioral checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
