/*
 * The app frame: the screen on top of the stack, the tab bar under the four
 * tab roots, the sheet host and the toast host. Before the tabs: sign in,
 * or "signed in as someone else" (TD10).
 */
import type { JSX } from 'preact';
import { SheetHost } from '../../../ui/sheet.tsx';
import { TabBar } from '../../../ui/TabBar.tsx';
import { ToastHost } from '../../../ui/toast.tsx';
import { Login, SignedElsewhere } from './Gate.tsx';
import { barTab, nav, screen, showTabBar, top } from './nav.ts';
import { drafts, phase, waitingCount } from './store.ts';

export function App(): JSX.Element {
  if (phase.value === 'starting') return <main class="ow-frame" aria-busy="true" />;
  if (phase.value === 'login') return <Login />;
  if (phase.value === 'signed-elsewhere') return <SignedElsewhere />;
  const t = top.value, s = screen(t.id), bar = showTabBar.value;
  const View = s ? s.view : null;
  return (
    <div class={'ow-frame' + (bar ? ' with-bar' : '')}>
      {View ? <View key={t.key} params={t.params} /> : <main class="ow-missing">No screen “{t.id}”</main>}
      {bar && (
        <TabBar active={barTab.value} waiting={waitingCount.value} notPlaced={drafts.value.length}
          onTab={(x) => nav.tab(x)} onPlus={() => nav.push('sell')} />
      )}
      <SheetHost />
      <ToastHost above={bar ? 84 : 0} />
    </div>
  );
}
