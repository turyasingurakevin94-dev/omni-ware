/*
 * TD10 · Signed in as someone else: the login under this screen is another role's (Musa, Store).
 * Nothing is saved as them; Grace's own work waits on this phone (the outbox and her drafts are
 * per login). Sign in as yourself, or open that person's own app.
 */
import type { JSX } from 'preact';
import { firstWord } from '../../../core/names.ts';
import type { Role } from '../../../core/types.ts';
import { Icon } from '../../../ui/icons.tsx';
import { elsewhere, signOut } from '../shell/store.ts';
import './elsewhere.css';

const ROLE_WORD: Partial<Record<Role, string>> = { store: 'Store', buyer: 'Buyer', accounts: 'Accounts', sourcing: 'Sourcing', manager: 'Manager', owner: 'Owner', staff: 'Yard' };
const ROLE_PAGE: Partial<Record<Role, string>> = { store: 'store.html', buyer: 'buyer.html', accounts: 'accounts.html', sourcing: 'sourcing.html', manager: 'manager.html', owner: 'owner.html' };

export function Elsewhere(): JSX.Element {
  const m = elsewhere.value, name = m ? firstWord(m.name) : 'someone', role = m ? ROLE_WORD[m.role] || m.role : '', page = m ? ROLE_PAGE[m.role] : null;
  return (
    <div class="td-else">
      <span class="td-else-brand"><span>Omni-ware</span><span>SALES</span></span>
      <div class="td-else-mid">
        <div role="img" aria-label={`${name}'s ${role} sign-in is on this phone; your Sales sign-in is locked until you sign in`} class="td-else-pic">
          <span><span class="td-else-them">{m ? m.initials : '?'}</span><span class="td-else-tag"><Icon name="store" size={13} stroke={2.2} />{`${name} · ${role}`}</span></span>
          <span aria-hidden="true" class="td-else-lock"><Icon name="lock" size={20} stroke={2} /></span>
          <span><span class="td-else-you"><Icon name="person" size={30} stroke={1.8} /></span><span class="td-else-tag you">You · Sales</span></span>
        </div>
        <h1>Signed in as<br />someone else</h1>
      </div>
      <div class="td-else-foot">
        <div class="td-else-card">
          <span><span aria-hidden="true" class="a"><Icon name="lock" size={18} stroke={2} /></span><span>{`Nothing is saved as ${name}`}</span></span>
          <span><span aria-hidden="true" class="m"><Icon name="mobile" size={18} stroke={2} /></span><span>Your work waits on this phone</span></span>
        </div>
        <button type="button" class="td-else-in" onClick={() => { void signOut(); }}>Sign in as yourself<Icon name="chevron-right" size={16} stroke={2.4} /></button>
        {page && <button type="button" class="td-else-app" onClick={() => { location.href = location.pathname.replace(/next\/[^/]*$|[^/]*$/, '') + page; }}><Icon name="store" size={18} stroke={2} />{`Open the ${role} app`}</button>}
      </div>
    </div>
  );
}
