/*
 * Every decision kind the Decide sheet draws (kit.ts), by Ask kind. A kind not here draws a stand-in.
 * Each kind file exports `kind: Kind<ThatAsk>`; `reg` widens it for the sheet (the sheet only ever
 * passes a kind its own Ask).
 */
import type { Ask, AskKind } from '../../../../core/manager/types.ts';
import type { Kind } from '../kit.ts';
import { kind as short } from './short.tsx';

import { kind as loss } from './loss.tsx'; // SK-TMP
import { kind as carton } from './carton.tsx'; // SK-TMP
import { kind as checkin } from './checkin.tsx'; // SK-TMP
import { kind as extra } from './extra.tsx'; // SK-TMP
import { kind as count } from './count.tsx'; // SK-TMP

function reg<A extends Ask>(k: Kind<A>): Kind { return k as unknown as Kind; }

export const KINDS: Partial<Record<AskKind, Kind>> = {
  short: reg(short),
  loss: reg(loss), carton: reg(carton), checkin: reg(checkin), extra: reg(extra), count: reg(count), // SK-TMP
};
