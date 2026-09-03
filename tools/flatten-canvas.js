#!/usr/bin/env node
//
// Flattens a Claude Design canvas (a folder of .dc.html artboards plus
// canvas.json) into ONE static HTML page: every artboard stacked down a
// column at a fitted scale, its canvas annotations beside it.
//
// Why this exists: the canvas viewer puts the artboards on a pan/zoom
// camera. When that camera latches, every design slides sideways as soon
// as the pointer moves and the page becomes unusable. This page has no
// camera at all — the only motion is the browser's own scrollbar.
//
//   node tools/flatten-canvas.js <src-dir> <out.html> "<Page title>"
//
const fs = require('fs');
const path = require('path');

const [srcDir, outFile, pageTitle] = process.argv.slice(2);
if (!srcDir || !outFile) {
  console.error('usage: flatten-canvas.js <src-dir> <out.html> "<title>"');
  process.exit(1);
}

const canvas = JSON.parse(fs.readFileSync(path.join(srcDir, 'canvas.json'), 'utf8'));
const artboards = canvas.artboards || [];
const annotations = canvas.annotations || [];
const pages = canvas.pages && canvas.pages.length
  ? canvas.pages
  : [{ id: null, name: '' }];

// Assets shipped alongside the artboards (canvas.json lists none, so they
// are whatever non-.dc.html, non-.json file sits in the folder). Each is
// inlined as a data URI — a static page has nowhere to serve them from.
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
               '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const assets = {};
for (const f of fs.readdirSync(srcDir)) {
  const ext = path.extname(f).toLowerCase();
  if (!MIME[ext]) continue;
  // The canvas stores these already base64-encoded; a real binary file is
  // read and encoded here. Sniffing beats trusting the extension.
  const buf = fs.readFileSync(path.join(srcDir, f));
  const head = buf.subarray(0, 16).toString('latin1');
  const b64 = /^[A-Za-z0-9+/=\s]+$/.test(head) && !/^\xff\xd8|^\x89PNG/.test(head)
    ? buf.toString('utf8').replace(/\s+/g, '')
    : buf.toString('base64');
  assets[f] = 'data:' + MIME[ext] + ';base64,' + b64;
}

// A .dc.html artboard is a whole document whose <x-dc> holds a <helmet>
// (head material) and the artboard body, and whose <head> loads the canvas
// editor's support.js. Rebuild it as a plain standalone document: helmet
// into the head, the rest into the body, support.js gone.
function toStandalone(src) {
  const dc = src.match(/<x-dc[^>]*>([\s\S]*)<\/x-dc>/);
  let inner = dc ? dc[1] : src;
  let helmet = '';
  inner = inner.replace(/<helmet[^>]*>([\s\S]*?)<\/helmet>/i, (_, h) => { helmet = h; return ''; });
  inner = inner.replace(/<script[^>]*support\.js[^>]*>\s*<\/script>/gi, '');
  for (const [name, uri] of Object.entries(assets)) {
    inner = inner.split('./' + name).join(uri).split('"' + name + '"').join('"' + uri + '"');
    helmet = helmet.split('./' + name).join(uri);
  }
  return '<!doctype html><html><head><meta charset="utf-8">' + helmet +
    '<style>html,body{margin:0;padding:0;background:#E9EBED;}</style>' +
    '</head><body>' + inner + '</body></html>';
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// Annotations carry a canvas position, not a board id. Attach each to the
// board on its page whose vertical band is nearest — that reproduces the
// reading order the canvas laid out by eye.
function annotationsFor(board, pageBoards, pageAnns) {
  return pageAnns.filter(a => {
    let best = null, bestD = Infinity;
    for (const b of pageBoards) {
      const d = Math.abs((a.y || 0) - (b.y || 0));
      if (d < bestD) { bestD = d; best = b; }
    }
    return best === board;
  });
}

const boardHtml = [];
const payloads = [];
let n = 0;

for (const pg of pages) {
  const pageBoards = artboards.filter(b => (b.page || null) === (pg.id || null));
  if (!pageBoards.length) continue;
  const pageAnns = annotations.filter(a => (a.page || null) === (pg.id || null));
  const parts = [];
  if (pg.name) parts.push('<h2 class="page-name">' + esc(pg.name) + '</h2>');
  for (const b of pageBoards) {
    const id = 'b' + (n++);
    const src = fs.readFileSync(path.join(srcDir, b.file), 'utf8');
    payloads.push([id, Buffer.from(toStandalone(src), 'utf8').toString('base64')]);
    const notes = annotationsFor(b, pageBoards, pageAnns)
      .map(a => '<div class="note">' + a.text.split(/\n\s*\n/)
        .map(p => '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>').join('') + '</div>')
      .join('');
    parts.push(
      '<section class="board-row">' +
        '<div class="board-head">' +
          '<h3>' + esc(b.title || b.file) + '</h3>' +
          '<span class="dims">' + b.w + ' × ' + b.h + '</span>' +
        '</div>' +
        '<div class="board-body">' +
          '<div class="stage"><div class="board" data-w="' + b.w + '" data-h="' + b.h + '">' +
            '<iframe id="' + id + '" title="' + esc(b.title || b.file) + '" loading="lazy"></iframe>' +
          '</div></div>' +
          (notes ? '<aside class="notes">' + notes + '</aside>' : '') +
        '</div>' +
      '</section>');
  }
  boardHtml.push('<div class="page-group">' + parts.join('') + '</div>');
}

const title = pageTitle || canvas.title || path.basename(srcDir);

const html = `<title>${esc(title)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Archivo+Black&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<style>
  :root{
    --steel-950:#14171B; --steel-800:#252A31; --steel-400:#8A939C;
    --steel-100:#DCE0E4; --steel-050:#E9EBED;
    --paper:#FFFFFF; --paper-2:#F7F9FB;
    --oxide:#B23A26;
    --ink-900:#14171B; --ink-600:#59626B; --ink-400:#8A939C;
    --rule:#CFD5DA; --rule-soft:#E3E7EA;
  }
  *{box-sizing:border-box;}
  body{
    margin:0; background:var(--steel-050); color:var(--ink-900);
    font:400 13px/1.55 Inter,-apple-system,"Segoe UI",sans-serif;
    -webkit-font-smoothing:antialiased;
  }
  .topbar{
    position:sticky; top:0; z-index:5; display:flex; align-items:center; gap:16px;
    height:54px; padding:0 24px; background:var(--steel-950); color:#fff;
  }
  .topbar h1{
    margin:0; font:400 15px/1 "Archivo Black",Inter,sans-serif;
    letter-spacing:.01em;
  }
  .topbar .sep{width:1px;height:20px;background:rgba(255,255,255,.18);}
  .topbar .count{
    font:500 11px/1 "IBM Plex Mono",ui-monospace,monospace;
    letter-spacing:.09em; text-transform:uppercase; color:var(--steel-400);
  }
  .modes{margin-left:auto;display:flex;gap:0;border:1px solid rgba(255,255,255,.22);border-radius:6px;overflow:hidden;}
  .modes button{
    appearance:none;border:0;background:transparent;color:#fff;cursor:pointer;
    font:500 11px/1 "IBM Plex Mono",ui-monospace,monospace; letter-spacing:.08em;
    text-transform:uppercase; padding:7px 12px;
  }
  .modes button[aria-pressed="true"]{background:var(--oxide);}
  .modes button:focus-visible{outline:2px solid #fff;outline-offset:-2px;}
  main{max-width:1560px;margin:0 auto;padding:28px 24px 64px;display:flex;flex-direction:column;gap:40px;}
  .lede{
    max-width:62ch; color:var(--ink-600); font-size:13px;
    border-left:2px solid var(--oxide); padding-left:14px;
  }
  .lede strong{color:var(--ink-900);font-weight:600;}
  .page-group{display:flex;flex-direction:column;gap:32px;}
  .page-name{
    margin:0; font:600 11px/1 Inter,sans-serif; letter-spacing:.12em;
    text-transform:uppercase; color:var(--ink-600);
    border-bottom:1px solid var(--rule); padding-bottom:10px;
  }
  .board-row{display:flex;flex-direction:column;gap:10px;}
  .board-head{display:flex;align-items:baseline;gap:12px;}
  .board-head h3{margin:0;font:600 14px/1.3 Inter,sans-serif;}
  .dims{
    font:400 11px/1 "IBM Plex Mono",ui-monospace,monospace;
    color:var(--ink-400); font-variant-numeric:tabular-nums;
  }
  .board-body{display:flex;gap:24px;align-items:flex-start;}
  .stage{flex:1 1 auto;min-width:0;overflow-x:auto;}
  .board{position:relative;overflow:hidden;background:var(--paper);
    border:1px solid var(--rule);}
  .board iframe{position:absolute;top:0;left:0;border:0;transform-origin:0 0;display:block;}
  .notes{
    flex:0 0 320px; background:var(--paper); border:1px solid var(--rule-soft);
    padding:16px 18px; display:flex; flex-direction:column; gap:14px;
  }
  .note p{margin:0 0 10px;color:var(--ink-600);font-size:12px;line-height:1.6;}
  .note p:first-child{
    color:var(--ink-900); font-weight:600; font-size:11px; letter-spacing:.08em;
  }
  .note p:last-child{margin-bottom:0;}
  .note + .note{border-top:1px solid var(--rule-soft);padding-top:14px;}
  body[data-mode="actual"] .notes{display:none;}
  @media (max-width:1100px){
    .board-body{flex-direction:column;}
    .notes{flex:1 1 auto;width:100%;}
  }
</style>
<div class="topbar">
  <h1>${esc(title)}</h1>
  <div class="sep"></div>
  <span class="count">${artboards.length} artboards</span>
  <div class="modes">
    <button type="button" data-mode="fit" aria-pressed="true">Fit width</button>
    <button type="button" data-mode="actual" aria-pressed="false">Actual size</button>
  </div>
</div>
<main>
  <p class="lede"><strong>A flat copy.</strong> Every artboard is here at a fitted
  scale, one under the other, with the canvas notes beside it. There is no pan
  and no zoom &mdash; nothing on this page moves under the pointer. Scroll it.</p>
  ${boardHtml.join('\n')}
</main>
<script>
  // Artboard sources travel base64-encoded: they are whole HTML documents
  // and would otherwise close the script block that carries them.
  var DOCS = ${JSON.stringify(Object.fromEntries(payloads))};
  var dec = new TextDecoder();
  for (var id in DOCS) {
    var f = document.getElementById(id);
    if (f) f.srcdoc = dec.decode(Uint8Array.from(atob(DOCS[id]), function(c){ return c.charCodeAt(0); }));
  }
  function layout(){
    var fit = document.body.dataset.mode !== 'actual';
    var boards = document.querySelectorAll('.board');
    for (var i = 0; i < boards.length; i++) {
      var b = boards[i];
      var w = +b.dataset.w, h = +b.dataset.h;
      var avail = b.parentElement.clientWidth;
      var s = fit ? Math.min(1, avail / w) : 1;
      b.style.width = Math.round(w * s) + 'px';
      b.style.height = Math.round(h * s) + 'px';
      var f = b.firstElementChild;
      f.style.width = w + 'px';
      f.style.height = h + 'px';
      f.style.transform = 'scale(' + s + ')';
    }
  }
  document.body.dataset.mode = 'fit';
  var btns = document.querySelectorAll('.modes button');
  for (var j = 0; j < btns.length; j++) {
    btns[j].addEventListener('click', function(e){
      document.body.dataset.mode = e.currentTarget.dataset.mode;
      for (var k = 0; k < btns.length; k++) {
        btns[k].setAttribute('aria-pressed', String(btns[k] === e.currentTarget));
      }
      layout();
    });
  }
  // Resize only. Nothing on this page listens to the pointer.
  addEventListener('resize', layout);
  layout();
</script>
`;

fs.writeFileSync(outFile, html);
console.log('wrote ' + outFile + ' (' + Math.round(html.length / 1024) + ' KB, ' +
  artboards.length + ' artboards)');
