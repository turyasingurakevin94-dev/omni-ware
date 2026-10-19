#!/usr/bin/env node
'use strict';
/*
 * Goal milestones, celebrated.
 *
 * Agents chase their monthly goal, and crossing a quarter, half or three
 * quarters of it -- or the goal itself -- used to pass without a word.
 * Each now gets a moment of its own, once, on the agent's phone, the next
 * time the screen is free; and Today keeps the win on show for the rest
 * of the month. These pin when it plays and what it says.
 *
 * Run: node test/agent-goal-wins.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('agent goal wins');
const src = read('agent.html');
const fn = (name) => extractFunction(src, name, 'agent.html');

/* ---------- 1. which milestone, and which order took it over ---------- */
{
  const myOrders = [
    { id: 3, date: '2026-10-09', status: 'pending_delivery', items: [{ agentSellPrice: 1300, sellPrice: 1000, qty: 500, bonusCommission: 5000 }] },  // +150,000
    { id: 1, date: '2026-10-02', status: 'completed', items: [{ agentSellPrice: 1100, sellPrice: 1000, qty: 1000, bonusCommission: 20000 }] },     // +120,000
    { id: 2, date: '2026-10-05', status: 'completed', items: [{ agentSellPrice: 1200, sellPrice: 1000, qty: 500 }], voided: true },                // never happened
    { id: 4, date: '2026-10-12', status: 'completed', items: [{ agentSellPrice: 1500, sellPrice: 1000, qty: 400 }] },                              // +200,000
    { id: 5, date: '2026-09-30', status: 'completed', items: [{ agentSellPrice: 2000, sellPrice: 1000, qty: 900 }] },                              // last month
  ];
  const api = compileScope(['agentLinePriced', 'orderEarnings', 'goalTimeline', 'goalStepReached'].map(fn),
    { myOrders, GOAL_STEPS: [25, 50, 75, 100] }, ['goalTimeline', 'goalStepReached']);
  const tl = api.goalTimeline('2026-10', 600000);
  t.check(tl.total === 470000, `the month's earnings count as Money counts them: margin always, the bonus once completed (${tl.total})`);
  t.check(tl.at[25].order.id === 3 && tl.at[50].order.id === 4 && tl.at[75].order.id === 4 && !tl.at[100],
    'each milestone remembers the order that took the total over it, in the order they happened -- one order can cross two');
  t.check(tl.at[75].before === 270000, 'and where the total stood just before it, so the ring can show that order\'s part');
  t.check(api.goalStepReached(470000, 600000) === 75 && api.goalStepReached(600000, 600000) === 100 && api.goalStepReached(100000, 600000) === 0,
    'the highest milestone crossed is the one celebrated');
  t.check(api.goalStepReached(900000, 0) === 0, 'and with no goal set there is nothing to celebrate');
}

/* ---------- 2. once, and only something new ------------------------- */
{
  const due = fn('goalWinDue');
  t.check(/if\(!\(p\.target > 0\)\) return null;/.test(due), 'only a goal the agent set counts -- "your best month" is a yardstick, not a promise');
  t.check(/if\(!seen \|\| seen\.t !== p\.target\)\{\s*if\(!seen && m === 100\) return \{ p, m, save \};\s*save\(m\);\s*return null;/.test(due),
    'a new month or a new goal starts quietly from where the agent is, except a goal already hit');
  t.check(/return m > seen\.m \? \{ p, m, save \} : null;/.test(due), 'after that, only a milestone higher than the last one celebrated');
  const may = fn('maybeCelebrateGoal');
  t.check(/due\.save\(due\.m\);[\s\S]*openGoal/.test(may), 'and it is marked as seen before it plays, so it plays once');
  t.check(/openSheets\.length/.test(may) && /\.ax-sent2, \.ax-thanks, \.ax-goalwin/.test(may),
    'it never cuts into a sheet, the Sent animation or the thank-you -- it waits for the screen to be free');
}

/* ---------- 3. when it gets its chance -------------------------------- */
t.check(/if\(!openSheets\.length\) setTimeout\(afterSheetsClosed, 500\);/.test(src),
  'when the last sheet closes -- after the order that did it, sent or completed');
t.check(/const close = \(\)=>\{ if\(el\.parentNode\)\{ el\.remove\(\); setTimeout\(afterSheetsClosed, 400\); \} \};/.test(src),
  'when the thank-you closes');
t.check(/startAgentPush\(\);\s*setTimeout\(maybeCelebrateGoal, 1200\);/.test(src), 'and when the app opens');
t.check(/if\(maybeCelebrateGoal\(\)\) return;\s*if\(pushAskDue\) maybeAskForPush\(\);/.test(fn('afterSheetsClosed')),
  'a milestone goes before the one-time notifications ask, never on top of it');
t.check(/\.ax-goalwin \[data-gw-close\]/.test(src), 'the phone\'s back button closes it');

/* ---------- 4. what it says ---------------------------------------- */
{
  const step = fn('openGoalStep');
  t.check(/took you over/.test(step) && /goalGapClients\(left/.test(step) && /Keep going/.test(step),
    'a milestone names the client whose order did it, shows the usual orders that would finish the goal, and moves on');
  const done = fn('openGoalDone');
  t.check(/days? early|day\$\{early === 1/.test(done) && /Who got you here/.test(done) && /Aim higher/.test(done),
    'the goal itself: how early, who got the agent there, and a bigger goal one tap away');
  t.check(/saveAgentGoal\(higher/.test(done) && /p\.target \* 1\.3/.test(done), 'which is saved straight away, and never more than 30% above the goal just hit');
  const hero = fn('renderTodayHero');
  t.check(/const hit = p\.target > 0 && p\.earned >= p\.target;/.test(hero) && /Goal hit/.test(hero) && /over<\/span>|over`/.test(hero),
    'Today keeps the win on show: the bar full, "Goal hit" and how far over');
}

process.exit(t.done() ? 1 : 0);
