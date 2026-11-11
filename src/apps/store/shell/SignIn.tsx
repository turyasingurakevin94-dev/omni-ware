/*
 * shell/sign-in (TD20, TD23 sending, TD31 wrong email or password), as a working stand-in:
 * two fields and one navy button, so the real books can be opened before the board is
 * built to its pixels. The words are the board's; the drawing is the shell builder's to
 * match (parity spec test/parity/store-today.json once drawn).
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { isDataError } from '../../../core/datasource.ts';
import { Button } from '../../../ui/Button.tsx';
import { signIn } from './store.ts';

export function SignIn(): JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const go = async (e?: Event) => {
    if (e) e.preventDefault();
    if (busy || !email.trim() || !password) return;
    setBusy(true); setErr(null);
    try { await signIn(email, password); } catch (x) {
      setErr(isDataError(x) && x.kind === 'offline' ? 'No signal · try when you have signal' : 'Wrong email or password');
    } finally { setBusy(false); }
  };
  return (
    <main class="st-ph" data-route="shell/sign-in">
      <form class="st-signin" noValidate onSubmit={go}>
        <h1>Sign in · Store</h1>
        <label>Email<input type="email" autocomplete="username" value={email} onInput={(e) => setEmail((e.target as HTMLInputElement).value)} /></label>
        <label>Password<input type="password" autocomplete="current-password" value={password} onInput={(e) => setPassword((e.target as HTMLInputElement).value)} /></label>
        {err && <p role="alert">{err}</p>}
        <Button kind="navy" state={busy ? 'sending' : 'idle'} onClick={() => { void go(); }}>{busy ? 'Signing in…' : 'Sign in'}</Button>
      </form>
    </main>
  );
}
