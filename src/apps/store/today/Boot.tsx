/*
 * The boot screens (STO-REL-11): shell/checking "Checking your shop…" over Today's skeleton (TD21),
 * and shell/no-reach "Could not reach the shop" (TD22: Try again · open the copy saved 7:52 · Work
 * kept · Sign out). Never "This login has no shop" after a failed read.
 */
import type { JSX } from 'preact';
import { firstWord, initials } from '../../../core/names.ts';
import { greeting } from '../../../core/time.ts';
import { Button } from '../../../ui/Button.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { TabBar } from '../../../ui/TabBar.tsx';
import { kept, now, phase, session, signOut, start } from '../shell/store.ts';
import './signin.css';

const Sh = (p: { w: string | number; h: number; light?: boolean; r?: number }): JSX.Element =>
  <span aria-hidden="true" class={'st-boot-shim' + (p.light ? ' light' : '')} style={{ width: typeof p.w === 'number' ? `${p.w}px` : p.w, height: `${p.h}px`, borderRadius: p.r != null ? `${p.r}px` : undefined }} />;

function Head(p: { status: JSX.Element }): JSX.Element {
  const s = session.value, name = firstWord(s ? s.name : '');
  return (
    <div class="st-boot-row">
      <span class="st-boot-hi"><b>{`${greeting(now.value)}${name ? `, ${name}` : ''}`}</b>{p.status}</span>
      <span aria-hidden="true" class="st-boot-me">{s ? initials(s.name) : ''}</span>
    </div>
  );
}

export function Checking(): JSX.Element {
  return (
    <div class="with-bar" aria-busy="true">
      <header class="st-boot-hero">
        <Head status={<span class="ow-hero-live chk" style={{ fontSize: '12px', fontWeight: 600 }}><span aria-hidden="true" />Checking your shop…</span>} />
        <Sh w={110} h={12} /><Sh w={190} h={36} r={10} /><Sh w="100%" h={8} /><Sh w={190} h={10} />
      </header>
      <main class="st-boot-main">
        <h2 class="st-boot-h">On the move</h2>
        <div class="st-boot-tiles">{[0, 1, 2, 3].map((i) => <span key={i}><Sh w={30} h={14} light /><Sh w={44} h={8} light /><Sh w={34} h={16} light r={999} /></span>)}</div>
        <h2 class="st-boot-h">Next job</h2>
        <div class="st-boot-card"><Sh w={130} h={26} r={999} />
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}><span aria-hidden="true" style={{ width: '84px', height: '84px', borderRadius: '999px', boxShadow: 'inset 0 0 0 5px rgba(255,255,255,.08)', flex: 'none' }} />
            <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}><Sh w="90%" h={14} /><Sh w="60%" h={18} /><Sh w="80%" h={10} /></span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}><Sh w="100%" h={58} r={12} /><Sh w="100%" h={58} r={12} /><Sh w="100%" h={58} r={12} /></div></div>
        <p class="st-boot-note"><Icon name="lock" size={14} stroke={2} />Your drafts on this phone are safe while it asks</p>
      </main>
      <TabBar<'today' | 'shelf'> items={[{ id: 'today', word: 'Today', icon: 'today' }, { id: 'shelf', word: 'Shelf', icon: 'shelf' }]} active="today" waiting={0} notPlaced={0}
        plusIcon="play" plusLabel="Start the next job" plusOff="checking your shop" onTab={() => undefined} onPlus={() => undefined} />
    </div>
  );
}

export function NoReach(): JSX.Element {
  const waiting = kept.value.filter((k) => k.state !== 'refused').length;
  return (
    <>
      <header class="st-boot-hero" style={{ paddingBottom: '18px' }}>
        <Head status={<span class="ow-hero-live off" style={{ fontSize: '12px', fontWeight: 600 }}><span aria-hidden="true" />Could not reach the shop</span>} />
      </header>
      <main class="st-noreach">
        <div aria-hidden="true" class="st-noreach-ghost"><div><i /><b /></div><div><i /><b /></div><div><i /><b /></div></div>
        <div class="st-empty">
          <span aria-hidden="true" class="st-empty-ic" style={{ color: '#F5B26B' }}><Icon name="offline" size={30} stroke={2} /></span>
          <b>Could not reach the shop</b><span>The shop is fine · this phone couldn't ask</span>
        </div>
        <span class="mono code">code ST-101</span>
        <Button kind="navy" icon="retry" stroke={2.4} onClick={() => { phase.value = 'starting'; void start(); }}>Try again</Button>
        <div class="st-noreach-two">
          <button type="button" onClick={() => { phase.value = 'ready'; }}><b><Icon name="undo" size={16} stroke={2.2} />Open the copy</b><span>saved on this phone</span></button>
          <span class="kept"><b><Icon name="lock" size={16} stroke={2.2} />Work kept</b><span>{waiting ? `${waiting} waiting to send` : 'nothing waiting'}</span></span>
        </div>
        <button type="button" class="st-noreach-out" onClick={() => { void signOut(); }}><Icon name="sign-out" size={18} stroke={2} />Sign out</button>
      </main>
    </>
  );
}
