/*
 * The phone's keyboard, for the docks (src/ui/dock.css). A dock is fixed to the foot of the screen and
 * the page above leaves its height (--dock-h, Dock.tsx); with the keyboard up the screen is short and a
 * dock of 300 px would cover what is typed for (the counter's "Add · 18,500", Sell's results). So while
 * the keyboard is up for a field above the dock, the dock sits at the end of the page instead
 * (<html class="ow-kb">), and the page leaves no room for it.
 *
 * The keyboard is up when the screen is shorter than it has been at this width by more than a
 * keyboard's worth, while a field has the focus. A field inside the dock keeps the dock where it is.
 */
/** Shorter than this by more than a keyboard's worth (a phone's smallest keyboard is about 180 px). */
const KEYBOARD = 150;

export function keyboardUp(o: { height: number; tallest: number; field: boolean; inDock: boolean }): boolean {
  return o.field && !o.inDock && o.tallest - o.height > KEYBOARD;
}

export function watchKeyboard(): void {
  const vv = window.visualViewport;
  let width = window.innerWidth, tallest = 0;
  const check = () => {
    if (window.innerWidth !== width) { width = window.innerWidth; tallest = 0; }
    const height = vv ? vv.height : window.innerHeight;
    tallest = Math.max(tallest, height, window.innerHeight);
    const el = document.activeElement as HTMLElement | null;
    const field = !!el && (/^(INPUT|TEXTAREA)$/.test(el.tagName) || el.isContentEditable);
    const up = keyboardUp({ height, tallest, field, inDock: !!el && !!el.closest('.ow-dock, .ow-dockwrap') });
    document.documentElement.classList.toggle('ow-kb', up);
  };
  window.addEventListener('resize', check);
  if (vv) vv.addEventListener('resize', check);
  document.addEventListener('focusin', check);
  document.addEventListener('focusout', () => setTimeout(check, 0));
  check();
}
