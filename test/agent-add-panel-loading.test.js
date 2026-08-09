#!/usr/bin/env node
'use strict';
/*
 * The wait between tapping an item and the "add quantity and price" sheet.
 *
 * That sheet cannot be drawn until the server has said what the item
 * costs today, and openAddItemPanel used to build the whole thing only
 * AFTER that fetch came back. On a slow connection -- which is most of
 * them, on a phone, in a shop -- a tap produced nothing at all: no sheet,
 * no spinner, no dimming. Nothing on screen distinguished "fetching" from
 * "that button is broken", and the natural response to a dead button is
 * to press it again.
 *
 * So the sheet goes up first, holding a spinner, and the price fills it
 * in when it arrives. THE ORDER IS THE WHOLE FIX: appending after the
 * await is exactly the bug, and a test that only checks a spinner exists
 * somewhere in the file would pass on the broken version.
 *
 * Run: node test/agent-add-panel-loading.test.js   (or: npm test)
 */
const { read, extractFunction, createReporter } = require('./_extract');

const t = createReporter('agent add panel loading');
const src = read('agent.html');
const fn = extractFunction(src, 'openAddItemPanel', 'agent.html');

/* ---------- 1. something is on screen before the wait starts ---------- */
{
  const appendAt = fn.indexOf('document.body.appendChild(el);');
  const awaitAt = fn.indexOf('await callAgentFn(');
  t.check(appendAt > -1 && awaitAt > -1, 'the sheet is appended and the price is fetched');
  t.check(appendAt < awaitAt,
    'the sheet is on screen BEFORE the fetch begins — appending after it is the bug itself');

  const spinnerAt = fn.indexOf('ag-spinner');
  t.check(spinnerAt > -1 && spinnerAt < awaitAt,
    'and it carries a spinner while it waits, not an empty card');
  t.check(/Getting today's price/.test(fn),
    'saying what is being waited for, rather than spinning at nothing');
  /* The item's own name while loading: a sheet that says nothing about
     what was tapped cannot be told from one opened by a mis-tap. */
  t.check(fn.slice(0, awaitAt).includes('${esc(item.name)}'),
    'and names the item that was tapped, so a mis-tap is obvious immediately');
}

/* ---------- 2. it can be got out of while it is loading --------------- */
{
  const awaitAt = fn.indexOf('await callAgentFn(');
  const dismissAt = fn.indexOf("el.addEventListener('mousedown'");
  t.check(dismissAt > -1 && dismissAt < awaitAt,
    'the way out is wired before the wait — a sheet that cannot be dismissed while loading is a worse trap than the blank tap');

  /* And if they take it, the price arriving later must not shove the
     sheet back in front of somebody who has moved on. */
  t.check(/if\(!el\.parentNode\) return;/.test(fn),
    'a sheet dismissed during the wait stays dismissed when the price lands');
  t.check(fn.indexOf('if(!el.parentNode) return;') > awaitAt,
    'checked after the wait, which is the only place it could have been dismissed');
}

/* ---------- 3. one sheet, not two ------------------------------------- */
{
  t.check((fn.match(/document\.body\.appendChild\(el\)/g) || []).length === 1,
    'the sheet is appended once and then filled in, rather than appended twice');
  t.check((fn.match(/el\.className = 'ag-overlay'/g) || []).length === 1,
    'and built once, so the loading sheet and the real one are the same element');
  /* Filled in, not replaced: replacing the element would drop the
     dismiss handler wired to the first one. */
  t.check(/el\.innerHTML = `\s*\r?\n\s*<div class="ag-overlay-card">/.test(fn),
    'the real panel replaces the loading card\'s contents, keeping the element and its handler');

  // The guard against a second tap is still there behind all this.
  t.check(/if\(addPanelOpening\) return;/.test(fn) && /addPanelOpening = false;/.test(fn),
    'and the double-tap guard still opens and closes around the fetch');
}

/* ---------- 3b. the sheet is not the whole screen --------------------- */
/*
 * A gutter each side, so the sheet reads as a card lifted over the screen
 * rather than as the screen itself.
 *
 * Padding on the backdrop, not a margin on the card: the card is
 * width:100%, so a margin would push it that much past the right edge and
 * put a horizontal scrollbar on a phone.
 */
{
  t.check(/\.ag-overlay\{[^}]*padding:0 12px;[^}]*\}/.test(src),
    'the sheet has a gutter each side rather than meeting the screen edges');
  t.check(/\.ag-overlay\{[^}]*box-sizing:border-box;[^}]*\}/.test(src),
    'and the backdrop still covers the screen, the gutter coming out of it rather than off it');
  t.check(/\.ag-overlay-card\{[^}]*width:100%;/.test(src)
    && !/\.ag-overlay-card\{[^}]*margin:0 12px/.test(src),
    'the card keeps its full width inside that, rather than a margin it would overflow by');
}

/* ---------- 4. the spinner itself ------------------------------------- */
{
  t.check(/\.ag-spinner\{[^}]*animation:ag-spin/.test(src) && /@keyframes ag-spin/.test(src),
    'the spinner is styled and animated');
  /* A spinner is decoration; motion sickness is not. Left still rather
     than removed, since a stationary ring still says "not yet". */
  t.check(/@media \(prefers-reduced-motion: reduce\)\{ \.ag-spinner\{animation:none;\} \}/.test(src),
    'and stops moving for anyone who has asked for less motion, without disappearing');
}

process.exit(t.done() ? 1 : 0);
