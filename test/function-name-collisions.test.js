#!/usr/bin/env node
'use strict';
/*
 * Two functions with one name is one function, and the loser is silent.
 *
 * index.html is a single 4.8MB script. Every top-level `function f(){}`
 * in it is a property of one global object, so declaring the name twice
 * does not error, does not warn, and does not leave a trace: the LAST
 * declaration wins every call in the file, including the calls written
 * for the first one.
 *
 * That shipped. `markupRuleLabel` was declared twice -- once taking
 * (type, value, kind), once taking (rule, kind, packQty) -- and the
 * second won. So its six (type, value) callers passed a TYPE STRING as
 * `rule`; 'percent'.type is undefined; and the function returned
 * '+' + undefined + '%'. Every product card read "W +undefined%
 * R +undefined%". So did the item picker's price-rule line, the variant
 * captions, and both markup placeholders on the supplier-price form.
 * The one fact the Products screen owns that no other screen shows had
 * never once been legible on it.
 *
 * WHAT MAKES IT WORTH A TEST OF ITS OWN is how the existing tests
 * behaved. price-move.test.js exercises markupRuleLabel -- it pulls the
 * function out of index.html by name and evaluates it. extractFunction
 * takes the FIRST match. So the test read the shadowed declaration, ran
 * it, and passed, while the browser ran the other one. A green test
 * proving a function the app never calls is worse than no test: it is a
 * reason not to look.
 *
 * No assertion about any screen can catch this class. The only thing
 * that catches it is counting the names.
 *
 * Run: node test/function-name-collisions.test.js   (or: npm test)
 */
const { read, createReporter } = require('./_extract');

const t = createReporter('function name collisions');

/* Top-level declarations only: the ones that land on the global object
   and can shadow each other across the whole file. A `function` nested
   inside another body is indented, scoped, and cannot collide, so the
   anchor is column zero. Comments are stripped first -- prose about a
   function is not a declaration of one, and the note above this very
   test names two of them. */
const FILES = ['index.html', 'agent.html', 'worker.html', 'shared-worker.js'];

FILES.forEach((file) => {
  const src = read(file).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
  const seen = new Map();
  for (const m of src.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm)) {
    const line = src.slice(0, m.index).split('\n').length;
    seen.set(m[1], (seen.get(m[1]) || []).concat(line));
  }
  const clashes = [...seen].filter(([, lines]) => lines.length > 1)
    .map(([name, lines]) => `${name}() at ${lines.join(' and ')}`);

  t.check(seen.size > 0, `${file}: top-level functions are found (${seen.size})`);
  t.check(clashes.length === 0,
    `${file}: no top-level function name is declared twice${
      clashes.length ? ' — ' + clashes.join(' | ') : ''}`);
});

/* And the reason the other tests could not see it. extractFunction pulls
   a function out of the source by name and returns the first match; that
   is only sound while the name is unique, which is exactly what the
   check above guarantees. Stated here so the two are read together: if
   this file is ever deleted, every extract-based test in this directory
   silently goes back to proving whichever copy came first. */
t.check(/could not find/.test(read('test/_extract.js')),
  'extractFunction still resolves a function by name, which is what makes the check above load-bearing');

process.exit(t.done() ? 1 : 0);
