#!/usr/bin/env node
'use strict';
/*
 * Runs the Sales end-to-end flows (test/e2e/sales-flows.cjs) as part of `npm test`: every main
 * flow on next/sales.html?demo, from Today, by taps, at 360 × 800, with zero console errors.
 * About 35 s. Where Playwright is not installed it says it skipped, as the other browser tests do.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const res = spawnSync(process.execPath, [path.join(__dirname, 'e2e', 'sales-flows.cjs')], { stdio: 'inherit' });
process.exit(res.status == null ? 1 : res.status);
