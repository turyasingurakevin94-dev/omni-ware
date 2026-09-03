#!/usr/bin/env node
'use strict';
/*
 * The calendar the app draws itself.
 *
 * Same fault as the dropdown, found the same way and answered the same
 * way. A date field's picker is not part of this page: the browser opens
 * an operating-system window beside it — 218x281 of it, watched as an X
 * window under a real X server — which this app cannot style, move, read
 * or keep open, and which on the owner's machine shuts the moment the
 * pointer moves toward a date. Reported after the dropdowns came back:
 * "the mouse still misbehaves when picking dates on a calendar".
 *
 * So the month is drawn here. The <input type="date"> is untouched: it
 * still holds the value, still types, still fires change, so every form,
 * every save and every screen reads the same field it always did.
 *
 * TWO THINGS THIS FILE GUARDS THAT ARE EASY TO GET WRONG:
 *
 *   the browser's button   Cancelling the press does NOT stop it — the
 *                          indicator is in the field's shadow DOM and
 *                          opens the native window on its own. Proven in
 *                          the harness. It is made inert in the
 *                          stylesheet instead, and F4 and Alt+Down, the
 *                          browser's own two keys for it, are taken here.
 *
 *   the day is LOCAL       toISOString() is UTC. This shop is UTC+3, so
 *                          every date picked before 3am — and every date
 *                          at all, read back — would be the day before.
 *                          A date on a price, an invoice or a repayment
 *                          is money in the wrong day's books.
 *
 * Run: node test/date-calendar.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('the drawn calendar');
const src = read('index.html');

/* ---------- 1. no browser can open its own window over ours ---------- */
{
  const rule = /input\[type=date\]::-webkit-calendar-picker-indicator\{pointer-events:none;\}/;
  t.check(rule.test(src), "the browser's own calendar button is inert — cancelling the press does not stop it, because the indicator is in the field's shadow DOM and opens the native window itself");
  const markAt = src.indexOf('THE OW LAYER');
  t.check(src.search(rule) < src.lastIndexOf('/*', markAt),
    'and the rule sits ABOVE the layer, beside what it couples to — an element selector cannot live in a namespace where every rule starts .ow-');

  const at = src.indexOf("document.addEventListener('mousedown', (e)=>{\n  const t = e.target;\n  if(owCal.panel");
  t.check(at > 0, 'the press that opens a calendar is handled in one place');
  const handler = src.slice(at, src.indexOf('}, true);', at));
  t.check(/e\.preventDefault\(\)/.test(handler),
    'it cancels the press as well, for the browsers whose button that pseudo-element does not reach');
  t.check(/owSelPointerKind !== 'mouse' && owSelPointerKind !== 'pen'/.test(handler),
    "and a finger is left alone — the phone's own date wheel is better, and was never what broke");
  t.check(/if\(e\.key === 'F4' \|\| \(e\.altKey && e\.key === 'ArrowDown'\)\)/.test(src),
    "the two keys the browser itself listens for on a date field are taken, so both ways in lead to the same calendar");
}

/* ---------- 2. what it will and will not stand in for ---------- */
const NAMES = ['owCalEligible', 'owCalISO', 'owCalDate', 'owCalAllowed', 'owCalCommit'];
const owCal = { panel: {}, inp: null, id: '', view: null, here: '', mo: null };
const scope = compileScope(
  NAMES.map((n) => extractFunction(src, n, 'index.html')),
  { owCal, owCalClose: () => { owCal.panel = null; } },
  NAMES);
{
  const { owCalEligible } = scope;
  const inp = (over) => Object.assign({ tagName: 'INPUT', type: 'date', disabled: false, readOnly: false }, over);
  t.check(owCalEligible(inp()) === true, 'a date field gets the drawn calendar');
  t.check(owCalEligible(inp({ type: 'text' })) === false, 'a box that is typed into does not');
  t.check(owCalEligible(inp({ type: 'number' })) === false, 'nor does a figure');
  t.check(owCalEligible(inp({ disabled: true })) === false, 'a disabled field is left alone');
  t.check(owCalEligible(inp({ readOnly: true })) === false,
    'and so is one that is only being read — offering a calendar over a value nobody may change is a lie about what the screen will do');
}

/* ---------- 3. the day is the LOCAL day ---------- */
{
  const { owCalISO, owCalDate } = scope;
  t.check(!/toISOString/.test(extractFunction(src, 'owCalISO', 'index.html')),
    'the day is read off the local date, never through toISOString — that is UTC, and this shop is UTC+3');
  // 1 January, ten past midnight: UTC would call this 31 December.
  t.check(owCalISO(new Date(2026, 0, 1, 0, 10)) === '2026-01-01',
    'so ten past midnight on the first is the first, not the last day of the year before');
  t.check(owCalISO(new Date(2026, 8, 3)) === '2026-09-03', 'and a day is padded to the form every date on file takes');
  const d = owCalDate('2026-09-03');
  t.check(d && d.getFullYear() === 2026 && d.getMonth() === 8 && d.getDate() === 3,
    'a stored date reads back as the same day');
  t.check(owCalDate('') === null && owCalDate('rubbish') === null && owCalDate('2026-9-3') === null,
    'and anything that is not one reads back as nothing, rather than as some other day');
}

/* ---------- 4. what the field will accept ---------- */
{
  const { owCalAllowed } = scope;
  owCal.inp = { min: '2026-09-01', max: '2026-09-30' };
  t.check(owCalAllowed('2026-09-15') === true, 'a day inside what the field allows is choosable');
  t.check(owCalAllowed('2026-08-31') === false && owCalAllowed('2026-10-01') === false,
    'and a day outside it is not — before the floor or after the ceiling');
  owCal.inp = { min: '', max: '' };
  t.check(owCalAllowed('1999-01-01') === true, 'a field with no limits allows any day');
  const back = extractFunction(src, 'owCalPaint', 'index.html');
  t.check(/ow-off/.test(back) && /ow-out/.test(back),
    'a day outside the limits is DRAWN and not choosable, and so is one from the month either side — a month with days missing reads as a broken calendar, not as a limit');
  t.check(/const lead = \(first\.getDay\(\) \+ 6\) % 7;/.test(back),
    "and the week starts on Monday, as the shop's own week does on the staff sheet");
}

/* ---------- 5. choosing writes to the field, and says so ---------- */
{
  const { owCalCommit } = scope;
  const events = [];
  const field = (value) => ({ value, min: '', max: '',
    dispatchEvent(e){ events.push(e.type); return true; } });

  let f = field('2026-09-03');
  owCal.inp = f; owCal.panel = {}; events.length = 0;
  owCalCommit('2026-09-17');
  t.check(f.value === '2026-09-17', 'the day is written to the field itself, so every form and every save still reads the field');
  t.check(events.join(',') === 'input,change',
    `and the two events a native picker fires are fired from it (got ${events.join(',') || 'none'})`);

  owCal.inp = f; owCal.panel = {}; events.length = 0;
  owCalCommit('2026-09-17');
  t.check(events.length === 0, 'choosing the day already there fires nothing');

  f = field('2026-09-03'); owCal.inp = f; owCal.panel = {}; events.length = 0;
  owCalCommit('');
  t.check(f.value === '' && events.join(',') === 'input,change',
    'and "no date" is a real answer, announced like any other — a field nobody has dated is not today');

  f = field('2026-09-03'); f.min = '2026-09-10';
  owCal.inp = f; owCal.panel = {}; events.length = 0;
  owCalCommit('2026-09-01');
  t.check(f.value === '2026-09-03' && events.length === 0, 'a day the field will not accept cannot be chosen');
}

/* ---------- 6. it survives what a native picker cannot ---------- */
{
  const open = extractFunction(src, 'owCalOpen', 'index.html');
  t.check(/MutationObserver/.test(open) && /document\.getElementById\(owCal\.id\)/.test(open),
    'a redraw landing on an open calendar re-binds it to the rebuilt field rather than shutting it');
  t.check(/focus\(/.test(open),
    "and the field keeps the focus, so the background refresh's own 'a control is in use' guard holds the screen still while a date is being picked");
  t.check(/owSelClose\(\);/.test(open) && /owCalClose\(\);/.test(extractFunction(src, 'owSelOpen', 'index.html')),
    'a calendar and a dropdown are never both up — each shuts the other');

  /* One placement, used by both panels. Two answers to "where does this
     hang" is how the two of them drift apart. */
  t.check(/function owPanelPlace\(anchor, panel, tallest\)/.test(src),
    'the two drawn panels share one answer to where they hang off their control');
  t.check(/owPanelPlace\(sel, menu, 288\)/.test(extractFunction(src, 'owSelPlace', 'index.html'))
    && /owPanelPlace\(inp, panel, 0\)/.test(open),
    'and both actually use it');
}

t.done();
