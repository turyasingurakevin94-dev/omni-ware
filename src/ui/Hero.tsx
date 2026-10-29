/*
 * P02 · Today's navy hero (LANGUAGE.md §3 P02; as built: TD01). Greeting,
 * date and Live; your avatar (opens You); what was sold this month (opens
 * Your day); the goal bar (opens Goal); the glass row of two doors. Sales
 * shows what was sold, never earnings; the mint part of the bar is what is
 * on the move (placed, not delivered).
 *
 *   <Hero greeting="Good morning, Grace" date="Sat 17 Oct" me={{ initials: 'GA', tint: 'me' }} onMe={…}
 *     month="October" sold={12480000} onSold={…}
 *     goal={{ pct: 36, movePct: 9, target: '35M', daysLeft: 14 }} onGoal={…}
 *     doors={[{ tone: 'mint', icon: 'trend', value: '+3.2M', label: 'on the move', on: … }, …]} />
 *
 * States: status="updating" (amber dot, "Updating · saved 7:52"); goal={{ hit: true, over: '+1.2M' }};
 * goal={null} with manager="Ruth" ("Ruth sets your goal").
 */
import type { JSX } from 'preact';
import { Avatar, type Face } from './Avatar.tsx';
import { Icon, type IconName } from './icons.tsx';
import { fig } from './Money.tsx';
import { Tap, cx, type Fig } from './util.tsx';
import './hero.css';

export interface HeroDoor { tone: 'mint' | 'amber'; icon: IconName; value: string; label: string; on: () => void }

export type HeroGoal = { pct: number; movePct: number; target: string; daysLeft: number } | { hit: true; over: string };

export interface HeroProps {
  greeting: string;
  date: string;
  status?: 'live' | 'updating';
  /** "7:52", for Updating. */
  savedAt?: string;
  me: Face;
  onMe: () => void;
  month: string;
  sold: Fig;
  onSold: () => void;
  goal: HeroGoal | null;
  onGoal: () => void;
  /** Who sets the goal, for "Ruth sets your goal". */
  manager?: string;
  doors?: HeroDoor[];
}

const chev = <Icon name="chevron-right" size={14} stroke={2.4} style={{ opacity: 0.7 }} />;

export function Hero(p: HeroProps): JSX.Element {
  const g = p.goal;
  return (
    <header class="ow-hero">
      <div class="ow-hero-top">
        <div class="ow-hero-hi">
          <span class="ow-hero-greet">{p.greeting}</span>
          <span class="ow-hero-date">{p.date}<span aria-hidden="true" class="ow-hero-sep" />
            {p.status === 'updating'
              ? <span class="ow-hero-live upd"><span aria-hidden="true" />{`Updating · saved ${p.savedAt}`}</span>
              : <span class="ow-hero-live"><span aria-hidden="true" />Live</span>}
          </span>
        </div>
        <Tap on={p.onMe} label="You: your account and this phone" class="ow-hero-me">
          <Avatar {...p.me} size={46} onNavy ring="me" style={{ fontSize: '15px' }} />
        </Tap>
      </div>
      <Tap on={p.onSold} label={`Sold in ${p.month}: ${fig(p.sold)}. Open your day.`} class="ow-hero-sold">
        <span class="ow-hero-eyebrow">{`Sold · ${p.month}`}{chev}</span>
        <span class="ow-hero-fig"><span>UGX</span><span class="mono">{fig(p.sold)}</span></span>
      </Tap>
      {g && 'hit' in g ? (
        <Tap on={p.onGoal} label={`Goal hit, ${g.over} over`} class="ow-hero-goal">
          <span aria-hidden="true" class="ow-hero-bar"><span style={{ width: '88%' }} /><span class="over" style={{ width: '12%' }} /></span>
          <span class="ow-hero-goal-l hit"><span><Icon name="trophy" size={14} stroke={2.4} />{`Goal hit · ${g.over} over`}</span><span>{chev}</span></span>
        </Tap>
      ) : g ? (
        <Tap on={p.onGoal} label={`Goal: ${g.pct} percent of ${g.target}, ${g.daysLeft} days left`} class="ow-hero-goal">
          <span aria-hidden="true" class="ow-hero-bar">
            <span style={{ width: `${g.pct}%` }} />
            {g.movePct > 0 && <span class="move" style={{ width: `${g.movePct}%` }} />}
          </span>
          <span class="ow-hero-goal-l">
            <span><b class="mono">{`${g.pct}%`}</b> of your <span class="mono">{g.target}</span> goal</span>
            <span class="ow-hero-days">{`${g.daysLeft} days left`}{chev}</span>
          </span>
        </Tap>
      ) : (
        <Tap on={p.onGoal} class="ow-hero-goal">
          <span class="ow-hero-goal-l"><span class="ow-hero-days"><Icon name="flag" size={14} stroke={2.4} />{`${p.manager || 'Ruth'} sets your goal`}</span></span>
        </Tap>
      )}
      {p.doors && p.doors.length > 0 && (
        <div class="ow-hero-doors">
          {p.doors.map((d) => (
            <Tap key={d.label} on={d.on} class={cx('ow-hero-door', d.tone)}>
              <span class="ow-hero-door-ic"><Icon name={d.icon} size={18} stroke={2.2} /></span>
              <span class="ow-hero-door-t"><span class="mono">{d.value}</span><span>{d.label}</span></span>
              <span class="ow-hero-door-go">{<Icon name="chevron-right" size={14} stroke={2.4} />}</span>
            </Tap>
          ))}
        </div>
      )}
    </header>
  );
}
