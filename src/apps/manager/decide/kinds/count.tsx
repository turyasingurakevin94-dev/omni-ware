/*
 * D-17 A count to check (DecideStock "default · D-17"): the count's tiles (match green, differ
 * amber) with the net at cost, then each line that differs (system → counted, at cost). The slide
 * Count taken books the count; Count it again (a tap) sends Musa back to count.
 */
import { signed } from '../../../../core/money.ts';
import { count } from '../../../../core/manager/decide-stock.ts';
import type { CountAsk } from '../../../../core/manager/types.ts';
import { ANSWER, askWord } from '../../../../core/manager/words.ts';
import { online } from '../../shell/store.ts';
import type { Kind } from '../kit.ts';
import './stock.css';

export const kind: Kind<CountAsk> = (c) => {
  const a = c.a, k = count(a);
  const tone = (v: number) => (v < 0 ? 'bad' : v > 0 ? 'good' : '');
  return {
    title: `${askWord('count')} · ${a.aisle}`,
    evidence: (
      <>
        <div class="mg-card">
          <div class="mg-sk-cnt">
            <span class="mg-sk-cnt-t" role="img" aria-label={`${k.rows.length} items: ${k.rows.length - k.differ.length} agree, ${k.differ.length} differ`}>
              {[...k.rows].sort((x, y) => Number(x.counted !== x.system) - Number(y.counted !== y.system)).map((r) => <i key={r.key} class={r.counted !== r.system ? 'x' : ''} />)}
            </span>
            <b class={'mg-mono mg-sk-cnt-n ' + tone(k.net)}>{signed(k.net)}</b>
          </div>
          <span class="mg-sk-legend"><span><i class="m" /><b class="mg-mono">{k.rows.length - k.differ.length}</b> agree</span><span><i class="a" /><b class="mg-mono">{k.differ.length}</b> differ</span><span>net at cost</span></span>
        </div>
        {k.differ.length > 0 && (
          <div class="mg-card mg-sk-cl">
            {k.differ.map((r) => (
              <div key={r.key} class="mg-sk-cl-r"><b>{r.name}</b><span class="mg-mono">{`${r.system} → ${r.counted}`}</span><b class={'mg-mono ' + tone(r.value)}>{signed(r.value)}</b></div>
            ))}
          </div>
        )}
      </>
    ),
    dock: {
      told: [a.askerId || ''],
      word: ANSWER.countTaken,
      primary: {
        slide: {
          label: ANSWER.countTaken,
          on: () => c.slide(ANSWER.countTaken, 'countTaken', [a.countId]),
          disabled: !online.value ? 'Count needs signal' : undefined,
        },
      },
      secondary: { label: ANSWER.countAgain, on: () => c.tap(ANSWER.countAgain, 'countAgain', [a.countId]) },
    },
  };
};
