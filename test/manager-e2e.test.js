#!/usr/bin/env node
'use strict';
/* Runs the Manager end-to-end flows (test/e2e/manager-flows.cjs) as part of `npm test`, as store-e2e.test.js does. */
const { spawnSync } = require('child_process');
const path = require('path');
const res = spawnSync(process.execPath, [path.join(__dirname, 'e2e', 'manager-flows.cjs')], { stdio: 'inherit' });
process.exit(res.status == null ? 1 : res.status);
