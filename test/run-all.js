#!/usr/bin/env node
'use strict';
/*
 * Runs every *.test.js in this directory.
 *
 * The npm "test" script used to list the files by hand. Adding a test file
 * without also editing package.json meant it simply never ran, and the
 * suite stayed green while covering less than it appeared to -- the same
 * enumeration bug that let a third copy of applyMomoPaymentToOrder keep a
 * payment bug through a review that named two files.
 *
 * Discovery, not a list. A new test file runs the moment it exists.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const files = fs.readdirSync(dir)
  .filter(f => f.endsWith('.test.js'))
  .sort();

if (!files.length) {
  console.error('No *.test.js files found in', dir);
  process.exit(1);
}

const failed = [];
for (const f of files) {
  const res = spawnSync(process.execPath, [path.join(dir, f)], { stdio: 'inherit' });
  if (res.status !== 0) failed.push(f);
}

console.log('');
if (failed.length) {
  console.log(`${failed.length} of ${files.length} test file(s) failed: ${failed.join(', ')}`);
  process.exit(1);
}
console.log(`All ${files.length} test files passed.`);
