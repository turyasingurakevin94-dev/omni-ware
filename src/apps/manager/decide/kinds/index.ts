/*
 * Every decision kind the Decide sheet draws (kit.ts), by Ask kind. A kind not here draws a stand-in.
 * Each kind file exports `kind: Kind<ThatAsk>`; `reg` widens it for the sheet (the sheet only ever
 * passes a kind its own Ask).
 */
import type { Ask, AskKind } from '../../../../core/manager/types.ts';
import type { Kind } from '../kit.ts';
import { kind as agent } from './agent.tsx';
import { kind as bill } from './bill.tsx';
import { kind as cancel } from './cancel.tsx';
import { kind as carton } from './carton.tsx';
import { kind as checkin } from './checkin.tsx';
import { kind as count } from './count.tsx';
import { kind as extra } from './extra.tsx';
import { kind as given } from './given.tsx';
import { kind as loss } from './loss.tsx';
import { kind as ret } from './return.tsx';
import { kind as short } from './short.tsx';
import { kind as voidK } from './void.tsx';

import { kind as price } from './price.tsx'; // PC-TMP
import { kind as counter } from './counter.tsx'; // PC-TMP
import { kind as markup } from './markup.tsx'; // PC-TMP
import { kind as credit } from './credit.tsx'; // PC-TMP
import { kind as storecredit } from './storecredit.tsx'; // PC-TMP
import { kind as limit } from './limit.tsx'; // PC-TMP

function reg<A extends Ask>(k: Kind<A>): Kind { return k as unknown as Kind; }

export const KINDS: Partial<Record<AskKind, Kind>> = {
  short: reg(short),
  price: reg(price), counter: reg(counter), markup: reg(markup), credit: reg(credit), storecredit: reg(storecredit), limit: reg(limit), // PC-TMP
  loss: reg(loss), carton: reg(carton), checkin: reg(checkin), extra: reg(extra), count: reg(count),
  cancel: reg(cancel), return: reg(ret), void: reg(voidK), given: reg(given), agent: reg(agent), bill: reg(bill),
};
