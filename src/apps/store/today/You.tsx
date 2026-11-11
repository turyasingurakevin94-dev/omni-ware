/*
 * today/you (TD12): your shift so far, who is in the yard now, Pass the yard (End my shift), Alerts
 * and Big text, the shop, Sign out. Opened from the avatar on Today.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { counted, firstWord, orderNo } from '../../../core/names.ts';
import { personFace } from '../../../core/store/faces.ts';
import { doneToday } from '../../../core/store/jobs.ts';
import { passPlan } from '../../../core/store/shift.ts';
import { onATruck } from '../../../core/store/yard.ts';
import { clock, howLong } from '../../../core/time.ts';
import { avatarStyle } from '../../../ui/Avatar.tsx';
import { Icon, type IconName } from '../../../ui/icons.tsx';
import { Tap, cx } from '../../../ui/util.tsx';
import { nav } from '../shell/nav.ts';
import { bigText, setBig } from '../shell/prefs.ts';
import { books, me, now, registerPush, signOut } from '../shell/store.ts';
import { YardSheet } from './frame.tsx';
import './you.css';

const ROLE: Record<string, string> = { store: 'Store', manager: 'Manager', owner: 'Owner', admin: 'Admin', driver: 'Driver' };

function Toggle(p: { icon: IconName; label: string; title: string; sub: string; on: boolean; set: (v: boolean) => void }): JSX.Element {
  return (
    <button type="button" class="st-tog" role="switch" aria-checked={p.on} aria-label={p.label} onClick={() => p.set(!p.on)}>
      <span class="st-tog-top"><span aria-hidden="true" class={cx('st-tog-ic', p.on && 'on')}><Icon name={p.icon} size={20} stroke={2} /></span>
        <span aria-hidden="true" class={cx('st-sw', p.on && 'on')}><span /></span></span>
      <span class="st-tog-t"><b>{p.title}</b><span>{p.sub}</span></span>
    </button>
  );
}

export function You(): JSX.Element {
  const b = books.value, n = now.value;
  const [alerts, setAlerts] = useState(true);
  if (!b) return <main class="st-ph" />;
  const d = doneToday(b, n), mine = (x: { orders: { assignedWorkerId: string | null }[] }) => x.orders.some((o) => o.assignedWorkerId === me.value);
  const checked = d.filter((x) => x.kind === 'checked-in'), packed = d.filter((x) => x.kind === 'packed' && mine(x));
  const loads = d.filter((x) => x.kind === 'loaded'), gate = d.filter((x) => x.kind === 'handed-over');
  const out = loads.reduce((s, x) => s + x.orders.length, 0) + gate.length;
  const plan = passPlan(b, me.value, n), since = b.onSince;
  const yard = b.people.filter((p) => p.id !== b.me.id && (p.role === 'store' || p.role === 'driver') && !p.away);
  const where = (id: string) => (b.orders.some((o) => onATruck(o) && o.carrier && o.carrier.staffId === id) ? 'on the road' : 'in the yard');
  const fill = since ? Math.min(1, (n - since) / (10 * 3600e3)) : 0, C = 2 * Math.PI * 37;
  const runner = checked[0] && checked[0].trips ? b.people.find((p) => p.id === checked[0].trips![0].runnerId) : null;
  const head = (
    <div class="st-you-h">
      <span aria-hidden="true" class="st-close-grab" />
      <div class="st-you-r">
        <span aria-hidden="true" class="st-you-ring">
          <svg width="84" height="84" viewBox="0 0 84 84"><circle cx="42" cy="42" r="37" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="5" />
            <circle cx="42" cy="42" r="37" fill="none" stroke="#6FDCB0" stroke-width="5" stroke-linecap="round" stroke-dasharray={`${(C * fill).toFixed(1)} ${C.toFixed(1)}`} transform="rotate(-90 42 42)" /></svg>
          <span>{b.me.initials}</span>
        </span>
        <span class="st-you-t"><b>{b.me.name}</b><span>{`${ROLE[b.me.role] || 'Store'} · ${b.shopName}`}</span>
          {since != null && <span class="st-you-pill"><Icon name="clock" size={13} stroke={2.4} />On since <span class="mono">{clock(since)}</span> · <span class="mono">{howLong(since, n)}</span></span>}</span>
        <button type="button" class="st-close-x" aria-label="Close" onClick={() => nav.back()}><Icon name="close" size={18} stroke={2.2} /></button>
      </div>
      <div class="st-you-figs">
        <Tap on={() => nav.back()} class="st-you-fig"><span><Icon name="tray-in" size={13} stroke={2} />Checked in</span><b class="mono">{checked.length}</b>
          <span>{checked[0] ? `${runner ? firstWord(runner.name) : 'trip'} · ${clock(checked[0].at)}` : '—'}</span></Tap>
        <Tap on={() => nav.back()} class="st-you-fig"><span><Icon name="orders" size={13} stroke={2} />Packed</span><b class="mono">{packed.length}</b>
          <span>{packed.map((x) => orderNo(x.orders[0].id)).slice(0, 2).join(' ') || '—'}</span></Tap>
        <span class="st-you-fig"><span><Icon name="truck" size={13} stroke={2} />Out</span><b class="mono">{out}</b>
          <span>{[...loads.map((x) => `${x.orders.length} ${x.name}`), gate.length ? `${gate.length} gate` : ''].filter(Boolean).join(' · ') || '—'}</span></span>
      </div>
    </div>
  );
  return (
    <YardSheet top={44} backLabel="Back to Today" onBack={() => nav.back()} head={head} class="st-you">
      <div class="st-crew">
        <div class="st-crew-h"><b>In the yard now</b><span class="mono">{`${yard.length} on`}</span></div>
        <div class="st-crew-g">
          {yard.map((p) => (
            <span key={p.id} class="st-crew-p">
              <span class="st-pick-f"><span aria-hidden="true" class="ow-av" style={avatarStyle({ ...personFace(p), size: 44, font: 15, style: { letterSpacing: 'normal' } })}>{p.initials}</span><span aria-hidden="true" class="st-pick-dot" /></span>
              <b>{firstWord(p.name)}</b><span class={where(p.id) === 'on the road' ? 'road' : ''}>{where(p.id)}</span>
            </span>
          ))}
        </div>
      </div>
      <Tap on={() => nav.push('today/pass-yard')} class="st-pass" label={`Pass the yard: end my shift, ${counted(plan.jobs, 'job')} move`}>
        <span aria-hidden="true" class="st-pass-ic"><Icon name="hand-over" size={22} stroke={2} /></span>
        <span class="st-pass-t"><b>Pass the yard</b><span>End my shift · <span class="mono">{plan.jobs}</span> jobs move</span></span>
        <Icon name="arrow-right" size={20} stroke={2.2} />
      </Tap>
      <div class="st-togs">
        <Toggle icon="bell" label="Alerts on" title={alerts ? 'Alerts on' : 'Alerts off'} sub="a buzz for each new job" on={alerts} set={(v) => { setAlerts(v); if (v) void registerPush(); }} />
        <Toggle icon="text-size" label="Big text" title="Big text" sub="every size a step up" on={bigText.value} set={setBig} />
      </div>
      <div class="st-shop">
        <span aria-hidden="true" class="st-shop-ic"><Icon name="store" size={20} stroke={2} /></span>
        {/* The shop's place and phone are not in the yard's books (store_snapshot gives its name only): data gap, reported. */}
        <span class="st-shop-t"><b>{b.shopName}</b><span><span aria-hidden="true" class="st-shop-dot" />Open</span></span>
      </div>
      <div class="st-signed">
        <span class="st-signed-t"><span>Signed in as</span><b>{b.me.name}</b></span>
        <button type="button" class="st-signout" onClick={() => { void signOut(); }}><Icon name="sign-out" size={18} stroke={2} />Sign out</button>
      </div>
    </YardSheet>
  );
}
