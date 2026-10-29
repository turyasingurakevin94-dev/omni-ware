/*
 * Local variants for the lead to fold into src/ui:
 *   ActBar  P21 with the order's own disc tints: Change is #F1EEE8 with #5F6980 ink (the part's
 *           "plain" is ink #1C2233), and a control is a <button> unless it really goes somewhere.
 *   Tiles   P19 with the old figure struck on its own line under the new one (OR13) and a waiting
 *           dot before the key (OR22 "Credit asked"); class for class the part's otherwise.
 */
import type { JSX } from 'preact';
import { Duo, Icon, type IconName } from '../../../ui/icons.tsx';
import type { MoneyTile } from '../../../ui/MoneyTiles.tsx';
import { fig } from '../../../ui/Money.tsx';
import { cx } from '../../../ui/util.tsx';
import '../../../ui/acttiles.css';
import '../../../ui/moneytiles.css';

export interface Act { bg: string; fg: string; icon?: IconName; duo?: string; word: string; sub?: string; on?: () => void; href?: string; label?: string }

export function ActBar(p: { acts: Act[] }): JSX.Element {
  return (
    <div class="ow-actbar">
      {p.acts.map((a, i) => {
        const inner = (
          <>
            <span aria-hidden="true" class="ow-act-disc" style={{ background: a.bg, color: a.fg }}>{a.duo ? <Duo i={a.duo} size={19} /> : a.icon && <Icon name={a.icon} size={19} />}</span>
            <span class="ow-act-w">{a.word}</span>
            {a.sub && <span class="ow-act-s">{a.sub}</span>}
          </>
        );
        return a.href
          ? <a key={i} href={a.href} aria-label={a.label} class="ow-act">{inner}</a>
          : <button key={i} type="button" aria-label={a.label} class="ow-act or-act-b" onClick={a.on}>{inner}</button>;
      })}
    </div>
  );
}

export type Tile = MoneyTile & { struck?: boolean; dot?: boolean };

export function Tiles(p: { tiles: Tile[] }): JSX.Element {
  return (
    <div class="ow-mtiles">
      {p.tiles.map((t, i) => (
        <div key={i} class={cx('ow-mtile', t.tone && 't-' + t.tone)}>
          <span class="ow-mtile-k">{t.dot ? <span class="or-kdot"><span aria-hidden="true" />{t.k}</span> : t.k}</span>
          <span class="ow-mtile-v"><span class="mono">{fig(t.v)}</span></span>
          {t.old != null && <s class="mono or-old">{fig(t.old)}</s>}
          {t.note && <span class="ow-mtile-n">{t.note}</span>}
        </div>
      ))}
    </div>
  );
}
