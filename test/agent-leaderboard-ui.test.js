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
 * THE BOARD MOVED AGAIN, and got stricter. It is one card on the Money
 * sheet now: your rank, how many agents there are, and a row of bars with
 * yours marked. It reads leaderboard.you and totalAgents and NOTHING from
 * the list of other agents -- not their money, and not their names
 * either. A card that never reads the top five cannot be edited into
 * leaking anything about them. Your own month is the big figure at the
 * top of the same sheet, worked out from your own orders.
 *
 * Run: node test/agent-leaderboard-ui.test.js   (or: npm test)
 */
const { read, extractFunction, createReporter } = require('./_extract');

const t = createReporter('agent leaderboard');
const src = read('agent.html');
const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

/* ---------- 1. nobody else's money is on screen --------------------- */
{
  const fn = read('supabase/functions/agent-leaderboard/index.ts');
  t.check(/const top = ranked\.slice\(0, 5\)\.map\(\(a\) => \(\{ rank: a\.rank, displayName: displayName\(a\.name\), isYou: a\.id === callingAgentId \}\)\)/.test(fn),
    'the API sends only rank, name and isYou for other agents');
  t.check(!/top[\s\S]{0,120}amount/.test(fn.slice(fn.indexOf('const top ='), fn.indexOf('const top =') + 200)),
    'and no amount rides along with them');
  const money = extractFunction(src, 'openMoneySheet', 'agent.html');
  const standing = (/const lb = leaderboard[\s\S]*?const standing = `[\s\S]*?<\/div>`;/.exec(money) || [''])[0];
  t.check(standing.length > 0, 'the standing card is found');
  t.check(!/\.top\b/.test(standing) && !/displayName/.test(standing),
    'it never reads the list of other agents -- not their money, and not their names');
  t.check(!/\.amount|fmtUGX/.test(standing), 'and prints no figure from the board at all');
}

/* ---------- 2. where you stand ------------------------------------ */
{
  const money = extractFunction(src, 'openMoneySheet', 'agent.html');
  t.check(/const lb = leaderboard && leaderboard\.you && leaderboard\.totalAgents >= 2 \? leaderboard : null;/.test(money),
    'a shop with one agent shows no board rather than a board of one');
  t.check(/<b>#\$\{esc\(lb\.you\.rank\)\}<\/b><span>of \$\{esc\(lb\.totalAgents\)\}<\/span>/.test(money),
    'your rank, out of how many');
  t.check(/rank === lb\.you\.rank \? 'you' : ''/.test(money) && /\.ax-podium i\.you\{background:var\(--accent\);\}/.test(src),
    'and your bar is the marked one, in the accent');
  t.check(/computeAgentStats\(\)\.completedOrders/.test(money),
    'with no board to stand on, the card falls back to your own orders done rather than going blank');
  t.check(/streak >= 2/.test(money), 'a running streak is said only once it is a streak');
  const hero = extractFunction(src, 'renderTodayHero', 'agent.html');
  t.check(/leaderboard\.you && leaderboard\.totalAgents >= 2/.test(hero) && /#\$\{esc\(lb\.you\.rank\)\}/.test(hero),
    'Today carries the same rank, under the same one-agent rule');
}

/* ---------- 3. no emoji ------------------------------------------- */
{
  const money = extractFunction(src, 'openMoneySheet', 'agent.html');
  t.check(!/[\u{1F300}-\u{1FAFF}]/u.test(money), 'no medal or trophy emoji -- the streak flame is a drawn icon');
  t.check(/AX_ICON\.flame/.test(money), 'which it is');
}

process.exit(t.done() ? 1 : 0);
