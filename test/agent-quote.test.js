#!/usr/bin/env node
'use strict';
/*
 * The agent Quote screen.
 *
 * Two receipt tables: "Your view" and "Client view". The second one is
 * right -- it is the document the customer is shown. The first was the
 * same shape, and that is how quantity ended up as static text in a table
 * cell: to change 10 bags to 25 an agent had to remove the line and add it
 * again, re-entering the price from scratch.
 *
 * Your view is the working editor now, and quantity is a control on it.
 * Deliberately a control that reopens the add panel rather than a number
 * input, because changing how many moves the tier, and the tier sets the
 * floor price. An inline field would leave the line quoting against a floor
 * for a quantity it no longer has -- and re-resolving the ladder is exactly
 * what that panel already does.
 *
 * Run: node test/agent-quote.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('agent quote');
const src = read('agent.html');
const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

/* ---------- 1. the line states its own figures ---------------------- */
/*
 * Your view showed Qty, Particulars and Rate -- no amount. On a five-line
 * quote the agent could see the grand total and not which line made it.
 */
{
  t.check(/class="ag-qline-amount">\$\{fmtUGX\(f\.amount\)\}/.test(code),
    'each line shows what it comes to');
  t.check(/class="ag-qline-profit">\$\{fmtUGX\(f\.profit\)\} yours/.test(code),
    'and what of it is yours');
  t.check(/f\.noMargin\s*\n?\s*\?\s*`<span class="ag-margin-flag">/.test(code),
    'with the margin warning taking that slot when there is none to show');

  // cartLineFigures already computed both. They were simply not rendered.
  let f = null;
  try { ({ cartLineFigures: f } = compileScope([extractFunction(src, 'cartLineFigures', 'agent.html')], {}, ['cartLineFigures'])); }
  catch (e) { /* reported below */ }
  t.check(typeof f === 'function', 'cartLineFigures compiles');
  if (f) {
    const line = f({ qty: 10, agentSellPrice: 40000, floorPrice: 32000, displayQty: 10, displayUnit: 'bag' });
    t.check(line.amount === 400000, `amount is qty x price (${line.amount})`);
    t.check(line.profit === 80000, `profit is the margin over the floor (${line.profit})`);
    t.check(line.noMargin === false, 'and a priced line is not flagged');
    t.check(f({ qty: 5, agentSellPrice: 48000, floorPrice: 48000 }).noMargin === true,
      'while one sold at the floor is');
    t.check(f({ qty: 5, agentSellPrice: 40000, floorPrice: 48000 }).noMargin === true,
      'and so is one BELOW it, which is worse and would otherwise read the same as fine');
  }
}

/* ---------- 2. quantity is editable, through the tier ladder -------- */
{
  t.check(/<button type="button" class="ag-qline-qty" data-edit="\$\{i\}"/.test(code),
    'quantity is a control, not static text');
  t.check(/openAddItemPanel\(entry, idx\)/.test(code),
    'and it reopens the panel on that line');
  t.check(/const entry = catalogEntry\(line\.productId, line\.variantIdx\);/.test(code)
    && /if\(!entry\)\{ toast\('That product is no longer in the catalogue'\); return; \}/.test(code),
    'a line whose product has since left the catalogue says so instead of opening an empty panel');

  t.check(/async function openAddItemPanel\(item, editIndex\)/.test(code), 'the panel takes an edit index');
  t.check(/const editing = Number\.isInteger\(editIndex\) \? cart\[editIndex\] : null;/.test(code),
    'resolved against the cart, so a stale index cannot put the panel into edit mode over nothing');
  t.check(/if\(editing\) cart\[editIndex\] = line; else cart\.push\(line\);/.test(code),
    'confirming replaces the line in place rather than appending a second one');
  t.check(/\$\{editing \? 'Update this line' : 'Add to quote'\}/.test(code),
    'and the button says which it will do');
  t.check(/if\(editing\) renderCartTab\(\);/.test(code),
    'the quote redraws afterwards -- the panel is usually opened from Sell, where nothing needs redrawing');

  // The prefill.
  t.check(/qtyEl\.value = editing\.displayQty != null \? editing\.displayQty : \(Number\(editing\.qty\)\|\|1\);/.test(code),
    'it opens on the quantity the agent actually typed, in the unit they typed it in');
  t.check(/unitEl\.value = \(packQty>0 && editing\.displayUnit && editing\.displayUnit===packUnit\) \? 'pack' : 'unit';/.test(code),
    'and on the right unit, or "10 Ctn" would reopen as 10 loose pieces');
}

/* ---------- 3. the margin survives a quantity change ---------------- */
/*
 * The point of the whole feature. Going from 10 bags to 25 must not throw
 * away the 8,000/bag the agent had decided on -- but it must re-base that
 * margin on the new tier's floor, because the floor is what moved.
 */
{
  t.check(/let markupPerBase = editing\s*\n?\s*\? \(Number\(editing\.agentSellPrice\)\|\|0\) - \(Number\(editing\.floorPrice\)\|\|0\)\s*\n?\s*: null;/.test(code),
    'the margin is what gets carried, not the price');
  t.check(/const perBase = markupPerBase != null\s*\n?\s*\? Math\.max\(0, earnedRow\.unitPrice \+ markupPerBase\)\s*\n?\s*: earnedRow\.unitPrice;/.test(code),
    'and it is re-applied over whatever floor the new quantity earns');
  t.check(/markupPerBase = \(usingPack && packQty>0 \? typed\/packQty : typed\) - earnedRow\.unitPrice;/.test(code),
    'typing a new price re-states the margin, so a later quantity change carries that intent instead');

  // Adding must be untouched: no prior intent to preserve, so the tier
  // price is the right starting point.
  t.check(/markupPerBase != null/.test(code) && !/markupPerBase = 0/.test(code),
    'adding a fresh line still starts from the tier price');

  // The arithmetic, stated plainly.
  const priceFor = (floor, markup) => markup == null ? floor : Math.max(0, floor + markup);
  t.check(priceFor(32000, null) === 32000, 'adding: the field opens at the floor for that quantity');
  t.check(priceFor(32000, 8000) === 40000, 'editing: it opens at the price the agent set');
  t.check(priceFor(30000, 8000) === 38000,
    'and after moving into a cheaper tier it drops to the new floor plus the SAME margin -- not back to cost');
  t.check(priceFor(30000, -5000) === 25000, 'a line priced below the floor keeps its shape too');
  t.check(priceFor(1000, -5000) === 0, 'and can never be driven negative');
}

/* ---------- 4. typing a price patches the line it is on ------------- */
{
  t.check(/const line = input\.closest\('\.ag-qline'\);/.test(code),
    'the live patch finds the line -- it used to walk to a <tr> that no longer exists');
  t.check(/foot\.querySelector\('\.ag-qline-amount'\)\.textContent = fmtUGX\(previewSellPrice\*baseQty\)/.test(code),
    "and moves that line's own amount, not only the totals at the bottom");
  t.check(/input\.addEventListener\('change'/.test(code) && /item\.agentSellPrice = baseQty>0/.test(code),
    'while the cart itself is only written on change, once the agent has finished typing');
}

/* ---------- 5. the client's copy still carries nothing of yours ----- */
/*
 * Guarded because Your view and Client view now differ in shape as well as
 * content, and the tempting simplification is to render one from the other.
 */
{
  let receipt = '';
  try { receipt = extractFunction(src, 'renderClientReceiptTable', 'agent.html'); } catch (e) { /* reported below */ }
  t.check(receipt.length > 0, 'renderClientReceiptTable is found');
  t.check(!/profit|floorPrice|noMargin|ag-margin-flag/.test(receipt),
    'the client receipt renders no profit, no floor price and no margin warning');
  t.check(/cart\.map/.test(receipt),
    'and is built from the cart directly, never read back out of the editing view');

  // It read "Roofing sheetGauge 30". The variant is separated from the name
  // by a 6px margin-left and nothing else, so the document the customer is
  // handed ran the two together. flex-gap-spacing.test.js does not reach
  // this shape -- the value sits inside a span of its own -- so it is
  // pinned here, next to the markup it is about.
  t.check(/<\/span>\$\{it\.variantLabel \? ` <span class="ag-grid-variant">/.test(receipt),
    'the client receipt puts a real space between a product name and its variant');
  t.check(/\$\{esc\(it\.name\)\}\$\{it\.variantLabel \? ` <span class="ag-qline-variant">/.test(code),
    'and so does the editing view, where display:block hides it from the eye but not from textContent');

  let canvas = '';
  try { canvas = extractFunction(src, 'drawReceiptCanvas', 'agent.html'); } catch (e) { /* reported below */ }
  t.check(canvas.length > 0, 'drawReceiptCanvas is found');
  t.check(!/\.profit|floorPrice|noMargin/.test(canvas),
    'nor does the downloadable one -- that file leaves the phone');
}

process.exit(t.done() ? 1 : 0);
