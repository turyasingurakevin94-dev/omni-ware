'use strict';
const assert = require('assert');
const { read } = require('./_extract');
const src = read('index.html');
const start = src.indexOf('/* ================= FASTENER GUIDE');
const end = src.indexOf('let fgResizeT =', start);
assert(start > 0 && end > start, 'extract the actual guide, before DOM listeners');
const g = new Function('esc', src.slice(start, end) + `
  return {fgWB,METRIC_BOLTS,SCREW_GAUGES,FG_BOLT_LENGTHS,FG_SCREW_LENGTHS,
    fgStudioBolt,fgDrawScrew,fgStudioScene,fgThread,fgWBControlsHTML,fgAdoptCard,fgRouteQuery};`
)(s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
function valid(svg) {
  assert(!/NaN|Infinity|undefined/.test(svg), 'all SVG coordinates are finite');
  assert(!/(?:width|height|rx|ry)="-/.test(svg), 'no negative SVG extents');
  const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(ids.length, new Set(ids).size, 'gradient and clip IDs are unique');
  for(const [,id] of svg.matchAll(/url\(#([^)]+)\)/g)) assert(ids.includes(id), 'paint or clip target exists: '+id);
}
let scenes = 0;
for(const row of g.METRIC_BOLTS) {
  for(const length of g.FG_BOLT_LENGTHS) {
    for(const std of ['iso','din']) {
      const b = g.fgStudioBolt(row,length,2,'test','zinc',std);
      assert(Math.abs((b.w-b.headW)/2-length)<1e-9, 'bolt tip ends at the selected under-head length');
      valid(b.svg);
    }
  }
  Object.assign(g.fgWB,{kind:'bolt',bolt:row.size,boltLen:75,withNut:true,withWasher:true});
  for(const std of ['iso','din']) for(const view of ['assembly','dimensions']) for(const W of [300,540,920]) {
    Object.assign(g.fgWB,{std,view});
    const svg=g.fgStudioScene(W,420);valid(svg);scenes++;
    assert(svg.includes(`${std==='iso'?row.afIso:row.afDin} mm ${std.toUpperCase()}`), 'spanner follows selected standard');
    assert(svg.includes('Flat washer')&&svg.includes(`${row.size} nut`), 'companions survive narrow viewports');
  }
}
for(const row of g.SCREW_GAUGES) {
  for(const head of ['csk','pan','truss']) {
    for(const length of g.FG_SCREW_LENGTHS) {
      const screw=g.fgDrawScrew(row,length,3,'test',head,'gold');valid(screw.svg);
      assert(Math.abs((screw.w-(head==='csk'?0:screw.headW))/3-length)<1e-9, 'screw datum follows head profile');
    }
    Object.assign(g.fgWB,{kind:'screw',gauge:row.gauge,screwLen:50,head,withPlug:true});
    for(const view of ['assembly','dimensions']) for(const W of [300,540,920]) {
      g.fgWB.view=view;const svg=g.fgStudioScene(W,420);valid(svg);scenes++;
      if(view==='dimensions') assert(svg.includes(head==='csk'?'including the head':'under the head'));
      assert(svg.includes('Masonry bit')&&svg.includes('Wall plug'));
    }
  }
}
Object.assign(g.fgWB,{kind:'bolt',bolt:'M10',withWasher:false,withNut:false});
let svg=g.fgStudioScene(300,420);
assert(!svg.includes('Flat washer')&&!svg.includes('M10 nut'), 'companion toggles remove the relevant part');
Object.assign(g.fgWB,{kind:'screw',withPlug:false});
svg=g.fgStudioScene(300,420);
assert(!svg.includes('Masonry bit')&&!svg.includes('Wall plug'));
g.fgAdoptCard(g.fgRouteQuery('M8x63')[0]);
assert.equal(g.fgWB.boltLen,63);
assert(/data-fg-len="63" aria-pressed="true"/.test(g.fgWBControlsHTML()), 'typed custom length remains visible and selected');
// Absurdly long input must not create millions of invisible thread paths.
const dense=g.fgThread(0,700,10,7,.00001,'bounded');
assert(dense.length<350000, 'thread work is bounded by rendered resolution');
valid('<defs><linearGradient id="cylbounded"/></defs>'+dense);
// Every token the new CSS uses is actually defined in this app.
const studioCss=src.slice(src.indexOf('/* Fastener studio:'),src.indexOf('/* ---------------- Sourcing funnel'));
for(const [,token] of studioCss.matchAll(/var\((--[\w-]+)/g)) assert(src.includes(token+':'), 'defined design token '+token);
assert(!/data-fg-life/.test(src.slice(src.indexOf('function fgRenderWorkbench(){'),src.indexOf('/* What the search found'))), 'no uncalibrated life-size claim');
console.log(`Fastener studio: ${scenes} responsive scenes, all sizes, geometry, controls and SVG integrity passed.`);
