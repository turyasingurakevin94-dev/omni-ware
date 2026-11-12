/*
 * Today (TD01, and its states): the yard at a glance, the Next job, what needs you, what is done.
 * One screen; the books decide the state:
 *
 *   default      TD01 (TD33 the red button pressed), scrolled TD09 (the compact head stays)
 *   next job     TD02 a trip back (Check it in), TD03 a ride (Start the trip), TD04 from 17:30 Close the yard
 *   first day    TD05 nothing of the yard yet: Get going, the ghost of On the move, Turn on alerts
 *   no signal    TD06 Updating · saved 7:52, the amber bar, Waiting to send with Remove
 *   not loaded   TD07 Could not load the yard · code · Try again; the ghosts; the grey play
 *   update       TD08 Update ready · Reload
 *   passed       TD15 the colleague's phone: "Musa passed you the yard" → I've got it (TD25 sending);
 *                TD32 after it: "The yard is yours · Musa sees: Okello has it"
 * The bars are drawn here, at the top of the page, not over the tab bar (bars: false in index.tsx).
 */
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { firstWord, initials, orderNo } from '../../../core/names.ts';
import { doneToday, laterJobs, needsYou, nextJobs, readyJobs, waitingOnOthers, type Job } from '../../../core/store/jobs.ts';
import { handoverFor } from '../../../core/store/shift.ts';
import type { YardBooks } from '../../../core/store/types.ts';
import { clock, dayLabel, greeting } from '../../../core/time.ts';
import { GroupCard } from '../../../ui/ActRow.tsx';
import { Hero } from '../../../ui/Hero.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { Notice } from '../../../ui/Notice.tsx';
import { SectionHead } from '../../../ui/SectionHead.tsx';
import { nav } from '../shell/nav.ts';
import { jobs as liveJobs } from '../shell/next-job.ts';
import { books, discard, flush, kept, me, notDone, now, online, session, updateReady } from '../shell/store.ts';
import { bellCount } from './alerts-model.ts';
import { cardOf } from './cards.tsx';
import { JobCard } from './JobCard.tsx';
import { CompactHead, DoneRow, KeptRow, NeedRow, OnTheMove, UnpaidRow, YardHead } from './parts.tsx';
import { FirstDay, NotLoaded, Passed, YardIsYours } from './states.tsx';
import './today.css';

const toNeeds = (): void => { const el = document.getElementById('st-needs'); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 60 }); };
const toTop = (): void => window.scrollTo({ top: 0 });

/**
 * Joy's first day (TD05, spec §4.6): the yard has nothing of its own yet (no order, trip or return) and nothing is done today.
 * A shelf count that falls due does not end it: counting is the shelf's upkeep, and Walk the shelf is a first-day step.
 */
const firstDay = (b: YardBooks, j: Job[], done: number): boolean => j.every((x) => x.kind === 'count') && done === 0 && !b.orders.length && !b.trips.length && !b.returns.length;

export function Today(): JSX.Element {
  const b = books.value, n = now.value, off = !online.value, j = liveJobs.value;
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 200);
    window.addEventListener('scroll', on, { passive: true });
    on();
    return () => window.removeEventListener('scroll', on);
  }, []);
  const name = firstWord(b ? b.me.name : session.value ? session.value.name : '');
  if (!b) return <NotLoaded name={name} n={n} />;

  const done = doneToday(b, n), first = firstDay(b, j, done.length);
  const ready = readyJobs(j).filter((x) => x.kind !== 'close'), later = laterJobs(j);
  const { next, then } = nextJobs(j), needs = needsYou(j, n), waiting = waitingOnOthers(b, me.value, n);
  const k = kept.value, passed = handoverFor(b, b.me, n);
  const waitingPass = passed && passed.status === 'sent' ? passed : null, gotPass = passed && passed.status === 'accepted' ? passed : null;
  const nd = notDone.value, someone = nd && nd.tone === 'someone' ? nd : null;
  const plain = !off && !k.length && !updateReady.value && !waitingPass && !gotPass && !someone;
  const go = (x: Job) => () => nav.push(x.route, x.params);
  const bell = bellCount(b, n);

  const hero = (
    <Hero greeting={`${first ? 'Welcome' : greeting(n)}, ${name}`} line={first ? 'Your first day' : dayLabel(n)}
      status={off ? 'updating' : 'live'} savedAt={clock(b.at)}
      me={{ initials: b.me.initials || initials(name), tint: 'me' }} onMe={() => nav.push('today/you')}
      bell={{ count: bell, label: bell ? `Alerts, ${bell} new for you` : 'Alerts', on: () => nav.push('today/alerts') }}>
      <YardHead jobs={j} done={done.length} onSince={b.onSince} on={toNeeds} first={first} />
    </Hero>
  );
  if (first) return <>{hero}<FirstDay b={b} /></>;

  const compact = plain && waiting.length === 1 && !!next && next.kind === 'carry-on';
  const card = next ? cardOf(next, b, n, go(next), compact) : null;
  return (
    <>
      {scrolled && <CompactHead done={done.length} ready={ready.length} later={later.length} on={toTop} />}
      {hero}
      <main class={'st-today' + (compact ? '' : ' roomy')} data-route="today">
        {off || k.length ? (
          <Notice kind="offline" action={{ label: 'Try again', on: () => { void flush(); } }}>No signal{k.length > 0 && <> · <b class="mono">{k.length}</b> waiting to send</>}</Notice>
        ) : someone ? <Notice kind="someone">{someone.text}</Notice> : null}
        {updateReady.value && (
          <div class="st-update">
            <span aria-hidden="true" class="ow-itile" style={{ width: '38px', height: '38px', background: '#E3EEFB', color: '#1A5A8A' }}><Icon name="spark" size={20} stroke={2} /></span>
            <span class="st-need-t"><span>Update ready</span><span>or on the next open</span></span>
            <button type="button" class="st-update-b" onClick={() => location.reload()}><span><Icon name="retry" size={14} stroke={2.4} />Reload</span></button>
          </div>
        )}
        {gotPass && <YardIsYours ask={gotPass} b={b} />}
        {waitingPass && <Passed ask={waitingPass} b={b} n={n} jobs={j} />}

        <SectionHead title="On the move" meta={off ? `saved ${clock(b.at)}` : `${countDelivered(done)} delivered today`} after={!compact && (off || k.length > 0 || updateReady.value || !!gotPass || !!waitingPass || !!someone)} />
        <OnTheMove b={b} me={me.value} now={n} jobs={j} go={(id) => nav.push(id)}>
          {compact ? <UnpaidRow o={waiting[0]} b={b} now={n} on={() => nav.push('out/load')} /> : null}
        </OnTheMove>

        {k.length > 0 && <>
          <div id="st-kept"><SectionHead title="Waiting to send" meta={String(k.length)} after /></div>
          <GroupCard>
            {k.map((x) => <KeptRow key={x.id} k={x} b={b} onRemove={() => { if (confirm('Remove it from this phone? It will not be sent.')) void discard(x.id); }} />)}
            <div class="st-kept-foot"><Icon name="send" size={15} stroke={2} /><span>Each goes by itself · then they see it</span></div>
          </GroupCard>
        </>}

        {!waitingPass && card && <>
          <SectionHead title="Next job" meta={off ? 'works with no signal' : next && next.kind === 'close' ? 'from 17:30' : then ? `then ${thenWord(then, b)}` : undefined} after />
          <JobCard {...card} />
        </>}

        {!waitingPass && needs.length > 0 && <>
          <div id="st-needs" class="st-needs-h"><SectionHead title="Needs you" dot count={needs.length} after /></div>
          <div class="st-needs">{needs.map((x) => <NeedRow key={x.key} j={x} b={b} now={n} on={go(x)} />)}</div>
        </>}
        {!waitingPass && waiting.length > 0 && <>
          <div class="ow-subhead"><span>{next && next.kind === 'close' ? 'Carries to tomorrow' : 'Waiting on others'}</span><span class="mono">{next && next.kind === 'close' ? String(carries(b, waiting.length)) : String(waiting.length)}</span></div>
          <div class="st-group10">{waiting.map((o) => <UnpaidRow key={o.id} o={o} b={b} now={n} on={() => nav.push('out/load')} />)}</div>
        </>}
        {!waitingPass && done.length > 0 && <>
          <SectionHead title="Done today" meta={`${done.length} · who sees it`} after />
          <div class="st-donecard">{done.map((d, i) => <DoneRow key={i} d={d} b={b} />)}</div>
        </>}
      </main>
    </>
  );
}

const countDelivered = (d: ReturnType<typeof doneToday>): number => d.filter((x) => x.kind === 'delivered' || x.kind === 'handed-over').length;
/** What carries to tomorrow from Close the yard's card: the bays that stay and what is with Ruth (TD04 "2"). */
const carries = (b: YardBooks, stays: number): number => stays + (b.counts.some((c) => c.status === 'sent') ? 1 : 0);

/** "then #0556", "then Denis's trip". */
function thenWord(j: Job, b: YardBooks): string {
  if (j.orderId != null) return orderNo(j.orderId);
  if (j.trips) { const p = b.people.find((x) => x.id === j.trips![0].runnerId); return p ? `${firstWord(p.name)}'s trip` : j.trips[0].supplierName; }
  if (j.kind === 'count') return `aisle ${j.aisle}`;
  return j.kind;
}
