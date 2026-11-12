/*
 * shell/sign-in (TD20, TD23 Signing in…, TD31 Wrong email or password): the Store's own pushes floating
 * over the navy, "Run the yard. One job at a time.", email and password, the red Sign in, and how a new
 * person gets in (the manager sends an invite link). With no signal it says so and keeps what was typed.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { isDataError } from '../../../core/datasource.ts';
import { Icon, type IconName } from '../../../ui/icons.tsx';
import { toast } from '../../../ui/toast.tsx';
import { cx } from '../../../ui/util.tsx';
import { signIn } from '../shell/store.ts';
import './signin.css';

/** The kind of push the yard gets, drawn as a picture of what the app does (not data). */
const PUSHES: { icon: IconName; tone: string; title: string; sub: string; at: string }[] = [
  { icon: 'orders', tone: 'b', title: 'New to pack · #0556', sub: 'From Grace · they collect', at: 'left: 58px; top: 100px; transform: rotate(-2deg)' },
  { icon: 'tray-in', tone: 'a', title: 'Denis’s trip is back at the yard', sub: '1 line · check it in', at: 'left: 30px; top: 170px; transform: rotate(1.5deg)' },
  { icon: 'gate', tone: 'm', title: 'Ready to collect · #0555', sub: 'at the gate · Grace is told', at: 'left: 76px; top: 240px; transform: rotate(-1deg)' },
];

export function SignIn(): JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const go = async (e?: Event) => {
    if (e) e.preventDefault();
    if (busy) return;
    if (!email.trim() || !password) { setErr('Wrong email or password · try again'); return; }
    setBusy(true); setErr(null);
    try { await signIn(email, password); } catch (x) {
      setErr(isDataError(x) && x.kind === 'offline' ? 'No signal · try when you have signal' : 'Wrong email or password · try again');
    } finally { setBusy(false); }
  };
  return (
    <main class="st-si" data-route="shell/sign-in">
      <div class="st-si-top">
        <div class="st-si-logo"><span aria-hidden="true"><Icon name="play" size={22} on stroke={2} style={{ marginLeft: '2px' }} /></span><span><b>Omni-Ware</b><span>STORE</span></span></div>
        {PUSHES.map((p) => (
          <div key={p.title} aria-hidden="true" class="st-si-push" style={p.at}>
            <span class={cx('st-si-pi', p.tone)}><Icon name={p.icon} size={17} stroke={2} /></span>
            <span><b>{p.title}</b><span>{p.sub}</span></span>
          </div>
        ))}
        <h1 class={cx(err && 'err')}>Run the yard.<br /><span>One job at a time.</span></h1>
      </div>
      <form class={cx('st-si-form', err && 'err')} noValidate onSubmit={go}>
        <label><span class="st-si-l">Email</span>
          <span class="st-si-f"><Icon name="mail" size={18} stroke={2} />
            <input type="email" autocomplete="username" value={email} disabled={busy} onInput={(e) => setEmail((e.target as HTMLInputElement).value)} /></span></label>
        <label><span class="st-si-l">Password</span>
          <span class={cx('st-si-f pw', err && 'bad')}><Icon name="lock" size={18} stroke={2} />
            <input type={show ? 'text' : 'password'} autocomplete="current-password" value={password} disabled={busy} onInput={(e) => setPassword((e.target as HTMLInputElement).value)} />
            <button type="button" aria-label={show ? 'Hide the password' : 'Show the password'} onClick={() => setShow(!show)}><Icon name="eye" size={18} stroke={2} /></button></span></label>
        {err && <p role="alert" class="st-si-err"><Icon name="warning" size={15} stroke={2.2} />{err}</p>}
        <button type="button" class="st-si-forgot" onClick={() => toast.show('Ask your manager for a new invite link', { kind: 'ok' })}>Forgot password?</button>
        <button type="submit" class={cx('st-si-go', busy && 'busy')} disabled={busy}>
          {busy ? <><span aria-hidden="true" class="st-spin" />Signing in…</> : <>Sign in<Icon name="arrow-right" size={18} stroke={2.4} /></>}
        </button>
        <div class="st-si-new"><span aria-hidden="true" class="st-si-rn"><Icon name="person" size={16} stroke={2} /></span><span><b>New to the yard?</b><span>Your manager sends you an invite link</span></span></div>
      </form>
    </main>
  );
}
