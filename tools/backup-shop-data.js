#!/usr/bin/env node
'use strict';
/*
 * Dumps every table in the linked Supabase project to a timestamped JSON
 * file under backups/. Run it before anything that scares you, and on a
 * schedule once real data is in:
 *
 *   npm run backup
 *
 * Two ways in, neither with a secret in the repo:
 *
 *   - SUPABASE_ACCESS_TOKEN set (a personal access token, e.g. an
 *     environment secret of a cloud session): straight to the Management
 *     API's query endpoint, for the project in SUPABASE_PROJECT_REF or, by
 *     default, the live one. No CLI to install. One request per table, so
 *     no single answer grows too large.
 *   - Otherwise the Supabase CLI's own authenticated session (`supabase db
 *     query --linked`), from any machine that has run `supabase link`. Two
 *     round trips: one to list the tables, one to pull them all at once.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

/* The SQL must reach the CLI as ONE argument. A shell (`npx` needs one on
   Windows) re-splits and mangles it, so find the real supabase binary and
   call it directly. */
const findCli = () => {
  const candidates = [];
  const glob = (base, sub) => {
    if (base && fs.existsSync(base)) {
      for (const d of fs.readdirSync(base)) candidates.push(path.join(base, d, sub));
    }
  };
  if (process.platform === 'win32') {
    candidates.push(path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'supabase',
      'node_modules', '@supabase', 'cli-windows-x64', 'bin', 'supabase.exe'));
    glob(path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx'),
      path.join('node_modules', '@supabase', 'cli-windows-x64', 'bin', 'supabase.exe'));
  }
  candidates.push('supabase'); // PATH fallback (non-Windows, or a manual install)
  const hit = candidates.find((c) => c === 'supabase' || fs.existsSync(c));
  return hit;
};
const CLI = findCli();

// The live project (OW_ENV's PRODUCTION half in index.html).
const LIVE_REF = 'hgywjaifdmgrcnwxstxg';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF || LIVE_REF;

const runCli = async (sql) => {
  const out = execFileSync(CLI, ['db', 'query', '--linked', sql],
    { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 300000 });
  const m = out.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('no JSON in CLI output:\n' + out.slice(0, 500));
  return JSON.parse(m[0]).rows;
};
const runApi = async (sql) => {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (res.status === 401 || res.status === 403) throw new Error(`Supabase refused the access token (${res.status}): is SUPABASE_ACCESS_TOKEN current, and does it reach project ${REF}?`);
  if (!res.ok) throw new Error(`Supabase answered ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
};
const run = TOKEN ? runApi : runCli;

async function main() {
const tables = (await run(
  "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by table_name"
)).map((r) => r.table_name);
if (!tables.length) throw new Error('no tables found — is the project linked?');

const one = (t) => `select '${t}' as t, coalesce((select json_agg(x) from "${t}" x), '[]'::json) as rows`;
const dump = [];
if (TOKEN) {
  for (const t of tables) dump.push(...await run(one(t)));
} else {
  dump.push(...await run(tables.map(one).join(' union all ')));
}

const snapshot = { takenAt: new Date().toISOString(), project: TOKEN ? REF : 'linked', tables: {} };
let total = 0;
dump.forEach((r) => {
  const rows = typeof r.rows === 'string' ? JSON.parse(r.rows) : (r.rows || []);
  snapshot.tables[r.t] = rows;
  total += rows.length;
});

const dir = path.join(__dirname, '..', 'backups');
fs.mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
const file = path.join(dir, `backup-${stamp}.json`);
fs.writeFileSync(file, JSON.stringify(snapshot));

console.log(`Backed up ${total} row(s) across ${tables.length} table(s) -> ${path.relative(process.cwd(), file)}`);
tables.forEach((t) => {
  const n = snapshot.tables[t].length;
  if (n) console.log(`  ${t}: ${n}`);
});
}

main().catch((e) => { console.error('Backup failed: ' + e.message); process.exit(1); });
