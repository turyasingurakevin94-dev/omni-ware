#!/usr/bin/env node
'use strict';
/*
 * An order nobody is preparing has to be visible, and re-assignable.
 *
 * denyOrderAssignment clears assignedWorkerId and pickingStatus but leaves
 * the order in Being Prepared -- correctly, since it still needs picking.
 * The board's card only drew an assignee row when there WAS an assignee, so
 * a declined order looked exactly like one being worked on, minus a line
 * nobody would notice was missing.
 *
 * And there was no way to put it back on somebody. The forward arrow from
 * Being Prepared asks for a DELIVERY person, so the obvious move sent an
 * unpicked order out for delivery. The only real route was stepping back to
 * Draft and forward again -- two non-obvious clicks that also throw the pick
 * away.
 *
 * Same modal the first assignment goes through, given the status the order is
 * already in, so setSavedQuoteStatus leaves stageEnteredAt alone and
 * re-assigning does not reset how long the order has been waiting.
 *
 * Run: node test/admin-reassign-declined.test.js   (or: npm test)
 */
const { read, extractFunction, createReporter } = require('./_extract');

const t = createReporter('admin reassign declined');
const admin = read('index.html');
const shared = read('shared-worker.js');

/* ---------- 1. the card says when nobody is on it --------------------- */
{
  t.check(/\$\{\(q\.status==='preparing' && !q\.assignedWorkerId\) \? `<div class="sq-assignee-row sq-unassigned"/.test(admin),
    'an order in Being Prepared with no worker draws its own row');
  t.check(/<span class="sq-assignee-name">Nobody assigned<\/span>/.test(admin),
    'and says so in words');
  t.check(/class="sq-assign-btn" data-id="\$\{q\.id\}"/.test(admin),
    'with a button to put it on somebody');

  // The two rows are mutually exclusive: one assignee line, never both.
  const assigned = /\(q\.status==='preparing' && q\.assignedWorkerId\)/.test(admin);
  const unassigned = /\(q\.status==='preparing' && !q\.assignedWorkerId\)/.test(admin);
  t.check(assigned && unassigned, 'the assigned and unassigned rows are conditioned on opposites');
}

/* ---------- 2. the button opens the assignment the first one uses ----- */
{
  t.check(/querySelectorAll\('\.sq-assign-btn'\)\.forEach\(btn=>btn\.addEventListener\('click', \(\)=>openAssignStaffModal\(Number\(btn\.dataset\.id\), 'preparing', 'worker'\)\)\)/.test(admin),
    "it opens the worker picker for the stage it is already in");

  // Which matters: openAssignStaffModal ends by calling setSavedQuoteStatus,
  // and re-entering the same stage must not restamp it.
  const setStatus = extractFunction(admin, 'setSavedQuoteStatus', 'index.html');
  t.check(/if\(q\.status===status\)/.test(setStatus) || /q\.status!==status/.test(setStatus),
    'and setSavedQuoteStatus only restamps stageEnteredAt on a real move');
}

/* ---------- 3. what the modal writes is what the worker app reads ----- */
{
  // The picker's row handler is the single place a worker assignment is made
  // from the board; a declined order now goes back through it unchanged.
  const modal = admin.slice(admin.indexOf('function openAssignStaffModal'), admin.indexOf('function closeAssignStaffModal'));

  // The worker id is written through the role->field map rather than by
  // name, which is the point: 'worker' resolves to assignedWorkerId, so the
  // re-assignment goes through exactly the same path as the first one.
  t.check(/order\[STAGE_ASSIGNMENT_FIELD\[role\]\] = row\.dataset\.id;/.test(modal),
    'assigning writes the id through the role-to-field map');
  t.check(/STAGE_ASSIGNMENT_FIELD = \{ worker: 'assignedWorkerId'/.test(admin),
    "and 'worker' maps to assignedWorkerId");

  ["pickingStatus = 'awaiting_accept'", 'pickCursor = 0', 'pickingAssignedAt'].forEach((bit) => {
    t.check(modal.includes(bit), `assigning sets ${bit}`);
  });

  // awaiting_accept is what makes it appear on the worker's device -- their
  // app lists that and in_progress, nothing else.
  const mine = extractFunction(shared, 'renderWorkerView', 'shared-worker.js');
  t.check(/pickingStatus==='awaiting_accept'/.test(mine),
    'and awaiting_accept is exactly what the worker app puts in the pending list');
}

/* ---------- 4. declining is what creates this state ------------------- */
{
  const deny = extractFunction(shared, 'denyOrderAssignment', 'shared-worker.js');
  t.check(/q\.assignedWorkerId = null;/.test(deny) && /q\.pickingStatus = null;/.test(deny),
    'declining clears both the worker and the picking status');
  t.check(!/q\.status/.test(deny),
    'and leaves the order in Being Prepared, which is why the board needs to show it');
}

/* ---------- 5. the affordance is reachable with a finger -------------- */
{
  // This board has a mobile step-switcher, so it is used on phones. The pill
  // is 19px tall; the ring is what the finger actually lands on.
  t.check(/\.sq-assign-btn\{[^}]*position:relative;/.test(admin),
    'the button is positioned so a hit area can be hung off it');
  const ring = admin.match(/\.sq-assign-btn::after\{content:"";position:absolute;inset:(-?\d+)px (-?\d+)px;\}/);
  t.check(!!ring, 'and it has one');
  if (ring) {
    const vertical = 19.3 + Math.abs(Number(ring[1])) * 2;
    const horizontal = 55.2 + Math.abs(Number(ring[2])) * 2;
    t.check(vertical >= 44, `which brings it to ${vertical.toFixed(0)}px tall, at or over the 44px minimum`);
    t.check(horizontal >= 44, `and ${horizontal.toFixed(0)}px wide`);
  }
}

process.exit(t.done() ? 1 : 0);
