/*
 * Today's FRAME only (TD01): the navy hero's head row — "Good morning, Musa", "Sat 17 Oct ·
 * Live" (or "Updating · saved 7:52"), the Alerts bell with today's count for you, the avatar
 * (opens You) — and an empty body. The Today builder fills both: the hero's yard picture
 * ("The yard · today", 7 jobs left, the bar) goes in <Hero>'s children; the cards (On the
 * move, Next job, Needs you) go in <main>. Its own words and rules live in this folder.
 */
import type { JSX } from 'preact';
import { firstWord, initials } from '../../../core/names.ts';
import { clock, dayLabel, dayOf, greeting } from '../../../core/time.ts';
import { Hero } from '../../../ui/Hero.tsx';
import { nav } from '../shell/nav.ts';
import { books, now, session, status } from '../shell/store.ts';

export function Today(): JSX.Element {
  const b = books.value, n = now.value;
  const name = firstWord(b ? b.me.name : session.value ? session.value.name : '');
  const today = dayOf(n);
  // The bell counts only today's alerts for you (WORD-10); the Today builder adds "read when Alerts was opened".
  const mine = b ? b.alerts.filter((a) => a.forYou && dayOf(a.at) === today).length : 0;
  return (
    <>
      <Hero greeting={`${greeting(n)}, ${name}`} line={dayLabel(n)} status={status.value === 'live' ? 'live' : 'updating'} savedAt={b ? clock(b.at) : '—'}
        me={{ initials: b ? b.me.initials : initials(name), tint: 'me' }} onMe={() => nav.push('today/you')}
        bell={{ count: mine, label: `Alerts, ${mine} new for you`, on: () => nav.push('today/alerts') }} />
      <main class="st-today" data-route="today">
        {/* The Today area builds the cards here (TD01): On the move · Next job · Needs you. */}
      </main>
    </>
  );
}
