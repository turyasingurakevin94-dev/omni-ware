/*
 * shelf (the tab) · SH01, SH41 no signal, SH06 nothing needs a look.
 *
 *   the head      "Shelf 1,153", Scan, how long since each aisle was counted (a bar per aisle, the dashed
 *                 line at 21 days, over it red), Find
 *   Needs a look  Running low (Ask) · Count due (Count) · Found damaged (Report) · With Ruth (Open), each
 *                 with how many; nothing: "The shelf is in order", the next aisle to count, spot-check
 *   Aisles        A–L with their names; a badge for what to look at, a dot for a count due
 *
 * No signal: the head says "saved 7:52", the bars dim, and a strip says what waits to send (Try again).
 */
import type { JSX } from 'preact';
import { counted, plural } from '../../../core/names.ts';
import { clock } from '../../../core/time.ts';
import { aislesOf, lookOf, onShelf, openReports, type Aisle } from '../../../core/store/shelf.ts';
import { COUNT_DUE_DAYS, countDue, recountOf } from '../../../core/store/counts.ts';
import type { ShelfItem, YardBooks } from '../../../core/store/types.ts';
import { Duo, Icon, phBox, phClock, phHourglass } from '../../../ui/icons.tsx';
import { ItemSquare } from '../../../ui/ItemSquare.tsx';
import { cx, Tap } from '../../../ui/util.tsx';
import { nav } from '../shell/nav.ts';
import { books, flush, kept, now, online } from '../shell/store.ts';
import { foundOpen } from './found.ts';
import { shortName } from './parts.tsx';
import './shelf.css';

interface Look { kind: 'low' | 'due' | 'found' | 'ruth'; title: string; sub: string; n: number; act: string; go: () => void }

/** What needs a look, in the board's order: running low · count due · found damaged · with Ruth. */
export function needsLook(b: YardBooks, at: number): Look[] {
  const out: Look[] = [];
  const low = b.items.map((it) => ({ it, w: lookOf(b, it, at) })).filter((x) => x.w === 'low' || x.w === 'out' || x.w === 'short');
  if (low.length) {
    const it = low[0].it, n = onShelf(b, it.key);
    out.push({ kind: 'low', title: low.some((x) => x.w !== 'low') ? 'Out' : 'Running low', sub: `${shortName(it.name)} · ${n} ${it.unit}`, n: low.length, act: 'Ask', go: () => nav.push('shelf/ask', { key: it.key }) });
  }
  const asked = b.items.filter((it) => recountOf(b, it.key));
  const dueAisles = aislesOf(b, at).filter((a) => a.items.some((it) => countDue(it, b, at) && !recountOf(b, it.key)));
  if (asked.length || dueAisles.length) {
    const first = asked[0];
    out.push({
      kind: 'due', title: 'Count due', n: asked.length + dueAisles.length, act: 'Count',
      sub: first ? `${shortName(first.name)} · Ruth asked` : `aisle ${dueAisles[0].letter} · ${dueAisles[0].days} days`,
      go: () => (first ? nav.push('shelf/count', { key: first.key }) : nav.push('shelf/count', { aisle: dueAisles[0].name })),
    });
  }
  const found = foundOpen.value;
  if (found.length) {
    const it = b.items.find((x) => x.key === found[0].key);
    if (it) out.push({ kind: 'found', title: 'Found damaged', sub: `${shortName(it.name)} · ${found[0].qty} ${it.unit}`, n: found.length, act: 'Report', go: () => nav.push('shelf/report', { key: it.key }) });
  }
  const ruth = [...b.counts.filter((c) => c.status === 'sent'), ...b.reports.filter((r) => r.status === 'sent')];
  if (ruth.length) {
    const c = ruth[0], name = 'lines' in c ? (c.lines[0] ? c.lines[0].name : c.aisle) : c.name;
    out.push({ kind: 'ruth', title: 'With Ruth', sub: `${shortName(name)} · ${clock(c.createdAt)}`, n: ruth.length, act: 'Open', go: () => nav.push('today/with-ruth') });
  }
  return out;
}

const LOOK: Record<Look['kind'], [string, string, string, () => JSX.Element]> = {
  low: ['#FDEEE1', '#95530C', '#7A4A02', () => <Duo i={phBox} size={20} />],
  due: ['#FBE5E2', '#8E2A22', '#8E2A22', () => <Duo i={phClock} size={20} />],
  found: ['#FDEEE1', '#95530C', '#7A4A02', () => <Icon name="warning" size={19} stroke={2} />],
  ruth: ['#E3EEFB', '#1A5A8A', '#1A5A8A', () => <Duo i={phHourglass} size={20} />],
};

/** How fresh each aisle's count is: one bar a day, the dashed line at 14, red over it. */
function Bars(p: { aisles: Aisle[]; dim: boolean; onTap: () => void }): JSX.Element {
  const label = `Days since each aisle was counted: ${p.aisles.map((a) => `${a.letter} ${a.days ?? 'never'}`).join(', ')}. Due every ${COUNT_DUE_DAYS} days.${p.aisles.filter((a) => a.due).map((a) => ` Aisle ${a.letter} is over.`).join('')}`;
  return (
    <Tap on={p.onTap} label={label} class="sh-bars-a">
      <span aria-hidden="true" class={cx('sh-bars', p.dim && 'dim')}>
        <span class="sh-bars-line" />
        {p.aisles.map((a) => {
          const d = a.days ?? 0, tone = a.due ? 'over' : d >= 10 ? 'soon' : '';
          return <span key={a.letter} class={cx('sh-bar', tone)}><span style={{ height: `${Math.min(34, d + 1)}px` }} /><b class="mono">{a.letter}</b></span>;
        })}
        <span />
        <span class="sh-bars-due">due</span>
      </span>
    </Tap>
  );
}

function aisleNote(b: YardBooks, a: Aisle, at: number, found: string[]): { badge: number; dot: boolean; label: string } {
  const low = a.items.filter((it) => { const w = lookOf(b, it, at); return w === 'low' || w === 'out' || w === 'short'; }).length;
  const rep = a.items.filter((it) => found.includes(it.key) || openReports(b, it.key).length).length;
  const due = a.items.some((it: ShelfItem) => countDue(it, b, at));
  const bits = [rep ? `${rep} to report` : '', low ? `${low} running low` : '', due ? 'count due' : ''].filter(Boolean);
  return { badge: low + rep, dot: due && !(low + rep), label: `Aisle ${a.letter}, ${a.name.replace('&', 'and')}, ${counted(a.items.length, 'item')}${bits.length ? ', ' + bits.join(', ') : ''}` };
}

export function Shelf(): JSX.Element {
  const b = books.value, at = now.value;
  if (!b) return <main class="sh-wait" aria-busy="true" />;
  const aisles = aislesOf(b, at), total = aisles.reduce((n, a) => n + a.items.length, 0);
  const looks = needsLook(b, at), off = !online.value, waiting = kept.value.filter((k) => k.state !== 'refused');
  const found = foundOpen.value.map((f) => f.key);
  const worst = [...aisles].filter((a) => a.days != null).sort((x, y) => (y.days as number) - (x.days as number))[0];
  const next = [...aisles].filter((a) => !a.due && a.days != null).sort((x, y) => (y.days as number) - (x.days as number))[0];
  const kinds = waiting.map((k) => (k.kind === 'reportLoss' ? 'report' : k.kind === 'restock' ? 'ask' : /count/i.test(k.kind) ? 'count' : 'change'));
  const what = kinds.length && kinds.every((k) => k === kinds[0]) ? plural(kinds.length, kinds[0]) : plural(kinds.length, 'change');
  return (
    <>
      <header class="sh-phead">
        <div class="sh-phead-top">
          <div class="sh-phead-t">
            <h1>Shelf<span class="mono">{total.toLocaleString('en-US')}</span></h1>
            {off && <span class="sh-phead-off"><span aria-hidden="true" />No signal · saved <span class="mono">{clock(b.at)}</span></span>}
          </div>
          <button type="button" class="sh-scan-b" aria-label="Scan a shelf label" onClick={() => nav.push('shelf/scan')}><Icon name="scan" size={20} stroke={2} /></button>
        </div>
        <Bars aisles={aisles} dim={off} onTap={() => worst && nav.push('shelf/count', { aisle: worst.name })} />
        <Tap on={() => nav.push('shelf/find')} class="sh-findlink" label="Find an item, aisle or order"><Icon name="search" size={19} stroke={2} /><span>Item, aisle or order #</span></Tap>
      </header>
      <main class="sh-main" data-route="shelf">
        {waiting.length > 0 && (
          <div role="status" class="sh-nosig">
            <span aria-hidden="true"><Icon name="offline" size={18} stroke={2} /></span>
            <span>No signal · <b class="mono">{waiting.length}</b> {what} not sent yet</span>
            <button type="button" onClick={() => { void flush(); }}><span>Try again</span></button>
          </div>
        )}
        <div class="sh-sec">
          {looks.length > 0 && <span aria-hidden="true" class="sh-sec-dot" />}
          <h2>Needs a look</h2><span class="mono">{looks.reduce((n, l) => n + l.n, 0)}</span>
        </div>
        {looks.length ? looks.map((l) => {
          const [bg, ink, num, I] = LOOK[l.kind];
          return (
            <Tap key={l.kind} on={l.go} class="sh-look" label={`${l.title}: ${l.sub}. ${l.act}`}>
              <span aria-hidden="true" class="sh-look-i" style={{ background: bg, color: ink }}><I /></span>
              <span class="sh-look-t"><span>{l.title}</span><span>{l.sub}</span></span>
              <b class="mono" style={{ color: num }}>{l.n}</b>
              <span class="sh-look-b">{l.act}</span>
            </Tap>
          );
        }) : (
          <div class="sh-calm">
            <div class="sh-calm-r"><span aria-hidden="true" class="sh-calm-ok"><Icon name="check" size={20} stroke={2.4} /></span><span class="sh-calm-t"><span>The shelf is in order</span><span>nothing low · nothing with Ruth</span></span></div>
            {next && (
              <Tap on={() => nav.push('shelf/aisle', { aisle: next.name })} class="sh-calm-r">
                <span aria-hidden="true" class="sh-calm-g"><Icon name="tally" size={18} stroke={2} /></span>
                <span class="sh-calm-t"><span>{`Next count: aisle ${next.letter}`}</span><span>due in <span class="mono">{Math.max(1, COUNT_DUE_DAYS - (next.days as number))}</span> {plural(Math.max(1, COUNT_DUE_DAYS - (next.days as number)), 'day')} · {next.name}</span></span>
                <span class="sh-look-b">Count</span>
              </Tap>
            )}
            <Tap on={() => nav.push('shelf/scan')} class="sh-calm-r">
              <span aria-hidden="true" class="sh-calm-g"><Icon name="scan" size={18} stroke={2} /></span>
              <span class="sh-calm-t"><span>Spot-check any item</span><span>scan a label · Count is on every item</span></span>
              <span aria-hidden="true" class="sh-chev"><Icon name="chevron-right" size={16} stroke={2.2} /></span>
            </Tap>
          </div>
        )}
        <div class="sh-gap" />
        <div class="sh-sec"><h2>Aisles</h2><span class="mono">{`${aisles.length} · ${total.toLocaleString('en-US')} items`}</span></div>
        <div class="sh-aisles">
          {aisles.map((a) => {
            const n = aisleNote(b, a, at, found);
            return (
              <Tap key={a.letter} on={() => nav.push('shelf/aisle', { aisle: a.name })} label={n.label} class="sh-aisle">
                {n.badge > 0 && <span aria-hidden="true" class="sh-aisle-n mono">{n.badge}</span>}
                {n.dot && <span aria-hidden="true" class="sh-aisle-dot" />}
                <span class="sh-aisle-h"><ItemSquare aisle={a.name} size={24} radius={8} icon={16} /><b class="mono">{a.letter}</b></span>
                <span class="sh-aisle-w">{a.name}</span>
              </Tap>
            );
          })}
        </div>
      </main>
    </>
  );
}
