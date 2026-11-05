'use strict';
/*
 * Room on a real phone (test/e2e/sales-flows.cjs runs it): 360 × 800, more data than any board draws
 * (&state=stretched: 30 owe, 20 paid today, 20 live, 12 chats waiting, long names, 9-digit amounts),
 * the phone's large text at 130%, and the clock's bar 24 px tall over the page (edge to edge).
 * On every screen, as well as the guards every flow carries (nothing wider than the phone):
 *   - no tab label leaves its slot, overlaps another, or comes nearer the screen's edge than at 100%
 *     (the boards put "Customers" 3 px from it: the bar has no more room);
 *   - nothing sits under the clock's bar (every part at the top makes room for --app-top);
 *   - no words run off the screen unless they are in a row that slides sideways;
 *   - no words drawn over other words.
 *
 * The large text, as Android's WebView applies it (textZoom: every font size times the zoom, lengths
 * kept): every font-size in the page's CSS and inline styles is multiplied by 1.3 before it paints.
 */
const ZOOM = 1.3, BAR = 24;

/** In the page, before it loads: the phone's text zoom and its status bar. */
function phoneLike([zoom, bar]) {
  const scale = (v) => (!v || /(%|em|rem)$|^(inherit|initial|unset|larger|smaller)$/.test(v) ? null : `calc((${v}) * ${zoom})`);
  const done = new WeakSet();
  const rules = (list) => { for (const r of list) { if (r.style) { const n = scale(r.style.fontSize); if (n) r.style.fontSize = n; } if (r.cssRules) rules(r.cssRules); } };
  const sheets = () => { for (const s of document.styleSheets) { if (done.has(s)) continue; try { rules(s.cssRules); done.add(s); } catch (_e) { /* not ours */ } } };
  // An inline size is scaled once: the page writes a new one when it re-renders (data-tz keeps what we wrote).
  const inline = (el) => { if (!el.style || !el.style.fontSize || el.dataset.tz === el.style.fontSize) return; const n = scale(el.style.fontSize); if (!n) return; el.style.fontSize = n; el.dataset.tz = el.style.fontSize; };
  const all = (root) => { if (root.nodeType !== 1) return; inline(root); root.querySelectorAll('[style]').forEach(inline); };
  new MutationObserver((ms) => {
    sheets();
    for (const m of ms) { if (m.type === 'attributes') inline(m.target); else m.addedNodes.forEach(all); }
  }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] });
  document.addEventListener('DOMContentLoaded', () => {
    document.documentElement.style.fontSize = 16 * zoom + 'px';
    document.documentElement.style.setProperty('--safe-area-inset-top', bar + 'px');
    sheets(); all(document.body);
  });
}

/** The checks of room, in the page. */
function room({ bar, edge }) {
  const out = [], W = innerWidth;
  const seen = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return null;
    for (let a = el; a; a = a.parentElement) { const s = getComputedStyle(a); if (s.visibility === 'hidden' || s.display === 'none' || s.opacity === '0' || a.getAttribute('aria-hidden') === 'true') return null; }
    return r;
  };
  const words = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
  // The tab bar.
  const nav = document.querySelector('nav.ow-tabbar');
  if (nav && seen(nav)) {
    const ws = [...nav.querySelectorAll('.ow-tab-w')].map((w) => ({ w: w.textContent, r: w.getBoundingClientRect(), s: w.parentElement.getBoundingClientRect() }));
    ws.forEach((x) => { if (x.r.left < x.s.left - 0.5 || x.r.right > x.s.right + 0.5) out.push(`tab "${x.w}" leaves its slot`); });
    ws.slice(1).forEach((x, i) => { if (ws[i].r.right > x.r.left) out.push(`tabs "${ws[i].w}" and "${x.w}" overlap`); });
    if (ws.length && ws[0].r.left < edge - 0.5) out.push(`tab "${ws[0].w}" ${ws[0].r.left.toFixed(1)} px from the left edge`);
    if (ws.length && W - ws[ws.length - 1].r.right < edge - 0.5) out.push(`tab "${ws[ws.length - 1].w}" ${(W - ws[ws.length - 1].r.right).toFixed(1)} px from the right edge`);
  }
  // What of an element shows: its box cut by every ancestor that clips.
  const shows = (el, r) => {
    let x0 = r.left, y0 = r.top, x1 = r.right, y1 = r.bottom;
    for (let a = el; a; a = a.parentElement) {
      if (getComputedStyle(a).overflowX === 'visible' && getComputedStyle(a).overflowY === 'visible') continue;
      const q = a.getBoundingClientRect();
      x0 = Math.max(x0, q.left); y0 = Math.max(y0, q.top); x1 = Math.min(x1, q.right); y1 = Math.min(y1, q.bottom);
    }
    return x1 - x0 > 0 && y1 - y0 > 0 ? { x0, y0, x1, y1 } : null;
  };
  const texts = [];
  // The layer a part floats in (the tab bar, a dock, a sheet): the page scrolls under it, so only words in one layer are compared.
  const layerOf = (el) => { for (let a = el; a; a = a.parentElement) if (getComputedStyle(a).position === 'fixed') return a; return null; };
  for (const el of document.querySelectorAll('#app *, [role=dialog] *')) {
    if (!words(el) && !/^(BUTTON|A|INPUT)$/.test(el.tagName)) continue;
    const r = seen(el);
    if (!r) continue;
    const name = (el.innerText || el.getAttribute('aria-label') || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 40);
    // Nothing under the clock's bar, at the top of the page.
    if (scrollY === 0 && r.top < bar - 0.5 && r.bottom > 0) out.push(`"${name}" under the clock's bar (top ${r.top.toFixed(1)})`);
    // No words off the screen, unless a row that slides sideways holds them.
    if (r.right > W + 0.5 || r.left < -0.5) {
      let slides = false;
      for (let a = el.parentElement; a && !slides; a = a.parentElement) slides = /(auto|scroll)/.test(getComputedStyle(a).overflowX) && a.scrollWidth > a.clientWidth;
      if (!slides) out.push(`"${name}" runs off the screen (${r.left.toFixed(0)}–${r.right.toFixed(0)})`);
    }
    // The words themselves (a range round the text), as they show.
    const t = [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
    if (t) { const g = document.createRange(); g.selectNodeContents(t); const v = shows(el, g.getBoundingClientRect()); if (v) texts.push({ el, name, v, layer: layerOf(el) }); }
  }
  // No words over other words (a date over "came", a stage over the next).
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const a = texts[i], b = texts[j];
    if (a.layer !== b.layer || a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const w = Math.min(a.v.x1, b.v.x1) - Math.max(a.v.x0, b.v.x0), h = Math.min(a.v.y1, b.v.y1) - Math.max(a.v.y0, b.v.y0);
    if (w > 2 && h > 4) out.push(`"${a.name}" and "${b.name}" overlap`);
  }
  return [...new Set(out)];
}

async function fit(open) {
  const ph = await open('&state=stretched', { init: [phoneLike, [ZOOM, BAR]], fonts: true });
  const { p, tap, check } = ph;
  // How near the edge the boards put the outermost labels, at 100% (TD01): the bar's own room.
  const edge = 3;
  const look = async (where) => {
    const bad = await p.evaluate(room, { bar: BAR, edge });
    check(bad.length === 0, `fit: ${where} holds at 130% text with real data`, bad.join(' · '));
  };
  const zoomed = await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.ow-tab-w')).fontSize));
  check(Math.abs(zoomed - 12) < 0.3, 'fit: the tab labels stay at 12 px under 130% text (the bar has no room to grow)', zoomed);
  await look('Today');
  for (const [t, where] of [['today', 'Today'], ['chats', 'Chats'], ['orders', 'Orders'], ['customers', 'Customers']]) {
    await ph.tab(t);
    await look(where);
    await p.mouse.wheel(0, 600);
    await p.waitForTimeout(300);
    await ph.look(where + ' scrolled');
    await p.evaluate(() => scrollTo(0, 0));
  }
  // Your day, both views, with 20 payments and 30 who owe.
  await ph.tab('today');
  await tap('You: your account and this phone');
  await look('You');
  await tap({ text: 'Payments' });
  await look('Your day · Money in');
  const faces = await p.evaluate(() => [...document.querySelectorAll('.td-still .ow-face')].length);
  check(faces > 0 && faces <= 4, 'fit: Still to collect draws at most 4 faces, then "+n"', faces);
  const more = await p.evaluate(() => (document.querySelector('.td-still .ow-faces-more') || {}).textContent);
  check(more === '+30', 'fit: …and "+30" for the other 30 of the 34 who owe', more);
  await tap({ text: 'Placed' });
  await look('Your day · Placed');
  await tap('Close');
  // To collect, a customer, an order, a chat.
  await tap({ text: 'Take payment' });
  await look('To collect');
  await tap({ sel: '.ow-shead-x' });
  await ph.tab('customers');
  await tap({ sel: '[role=group][aria-label=Show] button:has-text("All")' });
  await look('Customers · All');
  await ph.tab('customers');
  await ph.type('Bweyogerere', 'Name, phone or place');
  await look('Customers · found');
  await tap({ sel: 'button:has-text("Bweyogerere Building")' });
  await look('a customer with a long name');
  await tap('Back to Customers');
  await ph.tab('orders');
  await tap({ sel: 'button.ow-orow-main' });
  await look('an order');
  await tap('Back to Orders');
  await ph.tab('chats');
  await tap({ sel: '.ch-row-m' });
  await look('a chat');
  return ph;
}

module.exports = { fit, phoneLike, room };
