/*
 * P16's labels under the phone's large text (src/ui/TabBar.tsx): the bar has no room to grow (the boards
 * already put "Customers" 3 px from the edge at 100%), so the labels are held at their own 12 px.
 */
import { useLayoutEffect } from 'preact/hooks';

/**
 * The labels' font size under the phone's text zoom, or null at 100%. The zoom is the labels' drawn
 * width over the width of the same words at 12 px on a canvas (a canvas is never zoomed); the size
 * that undoes it keeps them as the boards draw them.
 */
export function tabFontSize(drawn: number[], plain: number[]): string | null {
  const z = Math.max(0, ...drawn.map((w, i) => (plain[i] > 0 ? w / plain[i] : 0)));
  return z > 1.02 ? `${(12 / z).toFixed(2)}px` : null;
}

let pen: CanvasRenderingContext2D | null = null;

/** Holds the labels at 12 px now, and again when the bar or the fonts change. */
export function useFit(ref: { current: HTMLElement | null }, key: unknown): void {
  useLayoutEffect(() => {
    const nav = ref.current;
    if (!nav) return undefined;
    const fit = () => {
      nav.style.removeProperty('--tab-fs');
      const words = [...nav.querySelectorAll<HTMLElement>('.ow-tab-w')];
      pen = pen || document.createElement('canvas').getContext('2d');
      if (!words.length || !pen) return;
      const plain = words.map((w) => {
        const cs = getComputedStyle(w);
        (pen as CanvasRenderingContext2D).font = `${cs.fontWeight} 12px ${cs.fontFamily}`;
        return (pen as CanvasRenderingContext2D).measureText(w.textContent || '').width;
      });
      const fs = tabFontSize(words.map((w) => w.getBoundingClientRect().width), plain);
      if (fs) nav.style.setProperty('--tab-fs', fs);
    };
    fit();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
    if (ro) ro.observe(nav);
    if (document.fonts) void document.fonts.ready.then(fit);
    return () => { if (ro) ro.disconnect(); };
  }, [key]);
}
