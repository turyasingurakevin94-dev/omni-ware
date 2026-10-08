#!/usr/bin/env node
'use strict';
/*
 * The goal: setting a number, and then seeing where you are against it.
 *
 * The first goal sheet was only a form -- a number box and a few
 * suggestions. Once a goal was set there was nowhere to watch it. Now the
 * ring on Today opens one sheet that does both: how far along, ahead of or
 * behind the month's pace, the day today's pace crosses the goal, and which
 * clients' usual orders would close the gap -- with the goal figure itself
 * the field you type into, and everything redrawn as it changes.
 *
 * Run: node test/agent-goal.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('agent goal');
const src = read('agent.html');

/* ---------- 1. pace and finish day ------------------------------------ */
{
  const target = 600000;
  let earned = 412500;
  const env = {
    currentMonthKey: () => '2026-10',
    monthEarnings: () => ({ total: earned, orders: [] }),
  };
  const { goalFigures } = compileScope([extractFunction(src, 'goalFigures', 'agent.html')], env, ['goalFigures']);
  const now = new Date(2026, 9, 8);
  let g = goalFigures(now, target);
  t.check(g.dim === 31 && g.day === 8 && g.days === 23 && g.left === 187500, `the month is read from the calendar (${g.dim}/${g.day}/${g.days})`);
  t.check(g.ahead === 13, `412,500 by the 8th of a 600,000 month is 13 days ahead of pace (${g.ahead})`);
  t.check(Math.ceil(g.finishDay) === 12, `and at that pace the goal falls on the 12th (${g.finishDay.toFixed(2)})`);

  earned = 50000;
  g = goalFigures(now, target);
  t.check(g.ahead === -5, `50,000 by the 8th is 5 days behind (${g.ahead})`);
  t.check(g.finishDay > g.dim, 'and at that pace the month ends short of the goal');

  earned = 0;
  t.check(goalFigures(now, target).finishDay === Infinity, 'nothing earned yet is no pace at all, not a finish day');

  earned = 700000;
  g = goalFigures(now, target);
  t.check(g.left === 0 && g.finishDay === g.day, 'a goal already passed has nothing left');
}

/* ---------- 2. the gap is closed by clients due this month ------------ */
{
  const clients = [
    { id: 'A', name: 'Late', cad: { avgGapDays: 14, daysSince: 18, avgMargin: 30000 } },
    { id: 'B', name: 'Due soon', cad: { avgGapDays: 10, daysSince: 7, avgMargin: 60000 } },
    { id: 'C', name: 'Next month', cad: { avgGapDays: 40, daysSince: 2, avgMargin: 90000 } },
    { id: 'D', name: 'Gone quiet', cad: { avgGapDays: 14, daysSince: 75, avgMargin: 90000 } },
    { id: 'E', name: 'Due later', cad: { avgGapDays: 20, daysSince: 5, avgMargin: 98000 } },
  ];
  const env = {
    agentClients: clients,
    clientOrderCounts: () => new Map(),
    clientCadence: (c) => c.cad,
  };
  const { goalGapClients } = compileScope([extractFunction(src, 'goalGapClients', 'agent.html')], env, ['goalGapClients']);
  const r = goalGapClients(80000, new Date(2026, 9, 8), 23);
  t.check(r.pick.map((x) => x.client.id).join() === 'A,B', `most overdue first, and only until the gap is covered (${r.pick.map((x) => x.client.id)})`);
  t.check(r.sum === 90000, 'their usual earnings are what covers it');
  const all = goalGapClients(10000000, new Date(2026, 9, 8), 23).pick.map((x) => x.client.id);
  t.check(!all.includes('C') && !all.includes('D'), 'never a client not due this month, nor one gone quiet');
  t.check(all.join() === 'A,B,E', `the rest follow in the order they come due (${all})`);
}

/* ---------- 3. one sheet, wired ------------------------------------- */
{
  const { goalFigures } = compileScope([extractFunction(src, 'goalFigures', 'agent.html')],
    { currentMonthKey: () => '2026-10', monthEarnings: () => ({ total: 100000, orders: [] }) }, ['goalFigures']);
  const g = goalFigures(new Date(2026, 9, 8), 0);
  t.check(g.target === 0 && g.left === 0 && g.ahead === 0, 'with no goal there is no gap and no pace to be ahead of or behind');
  t.check(/getElementById\('ag_ringBtn'\)\.addEventListener\('click', \(\)=> openGoalSheet\(\)\)/.test(src), 'the ring opens the goal');
  t.check(!/openGoalSetSheet/.test(src), 'there is no second sheet for setting it');
  const open = extractFunction(src, 'openGoalSheet', 'agent.html');
  t.check(/class="ax-gin">of<input type="text" inputmode="numeric" id="ag_goalInput"/.test(open), 'the goal figure under the gauge is the field');
  t.check(/input\.addEventListener\('input', \(\)=>\{[\s\S]*?paint\(\);\s*\}\);/.test(open), 'and everything redraws as it is typed');
  t.check(/input\.addEventListener\('change', keep\)/.test(open) && /value = presets\[Number\(p\.dataset\.preset\)\]\.v;[\s\S]*?keep\(\);/.test(open),
    'a new number is kept on leaving the field or picking a chip -- no save step');
  t.check(/if\(!\(value > 0\) \|\| value === saved\) return;/.test(open), 'and an unchanged or empty number is never written');
  t.check(/data-usual=/.test(open) && /orderUsual\(c\)/.test(open), 'a client in the gap list is one tap from their usual order');
  t.check(/if\(e\.target\.closest\('\[data-goal\]'\)\)\{ openGoalSheet\(\{ edit: true \}\); return; \}/.test(src), 'the goal button on Money opens it ready to type');
}

process.exit(t.done() ? 1 : 0);
