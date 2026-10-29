/*
 * P16 · The white tab bar and the red + (LANGUAGE.md §3), the Sales bar:
 * Today · Chats · + · Orders · Customers, five columns 1fr 1fr 96px 1fr 1fr.
 * The markup and the measures are the part's own, moved from inline styles
 * to tabbar.css; the icons are its paths. The active tab is ink, 700, its
 * icon filled; the Chats tab carries the unread count; the + carries the
 * orders not placed yet.
 */
import type { JSX } from 'preact';
import './tabbar.css';

export type BarTab = 'today' | 'chats' | 'orders' | 'customers';

const ICONS: Record<BarTab, (on: boolean) => JSX.Element> = {
  today: (on) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M6 18a6 6 0 0 1 12 0z" /><path d="M3 18h18M12 4v3M4.9 8.9 7 11M19.1 8.9 17 11" fill="none" />
    </svg>
  ),
  chats: (on) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M3 4.5h13v9H8l-5 4z" /><path d="M17.5 8.5H21v11.5l-3.2-2.6H10.5v-2.9" fill="none" />
    </svg>
  ),
  orders: (on) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z" /><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" fill="none" stroke={on ? '#FFFFFF' : undefined} />
    </svg>
  ),
  customers: (on) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.3-6 6.5-6s5.9 2.4 6.5 6z" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3c2 .9 3.2 2.9 3.5 5.7" fill="none" />
    </svg>
  ),
};

const WORD: Record<BarTab, string> = { today: 'Today', chats: 'Chats', orders: 'Orders', customers: 'Customers' };

export interface TabBarProps {
  active: BarTab | null;
  /** Chats waiting for a reply (the crimson count). */
  waiting: number;
  /** Orders not placed yet (the navy count on the +). */
  notPlaced: number;
  onTab: (tab: BarTab) => void;
  onPlus: () => void;
}

export function TabBar(p: TabBarProps): JSX.Element {
  const tab = (t: BarTab) => {
    const on = p.active === t;
    const label = t === 'chats' && p.waiting > 0 ? `Chats, ${p.waiting} waiting` : undefined;
    return (
      <a href={`#${t}`} class={'ow-tab' + (on ? ' on' : '') + (t === 'chats' ? ' ow-tab-chats' : '')} aria-current={on ? 'page' : undefined} aria-label={label}
        onClick={(e) => { e.preventDefault(); p.onTab(t); }}>
        {ICONS[t](on)}{WORD[t]}
        {t === 'chats' && p.waiting > 0 && <span class="ow-tab-count mono" aria-hidden="true">{p.waiting}</span>}
      </a>
    );
  };
  return (
    <nav aria-label="Main" class="ow-tabbar">
      {tab('today')}
      {tab('chats')}
      <a href="#new" class="ow-plus" aria-label={p.notPlaced > 0 ? `New sale, ${p.notPlaced} not placed yet` : 'New sale'}
        onClick={(e) => { e.preventDefault(); p.onPlus(); }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        {p.notPlaced > 0 && <span class="ow-plus-count" aria-hidden="true">{p.notPlaced}</span>}
      </a>
      {tab('orders')}
      {tab('customers')}
    </nav>
  );
}
