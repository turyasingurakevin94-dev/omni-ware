/*
 * The act row and its pieces (LANGUAGE.md §3 P10b, P07, §4.4 "Act from the
 * row"): a row that says who or what, and carries its one next step on the
 * row itself, so nobody detours through a detail screen.
 *
 *   <GroupCard>…rows…</GroupCard>                       white, radius 18, rows split by 1px #F1EEE8
 *   <ActRow lead={<IconTile icon="message" tone="info" size={42} />} title="Lubowa Builders" aside="· asked"
 *     sub="“G28 iron sheets, 60 pcs?”" act={{ icon: 'whatsapp', label: 'Reply to Lubowa Builders', on: … }} />    P10b, 66 tall
 *   <MiniRow face={{ initials: 'MR', tint: 't3' }} name="Mukono Roofing" pill={<ActionPill tone="warn" word="Take" amount="1.1M" />} on={…} />   P07's 48 px row
 *   <IconTile duo={phCoins} tone="warn" />              a 38 px tone square holding an icon (P08, P10b, S07)
 */
import type { ComponentChildren, JSX } from 'preact';
import { Avatar, type Face } from './Avatar.tsx';
import { Duo, Icon, type IconName } from './icons.tsx';
import { Tap, cx } from './util.tsx';
import './actrow.css';

export type TileTone = 'warn' | 'good' | 'bad' | 'info' | 'neutral';

/** The soft square and its ink, by tone (§1.1). */
export const TILE_TONE: Record<TileTone, { bg: string; fg: string; ink: string }> = {
  warn: { bg: '#FDEEE1', fg: '#95530C', ink: '#7A4A02' },
  good: { bg: '#E4F4EA', fg: '#0F6B43', ink: '#0F6B43' },
  bad: { bg: '#FBE5E2', fg: '#8E2A22', ink: '#8E2A22' },
  info: { bg: '#E3EEFB', fg: '#1A5A8A', ink: '#1A5A8A' },
  neutral: { bg: '#F1EEE8', fg: '#5F6980', ink: '#5F6980' },
};

export interface IconTileProps {
  tone: TileTone;
  icon?: IconName;
  duo?: string;
  /** 38 (P08) or 42 (P10b, S07). */
  size?: number;
  /** The icon's box (20) and stroke (2). */
  iconSize?: number;
  stroke?: number;
}

export function IconTile(p: IconTileProps): JSX.Element {
  const t = TILE_TONE[p.tone], s = p.size || 38;
  return (
    <span aria-hidden="true" class="ow-itile" style={{ width: `${s}px`, height: `${s}px`, background: t.bg, color: t.fg }}>
      {p.duo ? <Duo i={p.duo} size={p.iconSize || 20} /> : p.icon && <Icon name={p.icon} size={p.iconSize || 20} stroke={p.stroke || 2} />}
    </span>
  );
}

/** A list group card: white, radius 18, the hairline; rows inside are split by 1px #F1EEE8. */
export function GroupCard(p: { pad?: 12 | 14; class?: string; children: ComponentChildren }): JSX.Element {
  return <div class={cx('ow-group', p.pad === 14 && 'p14', p.class)}>{p.children}</div>;
}

export interface RowAct {
  icon: IconName;
  label: string;
  on: () => void;
  /** navy: the row's own next step (the default); tile: a secondary add, #F1EEE8 with ink. */
  kind?: 'navy' | 'tile';
}

export interface ActRowProps {
  /** A 42 px IconTile, or a RingAvatar. */
  lead: ComponentChildren;
  title: string;
  /** Words after the title, quieter ("· asked"). */
  aside?: string;
  sub?: ComponentChildren;
  act?: RowAct;
  /** The row itself opens something. */
  on?: () => void;
}

/** P10b · the compact act row: 66 tall, the lead, two lines, a 44 px square action on the right. */
export function ActRow(p: ActRowProps): JSX.Element {
  const body = (
    <>
      {p.lead}
      <span class="ow-arow-t">
        <span class="ow-arow-title">{p.title}{p.aside && <span> {p.aside}</span>}</span>
        {p.sub && <span class="ow-arow-sub">{p.sub}</span>}
      </span>
    </>
  );
  return (
    <div class="ow-arow">
      {p.on ? <button type="button" class="ow-arow-main" onClick={p.on}>{body}</button> : <span class="ow-arow-main">{body}</span>}
      {p.act && (
        <button type="button" class={cx('ow-arow-act', p.act.kind === 'tile' && 'tile')} aria-label={p.act.label} onClick={p.act.on}>
          <Icon name={p.act.icon} size={17} stroke={2.2} />
        </button>
      )}
    </div>
  );
}

/** P07's row under the stage tiles: 48 tall, a 32 px face, the name 14/600, the act pill, a chevron. The whole row is the link. */
export function MiniRow(p: { face: Face; name: string; pill: ComponentChildren; on: () => void; label?: string }): JSX.Element {
  return (
    <Tap on={p.on} label={p.label} class="ow-mini">
      <Avatar {...p.face} size={32} />
      <span class="ow-mini-n">{p.name}</span>
      {p.pill}
      <span aria-hidden="true" class="ow-chev"><Icon name="chevron-right" size={16} stroke={2.2} /></span>
    </Tap>
  );
}

/** The row chevron on white: 16 px, #9AA1AE, decoration only. */
export function Chevron(): JSX.Element {
  return <span aria-hidden="true" class="ow-chev"><Icon name="chevron-right" size={16} stroke={2.2} /></span>;
}
