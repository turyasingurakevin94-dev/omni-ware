#!/usr/bin/env node
'use strict';
/*
 * The Node version CI pins, against the Node version the suite actually
 * needs.
 *
 * These two drifted apart and nobody noticed for months, because the way
 * they told us was the worst possible way: the suite went red and STAYED
 * red. Three tests read the edge functions' TypeScript through
 * `require('module').stripTypeScriptTypes`, which arrived in Node 22.
 * CI pinned 20, so those three threw on every single run -- while passing
 * for anyone whose local Node was newer, which is everyone who wrote them.
 *
 * A suite that is always red is worse than one that fails loudly. Nobody
 * reads the log of a run that is always red, so every other check in it
 * stopped being read too: 313 passing files were reporting into a signal
 * that had already been written off.
 *
 * So the floor is asserted here, from the code rather than from a number
 * somebody remembered. If a test starts needing a newer runtime than CI
 * runs, this fails with the reason in the message instead of that test
 * failing mysteriously somewhere in the middle of 316 files.
 *
 * Run: node test/ci-node-version.test.js   (or: npm test)
 */
const fs = require('fs');
const path = require('path');
const { ROOT, createReporter } = require('./_extract');

const t = createReporter('CI node version');

/* ---------- what the workflows pin ----------------------------------- */
const WF = path.join(ROOT, '.github/workflows');
const workflows = fs.readdirSync(WF).filter((f) => /\.ya?ml$/.test(f)).sort();

t.check(workflows.length > 0, `workflows found (${workflows.join(', ')})`);

const pinned = {};
workflows.forEach((f) => {
  const src = fs.readFileSync(path.join(WF, f), 'utf8');
  // Only the pins that configure the runtime, not a line in a comment.
  const found = [...src.matchAll(/^\s*node-version:\s*'?"?(\d+)/gm)].map((m) => Number(m[1]));
  if (found.length) pinned[f] = found;
});

const names = Object.keys(pinned);
t.check(names.length > 0, `workflows that set up Node (${names.join(', ')})`);

/* ---------- they must agree with each other -------------------------- */
{
  const all = names.reduce((acc, f) => acc.concat(pinned[f]), []);
  const distinct = [...new Set(all)];
  t.check(distinct.length === 1,
    distinct.length === 1
      ? `every workflow pins the same major (${distinct[0]})`
      : `workflows disagree about Node: ${names.map((f) => `${f}=${pinned[f].join('/')}`).join(', ')} — a test that passes in one and not the other is the whole problem`);
}

/* ---------- and with what the tests need ----------------------------- */
{
  // Derived, not remembered. `stripTypeScriptTypes` landed in Node 22; if
  // nothing uses it any more, the floor can come back down deliberately
  // rather than by accident.
  const NEEDS = [
    { api: 'stripTypeScriptTypes', since: 22 },
  ];

  const dir = path.join(ROOT, 'test');
  // Not this file. It names the API in order to look for it, and counting
  // itself would keep the floor propped up long after the last real
  // caller had gone -- the exact self-justifying check this file exists
  // to argue against.
  const SELF = path.basename(__filename);
  const testFiles = fs.readdirSync(dir)
    .filter((f) => f.endsWith('.test.js') && f !== SELF);

  let floor = 0;
  const why = [];
  NEEDS.forEach(({ api, since }) => {
    const users = testFiles.filter((f) => {
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      return new RegExp('\\b' + api + '\\b').test(src);
    });
    if (users.length) {
      if (since > floor) floor = since;
      why.push(`${api} (Node ${since}+) in ${users.length} file(s): ${users.slice(0, 4).join(', ')}${users.length > 4 ? '…' : ''}`);
    }
  });

  t.check(why.length > 0, `the suite's runtime needs are identified — ${why.join('; ')}`);

  const pin = pinned[names[0]][0];
  t.check(pin >= floor,
    pin >= floor
      ? `CI pins Node ${pin}, and the suite needs ${floor}+`
      : `CI pins Node ${pin} but the suite needs ${floor}+ — ${why.join('; ')}. Those tests cannot pass on the runner, and a permanently red suite is a suite nobody reads.`);

  // The runtime running this file right now. A local Node below the floor
  // is the same bug from the other side.
  const here = Number(process.versions.node.split('.')[0]);
  t.check(here >= floor,
    here >= floor
      ? `this runtime is Node ${here}, at or above the floor`
      : `this runtime is Node ${here}, below the ${floor} the suite needs — upgrade before trusting a green run here`);
}

process.exit(t.done() ? 1 : 0);
