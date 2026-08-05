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

  // A return type can also be a bare object literal -- `): { a: number }[] {`
  // -- which has no angle brackets to skip, so prefer the brace that ENDS
  // its line. Every function body in these files opens that way, while a
  // type's brace is always followed by more of the type. Falls back to the
  // first brace if nothing on the line qualifies, so an inline
  // `function f() { return 1; }` still works.
  let angle = 0, open = -1, firstBrace = -1;
  for (let i = rparen + 1; i < src.length; i++) {
    const c = src[i];
    if (c === '<') angle++;
    else if (c === '>') { if (angle > 0) angle--; }
    else if (c === '{' && angle === 0) {
      if (firstBrace < 0) firstBrace = i;
      const rest = src.slice(i + 1);
      if (/^[ \t]*\r?\n/.test(rest)) { open = i; break; }
    }
  }
  if (open < 0) open = firstBrace;
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
  // The multi-parameter rule below cannot tell `(a: number, b: number)` from
  // an object literal's `{ cost: costNum, }` -- both are "identifier colon
  // value" after a comma. Applied to a whole function it rewrote
  // `cost: costNum,` to `cost,`, which compiles and then throws at runtime
  // with `cost is not defined`. So it is confined to the signature: split at
  // the brace that opens the body, and only the head sees it.
  const bodyStart = /\)[^\n]*\{[ \t]*\r?\n/.exec(src);
  const cut = bodyStart ? bodyStart.index + bodyStart[0].length : src.length;
  const head = src.slice(0, cut)
    .replace(/([(,]\s*)([A-Za-z_$][\w$]*)\s*:\s*[A-Za-z_$][\w$<>\[\]|.\s]*?(?=\s*[,)])/g, '$1$2');

  return (head + src.slice(cut))
    // Return annotation. Anchored to the brace that ends the line rather
    // than the first one seen, or a type that contains braces of its own
    // (`: Promise<{ user: any }>`) chops the signature in half and leaves
    // the remainder as a stray block.
    .replace(/\)\s*:\s*[^\n]+?\s*\{\s*$/m, ') {')
    .replace(/\(\s*([A-Za-z_$][\w$]*)\s*:\s*[^),\n]+\)\s*=>/g, '($1) =>')
    .replace(/\s+as\s+[A-Za-z_$][\w$<>\[\]|.]*/g, '')
    // Typed declarations: `const tier: MarkupKind = ...`. Left in place,
    // the annotation reads as a label and the line fails to parse with
    // "Missing initializer in const declaration". Bounded to a single line
    // and stopping at the `=`, so an object literal on the right is safe.
    // `;` is NOT excluded: an inline object type carries its own
    // (`const t: { a: number; b: number }[] = []`), and excluding it left
    // exactly those declarations unstripped. Bounded by the newline and by
    // stopping at the first `=`, which no type annotation contains.
    .replace(/\b(const|let|var)\s+([A-Za-z_$][\w$]*)\s*:\s*[^=\n]+=/g, '$1 $2 =');
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

/* ---- Does a CSS rule actually reach the element it was written for? ----
 *
 * Written after four forms were "fixed" and none of the fixes applied.
 * Each form sets its name field apart from the fields that merely
 * describe it, and each has to beat a general rule of the shape
 * `.x input[type=text], .x input:not([type])` -- whose :not() lends its
 * argument an attribute selector's weight, so a plain two-class selector
 * LOSES to it. The fix raised the weight with `input[type=text].x-name`,
 * which won the cascade and stopped matching the element: none of these
 * inputs declare a type, and [type=text] matches the ATTRIBUTE, not the
 * default the browser resolves to.
 *
 * Every test asserted the rule's text was present and written after the
 * general one. Both were true. All three fields rendered at 14px anyway,
 * for weeks, until they were measured in a browser.
 *
 * So: match the selector against the element the way a browser would,
 * and compare weights properly. A rule that cannot reach its element is
 * not a rule.
 */

// Specificity as (ids, classes, types). :not() contributes its argument's
// weight but nothing for itself -- which is the whole trap above.
function selectorSpecificity(sel) {
  let s = String(sel);
  let a = 0, b = 0, c = 0;
  s = s.replace(/:not\(([^)]*)\)/g, (_, inner) => {
    const [ia, ib, ic] = selectorSpecificity(inner);
    a += ia; b += ib; c += ic;
    return ' ';
  });
  a += (s.match(/#[\w-]+/g) || []).length;
  b += (s.match(/\.[\w-]+/g) || []).length + (s.match(/\[[^\]]*\]/g) || []).length;
  c += (s.match(/(^|[\s>+~])([a-zA-Z][\w-]*)/g) || []).length;
  return [a, b, c];
}
const specGTE = (x, y) => (x[0] !== y[0] ? x[0] > y[0] : x[1] !== y[1] ? x[1] > y[1] : x[2] >= y[2]);

/* Does one compound selector match this element? Only the forms these
   stylesheets actually use: tag, .class, #id, [attr], [attr=value] and
   :not(...) of those. Anything unrecognised returns false rather than
   guessing -- a check that cannot read the selector must not pass it. */
function compoundMatches(compound, el) {
  const parts = compound.match(/:not\([^)]*\)|\[[^\]]*\]|[.#]?[\w-]+/g) || [];
  for (const p of parts) {
    if (p.startsWith(':not(')) {
      if (compoundMatches(p.slice(5, -1), el)) return false;
    } else if (p.startsWith('[')) {
      const m = /^\[([\w-]+)(?:=["']?([^\]"']*)["']?)?\]$/.exec(p);
      if (!m) return false;
      const have = el.attrs[m[1]];
      if (have === undefined) return false;
      if (m[2] !== undefined && have !== m[2]) return false;
    } else if (p.startsWith('.')) {
      if (!el.classes.includes(p.slice(1))) return false;
    } else if (p.startsWith('#')) {
      if (el.attrs.id !== p.slice(1)) return false;
    } else if (p.toLowerCase() !== el.tag) return false;
  }
  return true;
}
/* The rightmost compound must match the element; the ones before it must
   match ancestors, outermost last, gaps allowed. Ancestry is checked for
   real -- taking it on trust made this report that a supplier field was
   styled by a customer-form rule, which is precisely the class of
   mistake it exists to catch. Only the descendant combinator is
   understood; anything else returns false rather than guessing. */
function selectorMatchesElement(sel, el, ancestors) {
  const s = sel.trim();
  if (/[>+~]/.test(s)) return false;
  const compounds = s.split(/\s+/);
  if (!compoundMatches(compounds.pop(), el)) return false;
  let i = (ancestors || []).length - 1;
  for (let k = compounds.length - 1; k >= 0; k--) {
    while (i >= 0 && !compoundMatches(compounds[k], ancestors[i])) i--;
    if (i < 0) return false;
    i--;
  }
  return true;
}

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img',
  'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const parseAttrs = (raw) => {
  const attrs = {};
  (raw.match(/[\w-]+(?:="[^"]*")?/g) || []).forEach((a) => {
    const i = a.indexOf('=');
    if (i < 0) attrs[a] = '';
    else attrs[a.slice(0, i)] = a.slice(i + 2, -1);
  });
  return attrs;
};
const asElement = (tag, raw) => {
  const attrs = parseAttrs(raw);
  return { tag: tag.toLowerCase(), attrs, classes: (attrs.class || '').split(/\s+/).filter(Boolean) };
};

// An element and everything it sits inside, read out of the markup.
function elementById(src, id) {
  const at = src.search(new RegExp(`<[a-zA-Z][\\w-]*[^>]*\\bid="${id}"`));
  if (at < 0) throw new Error(`no element with id="${id}" in the markup`);
  const self = /^<([a-zA-Z][\w-]*)([^>]*)>/.exec(src.slice(at));
  const stack = [];
  const re = /<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g;
  let m;
  while ((m = re.exec(src)) && m.index < at) {
    if (m[1]) { for (let i = stack.length - 1; i >= 0; i--) if (stack[i].tag === m[2].toLowerCase()) { stack.length = i; break; } }
    else if (!m[4] && !VOID_TAGS.has(m[2].toLowerCase())) stack.push(asElement(m[2], m[3]));
  }
  const el = asElement(self[1], self[2]);
  el.ancestors = stack;
  return el;
}

/* Which declaration actually wins for one property on one element, given
   every rule in the stylesheet: the last of the highest-specificity rules
   that both matches and sets it. Returns null when nothing does. */
function winningDeclaration(src, id, prop) {
  const el = elementById(src, id);
  /* Stylesheet only, comments stripped. Left in, a comment containing a
     brace parses as a rule and its prose parses as a selector -- which
     is how the first draft of this reported that a phone field was
     19px because a sentence in a comment mentioned .sf-name. */
  const css = (src.match(/<style[^>]*>([\s\S]*?)<\/style>/g) || [])
    .map((b) => b.replace(/^<style[^>]*>/, '').replace(/<\/style>$/, ''))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
  const rules = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const body = m[2];
    const decl = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`).exec(body);
    if (!decl) continue;
    m[1].split(',').forEach((sel) => {
      if (!/[{}<]/.test(sel) && selectorMatchesElement(sel, el, el.ancestors)) {
        rules.push({ sel: sel.trim(), spec: selectorSpecificity(sel), value: decl[1].trim(), at: m.index });
      }
    });
  }
  if (!rules.length) return null;
  return rules.reduce((best, r) => (!best || specGTE(r.spec, best.spec) ? r : best), null);
}

module.exports = {
  ROOT, read, extractFunction, extractDeclaration, stripTypes, compileScope, createReporter,
  selectorSpecificity, selectorMatchesElement, elementById, winningDeclaration,
};
