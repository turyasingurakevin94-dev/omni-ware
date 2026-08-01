#!/usr/bin/env node
'use strict';
/*
 * Keeps the tier-pricing rule in sync across the four places it lives.
 *
 * The same "which price does this quantity earn" rule is implemented in:
 *   1. index.html                              tieredUnitPrice() + tiersForKind()
 *   2. supabase/functions/agent-catalog        tieredUnitPrice()   [what's SHOWN]
 *   3. supabase/functions/agent-submit-order   tieredUnitPrice()   [what's CHARGED]
 *   4. agent.html                              tierForQty()        [ladder lookup]
 *
 * Nothing forces them to agree; they agree today because they were kept in
 * step by hand. (2) and (3) disagreeing is the expensive case -- the agent
 * quotes one price and the customer is billed another.
 *
 * This runs the real source of each through one shared matrix rather than
 * comparing text, so reformatting doesn't fail it but a behavioural change
 * does. It reads the implementations straight out of the app files: there
 * is no build step here and nothing is duplicated into the test, so a test
 * that passes really is testing the shipped code.
 *
 * Run: node test/tier-pricing-parity.test.js   (or: npm test)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let failures = 0;
const fail = (m) => { failures++; console.error('not ok - ' + m); };
const pass = (m) => console.log('ok     - ' + m);

/* ---------- pulling the real implementations out of the app files ------ */

function read(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) throw new Error(`missing source file: ${rel}`);
  return fs.readFileSync(p, 'utf8');
}

// Brace-matches a top-level `function name(...) { ... }` out of a source
// file. Naive about braces inside strings/comments, which is fine for the
// small numeric helpers below -- and any failure to extract throws rather
// than silently yielding nothing, so this can't quietly pass.
function extractFunction(src, name, where) {
  const m = new RegExp('function\\s+' + name + '\\s*\\(').exec(src);
  if (!m) throw new Error(`could not find ${name}() in ${where}`);
  const open = src.indexOf('{', m.index);
  if (open < 0) throw new Error(`no body for ${name}() in ${where}`);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(m.index, i + 1);
  }
  throw new Error(`unbalanced braces in ${name}() in ${where}`);
}

// Just enough TypeScript removal for these helpers: parameter and return
// annotations, and `as` casts. Deliberately narrow -- if an implementation
// grows syntax this doesn't handle, evaluation throws and the test fails
// loudly rather than skipping the comparison.
function stripTypes(src) {
  return src
    .replace(/\)\s*:\s*[^{]+\{/, ') {')
    .replace(/\(\s*([A-Za-z_$][\w$]*)\s*:\s*[^),]+\)\s*=>/g, '($1) =>')
    .replace(/([(,]\s*)([A-Za-z_$][\w$]*)\s*:\s*[A-Za-z_$][\w$<>\[\]|.\s]*?(?=\s*[,)])/g, '$1$2')
    .replace(/\s+as\s+[A-Za-z_$][\w$<>\[\]|.]*/g, '');
}

function compile(src, name, where, extraSrc) {
  const body = `${extraSrc || ''}\n${stripTypes(src)}\nreturn ${name};`;
  let fn;
  try {
    fn = new Function(body)();
  } catch (e) {
    throw new Error(`could not evaluate ${name}() from ${where}: ${e.message}`);
  }
  if (typeof fn !== 'function') throw new Error(`${name}() from ${where} did not compile to a function`);
  return fn;
}

const adminSrc = read('index.html');
const agentSrc = read('agent.html');
const catalogSrc = read('supabase/functions/agent-catalog/index.ts');
const submitSrc = read('supabase/functions/agent-submit-order/index.ts');

// index.html splits the rule across two functions, so tiersForKind() has to
// come along with it.
const adminTiered = compile(
  extractFunction(adminSrc, 'tieredUnitPrice', 'index.html'),
  'tieredUnitPrice', 'index.html',
  extractFunction(adminSrc, 'tiersForKind', 'index.html'),
);
const catalogTiered = compile(
  extractFunction(catalogSrc, 'tieredUnitPrice', 'agent-catalog'),
  'tieredUnitPrice', 'agent-catalog',
);
const submitTiered = compile(
  extractFunction(submitSrc, 'tieredUnitPrice', 'agent-submit-order'),
  'tieredUnitPrice', 'agent-submit-order',
);
const tierForQty = compile(
  extractFunction(agentSrc, 'tierForQty', 'agent.html'),
  'tierForQty', 'agent.html',
);

/* ---------- the shared matrix ----------------------------------------- */

// One case, expressed once, then handed to each implementation in the field
// shape it expects (the admin app carries camelCase, the DB rows snake_case).
const CASES = [
  { name: 'flat retail only, no tiers',        retail: 10000, wholesale: null, packQty: 0,  tiers: [] },
  { name: 'retail + wholesale, no tiers',      retail: 10000, wholesale: 8000, packQty: 12, tiers: [] },
  { name: 'tiers starting at 1',               retail: 10000, wholesale: 8000, packQty: 12, tiers: [{ minQty: 1, price: 10000 }, { minQty: 24, price: 7000 }] },
  // The case that was mispricing before 18f3657: nothing describes the
  // price below the first breakpoint.
  { name: 'tiers starting above 1',            retail: 10000, wholesale: null, packQty: 0,  tiers: [{ minQty: 10, price: 8000 }, { minQty: 50, price: 7000 }] },
  { name: 'tiers straddling the pack size',    retail: 10000, wholesale: 8000, packQty: 12, tiers: [{ minQty: 6, price: 9500 }, { minQty: 12, price: 7800 }, { minQty: 60, price: 7000 }] },
  { name: 'null base for the kind',            retail: null,  wholesale: 8000, packQty: 12, tiers: [{ minQty: 12, price: 7800 }] },
  { name: 'unsorted tier list',                retail: 10000, wholesale: 8000, packQty: 12, tiers: [{ minQty: 60, price: 7000 }, { minQty: 12, price: 7800 }] },
];

const QUANTITIES = [1, 2, 5, 9, 10, 11, 12, 13, 23, 24, 49, 50, 59, 60, 100];
const KINDS = ['wholesale', 'retail'];

const adminRow = (c) => ({ retail: c.retail, wholesale: c.wholesale, packQty: c.packQty, tiers: c.tiers });
const dbRow = (c) => ({ retail: c.retail, wholesale: c.wholesale, pack_qty: c.packQty, tiers: c.tiers });

// null and undefined both mean "no price"; normalise so a difference in
// which one is returned isn't reported as a behavioural change.
const norm = (v) => (v == null ? null : Number(v));

/* ---------- 1. the three tieredUnitPrice implementations agree --------- */

let mismatches = 0;
for (const c of CASES) {
  for (const kind of KINDS) {
    for (const qty of QUANTITIES) {
      const a = norm(adminTiered(adminRow(c), qty, kind));
      const b = norm(catalogTiered(dbRow(c), qty, kind));
      const d = norm(submitTiered(dbRow(c), qty, kind));
      if (a !== b || b !== d) {
        mismatches++;
        fail(`tieredUnitPrice disagrees — "${c.name}", kind=${kind}, qty=${qty}: `
          + `index.html=${a}, agent-catalog=${b}, agent-submit-order=${d}`);
      }
    }
  }
}
if (!mismatches) {
  pass(`tieredUnitPrice identical across index.html / agent-catalog / agent-submit-order `
    + `(${CASES.length * KINDS.length * QUANTITIES.length} combinations)`);
}

/* ---------- 2. shown price == charged price --------------------------- */
/*
 * agent-catalog sends a ladder; the app resolves a quantity against it with
 * tierForQty() and shows that price, while agent-submit-order recomputes
 * the charge from scratch. Those two must land on the same number.
 *
 * The ladder is rebuilt here the way buildFloorPriceLadder() does -- a rung
 * at every breakpoint, plus qty 1 -- so this fails if either the resolution
 * rule or that rung set drifts. (Rungs carry the raw tier price rather than
 * a marked-up floor price; markup is a monotonic transform applied equally
 * to both sides, so it cannot mask a mismatch.)
 */
let ladderMismatches = 0;
for (const c of CASES) {
  for (const kind of KINDS) {
    const breakpoints = [...new Set([1, ...c.tiers.map((t) => Number(t.minQty))])]
      .filter((q) => q > 0).sort((x, y) => x - y);
    const ladder = breakpoints
      .map((minQty) => ({ minQty, unitPrice: norm(submitTiered(dbRow(c), minQty, kind)), tier: kind }))
      .filter((r) => r.unitPrice != null);
    if (!ladder.length) continue; // nothing priceable for this kind

    for (const qty of QUANTITIES) {
      const charged = norm(submitTiered(dbRow(c), qty, kind));
      const rung = tierForQty(ladder, qty);
      const shown = rung ? norm(rung.unitPrice) : null;
      if (shown !== charged) {
        ladderMismatches++;
        fail(`shown != charged — "${c.name}", kind=${kind}, qty=${qty}: `
          + `agent shows ${shown}, server charges ${charged}`);
      }
    }
  }
}
if (!ladderMismatches) pass('ladder lookup (tierForQty) matches the charged price at every quantity');

/* ---------- 3. the ladder still carries its qty-1 rung ---------------- */
/*
 * Guards the actual fix in 18f3657 rather than the invariant above, which
 * rebuilds the rung set itself. Without a rung at 1, a row whose tiers start
 * higher has no rung describing the price below its first breakpoint, and
 * tierForQty() falls back to the cheapest rung it has -- quoting the agent
 * below the shop's floor.
 */
const ladderFn = extractFunction(catalogSrc, 'buildFloorPriceLadder', 'agent-catalog');
if (/new Set\s*(<[^>]*>)?\s*\(\s*\[\s*1\s*,/.test(ladderFn)) {
  pass('buildFloorPriceLadder still seeds its breakpoints with qty 1');
} else {
  fail('buildFloorPriceLadder no longer seeds its breakpoints with qty 1 — '
    + 'quantities below the first tier will be shown the wrong price (see 18f3657)');
}

/* ---------- 4. computeFloorPrice has not drifted between the two ------ */
/*
 * Too entangled with markup rules and product shape to exercise directly
 * here, so this compares the two copies structurally. agent-catalog
 * additionally returns `ourPrice` for the pricing-guidance UI; that one
 * line is the only difference allowed.
 */
const ALLOWED_EXTRA = ['ourPrice,'];
// Split on /\r?\n/, not '\n': these files are CRLF, and a trailing \r would
// otherwise sit between the comment text and end-of-string, so /\/\/.*$/
// (no `m` flag, and `.` never matches \r) would quietly match nothing and
// leave every comment in place to be compared as if it were code.
const normaliseBody = (src) => stripTypes(src)
  .split(/\r?\n/)
  .map((l) => l.replace(/\/\/.*$/, '').trim())
  .filter(Boolean)
  .filter((l) => !ALLOWED_EXTRA.includes(l));

const catFloor = normaliseBody(extractFunction(catalogSrc, 'computeFloorPrice', 'agent-catalog'));
const subFloor = normaliseBody(extractFunction(submitSrc, 'computeFloorPrice', 'agent-submit-order'));
if (catFloor.join('\n') === subFloor.join('\n')) {
  pass('computeFloorPrice identical between agent-catalog and agent-submit-order');
} else {
  const diff = catFloor.filter((l, i) => subFloor[i] !== l).slice(0, 3);
  fail('computeFloorPrice has drifted between agent-catalog and agent-submit-order — '
    + `what is shown and what is charged can now differ. First difference: ${JSON.stringify(diff)}`);
}

/* ---------------------------------------------------------------------- */
console.log(failures ? `\n${failures} check(s) failed.` : '\nAll tier-pricing parity checks passed.');
process.exit(failures ? 1 : 0);
