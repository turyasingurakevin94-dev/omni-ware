/*
 * The Store's frame (routes §1): the top screen (a stage sheet over the screen under it),
 * the bar Today · red Next job · Shelf, the Not done bars, the sheet host and the toast host.
 *
 * The bars (spec §4.8, BRIEF "No signal"), above the tab bar unless the screen draws its own
 * (ScreenDef.bars === false: a flow with a dock places them over its dock, IN08):
 *   amber   no signal, or writes waiting to send: "No signal · 2 waiting to send" · white Try again
 *   red     "That did not save · tell Kevin" / "code CI-502 · your work is kept" · navy Try again
 *   blue    "Someone else just did this · Refreshed"
 */
import { effect } from '@preact/signals';
import type { JSX } from 'preact';
import { Notice } from '../../../ui/Notice.tsx';
import { SheetHost } from '../../../ui/sheet.tsx';
import { TabBar, type BarItem } from '../../../ui/TabBar.tsx';
import { toast, ToastHost } from '../../../ui/toast.tsx';
import { barTab, isStage, nav, screen, showTabBar, top, under, type Tab } from './nav.ts';
import { nextJob, ready } from './next-job.ts';
import { books, flush, held, kept, notDone, online, phase, undoHeld } from './store.ts';
import './prefs.ts';

const ITEMS: BarItem<Tab>[] = [{ id: 'today', word: 'Today', icon: 'today' }, { id: 'shelf', word: 'Shelf', icon: 'shelf' }];

// A write waiting its 10 s shows as the P28 toast with Undo.
effect(() => { const h = held.value; if (h && !h.quiet) toast.show(h.label, { undo: undoHeld, ms: Math.max(0, h.until - Date.now()) }); });

function startNext(): void {
  const j = nextJob.value;
  if (j) nav.push(j.route, j.params);
  else toast.show('Nothing to do now', { kind: 'ok' });
}

export function Bars(): JSX.Element | null {
  const waiting = kept.value.filter((k) => k.state !== 'refused').length, n = notDone.value;
  if (n && n.tone === 'failed') {
    return (
      <Notice kind="failed" action={n.retry ? { label: 'Try again', on: n.retry } : undefined}>
        <b class="st-bad">{n.text}</b>{n.code && <><br /><span class="st-code">code <b class="mono">{n.code}</b>{/^Could not load/.test(n.text) ? '' : ' · your work is kept'}</span></>}
      </Notice>
    );
  }
  if (!online.value || waiting > 0) {
    return (
      <Notice kind="offline" action={{ label: 'Try again', on: () => { void flush(); } }}>
        No signal{waiting > 0 && <> · <b class="mono">{waiting}</b> waiting to send</>}
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
  if (ph === 'starting') return <main class="ow-frame" aria-busy="true" />;
  if (ph === 'login') return <div class="ow-frame"><View id="shell/sign-in" params={{}} k={0} /></div>;
  if (ph === 'checking') return <div class="ow-frame"><View id="shell/checking" params={{}} k={0} /></div>;
  if (ph === 'no-reach') return <div class="ow-frame"><View id="shell/no-reach" params={{}} k={0} /></div>;
  const t = top.value, bar = showTabBar.value, u = under.value, s = screen(t.id);
  return (
    <div class={'ow-frame' + (bar ? ' with-bar' : '')}>
      {isStage.value && <View id={u.id} params={u.params} k={u.key} />}
      <View id={t.id} params={t.params} k={t.key} />
      {(!s || s.bars !== false) && <div class={'st-bars' + (bar ? ' above-bar' : '')}><Bars /></div>}
      {bar && (
        <TabBar<Tab> items={ITEMS} active={barTab.value} waiting={0} notPlaced={ready.value} plusIcon="play" plusOff={books.value ? undefined : 'not loaded yet'}
          plusLabel="Start the next job" plusCountWord="ready now" onTab={(x) => nav.tab(x)} onPlus={startNext} />
      )}
      <SheetHost />
      <ToastHost above={bar ? 84 : 0} />
    </div>
  );
}
