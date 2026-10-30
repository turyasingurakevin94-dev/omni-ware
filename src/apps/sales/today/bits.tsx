/*
 * LOCAL PARTS the Today boards draw that src/ui has no prop for yet (each
 * moves to src/ui; listed in the builder's reply):
 *
 *   Row       P10b with an amount chip before the act, and a quiet (tile) act (TD03 Then / Not placed yet)
 *   Mini      P07's row with two lines (TD01: "#0551 · Not paid yet") or a face stack (TD07: "2 paid")
 *   SubHead   a small grey head with a mono meta (TD03 "Then · 3 more · 3.4M")
 *   Faces     P07's face stack on white with any number of faces, the first on top (TD07, TD16, TD17)
 *   TitleHead a full sheet's navy head with a title instead of a person (TD05, TD15–TD18, TD21–TD22)
 */
import type { ComponentChildren, JSX } from 'preact';
import { Avatar, avatarStyle, type Face } from '../../../ui/Avatar.tsx';
import { Icon, type IconName } from '../../../ui/icons.tsx';
import { Tap, cx } from '../../../ui/util.tsx';
import './bits.css';

export function Row(p: { lead: ComponentChildren; title: string; sub?: ComponentChildren; chip?: string; act?: { icon: IconName; label: string; on: () => void; tile?: boolean } }): JSX.Element {
  return (
    <div class="td-row">
      {p.lead}
      <span class="td-row-t"><span>{p.title}</span>{p.sub && <span>{p.sub}</span>}</span>
      {p.chip && <span class="mono td-row-chip">{p.chip}</span>}
      {p.act && <button type="button" class={cx('td-row-act', p.act.tile && 'tile')} aria-label={p.act.label} onClick={p.act.on}><Icon name={p.act.icon} size={17} stroke={2.2} /></button>}
    </div>
  );
}

export function Mini(p: { face?: Face; faces?: Face[]; name: string; sub: string; subMono?: boolean; pill: ComponentChildren; on: () => void; label?: string }): JSX.Element {
  return (
    <Tap on={p.on} label={p.label} class={cx('td-mini', p.faces && 'faces')}>
      {p.faces ? <Faces faces={p.faces} /> : p.face && <Avatar {...p.face} size={32} font={12} />}
      <span class="td-mini-t"><span>{p.name}</span><span class={p.subMono ? 'mono' : undefined}>{p.sub}</span></span>
      {p.pill}
      <span aria-hidden="true" class="ow-chev"><Icon name="chevron-right" size={16} stroke={2.2} /></span>
    </Tap>
  );
}

export function SubHead(p: { title: string; meta: string }): JSX.Element {
  return <div class="td-subhead"><span>{p.title}</span><span class="mono">{p.meta}</span></div>;
}

/** A full sheet's navy head about a page, not a person: the grabber, the title and its line, the ×, then the picture. */
export function TitleHead(p: { title: ComponentChildren; sub?: ComponentChildren; lead?: ComponentChildren; onClose: () => void; small?: boolean; children?: ComponentChildren; class?: string }): JSX.Element {
  return (
    <div class={cx('ow-shead td-thead', p.class)}>
      <span aria-hidden="true" class="ow-shead-grab" />
      <div class="ow-shead-row">
        {p.lead}
        <span class={cx('td-thead-t', p.small && 'small')}><span>{p.title}</span>{p.sub && <span>{p.sub}</span>}</span>
        <button type="button" class="ow-shead-x" aria-label="Close" onClick={p.onClose}><Icon name="close" size={16} stroke={2.2} /></button>
      </div>
      {p.children}
    </div>
  );
}

/** A stack of 24 px faces, overlapping 6, the first on top, ringed in the ground they sit on. */
export function Faces(p: { faces: Face[]; ground?: string }): JSX.Element {
  return (
    <span aria-hidden="true" class="td-faces">
      {p.faces.map((f, i) => (
        <span key={i} class="ow-av" style={{ ...avatarStyle({ ...f, size: 24 }), boxSizing: 'border-box', border: `2px solid ${p.ground || '#FFFFFF'}`, position: 'relative', zIndex: p.faces.length - i, marginLeft: i ? '-6px' : undefined }}>{f.initials}</span>
      ))}
    </span>
  );
}
