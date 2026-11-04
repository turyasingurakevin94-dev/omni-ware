/*
 * P19 · The 2-up money tiles (LANGUAGE.md §3 P19; as built: OR07). Left
 * white with the hairline (the key, the figure, a note); right in a tone
 * soft that says the state.
 *
 *   <MoneyTiles tiles={[
 *     { k: 'Kato pays', v: 1810000, note: '2 lines' },
 *     { k: 'Not paid yet', v: 1810000, note: 'leaves when paid', tone: 'warn' }]} />
 *   { k: 'Kato pays', v: 1750000, old: 1810000 }          OR13: the figure it was, struck, on its own line under
 *   { k: 'Credit asked', v: …, dot: true }                OR22: a waiting dot before the key
 *   { k: 'Invoice', v: 1505000, struck: true, pill: 'Void' }   OR29: the figure struck, with its pill
 *   { …, on: open, label: 'Paid over: fix it' }           OR27: a button, a chevron at its top right
 *
 * Tones for Sales: good (Paid, Deposit), warn (Not paid yet, Owes), info (Being checked).
 */
import type { ComponentChildren, JSX } from 'preact';
import { Icon } from './icons.tsx';
import { fig } from './Money.tsx';
import { OrderPill } from './StageGroup.tsx';
import { cx, type Fig } from './util.tsx';
import './moneytiles.css';

export interface MoneyTile {
  k: string;
  v: Fig;
  note?: string;
  /** The figure it was, struck through on its own line (a price changed). */
  old?: Fig;
  tone?: 'good' | 'warn' | 'info';
  /** It waits on someone: a glowing dot before the key. */
  dot?: boolean;
  /** The figure itself struck (voided), with a pill beside it. */
  struck?: boolean;
  pill?: string;
  on?: () => void;
  label?: string;
}

const Box = (p: { t: MoneyTile; class: string; children: ComponentChildren }) => (p.t.on
  ? <button type="button" class={p.class + ' tap'} aria-label={p.t.label} onClick={p.t.on}>{p.children}<span aria-hidden="true" class="ow-mtile-ch"><Icon name="chevron-right" size={16} stroke={2.2} /></span></button>
  : <div class={p.class}>{p.children}</div>);

export function MoneyTiles(p: { tiles: MoneyTile[] }): JSX.Element {
  return (
    <div class="ow-mtiles">
      {p.tiles.map((t, i) => (
        <Box key={i} t={t} class={cx('ow-mtile', t.tone && 't-' + t.tone)}>
          <span class="ow-mtile-k">{t.dot ? <span class="ow-mtile-dot"><span aria-hidden="true" />{t.k}</span> : t.k}</span>
          <span class="ow-mtile-v">{t.struck ? <s class="mono">{fig(t.v)}</s> : <span class="mono">{fig(t.v)}</span>}{t.pill && <OrderPill tone="bad">{t.pill}</OrderPill>}</span>
          {t.old != null && <s class="mono ow-mtile-old">{fig(t.old)}</s>}
          {t.note && <span class="ow-mtile-n">{t.note}</span>}
        </Box>
      ))}
    </div>
  );
}
