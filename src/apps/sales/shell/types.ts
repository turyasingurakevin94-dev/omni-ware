/*
 * What a tab module gives the shell. Each tab folder's index.tsx exports one
 * `tab: TabModule`; shell/tabs.ts imports exactly the six, so adding a screen
 * never touches a shared file.
 */
import type { ComponentType } from 'preact';

/** The six folders. today, chats, orders and customers are on the bar; sell is the red +; counter is reached from them. */
export type TabId = 'today' | 'chats' | 'sell' | 'counter' | 'orders' | 'customers';

/** Anything a screen is opened with: an order id, a customer id, a filter. Plain data only. */
export type Params = Record<string, string | number | boolean | null>;

export interface ScreenProps {
  params: Params;
}

export interface ScreenDef {
  view: ComponentType<ScreenProps>;
  /** Show the tab bar under this screen. Default: only a bar tab's root (the canvas draws it on those alone). */
  tabBar?: boolean;
}

export interface TabModule {
  id: TabId;
  /** The screen the tab opens on. */
  root: string;
  /**
   * The tab's screens, by id. Ids are global: prefix them with the tab ("orders/order").
   * The root's id is the tab id itself ("orders").
   */
  screens: Record<string, ScreenDef>;
}
