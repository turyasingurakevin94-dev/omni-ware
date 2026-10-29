/*
 * P08 · The "Needs you" row (LANGUAGE.md §3 P08): one row per KIND of job,
 * never per order. The icon tile, the title, a mono line saying the one
 * message it takes, the count in the tone, a dark pill naming the act. The
 * whole row is the link (60 tall), so the pill is not a second target.
 *
 *   <NeedsRow kind="packing" title="Packing 2+ days" sub="ask Musa in one message" count={1} on={…} />
 *   <NeedsRow kind="take" title="Take payment" sub="3 customers · 1,910,000" count={3} on={…} />
 *
 * Kinds, in this order on Today (money first, then customers waiting, then the shop):
 * take · tell · collect · packing · chats · notsent.
 */
import type { JSX } from 'preact';
import { IconTile, TILE_TONE, type TileTone } from './ActRow.tsx';
import { phCoins, phHourglass, phStore, phWhatsapp, type IconName } from './icons.tsx';
import { Tap } from './util.tsx';
import './needs.css';

export type NeedKind = 'take' | 'tell' | 'collect' | 'packing' | 'chats' | 'notsent';

const KIND: Record<NeedKind, { tone: TileTone; duo?: string; icon?: IconName; pill: string }> = {
  take: { tone: 'warn', duo: phCoins, pill: 'Take' },
  tell: { tone: 'info', icon: 'tag', pill: 'Tell' },
  collect: { tone: 'good', duo: phStore, pill: 'Codes' },
  packing: { tone: 'bad', duo: phHourglass, pill: 'Ask' },
  chats: { tone: 'good', duo: phWhatsapp, pill: 'Reply' },
  notsent: { tone: 'warn', icon: 'offline', pill: 'Send' },
};

export interface NeedsRowProps {
  kind: NeedKind;
  title: string;
  sub: string;
  count: number;
  /** The pill's word, when not the kind's own. */
  pill?: string;
  on: () => void;
}

export function NeedsRow(p: NeedsRowProps): JSX.Element {
  const k = KIND[p.kind];
  return (
    <Tap on={p.on} class="ow-needs">
      <IconTile tone={k.tone} duo={k.duo} icon={k.icon} size={38} />
      <span class="ow-needs-t"><span>{p.title}</span><span class="mono">{p.sub}</span></span>
      <b class="mono ow-needs-n" style={{ color: k.tone === 'warn' ? TILE_TONE.warn.ink : TILE_TONE[k.tone].fg }}>{p.count}</b>
      <span class="ow-needs-pill">{p.pill || k.pill}</span>
    </Tap>
  );
}
