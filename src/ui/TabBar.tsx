/*
 * P16 · The white tab bar and the red + (LANGUAGE.md §3 P16), the Sales
 * bar: Today · Chats · + · Orders · Customers, five columns 1fr 1fr 96px
 * 1fr 1fr. The active tab is ink, 700, its icon filled; the Chats tab
 * carries the unread count (crimson); the + carries the orders not placed
 * yet (navy). The + is hidden on screens with the dock, a full sheet or the
 * chat composer (the shell does that: it shows the bar only on tab roots).
 *
 *   <TabBar active="today" waiting={3} notPlaced={2} onTab={nav.tab} onPlus={…} />
 *   <TabBar inline items={[…]} … />      drawn in place; `items` for another bar (the agent's, kept for reference)
 */
import type { JSX } from 'preact';
import { Icon, type IconName } from './icons.tsx';
import { cx } from './util.tsx';
import './tabbar.css';

export type BarTab = 'today' | 'chats' | 'orders' | 'customers';

export interface BarItem<T extends string = BarTab> { id: T; word: string; icon: IconName }

const SALES: BarItem[] = [
  { id: 'today', word: 'Today', icon: 'today' }, { id: 'chats', word: 'Chats', icon: 'chats' },
  { id: 'orders', word: 'Orders', icon: 'orders-tab' }, { id: 'customers', word: 'Customers', icon: 'customers' },
];

export interface TabBarProps<T extends string = BarTab> {
  active: T | null;
  /** Chats waiting for a reply (the crimson count on Chats). */
  waiting: number;
  /** Orders not placed yet (the navy count on the +). */
  notPlaced: number;
  onTab: (tab: T) => void;
  onPlus: () => void;
  /** The tabs, half each side of the +. The Sales four by default. */
  items?: BarItem<T>[];
  /** The +'s name ("New sale"). */
  plusLabel?: string;
  inline?: boolean;
}

export function TabBar<T extends string = BarTab>(p: TabBarProps<T>): JSX.Element {
  const items = (p.items || SALES) as BarItem<T>[], half = Math.ceil(items.length / 2);
  const tab = (t: BarItem<T>) => {
    const on = p.active === t.id, chats = t.id === 'chats' && p.waiting > 0;
    return (
      <a key={t.id} href={`#${t.id}`} class={cx('ow-tab', on && 'on')} aria-current={on ? 'page' : undefined} aria-label={chats ? `Chats, ${p.waiting} waiting` : undefined}
        onClick={(e) => { e.preventDefault(); p.onTab(t.id); }}>
        <Icon name={t.icon} size={24} on={on} style={on ? ({ '--ic-in': '#FFFFFF' } as unknown as JSX.CSSProperties) : undefined} />{t.word}
        {chats && <span class="ow-tab-count mono" aria-hidden="true">{p.waiting}</span>}
      </a>
    );
  };
  const plus = p.plusLabel || 'New sale';
  return (
    <nav aria-label="Main" class={cx('ow-tabbar', p.inline && 'inline')} style={{ gridTemplateColumns: [...items.slice(0, half).map(() => '1fr'), '96px', ...items.slice(half).map(() => '1fr')].join(' ') }}>
      {items.slice(0, half).map(tab)}
      <a href="#new" class="ow-plus" aria-label={p.notPlaced > 0 ? `${plus}, ${p.notPlaced} not placed yet` : plus}
        onClick={(e) => { e.preventDefault(); p.onPlus(); }}>
        <Icon name="plus" size={28} stroke={2.4} />
        {p.notPlaced > 0 && <span class="ow-plus-count" aria-hidden="true">{p.notPlaced}</span>}
      </a>
      {items.slice(half).map(tab)}
    </nav>
  );
}
