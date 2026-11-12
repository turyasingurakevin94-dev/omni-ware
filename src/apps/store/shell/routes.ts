/*
 * The Store's routes: one id per board family of the approved canvas
 * (docs/spec/04-screens-store-routes.md §2, 33 ids for 148 boards: 142 approved, AD01–AD06 added while building). The table is
 * the one place an id, its area, its kind, its params and its boards are written:
 * the shell draws a placeholder for every id an area has not built yet, the push
 * map (pushes.ts) opens only ids that are here, and test/store-shell.test.js checks
 * this table against the spec.
 *
 * Kinds (routes §1):
 *   tab      a tab root, with the bar (today, shelf)
 *   stage    a stage sheet over Today, with the rail Coming in · To pack · To load · On the road · Delivered
 *   pushed   one job on screen; Back walks the stack
 *   full     full screen, no bar (sign-in and boot)
 */
export type Area = 'shell' | 'today' | 'pack' | 'in' | 'shelf' | 'out';
export type Kind = 'tab' | 'stage' | 'pushed' | 'full';

export interface Route {
  id: string;
  area: Area;
  kind: Kind;
  /** The params it takes, as the spec writes them ('' for none). */
  params: string;
  /** The default board first, then its states. */
  boards: string[];
}

const r = (id: string, area: Area, kind: Kind, params: string, boards: string): Route => ({ id, area, kind, params, boards: boards.split(' ') });

export const ROUTES: Route[] = [
  r('shell/sign-in', 'shell', 'full', '', 'TD20 TD23 TD31'),
  r('shell/checking', 'shell', 'full', '', 'TD21'),
  r('shell/no-reach', 'shell', 'full', '', 'TD22'),

  r('today', 'today', 'tab', '', 'TD01 TD09 TD02 TD03 TD04 TD05 TD06 TD07 TD08 TD33 TD15 TD25 TD32'),
  r('today/alerts', 'today', 'pushed', '', 'TD10 TD29'),
  r('today/with-ruth', 'today', 'pushed', '', 'TD11 TD30'),
  r('today/you', 'today', 'pushed', '', 'TD12'),
  r('today/pass-yard', 'today', 'pushed', '{ to? }', 'TD13 TD18 TD14 TD24 TD26'),
  r('today/close-yard', 'today', 'pushed', '', 'TD16 TD19 TD17 TD27 TD28'),

  r('pack', 'pack', 'stage', '{ first? }', 'PK01 PK20 PK08 PK13 PK14 PK21'),
  r('pack/order', 'pack', 'pushed', '{ id, line?, unpack? }', 'PK02 PK03 PK18 PK11 PK12 PK04 PK16 PK19 PK05 PK06 PK07 PK15 AD02 AD05 AD06'),
  r('pack/look', 'pack', 'pushed', '{ id }', 'PK09 PK17'),
  r('pack/put-back', 'pack', 'pushed', '{ id }', 'PK10 PK22'),

  r('in', 'in', 'stage', '', 'IN01 IN40'),
  r('in/checkin', 'in', 'pushed', '{ trip }', 'IN02 IN03 IN04 IN16 IN05 IN06 IN07 IN08 IN09 IN13'),
  r('in/delivery', 'in', 'pushed', '{ trip }', 'IN10 IN11 IN14 IN12 IN15'),
  r('in/return', 'in', 'pushed', '{ order }', 'IN20 IN23 IN21 IN22 IN24 IN25'),
  r('in/ride', 'in', 'pushed', '{ trip? }', 'IN30 IN31 IN34 IN32 IN33 IN35'),

  r('shelf', 'shelf', 'tab', '', 'SH01 SH41 SH06'),
  r('shelf/aisle', 'shelf', 'pushed', '{ aisle }', 'SH04 SH05'),
  r('shelf/find', 'shelf', 'pushed', '{ q? }', 'SH02 SH42'),
  r('shelf/scan', 'shelf', 'pushed', "{ then?: 'item' | 'count' | 'report' | 'checkin' }", 'SH40'),
  r('shelf/item', 'shelf', 'pushed', '{ key }', 'SH03 SH16 SH22 SH24 SH32'),
  r('shelf/count', 'shelf', 'pushed', '{ key } or { aisle }', 'SH10 SH19 SH11 SH12 SH13 SH15 SH17 SH18 SH25 SH14'),
  r('shelf/report', 'shelf', 'pushed', "{ key, why?: 'damaged' | 'lost' | 'stolen' }", 'SH20 SH21 SH23 SH26 SH27'),
  r('shelf/ask', 'shelf', 'pushed', '{ key }', 'SH30 SH31'),

  r('out/load', 'out', 'stage', '', 'OU01 OU30'),
  r('out/run', 'out', 'pushed', '{ dir }', 'OU02 OU03 OU17 OU04 OU05 OU06 OU07 AD01 AD03 AD04'),
  r('out/gate', 'out', 'pushed', '{ id? }', 'OU10 OU08 OU12 OU13 OU15 OU16'),
  r('out/gate-code', 'out', 'pushed', '{ id? }', 'OU11 OU09'),
  r('out/road', 'out', 'stage', '', 'OU20 OU14 OU25 OU27'),
  r('out/door', 'out', 'pushed', '{ id }', 'OU21 OU26 OU22 OU23 OU28'),
  r('out/cant-deliver', 'out', 'pushed', '{ id }', 'OU24'),
];

export const route = (id: string): Route | undefined => ROUTES.find((x) => x.id === id);
export const isTab = (id: string): boolean => route(id)?.kind === 'tab';

/**
 * The stage sheets in the rail's order (PK01's rail: Coming in · To pack · To load · On the road · Delivered), and
 * their icons: the one place every stage sheet takes them from. To load is the stack PK01, OU01 and OU20 draw (IN01
 * draws a shelf); Coming in the shared arrow into a tray (IN01's; PK01 and OU01 draw it a little taller).
 */
export const RAIL: { word: string; id: string | null; icon: 'arrive' | 'orders' | 'layers' | 'truck' | 'delivered' }[] = [
  { word: 'Coming in', id: 'in', icon: 'arrive' },
  { word: 'To pack', id: 'pack', icon: 'orders' },
  { word: 'To load', id: 'out/load', icon: 'layers' },
  { word: 'On the road', id: 'out/road', icon: 'truck' },
  // Delivered has no sheet of its own: On the road's "Done today" lists it (OU20).
  { word: 'Delivered', id: null, icon: 'delivered' },
];
