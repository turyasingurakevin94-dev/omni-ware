/*
 * The pack area's screens (docs/spec/04-screens-store-routes.md §2): pack (stage sheet), pack/order, pack/look, pack/put-back.
 * A stage sheet's screen is drawn inside shell/StageSheet.tsx. See src/apps/store/README.md.
 *
 *   pack            ToPack.tsx      PK01 · PK08 · PK13 · PK14 · PK20 (and PK21's way in)
 *   pack/order      Pack.tsx        PK02 · PK03 · PK18 · PK11 · PK12 · PK04 · PK16 · PK19 · PK05 · PK06 · PK07 · PK15 · PK21
 *   pack/look       Look.tsx        PK09 · PK17
 *   pack/put-back   PutBack.tsx     PK10 · PK22
 * Each draws its own bars (the notice at the top of its body, the not-done card in its dock's place).
 */
import type { ScreenDef } from '../shell/nav.ts';
import { Look } from './Look.tsx';
import { Pack } from './Pack.tsx';
import { PutBack } from './PutBack.tsx';
import { ToPack } from './ToPack.tsx';

const num = (v: unknown): number | null => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

export const screens: Record<string, ScreenDef> = {
  pack: { view: ({ params }) => <ToPack first={num(params.first)} />, bars: false },
  'pack/order': { view: ({ params }) => <Pack id={Number(params.id)} line={num(params.line)} />, bars: false },
  'pack/look': { view: ({ params }) => <Look id={Number(params.id)} />, bars: false },
  'pack/put-back': { view: ({ params }) => <PutBack id={Number(params.id)} />, bars: false },
};
