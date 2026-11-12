/*
 * D-15 Not on the list · keep it? (DecideStock p4 + "error"): on the truck, the list's tiles and
 * the extra ones dashed; the supplier and its cost; the two answer tiles. Keep it (a tap) puts
 * them on the shelf at cost; It goes back sends them back next trip.
 */
import { money } from '../../../../core/money.ts';
import { extraValue, unitOne, units } from '../../../../core/manager/decide-stock.ts';
import type { ExtraAsk } from '../../../../core/manager/types.ts';
import { ANSWER } from '../../../../core/manager/words.ts';
import { initials } from '../../../../core/names.ts';
import { Icon } from '../../../../ui/icons.tsx';
import type { Kind } from '../kit.ts';
import './stock.css';

const TILES = 44;

export const kind: Kind<ExtraAsk> = (c) => {
  const a = c.a, v = extraValue(a), one = unitOne(a.unit), u = units(a.qty, one);
  const all = a.onList + a.qty, n = Math.min(all, TILES), extra = Math.max(1, Math.round((a.qty / all) * n));
  const keep = v == null ? ANSWER.keepIt : `${ANSWER.keepIt} · ${money(v)}`;
  const place = a.from.split(' ')[0];
  return {
    chip: { text: `${a.qty} ${u} more than the list`, tone: 'amber' },
    evidence: (
      <>
        <div class="mg-card">
          <div class="mg-card-h"><b class="mg-sk-h">On the truck</b><span class="mg-mono mg-soft">{`${a.name} · ${units(2, one)}`}</span></div>
          <span class="mg-sk-truck" role="img" aria-label={`${a.onList} ${units(a.onList, u)} on the list, ${all} on the truck: ${a.qty} extra`}>
            {Array.from({ length: n }, (_, i) => <i key={i} class={i >= n - extra ? 'x' : ''} />)}
          </span>
          <div class="mg-sk-ends">
            <span><span class="k"><i />On the list</span><b class="mg-mono">{a.onList}</b></span>
            <span class="r"><span class="k w"><i class="x" />Not on the list</span><b class="mg-mono w">{`+${a.qty}`}</b></span>
          </div>
          <hr class="mg-sk-hr" />
          <span class="mg-sk-sup"><i>{initials(a.from)}</i>{a.from}{a.cost != null && <> · <b class="mg-mono">{money(a.cost)}</b> a {one}</>}</span>
        </div>
        <div class="mg-sk-two">
          <div class="mg-sk-out"><span class="h"><i class="good"><Icon name="shelf" size={15} stroke={2} /></i>{ANSWER.keepIt}</span>
            <b class="mg-mono">{`+${a.qty} · ${v == null ? 'cost not known' : money(v)}`}</b><span class="s">on the shelf, at cost</span></div>
          <div class="mg-sk-out"><span class="h"><i><Icon name="undo" size={15} stroke={2} /></i>{ANSWER.goesBack}</span>
            <b class="mg-mono">{`${a.qty} · back`}</b><span class="s">{`to ${place}, next trip`}</span></div>
        </div>
      </>
    ),
    dock: {
      told: [a.askerId || ''],
      word: ANSWER.keepIt,
      primary: { tap: { label: keep, on: () => c.tap(keep, 'extra', [a.askId, true]) } },
      secondary: { label: ANSWER.goesBack, on: () => c.tap(ANSWER.goesBack, 'extra', [a.askId, false]) },
    },
  };
};
