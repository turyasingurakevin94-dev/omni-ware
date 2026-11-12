/*
 * The shell's own screens, drawn on the canvas's "Added while building · 1" board (Added.dc.html,
 * reviewed at or above the Agent app, review/added-1.md):
 *   shell/sign-in   AD01 Sign in (default · signing in · wrong email or password · no signal)
 *   shell/no-reach  AD01 Could not reach the shop (Try again · Open the saved copy · Sign out)
 *   shell/you       AD02 You, the sheet from the RN disc (shop · pushes on this phone · Sign out)
 * and the first load (Loading below): the navy head at once, "Getting the shop", never a blank page.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { hm } from '../../../core/manager/words.ts';
import { greeting } from '../../../core/time.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Gate } from '../../../ui/Gate.tsx';
import { Icon } from '../../../ui/icons.tsx';
import type { ScreenDef } from '../../../ui/stack.ts';
import { nav } from './nav.ts';
import { books, isDemo, now, openCopy, registerPush, saved, session, signIn, signOut, start } from './store.ts';
import './shell.css';

function SignIn(): JSX.Element {
  return <Gate shop={session.value ? session.value.shopName : 'Mukasa Hardware'} role="Manager" line="Decide · Money · Team" hint="The phone keeps you signed in" lock onSignIn={signIn} />;
}

function NoReach(): JSX.Element {
  const [busy, setBusy] = useState(false);
  const tried = now.value;
  return (
    <main class="mg-gate">
      <header class="mg-gate-head">
        <span class="mg-gate-mark" aria-hidden="true"><Icon name="check" size={24} stroke={2.2} /></span>
        <span><small>{session.value ? session.value.shopName : 'Mukasa Hardware'}</small><b>Manager</b></span>
        <p>Decide · Money · Team</p>
      </header>
      <div class="mg-noreach">
        <span class="mg-noreach-ic" aria-hidden="true"><Icon name="offline" size={40} stroke={2} /></span>
        <h1>Could not reach the shop</h1>
        <span class="mono mg-noreach-t">{`tried ${hm(tried)}`}</span>
        <button type="button" class="mg-noreach-try" disabled={busy} onClick={async () => { setBusy(true); try { await start(); } finally { setBusy(false); } }}>
          <Icon name="retry" size={18} stroke={2.2} />{busy ? 'Trying' : 'Try again'}
        </button>
        {saved.value && (
          <button type="button" class="mg-noreach-copy" onClick={openCopy}>
            <span class="ic"><Icon name="copy" size={20} stroke={2} /></span>
            <span class="t"><b>Open the saved copy</b><span>{`saved ${hm(saved.value.at)} · look only`}</span></span>
            <Icon name="chevron-right" size={18} stroke={2} />
          </button>
        )}
        <button type="button" class="mg-noreach-out" onClick={() => { void signOut(); }}><Icon name="sign-out" size={16} stroke={2} />Sign out</button>
      </div>
    </main>
  );
}

const PUSH_KEY = 'ow-manager-push';
function pushOn(): boolean { try { return localStorage.getItem(PUSH_KEY) !== 'off'; } catch (_e) { return true; } }

function You(): JSX.Element | null {
  const b = books.value;
  const [on, setOn] = useState(pushOn());
  if (!b) return null;
  const me = b.me;
  const flip = () => {
    const v = !on;
    setOn(v);
    try { localStorage.setItem(PUSH_KEY, v ? 'on' : 'off'); } catch (_e) { /* private mode */ }
    if (v) void registerPush();
  };
  return (
    <div class="mg-you-scrim" onClick={(e) => { if (e.target === e.currentTarget) nav.back(); }}>
      <section class="mg-you" role="dialog" aria-label="You">
        <i class="mg-you-grab" aria-hidden="true" />
        <div class="mg-you-head">
          <Avatar initials={me.initials} tint="me" size={52} />
          <span><b>{me.name}</b><span>{`Manager · ${b.shop.name}`}</span></span>
          <button type="button" class="mg-you-x" aria-label="Close" onClick={() => nav.back()}><Icon name="close" size={18} stroke={2.2} /></button>
        </div>
        <div class="mg-you-card">
          <div class="mg-you-row"><span class="ic"><Icon name="store" size={18} stroke={2} /></span><span class="k">Shop</span><b>{b.shop.name}</b></div>
          <div class="mg-you-row"><span class="ic bell"><Icon name="bell" size={18} stroke={2} /></span><span class="k strong">Pushes on this phone</span>
            <button type="button" role="switch" aria-checked={on} aria-label="Pushes on this phone" class={'mg-switch' + (on ? ' on' : '')} disabled={isDemo} onClick={flip}><i /></button>
          </div>
        </div>
        <button type="button" class="mg-you-out" onClick={() => { void signOut(); }}><Icon name="sign-out" size={18} stroke={2} />Sign out</button>
      </section>
    </div>
  );
}

/** The first load: the navy head at once, "Getting the shop", the shapes of Today (Added "LOADING · THE FIRST LOAD"). */
export function Loading(): JSX.Element {
  return (
    <main class="mg-load" aria-busy="true">
      <header class="mg-load-head"><b>{greeting(Date.now())}</b><span class="mg-load-chip"><i />Getting the shop</span><i class="sk w" /><i class="sk bar" /></header>
      <div class="mg-load-tiles">{[0, 1, 2, 3].map((i) => <i key={i} />)}</div>
      {[0, 1].map((i) => <div class="mg-load-row" key={i}><i class="c" /><span><i /><i /></span></div>)}
    </main>
  );
}

export const shellScreens: Record<string, ScreenDef> = {
  'shell/sign-in': { view: SignIn, tabBar: false },
  'shell/no-reach': { view: NoReach, tabBar: false },
  'shell/you': { view: You, tabBar: false },
};
