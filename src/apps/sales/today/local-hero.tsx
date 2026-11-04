/*
 * LOCAL PART (moves to src/ui as P02's variants; Hero.tsx has none of these yet):
 * Today's navy hero as the Today boards draw it (TD01–TD09):
 *
 *   - the glass Find button beside the avatar (TD01–TD09; open question 1 in manifest/today.json)
 *   - `line`: the words under the greeting when not the date ("Your first day", TD06)
 *   - `note`: mint words beside the figure ("your first sale starts it", TD06)
 *   - goal hit as TD08 draws it: the bar in proportion (35 : 1.22), "Goal hit · +1.2M over", days left
 *   - `compact` (TD02, a busy day): the head row only, "38 on the move · 22 need you"; the goal
 *     comes under it as a white strip (GoalStrip)
 *
 * It uses P02's own classes (src/ui/hero.css) and adds only what P02 lacks (local-hero.css).
 */
import type { ComponentChildren, JSX } from 'preact';
import { Avatar, type Face } from '../../../ui/Avatar.tsx';
import { Icon, type IconName } from '../../../ui/icons.tsx';
import { Tap, cx } from '../../../ui/util.tsx';
import '../../../ui/hero.css';
import './local-hero.css';

export interface HeroDoor { tone: 'mint' | 'amber'; icon: IconName; value: string; label: string; on: () => void }
export type HeroGoal =
  | { pct: number; movePct: number; target: string; daysLeft: number }
  | { hit: true; target: number; sold: number; over: string; daysLeft: number; label: string };

export interface TodayHeroProps {
  greeting: string;
  /** "Sat 17 Oct", "Your first day". */
  line: string;
  status: 'live' | 'updating';
  savedAt?: string;
  me: Face;
  onMe: () => void;
  onFind: () => void;
  /** A busy day: the head row only; `compact` is the line under the greeting. */
  compact?: ComponentChildren;
  month?: string;
  sold?: string;
  soldLabel?: string;
  note?: string;
  onSold?: () => void;
  goal?: HeroGoal;
  onGoal?: () => void;
  doors?: HeroDoor[];
}

const chev = <Icon name="chevron-right" size={14} stroke={2.4} style={{ opacity: 0.7 }} />;

export function TodayHero(p: TodayHeroProps): JSX.Element {
  const top = (
    <>
      <div class="ow-hero-hi">
        <span class="ow-hero-greet">{p.greeting}</span>
        {p.compact ? <span class="td-hero-sub">{p.compact}</span> : (
          <span class="ow-hero-date">{p.line}<span aria-hidden="true" class="ow-hero-sep" />
            {p.status === 'updating'
              ? <span class="ow-hero-live upd"><span aria-hidden="true" />{`Updating · saved ${p.savedAt}`}</span>
              : <span class="ow-hero-live"><span aria-hidden="true" />Live</span>}
          </span>
        )}
      </div>
      <div class="td-hero-acts">
        <Tap on={p.onFind} label="Find a chat, customer, order or item" class="td-hero-find"><Icon name="search" size={20} stroke={2} /></Tap>
        <Tap on={p.onMe} label="You: your account and this phone" class="ow-hero-me">
          <Avatar {...p.me} size={46} onNavy ring="me" style={{ fontSize: '15px' }} />
        </Tap>
      </div>
    </>
  );
  if (p.compact) return <header class="ow-hero td-hero-compact">{top}</header>;
  const g = p.goal;
  return (
    <header class="ow-hero">
      <div class="ow-hero-top">{top}</div>
      <Tap on={p.onSold} label={p.soldLabel} class="ow-hero-sold">
        <span class="ow-hero-eyebrow">{`Sold · ${p.month}`}{chev}</span>
        <span class="ow-hero-fig"><span>UGX</span><span class="mono">{p.sold}</span>{p.note && <span class="td-hero-note">{p.note}</span>}</span>
      </Tap>
      {g && 'hit' in g ? (
        <Tap on={p.onGoal} label={g.label} class="ow-hero-goal">
          <span aria-hidden="true" class="ow-hero-bar td-hero-hitbar"><span style={{ flex: g.target }} /><span style={{ flex: Math.max(0, g.sold - g.target) }} /></span>
          <span class="ow-hero-goal-l"><span class="td-hero-hit"><Icon name="trophy" size={14} stroke={2.4} />Goal hit · <b class="mono">{g.over}</b> over</span>
            <span class="ow-hero-days">{`${g.daysLeft} days left`}{chev}</span></span>
        </Tap>
      ) : g ? (
        <Tap on={p.onGoal} label={`Goal: ${g.pct} percent of ${g.target.replace('M', ' million')}, ${g.daysLeft} days left`} class="ow-hero-goal">
          <span aria-hidden="true" class="ow-hero-bar">
            <span style={{ width: `${g.pct}%` }} />
            {g.movePct > 0 && <span class="move" style={{ width: `${g.movePct}%` }} />}
          </span>
          <span class="ow-hero-goal-l">
            <span><b class="mono">{`${g.pct}%`}</b> of your <span class="mono">{g.target}</span> goal</span>
            <span class="ow-hero-days">{`${g.daysLeft} days left`}{chev}</span>
          </span>
        </Tap>
      ) : null}
      {p.doors && p.doors.length > 0 && (
        <div class="ow-hero-doors">
          {p.doors.map((d) => (
            <Tap key={d.label} on={d.on} class={cx('ow-hero-door', d.tone)}>
              <span class="ow-hero-door-ic"><Icon name={d.icon} size={18} stroke={2.2} /></span>
              <span class="ow-hero-door-t"><span class="mono">{d.value}</span><span>{d.label}</span></span>
              <span class="ow-hero-door-go"><Icon name="chevron-right" size={14} stroke={2.4} /></span>
            </Tap>
          ))}
        </div>
      )}
    </header>
  );
}

/** TD02: the goal as a white strip under a compact hero. */
export function GoalStrip(p: { pct: number; movePct: number; target: string; daysLeft: number; on: () => void }): JSX.Element {
  return (
    <Tap on={p.on} label={`Goal: ${p.pct} percent of ${p.target.replace('M', ' million')}, ${p.daysLeft} days left`} class="td-goalstrip">
      <span class="mono">{`${p.pct}%`}</span>
      <span aria-hidden="true" class="td-goalstrip-bar"><span style={{ width: `${p.pct}%` }} /><span style={{ width: `${p.movePct}%` }} /></span>
      <span>{`of ${p.target} · ${p.daysLeft} days left`}</span>
    </Tap>
  );
}
