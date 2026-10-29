/*
 * P19 · The 2-up money tiles (LANGUAGE.md §3 P19; as built: OR07). Left
 * white with the hairline (the key, the figure, a note or an old figure
 * struck through); right in a tone soft that says the state.
 *
 *   <MoneyTiles tiles={[
 *     { k: 'Kato pays', v: 1810000, note: '2 lines' },
 *     { k: 'Not paid yet', v: 1810000, note: 'leaves when paid', tone: 'warn' }]} />
 *
 * Tones for Sales: good (Paid, Deposit), warn (Not paid yet, Owes), info (Being checked).
 */
import type { JSX } from 'preact';
import { fig } from './Money.tsx';
import { Tap, cx, type Fig } from './util.tsx';
import './moneytiles.css';

export interface MoneyTile {
  k: string;
  v: Fig;
  note?: string;
  /** The figure it was, struck through (a price changed). */
  old?: Fig;
  tone?: 'good' | 'warn' | 'info';
  on?: () => void;
}

export function MoneyTiles(p: { tiles: MoneyTile[] }): JSX.Element {
  return (
    <div class="ow-mtiles">
      {p.tiles.map((t, i) => {
        const body = (
          <>
            <span class="ow-mtile-k">{t.k}</span>
            <span class="ow-mtile-v"><span class="mono">{fig(t.v)}</span>{t.old != null && <s class="mono">{fig(t.old)}</s>}</span>
            {t.note && <span class="ow-mtile-n">{t.note}</span>}
          </>
        );
        const c = cx('ow-mtile', t.tone && 't-' + t.tone);
        return t.on ? <Tap key={i} on={t.on} class={c}>{body}</Tap> : <div key={i} class={c}>{body}</div>;
      })}
    </div>
  );
}
