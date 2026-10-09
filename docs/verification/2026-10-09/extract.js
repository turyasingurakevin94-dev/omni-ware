'use strict';
// Pulls a top-level function and the top-level functions it calls (transitively) out of
// index.html / shared-worker.js, using the repo's own test/_extract.js brace matcher.
const { read, extractFunction } = require('../../../test/_extract');
const SRC = { 'index.html': read('index.html'), 'shared-worker.js': read('shared-worker.js') };
const BUILTIN = new Set('if for while switch catch function return typeof Number String Boolean Array Object JSON Date Math Promise Set Map new await async parseInt parseFloat isNaN isFinite Error RegExp encodeURIComponent decodeURIComponent setTimeout clearTimeout Symbol'.split(' '));

function findFn(name) {
  for (const [file, src] of Object.entries(SRC)) {
    if (new RegExp('(?:^|\\n)\\s*(?:async\\s+)?function\\s+' + name + '\\s*\\(').test(src)) return { file, src: extractFunction(src, name, file) };
  }
  return null;
}
function closure(roots, { stop = new Set(), maxDepth = 3 } = {}) {
  const out = new Map();
  const missing = new Set();
  const walk = (name, depth) => {
    if (out.has(name) || stop.has(name) || BUILTIN.has(name)) return;
    const f = findFn(name);
    if (!f) { missing.add(name); return; }
    out.set(name, f.src);
    if (depth >= maxDepth) return;
    const body = f.src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/.*$/gm, '');
    for (const id of new Set(body.match(/(?<![.\w$])[A-Za-z_$][\w$]*(?=\s*\()/g) || [])) walk(id, depth + 1);
  };
  roots.forEach((r) => walk(r, 0));
  return { sources: [...out.values()], names: [...out.keys()], missing: [...missing] };
}
module.exports = { closure, findFn, SRC };
