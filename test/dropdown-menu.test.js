#!/usr/bin/env node
'use strict';
/*
 * The dropdown the app draws itself.
 *
 * Reported three times by the owner, and three fixes aimed at the page
 * before this one: a <label> forwarding the click to the control it
 * wrapped, a background refresh redrawing the screen underneath, a quiet
 * period around the poll. All three were real faults and all three
 * landed. The answer never changed — the list appears, the pointer moves
 * toward an option, the list is gone.
 *
 * None of them was it because a native <select>'s list is NOT PART OF
 * THIS PAGE. The browser opens an operating-system window beside the
 * page and draws the options there. Driving a real Chromium under a real
 * X server with real pointer events — every dropdown on every screen,
 * with a shop's worth of data loaded — that window opened and stayed
 * open through layout shifts, page scrolls, option rebuilds, and a full
 * background refresh landing on top of it. The four things that DO close
 * it (blur, and the control being replaced, removed, disabled or hidden)
 * the app was not doing. Nothing this page can reach was closing it.
 *
 * So the app stops asking for that window. On a mouse or a pen the list
 * is drawn HERE, and the <select> stays exactly what it was: the value,
 * the options and the change event all still come from it, so every
 * screen, renderer and test that reads a select is untouched. On a TOUCH
 * screen nothing changes — the phone's own wheel is better than anything
 * drawn here, and the fault was never reported there.
 *
 * Run: node test/dropdown-menu.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('the drawn dropdown');
const src = read('index.html');

/* ---------- 1. the native list is never asked for, and only for a pointer ---------- */
{
  const at = src.indexOf("document.addEventListener('mousedown', (e)=>{\n  const t = e.target;\n  if(owSel.menu");
  t.check(at > 0, 'the press that opens a dropdown is handled in one place');
  const handler = src.slice(at, src.indexOf('}, true);', at));
  t.check(/e\.preventDefault\(\)/.test(handler),
    'and it cancels the press, so the operating system window never opens');
  t.check(/owSelPointerKind !== 'mouse' && owSelPointerKind !== 'pen'/.test(handler),
    "a finger is left alone — the phone's own wheel is better, and was never what broke");
  t.check(/pointerdown[\s\S]{0,80}owSelPointerKind = e\.pointerType/.test(src),
    'and the kind of pointer is read from pointerdown, which is the only event that carries it');
}

/* ---------- 2. a redraw re-binds the open list instead of shutting it ---------- */
{
  const open = extractFunction(src, 'owSelOpen', 'index.html');
  t.check(/MutationObserver/.test(open),
    'the open list watches for the screen being rebuilt underneath it');
  t.check(/document\.getElementById\(owSel\.id\)/.test(open),
    'and re-binds to the redrawn control by id — the thirty-second refresh must not shut a list being read');
  t.check(/owSelClose\(\)/.test(open),
    'closing only when the control is really gone');
  t.check(/focus\(/.test(open),
    "the control keeps the focus, so the refresh's own 'a control is in use' guard still holds the screen still");
}

/* ---------- 3. what it will and will not stand in for ---------- */
const NAMES = ['owSelEligible', 'owSelOptions', 'owSelCommit'];
const events = [];
const owSel = { menu: {}, sel: null, id: '', opts: [], here: -1, type: '', typedAt: 0, mo: null };
const scope = compileScope(
  NAMES.map((n) => extractFunction(src, n, 'index.html')),
  { owSel, owSelClose: () => { owSel.menu = null; } },
  NAMES);

const el = (tag, attrs) => Object.assign({ tagName: tag, disabled: false, multiple: false, size: 0 }, attrs);
{
  const { owSelEligible } = scope;
  t.check(owSelEligible(el('SELECT')) === true, 'a plain dropdown is drawn by the app');
  t.check(owSelEligible(el('SELECT', { disabled: true })) === false, 'a disabled one is left alone');
  t.check(owSelEligible(el('SELECT', { multiple: true })) === false,
    'and a multiple is not a dropdown at all — it is already drawn in the page');
  t.check(owSelEligible(el('SELECT', { size: 4 })) === false, 'nor is a sized list');
  t.check(owSelEligible(el('INPUT')) === false, 'and a box that is typed into is not one either');
  t.check(owSelEligible(null) === false, 'nothing is not one');
}

/* ---------- 4. the options, as the form actually has them ---------- */
{
  const { owSelOptions } = scope;
  const opt = (text, o) => Object.assign({ textContent: text, hidden: false, disabled: false,
    selected: false, parentElement: { tagName: 'SELECT' } }, o);
  const group = { tagName: 'OPTGROUP', label: 'Doors', disabled: false };
  const all = [
    opt('All categories'),
    opt('Hidden one', { hidden: true }),
    opt('Out of stock', { disabled: true }),
    opt('Handles', { parentElement: group }),
  ];
  const out = owSelOptions({ querySelectorAll: () => all });
  t.check(out.length === 3, `a hidden option is left out (${out.length} of 4 drawn)`);
  t.check(out[1].off === true,
    'a disabled one is DRAWN and not choosable — a list that silently drops choices reads as a shorter list, not a restricted one');
  t.check(out[2].group === 'Doors', 'and an option keeps the group it was written in');
}

/* ---------- 5. choosing writes to the select, and says so ---------- */
{
  const { owSelCommit } = scope;
  const make = (value) => ({ value, dispatchEvent(e){ events.push(e.type); return true; } });

  const sel = make('added');
  owSel.sel = sel; owSel.menu = {};
  owSel.opts = [{ el: { value: 'oldest' }, off: false }, { el: { value: 'no' }, off: true }];
  events.length = 0;
  owSelCommit(0);
  t.check(sel.value === 'oldest', 'the choice is written to the select itself, so every reader still reads the select');
  t.check(events.join(',') === 'input,change',
    `and the two events a native list fires are fired from it (got ${events.join(',') || 'none'})`);

  owSel.sel = sel; owSel.menu = {}; events.length = 0;
  owSelCommit(0);
  t.check(events.length === 0,
    'choosing what was already chosen fires nothing, which is what the browser does');

  const sel2 = make('added');
  owSel.sel = sel2; owSel.menu = {}; events.length = 0;
  owSelCommit(1);
  t.check(sel2.value === 'added' && events.length === 0, 'and a disabled option cannot be chosen');
}

/* ---------- 6. the list is above everything it can open over ---------- */
{
  const m = /\.ow-selm\{([^}]*)\}/.exec(src);
  t.check(!!m, 'the drawn list is a component in the layer');
  const z = Number((/z-index:(\d+)/.exec(m ? m[1] : '') || [])[1]);
  const others = [...src.matchAll(/z-index:(\d+)/g)].map((x) => Number(x[1])).filter((n) => n !== z);
  t.check(z > Math.max(...others),
    `and it sits above every other layer in the app (${z} over ${Math.max(...others)}) — a modal's dropdown must not open behind the modal`);
  t.check(/position:fixed/.test(m ? m[1] : ''),
    'anchored to the viewport, so a dropdown inside a scroller is not clipped by it');
}

/* ---------- 7. the refresh asks its question again, after the wait ---------- */
{
  const poll = extractFunction(src, 'pollForUpdatesNow', 'index.html');
  const after = poll.slice(poll.indexOf('const fresh = await loadData'));
  t.check(/owControlInUse\(\) && Date\.now\(\) - lastUserInputAt < 60000/.test(after),
    'the guards are read again AFTER the load, not only before it — a load on a real connection is seconds long, and the owner can start using a control inside that window');
  t.check(/\.modal-overlay\.show/.test(after) && /ap-confirm-pending/.test(after),
    'and a modal or a pending question opened during the wait holds the redraw off too');
}

t.done();
