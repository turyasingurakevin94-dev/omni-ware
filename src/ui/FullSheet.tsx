/*
 * P04 · Everything about ONE thing (an order, a customer, a chat) comes up
 * as a full sheet over the screen it came from (LANGUAGE.md §3 P04). The
 * 40 px strip above it is the screen behind under the scrim (#2A3350) and
 * is itself the way back; pulling the sheet down goes back too. The sheet
 * is #F7F5F2 with top corners 26; its navy head (SheetHead) holds the
 * grabber, the head row and then the thing's picture (the Track, a money
 * split, the chat's chips).
 *
 *   <FullSheet onBack={nav.back} backLabel="Back to Orders"
 *     head={<SheetHead face={…} name="Kato Construction" sub="#0552 · today 9:14" subMono phone="0772418220" onClose={nav.back}>
 *       <Track stage="packing" … />
 *     </SheetHead>}>
 *     …cards; the last group pinned with margin-top: auto…
 *   </FullSheet>
 *   <HeadChip on={…} label="Order #0552, Packing. Open it">…</HeadChip>     a glass chip under a head row (S01)
 */
import type { ComponentChildren, JSX } from 'preact';
import { useRef } from 'preact/hooks';
import { Avatar, type Face } from './Avatar.tsx';
import { Icon } from './icons.tsx';
import { useDragClose } from './sheet.tsx';
import { Tap, cx } from './util.tsx';
import './fullsheet.css';

export interface FullSheetProps {
  onBack: () => void;
  /**
   * The strip's words for a screen reader: "Back to Orders". null: the strip is only the screen behind, a tap there
   * still goes back but Close is the control (KC16, as SL01's scrim).
   */
  backLabel: string | null;
  head: ComponentChildren;
  /** The body's padding and gap (14px 16px 18px, 10). */
  pad?: string;
  gap?: number;
  /** The chat's ground (#EDE7DD) instead of #F7F5F2. */
  ground?: string;
  /** Drawn in place (the parts gallery) instead of over the screen. */
  inline?: boolean;
  /** Below the body, outside its scroll (the chat composer, a dock). */
  foot?: ComponentChildren;
  /** The sheet's shadow over the strip (KC16, SL01: a sheet over a screen drawn behind it). */
  shadow?: boolean;
  children?: ComponentChildren;
}

export function FullSheet(p: FullSheetProps): JSX.Element {
  const box = useRef<HTMLDivElement>(null);
  useDragClose(box, p.onBack);
  return (
    <div class={cx('ow-full', p.inline && 'inline')}>
      {p.backLabel == null
        ? <div aria-hidden="true" class="ow-full-back" onClick={p.onBack} />
        : <Tap on={p.onBack} label={p.backLabel} class="ow-full-back" />}
      <div ref={box} class={cx('ow-full-sheet', p.shadow && 'shadow')} style={p.ground ? { background: p.ground } : undefined}>
        {p.head}
        <div class="ow-full-body" style={{ padding: p.pad, gap: p.gap != null ? `${p.gap}px` : undefined }}>{p.children}</div>
        {p.foot}
      </div>
    </div>
  );
}

export interface SheetHeadProps {
  face: Face;
  name: string;
  /** The line under the name: "#0552 · today 9:14" (subMono), or words with a mono part. */
  sub?: ComponentChildren;
  subMono?: boolean;
  /** The avatar and name open something (the chat opens the customer). */
  onName?: () => void;
  /** Sales calls the customer: the round mint Call button. */
  phone?: string;
  callLabel?: string;
  onClose: () => void;
  closeLabel?: string;
  /** Glass chips under the head row (S01: whose chat, the open order). */
  chips?: ComponentChildren;
  /** 'chat': the chat head's measures (padding 10 16 16, gap 12). */
  pad?: 'wide' | 'chat';
  style?: JSX.CSSProperties;
  /** The thing's picture: the Track, the money split, a strip. */
  children?: ComponentChildren;
}

export function SheetHead(p: SheetHeadProps): JSX.Element {
  const who = (
    <>
      <Avatar {...p.face} size={44} />
      <span class="ow-shead-t">
        <span class="ow-shead-n">{p.name}</span>
        {p.sub && <span class={cx('ow-shead-s', p.subMono && 'mono')}>{p.sub}</span>}
      </span>
    </>
  );
  return (
    <div class={cx('ow-shead', p.pad === 'chat' && 'chat')} style={p.style}>
      <span aria-hidden="true" class="ow-shead-grab" />
      <div class="ow-shead-row">
        {p.onName ? <Tap on={p.onName} class="ow-shead-who link">{who}</Tap> : <div class="ow-shead-who">{who}</div>}
        {p.phone && <Tap href={'tel:' + p.phone.replace(/\s/g, '')} label={p.callLabel || `Call ${p.name}`} class="ow-shead-call"><Icon name="phone" size={18} stroke={2} /></Tap>}
        <button type="button" class="ow-shead-x" aria-label={p.closeLabel || 'Close'} onClick={p.onClose}><Icon name="close" size={16} stroke={2.2} /></button>
      </div>
      {p.chips && <div class="ow-shead-chips">{p.chips}</div>}
      {p.children}
    </div>
  );
}

/** A glass chip on a navy head: 32 visible inside a 44 target. */
export function HeadChip(p: { on: () => void; label: string; children: ComponentChildren }): JSX.Element {
  return <Tap on={p.on} label={p.label} class="ow-hchip"><span>{p.children}</span></Tap>;
}

/** A full sheet's navy head about a page, not a person (TD05, TD15–TD22): the grabber, the title and its line, the ×, then the picture. */
export function TitleHead(p: { title: ComponentChildren; sub?: ComponentChildren; lead?: ComponentChildren; onClose: () => void; small?: boolean; children?: ComponentChildren; class?: string }): JSX.Element {
  return (
    <div class={cx('ow-shead', p.class)}>
      <span aria-hidden="true" class="ow-shead-grab" />
      <div class="ow-shead-row">
        {p.lead}
        <span class={cx('ow-thead-t', p.small && 'small')}><span>{p.title}</span>{p.sub && <span>{p.sub}</span>}</span>
        <button type="button" class="ow-shead-x" aria-label="Close" onClick={p.onClose}><Icon name="close" size={16} stroke={2.2} /></button>
      </div>
      {p.children}
    </div>
  );
}
