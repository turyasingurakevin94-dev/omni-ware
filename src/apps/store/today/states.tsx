/*
 * Today's other states: Joy's first day (TD05), the yard not loaded (TD07), the yard passed to you
 * (TD15 → I've got it, TD25 sending) and taken (TD32 "The yard is yours").
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { counted, firstWord, orderNo } from '../../../core/names.ts';
import { personFace, whoIs } from '../../../core/store/faces.ts';
import { jobsLeft, readyJobs, type Job } from '../../../core/store/jobs.ts';
import type { StoreAsk, YardBooks } from '../../../core/store/types.ts';
import { clock, dayLabel, greeting, howLong } from '../../../core/time.ts';
import { avatarStyle, FaceStack, type Face } from '../../../ui/Avatar.tsx';
import { Button } from '../../../ui/Button.tsx';
import { Checklist } from '../../../ui/Empty.tsx';
import { Hero } from '../../../ui/Hero.tsx';
import { Icon, type IconName } from '../../../ui/icons.tsx';
import { SectionHead } from '../../../ui/SectionHead.tsx';
import { Tap } from '../../../ui/util.tsx';
import { nav } from '../shell/nav.ts';
import { act, notDone, refresh, registerPush, session } from '../shell/store.ts';
import { JobCard } from './JobCard.tsx';
import { rowOf } from './cards.tsx';

const TILES: { word: string; icon: IconName; id: string }[] = [
  { word: 'Coming in', icon: 'tray-in', id: 'in' }, { word: 'To pack', icon: 'orders', id: 'pack' },
  { word: 'To load', icon: 'trolley', id: 'out/load' }, { word: 'On the road', icon: 'truck', id: 'out/road' },
];

/** The four stages drawn dashed, each still a way in (TD05 "fills as jobs come", TD07 "—"). */
export function GhostMove(p: { meta?: string; dash?: boolean; label: string }): JSX.Element {
  return (
    <div class={'st-ghost' + (p.dash ? ' dash' : '')}>
      {p.meta && <div class="st-ghost-h"><span>On the move</span><span>{p.meta}</span></div>}
      <div class="st-ghost-g">
        {TILES.map((t) => (
          <Tap key={t.id} on={() => nav.push(t.id)} label={`${t.word}: ${p.label}`} class="st-ghost-t">
            {p.dash ? <><span class="st-ghost-n"><Icon name={t.icon} size={15} stroke={1.9} /><span class="mono">—</span></span><span class="st-ghost-w">{t.word}</span><span aria-hidden="true" style={{ height: '24px' }} /></>
              : <><Icon name={t.icon} size={16} stroke={1.9} /><span class="st-ghost-w">{t.word}</span></>}
          </Tap>
        ))}
      </div>
    </div>
  );
}

/** TD05: Joy's first day. Get going, the ghost of On the move, Turn on alerts, who shows you the yard. */
export function FirstDay(p: { b: YardBooks }): JSX.Element {
  const ruth = p.b.people.find((x) => x.role === 'manager');
  const lead = p.b.people.find((x) => x.role === 'store' && x.id !== p.b.me.id && !x.away && x.userId) || p.b.people.find((x) => x.role === 'store' && x.id !== p.b.me.id);
  const alerts = () => { void registerPush(); nav.push('today/you'); };
  return (
    <main class="st-today roomy" data-route="today">
      <SectionHead title="Get going" meta="1 of 3" metaTone="good" />
      <Checklist steps={[
        { done: true, title: 'Signed in', sub: ruth ? `${firstWord(ruth.name)} added you` : 'Your login works' },
        { icon: 'bell', stroke: 2, title: 'Turn on alerts', sub: 'a buzz when a job comes in', on: alerts },
        { icon: 'shelf', stroke: 2, title: 'Walk the shelf', sub: `${p.b.aisles.length} aisles · A to ${String.fromCharCode(64 + Math.max(1, p.b.aisles.length))}`, on: () => nav.tab('shelf') },
      ]} />
      <GhostMove meta="fills as jobs come" label="nothing yet" />
      <Button kind="navy" icon="bell" stroke={2} onClick={alerts}>Turn on alerts</Button>
      {lead && (
        <div class="st-showyou">
          <FaceStack faces={[personFace(lead) as Face, ...(ruth ? [personFace(ruth) as Face] : [])]} size={32} ground="#FFFFFF" />
          <span class="st-need-t"><span>{`${firstWord(lead.name)} shows you the yard`}</span><span>{ruth ? `${firstWord(ruth.name)} decides counts, returns` : ''}</span></span>
          {lead.phone && <Tap href={'tel:' + lead.phone.replace(/\s/g, '')} label={`Call ${lead.name}`} class="st-call"><Icon name="phone" size={19} stroke={2} /></Tap>}
        </div>
      )}
    </main>
  );
}

/** TD07: the yard could not load. The hero says so, the red card has the code and Try again, the rest are ghosts. */
export function NotLoaded(p: { name: string; n: number }): JSX.Element {
  const nd = notDone.value, code = nd && nd.code ? nd.code : 'ST-104';
  const me = session.value;
  return (
    <>
      <Hero greeting={`${greeting(p.n)}, ${p.name}`} line={dayLabel(p.n)} status="off" statusText="Not loaded"
        me={{ initials: me ? me.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() : '?', tint: 'me' }} onMe={() => nav.push('today/you')}
        bell={{ count: 0, label: 'Alerts', on: () => nav.push('today/alerts') }}>
        <span class="st-yfig off" aria-label="Jobs: not loaded"><span class="st-yeye">The yard · today<Icon name="chevron-right" size={14} stroke={2.4} style={{ opacity: 0.7 }} /></span>
          <span class="st-ybig"><span class="mono n">—</span><span class="w">jobs left</span></span></span>
        <span class="st-ybarwrap off" aria-label="Not loaded"><span aria-hidden="true" class="st-ybar off" /><span class="st-yleg"><span>Not loaded yet</span><span class="mono">—</span></span></span>
      </Hero>
      <main class="st-today roomy" data-route="today">
        <div role="alert" class="st-failed">
          <div class="st-failed-h">
            <span aria-hidden="true" class="st-failed-ic"><Icon name="warning" size={18} stroke={2.2} /></span>
            <span class="st-failed-t"><b>Could not load the yard</b><span>The yard is fine · this phone couldn't ask</span></span>
          </div>
          <div class="st-failed-f">
            <span class="mono">{`code ${code}`}</span>
            <button type="button" class="st-failed-b" onClick={() => { notDone.value = null; void refresh(true); }}><Icon name="retry" size={15} stroke={2.4} style={{ color: '#6FDCB0' }} />Try again</button>
          </div>
        </div>
        <SectionHead title="On the move" meta="—" after />
        <GhostMove dash label="not loaded yet" />
        <SectionHead title="Next job" meta="—" after />
        <div class="st-ghostjob" aria-label="Next job: shows when the yard loads">
          <span class="st-gj-pill" /><span class="st-gj-t">shows when the yard loads</span>
          <span class="st-gj-ring" /><span class="st-gj-l1" /><span class="st-gj-l2" />
        </div>
      </main>
    </>
  );
}

/** TD15: the colleague's Today, "Musa passed you the yard": what moves, and I've got it (TD25 sending). */
export function Passed(p: { ask: StoreAsk; b: YardBooks; n: number; jobs: Job[] }): JSX.Element {
  const [sending, setSending] = useState(false);
  const from = whoIs(p.b, p.ask.by), fn = from ? firstWord(from.name) : 'A colleague';
  const moves = readyJobs(p.jobs).filter((j) => j.kind !== 'pack' && j.kind !== 'report' && j.kind !== 'close').slice(0, 3);
  const asks = Number(p.ask.payload.waiting || 0);
  const got = async () => {
    if (sending) return;
    setSending(true);
    try { await act('gotYard', p.ask.id); } catch (_e) { /* the bar says it; the card stays */ } finally { setSending(false); }
  };
  return (
    <>
      <SectionHead title="Passed to you" meta={clock(p.ask.createdAt)} />
      <JobCard tag={{ tone: 'mint', icon: 'hand-over', text: `Passed to you · ${howLong(p.ask.createdAt, p.n)}` }}
        from={from ? { face: personFace(from), text: `From ${fn} · ${clock(p.ask.createdAt)}` } : undefined}
        ring={{ pair: [from ? personFace(from) : { initials: '?', tint: 't4' }, personFace(p.b.me)] }}
        name="The yard" big={counted(jobsLeft(p.jobs), 'job')} bigTone="mint" bigSub={counted(asks, 'ask')}
        legend={<span>{`${fn} ends his shift`}</span>}
        tiles={moves.map((j) => {
          const r = rowOf(j, p.b, p.n), o = j.orderId != null ? p.b.orders.find((x) => x.id === j.orderId) : null;
          if (j.kind === 'carry-on' && o) { const ls = o.lines.filter((l) => !l.dropped), it = ls[0] && p.b.items.find((i) => i.key === ls[0].key); return { aisle: (it && it.category) || 'other', text: orderNo(o.id), sub: `${ls.filter((l) => l.pickStatus === 'done').length} of ${ls.length}` }; }
          if (j.kind === 'return') return { icon: 'return', text: j.at ? clock(j.at) : '', sub: 'return' };
          if (j.kind === 'count') return { aisle: j.aisle || 'other', text: r.title.replace('Count · ', ''), sub: 'count' };
          return { icon: r.icon, text: r.title, sub: r.act.toLowerCase() };
        })}
        foot={{ label: `${fn} sees`, value: 'Waiting on you' }}
        act={{ label: 'I’ve got it', icon: 'check', aria: `I’ve got it: take the yard from ${fn}`, on: () => { void got(); }, state: sending ? 'sending' : 'idle' }} />
    </>
  );
}

/** TD32: "The yard is yours · 10:43 · Musa sees: Okello has it". */
export function YardIsYours(p: { ask: StoreAsk; b: YardBooks }): JSX.Element {
  const from = whoIs(p.b, p.ask.by);
  return (
    <div role="status" class="st-yours">
      <span aria-hidden="true" class="st-yours-ic"><Icon name="check" size={16} stroke={3} /></span>
      <span class="st-yours-t"><b>The yard is yours · <span class="mono">{clock(p.ask.decidedAt ?? p.ask.createdAt)}</span></b>
        <span>{`${from ? firstWord(from.name) : 'They'} sees: ${firstWord(p.b.me.name)} has it`}</span></span>
      {from && <span aria-hidden="true" class="ow-av st-yours-f" style={avatarStyle({ ...personFace(from), size: 28 })}>{from.initials}</span>}
    </div>
  );
}
