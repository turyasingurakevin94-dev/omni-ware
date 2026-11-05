/*
 * The phone's bars inside the Android app (the native layer, shell/native.ts). Moved from sales.html's
 * native layer (its jobs 2 and 3).
 *
 * Where the WebView sits decides everything, and it is one rule (barsPlan below):
 *   - Under the bars (edge to edge: capacitor.config.json SystemBars "css", viewport-fit=cover): the
 *     screens start under the clock, so every part that sits at the top is offset by --app-top, the
 *     bar's height (src/ui/tokens.css: --bar-top, Capacitor's --safe-area-inset-top, else the
 *     WebView's own env()), and a strip over the status bar takes the colour of what is under it.
 *   - Inside the bars (some phones, e.g. a Huawei: Android draws its own opaque status bar and lays
 *     the WebView out below it, while Capacitor still reports the bar's height): --app-top is 0 and
 *     there is no strip. Told apart by the screen's height less the page's: at least the bar's when
 *     the page starts below it.
 * On the web all of it is 0, so the boards and the app stay the same.
 *
 *   - The strip: a band over the status bar takes the colour of the screen just under it (a navy
 *     head's navy #16203C, the light body, a sheet's scrim), and the clock's icons stay readable on it.
 *   - The bars' size: Capacitor measures them into --safe-area-inset-*; a page it has not measured
 *     yet (some phones, after a reload) would read zero and slide under the clock, so the last good
 *     measurement stands in until it does, but only on a page that fills the whole screen.
 */

export interface Rgba { r: number; g: number; b: number; a: number }

const GROUND: Rgba = { r: 247, g: 245, b: 242, a: 1 };

const RGBA = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/g;

/**
 * A colour in a computed CSS value ("rgb(22, 32, 60)", "rgba(12, 19, 38, 0.72)"). For a gradient, its
 * last stop: the ground it settles into (the navy head's --head-ground glows #243A6B in its corner and
 * is navy #16203C, so the strip over it is navy, as the old app painted it).
 */
export function colourIn(css: string): Rgba | null {
  const all = [...String(css || '').matchAll(RGBA)];
  const m = all[all.length - 1];
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

/** What is painted at (x, y): each element's image (a gradient's ground) over its colour, up to the first solid one. */
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

/** Rounding between the screen's size and the page's (CSS pixels). */
const SLACK = 2;
/** A page this close to the screen's height fills it (so it is under the bars). */
const FILLS = 16;

export interface BarsIn {
  /** Capacitor has set --safe-area-inset-top on this page. */
  measured: boolean;
  /** The bars' size the page reads now (--bar-top, --bar-bottom). */
  top: number;
  bottom: number;
  /** The last good measurement, kept on the phone. */
  last: Insets;
  /** The screen's height less the page's (screen.height - innerHeight): the bars the page is not under. */
  gap: number;
  /** Someone is typing: the keyboard takes height off the page, so the gap says nothing. */
  typing: boolean;
}

export interface BarsPlan {
  /** The page starts below the status bar (--app-top 0, no strip) or not; null: leave it as it is. */
  insideTop: boolean | null;
  /** The page ends above the bottom bar (--app-bottom 0); null: leave it. */
  insideBottom: boolean | null;
  /** Keep this measurement on the phone. */
  remember?: Insets;
  /** Stand in for Capacitor's measurement until it measures. */
  stand?: Insets;
}

/**
 * The one rule for the bars: where the page sits, what to remember, what to stand in.
 *   - The page is inside a bar when the screen's height less its own is at least that bar: Android drew
 *     the bar and laid the page out past it, whatever Capacitor reports.
 *   - A measurement under the bars is remembered.
 *   - Nothing measured: the last good measurement (else 32) stands in, only on a page that fills the
 *     screen. A page that does not fill it is inside the bars and never gets a stand-in.
 */
export function barsPlan(o: BarsIn): BarsPlan {
  if (o.typing) return { insideTop: null, insideBottom: null };
  const insideTop = o.top > 0 && o.gap >= o.top - SLACK;
  const insideBottom = o.bottom > 0 && o.gap >= o.top + o.bottom - SLACK;
  const plan: BarsPlan = { insideTop, insideBottom };
  if (o.measured && o.top > 0) {
    if (o.last.top !== o.top || o.last.bottom !== o.bottom) plan.remember = { top: o.top, bottom: o.bottom };
    return plan;
  }
  // Measured at zero (Android laid the page out inside its bars), or the WebView knows them itself.
  if (o.measured || o.top > 0) return plan;
  // Not measured: a page that does not fill the screen is inside the bars, and nothing stands in.
  if (o.gap > FILLS) return plan;
  return { ...plan, stand: { top: o.last.top || 32, bottom: o.last.bottom || 32 } };
}

const INSETS = 'ow-app-insets';

const editing = (el: Element | null): boolean =>
  !!el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || (el as HTMLElement).isContentEditable);

/** Measure, decide (barsPlan), and apply: --app-top/--app-bottom 0 inside the bars; a stand-in when not measured. */
export function fixInsets(): void {
  const root = document.documentElement;
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;padding-top:var(--bar-top, 0px);padding-bottom:var(--bar-bottom, 0px);';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const top = parseFloat(cs.paddingTop) || 0, bottom = parseFloat(cs.paddingBottom) || 0;
  probe.remove();
  let last: Insets = {};
  try { last = JSON.parse(localStorage.getItem(INSETS) || '{}') || {}; } catch (_e) { /* none kept */ }
  const plan = barsPlan({
    measured: root.style.getPropertyValue('--safe-area-inset-top') !== '',
    top, bottom, last, gap: screen.height - window.innerHeight, typing: editing(document.activeElement),
  });
  if (plan.remember) { try { localStorage.setItem(INSETS, JSON.stringify(plan.remember)); } catch (_e) { /* kept next time */ } }
  // Each property is written only when it changes, so watching the root's style (native.ts) never loops.
  const put = (name: string, value: string | null) => {
    if (root.style.getPropertyValue(name) === (value ?? '')) return;
    if (value == null) root.style.removeProperty(name); else root.style.setProperty(name, value);
  };
  if (plan.stand) {
    put('--safe-area-inset-top', plan.stand.top + 'px');
    put('--safe-area-inset-bottom', plan.stand.bottom + 'px');
  }
  if (plan.insideTop != null) put('--app-top', plan.insideTop ? '0px' : null);
  if (plan.insideBottom != null) put('--app-bottom', plan.insideBottom ? '0px' : null);
}
