/*
 * P11 · Avatars (LANGUAGE.md §3 P11, §1.1 tints): two letters on the
 * person's tint. The tint is identity, never state; the phone's owner is
 * navy ('me'), #243052 on a navy ground.
 *
 *   <Avatar initials="KC" tint="t0" size={40} />
 *   <Avatar initials="GA" tint="me" onNavy size={46} ring="me" />        Today's "You" (mint ring)
 *   <FaceStack faces={[{ initials: 'KS', tint: 't1' }]} more={2} />      P07: up to 3, 24 px, overlap -6, the first on top
 *   <RingAvatar face={{ initials: 'KS', tint: 't1' }} tone="late" fill={1} />   P10: the due ring, 44 px
 *   <RingAvatar face={null} tone="quiet" fill={.5} badge={owner} />            a chat: a number nobody saved, whose chat
 */
import type { JSX } from 'preact';
import { TINTS } from '../core/names.ts';
import type { Tint } from '../core/types.ts';
import { Icon } from './icons.tsx';
import { cx } from './util.tsx';
import './avatar.css';

export interface Face { initials: string; tint: Tint }

/** Each size's letters (P11: xs 24 → 11, sm 32 → 12, md 38–40 → 13, lg 44–46 → 15, 52 → 17). */
const FONT: Record<number, number> = { 18: 11, 20: 11, 22: 11, 24: 11, 30: 11, 32: 12, 34: 12, 38: 13, 40: 13, 44: 15, 46: 15, 52: 17 };

export interface AvatarProps extends Face {
  size?: number;
  /** Letters size, when not the size's own. */
  font?: number;
  /** 'me' on a navy ground is #243052 (§1.1). */
  onNavy?: boolean;
  /** 'me': Grace's mint ring on navy; 'basket': the amber ring of an order not placed (P05); or any box-shadow. */
  ring?: 'me' | 'basket' | string;
  class?: string;
  style?: JSX.CSSProperties;
}

const RINGS: Record<string, string> = {
  me: '0 0 0 2px #16203C, 0 0 0 4px rgba(111,220,176,.55)',
  basket: '0 0 0 2px #FFFFFF, 0 0 0 3.5px #95530C',
};

export function avatarStyle(p: AvatarProps): JSX.CSSProperties {
  const size = p.size || 40, t = TINTS[p.tint] || TINTS.t4;
  return {
    width: `${size}px`, height: `${size}px`, fontSize: `${p.font || FONT[size] || Math.round(size / 3)}px`,
    background: p.tint === 'me' && p.onNavy ? '#243052' : t.bg, color: t.fg,
    letterSpacing: size <= 24 ? '-.04em' : undefined,
    boxShadow: p.ring ? RINGS[p.ring] || p.ring : undefined,
    ...p.style,
  };
}

export function Avatar(p: AvatarProps): JSX.Element {
  return <span aria-hidden="true" class={'ow-av' + (p.class ? ' ' + p.class : '')} style={avatarStyle(p)}>{p.initials}</span>;
}

export interface FaceStackProps {
  faces: Face[];
  /** "+2" after the faces. */
  more?: number;
  /** 24 (a stage tile) by default. */
  size?: number;
  /** The ground behind, for the 2 px ring (P07 tiles: #F7F5F2). */
  ground?: string;
  /** How many faces at most (3); the rest are "+n". */
  max?: number;
}

/** P07 · who is in a stage: up to three faces overlapping -6, then "+n" (the rest, unless `more` says). */
export function FaceStack(p: FaceStackProps): JSX.Element {
  const size = p.size || 24, n = Math.min(p.max || 3, p.faces.length), more = p.more ?? p.faces.length - n;
  return (
    <span aria-hidden="true" class="ow-faces">
      {p.faces.slice(0, n).map((f, i) => (
        <span key={i} class="ow-av ow-face" style={{ ...avatarStyle({ ...f, size }), borderColor: p.ground || '#F7F5F2', marginLeft: i ? '-6px' : undefined, position: 'relative', zIndex: n - i }}>{f.initials}</span>
      ))}
      {more > 0 && <span class="ow-faces-more mono">{`+${more}`}</span>}
    </span>
  );
}

/** A small avatar as the Asks boards draw it: no tight letter-spacing. */
/**
 * The boards space a face's letters by series, not by size: at 24 px and under, Orders, Chats, Customers, Counter,
 * Sell and every face stack draw -.04em; Today's lone faces beside words (TD04, TD05, TD15, TD16, TD18, TD19–TD27)
 * and Sourcing's "asked for" faces (SL09, SL37) draw normal spacing. Those places pass PLAIN.
 */
export const PLAIN = { letterSpacing: 'normal' };

/** P10's ring tones: due green, late amber, gone quiet crimson (full), early grey. */
export const RING_TONE = { due: '#0F6B43', late: '#95530C', quiet: '#8E2A22', early: '#9AA1AE' } as const;

export interface RingAvatarProps {
  /** Whose face; null: a number nobody has saved (a dashed ring round a phone, a chat). */
  face: Face | null;
  tone: keyof typeof RING_TONE;
  /** How much of their usual gap has run out (or of the hour a chat waits), 0 to 1. */
  fill: number;
  /** The 22 px face of whose it is, at the foot (a chat: whose chat). */
  badge?: Face | null;
  /** A ring with nothing run out yet still draws its start, a 3 px dot at the top (the Customers boards). */
  start?: boolean;
  /** The customer sheet's 56 px ring on navy (r 26, the track glass, 16 px letters). */
  big?: boolean;
}

/** P10 · the due ring: 44 box, r 20, stroke 3 on #EFECE6, the avatar inset 6 px. */
export function RingAvatar(p: RingAvatarProps): JSX.Element {
  const box = p.big ? 56 : 44, r = p.big ? 26 : 20, m = box / 2, c = p.big ? 163.4 : 125.7, f = Math.max(0, Math.min(1, p.fill));
  return (
    <span aria-hidden="true" class={cx('ow-ring', p.big && 'big')}>
      <svg width={box} height={box} viewBox={`0 0 ${box} ${box}`}>
        {p.face ? <circle cx={m} cy={m} r={r} fill="none" stroke={p.big ? 'rgba(255,255,255,.12)' : '#EFECE6'} stroke-width="3" />
          : <circle cx={m} cy={m} r={r} fill="none" stroke="#9AA1AE" stroke-width="1.5" stroke-dasharray="3 4" />}
        {(f > 0 || p.start) && <circle cx={m} cy={m} r={r} fill="none" stroke={RING_TONE[p.tone]} stroke-width="3" stroke-linecap="round"
          stroke-dasharray={`${(c * f).toFixed(1)} ${c}`} transform={`rotate(-90 ${m} ${m})`} />}
      </svg>
      {p.face ? <span class="ow-av" style={avatarStyle({ ...p.face, size: 32, font: p.big ? 16 : 12 })}>{p.face.initials}</span>
        : <span class="ow-ring-ph"><Icon name="phone" size={15} stroke={2} /></span>}
      {p.badge && <Avatar {...p.badge} size={22} class="badge" />}
    </span>
  );
}
