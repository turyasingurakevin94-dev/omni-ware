/*
 * The Customers list's navy head, by what the list shows (CU01–CU08):
 *   Owe     the owed total and its bar (P03a), search          CU01
 *   Due     who is due, the week ahead (P03c), search           CU03
 *   compact title 22, search as a button, the bar if any        CU02 (scrolled), CU04 (All), CU07 (no signal)
 *   typing  the search field lit, with its clear button         CU05
 *   none    nobody owes: 0 in mint, All paid                    CU06
 *   loading the figure as a shimmer                             CU08
 */
import type { ComponentChildren, JSX } from 'preact';
import { HeadStat, PageHead } from '../../../ui/PageHead.tsx';
import { SplitBar } from '../../../ui/Bar.tsx';
import { Duo, Icon, phSearch } from '../../../ui/icons.tsx';
import { Shim } from '../../../ui/Skeleton.tsx';
import { money } from '../../../core/money.ts';
import { cx } from '../../../ui/util.tsx';
import { ClearButton } from '../../../ui/Search.tsx';

/** hold: the shop's hold in days (settings.holdDays, 21). */
export interface OwedBar { take: number; under: number; checkedIn: number; checkedAll: number; owes: number; hold: number }

/** The owed bar and its key; a part that is 0 has no key (never "Take 0"). */
function bar(o: OwedBar) {
  const legend = [
    // "Past 21 days" as the group and TD05 say it; "to take" is a row's (Lead, 5 Nov 2026: one word per concept).
    o.take > 0 && { dot: '#F5B26B', text: `Past ${o.hold} days `, b: money(o.take) },
    o.under > 0 && { dot: 'rgba(255,255,255,.5)', text: `Under ${o.hold} days` },
    o.checkedIn > 0 && { dot: '#9DB7E0', text: 'Being checked' },
  ].filter(Boolean) as { dot: string; text: string; b?: string }[];
  return {
    parts: [{ value: o.take, color: '#F5B26B' }, { value: o.under, color: 'rgba(255,255,255,.28)' }, { value: o.checkedIn, color: 'hatch' }],
    legend,
    label: `${money(o.owes)} owed: ${money(o.take)} past the ${o.hold}-day hold, ${money(o.under)} under ${o.hold} days, ${money(o.checkedIn)} being checked; ${money(o.checkedAll)} being checked in all`,
  };
}

export interface HeadProps {
  count: number | null;
  onShare: () => void;
  onNew: () => void;
}

export function OweHead(p: HeadProps & { o: OwedBar; owe: number; q: string; onQ: (v: string) => void }): JSX.Element {
  return (
    <PageHead title="Customers" count={p.count ?? undefined} actions={acts(p)}
      search={{ placeholder: 'Name, phone or place', label: 'Find a customer', value: p.q, onInput: p.onQ }}>
      <HeadStat amount={p.o.owes} word="owed" pill={`${p.owe} owe`} bar={bar(p.o)} />
    </PageHead>
  );
}

function acts(p: HeadProps) {
  return [{ icon: 'share' as const, label: "Share the shop's price list", on: p.onShare }, { icon: 'person-plus' as const, label: 'New customer', on: p.onNew, white: true }];
}

/** The page head with any picture (Due's week strip), the search under it. */
export function PlainHead(p: HeadProps & { q: string; onQ: (v: string) => void; children?: ComponentChildren }): JSX.Element {
  return (
    <PageHead title="Customers" count={p.count ?? undefined} actions={acts(p)} search={{ placeholder: 'Name, phone or place', label: 'Find a customer', value: p.q, onInput: p.onQ }}>
      {p.children}
    </PageHead>
  );
}

/** The compact head: when the list has scrolled, on All, and with no signal. */
export function CompactHead(p: HeadProps & { o: OwedBar | null; onFind: () => void; fixed?: boolean }): JSX.Element {
  const b = p.o ? bar(p.o) : null;
  return (
    <header class={cx('ow-phead cu-compact', p.fixed && 'fixed')}>
      <div class="ow-phead-top">
        <h1>Customers{p.count != null && <span class="mono">{p.count}</span>}</h1>
        <button type="button" class="ow-phead-b" aria-label="Find a customer" onClick={p.onFind}><Duo i={phSearch} size={19} color="#FFFFFF" /></button>
        <button type="button" class="ow-phead-b white" aria-label="New customer" onClick={p.onNew}><Icon name="person-plus" size={20} stroke={2} /></button>
      </div>
      {b && (
        <div class="ow-hstat-bar">
          <SplitBar h={6} parts={b.parts.map((x) => ({ min: 6, ...x }))} label={b.label} />
          <span aria-hidden="true" class="ow-hstat-legend">{b.legend.map((l, i) => <span key={i}><span style={{ background: l.dot }} />{l.text}{l.b && <b class="mono">{l.b}</b>}</span>)}</span>
        </div>
      )}
    </header>
  );
}

/** Typing a name: the field lit white, the words in it, a clear button (CU05). */
export function TypingHead(p: HeadProps & { q: string; onQ: (v: string) => void }): JSX.Element {
  return (
    <header class="ow-phead">
      <div class="ow-phead-top">
        <h1>Customers{p.count != null && <span class="mono">{p.count}</span>}</h1>
        {acts(p).map((a) => <button key={a.label} type="button" class={cx('ow-phead-b', a.white && 'white')} aria-label={a.label} onClick={a.on}><Icon name={a.icon} size={20} stroke={2} /></button>)}
      </div>
      <div class="cu-typing">
        <label><Duo i={phSearch} size={19} color="#B3BCD2" />
          <input type="search" aria-label="Find a customer" value={p.q} autoFocus onInput={(e) => p.onQ((e.target as HTMLInputElement).value)} /></label>
        <ClearButton navy disc={44} icon={14} fill="rgba(255,255,255,.10)" label="Clear" on={() => p.onQ('')} />
      </div>
    </header>
  );
}

/** Nobody owes: 0 in mint, All paid, the bar all mint (CU06). */
export function NoneHead(p: HeadProps & { q: string; onQ: (v: string) => void }): JSX.Element {
  return (
    <PlainHead {...p}>
      <div class="cu-none-h">
        <div class="ow-hstat-row">
          <span class="ow-hstat-col"><span class="ow-hstat-l">Owed to the shop · nobody owes</span><span class="ow-hstat-fig"><span>UGX</span><span class="mono mint">0</span></span></span>
          <span class="cu-allpaid"><Icon name="check" size={13} stroke={3} />All paid</span>
        </div>
        <span aria-hidden="true" class="cu-none-bar" />
      </div>
    </PlainHead>
  );
}

/** First open: the figure and the bar as shimmers (CU08). */
export function LoadingHead(p: HeadProps & { q: string; onQ: (v: string) => void }): JSX.Element {
  return (
    <PlainHead {...p}>
      <div class="cu-load-h">
        <span><span class="ow-hstat-l">Owed to the shop</span><Shim w="62%" h={26} navy /></span>
        <Shim w="100%" h={8} navy />
      </div>
    </PlainHead>
  );
}
