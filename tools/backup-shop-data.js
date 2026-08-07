#!/usr/bin/env node
'use strict';
/*
 * Dumps every table in the linked Supabase project to a timestamped JSON
 * file under backups/. Run it before anything that scares you, and on a
 * schedule once real data is in:
 *
 *   npm run backup
 *
 * Uses the Supabase CLI's own authenticated session (`npx supabase db
 * query --linked`), so it needs no secrets in the repo and works from any
 * machine that has run `supabase link`. Two round trips: one to list the
 * tables, one to pull them all as JSON in a single statement.
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

const run = (sql) => {
  const out = execFileSync(CLI, ['db', 'query', '--linked', sql],
    { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 300000 });
  const m = out.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('no JSON in CLI output:\n' + out.slice(0, 500));
  return JSON.parse(m[0]).rows;
};

const tables = run(
  "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by table_name"
).map((r) => r.table_name);
if (!tables.length) throw new Error('no tables found — is the project linked?');

const union = tables.map((t) =>
  `select '${t}' as t, coalesce((select json_agg(x) from "${t}" x), '[]'::json) as rows`
).join(' union all ');
const dump = run(union);

const snapshot = { takenAt: new Date().toISOString(), tables: {} };
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
