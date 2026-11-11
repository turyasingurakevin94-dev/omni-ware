/*
 * today/alerts (TD10, TD29 empty): today's pushes on a line from the first hour to now, For you and In
 * the yard today, each with its sender's face and where it stands now; With Ruth on top; earlier days
 * read. Opening it reads them (the bell goes to 0, WORD-10).
 */
import type { JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import { firstWord } from '../../../core/names.ts';
import { personFace, whoIs } from '../../../core/store/faces.ts';
import { withRuth } from '../../../core/store/ruth.ts';
import type { YardBooks } from '../../../core/store/types.ts';
import { at as atTime, clock, dayLabel, dayOf } from '../../../core/time.ts';
import { avatarStyle } from '../../../ui/Avatar.tsx';
import { Button } from '../../../ui/Button.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { PageHead } from '../../../ui/PageHead.tsx';
import { Tap, cx } from '../../../ui/util.tsx';
import { nav } from '../shell/nav.ts';
import { books, me, now } from '../shell/store.ts';
import { alertDays, markSeen, seenAt, type AlertSaid } from './alerts-model.ts';
import './alerts.css';

function Row(p: { s: AlertSaid; b: YardBooks; isNew: boolean }): JSX.Element {
  const from = whoIs(p.b, p.s.a.fromId), f = from ? personFace(from) : { initials: '?', tint: 't4' as const };
  return (
    <Tap on={() => nav.push(p.s.route.id, p.s.route.params)} class="st-al">
      <span class="st-al-f"><span aria-hidden="true" class="ow-av" style={avatarStyle({ ...f, size: 40, font: 13, style: { letterSpacing: '-.02em' } })}>{f.initials}</span>{p.isNew && <span aria-hidden="true" class="st-al-new" />}</span>
      <span class="st-al-t"><span>{p.s.title}</span><span class="mono">{p.s.sub}</span></span>
      <span class={cx('st-al-now', p.s.now.tone)}>{p.s.now.icon && <Icon name={p.s.now.icon} size={12} stroke={2.4} />}{p.s.now.word}</span>
    </Tap>
  );
}

/** With Ruth, from Alerts: one row, her face, yours first · with her, a bar per ask. */
export function RuthRow(p: { b: YardBooks; n: number }): JSX.Element {
  const ruth = p.b.people.find((x) => x.role === 'manager'), r = withRuth(p.b, me.value, p.n);
  const yours = r.filter((x) => x.state === 'yours').length, wr = r.filter((x) => x.state === 'with-ruth').length, rn = ruth ? firstWord(ruth.name) : 'Ruth';
  return (
    <Tap on={() => nav.push('today/with-ruth')} class="st-ruthrow" label={`With ${rn}: ${yours} yours first, ${wr} with her`}>
      <span class="st-al-f">{ruth && <span aria-hidden="true" class="ow-av" style={avatarStyle({ ...personFace(ruth), size: 40, font: 13, style: { letterSpacing: '-.02em' } })}>{ruth.initials}</span>}<span aria-hidden="true" class="st-on" /></span>
      <span class="st-al-t"><span class="big">{`With ${rn}`}</span>
        <span>{yours + wr === 0 ? 'nothing waiting on her' : <>{yours > 0 && <span class="w">{`${yours} yours first`}</span>}{yours > 0 && wr > 0 && ' · '}{wr > 0 && `${wr} with her`}</>}</span></span>
      {yours + wr > 0 && <span aria-hidden="true" class="st-ruthbars">{[...Array(yours).fill('y'), ...Array(wr).fill('w')].slice(0, 8).map((x, i) => <span key={i} class={x} />)}</span>}
      <span aria-hidden="true" class="ow-chev"><Icon name="chevron-right" size={16} stroke={2.2} /></span>
    </Tap>
  );
}

export function Alerts(): JSX.Element {
  const b = books.value, n = now.value;
  const seen = b ? seenAt(b) : 0;
  useEffect(() => { if (b) markSeen(b, n); }, []);
  if (!b) return <main class="st-ph" />;
  const days = alertDays(b, n), today = days[0], todays = [...today.forYou, ...today.yard];
  const fresh = today.forYou.filter((x) => x.a.at > seen).length;
  const t0 = atTime(dayOf(n), `${Math.min(9, ...todays.map((x) => Number(clock(x.a.at).split(':')[0])))}:00`), span = Math.max(1, n - t0);
  const pos = (ms: number) => `${(Math.max(0, Math.min(1, (ms - t0) / span)) * 100).toFixed(1)}%`;
  const hours: number[] = [];
  for (let h = t0 + 3600e3; h < n - 900e3; h += 3600e3) hours.push(h);
  return (
    <>
      <PageHead title="Alerts" count={fresh ? `· ${fresh} new` : undefined} onBack={() => nav.back()}>
        <div class="st-al-line" role="img" aria-label={`Today's alerts on a line from ${clock(t0)} to now`}>
          <span aria-hidden="true" class="st-al-track" />
          {todays.slice().reverse().map((s) => { const p = whoIs(b, s.a.fromId), f = p ? personFace(p) : { initials: '?', tint: 't4' as const };
            return <span key={s.a.id} aria-hidden="true" class={cx('ow-av st-al-dot', s.a.forYou && 'you')} style={{ ...avatarStyle({ ...f, size: 26, onNavy: true }), left: `calc(${pos(s.a.at)} - 13px)` }}>{f.initials}</span>; })}
          <span aria-hidden="true" class="st-al-nowdot" />
          <span class="mono st-al-tick" style={{ left: 0 }}>{clock(t0)}</span>
          {hours.map((h) => <span key={h} class="mono st-al-tick mid" style={{ left: pos(h) }}>{clock(h)}</span>)}
          <span class="mono st-al-tick now">now</span>
        </div>
        <div class="st-al-legend"><span><span aria-hidden="true" class="you" /><b class="mono">{today.forYou.length}</b> for you</span><span><span aria-hidden="true" /><b class="mono">{today.yard.length}</b> in the yard</span></div>
      </PageHead>
      <main class="st-alerts">
        <RuthRow b={b} n={n} />
        {todays.length === 0 ? <>
          <div aria-hidden="true" class="st-ghostrows wide"><div><i /><b /><u /></div><div><i /><b /><u /></div></div>
          <div class="st-empty">
            <span aria-hidden="true" class="st-empty-ic"><Icon name="bell" size={30} stroke={2} /></span>
            <b>Nothing new today</b><span>Pushes from Grace, Denis and Ruth land here</span>
            <span class="st-empty-on"><Icon name="check" size={13} stroke={2.6} />Alerts on · this phone buzzes</span>
          </div>
          <Button kind="navy" onClick={() => nav.home()}>Back to Today</Button>
        </> : <>
          {today.forYou.length > 0 && <>
            <div class="st-al-h"><span aria-hidden="true" class="d bad" /><h2>For you</h2><span class="mono">{fresh ? `${fresh} new` : String(today.forYou.length)}</span></div>
            <div class="st-al-card">{today.forYou.map((s) => <Row key={s.a.id} s={s} b={b} isNew={s.a.at > seen} />)}</div>
          </>}
          {today.yard.length > 0 && <>
            <div class="st-al-h"><span aria-hidden="true" class="d" /><h2>In the yard today</h2><span class="mono">{today.yard.length}</span></div>
            <div class="st-al-card">{today.yard.map((s) => <Row key={s.a.id} s={s} b={b} isNew={false} />)}</div>
          </>}
        </>}
        {days.slice(1).map((d) => (todays.length === 0
          ? <div key={d.day} class="st-al-old"><span>{`${dayLabel(d.day)} · `}<span class="mono">{d.forYou.length + d.yard.length}</span>{' · read'}</span><Icon name="chevron-down" size={18} stroke={2} /></div>
          : <div key={d.day}>
            <div class="st-al-h"><span aria-hidden="true" class="d read" /><h2>{dayLabel(d.day)}</h2><span class="mono">{`${d.forYou.length + d.yard.length} · read`}</span></div>
            <div class="st-al-card">{[...d.forYou, ...d.yard].map((s) => <Row key={s.a.id} s={s} b={b} isNew={false} />)}</div>
          </div>))}
      </main>
    </>
  );
}
