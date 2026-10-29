/*
 * P03 · A page head, a tab's root (LANGUAGE.md §3 P03; as built: OR01,
 * CU01, CU03): the radial navy head, the title 26/800 with its count in
 * mint, glass icon buttons and one white add button, then ONE line of the
 * page's picture, then the search field on navy.
 *
 *   <PageHead title="Customers" count={38}
 *     actions={[{ icon: 'share', label: "Share the shop's price list", on: … }, { icon: 'person-plus', label: 'New customer', on: …, white: true }]}
 *     search={{ placeholder: 'Name, phone or place', label: 'Find a customer', value: q, onInput: setQ }}>
 *     <HeadStat amount={1910000} word="owed" pill="4 owe" bar={{ parts: […], legend: […], label: '…' }} />
 *   </PageHead>
 *
 * The pictures: HeadStat (P03a, with its owed bar), StageBar (P03b), WeekStrip (P03c).
 */
import type { ComponentChildren, JSX } from 'preact';
import { STAGES, TINTS } from '../core/names.ts';
import type { Stage } from '../core/types.ts';
import type { Face } from './Avatar.tsx';
import { SplitBar, type BarPart } from './Bar.tsx';
import { Icon, type IconName } from './icons.tsx';
import { fig } from './Money.tsx';
import { NavyPill } from './Pill.tsx';
import { Search, type SearchProps } from './Search.tsx';
import { cx, type Fig } from './util.tsx';
import './pagehead.css';

export interface HeadAction { icon: IconName; label: string; on: () => void; white?: boolean }

export interface PageHeadProps {
  title: string;
  count?: Fig;
  actions?: HeadAction[];
  search?: SearchProps;
  /** The page's one picture. */
  children?: ComponentChildren;
}

export function PageHead(p: PageHeadProps): JSX.Element {
  return (
    <header class="ow-phead">
      <div class="ow-phead-top">
        <h1>{p.title}{p.count != null && <span class="mono">{fig(p.count)}</span>}</h1>
        {(p.actions || []).map((a) => (
          <button key={a.label} type="button" class={cx('ow-phead-b', a.white && 'white')} aria-label={a.label} onClick={a.on}>
            <Icon name={a.icon} size={20} stroke={2} />
          </button>
        ))}
      </div>
      {p.children}
      {p.search && <Search {...p.search} tone="navy" />}
    </header>
  );
}

export interface HeadBarProps {
  parts: BarPart[];
  legend: { dot: string; text: string; b?: string }[];
  /** The bar's words for a screen reader. */
  label: string;
}

/** P03a · the stat line: "UGX 1,910,000 owed" and its pill, optionally a label above and a bar with a legend under. */
export function HeadStat(p: { amount: Fig; word?: string; label?: string; pill?: string; bar?: HeadBarProps }): JSX.Element {
  const fig0 = <span class="ow-hstat-fig"><span>UGX</span><span class="mono">{fig(p.amount)}</span>{p.word && <span class="w">{p.word}</span>}</span>;
  return (
    <div class="ow-hstat">
      <div class="ow-hstat-row">
        {p.label ? <span class="ow-hstat-col"><span class="ow-hstat-l">{p.label}</span>{fig0}</span> : fig0}
        {p.pill && <NavyPill tone="amber" small>{p.pill}</NavyPill>}
      </div>
      {p.bar && (
        <div class="ow-hstat-bar">
          <SplitBar parts={p.bar.parts.map((x) => ({ min: 6, ...x }))} label={p.bar.label} />
          <span aria-hidden="true" class="ow-hstat-legend">
            {p.bar.legend.map((l, i) => <span key={i}><span style={{ background: l.dot }} />{l.text}{l.b && <b class="mono">{l.b}</b>}</span>)}
          </span>
        </div>
      )}
    </div>
  );
}

/** Each stage's bar colour on navy (S05; Delivered is the quiet white). */
export const STAGE_BAR: Record<Stage, string> = { checking: '#F5B26B', buying: '#9DB7E0', packing: '#7FA2D6', road: '#6FDCB0', delivered: 'rgba(255,255,255,.22)' };
const SHORT: Record<Stage, string> = { checking: 'checking', buying: 'buying', packing: 'packing', road: 'road', delivered: 'done' };
const LONG: Record<Stage, string> = { checking: 'checking', buying: 'buying', packing: 'packing', road: 'on the road', delivered: 'delivered this week' };

/** P03b · how many orders at each stage, as one segmented bar with its legend (widths are the counts). */
export function StageBar(p: { counts: Record<Stage, number> }): JSX.Element {
  const total = STAGES.reduce((a, s) => a + p.counts[s], 0);
  return (
    <div class="ow-stagebar" role="img" aria-label={`${total} orders: ${STAGES.map((s) => `${p.counts[s]} ${LONG[s]}`).join(', ')}`}>
      <SplitBar parts={STAGES.map((s) => ({ value: p.counts[s], color: STAGE_BAR[s] }))} />
      <span aria-hidden="true" class="ow-stagebar-l">
        {STAGES.map((s) => <span key={s} class={s === 'checking' ? 'amber' : s === 'road' ? 'mint' : undefined}>{`${p.counts[s]} ${SHORT[s]}`}</span>)}
      </span>
    </div>
  );
}

export interface WeekDay {
  name: string;
  count: number;
  faces: Face[];
  kind?: 'late' | 'today';
  selected?: boolean;
  on: () => void;
}

/** P03c · who is due, the week ahead: seven columns, the count at the top, the faces as dots, the day under. */
export function WeekStrip(p: { days: WeekDay[]; title?: string; hint?: string }): JSX.Element {
  return (
    <div class="ow-week">
      {p.title && <span class="ow-week-h"><span><Icon name="calendar" size={14} stroke={2} />{p.title}</span>{p.hint && <span class="ow-week-hint">{p.hint}</span>}</span>}
      <div class="ow-week-days">
        {p.days.map((d) => (
          <button key={d.name} type="button" class={cx('ow-week-d', d.kind, d.selected && 'sel')} aria-pressed={!!d.selected}
            aria-label={`${d.name}: ${d.count ? d.count + ' due' : 'none due'}`} onClick={d.on}>
            <span class="ow-week-box">
              <span class={cx('mono', !d.count && 'none')}>{d.count || '·'}</span>
              <span class="ow-week-faces">{d.faces.slice(0, 3).map((f, i) => <span key={i} style={{ background: (TINTS[f.tint] || TINTS.t4).bg }} />)}</span>
            </span>
            <span class="ow-week-n">{d.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
