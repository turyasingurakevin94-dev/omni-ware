#!/usr/bin/env node
'use strict';
/*
 * A background refresh redraws the screen showing. It used to do that
 * with goToTab(currentActiveTab) -- the same call the rail makes -- and
 * arriving at Customers closes whichever account is open. So an owner
 * reading a customer's account was thrown back to the book every time
 * the data refreshed underneath them.
 *
 * Run: node test/background-refresh-keeps-account.test.js   (or: npm test)
 */
const { read, createReporter } = require('./_extract');

const t = createReporter('background refresh keeps the open account');
const src = read('index.html');

t.check(/function redrawCurrentTab\(\)\{\s*tabRedrawing = true;\s*try \{ goToTab\(currentActiveTab\); \} finally \{ tabRedrawing = false; \}/.test(src),
  'a redraw of the current screen is marked as a redraw, and the mark always comes off');
t.check(/tab==='customers' && !custEntering && !tabRedrawing\)\{ custViewId = null; \}/.test(src),
  'a redraw does not close the customer that is open');
t.check(/tab==='suppliers' && !supEntering && !tabRedrawing\)\{ supViewId = null; \}/.test(src),
  'nor the supplier');
t.check(!/goToTab\(currentActiveTab\)/.test(src.replace(/function redrawCurrentTab\(\)\{[\s\S]*?\n\}/, '')),
  'nothing redraws by calling goToTab(currentActiveTab) directly any more');

t.done();
