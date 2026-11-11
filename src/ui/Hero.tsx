/*
 * P02 · Today's navy hero (LANGUAGE.md §3 P02; as built: TD01–TD09). Greeting, the date (or
 * "Your first day") and Live; the glass Find button and your avatar (opens You); what was sold
 * this month (opens Your day), with a mint note beside it; the goal bar (opens Goal); the glass
 * row of two doors. Sales shows what was sold, never earnings; the mint part of the bar is what
 * is on the move (placed, not delivered).
 *
 *   <Hero greeting="Good morning, Grace" line="Sat 17 Oct" status="live" me={{ initials: 'GA', tint: 'me' }} onMe={…} onFind={…}
 *     month="October" sold="12,480,000" onSold={…} goal={{ pct: 36, movePct: 9, target: '35M', daysLeft: 14 }} onGoal={…}
 *     doors={[{ tone: 'mint', icon: 'trend', value: '+3.2M', label: 'on the move', on: … }, …]} />
 *
 * States: status="updating" (amber dot, "Updating · saved 7:52"); goal hit (TD08: the bar in
 * proportion, "Goal hit · +1.2M over"); goal={null} with manager ("Ruth sets your goal");
 * compact (TD02, a busy day): the head row only, its line under the greeting, the goal under it
 * as a white GoalStrip. No onFind: no Find button (the parts board).
 *
 * The Store's Today (store-agent TD01): `bell` puts the glass Alerts bell (its crimson count) beside the
 * avatar; with no `month` there is no Sold block, and `children` (the yard's own picture) follow the head row.
 */
import type { ComponentChildren, JSX } from 'preact';
import { Avatar, type Face } from './Avatar.tsx';
import { Icon, type IconName } from './icons.tsx';
import { fig } from './Money.tsx';
import { Tap, barW, cx, type Fig } from './util.tsx';
import './hero.css';

export interface HeroDoor { tone: 'mint' | 'amber'; icon: IconName; value: string; label: string; on: () => void }
export type HeroGoal =
  | { pct: number; movePct: number; target: string; daysLeft: number }
  | { hit: true; target: number; sold: number; over: string; daysLeft: number; label: string };

export interface HeroProps {
  greeting: string;
  /** "Sat 17 Oct", "Your first day". */
  line: string;
  status: 'live' | 'updating' | 'off' | 'checking';
  savedAt?: string;
  /** The words for 'off' (a rose dot: the Store's TD07 "Not loaded", TD22 "Could not reach the shop") and 'checking' (an amber spinner: TD21 "Checking your shop…"). */
  statusText?: string;
  me: Face;
  onMe: () => void;
  /** The glass Find button beside the avatar. */
  onFind?: () => void;
  /** A busy day: the head row only; `compact` is the line under the greeting. */
  compact?: ComponentChildren;
  month?: string;
  sold?: Fig;
  soldLabel?: string;
  /** Mint words beside the figure ("your first sale starts it", TD06). */
  note?: string;
  onSold?: () => void;
  /** null: no goal yet ("Ruth sets your goal"); left out: no goal row. */
  goal?: HeroGoal | null;
  onGoal?: () => void;
  manager?: string;
  doors?: HeroDoor[];
  /** The glass Alerts bell beside the avatar, with its count (the Store, TD01). */
  bell?: { count: number; label: string; on: () => void };
  /** What a role draws under the head row instead of Sold and the goal (the Store's yard). */
  children?: ComponentChildren;
}

const chev = <Icon name="chevron-right" size={14} stroke={2.4} style={{ opacity: 0.7 }} />;

export function Hero(p: HeroProps): JSX.Element {
  const me = (
    <Tap on={p.onMe} label="You: your account and this phone" class="ow-hero-me">
      <Avatar {...p.me} size={46} onNavy ring="me" style={{ fontSize: '15px' }} />
    </Tap>
  );
  const top = (
    <>
      <div class="ow-hero-hi">
        <span class="ow-hero-greet">{p.greeting}</span>
        {p.compact ? <span class="ow-hero-sub">{p.compact}</span> : (
          <span class="ow-hero-date">{p.line}<span aria-hidden="true" class="ow-hero-sep" />
            {p.status === 'updating'
              ? <span class="ow-hero-live upd"><span aria-hidden="true" />{`Updating · saved ${p.savedAt}`}</span>
              : p.status === 'off' ? <span class="ow-hero-live off"><span aria-hidden="true" />{p.statusText}</span>
                : p.status === 'checking' ? <span class="ow-hero-live chk"><span aria-hidden="true" />{p.statusText}</span>
                  : <span class="ow-hero-live"><span aria-hidden="true" />Live</span>}
          </span>
        )}
      </div>
      {p.onFind || p.bell ? (
        <div class="ow-hero-acts">
          {p.onFind && <Tap on={p.onFind} label="Find a chat, customer, order or item" class="ow-hero-find"><Icon name="search" size={20} stroke={2} /></Tap>}
          {p.bell && (
            <Tap on={p.bell.on} label={p.bell.label} class="ow-hero-find ow-hero-bell">
              <Icon name="bell" size={20} stroke={2} />
              {p.bell.count > 0 && <span aria-hidden="true" class="ow-hero-bell-n mono">{p.bell.count}</span>}
            </Tap>
          )}
          {me}
        </div>
      ) : me}
    </>
  );
  if (p.compact) return <header class="ow-hero compact">{top}</header>;
  const g = p.goal;
  return (
    <header class="ow-hero">
      <div class="ow-hero-top">{top}</div>
      {p.month != null && <Tap on={p.onSold} label={p.soldLabel || `Sold in ${p.month}: ${fig(p.sold ?? 0)}. Open your day.`} class="ow-hero-sold">
        <span class="ow-hero-eyebrow">{`Sold · ${p.month}`}{chev}</span>
        <span class="ow-hero-fig"><span>UGX</span><span class="mono">{fig(p.sold ?? 0)}</span>{p.note && <span class="ow-hero-note">{p.note}</span>}</span>
      </Tap>}
      {g && 'hit' in g ? (
        <Tap on={p.onGoal} label={g.label} class="ow-hero-goal">
          <span aria-hidden="true" class="ow-hero-bar hit"><span style={{ flex: g.target }} /><span style={{ flex: Math.max(0, g.sold - g.target) }} /></span>
          <span class="ow-hero-goal-l"><span class="ow-hero-hit"><Icon name="trophy" size={14} stroke={2.4} />Goal hit · <b class="mono">{g.over}</b> over</span>
            <span class="ow-hero-days">{`${g.daysLeft} days left`}{chev}</span></span>
        </Tap>
      ) : g ? (
        <Tap on={p.onGoal} label={`Goal: ${g.pct} percent of ${g.target.replace('M', ' million')}, ${g.daysLeft} days left`} class="ow-hero-goal">
          <span aria-hidden="true" class="ow-hero-bar">
            <span style={{ width: barW(g.pct) }} />
            {g.movePct > 0 && <span class="move" style={{ width: barW(g.movePct, g.pct) }} />}
          </span>
          <span class="ow-hero-goal-l">
            <span><b class="mono">{`${g.pct}%`}</b> of your <span class="mono">{g.target}</span> goal</span>
            <span class="ow-hero-days">{`${g.daysLeft} days left`}{chev}</span>
          </span>
        </Tap>
      ) : g === null ? (
        <Tap on={p.onGoal} class="ow-hero-goal">
          <span class="ow-hero-goal-l"><span class="ow-hero-days"><Icon name="flag" size={14} stroke={2.4} />{`${p.manager || 'Ruth'} sets your goal`}</span></span>
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
      {p.children}
    </header>
  );
}

/** P02b · TD02: the goal as a white strip under a compact hero. */
export function GoalStrip(p: { pct: number; movePct: number; target: string; daysLeft: number; on: () => void }): JSX.Element {
  return (
    <Tap on={p.on} label={`Goal: ${p.pct} percent of ${p.target.replace('M', ' million')}, ${p.daysLeft} days left`} class="ow-goalstrip">
      <span class="mono">{`${p.pct}%`}</span>
      <span aria-hidden="true" class="ow-goalstrip-bar"><span style={{ width: barW(p.pct) }} /><span style={{ width: barW(p.movePct, p.pct) }} /></span>
      <span>{`of ${p.target} · ${p.daysLeft} days left`}</span>
    </Tap>
  );
}
