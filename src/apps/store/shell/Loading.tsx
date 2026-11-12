/*
 * A screen of an area whose file is still on its way (shell/areas.ts): the loading state
 * (P25, as Sales draws it: src/apps/sales/shell/Loading.tsx and its loading.css), never a
 * blank screen. A stage sheet keeps its head and rail; a pushed screen a navy head. With no
 * signal and the file not on the phone yet: say so, and Try again.
 */
import type { JSX } from 'preact';
import { Button } from '../../../ui/Button.tsx';
import { Notice } from '../../../ui/Notice.tsx';
import { LoadingHead, Shim, SkeletonRows } from '../../../ui/Skeleton.tsx';
import '../../sales/shell/loading.css';
import { failed, loadArea, type LazyArea } from './areas.ts';
import type { ScreenDef } from './nav.ts';
import { route } from './routes.ts';
import { StageSheet } from './StageSheet.tsx';

export const STAGE_TITLE: Record<string, string> = { pack: 'To pack', in: 'Coming in', 'out/load': 'To load', 'out/road': 'On the road' };
const WORD: Record<LazyArea, string> = { pack: 'Getting the orders', in: 'Getting what is coming', shelf: 'Getting the shelves', out: 'Getting the runs' };

function Body(p: { a: LazyArea }): JSX.Element {
  return failed.value === p.a ? (
    <div class="ow-loadtab-body">
      <Notice kind="offline">No signal · this part of the app is not on the phone yet</Notice>
      <Button kind="ghost" icon="undo" onClick={() => { void loadArea(p.a).catch(() => undefined); }}>Try again</Button>
    </div>
  ) : (
    <div class="ow-loadtab-body"><LoadingHead text={WORD[p.a]} /><SkeletonRows rows={4} /></div>
  );
}

/** What stands in for route `id` of area `a` until its file is here. */
export function loading(id: string, a: LazyArea): ScreenDef {
  if (route(id)?.kind === 'stage') return { view: () => <StageSheet id={id} title={STAGE_TITLE[id] || id}><Body a={a} /></StageSheet> };
  return {
    view: () => (
      <main class="ow-loadtab" aria-busy="true">
        <header class="ow-loadtab-head"><Shim w={150} h={26} navy /><Shim w="100%" h={46} navy r={14} /></header>
        <Body a={a} />
      </main>
    ),
  };
}
