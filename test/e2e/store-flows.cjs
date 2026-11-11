#!/usr/bin/env node
'use strict';
/*
 * The new Store app end to end: its main flows on next/store.html?demo, from Today, by real taps (a slide is
 * a real drag), at 360 × 800, with zero console errors. The runner and the guards are Sales' (runner.cjs,
 * lib.cjs); the Store's own helpers are store-lib.cjs; the flows store-yard.cjs and store-checks.cjs.
 *
 *   npm run e2e:store                     (after npm run build:store)
 *   npm run e2e:store -- checkin taps     only the flows named
 *
 * Flows (FACTS: docs/canvas/store-agent/FACTS.md; paths as test/parity/store-*.json; taps: docs/audit/store/FLOW.md §5):
 *   pack-load-deliver  #0552: last line short → Packed bay 1 · 13:15 To load, Ssali, All on, slide → On the road
 *                      · 14:05 the door's shutter → Delivered, Undo chip
 *   collect            #0556 they collect: 2 lines → Ready to collect → the gate's slide → Delivered · collected;
 *                      #0554 the agent's code 0554; #0555 Not paid yet held at the gate
 *   checkin            11:30 Denis's trip, blind: 3 quick tiles, Never came on the line that differs, slide → Sent to Ruth · 1 differs
 *   return             #0548 at the gate: photo, Send to Ruth
 *   offline            &offline: the check-in kept (amber, Not sent yet); the signal back sends it
 *   offline-pack       &offline: #0552's last line kept; the signal back sends it and the order finishes
 *   failed             &fail=checkIn / &fail=pick: red "That did not save · tell Kevin · code"; Try again goes
 *   taps               the jobs' tap counts against FLOW.md §5
 *
 * Every flow also fails on any console error or pageerror, and on any screen wider than the phone. Buttons and
 * links under 44 × 44 are listed, not failed. A failure is a finding: never soften a check to get green.
 */
const R = require('./runner.cjs');
const { PHONE } = require('./store-lib.cjs');
const Y = require('./store-yard.cjs');
const C = require('./store-checks.cjs');

const FLOWS = {
  'pack-load-deliver': Y.packLoadDeliver,
  collect: Y.collect,
  checkin: Y.checkin,
  return: Y.returnAtGate,
  offline: C.offline,
  'offline-pack': C.offlinePack,
  failed: C.failed,
  taps: C.taps,
};

R.main({ app: 'store', flows: FLOWS, phone: PHONE });
