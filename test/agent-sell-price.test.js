#!/usr/bin/env node
'use strict';
/*
 * What an agent charges, against the floor they pay.
 *
 * The floor is what the shop charges the AGENT for a line, at the tier
 * that line's quantity earned. Charging their client above it is the
 * agent's margin; charging below it is money out of their own pocket,
 * because they owe the shop the floor whatever they collect.
 *
 * Those two were one thing. `noMargin` was `agentSellPrice <= floorPrice`
 * and rendered "No margin set", so selling AT the floor and selling BELOW
 * it looked identical:
 *
 *   at the floor   zero margin, and a real choice -- selling at cost to
 *                  win a customer or shift a slow line.
 *   below it       a loss, in an app whose whole purpose is showing an
 *                  agent what they earn.
 *
 * The second was hidden behind the wording of the first, and the rule was
 * written out three times -- in cartLineFigures, in renderCart's markup,
 * and again in the live-typing patch. Three copies is how they drift, so
 * there is now one.
 *
 * Run: node test/agent-sell-price.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('agent sell price');
const src = read('agent.html');

const scope = compileScope([
  extractFunction(src, 'cartLineMargin', 'agent.html'),
  extractFunction(src, 'cartMarginFlagHTML', 'agent.html'),
  extractFunction(src, 'cartLineFigures', 'agent.html'),
], {
  fmtUGX: (n) => Number(n || 0).toLocaleString('en-US') + ' UGX',
  esc: (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
  ICON_WARN: '<svg data-i="warn"></svg>',
}, ['cartLineMargin', 'cartMarginFlagHTML', 'cartLineFigures']);

// Block comments as well as line ones: the note above cartLineMargin
// quotes the OLD rule and the OLD chip wording verbatim, so a structural
// check that only strips `//` ends up asserting against the prose that
// explains the fix rather than against the code.
const stripComments = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const line = (over) => Object.assign({
  productId: 'p1', name: 'Cement 50kg', qty: 50, unit: 'bag',
  displayQty: 50, displayUnit: 'bag', floorPrice: 32000, agentSellPrice: 34000,
}, over);

/* ---------- 1. the three states are three states ---------------------- */
{
  const above = scope.cartLineMargin(34000, 32000, 50);
  const at = scope.cartLineMargin(32000, 32000, 50);
  const below = scope.cartLineMargin(31000, 32000, 50);

  t.check(above.level === 'ok', 'charging above the floor is a normal line');
  t.check(at.level === 'none', 'charging exactly the floor is zero margin');
  t.check(below.level === 'loss',
    'and charging below it is a loss -- a different thing, which used to read the same');

  t.check(above.label === '', 'a line making money carries no chip');
  t.check(/No margin set/.test(at.label), 'zero margin still says so');
  t.check(/At a loss/.test(below.label) && /50,000 UGX/.test(below.label),
    `a loss says how much (${below.label}) -- 1,000 under the floor across 50`);
}

/* ---------- 2. the detail explains why it is the agent's problem ------ */
{
  const below = scope.cartLineMargin(31000, 32000, 50);
  t.check(/owe the shop 32,000 UGX/.test(below.detail),
    `it names the floor as something owed, not merely a reference price (${below.detail})`);
  t.check(/costs you 50,000 UGX/.test(below.detail), 'and what it costs them on this line');

  const at = scope.cartLineMargin(32000, 32000, 50);
  t.check(/keep nothing/.test(at.detail), 'while zero margin explains itself as keeping nothing');
  t.check(scope.cartLineMargin(34000, 32000, 50).detail === '', 'and a normal line explains nothing');
}

/* ---------- 3. the loss is per line, not per unit --------------------- */
{
  t.check(/500 UGX/.test(scope.cartLineMargin(31500, 32000, 1).label),
    'one unit, 500 under: 500');
  t.check(/50,000 UGX/.test(scope.cartLineMargin(31500, 32000, 100).label),
    'a hundred units, same 500 under: 50,000 -- the quantity is what makes it matter');
  t.check(scope.cartLineMargin(31500, 32000, 0).level === 'loss',
    'a zero-quantity line is still under the floor');
}

/* ---------- 4. one rule, and the callers use it ----------------------- */
{
  const f = scope.cartLineFigures(line({ agentSellPrice: 31000 }));
  t.check(f.margin.level === 'loss', 'cartLineFigures reports the level');
  t.check(f.noMargin === true,
    'and keeps noMargin meaning "not making money", which is what its callers want');
  t.check(scope.cartLineFigures(line({ agentSellPrice: 32000 })).noMargin === true,
    'true at the floor as well as below it');
  t.check(scope.cartLineFigures(line()).noMargin === false, 'and false on a normal line');
  t.check(f.profit === -50000, 'with the profit figure still signed, so the cart total stays honest');

  // The rule must exist in exactly one place. It was written out three
  // times before -- here, in renderCart's markup, and in the live patch.
  const code = stripComments(src);
  const inlineRule = (code.match(/<=\s*\(?Number\(item\.floorPrice\)/g) || []).length
    + (code.match(/agentSellPrice <= floorPrice/g) || []).length;
  t.check(inlineRule === 0,
    `no caller compares against the floor by hand any more (found ${inlineRule})`);
  t.check((code.match(/No margin set/g) || []).length === 1,
    'and the chip wording exists once, not once per render path');
}

/* ---------- 5. the chip ----------------------------------------------- */
{
  t.check(scope.cartMarginFlagHTML({ level: 'ok', label: '', detail: '' }) === '',
    'a line making money renders no chip at all');

  const lossChip = scope.cartMarginFlagHTML(scope.cartLineMargin(31000, 32000, 50));
  t.check(/ag-margin-flag loss/.test(lossChip), 'a loss chip is marked as such, so it can look heavier');
  t.check(/title="/.test(lossChip) && /owe the shop/.test(lossChip),
    'and carries the explanation on hover rather than spending the row on it');

  const noneChip = scope.cartMarginFlagHTML(scope.cartLineMargin(32000, 32000, 50));
  t.check(/ag-margin-flag"/.test(noneChip) && !/loss/.test(noneChip),
    'zero margin keeps the lighter chip it always had');

  // Product names reach this markup through the detail text.
  const nasty = scope.cartMarginFlagHTML({ level: 'loss', label: 'x', detail: '"><img src=x>' });
  t.check(!/<img src=x/.test(nasty) && /&quot;|&lt;img/.test(nasty),
    'the title is escaped, since it is built from figures and text rather than fixed copy');
}

/* ---------- 6. wired into all three surfaces -------------------------- */
{
  const code = stripComments(src);

  t.check(/\$\{cartMarginFlagHTML\(f\.margin\)\}/.test(code),
    'the rendered cart row uses the shared chip');
  t.check(/const rowMargin = cartLineMargin\(previewSellPrice, item\.floorPrice, baseQty\);/.test(code),
    'the live-typing patch resolves through the same helper, so typing cannot say something the commit will not');
  t.check(/input\.classList\.toggle\('below-floor', rowMargin\.level==='loss'\)/.test(code),
    'and marks the input while a loss is being typed');
  t.check(/const addedMargin = cartLineMargin\(added\.agentSellPrice, added\.floorPrice, added\.qty\);/.test(code),
    'adding a line checks it once, at the moment it can still be a surprise');
  t.check(/toast\(addedMargin\.level==='ok' \? 'Added to quote' : `Added — \$\{addedMargin\.detail\}`/.test(code),
    'folded into the existing add message rather than raised as a second toast');
}

/* ---------- 7. the client never sees any of it ------------------------ */
{
  // The client receipt is rendered from its own template. Margin, floor
  // and profit must not appear in it -- this is the agent's business.
  const client = extractFunction(src, 'renderClientReceiptTable', 'agent.html');
  t.check(!/margin|floorPrice|profit|cartMarginFlagHTML/i.test(client),
    'the client-facing receipt renders no margin, floor price or profit');
}

process.exit(t.done() ? 1 : 0);
