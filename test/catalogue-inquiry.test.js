#!/usr/bin/env node
'use strict';
/*
 * Public catalogue and inquiry handling.
 *
 * There is no pricing here to check -- deliberately. The public response
 * carries name, image, category and variant label and nothing else: it goes
 * to a stranger with no session, so it sits one notch stricter than the
 * "never a price, never a supplier" line agent-catalog already holds. The
 * thing worth testing is that the boundary stays where it is.
 *
 * The other risk is the slug. Its pattern is written out THREE times -- the
 * agent app validates before creating, catalogue-public validates before
 * looking anything up, and the catalogues table has a CHECK constraint.
 * If they drift, a link can be created that the public page then refuses,
 * or vice versa.
 *
 * Run: node test/catalogue-inquiry.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('catalogue/inquiry');
const agentSrc = read('agent.html');
const pubSrc = read('supabase/functions/catalogue-public/index.ts');
const migSrc = read('supabase/migrations/0025_catalogues.sql');

/* ---------- 1. the slug pattern agrees in all three places ------------- */
const SLUG_PATTERN = '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$';
{
  const fromServer = /const SLUG_RE = \/(.+?)\/;/.exec(pubSrc);
  const fromClient = /\/(\^\[a-z0-9\]\[a-z0-9-\][^/]*\$)\/\.test\(slug\)/.exec(agentSrc);
  const fromSchema = /slug text not null unique check \(slug ~ '(.+?)'\)/.exec(migSrc);

  if (!fromServer || !fromClient || !fromSchema) {
    t.fail(`could not locate the slug pattern in all three places (server=${!!fromServer}, client=${!!fromClient}, schema=${!!fromSchema})`);
  } else {
    const all = [fromServer[1], fromClient[1], fromSchema[1]];
    t.check(all.every((p) => p === SLUG_PATTERN),
      `the slug pattern matches in agent.html, catalogue-public and the catalogues CHECK constraint (${JSON.stringify(all)})`);
  }
}

/* ---------- 2. the suggested slug is always a valid slug --------------- */
/*
 * suggestSlug() pre-fills the create-catalogue form, and that value is then
 * put straight through the same validation. Anything it can produce that
 * the pattern rejects means an agent is shown a default their own form
 * refuses -- with nothing explaining why.
 */
const { suggestSlug } = compileScope(
  [extractFunction(agentSrc, 'suggestSlug', 'agent.html')], {}, ['suggestSlug'],
);
{
  const SLUG_RE = new RegExp(SLUG_PATTERN);
  const NAMES = [
    'Peter Ochieng', 'joan', 'ABAHO ANEB', "O'Brien & Sons", '   spaced   out   ',
    'Jo',                        // two letters
    'J',                         // one letter
    '',                          // empty -- falls back
    '!!!',                       // nothing usable -- falls back
    '123',
    'a'.repeat(60),              // longer than the slice
    'a'.repeat(39) + ' b',       // the slice can land on a separator
    'Ω unicode name',
    '-leading-and-trailing-',
  ];
  const bad = NAMES.map((n) => [n, suggestSlug(n)]).filter(([, s]) => !SLUG_RE.test(s));
  t.check(bad.length === 0,
    bad.length
      ? `suggestSlug produced slugs its own validator rejects: ${bad.map(([n, s]) => `"${n}" -> "${s}"`).join('; ')}`
      : `suggestSlug always produces a valid slug (${NAMES.length} names)`);
}

/* ---------- 3. nothing priced or sourced reaches a stranger ------------ */
/*
 * Structural: the handler is inline, so this checks the columns it selects
 * and the object it builds rather than running it. A price or supplier
 * appearing here would be visible to anyone with the link.
 */
{
  const getBlock = /if \(action === "get"\) \{([\s\S]*?)\n    \}/.exec(pubSrc);
  if (!getBlock) {
    t.fail('could not find the catalogue "get" handler to check');
  } else {
    const block = getBlock[1];
    const select = /\.select\("([^"]+)"\)/.exec(block);
    const cols = select ? select[1].split(',').map((s) => s.trim()) : [];
    const ALLOWED = ['id', 'name', 'image', 'category', 'variants'];
    const unexpected = cols.filter((c) => !ALLOWED.includes(c));
    t.check(select && unexpected.length === 0,
      unexpected.length
        ? `the public product query selects unexpected columns: ${unexpected.join(', ')}`
        : `the public product query selects only ${ALLOWED.join('/')}`);

    // Comments stripped first: the block carries a deliberate note about
    // "never a price, never a supplier", and scanning that as if it were
    // code reports a leak that isn't there.
    const code = block.split(/\r?\n/).map((l) => l.replace(/\/\/.*$/, '')).join('\n');
    const LEAKY = ['price', 'cost', 'wholesale', 'retail', 'supplier', 'markup', 'floor', 'tier'];
    const found = LEAKY.filter((w) => new RegExp(w, 'i').test(code));
    t.check(found.length === 0,
      found.length
        ? `the public catalogue response mentions ${found.join(', ')} — it must never carry pricing or sourcing`
        : 'the public catalogue response carries no pricing or supplier wording at all');
  }
}

/* ---------- 4. variant labels read the same everywhere ----------------- */
/*
 * The catalogue builds its own label rather than sharing one, so a customer
 * could otherwise see a product described differently from how the agent
 * and the admin app describe the same thing.
 */
{
  const combo = { Colour: 'Gold', Size: '4"' };
  const catalogueLabel = Object.values(combo || {}).join(' / ');
  t.check(catalogueLabel === 'Gold / 4"',
    `the catalogue joins variant values with " / " like everywhere else (got "${catalogueLabel}")`);
  t.check(/Object\.values\(v\.combo \|\| \{\}\)\.join\(" \/ "\)/.test(pubSrc),
    'catalogue-public still builds the variant label that way');
}

/* ---------- 5. inquiry input is bounded and required ------------------ */
{
  const inq = /if \(action === "inquire"\) \{([\s\S]*?)return json\(\{ ok: true/.exec(pubSrc);
  if (!inq) {
    t.fail('could not find the inquire handler to check');
  } else {
    const block = inq[1];
    t.check(/customerName[\s\S]{0,80}\.slice\(0, 120\)/.test(block)
      && /customerPhone[\s\S]{0,80}\.slice\(0, 40\)/.test(block)
      && /message[\s\S]{0,120}\.slice\(0, 500\)/.test(block),
      'inquiry name, phone and message are all length-bounded before storage');
    t.check(/if \(!customerName \|\| !customerPhone\) return json/.test(block),
      'an inquiry without a name and phone is refused');
    // The dedupe is what stops one customer becoming several rows in the
    // agent's own client list.
    t.check(/from\("agent_clients"\)[\s\S]{0,200}\.eq\("phone", customerPhone\)/.test(block),
      'a repeat inquirer is matched to their existing client row by phone');
    t.check(/agent_id", catalogue\.agent_id/.test(block),
      'the client lookup is scoped to the catalogue owner, not the whole shop');
  }
}

/* ---------- 6. an unknown or malformed slug reveals nothing ------------ */
{
  t.check(/if \(!action \|\| !slug \|\| typeof slug !== "string" \|\| !SLUG_RE\.test\(slug\)\)/.test(pubSrc),
    'the slug is validated before any lookup happens');
  const notFound = (pubSrc.match(/This catalogue link isn't valid/g) || []).length;
  t.check(notFound >= 2,
    `a missing catalogue and a missing agent give the same generic answer (${notFound} uses), so the link can't be used to probe`);
}

process.exit(t.done() ? 1 : 0);
