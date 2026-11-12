/*
 * TD28 · Which shop? (round 3, SAL-019): a sign-in that opens more than one shop asks which, as sales.html's
 * chooseShop did, instead of opening the first. The choice is kept on this phone until sign-out
 * (core/shop-choice.ts). In the shell, so it shows before any tab has loaded.
 */
import type { JSX } from 'preact';
import type { ShopChoice } from '../../../core/types.ts';
import { Icon } from '../../../ui/icons.tsx';
import { openShop, session } from './store.ts';
import './whichshop.css';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const since = (d: string | null) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? `since ${Number(d.slice(8))} ${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}` : '');
const ROLE: Record<string, string> = { sales: 'Sales', manager: 'Manager', owner: 'Owner', admin: 'Admin' };

export function WhichShop(): JSX.Element {
  const shops: ShopChoice[] = (session.value && session.value.shops) || [];
  return (
    <main class="sh-shop">
      <span class="sh-shop-brand"><span>Omni-ware</span><span>SALES</span></span>
      <div class="sh-shop-mid">
        <div role="img" aria-label={`Your sign-in opens ${shops.length} shops`} class="sh-shop-pic">
          <span class="on"><Icon name="store" size={34} stroke={1.8} /></span>
          <span><Icon name="store" size={34} stroke={1.8} /></span>
        </div>
        <h1>Which shop?</h1>
      </div>
      <div class="sh-shop-foot">
        <div class="sh-shop-card">
          {shops.map((x, i) => (
            <button key={x.shopId} type="button" aria-label={`Open ${x.name}`} onClick={() => { void openShop(x.shopId); }}>
              <span aria-hidden="true" class={i === 0 ? 'on' : ''}><Icon name="store" size={20} stroke={2} /></span>
              <span><span>{x.name}</span><span>{[ROLE[x.role] || x.role, since(x.since)].filter(Boolean).join(' · ')}</span></span>
              <Icon name="chevron-right" size={18} stroke={2.4} />
            </button>
          ))}
        </div>
        <span class="sh-shop-kept"><Icon name="mobile" size={14} stroke={2} />Kept on this phone until you sign out</span>
      </div>
    </main>
  );
}
