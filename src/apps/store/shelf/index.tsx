/*
 * The shelf area's screens (docs/spec/04-screens-store-routes.md §2): shelf (tab), shelf/aisle, shelf/find,
 * shelf/scan, shelf/item, shelf/count, shelf/report, shelf/ask. See src/apps/store/README.md.
 *
 * Every screen here draws its own "No signal" and "That did not save" where the board puts them (bars: false).
 */
import type { ScreenDef } from '../shell/nav.ts';
import { Aisle } from './Aisle.tsx';
import { Ask } from './Ask.tsx';
import { Count } from './Count.tsx';
import { Find } from './Find.tsx';
import { Item } from './Item.tsx';
import { Report } from './Report.tsx';
import { Scan } from './Scan.tsx';
import { Shelf } from './Shelf.tsx';

export const screens: Record<string, ScreenDef> = {
  shelf: { view: () => <Shelf />, bars: false },
  'shelf/aisle': { view: ({ params }) => <Aisle params={params} />, bars: false },
  'shelf/find': { view: ({ params }) => <Find params={params} />, bars: false },
  'shelf/scan': { view: ({ params }) => <Scan params={params} />, bars: false },
  'shelf/item': { view: ({ params }) => <Item params={params} />, bars: false },
  'shelf/count': { view: ({ params }) => <Count params={params} />, bars: false },
  'shelf/report': { view: ({ params }) => <Report params={params} />, bars: false },
  'shelf/ask': { view: ({ params }) => <Ask params={params} />, bars: false },
};
