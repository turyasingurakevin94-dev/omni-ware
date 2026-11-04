/*
 * A screen of a tab whose file is still on its way (tabs.ts): the canvas's
 * loading state (P25, as built on CU08 and CH07), never a blank screen. The
 * real layout's head with its words, the figures and rows as shimmer, and
 * the ring with what is coming. With no signal and the file not on the
 * phone yet: say so, and Try again.
 */
import type { JSX } from 'preact';
import { Button } from '../../../ui/Button.tsx';
import { Notice } from '../../../ui/Notice.tsx';
import { LoadingHead, Shim, SkeletonRows } from '../../../ui/Skeleton.tsx';
import { failed, loadTab, tabOfId } from './tabs.ts';
import { top } from './nav.ts';
import type { ScreenProps, TabId } from './types.ts';
import './loading.css';

const WORD: Partial<Record<TabId, [string, string]>> = {
  chats: ['Chats', 'Getting your chats'],
  sell: ['New sale', 'Getting the shop list'],
  counter: ['Counter sale', 'Getting the shop list'],
  orders: ['Orders', 'Getting your orders'],
  customers: ['Customers', 'Getting your customers'],
};

export function Loading(_p: ScreenProps): JSX.Element {
  const t = tabOfId(top.value.id) as TabId, w = WORD[t] || ['', 'Getting it'];
  return (
    <main class="ow-loadtab" aria-busy="true">
      <header class="ow-loadtab-head">
        <h1>{w[0]}</h1>
        <Shim w={150} h={26} navy />
        <Shim w="100%" h={46} navy r={14} />
      </header>
      {failed.value === t ? (
        <div class="ow-loadtab-body">
          <Notice kind="offline">No signal · this part of the app is not on the phone yet</Notice>
          <Button kind="ghost" icon="undo" onClick={() => { void loadTab(t).catch(() => undefined); }}>Try again</Button>
        </div>
      ) : (
        <div class="ow-loadtab-body">
          <LoadingHead text={w[1]} />
          <SkeletonRows rows={5} />
        </div>
      )}
    </main>
  );
}
