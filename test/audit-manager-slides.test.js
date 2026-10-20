#!/usr/bin/env node
'use strict';
/*
 * The Manager's four decisions behind a slider could not be made.
 *
 * manager.html builds those sliders with the thing's id in the key --
 * slideHTML('credit:' + ask.id), 'void:' + ask.id, 'tripok:' + trip.id,
 * 'count:' + count.id -- and their handlers are ACT['slide:credit'],
 * ACT['slide:void'], ACT['slide:tripok'], ACT['slide:count'], which read the
 * id back off the key. The one dispatcher looked the handler up by the FULL
 * key, ACT['slide:credit:ask-cr'], found nothing, and the slide did nothing:
 * no credit note, no void, no accepted trip count, no accepted stock count,
 * and no word why. test/manager-decide.test.js called the handlers directly
 * and stayed green.
 *
 * Found by the audit's dead-code scan (the four handlers had no reference).
 * Every app's dispatcher now falls back to the key's first part, and this
 * test holds every id-bearing slider in every app to a handler that exists.
 *
 * Run: node test/audit-manager-slides.test.js
 */
const { read, createReporter } = require('./_extract');

const t = createReporter('sliders with an id in the key reach their handler');
for (const app of ['manager', 'sales', 'buyer', 'store', 'accounts']) {
  const src = read(app + '.html');
  t.check(/const k = String\(el\.dataset\.slide \|\| ''\), f = ACT\['slide:' \+ k\] \|\| ACT\['slide:' \+ k\.split\(':'\)\[0\]\]; if \(f\) f\(el\); \};/.test(src), `${app}: the dispatcher falls back to the key's first part`);
  // every slider built as slideHTML('<name>:' + id ...) has ACT['slide:<name>']
  const built = [...src.matchAll(/slideHTML\('([a-z]+):' \+ /g)].map(m => m[1]);
  const handlers = new Set([...src.matchAll(/ACT\['slide:([a-z]+)'\] = /g)].map(m => m[1]));
  const missing = [...new Set(built)].filter(n => !handlers.has(n));
  t.check(missing.length === 0, `${app}: every id-bearing slider (${[...new Set(built)].join(', ') || 'none'}) has its handler${missing.length ? ' -- missing ' + missing.join(', ') : ''}`);
}
const manager = read('manager.html');
for (const n of ['tripok', 'count', 'credit', 'void']) t.check(manager.includes(`ACT['slide:${n}'] = async`), `manager: ACT['slide:${n}'] is there`);
t.check(/ACT\['slide:count'\] = async el => \{ const id = el\.dataset\.slide\.slice\(6\);/.test(manager) && /ACT\['slide:void'\] = async el => \{\n  const askId = el\.dataset\.slide\.slice\(5\)/.test(manager), 'manager: the handlers read the id off the key, so the key must keep its suffix');

process.exit(t.done() ? 1 : 0);
