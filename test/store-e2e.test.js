#!/usr/bin/env node
'use strict';
/*
 * Runs the Store end-to-end flows (test/e2e/store-flows.cjs) as part of `npm test`, as sales-e2e.test.js runs
 * Sales': the main flows on store.html?demo, from Today, by taps, at 360 × 800, with zero console errors,
 * and the tap counts of docs/audit/store/FLOW.md §5. About 2 minutes. Where Playwright is not installed it
 * says it skipped, as the other browser tests do.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const res = spawnSync(process.execPath, [path.join(__dirname, 'e2e', 'store-flows.cjs')], { stdio: 'inherit' });
process.exit(res.status == null ? 1 : res.status);
