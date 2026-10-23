#!/usr/bin/env node
'use strict';
/*
 * Audit round 7, premium UI at 360px (store.html only; docs/audit/store/ROUND-7.md).
 *
 *   STO-UI-01 whole packs, then the rest in the line's unit: "10 dozen", "19 box", "1 ctn + 4 box"; never "0.5 ctn".
 *   STO-UI-02 every Pack line opens at what was ordered; the shelf only hints; "Pack short" is never the default.
 *   STO-UI-03 every scrolling screen ends with the bar + the play button's rise + 16px free (option A).
 *   STO-UI-04 every control on the brief's screens is at least 44 x 44.
 *   STO-UI-05 the scale: type, radius, shadow, space and colour tokens, used by the brief's screens.
 *   STO-UI-06 Today's header is one line with the status as a pill; "+N waiting" on its own line.
 *   STO-UI-07 the slip: the shop's short name on one line, names with tags, the picker in rows of 3.
 *   STO-UI-08 one picture style: a photo, else the category drawing; a broken photo falls back.
 *   STO-UI-09 On the road: "N of M stops done"; a hired driver reads "(hired)" with a square, dashed avatar.
 *
 * Run: node test/store-round7.test.js
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('audit round 7: premium UI at 360px');
const store = read('store.html');
const fn = n => { const l = store.split('\n').find(x => x.startsWith('function ' + n + '(')); return l && (l.match(/\{/g) || []).length === (l.match(/\}/g) || []).length ? l : extractFunction(store, n); };
const region = (from, to) => store.slice(store.indexOf(from), store.indexOf(to, store.indexOf(from)));

// STO-UI-01
{
  const Q = compileScope(['n0', 'unitSay', 'quoteLinePack', 'quoteLineCountPer', 'quoteLineCount', 'lineQty', 'backText', 'lineCountWords'].map(fn), {}, ['quoteLineCount', 'quoteLineCountPer', 'lineQty', 'backText', 'lineCountWords']);
  const elephant = { qty: 10, unit: 'Dozen', packQty: 20, packUnit: 'Ctn', qtyIn: 'pack' }, screws = { qty: 19, unit: 'Box', packQty: 20, packUnit: 'Ctn', qtyIn: 'pack' };
  const more = { qty: 24, unit: 'Box', packQty: 20, packUnit: 'Ctn', qtyIn: 'pack' }, two = { qty: 40, unit: 'Box', packQty: 20, packUnit: 'Ctn', qtyIn: 'pack' };
  t.check(Q.lineQty(elephant, 10).text === '10 dozen' && Q.lineQty(screws, 19).text === '19 box' && Q.lineQty(more, 24).text === '1 ctn + 4 box' && Q.lineQty(two, 40).text === '2 ctn', `whole packs, then the rest: "${Q.lineQty(more, 24).text}"`);
  t.check(JSON.stringify(Q.quoteLineCount(elephant, 10)) === '{"n":"10","unit":"dozen"}' && JSON.stringify(Q.quoteLineCount(screws, 19)) === '{"n":"19","unit":"box"}' && Q.quoteLineCountPer(elephant) === 1, '#0574 counts 10 dozen and #0566 19 box, never 0.5 or 0.95 ctn');
  t.check(JSON.stringify(Q.quoteLineCount(two, 40)) === '{"n":"2","unit":"ctn"}' && JSON.stringify(Q.quoteLineCount(two, 30)) === '{"n":"30","unit":"box"}', 'a whole line still counts in cartons; a part of one in boxes');
  t.check(Q.backText(more, 24) === '1 ctn + 4 box' && JSON.stringify(Q.lineCountWords(more, 24)) === '{"n":"1","unit":"ctn + 4 box"}', 'one formatter behind backText and the slip');
  t.check((store.match(/c = lineCountWords\(it, lineOut\(q, it\)\)/g) || []).length === 3 && /c = g < o \? quoteLineCount\(it, g\) : lineCountWords\(it, g\)/.test(store), 'Load, Hand over, the collect receipt and the delivery receipt use it');
  t.check(/`\$\{n0\(it\.packQty\)\} \$\{unitSay\(it\.unit\)\} to a \$\{unitSay\(it\.packUnit\)\}`/.test(store) && /Packed · \$\{esc\(lineQty\(cur, qty\)\.text\)\}/.test(store), 'Pack: "20 dozen to a ctn", and "Packed · 10 dozen"');
}
// STO-UI-02
t.check(/if \(PICK_ANSWERED\.includes\(it\.pickStatus\)\) return itemPicked\(it\);\n  \/\/ Every line opens at what was ordered[^\n]*\n  return qty; \}/.test(store), 'every line opens at what was ordered');
t.check(/due \? 'Count due · count as you pick' : low \? `The shelf shows \$\{lineQty\(cur, from\)\.text\} · count what you pick`/.test(store), 'the books only hint: a count due, or what the shelf shows');
// STO-UI-03
t.check(/--nav-room:calc\(130px \+ var\(--safe-area-inset-bottom\)\);/.test(store) && /#st_app\{[^}]*padding-bottom:var\(--nav-room\)\}/.test(store), 'every screen ends with the bar + the button + 16px free');
// STO-UI-04
{
  const find = region('PAGE.find = () => {', 'PAGE.find.bg');
  t.check(/<input id="fd_q"[^>]*align-self:stretch;height:100%/.test(find) && /data-act="fdclear" aria-label="Clear" style="width:44px;height:44px/.test(find) && /data-act="fdf"[^>]*height:44px/.test(find) && /data-act="fdtry"[^>]*height:44px/.test(find), 'Find: the whole box is the field; Clear, the filters and the tries are 44px');
  t.check(/<input id="rt_find"[^>]*align-self:stretch;height:100%/.test(store), 'Returns: the whole box is the field');
  t.check(/data-act="aisle" data-a="\$\{esc\(x\.aisle\.letter\)\}" style="height:44px/.test(store) && /aria-label="See \$\{esc\(aisleWord\(a\)\)\}" style="position:absolute;left:12px;top:12px;height:44px/.test(store), 'the item page\'s and Pack\'s Aisle pills are 44px');
}
// STO-UI-05
{
  const root = store.slice(store.indexOf(':root{'), store.indexOf('}', store.indexOf(':root{')));
  t.check(['--t-12:12px', '--t-14:14px', '--t-16:16px', '--t-20:20px', '--t-28:28px', '--t-40:40px', '--r-8:8px', '--r-14:14px', '--r-22:22px', '--r-pill:999px', '--sh-card:', '--sh-raised:', '--sh-sheet:', '--s-4:4px', '--s-32:32px', '--c-navy:#16203C', '--c-amber-soft:#FDEEE1'].every(k => root.includes(k)), 'the scale is declared on :root');
  const screens = ['function viewToday(', 'function viewShelf(', 'PAGE.find = ', 'PAGE.stock = ', 'PAGE.pack = ', 'PAGE.slip = ', 'PAGE.ret = ', 'PAGE.onroad = '].map(s => { const i = store.indexOf(s); return store.slice(i, store.indexOf('\nPAGE.', i + 10) > 0 ? Math.min(store.indexOf('\nPAGE.', i + 10), store.indexOf('\nfunction ', i + 10) > 0 ? store.indexOf('\nfunction ', i + 10) : 1e9) : undefined); });
  const raw = screens.map(s => (s.match(/font-size:\s*\d+px/g) || []).filter(x => !/font-size:\s*(12|14|16|20|28|40)px/.test(x))).flat();
  t.check(raw.length === 0, `the brief's screens set no font size off the scale (${raw.slice(0, 4).join(', ')})`);
  const rad = screens.map(s => (s.match(/border-radius:\s*\d+px/g) || [])).flat();
  t.check(rad.length === 0, `and no raw corner radius (${rad.slice(0, 4).join(', ')})`);
}
// STO-UI-06
t.check(/<span class="ell" style="flex:1;min-width:0" title="\$\{esc\(day \+ ' · ' \+ String\(S\.shopName \|\| ''\)\)\}">\$\{esc\(day\)\} · \$\{esc\(String\(S\.shopName \|\| 'The shop'\)\.trim\(\)\)\}<\/span>/.test(store) && /\.cv-live\{flex:none;height:24px;padding:0 8px;border-radius:var\(--r-pill\)/.test(store), 'one line that gives way, and the status as a pill');
t.check(/\$\{word\}<\/span>\$\{extra && !blank \? `<span style="font-size:[^"]*">\$\{extra\}<\/span>` : ''\}<\/span><\/button>`/.test(store), '"+N waiting" has its own line under the tile\'s word');
// STO-UI-07
{
  const S = { shopName: 'Omni-ware (old records)' };
  const sh = compileScope([fn('shopShort')], { S }, ['shopShort']);
  t.check(sh.shopShort() === 'Omni-ware' && /\$\{esc\(shopShort\(\)\.toUpperCase\(\)\)\}/.test(store), 'the receipt says "OMNI-WARE" on one line');
  const slip = region('PAGE.slip = ({ id }) => {', 'PAGE.slip.bg');
  t.check(/\$\{prodTT\(it, 'font-size:var\(--t-14\)'\)\}/.test(slip) && /repeat\(\$\{Math\.min\(3, who\.length\)\},minmax\(0,1fr\)\)/.test(slip) && /<span class="clamp2"[^>]*>\$\{esc\(w\.label\)\}/.test(slip), 'names with tags; the picker 3 to a row, names on up to 2 lines');
}
// STO-UI-08
{
  const K = compileScope([store.slice(store.indexOf('const KINDS = ['), store.indexOf('const ART = {'))], { productById: () => null }, ['kindOf']);
  t.check(K.kindOf('Silicone Clear') === 'tube' && K.kindOf('G-MAN Bow Saw') === 'tool' && K.kindOf('ELEPHANT King Short · Single Lock') === 'lock' && K.kindOf('ABC Black Screws Coarse') === 'fix' && K.kindOf('Mystery thing', 'Locks') === 'lock' && K.kindOf('Mystery thing') === 'box', 'the name, then the category, picks the drawing');
  t.check(/function imgOr\(img, style, T, svgStyle\)\{[^\n]*onerror="this\.style\.display='none';this\.nextElementSibling\.style\.display='block'"/.test(store) && (store.match(/\$\{img \? imgOr\(img,/g) || []).length === 3, 'a broken photo gives way to the drawing on every tile');
}
// STO-UI-09
{
  const road = region('PAGE.onroad = () => {', 'PAGE.onroad.bg');
  t.check(/\$\{g\.done\.length\} of \$\{order\.length\}<\/span> \$\{order\.length === 1 \? 'stop' : 'stops'\} done/.test(road) && !/stepDots\(/.test(road), 'stops done of total, not a line with one dot');
  t.check(/\(hired\)<\/span>/.test(road) && /border-radius:var\(--r-14\);background:#FDEEE1;color:#7A4A02;outline:2px dashed #F5B26B/.test(road), 'a hired driver reads "(hired)" with a square, dashed avatar');
}

t.done();
