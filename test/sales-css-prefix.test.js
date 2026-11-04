#!/usr/bin/env node
'use strict';
/*
 * Every Sales tab's CSS stays its own (the integration pass, 4 Nov 2026).
 *
 * All six tabs ship in one page, so a tab's stylesheet reaches every other tab's
 * markup. CH33's card once used the Customers tab's cu-* classes and the
 * Customers CSS took it over (15.7% off its board). So:
 *   - each tab has one prefix of its own (td, ch, sl, kc, or, cu), and no two share one;
 *   - every selector a tab writes names a class of its own prefix (`.kc-x.on`,
 *     `.cu-row .ow-search`): a bare `.on`, `.mono` or `.ow-search` would restyle
 *     another tab, or the shared part everywhere (src/ui owns `ow-*`);
 *   - no two tabs define the same class, and no tab's markup uses another tab's prefix.
 */
const fs = require('fs');
const path = require('path');
const { ROOT, createReporter } = require('./_extract');

const t = createReporter('sales css prefix');
const TABS = { today: 'td', chats: 'ch', sell: 'sl', counter: 'kc', orders: 'or', customers: 'cu' };
const dir = (tab) => path.join(ROOT, 'src/apps/sales', tab);
const walk = (p) => (fs.statSync(p).isDirectory() ? fs.readdirSync(p).flatMap((f) => walk(path.join(p, f))) : [p]);
const own = (cls, pre) => cls === pre || cls.startsWith(pre + '-');

const prefixes = Object.values(TABS);
t.check(new Set(prefixes).size === prefixes.length, `each tab has its own prefix (${prefixes.join(', ')})`);

/** Each selector of a stylesheet, with the classes it names (keyframes and at-rule heads left out). */
function selectors(file) {
  const css = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  const out = [];
  for (const m of css.matchAll(/([^{}]+)\{/g)) {
    const head = m[1].trim();
    if (head.startsWith('@')) continue;
    head.split(',').forEach((s) => out.push({ sel: s.trim(), cls: [...s.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((x) => x[1]) }));
  }
  return out;
}

const definedBy = new Map();
for (const [tab, pre] of Object.entries(TABS)) {
  const files = walk(dir(tab));
  const loose = [];
  for (const f of files.filter((x) => x.endsWith('.css'))) {
    for (const s of selectors(f)) {
      if (!s.cls.some((c) => own(c, pre))) loose.push(`${path.basename(f)}: ${s.sel}`);
      s.cls.filter((c) => own(c, pre)).forEach((c) => { const by = definedBy.get(c) || new Set(); by.add(tab); definedBy.set(c, by); });
      const foreign = s.cls.filter((c) => Object.entries(TABS).some(([o, p]) => o !== tab && own(c, p)));
      if (foreign.length) loose.push(`${path.basename(f)}: ${s.sel} (names ${foreign.join(', ')})`);
    }
  }
  t.check(!loose.length, `${tab}: every selector names a ${pre}-* class of its own${loose.length ? ` (not: ${loose.slice(0, 8).join(' | ')})` : ''}`);
  // Markup: a class attribute or class string in this tab's code never uses another tab's prefix.
  const used = [];
  for (const f of files.filter((x) => /\.tsx?$/.test(x))) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/class(?:Name)?=\{?[^>]*?(['"`])([^'"`]*)\1/g)) {
      m[2].split(/\s+/).forEach((c) => { if (Object.entries(TABS).some(([o, p]) => o !== tab && c.startsWith(p + '-'))) used.push(`${path.basename(f)}: ${c}`); });
    }
  }
  t.check(!used.length, `${tab}: its markup uses no other tab's classes${used.length ? ` (${[...new Set(used)].slice(0, 8).join(', ')})` : ''}`);
}
const twice = [...definedBy].filter(([, by]) => by.size > 1).map(([c, by]) => `${c} (${[...by].join(', ')})`);
t.check(!twice.length, `no class is defined by two tabs${twice.length ? `: ${twice.join(', ')}` : ''}`);

process.exit(t.done() ? 1 : 0);
