/*
 * today/close-yard (TD16 4/4, TD28 3 of 4: set the return aside first, TD27 no signal, TD19 sending,
 * TD17 closed). From 17:30, Today's last card. Four checks (core/store/shift.ts closeChecks); the
 * slide is off until every red one is sorted; Ruth gets a line in her log, nothing to answer (IM-18).
 * "It's set aside" is kept on this phone (the books have no field for it) and goes with the close
 * (W23 payload.shelved).
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { counted, firstWord, orderNo } from '../../../core/names.ts';
import { personFace, shortName, whoIs } from '../../../core/store/faces.ts';
import { baysTonight, canClose, checksDone, closeChecks, closeFigures, closePayload, YARD_OPENS, type CloseCheck } from '../../../core/store/shift.ts';
import type { YardBooks } from '../../../core/store/types.ts';
import { NOT_PAID } from '../../../core/store/yard.ts';
import { clock, dayLabel } from '../../../core/time.ts';
import { avatarStyle, FaceStack, type Face } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { EndOfFlow, Moment } from '../../../ui/Moment.tsx';
import { Notice } from '../../../ui/Notice.tsx';
import { Slide } from '../../../ui/Slide.tsx';
import { toast } from '../../../ui/toast.tsx';
import { cx } from '../../../ui/util.tsx';
import { nav } from '../shell/nav.ts';
import { act, books, me, now, online } from '../shell/store.ts';
import { keepAside, readAside } from './aside.ts';
import { AfterSlide, YardSheet } from './frame.tsx';
import './close.css';


function Check(p: { c: CloseCheck; b: YardBooks; n: number; onAside: (id: string) => void }): JSX.Element {
  const { c, b } = p, ruth = b.people.find((x) => x.role === 'manager');
  const mark = c.tone === 'ok' ? <span aria-hidden="true" class="st-ck ok"><Icon name="check" size={15} stroke={3} /></span>
    : c.tone === 'todo' ? <span aria-hidden="true" class="st-ck todo"><Icon name="return" size={14} stroke={2.2} /></span>
      : <span aria-hidden="true" class={cx('st-ck', c.tone)}><Icon name="arrow-right" size={14} stroke={2.4} /></span>;
  let title = '', sub = '', tail: JSX.Element | null = null;
  if (c.kind === 'half') { title = c.tone === 'ok' ? 'Nothing half done' : `Finish ${c.orders.map((o) => orderNo(o.id)).join(', ') || 'the check-in'} first`; sub = 'every pack and check-in finished'; }
  if (c.kind === 'return' && c.ret) {
    const o = c.orders[0], q = c.ret.lines.map((l) => `${l.qty} ${l.unit} ${l.condition}`).join(' · ');
    if (c.tone === 'ok') { title = `Return ${o ? orderNo(o.id) : ''} set aside`; sub = `${q} · ${ruth ? firstWord(ruth.name) : 'Ruth'} took it back`; }
    else { title = `Set aside ${o ? orderNo(o.id) : ''}`; sub = `${q} · gate`; tail = <button type="button" class="st-aside" onClick={() => p.onAside(c.ret!.id)}>It's set aside</button>; }
  }
  if (c.kind === 'bay') {
    const o = c.orders[0], s = whoIs(b, o.takenBy);
    title = `${orderNo(o.id)} stays on bay ${o.bay ?? '—'}`; sub = `${o.moneyHold ? NOT_PAID : 'Packed'} · stays tonight`;
    tail = <FaceStack faces={[s, ruth].filter(Boolean).map((x) => personFace(x) as Face)} ground="#FFFFFF" />;
  }
  if (c.kind === 'ruth') {
    title = `${c.what} with ${ruth ? firstWord(ruth.name) : 'Ruth'}`;
    sub = `sent ${c.at ? clock(c.at) : ''} · ${ruth ? firstWord(ruth.name) : 'Ruth'} looks tomorrow`;
    tail = ruth ? <span aria-hidden="true" class="ow-av st-ck-f" style={avatarStyle({ ...personFace(ruth), size: 28 })}>{ruth.initials}</span> : null;
  }
  return <div class="st-check">{mark}<span class="st-check-t"><span>{title}</span><span class="mono">{sub}</span></span>{tail}</div>;
}

export function CloseYard(): JSX.Element {
  const b = books.value, n = now.value;
  const [aside, setAside] = useState<string[]>(() => readAside(n));
  const [done, setDone] = useState<number | null>(null);
  if (!b) return <main class="st-ph" />;
  const ruth = b.people.find((x) => x.role === 'manager'), rn = ruth ? firstWord(ruth.name) : 'Ruth';
  const checks = closeChecks(b, me.value, n, aside), ok = canClose(checks), k = checksDone(checks), f = closeFigures(b, me.value, n);
  const bays = baysTonight(b, me.value, n), stays = bays.find((x) => x.order && x.bay != null);

  if (done != null) {
    return (
      <div class="st-moment-wrap">
        <Moment title="The yard is closed" mark="moon" nowAt={1} onClose={() => nav.home()} who={{ face: ruth ? personFace(ruth) : { initials: 'RN', tint: 't2' }, name: `In ${rn}'s log`, ref: clock(done) }}
          next={[
            { icon: 'check', title: `${rn}'s log · The yard is closed`, sub: `nothing for her to answer` },
            { icon: 'clock', title: `Tomorrow · ${YARD_OPENS}`, sub: stays && stays.order ? `${orderNo(stays.order.id)} waits on bay ${stays.bay}` : 'every bay free' },
            { icon: 'bell', title: 'Alerts stay on', sub: 'a buzz if a trip comes back' },
          ]}
          end={<EndOfFlow on={() => nav.home()} ms={0} pct={33} />} />
      </div>
    );
  }
  const aside1 = (id: string) => { const next = [...aside, id]; setAside(next); keepAside(n, next); };
  const close = async () => {
    try { await act('closeYard', closePayload(b, me.value, n, aside)); setDone(n); } catch (_e) { /* the bar says it; the sheet stays */ }
  };
  const todo = checks.find((c) => c.tone === 'todo');
  const C = 188.5, fill = checks.length ? k / checks.length : 0;
  const head = (
    <div class="st-close-h">
      <span aria-hidden="true" class="st-close-grab" />
      <div class="st-close-r">
        <span class="st-close-t"><h1>Close the yard <span class={cx('mono', ok ? 'ok' : 'todo')}>{`${k}/${checks.length}`}</span></h1>
          <span class="mono">{`${dayLabel(n)} · ${clock(n)} · goods only`}</span></span>
        <button type="button" class="st-close-x" aria-label="Close" onClick={() => nav.back()}><Icon name="close" size={18} stroke={2.2} /></button>
      </div>
      <div class="st-close-p">
        <span aria-hidden="true" class="st-close-ring">
          <svg width="68" height="68" viewBox="8 8 68 68"><circle cx="42" cy="42" r="30" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="5" />
            <circle cx="42" cy="42" r="30" fill="none" stroke={ok ? '#6FDCB0' : '#F5B26B'} stroke-width="5" stroke-linecap="round" stroke-dasharray={`${(C * fill).toFixed(1)} ${C}`} transform="rotate(-90 42 42)" /></svg>
          <span><Icon name="moon" size={22} stroke={2} /></span>
        </span>
        <span class="st-close-figs">
          <span><span><Icon name="truck" size={13} stroke={2} />Out</span><b class="mono">{f.out}</b></span>
          <span><span><Icon name="tray-in" size={13} stroke={2} />In</span><b class="mono">{f.in}</b></span>
          <span><span><Icon name="return" size={13} stroke={2} />Back</span><b class="mono">{f.back}</b></span>
        </span>
      </div>
    </div>
  );
  return (
    <YardSheet top={44} backLabel="Back to Today" onBack={() => nav.back()} head={head} class="st-close"
      dock={!online.value ? <Slide label="Slide to close the yard" onCommit={() => undefined} lock={{ icon: 'offline', label: 'Back online to close', quiet: true }} />
        : !ok ? <Slide label="Slide to close the yard" onCommit={() => undefined} lock={{ icon: 'lock', label: todo && todo.kind === 'return' ? 'Set the return aside first' : 'Finish what is half done first', quiet: true }} />
          : <Slide label="Slide to close the yard" onCommit={close} onHint={() => toast.show('Slide the red button across', { kind: 'warn' })} />}>
      {!online.value && <Notice kind="offline" action={{ label: 'Try again', on: () => undefined }}>No signal · close it when back online</Notice>}
      <div class="st-checks">{checks.map((c, i) => <Check key={i} c={c} b={b} n={n} onAside={aside1} />)}</div>
      <div class="st-bays">
        {bays.map((x) => (
          <span key={x.bay ?? 'gate'} class={cx('st-bay', x.order && 'stays')}>
            {x.order ? <><b class="mono">{orderNo(x.order.id)}</b><span>{x.bay != null ? `Bay ${x.bay} · stays` : 'Gate'}</span></>
              : <><b>free</b><span>{x.bay != null ? `Bay ${x.bay}` : 'Gate'}</span></>}
          </span>
        ))}
      </div>
      {ruth && <AfterSlide face={<span aria-hidden="true" class="ow-av" style={avatarStyle({ ...personFace(ruth), size: 28 })}>{ruth.initials}</span>} who={rn} says="The yard is closed" tail="in her log" />}
      {stays && stays.order && <span class="st-sr">{`${shortName(stays.order)} stays the night · ${counted(1, 'order')}`}</span>}
    </YardSheet>
  );
}
