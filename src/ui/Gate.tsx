/*
 * The sign-in gate, before Today (the Buyer's Gate.dc.html; the Manager's Added AD01): the navy head
 * with the shop and the role, two fields, one button. States: default, signing in, wrong email or
 * password, no signal (the button greys and waits). Sales and the Buyer still carry their own
 * copies (src/apps/{sales,buyer}/shell/Gate.tsx), to move onto this one.
 *
 *   <Gate shop="Mukasa Hardware" role="Manager" line="Decide · Money · Team" hint="The phone keeps you signed in" onSignIn={signIn} />
 */
import type { ComponentChildren, JSX } from 'preact';
import { useState } from 'preact/hooks';
import { isDataError } from '../core/datasource.ts';
import { Icon } from './icons.tsx';
import './gate.css';

export interface GateProps {
  shop: string;
  role: string;
  /** The line under the role ("Decide · Money · Team"). */
  line: string;
  /** The mark in the head (an icon); a tick in a box by default. */
  mark?: ComponentChildren;
  /** Under the card ("The phone keeps you signed in"); with `lock`, a lock before it. */
  hint: string;
  lock?: boolean;
  onSignIn: (email: string, password: string) => Promise<void>;
}

const NO_SIGNAL = 'No signal · try when you have signal';

export function Gate(p: GateProps): JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ text: string; offline: boolean } | null>(null);
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  const go = async (e: Event) => {
    e.preventDefault();
    if (busy) return;
    const empty = (e.currentTarget as HTMLFormElement).querySelector<HTMLInputElement>(email.trim() ? 'input[type=password]' : 'input[type=email]');
    if (!email.trim() || !password) { if (empty) empty.focus(); return; }
    setBusy(true); setErr(null);
    try { await p.onSignIn(email, password); } catch (x) {
      const off = isDataError(x) && x.kind === 'offline';
      setErr(off ? { text: NO_SIGNAL, offline: true } : { text: 'Wrong email or password', offline: false });
    } finally { setBusy(false); }
  };
  return (
    <main class="ow-gate">
      <header class="ow-gate-head">
        <div class="ow-gate-brand">
          <span class="ow-gate-mark" aria-hidden="true">{p.mark || <span style={{ color: '#6FDCB0', display: 'flex' }}><Icon name="check" size={26} stroke={2.2} /></span>}</span>
          <span><small>{p.shop}</small><b>{p.role}</b></span>
        </div>
        <p>{p.line}</p>
      </header>
      <form class="ow-gate-card" noValidate onSubmit={go}>
        <label>Email<input type="email" autocomplete="username" value={email} onInput={(e) => setEmail((e.target as HTMLInputElement).value)} required /></label>
        <label>Password<input class={err && !err.offline ? 'bad' : ''} type="password" autocomplete="current-password" value={password} onInput={(e) => setPassword((e.target as HTMLInputElement).value)} required /></label>
        {(err || offline) && (
          <p role="alert" class={'ow-gate-err' + (offline || err?.offline ? ' off' : '')}>
            <Icon name={offline || err?.offline ? 'offline' : 'warning'} size={18} stroke={2} />
            {err ? err.text : NO_SIGNAL}
          </p>
        )}
        <button type="submit" class={'ow-gate-btn' + (busy ? ' busy' : '')} disabled={busy || offline}>{busy ? 'Signing in' : 'Sign in'}</button>
      </form>
      <p class={'ow-gate-hint' + (p.lock ? ' lock' : '')}>{p.lock && <Icon name="lock" size={14} stroke={2} />}{p.hint}</p>
    </main>
  );
}
