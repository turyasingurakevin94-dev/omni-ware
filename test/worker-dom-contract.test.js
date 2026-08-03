#!/usr/bin/env node
'use strict';
/*
 * shared-worker.js reaches into markup it does not own.
 *
 * Its header lists the elements the host page must provide, and both hosts
 * -- worker.html and the admin app's Worker tab -- have to keep providing
 * them. Nothing checked that, and the failure is not graceful:
 *
 *   document.getElementById('wv_enablePushBtn').addEventListener(...)
 *
 * runs at the top level of the script. A host missing that one element does
 * not lose a button; it throws while the file is still loading, and every
 * function defined below that line never gets defined. The whole app is
 * gone, in both hosts, over a renamed id in one of them.
 *
 * So the ids are derived from the source rather than listed here, and split
 * by whether the access is guarded. An unguarded one -- dereferenced on the
 * spot -- must exist in both hosts. A guarded one is a deliberate
 * difference between them and only has to parse.
 *
 * Run: node test/worker-dom-contract.test.js   (or: npm test)
 */
const { read, createReporter } = require('./_extract');

const t = createReporter('worker DOM contract');
const sharedRaw = read('shared-worker.js');
const shared = sharedRaw.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
const hosts = { 'worker.html': read('worker.html'), 'index.html': read('index.html') };

// Ids the shared file writes into the DOM itself, so no host supplies them.
const selfMade = new Set(
  [...shared.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1])
    .concat([...shared.matchAll(/\.id\s*=\s*'([^']+)'/g)].map((m) => m[1])),
);

// Unguarded == dereferenced on the spot, getElementById('x').y, with nothing
// on the same line having already established that it is there. A bare
// getElementById('x') earlier in the same expression is exactly that check --
//
//   if(... && document.getElementById('t') && document.getElementById('t').style...)
//
// -- so the dereference after it is short-circuit protected, not unguarded.
const unguarded = new Set();
const all = new Set();
shared.split('\n').forEach((line) => {
  for (const m of line.matchAll(/getElementById\('([^']+)'\)(\s*\.\s*[A-Za-z])?/g)) {
    all.add(m[1]);
    if (!m[2]) continue;
    const bareBefore = new RegExp(`getElementById\\('${m[1]}'\\)\\s*(?!\\s*\\.)`).exec(line.slice(0, m.index));
    if (!bareBefore) unguarded.add(m[1]);
  }
});

t.check(all.size >= 10, `the sweep found the element ids in use (${all.size})`);
t.check(unguarded.size >= 3, `and the ones dereferenced on the spot (${unguarded.size})`);

/* ---------- 1. every unguarded id exists in both hosts ---------------- */
{
  const missing = [];
  [...unguarded].sort().forEach((id) => {
    if (selfMade.has(id)) return;
    Object.entries(hosts).forEach(([name, src]) => {
      if (!new RegExp(`id="${id}"`).test(src)) missing.push(`#${id} in ${name}`);
    });
  });
  t.check(missing.length === 0,
    missing.length
      ? `shared-worker.js dereferences these without the host providing them: ${missing.join(', ')}`
      : `every id used unguarded is provided by both hosts (${[...unguarded].filter((i) => !selfMade.has(i)).length} checked)`);
}

/* ---------- 2. the top-level one in particular ------------------------ */
{
  // Not just present, but present in a file that has no chance to recover:
  // this runs while the script is loading, before any host code has run.
  const topLevel = [...shared.matchAll(/^document\.getElementById\('([^']+)'\)\./gm)].map((m) => m[1]);
  t.check(topLevel.length > 0, `the file has top-level element access (${topLevel.join(', ') || 'none'})`);
  const absent = topLevel.flatMap((id) =>
    Object.entries(hosts).filter(([, src]) => !new RegExp(`id="${id}"`).test(src)).map(([n]) => `#${id} in ${n}`));
  t.check(absent.length === 0,
    absent.length
      ? `a host is missing an element used at load time, which throws before anything else is defined: ${absent.join(', ')}`
      : 'and every host provides it, so the file cannot throw its way out of existence at load');
}

/* ---------- 3. guarded ids really are guarded ------------------------- */
{
  // The ones that differ between hosts on purpose. If one loses its guard
  // it moves into section 1's rules, and this is what says so.
  const guardedOnly = [...all].filter((id) => !unguarded.has(id) && !selfMade.has(id));
  const hostSpecific = guardedOnly.filter((id) =>
    Object.values(hosts).some((src) => !new RegExp(`id="${id}"`).test(src)));

  const unprotected = hostSpecific.filter((id) => {
    // Every read of it must be either null-checked or part of a && chain.
    const reads = [...shared.matchAll(new RegExp(`([^\\n]*getElementById\\('${id}'\\)[^\\n]*)`, 'g'))].map((m) => m[1]);
    return !reads.every((line) =>
      /&&\s*document\.getElementById/.test(line)
      || /(const|let)\s+\w+\s*=\s*document\.getElementById/.test(line));
  });
  t.check(unprotected.length === 0,
    unprotected.length
      ? `these exist in only one host and are read without a null check: ${unprotected.join(', ')}`
      : `ids that only one host provides are all null-checked (${hostSpecific.length}: ${hostSpecific.join(', ') || 'none'})`);
}

/* ---------- 4. the header's list has not gone stale ------------------- */
{
  // The contract is written down at the top of the file. It is the first
  // thing someone building a third host would read.
  const header = sharedRaw.slice(0, sharedRaw.indexOf('/* ---------------- Small generic utilities'));
  const undocumented = [...unguarded].filter((id) => !selfMade.has(id) && !header.includes(id));
  t.check(undocumented.length === 0,
    undocumented.length
      ? `the header comment does not mention required element(s): ${undocumented.join(', ')}`
      : 'the header comment names every element a host must provide');
}

process.exit(t.done() ? 1 : 0);
