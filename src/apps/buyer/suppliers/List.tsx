/*
 * Suppliers (tab 2): the navy head with found-of-asks and the reply time
 * across suppliers, the search with the mic, the place chips, and one row
 * per supplier with its answer chip and who in Sales waits on it. Where an
 * ask has gone unanswered past 30 minutes, the row's own act is Ask again.
 * A search nobody matches turns the page into "Nobody sells it" (NoMatch).
 */
import { signal } from '@preact/signals';
import { clock } from '../../../core/time.ts';
import type { JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import type { BuyerBooks } from '../../../core/buyer/types.ts';
import { orderNo } from '../../../core/names.ts';
import { GroupCard } from '../../../ui/ActRow.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { ListenSheet, hasSpeech } from '../../../ui/Listen.tsx';
import { PageHead } from '../../../ui/PageHead.tsx';
import { ChipRow, FilterChip } from '../../../ui/Pill.tsx';
import { MicButton, Search } from '../../../ui/Search.tsx';
import { SectionHead } from '../../../ui/SectionHead.tsx';
import { LoadingHead, SkeletonRows } from '../../../ui/Skeleton.tsx';
import { sheet } from '../../../ui/sheet.tsx';
import { nav } from '../shell/nav.ts';
import { books, isDemo, now } from '../shell/store.ts';
import { NoMatch } from './NoMatch.tsx';
import { askAgain, justAsked } from './ask.ts';
import { Face, OffBand, SendsLater, StateChip, SupTile, first, keptFor, member } from './parts.tsx';
import { findSuppliers, heroStats, places, replyWord, supplierRows, type SupRow } from './rules.ts';
import './list.css';

/** Ask again is on its way for this supplier (one at a time: the row shows the ring). */
const busy: { id: string | null } = { id: null };
/** The search and the place chip outlive the list, so Back from a supplier finds them as they were. */
const query = signal('');
const where = signal<string | null>(null);
const setQ = (v: string) => { query.value = v; };
const setPlace = (v: string | null) => { where.value = v; };

export function Suppliers(): JSX.Element {
  const b = books.value;
  const q = query.value, place = where.value;
  const [, redraw] = useState(0);
  const field = useRef<HTMLDivElement>(null);
  if (!b) return <main class="ow-b-suppliers"><LoadingHead text="Getting your suppliers" /><SkeletonRows rows={4} /></main>;

  const t = now.value, all = supplierRows(b, t), waits = all.filter((r) => r.waits).length;
  const found = findSuppliers(all, b, q);
  const rows = found.filter((r) => !place || r.s.place === place);
  const searching = q.trim().length > 0, none = searching && found.length === 0;
  const st = heroStats(b), pct = st.asked ? Math.round((st.found / st.asked) * 100) : 0;
  const answered = !waits && !all.some((r) => r.state === 'asked') && all.some((r) => r.state && r.state !== 'toask');

  const listen = () => {
    if (!isDemo && !hasSpeech()) { const i = field.current?.querySelector('input'); if (i) i.focus(); return; }
    sheet.open(() => <ListenSheet act="Find" onDone={(w) => { setQ(w); setPlace(null); }} />, { label: 'Say it' });
  };
  const ask = async (r: SupRow) => {
    busy.id = r.s.id; redraw((n) => n + 1);
    await askAgain(b, r.s.id);
    busy.id = null; redraw((n) => n + 1);
  };

  return (
    <main class="ow-b-suppliers">
      <div class="ow-b-suppliers-head">
        <PageHead title="Suppliers" count={b.suppliers.length}>
          {!searching && (
            <div class="ow-b-suppliers-stats" role="img" aria-label={`Found ${st.found} of the last ${st.asked} asks${st.replyMins != null ? `; they reply in ${replyWord(st.replyMins)}` : ''}`}>
              <div class="ow-b-suppliers-stat-row">
                <span class="ow-b-suppliers-stat">
                  <span class="ow-b-suppliers-over">Found · last 10 asks ›</span>
                  <span class="ow-b-suppliers-fig"><b class="mono">{st.found}</b><span class="mono">{`of ${st.asked}`}</span></span>
                </span>
                {st.replyMins != null && (
                  <span class="ow-b-suppliers-reply"><Icon name="clock" size={14} stroke={2} />Reply <span class="mono">{replyWord(st.replyMins)}</span></span>
                )}
              </div>
              <span class="ow-b-suppliers-bar"><i style={{ width: `${pct}%` }} /></span>
            </div>
          )}
          <div class={'ow-b-suppliers-find' + (none ? ' none' : '')} ref={field}>
            <Search tone="navy" class="ow-b-suppliers-q" placeholder="Supplier or item" label="Find a supplier or an item"
              value={q} onInput={(v) => { setQ(v); }} onClear={() => setQ('')} />
            <MicButton on={listen} />
          </div>
        </PageHead>
        {!searching && waits > 0 && <span class="ow-b-suppliers-waits"><i />{`${waits} waits on you`}</span>}
      </div>

      <OffBand />

      {none ? <NoMatch b={b} q={q} onClear={() => setQ('')} /> : (
        <div class="ow-b-suppliers-body">
          {!searching && (
            <ChipRow label="Where">
              <FilterChip on={!place} count={b.suppliers.length} onClick={() => setPlace(null)}>All</FilterChip>
              {places(b).map((p) => (
                <FilterChip key={p.place} on={place === p.place} count={p.count} onClick={() => setPlace(place === p.place ? null : p.place)}>
                  <Icon name="pin" size={15} stroke={2} />{p.place}
                </FilterChip>
              ))}
            </ChipRow>
          )}
          {answered && (
            <>
              <SectionHead title="Waits on you" right={<b class="mono ow-b-suppliers-zero">0</b>} />
              <div class="ow-b-suppliers-done"><span><Icon name="check" size={24} stroke={2.4} /></span>Every supplier answered</div>
            </>
          )}
          <GroupCard pad={12}>
            {rows.map((r) => <Row key={r.s.id} b={b} r={r} sending={busy.id === r.s.id} onAsk={() => { void ask(r); }} />)}
          </GroupCard>
          <SalesSees b={b} rows={rows} />
        </div>
      )}
    </main>
  );
}

function Row(p: { b: BuyerBooks; r: SupRow; sending: boolean; onAsk: () => void }): JSX.Element {
  const { r } = p, seller = member(p.b, r.sellerId);
  const more = r.orders.length > 1 ? ` +${r.orders.length - 1}` : '';
  const done = justAsked.value && justAsked.value.id === r.s.id ? justAsked.value : null;
  const later = r.waits && keptFor('ask', r.s.id);
  if (done) {
    // SUCCESS (Suppliers.dc.html): their record, then "✓ Asked · 11:10" (Undo is not built: no write undoes an ask).
    return (
      <div class="ow-b-suppliers-row done" role="status">
        <div class="ow-b-suppliers-main">
          <SupTile name={r.s.name} size={44} />
          <span class="ow-b-suppliers-t">
            <span class="ow-b-suppliers-name">{r.s.name}</span>
            <span class="ow-b-suppliers-rec mono">{`found ${r.s.found} of ${r.s.asked}${r.s.replyMins != null ? ` · ${replyWord(r.s.replyMins)}` : ''}`}</span>
          </span>
        </div>
        <div class="ow-b-suppliers-asked"><span><Icon name="check" size={14} stroke={2.4} />Asked · <span class="mono">{clock(done.at)}</span></span></div>
      </div>
    );
  }
  return (
    <div class="ow-b-suppliers-row">
      <button type="button" class="ow-b-suppliers-main" onClick={() => nav.push('suppliers/one', { id: r.s.id })}
        aria-label={`${r.s.name}${r.waits ? '' : `: found ${r.s.found} of ${r.s.asked}`}`}>
        <SupTile name={r.s.name} />
        <span class="ow-b-suppliers-t">
          <span class="ow-b-suppliers-name">{r.s.name}</span>
          {r.state && (
            <span class="ow-b-suppliers-sub">
              <StateChip state={r.state} at={r.at} late={r.waits} />
              <Face m={seller} size={20} />
              {r.orders.length > 0 && <span class="mono">{orderNo(r.orders[0]) + more}</span>}
            </span>
          )}
          {!r.state && <span class="ow-b-suppliers-sub quiet">{r.s.place}</span>}
        </span>
        {!r.waits && (
          <span class="ow-b-suppliers-rate mono">
            <b>{`${r.s.found}/${r.s.asked}`}</b>
            {r.s.replyMins != null && <span>{replyWord(r.s.replyMins)}</span>}
          </span>
        )}
      </button>
      {later && <SendsLater />}
      {r.waits && !later && (
        <button type="button" class="ow-b-suppliers-again" aria-busy={p.sending || undefined}
          aria-label={`Ask ${r.s.name} again on WhatsApp`} onClick={p.sending ? undefined : p.onAsk}>
          {p.sending && <span class="ow-b-suppliers-spin" aria-hidden="true" />}Ask again
        </button>
      )}
    </div>
  );
}

/** Under the list, while a row shows SUCCESS: what its salesperson now sees ("Brian sees: Asked · 11:10"). */
function SalesSees(p: { b: BuyerBooks; rows: SupRow[] }): JSX.Element | null {
  const j = justAsked.value, r = j ? p.rows.find((x) => x.s.id === j.id) : null;
  if (!j || !r) return null;
  return <span class="ow-b-suppliers-sees">{`${first(member(p.b, r.sellerId), 'Sales')} sees: `}<b>Asked · <span class="mono">{clock(j.at)}</span></b></span>;
}
