#!/usr/bin/env node
'use strict';
/*
 * shared-worker.js is styled by whichever host is running it.
 *
 * worker.html runs dark on purpose -- a warehouse is lit from above and a
 * white screen at arm's length washes out -- and index.html runs light. So a
 * colour token in this shared file resolves to two different values, and it
 * is only safe to use if the token means the same THING in both.
 *
 * --accent-ink did not. In index.html it is amber warning ink for text on a
 * white panel. In worker.html it is the near-black that sits ON the accent
 * button. The delivery picker used it for its "Preparing for X — since N
 * minutes ago" line, which is text on a panel: readable in the admin app at
 * 7.48:1, and 1.09:1 in the worker app, where the line rendered and simply
 * could not be seen.
 *
 * That is the whole failure mode -- a token that reads fine in the host you
 * happen to be testing in. So this checks every token the shared file uses,
 * in both hosts, as text on that host's own panel.
 *
 * Run: node test/shared-worker-tokens.test.js   (or: npm test)
 */
const { read, createReporter } = require('./_extract');

const t = createReporter('shared-worker tokens');
const shared = read('shared-worker.js');
const hosts = { 'worker.html': read('worker.html'), 'index.html': read('index.html') };

// Follow var() aliases within a host until a literal falls out.
function resolve(src, tok, depth) {
  if ((depth || 0) > 8) return null;
  const m = src.match(new RegExp('(?:^|[;{\\s])' + tok + '\\s*:\\s*([^;]+);', 'm'));
  if (!m) return null;
  const v = m[1].trim();
  const alias = v.match(/^var\((--[a-zA-Z0-9-]+)\)$/);
  return alias ? resolve(src, alias[1], (depth || 0) + 1) : v;
}

const hex = (h) => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); return [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16)); };
const lum = (c) => { const s = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2]; };
const ratio = (a, b) => { const l1 = lum(hex(a)), l2 = lum(hex(b)); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
const isHex = (v) => /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(v || '');

const used = [...new Set([...shared.matchAll(/var\((--[a-zA-Z0-9-]+)/g)].map((m) => m[1]))].sort();

/* ---------- 1. every token exists in both hosts ----------------------- */
/*
 * The shared file inlined exactly four colours, all of them inside the
 * worker's delivery picker. Choosing a driver is the admin's job now and
 * that picker is gone, taking the last inline colour with it: every
 * colour this file produces now arrives through a class the host styles,
 * which is the shape that cannot mean two different things in two hosts.
 *
 * So there is nothing to measure today, and this says so rather than
 * quietly passing a loop over an empty list -- a check that reports green
 * while checking nothing is worse than no check. The machinery below is
 * kept and runs for real the moment an inline var() comes back.
 */
{
  if (used.length === 0) {
    t.pass('the shared file inlines no colours at all, so neither host can style it two ways');
  } else {
    t.pass(`the shared file inlines ${used.length} colour token(s): ${used.join(', ')}`);
  }
  const missing = [];
  used.forEach((tok) => {
    Object.entries(hosts).forEach(([name, src]) => {
      if (resolve(src, tok, 0) === null) missing.push(`${tok} in ${name}`);
    });
  });
  t.check(missing.length === 0,
    missing.length
      ? `shared-worker.js uses tokens a host does not define: ${missing.join(', ')}`
      : `every token it uses is defined by both hosts (${used.length} checked)`);
}

/* ---------- 2. and reads as text on that host's own panel ------------- */
{
  // The shared file only ever paints these onto a panel -- the pending card
  // and the pick card. So that is the pairing to check. Empty while the file
  // inlines no colours; section 1 is what states that, and section 3 keeps
  // measuring --warn-ink itself so the contract does not go unmeasured
  // just because nothing is currently spending it.
  const fails = [];
  const measured = [];
  Object.entries(hosts).forEach(([name, src]) => {
    const panel = resolve(src, '--panel', 0);
    if (!isHex(panel)) { fails.push(`${name} has no resolvable --panel`); return; }
    used.forEach((tok) => {
      if (tok === '--panel') return;
      const c = resolve(src, tok, 0);
      if (!isHex(c)) return;                 // gradients, shadows: not text
      const r = ratio(c, panel);
      measured.push(`${name} ${tok} ${r.toFixed(2)}`);
      // 12px body text, so the full 4.5 is owed.
      if (r < 4.5) fails.push(`${tok} on ${name}'s panel is ${r.toFixed(2)}:1`);
    });
  });
  if (!used.length) t.pass('no inline colour to measure on a panel — see above');
  else t.check(measured.length > 0, `contrast measured for ${measured.length} token/host pairs`);
  t.check(fails.length === 0,
    fails.length
      ? `unreadable as text on a panel: ${fails.join('; ')}`
      : 'every token the shared file uses clears AA as text on both hosts');
}

/* ---------- 3. the one that was wrong stays gone ---------------------- */
{
  // Named, because the name is the trap: it reads as "the accent-coloured
  // ink" and in worker.html it means "the ink that goes ON the accent".
  const code = shared.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
  t.check(!/var\(--accent-ink\)/.test(code),
    'shared-worker.js does not reach for --accent-ink, which means two different things');
  // --warn-ink is the replacement, and both hosts still define it even
  // though the shared file no longer has caution text of its own to
  // colour. That definition IS the contract: the next piece of shared
  // code that needs a warning colour has one that means the same thing on
  // both sides, instead of reaching for --accent-ink again and shipping
  // text at 1.09:1 that renders and cannot be read.
  Object.keys(hosts).forEach((name) => {
    t.check(resolve(hosts[name], '--warn-ink', 0) !== null,
      `${name} still defines --warn-ink for shared code to use`);
  });

  const w = resolve(hosts['worker.html'], '--warn-ink', 0);
  const a = resolve(hosts['index.html'], '--warn-ink', 0);
  t.check(isHex(w) && isHex(a), `--warn-ink resolves in both hosts (worker ${w}, admin ${a})`);
  t.check(ratio(w, resolve(hosts['worker.html'], '--panel', 0)) >= 4.5,
    'and is readable on the dark panel, which is where it was invisible before');
  t.check(ratio(a, resolve(hosts['index.html'], '--panel', 0)) >= 4.5,
    'and on the light one');
}

/* ---------- 4. --accent-ink is still doing its own job ---------------- */
{
  // Not a leftover: in worker.html it is the ink on the accent BUTTON, and
  // that pairing has to keep clearing AA too.
  const src = hosts['worker.html'];
  const ink = resolve(src, '--accent-ink', 0);
  const accent = resolve(src, '--accent', 0);
  t.check(isHex(ink) && isHex(accent), `worker.html still defines both (${ink} on ${accent})`);
  t.check(/\.btn-accent\{background:var\(--accent\);color:var\(--accent-ink\);\}/.test(src),
    'and pairs them on .btn-accent, which is what the token is for');
  const r = ratio(ink, accent);
  t.check(r >= 4.5, `dark ink on the bright accent reads at ${r.toFixed(2)}:1`);
}

process.exit(t.done() ? 1 : 0);
