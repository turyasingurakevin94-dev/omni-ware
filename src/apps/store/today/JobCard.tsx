/*
 * The Next job card (TD01 Carry on, TD02 Check it in, TD03 Start the trip, TD04 Close the yard,
 * TD15 I've got it, TD32 Start packing): the agent's dark Next move card (P09) in the yard's words.
 * A tag and who it came from; the ring (how far along, how long it has waited, or done) with a face;
 * the name, the big figure and a dotted legend; up to three glass tiles (what is in it); who sees
 * what once it moves, and one white button.
 *
 * `compact` is TD01's: the card shares the first screen with the row under On the move (padding 10,
 * ring 68, tiles 52, button 44).
 */
import type { ComponentChildren, JSX } from 'preact';
import type { YardFace } from '../../../core/store/faces.ts';
import { avatarStyle } from '../../../ui/Avatar.tsx';
import { AisleIcon, Icon, type IconName } from '../../../ui/icons.tsx';
import { NavyPill } from '../../../ui/Pill.tsx';
import { cx } from '../../../ui/util.tsx';

export type RingTone = 'mint' | 'amber' | 'done' | 'none';
export interface JobTile { aisle?: string; icon?: IconName; /** A customer's face in place of the icon (TD03's #0559 LB). */ face?: YardFace; text: string; sub?: string; mark?: 'done' | 'wait' | 'drop'; strike?: boolean }

export interface JobCardProps {
  tag: { tone: 'mint' | 'amber' | 'glass' | 'blue'; icon: IconName; text: string };
  from?: { face: YardFace; text: string };
  /** The ring: mint fill (packed of lines), amber (waited, of 15 min), done (a full mint ring, a tick inside), or two faces (the yard passed). */
  ring: { tone: RingTone; fill: number; face?: YardFace } | { pair: [YardFace, YardFace] };
  name: string;
  big: string;
  bigTone: 'mint' | 'amber' | 'white';
  bigSub?: ComponentChildren;
  legend?: ComponentChildren;
  tiles: JobTile[];
  foot: { label: string; value: ComponentChildren; inline?: boolean };
  act: { label: string; aria?: string; on: () => void; icon?: IconName; state?: 'idle' | 'sending' };
  compact?: boolean;
}

function Ring(p: { ring: JobCardProps['ring']; compact?: boolean }): JSX.Element {
  const r = p.ring;
  if ('pair' in r) {
    return (
      <span aria-hidden="true" class="st-jring pair">
        <span class="ow-av a" style={avatarStyle({ ...r.pair[0], size: 46, font: 15 })}>{r.pair[0].initials}</span>
        <span class="ow-av b" style={avatarStyle({ ...r.pair[1], size: 52, font: 16 })}>{r.pair[1].initials}</span>
      </span>
    );
  }
  const c30 = 188.5, c37 = 232.5, s = p.compact ? 68 : 84, vb = p.compact ? '8 8 68 68' : '0 0 84 84';
  return (
    <span aria-hidden="true" class={cx('st-jring', p.compact && 'compact')}>
      <svg width={s} height={s} viewBox={vb}>
        <circle cx="42" cy="42" r="30" fill="none" stroke={r.tone === 'done' ? '#6FDCB0' : 'rgba(255,255,255,.12)'} stroke-width="5" />
        {r.tone === 'mint' && r.fill > 0 && <circle cx="42" cy="42" r="30" fill="none" stroke="#6FDCB0" stroke-width="5" stroke-linecap="round" stroke-dasharray={`${(c30 * Math.min(1, r.fill)).toFixed(1)} ${c30}`} transform="rotate(-90 42 42)" />}
        {r.tone === 'amber' && r.fill > 0 && <circle cx="42" cy="42" r="37" fill="none" stroke="#F5B26B" stroke-width="5" stroke-linecap="round" stroke-dasharray={`${(c37 * Math.min(1, r.fill)).toFixed(1)} ${c37}`} transform="rotate(-90 42 42)" />}
      </svg>
      {r.tone === 'done'
        ? <span class="st-jring-in done"><Icon name="check" size={26} stroke={2.6} /></span>
        : r.face && <span class="st-jring-in" style={avatarStyle({ ...r.face, size: 50, font: 16, style: { letterSpacing: 'normal' } })}>{r.face.initials}</span>}
    </span>
  );
}

export function JobCard(p: JobCardProps): JSX.Element {
  return (
    <div class={cx('st-job', p.compact && 'compact')}>
      <div class="st-job-top">
        <NavyPill tone={p.tag.tone} icon={p.tag.icon}>{p.tag.text}</NavyPill>
        {p.from && (
          <span class="st-job-from">
            <span aria-hidden="true" class="st-job-face" style={avatarStyle({ ...p.from.face, size: 22, font: 11 })}>{p.from.face.initials}</span>
            {p.from.text}
          </span>
        )}
      </div>
      <div class="st-job-who">
        <Ring ring={p.ring} compact={p.compact} />
        <span class="st-job-t">
          <span class="st-job-name">{p.name}</span>
          <span class="st-job-big"><span class={cx('mono', p.bigTone)}>{p.big}</span>{p.bigSub && <span class="st-job-bsub">{p.bigSub}</span>}</span>
          {p.legend && <span class="st-job-legend">{p.legend}</span>}
        </span>
      </div>
      {p.tiles.length > 0 && (
        <div class="st-job-tiles">
          {p.tiles.slice(0, 3).map((t, i) => (
            <span key={i} class="st-job-tile">
              {t.mark === 'done' && <span aria-hidden="true" class="st-jt-mark done"><Icon name="check" size={10} stroke={3.4} /></span>}
              {t.mark === 'wait' && <span aria-hidden="true" class="st-jt-mark wait" />}
              {t.mark === 'drop' && <span aria-hidden="true" class="st-jt-mark drop"><Icon name="close" size={9} stroke={3.6} /></span>}
              {t.face ? <span aria-hidden="true" class="ow-av" style={avatarStyle({ ...t.face, size: 20, font: 11 })}>{t.face.initials}</span>
                : t.aisle ? <AisleIcon aisle={t.aisle} size={18} color="#DDE3F0" /> : t.icon && <span class="st-jt-ic"><Icon name={t.icon} size={18} stroke={1.9} /></span>}
              <span class={cx('mono st-jt-v', t.strike && 'strike')}>{t.text}</span>
              {t.sub && <span class="st-jt-s">{t.sub}</span>}
            </span>
          ))}
        </div>
      )}
      <div class="st-job-foot">
        {p.foot.inline
          ? <span class="st-job-sees">{`${p.foot.label} `}<b>{p.foot.value}</b></span>
          : <span class="st-job-sees two"><span>{p.foot.label}</span><b>{p.foot.value}</b></span>}
        <button type="button" class={cx('st-job-act', p.act.icon && 'ic', p.act.state === 'sending' && 'sending')} aria-label={p.act.aria} onClick={p.act.on} disabled={p.act.state === 'sending'}>
          {p.act.state === 'sending' ? <><span aria-hidden="true" class="st-spin dark" />Sending…</>
            : p.act.icon ? <><Icon name={p.act.icon} size={17} stroke={2.6} />{p.act.label}</>
              : <>{p.act.label}<Icon name="chevron-right" size={16} stroke={2.4} /></>}
        </button>
      </div>
    </div>
  );
}

/** A dot and its words, for a card's legend ("● Not paid yet"). */
export function Dot(p: { color: string; children: ComponentChildren }): JSX.Element {
  return <span class="st-dotw"><span aria-hidden="true" style={{ background: p.color }} />{p.children}</span>;
}
