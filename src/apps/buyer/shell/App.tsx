/*
 * The Buyer's frame: the top screen, the bar (Today · red + · Suppliers; the
 * + opens the trip), the sheet host and the toast host.
 */
import type { JSX } from 'preact';
import { SheetHost } from '../../../ui/sheet.tsx';
import { TabBar, type BarItem } from '../../../ui/TabBar.tsx';
import { ToastHost } from '../../../ui/toast.tsx';
import { Login } from './Gate.tsx';
import { barTab, nav, screen, showTabBar, top, type Tab } from './nav.ts';
import { kept, online, phase } from './store.ts';
import { tripBadge } from './trip-entry.ts';

/** The screen's navy head: a toast sits just under it, never over the title or the Live pill. */
const HEAD = '.ow-frame > main > :first-child';
/** "Kept · sends when back", "Saved on this phone"…: a kept write's toast. */
const KEPT = /\bkept\b|saved on this phone/i;
/** While the offline band is up, a kept write's toast would only say it again. */
const repeatsBand = (t: { text: string; kind: string }): boolean => t.kind === 'warn' && KEPT.test(t.text) && (!online.value || kept.value.length > 0);

const ITEMS: BarItem<Tab>[] = [{ id: 'today', word: 'Today', icon: 'today' }, { id: 'suppliers', word: 'Suppliers', icon: 'store' }];

export function App(): JSX.Element {
  if (phase.value === 'starting') return <main class="ow-frame" aria-busy="true" />;
  if (phase.value === 'login') return <Login />;
  const t = top.value, s = screen(t.id), bar = showTabBar.value;
  const View = s ? s.view : null;
  return (
    <div class={'ow-frame' + (bar ? ' with-bar' : '')}>
      {View ? <View key={t.key} params={t.params} /> : <main class="ow-missing">No screen “{t.id}”</main>}
      {bar && (
        <TabBar<Tab> items={ITEMS} active={barTab.value} waiting={0} notPlaced={tripBadge.value}
          plusLabel="The trip" plusCountWord="stops to buy" onTab={(x) => nav.tab(x)} onPlus={() => nav.push('trip')} />
      )}
      <SheetHost />
      <ToastHost above={bar ? 84 : 0} below={HEAD} twoLine hide={repeatsBand} />
    </div>
  );
}
