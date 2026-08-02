'use strict';
/*
 * Shared plumbing for the tests that exercise logic living inside the app
 * files themselves.
 *
 * There is no build step in this project and the apps are single self-
 * contained HTML files, so there is nothing to `require`. These tests read
 * the real function source out of those files and evaluate it, rather than
 * keeping a second copy of the logic in the test -- a copy would drift, and
 * a passing test would then be proving nothing about shipped code.
 *
 * Everything here throws rather than returning empty on failure. A test that
 * silently skips when it can't find or parse a function is worse than no
 * test, because it reports green while checking nothing.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function read(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) throw new Error(`missing source file: ${rel}`);
  return fs.readFileSync(p, 'utf8');
}

// Brace-matches a top-level `function name(...) { ... }` out of a source
// file. Naive about braces inside strings and comments, which is fine for
// the small helpers these tests target; anything it can't match throws.
//
// The optional `async` has to be part of the match, not just tolerated
// before it: anchoring on `function` alone would slice from there and drop
// the keyword, turning an async function into one whose `await`s no longer
// parse.
function extractFunction(src, name, where) {
  const m = new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\(').exec(src);
  if (!m) throw new Error(`could not find ${name}() in ${where}`);

  // Find the brace that opens the BODY, not simply the first one after the
  // name. A TypeScript return annotation can carry braces of its own --
  // `): Promise<{ user: any; error: any }> {` -- and taking the first `{`
  // lands inside that type, so the extract ends at the type's closing brace
  // and nothing downstream can parse what comes back.
  const lparen = src.indexOf('(', m.index);
  let pdepth = 0, rparen = -1;
  for (let i = lparen; i < src.length; i++) {
    if (src[i] === '(') pdepth++;
    else if (src[i] === ')' && --pdepth === 0) { rparen = i; break; }
  }
  if (rparen < 0) throw new Error(`unbalanced parentheses in ${name}() in ${where}`);

  let angle = 0, open = -1;
  for (let i = rparen + 1; i < src.length; i++) {
    const c = src[i];
    if (c === '<') angle++;
    else if (c === '>') { if (angle > 0) angle--; }
    else if (c === '{' && angle === 0) { open = i; break; }
  }
  if (open < 0) throw new Error(`no body for ${name}() in ${where}`);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(m.index, i + 1);
  }
  throw new Error(`unbalanced braces in ${name}() in ${where}`);
}

// Pulls a top-level `const NAME = <literal>;` out of a source file, so a
// test can assert against the app's real constants instead of a hand-copied
// set that would quietly stop matching.
function extractDeclaration(src, name, where) {
  const m = new RegExp('(?:const|let|var)\\s+' + name + '\\s*=').exec(src);
  if (!m) throw new Error(`could not find declaration ${name} in ${where}`);
  let depth = 0;
  for (let i = m.index; i < src.length; i++) {
    const c = src[i];
    if (c === '{' || c === '[' || c === '(') depth++;
    else if (c === '}' || c === ']' || c === ')') depth--;
    else if (c === ';' && depth === 0) return src.slice(m.index, i + 1);
  }
  throw new Error(`unterminated declaration ${name} in ${where}`);
}

// Just enough TypeScript removal for the small numeric helpers in the edge
// functions: parameter and return annotations, and `as` casts. Deliberately
// narrow -- anything it doesn't handle makes evaluation throw, which fails
// the test loudly instead of skipping a comparison.
//
// ONLY safe on TypeScript sources, hence opt-in at every call site. Applied
// to plain JavaScript it corrupts code: the return-type pattern below also
// matches an ordinary ternary whose else-branch precedes an object literal
// (`... ) : productId;` ... `push({`), swallowing everything between and
// producing something that either won't parse or, worse, parses into
// something else. The `[^{\n]` keeps it on one line, which the annotation it
// targets always is, so a match can no longer span statements.
function stripTypes(src) {
  return src
    // Return annotation. Anchored to the brace that ends the line rather
    // than the first one seen, or a type that contains braces of its own
    // (`: Promise<{ user: any }>`) chops the signature in half and leaves
    // the remainder as a stray block.
    .replace(/\)\s*:\s*[^\n]+?\s*\{\s*$/m, ') {')
    .replace(/\(\s*([A-Za-z_$][\w$]*)\s*:\s*[^),\n]+\)\s*=>/g, '($1) =>')
    .replace(/([(,]\s*)([A-Za-z_$][\w$]*)\s*:\s*[A-Za-z_$][\w$<>\[\]|.\s]*?(?=\s*[,)])/g, '$1$2')
    .replace(/\s+as\s+[A-Za-z_$][\w$<>\[\]|.]*/g, '');
}

/*
 * Compiles a group of extracted functions into one scope, together with
 * whatever stubs they close over, and hands back the named ones.
 *
 * `env` becomes a set of live bindings the compiled code shares -- so a
 * function that reads and mutates `data` sees the same object the test
 * does, which is what lets these check state after the fact.
 */
function compileScope(sources, env, exportNames, opts) {
  const ts = !!(opts && opts.typescript);
  const envKeys = Object.keys(env || {});
  const body = [
    ...envKeys.map((k, i) => `var ${k} = __env[${i}];`),
    ...sources.map((s) => (ts ? stripTypes(s) : s)),
    `return { ${exportNames.join(', ')} };`,
  ].join('\n');
  let out;
  try {
    out = new Function('__env', body)(envKeys.map((k) => env[k]));
  } catch (e) {
    throw new Error(`could not evaluate extracted source: ${e.message}`);
  }
  for (const n of exportNames) {
    if (typeof out[n] !== 'function') throw new Error(`${n}() did not compile to a function`);
  }
  return out;
}

// Minimal TAP-ish reporting, shared so every test file looks the same.
function createReporter(title) {
  let failures = 0;
  return {
    pass(m) { console.log('ok     - ' + m); },
    fail(m) { failures++; console.error('not ok - ' + m); },
    check(cond, m) { cond ? this.pass(m) : this.fail(m); },
    done() {
      console.log(failures ? `\n${failures} check(s) failed in ${title}.` : `\nAll ${title} checks passed.`);
      return failures;
    },
    get failures() { return failures; },
  };
}

module.exports = { ROOT, read, extractFunction, extractDeclaration, stripTypes, compileScope, createReporter };
