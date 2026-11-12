/*
 * The light sheet the shift's screens come up in (TD12 You, TD13 Pass the yard, TD16 Close the yard):
 * the screen behind as a navy strip (itself the way back), the sheet with its grabber, an eyebrow and
 * the title, Close; the body scrolls; the dock (the red slide) sits at the bottom. A route, not a
 * sheet.open: Back walks it like any screen (routes §1).
 */
import type { ComponentChildren, JSX } from 'preact';
import { Icon } from '../../../ui/icons.tsx';
import { Tap, cx } from '../../../ui/util.tsx';
import './frame.css';

export interface YardSheetProps {
  /** Where the sheet starts (the strip above it is the way back). */
  top?: number;
  backLabel: string;
  onBack: () => void;
  eyebrow?: ComponentChildren;
  title?: ComponentChildren;
  /** A head of the screen's own in place of the eyebrow and title (You, Close the yard: navy). */
  head?: ComponentChildren;
  closeLabel?: string;
  dock?: ComponentChildren;
  class?: string;
  children: ComponentChildren;
}

export function YardSheet(p: YardSheetProps): JSX.Element {
  return (
    <div class={cx('st-ysheet', p.class)}>
      <Tap on={p.onBack} label={p.backLabel} class="st-ysheet-back" style={{ height: `${p.top ?? 56}px` }} />
      <div class="st-ysheet-s" style={{ top: `${p.top ?? 56}px` }}>
        {p.head || (
          <>
            <span aria-hidden="true" class="st-ysheet-grab" />
            <div class="st-ysheet-h">
              <span class="st-ysheet-ht">{p.eyebrow && <span class="st-ysheet-eye">{p.eyebrow}</span>}<h1>{p.title}</h1></span>
              <button type="button" class="st-ysheet-x" aria-label={p.closeLabel || 'Close'} onClick={p.onBack}><Icon name="close" size={16} stroke={2.2} /></button>
            </div>
          </>
        )}
        <div class="st-ysheet-b">{p.children}</div>
        {p.dock && <div class="st-sdock">{p.dock}</div>}
      </div>
    </div>
  );
}

/** "After the slide · Okello sees “…”": who will be told, dashed, before the commit (BRIEF). */
export function AfterSlide(p: { face: ComponentChildren; who: string; says: string; tail?: string }): JSX.Element {
  return (
    <div class="st-after">
      {p.face}
      <span>After the slide · <b>{`${p.who} sees`}</b>{` “${p.says}”${p.tail ? ` ${p.tail}` : ''}`}</span>
    </div>
  );
}
