/*
 * TD18 · You: the goal ring round Grace's face, what she sold, her orders and her customers this
 * month, what her sign-in opens (and who decides the rest), the shop, what she asked of Sourcing,
 * alerts and big text on this phone, and signing out.
 */
import type { JSX } from 'preact';
import { short } from '../../../core/money.ts';
import { firstWord } from '../../../core/names.ts';
import { dayOf, monthName } from '../../../core/time.ts';
import type { SourcingAsk } from '../../../core/types.ts';
import { Avatar, PLAIN } from '../../../ui/Avatar.tsx';
import { FullSheet } from '../../../ui/FullSheet.tsx';
import { Duo, Icon, phStore, type IconName } from '../../../ui/icons.tsx';
import { Tap, barW } from '../../../ui/util.tsx';
import { nav } from '../shell/nav.ts';
import { books, now, signOut } from '../shell/store.ts';
import { doneWeek, due, mine } from './data.ts';
import { go, tel } from './go.ts';
import { toast } from '../../../ui/toast.tsx';
import { isDataError } from '../../../core/datasource.ts';
import { PUSH_WHY, push, setAlerts, setLocal, useLocal } from './local.ts';
import { goalOf } from './Today.tsx';
import './you.css';

/** What a Sales sign-in opens (decision-rights: Sales takes orders and payments and talks to customers). */
const OPENS: { word: string; icon: IconName; on: () => void }[] = [
  { word: 'Orders', icon: 'orders', on: () => go('orders') },
  { word: 'Customers', icon: 'customers', on: () => go('customers') },
  { word: 'Payments', icon: 'cash', on: () => nav.replace('today/day', { view: 'money' }) },
  { word: 'Chats', icon: 'chats', on: () => nav.tab('chats') },
];
export const ASK_STAGES: SourcingAsk['status'][] = ['asked', 'looking', 'found', 'priced', 'listed'];
const DOT: Record<string, string> = { asked: '#16203C', looking: '#16203C', found: '#7FA2D6', priced: '#F5B26B', listed: '#0F6B43' };

export function You(): JSX.Element {
  const b = books.value, n = now.value, L = useLocal();
  if (!b) return <main class="td-wait" aria-busy="true" />;
  const g = goalOf(b, n), me = b.me, month = monthName(dayOf(n)), live = mine(b).length, done = doneWeek(b, n).length;
  const owe = b.customers.filter((c) => !c.qa && c.owes > 0).length, dueN = due(b, n).length, all = b.customers.filter((c) => !c.qa).length;
  const owner = b.members.find((m) => m.role === 'owner'), manager = b.members.find((m) => m.role === 'manager'), sourcing = b.members.find((m) => m.role === 'sourcing');
  const asks = b.asks.filter((a) => a.status !== 'dropped' && a.requests.some((r) => r.by === me.id));
  const listed = asks.filter((a) => a.status === 'listed').length, open = asks.length - listed;
  const C = 2 * Math.PI * 37, pct = g ? Math.min(1, g.sold / g.target) : 0;
  const close = () => nav.back();
  const P = push.value, on = !!(P && P.on), why = P && !P.on && P.why ? PUSH_WHY[P.why] : '';
  const alerts = async () => {
    try {
      const r = await setAlerts(!on);
      if (!on && !r.on && r.why) toast.show('Alerts not on', { kind: 'error', sub: PUSH_WHY[r.why] });
    } catch (e) { toast.show(on ? 'Alerts not off' : 'Alerts not on', { kind: 'error', sub: isDataError(e) ? e.message : String(e) }); }
  };
  return (
    <FullSheet onBack={close} backLabel="Back to Today" pad="14px 16px 16px" head={
      <div class="ow-shead td-you-h">
        <span aria-hidden="true" class="ow-shead-grab" />
        <div class="td-you-who">
          <Tap on={() => nav.replace('today/goal')} label={`${month} goal: ${g ? g.pct : 0} percent`} class="td-you-ring">
            <svg width="82" height="82" viewBox="0 0 82 82" aria-hidden="true"><circle cx="41" cy="41" r="37" fill="none" stroke="rgba(255,255,255,.10)" stroke-width="4" />
              {pct > 0 && <circle cx="41" cy="41" r="37" fill="none" stroke="#6FDCB0" stroke-width="4" stroke-linecap="round" stroke-dasharray={`${(C * pct).toFixed(1)} ${C.toFixed(1)}`} transform="rotate(-90 41 41)" />}</svg>
            <span>{me.initials}</span>
          </Tap>
          <span class="td-you-t">
            <span>{me.name}</span><span>{`Sales · ${b.shop.name}`}</span>
            {g && !g.hit && <span class="td-you-togo"><Icon name="clock" size={12} stroke={2.6} />{`${short(g.target - g.sold)} to go`}</span>}
          </span>
          <span class="td-you-x"><button type="button" class="ow-shead-x" aria-label="Close" onClick={close}><Icon name="close" size={16} stroke={2.2} /></button></span>
        </div>
        <div class="td-you-stats">
          <Tap on={() => nav.replace('today/day', { view: 'placed' })}><span>{`Sold · ${month.slice(0, 3)}`}</span><span class="mono">{short(g ? g.sold : 0, 2)}</span>
            <span aria-hidden="true" class="td-you-bar"><i style={{ width: barW(g ? g.pct : 0) }} /></span><span>{`${g ? g.pct : 0}% of ${short(g ? g.target : 0)}`}</span></Tap>
          <Tap on={() => go('orders')}><span>Orders</span><span class="mono">{live + done}</span>
            <span aria-hidden="true" class="td-you-split"><i style={{ flex: live, background: '#6FDCB0' }} /><i style={{ flex: done }} /></span><span><span class="m">{`${live} live`}</span>{` · ${done} done`}</span></Tap>
          <Tap on={() => go('customers')}><span>Customers</span><span class="mono">{all}</span>
            <span aria-hidden="true" class="td-you-split"><i style={{ flex: dueN, background: '#F5B26B' }} /><i style={{ flex: all - dueN }} /></span><span><span class="a">{`${dueN} due`}</span>{` · ${owe} owe`}</span></Tap>
        </div>
      </div>
    }>
      <div class="td-you-card">
        <span class="td-you-ct">Your sign-in opens</span>
        <div class="td-you-opens">
          {OPENS.map((o) => (
            <Tap key={o.word} on={o.on} class="td-you-open">
              <span aria-hidden="true"><Icon name={o.icon} size={22} stroke={1.8} /><span><Icon name="check" size={10} stroke={3.4} /></span></span>
              <span>{o.word}</span>
            </Tap>
          ))}
        </div>
        <div class="td-you-chips">
          {owner && <span><Avatar initials={owner.initials} tint={owner.tint} size={24} style={PLAIN} /><b>{firstWord(owner.name)}</b>switched these on</span>}
          {manager && <span><Avatar initials={manager.initials} tint={manager.tint} size={24} style={PLAIN} /><b>{firstWord(manager.name)}</b>decides prices, credit</span>}
        </div>
      </div>
      <div class="td-you-shop">
        <span aria-hidden="true" class="td-you-shopic"><Duo i={phStore} size={22} color="#FFFFFF" /></span>
        <span class="td-you-st"><span>{b.shop.name}</span><span><span aria-hidden="true" />{`Open · ${b.settings.shopAddress.split(',')[0]}`}</span></span>
        <Tap href={'tel:' + tel(b.settings.shopPhone)} label="Call the shop" class="td-you-call"><Icon name="phone" size={18} stroke={2} /></Tap>
      </div>
      <Tap on={() => nav.push('today/asks')} class="td-you-asks">
        <span aria-hidden="true" class="td-you-askic"><Icon name="search" size={20} stroke={2} /></span>
        <span class="td-you-st"><span>Asked of Sourcing</span><span>{`${open} open · `}<span class="g">{`${listed} listed`}</span>{sourcing ? ` · ${firstWord(sourcing.name)}` : ''}</span></span>
        <span aria-hidden="true" class="td-you-dots">{ASK_STAGES.map((s) => <i key={s} style={{ background: asks.some((a) => a.status === s) ? DOT[s] : '#E6E3DD' }} />)}</span>
        <span aria-hidden="true" class="ow-chev"><Icon name="chevron-right" size={16} stroke={2.2} /></span>
      </Tap>
      <div class="td-you-toggles">
        <label class="td-you-tog">
          <span><span aria-hidden="true" class="td-you-bell"><Icon name="bell" size={18} stroke={2} /></span>
            <input type="checkbox" checked={on} disabled={!P} aria-label="Alerts" onChange={() => { void alerts(); }} /><span aria-hidden="true" class={'td-switch' + (on ? ' on' : '')}><i /></span></span>
          <span><span>{on ? 'Alerts on' : 'Alerts off'}</span><span>{why || 'chats · prices · paid'}</span></span>
        </label>
        <label class="td-you-tog">
          <span><span aria-hidden="true" class="td-you-aa">Aa</span>
            <input type="checkbox" checked={L.bigText} aria-label="Big text" onChange={() => setLocal({ bigText: !L.bigText })} /><span aria-hidden="true" class={'td-switch' + (L.bigText ? ' on' : '')}><i /></span></span>
          <span><span>Big text</span><span>every size a step up</span></span>
        </label>
      </div>
      <div class="td-you-foot">
        <span><span>Signed in as</span><span>{me.name}</span></span>
        <button type="button" class="td-you-out" onClick={() => { void signOut(); }}><Icon name="sign-out" size={17} stroke={2} />Sign out</button>
      </div>
    </FullSheet>
  );
}
