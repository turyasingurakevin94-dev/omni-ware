/*
 * Local variants for the lead to fold into src/ui:
 *   ActBar  P21 with the order's own disc tints: Change is #F1EEE8 with #5F6980 ink (the part's
 *           "plain" is ink #1C2233), and a control is a <button> unless it really goes somewhere.
 *   Tiles   P19 with the old figure struck on its own line under the new one (OR13), a waiting
 *           dot before the key (OR22 "Credit asked"), and a struck figure with its pill (OR29's
 *           void), a note ending in warn ink (OR32's "54 days"); class for class the part's otherwise.
 */
import type { ComponentChildren, JSX } from 'preact';
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

const Box = (p: { on?: () => void; label?: string; class: string; children: ComponentChildren }) => (p.on ? <button type="button" class={p.class} aria-label={p.label} onClick={p.on}>{p.children}<span aria-hidden="true" class="or-tap-ch"><Icon name="chevron-right" size={16} stroke={2.2} /></span></button> : <div class={p.class}>{p.children}</div>);

export type Tile = MoneyTile & { struck?: boolean; pill?: string; dot?: boolean; label?: string; warnNote?: string };

export function Tiles(p: { tiles: Tile[] }): JSX.Element {
  return (
    <div class="ow-mtiles">
      {p.tiles.map((t, i) => (
        <Box key={i} on={t.on} label={t.label} class={cx('ow-mtile', t.tone && 't-' + t.tone, t.on && 'or-tap')}>
          <span class="ow-mtile-k">{t.dot ? <span class="or-kdot"><span aria-hidden="true" />{t.k}</span> : t.k}</span>
          <span class="ow-mtile-v">{t.struck ? <s class="mono or-struck">{fig(t.v)}</s> : <span class="mono">{fig(t.v)}</span>}{t.pill && <span class="or-crow-p bad">{t.pill}</span>}</span>
          {t.old != null && <s class="mono or-old">{fig(t.old)}</s>}
          {t.note && <span class="ow-mtile-n">{t.note}{t.warnNote && <>{' · '}<span class="or-warn-n">{t.warnNote}</span></>}</span>}
        </Box>
      ))}
    </div>
  );
}
