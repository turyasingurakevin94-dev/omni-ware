#!/usr/bin/env node
'use strict';
/*
 * The apps exist twice over at run time: the live shop, and the copy the
 * redesign is built against. Which Supabase project a page talks to is
 * decided by the OW_ENV block at the top of each app's script, from the
 * host it was opened on -- there is no build step here to inject it, and
 * a per-branch constant would be a merge conflict every single time the
 * redesign takes a fix from main.
 *
 * Two things make that block worth pinning rather than trusting.
 *
 * The first is the direction of the rule. It names the PRODUCTION hosts
 * and lets everything else fall to staging. Inverted -- a list of staging
 * hosts, production as the default -- every host nobody thought of writes
 * to the real books: a fresh preview URL, a renamed project, a bookmark
 * from before the move. That is a data-loss bug that would look like
 * nothing at all until a stock count came out wrong, so the direction is
 * checked here by evaluating the real block, not by reading it.
 *
 * The second is that the block is copied into five files. It has to be,
 * because worker-www/ may hold only the three files Capacitor packs and
 * client.html is asserted to ship no key at all, so there is nowhere
 * shared to put it. Copies drift. These checks say the copies are the
 * same bytes, and that the portal copy differs from the app copy in
 * exactly one way: the key lines are gone.
 *
 * Run: node test/environment-switch.test.js   (or: npm test)
 */
const vm = require('vm');
const { read, createReporter } = require('./_extract');

const t = createReporter('environment switch');

const APP_FILES = ['index.html', 'agent.html', 'worker.html'];
const PORTAL_FILES = ['client.html', 'catalogue.html'];
const PROJECT_REF = 'hgywjaifdmgrcnwxstxg';
const OPENER = '/* ---------------- Which Supabase project this copy talks to ----------';
const CLOSER = '\n})();';

// The block whole, from its comment to the end of the IIFE. Throws rather
// than returning empty: a test that silently checks nothing is worse than
// no test, because it reports green.
function blockOf(rel) {
  const src = read(rel);
  const start = src.indexOf(OPENER);
  if (start < 0) throw new Error(`no OW_ENV block in ${rel}`);
  const end = src.indexOf(CLOSER, start);
  if (end < 0) throw new Error(`unterminated OW_ENV block in ${rel}`);
  return src.slice(start, end + CLOSER.length);
}

/* ---------- 1. the copies are the same bytes -------------------------- */
{
  const app = blockOf(APP_FILES[0]);
  APP_FILES.slice(1).forEach((f) => {
    t.check(blockOf(f) === app, `${f} carries the same environment block as ${APP_FILES[0]}`);
  });

  // The one deliberate difference, pinned by name so that an edit to the
  // app copy cannot quietly skip the portal copy -- and so that a key
  // cannot reappear in a page that promises not to carry one.
  const stripped = app.split('\n').filter((l) => !/^\s*anon: '[^']*',$/.test(l)).join('\n');
  t.check(stripped !== app, 'the app block does carry key lines to strip');
  PORTAL_FILES.forEach((f) => {
    t.check(blockOf(f) === stripped,
      `${f} carries that block with the key lines removed, and nothing else changed`);
  });
  PORTAL_FILES.forEach((f) => {
    t.check(!/sb_publishable/.test(read(f)), `${f} still ships no key at all`);
  });
}

/* ---------- 2. the project URL appears nowhere but the block ---------- */
{
  APP_FILES.concat(PORTAL_FILES).forEach((f) => {
    const src = read(f);
    const inFile = src.split(PROJECT_REF).length - 1;
    const inBlock = blockOf(f).split(PROJECT_REF).length - 1;
    t.check(inFile === inBlock && inBlock === 1,
      `${f} names the project once, inside the block (${inFile} in the file, ${inBlock} in the block)`);
    t.check(/const SUPABASE_URL = OW_ENV\.url;/.test(src),
      `${f} takes its URL from the block rather than a literal`);
  });
}

/* ---------- 3. what the block actually decides ------------------------ */
// Evaluated, not read. The rule that matters is a behaviour.
function evaluate(src, opts) {
  const o = opts || {};
  const made = [];
  const listeners = {};
  const document = {
    readyState: o.readyState || 'complete',
    body: o.body === null ? null : { appendChild(el) { made.push(el); } },
    getElementById: () => null,
    createElement: () => ({ style: {} }),
    addEventListener(name, fn) { (listeners[name] = listeners[name] || []).push(fn); },
  };
  const sandbox = {
    document,
    window: o.capacitor ? { Capacitor: {} } : {},
    location: { hostname: o.hostname === undefined ? 'example.test' : o.hostname },
  };
  const env = vm.runInNewContext(src + '\nOW_ENV;', sandbox);
  return { env, marks: made, fire: (n) => (listeners[n] || []).forEach((fn) => fn()) };
}

// The block in the repo may be unconfigured, half filled in, or whole --
// it changes as the staging project is set up. These checks are about what
// the CODE decides, so they rewrite it to a known state first rather than
// depending on whatever today's values happen to be. Substituting empty
// placeholders, as this once did, quietly stopped working the moment the
// first real value landed.
const STAGING_RE = /const STAGING = \{[\s\S]*?\};/;
const HOSTS_RE = /const PRODUCTION_HOSTS = \[[^\]]*\];/;

function setStaging(src, url, anon) {
  const m = STAGING_RE.exec(src);
  if (!m) throw new Error('no STAGING object in the block');
  // The portal copy has no key line, and must not grow one here.
  const lines = ['  const STAGING = {', "    name: 'staging',", `    url: '${url}',`];
  if (/\n\s*anon:/.test(m[0])) lines.push(`    anon: '${anon}',`);
  lines.push('  };');
  return src.replace(STAGING_RE, lines.join('\n'));
}

function setHosts(src, hosts) {
  if (!HOSTS_RE.test(src)) throw new Error('no PRODUCTION_HOSTS in the block');
  return src.replace(HOSTS_RE,
    `const PRODUCTION_HOSTS = [${hosts.map((h) => `'${h}'`).join(', ')}];`);
}

function configure(src, { staging, hosts }) {
  return setHosts(setStaging(src, staging || '', staging ? 'sb_publishable_staging' : ''),
    hosts || []);
}

const SHIPPED = blockOf('index.html');
const STAGING_URL = 'https://stagingref.supabase.co';
const LIVE = 'omni-ware.example';
const UNSET = configure(SHIPPED, { staging: '', hosts: [] });

{
  // Neither half filled in: no second database named, so nothing about
  // the live site changes by merging the block.
  ['example.test', 'localhost', '', 'anything-at-all.vercel.app'].forEach((h) => {
    const { env, marks } = evaluate(UNSET, { hostname: h });
    t.check(env.name === 'production' && env.url.includes(PROJECT_REF),
      `neither half set, ${h || '(no host)'} gets production — such a block cannot move the live site`);
    t.check(marks.length === 0, `and shows no staging strip on ${h || '(no host)'}`);
  });
}

{
  // A half-finished switch is the dangerous one, so it is inert. Name a
  // staging project without naming the real site and the real site would
  // otherwise become "everything else" -- the live app pointed at an
  // empty database.
  const halfA = configure(SHIPPED, { staging: STAGING_URL, hosts: [] });
  t.check(evaluate(halfA, { hostname: LIVE }).env.name === 'production',
    'a staging project with no production host named changes nothing');

  const halfB = configure(SHIPPED, { staging: '', hosts: [LIVE] });
  t.check(evaluate(halfB, { hostname: 'somewhere.else' }).env.name === 'production',
    'and a production host with no staging project to point at changes nothing either');
}

{
  const both = configure(SHIPPED, { staging: STAGING_URL, hosts: [LIVE] });

  const live = evaluate(both, { hostname: LIVE });
  t.check(live.env.name === 'production' && live.env.url.includes(PROJECT_REF),
    'configured, the named host is production');
  t.check(live.marks.length === 0, 'and carries no strip');

  t.check(evaluate(both, { hostname: LIVE.toUpperCase() }).env.name === 'production',
    'a host is matched whatever its case — DNS does not care and neither can this');

  // The whole point: anything unrecognised is the copy, never the books.
  ['omni-ware-git-redesign-a1b2c3.vercel.app', 'localhost', '127.0.0.1', '', 'stale-bookmark.example']
    .forEach((h) => {
      const r = evaluate(both, { hostname: h });
      t.check(r.env.name === 'staging' && r.env.url === STAGING_URL,
        `an unrecognised host (${h || 'none'}) falls to staging, not to the real books`);
      t.check(r.marks.length === 1 && /STAGING/.test(r.marks[0].textContent),
        `and says so on screen (${h || 'none'})`);
    });

  // Android serves the bundle from localhost, which would otherwise read
  // as staging and hand every worker an empty shop.
  const apk = evaluate(both, { hostname: 'localhost', capacitor: true });
  t.check(apk.env.name === 'production',
    'the Android shell is the real shop, though it too is served from localhost');
  t.check(apk.marks.length === 0, 'and shows no strip');
}

{
  // The strip is drawn once the body exists, not dropped on the floor
  // because the script ran first.
  const both = configure(SHIPPED, { staging: STAGING_URL, hosts: [LIVE] });
  const early = evaluate(both, { hostname: 'preview.example', readyState: 'loading' });
  t.check(early.marks.length === 0, 'while the document is still loading nothing is appended yet');
  early.fire('DOMContentLoaded');
  t.check(early.marks.length === 1, 'and the strip arrives when the document is ready');

  const z = /z-index:(\d+)/.exec(early.marks[0].style.cssText);
  t.check(!!z && Number(z[1]) < 900,
    `the strip stays under the drawn dropdown at 900 (${z ? z[1] : 'none'})`);
  t.check(/pointer-events:none/.test(early.marks[0].style.cssText),
    'and cannot swallow a tap meant for the app underneath');
}

/* ---------- 3b. and what the repo is actually shipping ---------------- */
// The checks above prove what the code decides. These read the values
// really committed, which is where a typo does its damage: they are the
// difference between a staging site and a second window onto the books.
{
  const staging = /const STAGING = \{[\s\S]*?url: '([^']*)'/.exec(SHIPPED);
  const hosts = /const PRODUCTION_HOSTS = \[([^\]]*)\]/.exec(SHIPPED);
  const url = staging ? staging[1] : '';
  const named = hosts ? [...hosts[1].matchAll(/'([^']*)'/g)].map((m) => m[1]) : [];

  // The one that would be catastrophic and silent: the live project
  // pasted in as the staging one. Every "staging" write then lands on the
  // real books, and the strip in the corner says it is safe to do so.
  t.check(!url.includes(PROJECT_REF),
    url.includes(PROJECT_REF)
      ? `STAGING names the LIVE project (${PROJECT_REF}) — the copy and the books would be the same database`
      : 'the staging project named is not the live one');

  // A host that cannot match. location.hostname is a bare lowercase host:
  // a scheme, a slash, a port or a capital means the comparison silently
  // never fires, and the live site quietly falls to staging.
  named.forEach((h) => {
    t.check(/^[a-z0-9.-]+$/.test(h),
      /^[a-z0-9.-]+$/.test(h)
        ? `production host "${h}" is a bare hostname, as location.hostname gives it`
        : `production host "${h}" can never match location.hostname — drop the scheme, port, slash or capitals`);
  });

  const state = !url && !named.length ? 'neither half set (inert — every host gets production)'
    : url && named.length ? `whole (staging ${url.replace(/^https?:\/\//, '')}, production ${named.join(', ')})`
    : url ? 'HALF: a staging project named, no production host yet (still inert)'
    : 'HALF: a production host named, no staging project yet (still inert)';
  t.pass(`the switch as committed: ${state}`);
}

/* ---------- 4. the two server functions switch the other way ---------- */
{
  // No hostname to read on the server, and Vercel hands each project its
  // own environment, so these take an env var -- defaulting to production
  // so the live deployment needs no configuration to go on working.
  ['api/assistant.js', 'api/wa-draft.js'].forEach((f) => {
    const src = read(f);
    t.check(/const SUPABASE_URL = process\.env\.SUPABASE_URL\s*\n?\s*\|\|\s*'https:\/\/hgywjaifdmgrcnwxstxg\.supabase\.co';/.test(src),
      `${f} reads SUPABASE_URL from the environment and falls back to production`);
    t.check(/const SUPABASE_PUBLISHABLE_KEY = process\.env\.SUPABASE_PUBLISHABLE_KEY\s*\n?\s*\|\|\s*'sb_publishable_/.test(src),
      `${f} does the same for the publishable key`);
  });
}

process.exit(t.done() ? 1 : 0);
