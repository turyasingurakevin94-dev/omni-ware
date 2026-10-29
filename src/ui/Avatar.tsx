/*
 * P11 · Avatars (LANGUAGE.md §3 P11, §1.1 tints): two letters on the
 * person's tint. The tint is identity, never state; the phone's owner is
 * navy ('me'), #243052 on a navy ground.
 *
 *   <Avatar initials="KC" tint="t0" size={40} />
 *   <Avatar initials="GA" tint="me" onNavy size={46} ring="me" />        Today's "You" (mint ring)
 *   <FaceStack faces={[{ initials: 'KS', tint: 't1' }]} more={2} />      P07: up to 3, 24 px, overlap -6
 *   <RingAvatar initials="KS" tint="t1" tone="late" fill={1} />          P10: the due ring, 44 px
 */
import type { JSX } from 'preact';
import { TINTS } from '../core/names.ts';
import type { Tint } from '../core/types.ts';
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
}

/** P07 · who is in a stage: up to three faces overlapping -6, then "+n". */
export function FaceStack(p: FaceStackProps): JSX.Element {
  const size = p.size || 24;
  return (
    <span aria-hidden="true" class="ow-faces">
      {p.faces.slice(0, 3).map((f, i) => (
        <span key={i} class="ow-av ow-face" style={{ ...avatarStyle({ ...f, size }), borderColor: p.ground || '#F7F5F2', marginLeft: i ? '-6px' : undefined }}>{f.initials}</span>
      ))}
      {!!p.more && <span class="ow-faces-more mono">{`+${p.more}`}</span>}
    </span>
  );
}

/** P10's ring tones: due green, late amber, gone quiet crimson (full), early grey. */
export const RING_TONE = { due: '#0F6B43', late: '#95530C', quiet: '#8E2A22', early: '#9AA1AE' } as const;

export interface RingAvatarProps extends Face {
  tone: keyof typeof RING_TONE;
  /** How much of their usual gap has run out, 0 to 1. */
  fill: number;
}

/** P10 · the due ring: 44 box, r 20, stroke 3 on #EFECE6, the avatar inset 6 px. */
export function RingAvatar(p: RingAvatarProps): JSX.Element {
  const c = 125.7, f = Math.max(0, Math.min(1, p.fill));
  return (
    <span aria-hidden="true" class="ow-ring">
      <svg width="44" height="44" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r="20" fill="none" stroke="#EFECE6" stroke-width="3" />
        {f > 0 && <circle cx="22" cy="22" r="20" fill="none" stroke={RING_TONE[p.tone]} stroke-width="3" stroke-linecap="round"
          stroke-dasharray={`${(c * f).toFixed(1)} ${c}`} transform="rotate(-90 22 22)" />}
      </svg>
      <span class="ow-av" style={avatarStyle({ ...p, size: 32, font: 12 })}>{p.initials}</span>
    </span>
  );
}
