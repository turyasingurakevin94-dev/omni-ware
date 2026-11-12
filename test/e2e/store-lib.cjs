'use strict';
/*
 * What the Store flows add to lib.cjs (test/e2e/store-flows.cjs runs them).
 *
 *   - The demo's own day, read, never written: the page loads store-demo.js, whose storeDemo() the
 *     app calls once; an init script keeps the instance it returns as window.__storeDemo, so a flow can
 *     check what a tap wrote (an order's stage, a trip's check-in) in the books themselves.
 *   - A tap counter (FLOW.md §5 counts a press or a slide from a fresh open).
 *   - The tone of a bar (amber No signal, red That did not save) from its own colour.
 */

/** Runs in the page before it loads: wraps window.owStoreDemo.storeDemo to keep the demo it makes. */
function keepDemo() {
  let v;
  Object.defineProperty(window, 'owStoreDemo', {
    configurable: true,
    get: () => v,
    set: (x) => { v = { ...x, storeDemo: (...a) => (window.__storeDemo = x.storeDemo(...a)) }; },
  });
}

/** The phone defaults of every Store flow (runner.cjs `phone`). */
const PHONE = { init: [keepDemo] };

/** An order of the demo's day as it stands now (a plain copy), or null. */
const order = (ph, id) => ph.p.evaluate((n) => {
  const o = window.__storeDemo && window.__storeDemo.day.orders.find((x) => x.id === n);
  return o ? JSON.parse(JSON.stringify(o)) : null;
}, id);

/** The demo's trips (a plain copy). */
const trips = (ph) => ph.p.evaluate(() => JSON.parse(JSON.stringify(window.__storeDemo.day.trips)));

/** The demo's returns (a plain copy). */
const returns = (ph) => ph.p.evaluate(() => JSON.parse(JSON.stringify(window.__storeDemo.day.returns)));

/**
 * Counts the taps a job takes: every tap and slide through it is one (FLOW.md §5: "a tap is a press or a
 * slide"); typed text is not. `c.n` is the count so far.
 */
function counter(ph) {
  const c = {
    n: 0,
    log: [],
    async tap(target, settle, o) { c.n++; c.log.push(JSON.stringify(target).slice(0, 60)); await ph.tap(target, settle, o); },
    async slide(sel, settle) { c.n++; c.log.push('slide'); await ph.slide(sel, settle); },
  };
  return c;
}

/**
 * The tone of the smallest bar (role status or alert, or a *-bar / notice) whose words match `re`:
 * 'amber', 'red', or null when there is none. From its painted colour (a white card's: its border), so a
 * renamed class cannot fool it.
 */
const barTone = (ph, re) => ph.p.evaluate((src) => {
  const rx = new RegExp(src);
  const els = [...document.querySelectorAll('#app [role=status], #app [role=alert], #app [class*="bar"], #app [class*="notice"], #app [class*="fail"]')]
    .filter((el) => el.getBoundingClientRect().height > 0 && rx.test(el.innerText || ''))
    .sort((a, b) => (a.innerText || '').length - (b.innerText || '').length);
  const rgb = (c) => { const m = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/.exec(c); return m && m[4] !== '0' ? [Number(m[1]), Number(m[2]), Number(m[3])] : null; };
  for (const el of els) {
    const cs = getComputedStyle(el);
    let c = rgb(cs.backgroundColor);
    // A white card says its tone by its border (PK12's "Not done · that did not save" card).
    if (c && c.every((x) => x >= 250) && parseFloat(cs.borderLeftWidth) > 0) c = rgb(cs.borderLeftColor);
    if (!c || c.every((x) => x >= 250)) continue;
    const [r, g, b] = c;
    // Amber: warm, green well above blue (253 238 225). Red: green and blue together, under red (251 229 226).
    if (r > g && g - b >= 8) return 'amber';
    if (r - g >= 15 && Math.abs(g - b) < 8) return 'red';
    return `other rgb(${r}, ${g}, ${b})`;
  }
  return null;
}, re.source);

/** The visible slide or locked slide's words. */
const slideWords = (ph) => ph.p.evaluate(() => {
  const k = [...document.querySelectorAll('.ow-knob, .ow-lslide')].find((x) => x.getBoundingClientRect().height > 0);
  return k ? (k.getAttribute('aria-label') || k.innerText || '').replace(/\s+/g, ' ').trim() : '';
});

module.exports = { PHONE, order, trips, returns, counter, barTone, slideWords };
