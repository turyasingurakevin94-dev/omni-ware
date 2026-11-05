/*
 * The phone's bars inside the Android app (the native layer, shell/native.ts). Moved from sales.html's
 * native layer (its jobs 2 and 3).
 *
 * The app draws edge to edge (capacitor.config.json: SystemBars "css", viewport-fit=cover), and the
 * screens start under the clock: every part that sits at the top is offset by --app-top, the bar's
 * height (src/ui/tokens.css: Capacitor's --safe-area-inset-top, else the WebView's own env()).
 * On the web it is 0, so the boards and the app stay the same.
 *
 *   - The strip: a band over the status bar takes the colour of the screen just under it (a navy
 *     head, the light body, a sheet's scrim), and the clock's icons stay readable on it.
 *   - The bars' size: Capacitor measures them into --safe-area-inset-*; a page it has not measured
 *     yet (some phones, after a reload) would read zero and slide under the clock, so the last good
 *     measurement stands in until it does.
 */

export interface Rgba { r: number; g: number; b: number; a: number }

const GROUND: Rgba = { r: 247, g: 245, b: 242, a: 1 };

/** The first colour in a computed CSS value ("rgb(22, 32, 60)", "rgba(12, 19, 38, 0.72)", a gradient's first stop). */
export function colourIn(css: string): Rgba | null {
  const m = String(css || '').match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/);
  if (!m) return null;
  const a = m[4] == null ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  return { r: +m[1], g: +m[2], b: +m[3], a };
}

/** Layers from the top down, painted over the ground: the colour you see. */
export function composite(layers: Rgba[], ground: Rgba = GROUND): Rgba {
  return layers.slice().reverse().reduce((c, l) => ({
    r: l.r * l.a + c.r * (1 - l.a), g: l.g * l.a + c.g * (1 - l.a), b: l.b * l.a + c.b * (1 - l.a), a: 1,
  }), ground);
}

/** A colour the clock's icons must be light on (SystemBars style DARK). */
export function isDark(c: Rgba): boolean {
  const lin = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b) < 0.4;
}

/** What is painted at (x, y): each element's image (a gradient's first stop) over its colour, up to the first solid one. */
function colourAt(x: number, y: number): Rgba {
  const layers: Rgba[] = [];
  for (let el = document.elementFromPoint(x, y); el; el = el.parentElement) {
    const cs = getComputedStyle(el);
    const img = cs.backgroundImage && cs.backgroundImage !== 'none' ? colourIn(cs.backgroundImage) : null;
    const bg = colourIn(cs.backgroundColor);
    if (img) layers.push(img);
    if (bg && bg.a > 0) layers.push(bg);
    if (layers.length && layers[layers.length - 1].a >= 1) break;
  }
  return composite(layers);
}

interface Bars { setStyle(o: { style: 'DARK' | 'LIGHT' }): Promise<unknown> }

/** The strip over the status bar. Returns the function that repaints it. */
export function startStrip(bars: Bars | null): () => void {
  const strip = document.createElement('div');
  strip.setAttribute('aria-hidden', 'true');
  strip.setAttribute('data-ow-strip', '');
  strip.style.cssText = 'position:fixed;top:0;left:0;right:0;height:var(--app-top, 0px);z-index:59;pointer-events:none;';
  document.body.appendChild(strip);
  let last = '';
  const paint = () => {
    const top = strip.offsetHeight;
    if (!top) return;
    const c = colourAt(Math.round(window.innerWidth / 2), Math.min(window.innerHeight - 1, top + 1));
    strip.style.background = `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`;
    const style = isDark(c) ? 'DARK' : 'LIGHT';
    if (style !== last && bars) { last = style; bars.setStyle({ style }).catch(() => undefined); }
  };
  let queued = false;
  const soon = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; paint(); }); };
  new MutationObserver(soon).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class', 'style'] });
  document.addEventListener('scroll', soon, { passive: true, capture: true });
  window.addEventListener('resize', soon);
  paint();
  return soon;
}

export interface Insets { top?: number; bottom?: number }

/**
 * The bars' size, decided: what to remember, and what to stand in.
 *   measured  Capacitor has set --safe-area-inset-top on this page
 *   top/bottom what the page pads by now (--app-top, --app-bottom)
 *   fills     the page fills the whole screen (so it is under the bars)
 */
export function insetsPlan(o: { measured: boolean; top: number; bottom: number; last: Insets; fills: boolean }): { remember?: Insets; stand?: Insets } {
  if (o.measured && o.top > 0) {
    return o.last.top !== o.top || o.last.bottom !== o.bottom ? { remember: { top: o.top, bottom: o.bottom } } : {};
  }
  // Measured at zero (Android laid the page out inside its bars), or the WebView knows them itself.
  if (o.measured || o.top > 0) return {};
  // Not measured, and nothing says the page is under the bars.
  if (!o.last.top && !o.fills) return {};
  return { stand: { top: o.last.top || 32, bottom: o.last.bottom || 32 } };
}

const INSETS = 'ow-app-insets';

/** Measure, and stand in for Capacitor when it has not measured this page yet. */
export function fixInsets(): void {
  const root = document.documentElement;
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;padding-top:var(--app-top, 0px);padding-bottom:var(--app-bottom, 0px);';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const top = parseFloat(cs.paddingTop) || 0, bottom = parseFloat(cs.paddingBottom) || 0;
  probe.remove();
  let last: Insets = {};
  try { last = JSON.parse(localStorage.getItem(INSETS) || '{}') || {}; } catch (_e) { /* none kept */ }
  const plan = insetsPlan({
    measured: root.style.getPropertyValue('--safe-area-inset-top') !== '',
    top, bottom, last, fills: Math.abs(screen.height - window.innerHeight) <= 16,
  });
  if (plan.remember) { try { localStorage.setItem(INSETS, JSON.stringify(plan.remember)); } catch (_e) { /* kept next time */ } }
  if (plan.stand) {
    root.style.setProperty('--safe-area-inset-top', plan.stand.top + 'px');
    root.style.setProperty('--safe-area-inset-bottom', plan.stand.bottom + 'px');
  }
}
