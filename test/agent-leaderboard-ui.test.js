#!/usr/bin/env node
'use strict';
/*
 * The leaderboard card on the agent Home screen.
 *
 * It showed "You're #3 of 12 this month" and then a list of ranks and
 * names -- a rank with nothing to explain it, and a board that did not
 * contain you at all once you fell out of the top five.
 *
 * The constraint that shapes this: agent-leaderboard returns rank,
 * displayName and isYou for other agents, and NOTHING else. No amount, no
 * order count. That is deliberate -- a ranking is not a payslip anyone
 * else gets to read -- so there are no bars and no figures beside another
 * agent's name, and there must never be. Your own amount and completed
 * orders ARE returned, and were being discarded.
 *
 * THE BOARD MOVED. It was a card on Home; it is the Standing screen now,
 * built by renderStanding() in the .fx- layer. Every decision below is
 * unchanged and every one is still worth pinning -- the selectors and the
 * function name are what moved. Two things got STRICTER on the way, both
 * because this file asked for them: the row builder renders no money at
 * all now rather than conditionally printing your own (a builder that
 * cannot print a figure cannot be edited into leaking one), and your own
 * total is stated once above the list where it belongs to you.
 *
 * Run: node test/agent-leaderboard-ui.test.js   (or: npm test)
 */
const { read, createReporter } = require('./_extract');

const t = createReporter('agent leaderboard');
const src = read('agent.html');
const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

/* ---------- 1. nobody else's money is on screen --------------------- */
/*
 * The property worth guarding above every visual one. Checked at the
 * source too, because a future change there is what would make a leak
 * here possible.
 */
{
  const fn = read('supabase/functions/agent-leaderboard/index.ts');
  t.check(/const top = ranked\.slice\(0, 5\)\.map\(\(a\) => \(\{ rank: a\.rank, displayName: displayName\(a\.name\), isYou: a\.id === callingAgentId \}\)\)/.test(fn),
    'the API sends only rank, name and isYou for other agents');
  t.check(!/top[\s\S]{0,120}amount/.test(fn.slice(fn.indexOf('const top ='), fn.indexOf('const top =') + 200)),
    'and no amount rides along with them');

  // The row builder may only read those three fields.
  //
  // Bounded at the </li> that actually ends it. The first version of this
  // also allowed "up to the next `\n  };`" as a fallback, and since the
  // builder does not end that way, that alternative ran on through
  // unrelated code until it hit one -- eventually swallowing an fmtUGX
  // belonging to a different function and reporting a leak that was not
  // there. A regex that can match past its subject is not a check.
  const rowFn = /const row = \(a\)=>[\s\S]*?<\/li>`;/.exec(code);
  const rowSrc = rowFn ? rowFn[0] : '';
  t.check(rowSrc.length > 0 && rowSrc.length < 400,
    `the row builder is found, and only the row builder (${rowSrc.length} chars)`);
  t.check(!/amount|fmtUGX|completedOrders/.test(rowSrc),
    'a leaderboard row renders no money at all');
}

/* ---------- 2. your own figures, which were being discarded --------- */
{
  t.check(/const you = leaderboard\.you;/.test(code), 'your entry is read');
  t.check(/fmtUGX\(you\.amount\|\|0\)/.test(code),
    'and your amount is shown -- it was in the response and thrown away');
  t.check(/esc\(you\.completedOrders\|\|0\)\} completed order/.test(code),
    'with the order count that explains it');
  t.check(/\$\{\(you\.completedOrders\|\|0\)===1\?'':'s'\}/.test(code),
    'pluralised, since a new agent sees exactly one');
}

/* ---------- 3. the board always contains you ------------------------ */
/*
 * A board that does not include you is a board about other people. The
 * skipped ranks are marked rather than quietly closed up, so #5 followed
 * by #9 does not read as a numbering error.
 */
{
  t.check(/const inTop = leaderboard\.top\.some\(a=>a\.isYou\);/.test(code),
    'whether you are already listed is worked out');
  t.check(/const tail = inTop \? '' :/.test(code),
    'and your row is appended only when you are not');
  t.check(/fx-board-gap/.test(code) && /&middot; &middot; &middot;/.test(code),
    'with the run of ranks between marked as skipped');
  t.check(/row\(\{ rank: you\.rank, isYou: true, displayName: 'You' \}\)/.test(code),
    'the appended row carries your real rank, not a sixth place');
}

/* ---------- 4. rank as a mark, and no medals ------------------------ */
{
  t.check(/a\.rank<=3 && !a\.isYou\?' podium':''/.test(code),
    'the top three carry weight, and your own row is not double-marked');
  t.check(/\.fx-board li\.podium \.pos\{background:var\(--fx-ink\)/.test(src),
    'the podium is a filled mark, not a medal emoji');
  t.check(/\.fx-board li\.you \.pos\{background:var\(--fx-oxide\)/.test(src),
    'and your own rank is the accent, which outranks the podium treatment');
  t.check(!/[\u{1F300}-\u{1FAFF}]/u.test(/fx-board[\s\S]{0,900}/.exec(src)?.[0] || ''),
    'no emoji anywhere in the board');

  // The duplicate that was sitting in the stylesheet.
  t.check((src.match(/\.fx-board li\.you \.pos\{/g) || []).length === 1,
    'the duplicated .you .rank rule is gone');
}

/* ---------- 5. it hides when there is nothing to rank --------------- */
{
  t.check(/leaderboard\.totalAgents < 2\)\{ sec\.style\.display = 'none'; \}/.test(code),
    'a shop with one agent shows no board rather than a board of one');
}

process.exit(t.done() ? 1 : 0);
