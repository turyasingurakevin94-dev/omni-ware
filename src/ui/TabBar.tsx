/*
 * P16 · The white tab bar and the red + (LANGUAGE.md §3 P16), the Sales
 * bar: Today · Chats · + · Orders · Customers, five columns 1fr 1fr 96px
 * 1fr 1fr. The active tab is ink, 700, its icon filled; the Chats tab
 * carries the unread count (crimson); the + carries the orders not placed
 * yet (navy). The + is hidden on screens with the dock, a full sheet or the
 * chat composer (the shell does that: it shows the bar only on tab roots).
 *
 * The tabs share the bar equally either side of the + (a slot never grows, so the + stays centred), 8 px
 * in from each edge (P16; Kevin: "the tabs are so close to the edge"). The bar has no room to grow: when
 * the phone enlarges text (Android's font size, the WebView's textZoom), the labels stay at their own
 * 12 px (tabFontSize): inside their 62 px slots, 8 px from the edges, never overlapping.
 *
 *   <TabBar active="today" waiting={3} notPlaced={2} onTab={nav.tab} onPlus={…} />
 *   <TabBar inline items={[…]} … />      drawn in place; `items` for another bar (the agent's, kept for reference)
 *   <TabBar items={[today, shelf]} plusIcon="play" plusLabel="Start the next job" plusCountWord="ready now" … />   the Store's
 */
import type { JSX } from 'preact';
import { useRef } from 'preact/hooks';
import { Icon, type IconName } from './icons.tsx';
import { useFit } from './tabfit.ts';
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
  /** What the count is, as its label says it: "waiting" (the default), or "new" when all are numbers nobody took (CH35). */
  waitingWord?: string;
  /** Orders not placed yet (the navy count on the +). */
  notPlaced: number;
  onTab: (tab: T) => void;
  onPlus: () => void;
  /** The tabs, half each side of the +. The Sales four by default. */
  items?: BarItem<T>[];
  /** The +'s name ("New sale"). */
  plusLabel?: string;
  /** What the +'s count is, as its label says it: "not placed yet" (the default), or another bar's word ("stops to buy"). */
  plusCountWord?: string;
  /** The centre's icon: the + by default; the Store's filled play (store-agent TD01, "Start the next job"). */
  plusIcon?: 'plus' | 'play';
  /** The centre greyed and off, with why in its name (the Store's TD07 "Start the next job: not loaded yet"). */
  plusOff?: string;
  /** The tabs shown but off (the Store's TD21 "Checking your shop…": nothing to open yet). */
  tabsOff?: boolean;
  inline?: boolean;
}

export function TabBar<T extends string = BarTab>(p: TabBarProps<T>): JSX.Element {
  const items = (p.items || SALES) as BarItem<T>[], half = Math.ceil(items.length / 2);
  const ref = useRef<HTMLElement>(null);
  useFit(ref, `${p.active}|${p.waiting}|${items.map((t) => t.word).join()}`);
  const tab = (t: BarItem<T>) => {
    const on = p.active === t.id, chats = t.id === 'chats' && p.waiting > 0;
    return (
      <a key={t.id} href={`#${t.id}`} class={cx('ow-tab', on && 'on')} aria-current={on ? 'page' : undefined} aria-disabled={p.tabsOff ? 'true' : undefined} aria-label={chats ? `Chats, ${p.waiting} ${p.waitingWord || 'waiting'}` : undefined}
        onClick={(e) => { e.preventDefault(); if (!p.tabsOff) p.onTab(t.id); }}>
        <Icon name={t.icon} size={24} on={on} style={on ? ({ '--ic-in': '#FFFFFF' } as unknown as JSX.CSSProperties) : undefined} /><span class="ow-tab-w">{t.word}</span>
        {chats && <span class="ow-tab-count mono" aria-hidden="true">{p.waiting}</span>}
      </a>
    );
  };
  const plus = p.plusLabel || 'New sale';
  return (
    <nav ref={ref} aria-label="Main" class={cx('ow-tabbar', p.inline && 'inline')} style={{ gridTemplateColumns: [...items.slice(0, half).map(() => 'minmax(0, 1fr)'), '96px', ...items.slice(half).map(() => 'minmax(0, 1fr)')].join(' ') }}>
      {items.slice(0, half).map(tab)}
      <a href="#new" class={cx('ow-plus', p.plusOff && 'off')} aria-disabled={p.plusOff ? 'true' : undefined}
        aria-label={p.plusOff ? `${plus}: ${p.plusOff}` : p.notPlaced > 0 ? `${plus}, ${p.notPlaced} ${p.plusCountWord || 'not placed yet'}` : plus}
        onClick={(e) => { e.preventDefault(); if (!p.plusOff) p.onPlus(); }}>
        {p.plusIcon === 'play'
          ? <Icon name="play" size={26} stroke={2} on style={{ marginLeft: '3px' }} />
          : <Icon name="plus" size={28} stroke={2.4} />}
        {p.notPlaced > 0 && !p.plusOff && <span class="ow-plus-count" aria-hidden="true">{p.notPlaced}</span>}
      </a>
      {items.slice(half).map(tab)}
    </nav>
  );
}
