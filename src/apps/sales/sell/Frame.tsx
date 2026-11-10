/*
 * local part · a light sheet's frame, as the Sell boards draw it: P17's
 * grabber, title and ×, plus what LightSheet (src/ui/sheet.tsx) cannot do
 * yet: a square before the title (SL17 the van, SL21 the item), the 21 px
 * title under an eyebrow (SL16, SL26) and a line under the title (SL11).
 * The classes are LightSheet's own; to move into src/ui as LightSheet props.
 */
import type { ComponentChildren, JSX } from 'preact';
import { Icon } from '../../../ui/icons.tsx';
import { cx } from '../../../ui/util.tsx';

export interface FrameProps {
  title: string;
  eyebrow?: string;
  /** A line under the title ("1,153 items · 12 aisles"), in mono. */
  sub?: string;
  /** A 44 px square before the title. */
  icon?: ComponentChildren;
  onClose: () => void;
  pad?: string;
  gap?: number;
  ground?: boolean;
  foot?: ComponentChildren;
  class?: string;
  children: ComponentChildren;
}

export function Frame(p: FrameProps): JSX.Element {
  return (
    <div class={cx('ow-lsheet', p.ground && 'ground', p.eyebrow && 'sl-sheet21', p.class)}>
      <span aria-hidden="true" class="ow-grab" />
      <div class="ow-lsheet-h">
        <div class="ow-lsheet-ht">
          {p.eyebrow && <span class="ow-lsheet-eye">{p.eyebrow}</span>}
          <h2 class="sl-frame-h">{p.icon ? <span class="sl-sheet-h">{p.icon}{p.title}</span> : p.title}</h2>
          {p.sub && <span class="mono sl-frame-sub">{p.sub}</span>}
        </div>
        <button type="button" class="ow-x-tile" aria-label="Close" onClick={p.onClose}><Icon name="close" size={16} stroke={2.2} /></button>
      </div>
      <div class="ow-lsheet-b" style={{ padding: p.pad, gap: p.gap != null ? `${p.gap}px` : undefined }}>
        {p.children}
        {p.foot && <div class="ow-lsheet-foot">{p.foot}</div>}
      </div>
    </div>
  );
}
