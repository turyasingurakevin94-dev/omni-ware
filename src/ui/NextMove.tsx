/*
 * P09 · The dark "Next move" card (LANGUAGE.md §3 P09; as built: TD03).
 * The best play, large, on the radial navy: a tone tag and "1 of 4"; the
 * dial (their rhythm as a white ring, the days past it as an amber arc,
 * the avatar inside) beside the name and the big figure; their usual as
 * glass tiles; the usual's value, a Call square and one white button.
 * Sales has no "You earn": mint is kept for money that came in.
 *
 *   <NextMove tag={{ tone: 'amber', icon: 'clock', text: 'Due for their usual' }} pos="1 of 4"
 *     face={{ initials: 'KS', tint: 't1' }} rhythm={1} late={0.29} name="Kyaligonza & Sons"
 *     big="+4 days" bigSub="past their rhythm" legend={['every 14 days', 'late']}
 *     usual={[{ aisle: 'Cement', text: '40 bag' }, …]} footLabel="Their usual" footValue={2672000}
 *     phone="+256772000105" act={{ label: 'Order usual', on: … }} />
 */
import type { JSX } from 'preact';
import { avatarStyle, type Face } from './Avatar.tsx';
import { AisleIcon, Icon, type IconName } from './icons.tsx';
import { fig } from './Money.tsx';
import { NavyPill } from './Pill.tsx';
import { Tap, type Fig } from './util.tsx';
import './nextmove.css';

export interface NextMoveProps {
  tag: { tone: 'amber' | 'mint' | 'glass'; icon: IconName; text: string };
  /** "1 of 4". */
  pos?: string;
  face: Face;
  /** Their rhythm, 0 to 1 (the white ring). */
  rhythm: number;
  /** The days past it, 0 to 1 of the outer circle (the amber arc). */
  late: number;
  name: string;
  big: string;
  bigSub?: string;
  /** Under the name: the white dot's words, then the amber dot's. */
  legend?: [string, string];
  usual?: { aisle: string; text: string }[];
  footLabel: string;
  footValue: Fig;
  phone?: string;
  callLabel?: string;
  act: { label: string; on: () => void };
}

/** The dial: 84 px, the rhythm ring inside (r 30), the late arc outside (r 37), the face in the middle. */
export function Dial(p: { face: Face; rhythm: number; late: number }): JSX.Element {
  const ci = 188.5, co = 232.5;
  return (
    <span aria-hidden="true" class="ow-dial">
      <svg width="84" height="84" viewBox="0 0 84 84">
        <circle cx="42" cy="42" r="30" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="5" />
        {p.rhythm > 0 && <circle cx="42" cy="42" r="30" fill="none" stroke="#FFFFFF" stroke-width="5" stroke-dasharray={`${(ci * Math.min(1, p.rhythm)).toFixed(1)} ${ci}`} transform="rotate(-90 42 42)" />}
        {p.late > 0 && <circle cx="42" cy="42" r="37" fill="none" stroke="#F5B26B" stroke-width="5" stroke-linecap="round" stroke-dasharray={`${(co * Math.min(1, p.late)).toFixed(1)} ${co}`} transform="rotate(-90 42 42)" />}
      </svg>
      <span class="ow-av ow-dial-face" style={avatarStyle({ ...p.face, size: 50, font: 16 })}>{p.face.initials}</span>
    </span>
  );
}

export function NextMove(p: NextMoveProps): JSX.Element {
  return (
    <div class="ow-next">
      <div class="ow-next-top">
        <NavyPill tone={p.tag.tone} icon={p.tag.icon}>{p.tag.text}</NavyPill>
        {p.pos && <span class="mono ow-next-pos">{p.pos}</span>}
      </div>
      <div class="ow-next-who">
        <Dial face={p.face} rhythm={p.rhythm} late={p.late} />
        <span class="ow-next-t">
          <span class="ow-next-name">{p.name}</span>
          <span class="ow-next-big"><span class="mono">{p.big}</span>{p.bigSub && <span>{p.bigSub}</span>}</span>
          {p.legend && (
            <span class="ow-next-legend">
              <span><span aria-hidden="true" style={{ background: '#FFFFFF' }} />{p.legend[0]}</span>
              <span><span aria-hidden="true" style={{ background: '#F5B26B' }} />{p.legend[1]}</span>
            </span>
          )}
        </span>
      </div>
      {p.usual && p.usual.length > 0 && (
        <div class="ow-next-usual">
          {p.usual.slice(0, 3).map((u, i) => <span key={i}><AisleIcon aisle={u.aisle} size={18} color="currentColor" /><span class="mono">{u.text}</span></span>)}
        </div>
      )}
      <div class="ow-next-foot">
        <span class="ow-next-val"><span>{p.footLabel}</span><span class="mono">{fig(p.footValue)}</span></span>
        {p.phone && <Tap href={'tel:' + p.phone} label={p.callLabel || `Call ${p.name}`} class="ow-next-call"><Icon name="phone" size={19} stroke={2} /></Tap>}
        <button type="button" class="ow-next-act" onClick={p.act.on}>{p.act.label}<Icon name="chevron-right" size={16} stroke={2.4} /></button>
      </div>
    </div>
  );
}
