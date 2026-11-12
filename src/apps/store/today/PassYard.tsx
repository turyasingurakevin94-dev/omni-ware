/*
 * today/pass-yard (TD13 pick, TD14 held: "Passing to Okello…" with Take it back, TD18 sending, then Sent on the
 * server's yes, TD24 nobody else, TD26 failed). Who takes the
 * yard (Okello prefilled: the first colleague on with a Store login), what moves to them, who is told,
 * then the red slide. The write is held 10 s with "Take it back" (screens Q17, data W22'): it goes when
 * the 10 s run out or this screen is left; "Take it back" keeps it on the phone and returns to the pick.
 */
import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { counted, firstWord, orderNo } from '../../../core/names.ts';
import { personFace } from '../../../core/store/faces.ts';
import { doneToday } from '../../../core/store/jobs.ts';
import { mates, passPayload, passPlan } from '../../../core/store/shift.ts';
import type { YardPerson } from '../../../core/store/types.ts';
import { clock } from '../../../core/time.ts';
import { avatarStyle } from '../../../ui/Avatar.tsx';
import { Button } from '../../../ui/Button.tsx';
import { Icon, type IconName } from '../../../ui/icons.tsx';
import { EndOfFlow, Moment } from '../../../ui/Moment.tsx';
import { Slide } from '../../../ui/Slide.tsx';
import { toast } from '../../../ui/toast.tsx';
import { cx } from '../../../ui/util.tsx';
import { nav } from '../shell/nav.ts';
import { act, books, me, notDone, now, online } from '../shell/store.ts';
import { rowOf } from './cards.tsx';
import { AfterSlide, YardSheet } from './frame.tsx';

const HOLD_S = 10;

function Face(p: { who: YardPerson; size: number; dot?: 'on' | 'off' }): JSX.Element {
  const f = personFace(p.who);
  return (
    <span class="st-pick-f">
      <span aria-hidden="true" class="ow-av" style={avatarStyle({ ...f, size: p.size, font: 13, style: { letterSpacing: '-.02em' } })}>{f.initials}</span>
      {p.dot && <span aria-hidden="true" class={cx('st-pick-dot', p.dot === 'off' && 'off')} />}
    </span>
  );
}

export function PassYard(p: { to: string | null }): JSX.Element {
  const b = books.value, n = now.value;
  const [pick, setPick] = useState<string | null>(p.to);
  // held: the 10 s with Take it back (nothing sent yet) · sending: TD18's Sending… dock · sent: only on the server's yes (spec §4.8).
  const [phase, setPhase] = useState<'pick' | 'held' | 'sending' | 'sent' | 'kept' | 'failed'>('pick');
  const [left, setLeft] = useState(HOLD_S);
  const [sentAt, setSentAt] = useState(n);
  const timer = useRef<number | null>(null), go = useRef<(() => void) | null>(null);
  // Leaving the screen while it is held sends it at once (store.html:2074 flushHeld).
  useEffect(() => () => { if (timer.current != null) { clearInterval(timer.current); if (go.current) go.current(); } }, []);
  if (!b) return <main class="st-ph" />;
  const list = mates(b, me.value), can = list.filter((m) => m.can), to = list.find((m) => m.p.id === (pick ?? (can[0] && can[0].p.id)) && m.can)?.p || null;
  const plan = passPlan(b, me.value, n), tn = to ? firstWord(to.name) : '', mn = firstWord(b.me.name);

  const send = () => {
    if (!to) return;
    const payload = passPayload(plan, to);
    go.current = null; timer.current = null;
    setPhase('sending');
    act('passYard', payload).then((r) => { setSentAt(now.value); setPhase(r.kept ? 'kept' : 'sent'); }).catch(() => setPhase('failed'));
  };
  const hold = () => {
    if (!to) return;
    notDone.value = null;
    setSentAt(n); setLeft(HOLD_S); setPhase('held');
    go.current = send;
    let s = HOLD_S;
    timer.current = window.setInterval(() => {
      s -= 1; setLeft(s);
      if (s <= 0 && timer.current != null) { clearInterval(timer.current); timer.current = null; send(); }
    }, 1000);
  };
  const takeBack = () => {
    if (timer.current != null) clearInterval(timer.current);
    timer.current = null; go.current = null;
    setPhase('pick');
    toast.show('Kept · the yard is still yours', { kind: 'ok' });
  };

  if ((phase === 'held' || phase === 'sent' || phase === 'kept') && to) {
    const isHeld = phase === 'held', sent = phase === 'sent';
    return (
      <div class="st-moment-wrap">
        <Moment title={isHeld ? `Passing to ${tn}…` : sent ? `Sent to ${tn}` : 'Not sent yet'} mark={sent ? undefined : 'clock'} onClose={() => nav.home()}
          who={{ face: personFace(to), name: to.name, ref: clock(sentAt) }}
          next={[
            isHeld ? { icon: 'clock', title: `Sends in ${left} s`, sub: 'take it back until then' }
              : sent ? { icon: 'check', title: 'Sent', sub: `${clock(sentAt)} · his phone buzzed` } : { icon: 'clock', title: 'Kept on this phone', sub: 'it goes when there is signal' },
            { icon: 'hand-over', title: `${tn} taps “I’ve got it”`, sub: 'on his Today now' },
            { icon: 'shelf', title: 'The yard is his', sub: `${counted(plan.jobs, 'job')} and ${counted(plan.asks, 'ask')} move` },
          ]}
          nowAt={sent ? 1 : 0}
          after={isHeld ? <button type="button" class="ow-end-quiet st-takeback" onClick={takeBack}><Icon name="undo" size={16} stroke={2.2} />Take it back <span class="mono">{`${left} s`}</span></button> : null}
          end={<>
            <div class="st-after dark"><span aria-hidden="true" class="ow-av" style={avatarStyle({ ...personFace(b.me), size: 24 })}>{b.me.initials}</span>
              <span>When he taps · <b>you see</b>{` “${tn} has it”`}</span></div>
            <EndOfFlow on={() => nav.home()} ms={0} pct={Math.round(((HOLD_S - left) / HOLD_S) * 33)} />
          </>} />
      </div>
    );
  }

  const nobody = can.length === 0;
  const moveTile = (icon: IconName | null, tone: string, title: string, sub: string, face?: YardPerson) => (
    <span class="st-move" key={title}>
      {face ? <span aria-hidden="true" class="ow-itile" style={{ width: '34px', height: '34px', borderRadius: '10px' }}><span class="ow-av" style={avatarStyle({ ...personFace(face), size: 30, font: 12 })}>{face.initials}</span></span>
        : <span aria-hidden="true" class="ow-itile" style={{ width: '34px', height: '34px', borderRadius: '10px', ...TONE[tone] }}>{icon && <Icon name={icon} size={18} stroke={2} />}</span>}
      <span><span>{title}</span><span>{sub}</span></span>
    </span>
  );
  const ruth = b.people.find((x) => x.role === 'manager');
  return (
    <YardSheet backLabel="Back to You" onBack={() => nav.back()} eyebrow={<>Pass the yard · <span class="mono">{clock(n)}</span></>} title="Who takes the yard?"
      dock={nobody ? <Slide label="Pick who takes the yard" onCommit={() => undefined} lock={{ icon: 'lock', label: 'Pick who takes the yard', quiet: true }} />
        : <Slide label={`Slide to pass to ${tn}`} onCommit={hold} state={phase === 'sending' ? 'sending' : online.value ? 'ready' : 'offline'} offlineLabel="Back online to pass"
          onHint={() => toast.show('Slide the red button across', { kind: 'warn' })} />}>
      <div role="radiogroup" aria-label="Who takes the yard" class="st-pick">
        <div class="st-pick-r">
          <Face who={b.me} size={40} />
          <span class="st-pick-t"><span>{b.me.name}</span><span>{`You · ${doneToday(b, n).length} done · ${plan.jobs} left`}</span></span>
          <span class="st-pick-has">has it</span>
        </div>
        {list.map((m) => {
          const on = !!to && m.p.id === to.id, sub = m.why === 'on' ? 'on now · in the yard' : m.why === 'away' ? (nobody ? 'off today · not signed in' : 'off today · away') : `${m.p.role === 'driver' ? 'driver' : 'staff'} · no yard login`;
          const lock = !m.can && (nobody || m.why === 'no-login');
          const inner = (
            <>
              <Face who={m.p} size={40} dot={m.p.away ? 'off' : 'on'} />
              <span class="st-pick-t"><span>{m.p.name}</span><span>{sub}</span></span>
              {lock ? <span aria-hidden="true" class="st-lock"><Icon name="lock" size={18} stroke={2} /></span>
                : <span aria-hidden="true" class={cx('st-radio', on && 'on', on && phase === 'sending' && 'busy')}>{on && <Icon name="check" size={13} stroke={3.2} />}</span>}
            </>
          );
          return lock ? <div key={m.p.id} class="st-pick-r">{inner}</div>
            : <button key={m.p.id} type="button" role="radio" aria-checked={on} class="st-pick-r" disabled={phase === 'sending'}
              onClick={() => { if (m.can) setPick(m.p.id); else toast.show(`${firstWord(m.p.name)} is off today`, { kind: 'warn' }); }}>{inner}</button>;
        })}
      </div>
      {nobody ? <>
        <div aria-hidden="true" class="st-ghostrows"><div><i /><b /><u /></div><div><i /><b /><u /></div></div>
        <div class="st-nobody"><b>Nobody else is on with the app</b><span>a colleague with a yard login shows here</span></div>
        <Button kind="navy" icon="send" stroke={2} onClick={() => { if (ruth && ruth.phone) location.href = 'tel:' + ruth.phone.replace(/\s/g, ''); else toast.show(`Ask ${ruth ? firstWord(ruth.name) : 'the manager'} for a yard login`, { kind: 'ok' }); }}>{`Ask ${ruth ? firstWord(ruth.name) : 'the manager'}`}</Button>
      </> : <>
        <span class="st-moves-h"><span>{`What moves to ${tn}`}</span><span class="mono">{`${counted(plan.jobs, 'job')} · ${counted(plan.asks, 'ask')}`}</span></span>
        <div class="st-moves">
          {plan.moves.slice(0, 3).map((j) => {
            const r = rowOf(j, b, n), o = j.orderId != null ? b.orders.find((x) => x.id === j.orderId) : null;
            if (j.kind === 'carry-on' && o) { const ls = o.lines.filter((l) => !l.dropped); return moveTile('orders', 'info', `${orderNo(o.id)} · ${o.client.name.split(/\s+/)[0]}`, `${ls.filter((l) => l.pickStatus === 'done').length} of ${ls.length} packed`); }
            if (j.kind === 'return') return moveTile('return', 'info', 'Coming back', `${orderNo(j.orderId as number)}${j.at ? ` · ${clock(j.at)}` : ''}`);
            if (j.kind === 'count') return moveTile('count', 'warn', `Count aisle ${r.title.slice(-1)}`, r.sub.split(' · ')[1] || '');
            return moveTile(r.icon, r.tone, r.title, r.sub);
          })}
          {ruth && plan.asks > 0 && moveTile(null, '', `With ${firstWord(ruth.name)}`, `${counted(plan.asks, 'ask')} · she knows`, ruth)}
        </div>
        {phase === 'failed' && notDone.value && notDone.value.tone === 'failed' ? (
          <div role="alert" class="st-fail">
            <span aria-hidden="true" class="st-fail-ic"><Icon name="warning" size={18} stroke={2.2} /></span>
            <span class="st-fail-t"><b>That did not save</b><span>{`tell Kevin · ${notDone.value.code}`}</span></span>
            <button type="button" class="st-fail-b" onClick={() => { notDone.value = null; send(); }}><Icon name="retry" size={15} stroke={2.4} style={{ color: '#6FDCB0' }} />Try again</button>
          </div>
        ) : to && <AfterSlide face={<span aria-hidden="true" class="ow-av" style={avatarStyle({ ...personFace(to), size: 28 })}>{to.initials}</span>} who={tn} says={`${mn} passed you the yard`} />}
      </>}
    </YardSheet>
  );
}

const TONE: Record<string, Record<string, string>> = {
  info: { background: '#E3EEFB', color: '#1A5A8A' }, warn: { background: '#FDEEE1', color: '#95530C' }, bad: { background: '#FBE5E2', color: '#8E2A22' },
  good: { background: '#E4F4EA', color: '#0F6B43' }, neutral: { background: '#F1EEE8', color: '#5F6980' },
};

