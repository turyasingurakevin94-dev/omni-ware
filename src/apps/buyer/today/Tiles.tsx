/*
 * On the move (board Today): four tiles in one white card, To ask (dashed) · Asked ·
 * Found · On the trip. A red need badge when it waits on Denis: suppliers to ask, and
 * found suppliers once every supplier is asked and no trip is running (tripReady: the trip waits on him). Found waiting is
 * tinted green. To ask opens Orders, Asked opens Replies, Found and On the trip open the trip.
 *
 * The shared StageTiles draw the order stages (Checking · Buying …); these are the
 * Buyer's line states, so the card is drawn here.
 */
import type { JSX } from 'preact';
import { WORD, tiles } from '../../../core/buyer/rules.ts';
import type { BuyerBooks } from '../../../core/buyer/types.ts';
import { Icon, type IconName } from '../../../ui/icons.tsx';
import { cx } from '../../../ui/util.tsx';
import { nav } from '../shell/nav.ts';
import { tripReady } from './rules.ts';

interface Tile { key: string; word: string; icon: IconName; n: number; need: number; unit: string; on: () => void }

export function MoveTiles(p: { b: BuyerBooks; now: number }): JSX.Element {
  const t = tiles(p.b, p.now), ready = tripReady(p.b, p.now);
  const list: Tile[] = [
    { key: 'toask', word: WORD.toask, icon: 'message', n: t.toask, need: t.toask, unit: 'supplier', on: () => nav.push('orders', { filter: t.toask ? 'toask' : 'all' }) },
    { key: 'asked', word: WORD.asked, icon: 'clock', n: t.asked, need: 0, unit: 'supplier', on: () => nav.push('replies') },
    { key: 'found', word: WORD.found, icon: 'check', n: t.found, need: ready ? t.found : 0, unit: 'supplier', on: () => nav.push('trip') },
    { key: 'ontrip', word: WORD.ontrip, icon: 'truck', n: t.ontrip, need: 0, unit: 'line', on: () => nav.push('trip') },
  ];
  return (
    <div class="ow-b-today-tiles">
      {list.map((x) => {
        const label = x.n === 0 ? `${x.word}: none`
          : `${x.word}: ${x.n} ${x.unit}${x.n === 1 ? '' : 's'}${x.need ? (x.key === 'found' ? ' ready to buy, waits on you' : ', waits on you') : ''}`;
        return (
          <button key={x.key} type="button" aria-label={label} onClick={x.on}
            class={cx('ow-b-today-tile', x.key === 'toask' && 'dash', x.key === 'found' && x.need > 0 && 'good', x.n === 0 && 'zero')}>
            <span class="ow-b-today-tile-n"><Icon name={x.icon} size={15} stroke={2} /><b class="mono">{x.n}</b></span>
            <span class="ow-b-today-tile-l">{x.word}</span>
            {x.need > 0 && <span aria-hidden="true" class="mono ow-b-today-tile-need">{x.need}</span>}
          </button>
        );
      })}
    </div>
  );
}
