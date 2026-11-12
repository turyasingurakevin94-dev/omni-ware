'use strict';
/*
 * The runner of an app's end-to-end flows (sales-flows.cjs, store-flows.cjs): picks the flows named on the
 * command line (all by default), runs them four at a time on fresh phones (lib.cjs phone), and prints one
 * PASS / FAIL line per flow with its failures and notes, the controls under 44 × 44 (recorded, not failed)
 * and every screen wider than the phone. Exit 1 when any flow failed.
 *
 *   run({ app: 'sales', flows: { sell: fn, … }, phone: { … } })
 *
 * A flow is `async (open) => {}`; `open(flags, opts)` gives it a phone on the app's page (lib.cjs pageOf) ?demo<flags>
 * (opts are lib.cjs phone's, over the app's own `phone` defaults).
 */
const fs = require('fs');
const path = require('path');
const L = require('./lib.cjs');

const PARALLEL = 4;

async function runOne(browser, base, name, flow, defaults) {
  const rec = L.newRecord(name);
  const t0 = Date.now();
  const opened = [];
  const open = async (flags, opts) => { const ph = await L.phone(browser, base, rec, flags, { ...defaults, ...opts }); opened.push(ph); return ph; };
  try {
    await flow(open);
  } catch (e) {
    rec.ok = false;
    rec.failures.push('stopped: ' + String(e.message || e).split('\n')[0]);
  }
  for (const ph of opened) await ph.ctx.close().catch(() => {});
  if (rec.errors.length) { rec.ok = false; rec.failures.push(...rec.errors.map((e) => 'console/page error: ' + e)); }
  rec.ms = Date.now() - t0;
  return rec;
}

function report(recs) {
  const out = [];
  for (const r of recs) {
    out.push(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}  (${r.checks.filter((c) => c.ok).length}/${r.checks.length} checks, ${r.screens} screens, ${(r.ms / 1000).toFixed(1)} s)`);
    for (const f of r.failures) out.push(`        x ${f}`);
    for (const n of r.notes) out.push(`        note: ${n}`);
  }
  const small = new Map();
  for (const r of recs) for (const s of r.small) {
    const k = `${s.name} · ${s.w}×${s.h}`;
    if (!small.has(k)) small.set(k, { ...s, flows: new Set() });
    small.get(k).flows.add(r.name);
  }
  out.push('', `Under 44 × 44 (${small.size} distinct; recorded, not failed):`);
  for (const [k, s] of [...small].sort()) out.push(`  - ${k}  (.${s.cls || '?'}; first at ${s.at}; in ${[...s.flows].join(', ')})`);
  const wide = recs.flatMap((r) => r.wide.map((w) => `${r.name}: ${w}`));
  out.push('', `Wider than 360 (${wide.length}):`, ...wide.map((w) => '  - ' + w));
  return out.join('\n');
}

/** Runs the flows; resolves the exit code. */
async function run({ app, flows, phone = {} }) {
  const tag = `${app} e2e`;
  const pw = L.loadPlaywright();
  if (!pw) { console.log(`${tag}: skipped (Playwright is not installed here)`); return 0; }
  if (!fs.existsSync(path.join(L.ROOT, L.pageOf(app)))) { console.error(`${tag}: ${L.pageOf(app)} is missing (npm run build:${app})`); return 1; }
  const pick = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const unknown = pick.filter((n) => !flows[n]);
  if (unknown.length) { console.error(`${tag}: no such flow: ${unknown.join(', ')}\n  flows: ${Object.keys(flows).join(', ')}`); return 1; }
  const names = pick.length ? pick : Object.keys(flows);
  const srv = await L.serve();
  const browser = await pw.chromium.launch();
  const t0 = Date.now();
  const recs = [];
  const defaults = { app, ...phone };
  try {
    const queue = names.slice();
    await Promise.all(Array.from({ length: Math.min(PARALLEL, queue.length) }, async () => {
      while (queue.length) { const n = queue.shift(); recs.push(await runOne(browser, srv.url, n, flows[n], defaults)); }
    }));
  } finally {
    await browser.close();
    await srv.close();
  }
  recs.sort((a, b) => names.indexOf(a.name) - names.indexOf(b.name));
  console.log(report(recs));
  const failed = recs.filter((r) => !r.ok);
  console.log(`\n${tag}: ${recs.length - failed.length} of ${recs.length} flows passed in ${((Date.now() - t0) / 1000).toFixed(1)} s${failed.length ? ' · failed: ' + failed.map((r) => r.name).join(', ') : ''}`);
  if (process.env.E2E_JSON) fs.writeFileSync(process.env.E2E_JSON, JSON.stringify(recs, null, 2));
  return failed.length ? 1 : 0;
}

/** For an app's entry file: run, then exit with the code. */
function main(cfg) {
  run(cfg).then((code) => process.exit(code), (e) => { console.error(e); process.exit(1); });
}

module.exports = { run, main, report };
