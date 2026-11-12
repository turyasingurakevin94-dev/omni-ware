/*
 * You (board R1You, "After · You"; BUY-14): the avatar on Today's head opens it. Who is signed in on
 * this phone: the face, the name, "Buyer · Mukasa Hardware"; Role, Shop, "Pushes on this phone" (On or
 * Off); the one button, Sign out ("Signing out…", then the sign-in page; this phone forgets the copy).
 *
 *   openYou()
 */
import { useState } from 'preact/hooks';
import type { JSX } from 'preact';
import type { Member } from '../../../core/types.ts';
import { Icon, type IconName } from '../../../ui/icons.tsx';
import { sheet } from '../../../ui/sheet.tsx';
import { toast } from '../../../ui/toast.tsx';
import { cx } from '../../../ui/util.tsx';
import { pushes, session, signOut } from './store.ts';
import './you.css';

/** Only the Buyer signs in here (the server refuses any other login, store.ts notMine). */
const ROLE = 'Buyer';

export function openYou(me: Member): void {
  sheet.open(() => <You me={me} />, { label: 'You', top: 300 });
}

function Row(p: { icon: IconName; word: string; good?: boolean; children: JSX.Element | string }): JSX.Element {
  return (
    <div class="ow-b-you-row">
      <span aria-hidden="true" class={cx('ow-b-you-ic', p.good && 'good')}><Icon name={p.icon} size={18} stroke={2} /></span>
      <span class="ow-b-you-w">{p.word}</span>
      {p.children}
    </div>
  );
}

function You(p: { me: Member }): JSX.Element {
  const shop = session.value ? session.value.shopName : '';
  const [busy, setBusy] = useState(false);
  const on = pushes.value;
  const out = async (): Promise<void> => {
    setBusy(true);
    try { await signOut(); sheet.close(); } catch (e) {
      setBusy(false);
      toast.show('Not signed out', { kind: 'error', sub: e instanceof Error ? e.message : '', retry: () => { void out(); } });
    }
  };
  return (
    <div class="ow-b-you">
      <span aria-hidden="true" class="ow-grab" />
      <div class="ow-b-you-h">
        <span aria-hidden="true" class="ow-b-you-face">{p.me.initials}</span>
        <span class="ow-b-you-who"><b>{p.me.name}</b><span>{shop ? `${ROLE} · ${shop}` : ROLE}</span></span>
        <button type="button" class="ow-b-you-x" aria-label="Close" onClick={() => sheet.close()}><Icon name="close" size={18} stroke={2} /></button>
      </div>
      <div class="ow-b-you-card">
        <Row icon="tag" word="Role"><b>{ROLE}</b></Row>
        {shop && <Row icon="store" word="Shop"><b>{shop}</b></Row>}
        <Row icon="bell" word="Pushes on this phone" good={on}>
          <span class={cx('ow-b-you-pill', on && 'on')}><i aria-hidden="true" />{on ? 'On' : 'Off'}</span>
        </Row>
      </div>
      <span class="ow-b-you-gap" />
      <button type="button" class={cx('ow-btn', 'k-navy', 'ow-b-you-out', busy && 'sending')} aria-busy={busy || undefined} onClick={busy ? undefined : () => void out()}>
        {busy ? <span class="ow-spin" aria-hidden="true" /> : <Icon name="sign-out" size={18} stroke={2} />}
        <span>{busy ? 'Signing out…' : 'Sign out'}</span>
      </button>
    </div>
  );
}
