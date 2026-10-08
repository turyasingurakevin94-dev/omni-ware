#!/usr/bin/env node
'use strict';
/*
 * Adding items, and what the agent is told while doing it.
 *
 * Every message used to be the same dark square: "Added" looked exactly
 * like "Could not submit order". Now a message looks like what it means --
 * done, heads up, or stopped -- and a send the shop refused is marked on
 * the line it refused, not only reported. Sizes are picked from rows of
 * short buttons, not a long system list, and the box on the order screen
 * is a real box: the matches appear under it.
 *
 * Run: node test/agent-adding-flow.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('agent adding flow');
const src = read('agent.html');
const fn = (n) => extractFunction(src, n, 'agent.html');

/* ---------- 1. a message looks like what it means ---------------------- */
{
  const { toastTone } = compileScope([fn('toastTone')], {}, ['toastTone']);
  for (const m of ['Could not submit order: Could not price RIDER Self Drilling Screws', "Couldn't save that just now -- try again in a moment", 'This phone cannot show notifications from the browser']) {
    t.check(toastTone(m) === 'bad', `a failure is red: "${m.slice(0, 40)}"`);
  }
  for (const m of ["You're offline — added at the last price on this phone", 'Enter a delivery address', 'Slide the red button across to send']) {
    t.check(toastTone(m) === 'warn', `a heads-up is amber: "${m.slice(0, 40)}"`);
  }
  for (const m of ['Claim submitted', 'Goal set', 'Link copied']) {
    t.check(toastTone(m) === 'good', `a success is the navy pill with a tick: "${m}"`);
  }
  const toast = fn('toast');
  t.check(/tone === 'bad' \? \(opts\.sticky \? 0 : Math\.max\(duration \|\| 0, 8000\)\)/.test(toast),
    'a failure stays long enough to read, or until closed');
  t.check(/t\.style\.bottom = `calc\(\$\{toastBottomClear\(\)\}px \+ var\(--safe-b\)\)`/.test(toast),
    'and sits just above the bottom bar, where the thumb is');
}

/* ---------- 2. a refused line is marked, and blocks the send ----------- */
{
  const submit = fn('submitOrder');
  t.check(/\(\?:Could not price\|No supplier price on file for\) \(\.\+\)\$/.test(submit),
    'both of the server\'s pricing refusals are read for the item they name');
  t.check(/blockedLines\.set\(feedItemKey\(it\.productId, it\.variantIdx\), 'The shop hasn’t priced this yet'\)/.test(submit),
    'and that item is marked in the order');
  const blocked = new Map([['P1::', 'no price']]);
  const api = compileScope([
    'let agentPaused = false, chosenClient = { id: 1 }; const cart = [{ productId: "P1", variantIdx: null }, { productId: "P2", variantIdx: null }];',
    'const feedItemKey = (p, v) => `${p}::${v==null?"":v}`;',
    fn('lineBlock'), fn('deliveryMode'), fn('sendBlocker'),
  ], { blockedLines: blocked, document: { getElementById: () => ({ checked: false, value: '' }) } }, ['sendBlocker']);
  t.check(api.sendBlocker() === 'Remove 1 red item to send', `the slider says what to do (${api.sendBlocker()})`);
  blocked.clear();
  t.check(api.sendBlocker() === null, 'and lets go once it is gone');
}

/* ---------- 3. sizes in rows ------------------------------------------ */
{
  const { variantDims } = compileScope([fn('variantDims')], {}, ['variantDims']);
  const v = (l) => ({ variantLabel: l });
  const screws = ['6* / Coarse / 3/4"', '6* / Coarse / 1"', '6* / Fine / 1"', '8* / Coarse / 3/4"', '8* / Fine / 3"'].map(v);
  const d = variantDims(screws);
  t.check(d.values.length === 3 && d.values[0].join() === '6*,8*' && d.values[1].join() === 'Coarse,Fine',
    `"6* / Coarse / 3/4"" becomes size, thread and length rows (${JSON.stringify(d.values)})`);
  t.check(d.values[2].includes('3/4"'), 'and the 3/4 in a length is not split as if it were two choices');
  const plain = variantDims(['Soft close', 'Normal'].map(v));
  t.check(plain.values.length === 1 && plain.values[0].length === 2, 'labels without parts stay one row');
  t.check(!/<select class="ax-var"/.test(fn('findTileHTML')), 'the card no longer opens the phone\'s own list');
}

/* ---------- 4. the box on the order screen is a box -------------------- */
{
  t.check(/<input type="search" id="ag_orderQ"/.test(src) && !/id="ag_openFind"/.test(src),
    'the order screen has a real search box, not a button to another screen');
  t.check(/getElementById\('ag_orderQ'\)\.addEventListener\('input'/.test(src) && /function renderOrderResults\(\)/.test(src),
    'and its matches appear right under it as it is typed');
  const usual = fn('renderUsual');
  t.check(/possessive\(firstWord\(chosenClient\.name\)\)\)\} usual/.test(usual) && /data-usual-all/.test(usual),
    'a regular gets their usual as tiles, with one button for all of it');
  t.check(/topCategories\(5\)/.test(usual) && /sellMostItems\(6\)/.test(usual),
    'someone new gets the aisles and what you sell most');
}

/* ---------- 5. it drops in -------------------------------------------- */
{
  t.check(!/toast\(`Added/.test(src) && !/usual is in — check the prices/.test(src), 'no "Added" message anywhere');
  t.check(/function dropIntoOrder\(item, from\)/.test(src) && /bumpOrderBar\(/.test(fn('dropIntoOrder')),
    'the item flies into the order bar, which swells as it lands');
  t.check(/prefers-reduced-motion: reduce/.test(fn('dropIntoOrder')), 'and only bumps when the phone asks for less motion');
  t.check(/el\.getClientRects\(\)\.length/.test(fn('dropTarget')),
    'a fixed bar is found by its box -- offsetParent is null for fixed elements, which once hid the whole effect');
}

process.exit(t.done() ? 1 : 0);
