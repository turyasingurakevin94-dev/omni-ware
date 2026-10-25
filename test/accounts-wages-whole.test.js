#!/usr/bin/env node
'use strict';
/*
 * Manager round 1, MGR-DATA-10: wages are whole shillings where Accounts'
 * pay run writes them. A month's pay less the days missed (386,666.67) is
 * rounded as the due is worked out, saved and paid; 0169 rounds every cash
 * line on the server too.
 *
 * Run: node test/accounts-wages-whole.test.js   (or: npm test)
 */
const { read, createReporter, extractFunction, compileScope } = require('./_extract');

const t = createReporter('Accounts: wages in whole shillings (MGR-DATA-10)');
const html = read('accounts.html');

const { wholeDue } = compileScope([extractFunction(html, 'wholeDue', 'accounts.html')], {}, ['wholeDue']);
t.check(wholeDue(386666.6667) === 386667 && wholeDue(386666.4) === 386666, 'a due is rounded to the shilling (386,666.67 → 386,667)');
t.check(wholeDue(null) === null && wholeDue(undefined) === null, 'no pay rate stays no amount, never 0');

const dueFor = extractFunction(html, 'dueFor', 'accounts.html');
t.check(/v\.amount = s\.payRate == null \? null : wholeDue\(CB\(\)\.dueCostOf\(v\)\);/.test(dueFor), 'the month\'s due the console would raise is whole');
t.check(/d\.amount = wholeDue\(CB\(\)\.dueCostOf\(d\)\);/.test(html), 'a due changed by an absence is saved whole');
t.check(/after = wholeDue\(CB\(\)\.dueCostOf\(tmp\)\)/.test(html), 'the absence screen shows the whole amount it will save');
t.check(/amount: wholeDue\(d\.amount\), days:/.test(html) && /pay: Math\.round\(P\.bal\(d\)\)/.test(html), 'the pay run sends whole amounts to pay_dues');
t.check(!/(?<!wholeDue\()CB\(\)\.dueCostOf\(/.test(html), 'no due is written from dueCostOf unrounded');

process.exit(t.done() ? 1 : 0);
