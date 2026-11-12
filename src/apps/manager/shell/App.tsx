/*
 * The Manager's frame (spec 04-screens-manager §2): the top screen (a sheet drawn over the
 * screen under it), the bar Today · Orders · the red + · Money · Team, the Not done bars,
 * the sheet host and the toast host.
 *
 * The red + opens Decide at the head of the queue, its navy badge the decisions waiting;
 * with nothing waiting it is a tick and opens All decided (Today empty state).
 *
 * The bars, above the tab bar unless the screen draws its own (ScreenDef.bars === false):
 *   amber   no signal, or answers waiting to send: "No signal · it sends when back"
 *   red     "Not sent · tell Kevin" / "code MG-502" · Try again
 *   blue    "Someone else just did this · Refreshed"
 */
import { effect } from '@preact/signals';
import type { JSX } from 'preact';
import { Notice } from '../../../ui/Notice.tsx';
import { SheetHost } from '../../../ui/sheet.tsx';
import { TabBar, type BarItem } from '../../../ui/TabBar.tsx';
import { toast, ToastHost } from '../../../ui/toast.tsx';
import { barTab, isSheet, nav, screen, showTabBar, top, under, type Tab } from './nav.ts';
import { Loading } from './shell-screens.tsx';
import { books, flush, held, kept, notDone, online, phase, undoHeld, waiting } from './store.ts';

const ITEMS: BarItem<Tab>[] = [
  { id: 'today', word: 'Today', icon: 'today' }, { id: 'orders', word: 'Orders', icon: 'orders-tab' },
  { id: 'money', word: 'Money', icon: 'cash' }, { id: 'team', word: 'Team', icon: 'customers' },
];

// A tap answer waiting its 10 s shows as the toast with Undo, unless the screen draws its own strip.
effect(() => { const h = held.value; if (h && !h.quiet) toast.show(h.label, { undo: undoHeld, ms: Math.max(0, h.until - Date.now()) }); });

export function decideNext(): void {
  if (waiting.value.length) nav.push('decide', {});
  else nav.push('decide/done', {});
}

export function Bars(): JSX.Element | null {
  const n = notDone.value, waits = kept.value.filter((k) => k.state !== 'refused').length;
  if (n && n.tone === 'failed') {
    return (
      <Notice kind="failed" action={n.retry ? { label: 'Try again', on: n.retry } : undefined}>
        <b>{n.text}</b>{n.code && <><br /><span>code <b class="mono">{n.code}</b></span></>}
      </Notice>
    );
  }
  if (!online.value || waits > 0) {
    return (
      <Notice kind="offline" action={{ label: 'Try again', on: () => { void flush(); } }}>
        No signal · it sends when back{waits > 0 && <> · <b class="mono">{waits}</b> waiting</>}
      </Notice>
    );
  }
  if (n && n.tone === 'someone') return <Notice kind="someone">{n.text}</Notice>;
  return null;
}

function View(p: { id: string; params: Record<string, unknown>; k: number }): JSX.Element {
  const s = screen(p.id);
  if (!s) return <main class="ow-missing">No screen “{p.id}”</main>;
  const V = s.view;
  return <V key={p.k} params={p.params as never} />;
}

export function App(): JSX.Element {
  const ph = phase.value;
  if (ph === 'starting') return <div class="ow-frame"><Loading /></div>;
  const early = ph === 'login' ? 'shell/sign-in' : ph === 'no-reach' ? 'shell/no-reach' : null;
  if (early) return <div class="ow-frame"><View id={early} params={{}} k={0} /><SheetHost /><ToastHost above={0} /></div>;
  const t = top.value, bar = showTabBar.value, u = under.value, s = screen(t.id), n = waiting.value.length;
  return (
    <div class={'ow-frame' + (bar ? ' with-bar' : '')}>
      {isSheet.value && <View id={u.id} params={u.params} k={u.key} />}
      <View id={t.id} params={t.params} k={t.key} />
      {(!s || s.bars !== false) && <div class={'mg-bars' + (bar ? ' above-bar' : '')}><Bars /></div>}
      {bar && (
        <TabBar<Tab> items={ITEMS} active={barTab.value as Tab | null} waiting={0} notPlaced={n} plusIcon={books.value && !n ? 'check' : 'plus'}
          plusOff={books.value ? undefined : 'not loaded yet'} plusLabel={n ? 'Decide next' : 'Nothing waits on you'} plusCountWord="waiting on you"
          onTab={(x) => nav.tab(x)} onPlus={decideNext} />
      )}
      <SheetHost />
      <ToastHost above={bar ? 84 : 0} />
    </div>
  );
}
