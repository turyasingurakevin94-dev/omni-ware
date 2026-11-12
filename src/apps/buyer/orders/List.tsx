/*
 * 'orders' · Checking: every order still being checked, one row each
 * (docs/canvas/buyer/Orders.dc.html phone 1). The navy head holds the count,
 * what is still checking in money, and the order that just went to Buying;
 * a strip of every line under it; filter chips in one scrolling row; then a
 * row per order with its own line strip, the word that matters most, and
 * the one act in place: Ask again (late), Not found (opens the sheet), or
 * Ruth decides (nothing for the Buyer to do).
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { firstWord, initials, orderNo } from '../../../core/names.ts';
import { fig } from '../../../ui/Money.tsx';
import { Notice } from '../../../ui/Notice.tsx';
import { ChipRow, FilterChip } from '../../../ui/Pill.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { toast } from '../../../ui/toast.tsx';
import { askSupplier } from '../shell/ask.ts';
import type { Params } from '../shell/nav.ts';
import { nav } from '../shell/nav.ts';
import { books, flush, kept, now, online } from '../shell/store.ts';
import { openNotFound } from './NotFound.tsx';
import { FromChip, Initials, KEPT, KEPT_TOAST, Pause, RowAct, Strip, Waiting } from './parts.tsx';
import { buying, byNeed, byRole, byState, checking, FILTERS, holdOf, INK, matches, orderView, type Filter, type OrderView } from './rules.ts';
import { WORD } from '../../../core/buyer/rules.ts';

const isFilter = (x: unknown): x is Filter => FILTERS.some((f) => f.id === x);

function Row(p: { v: OrderView; decider: { name: string; initials: string } | null; busy: boolean; waiting: boolean; onAsk: () => void }): JSX.Element {
  const { v } = p, o = v.order, hold = holdOf(o), top = hold || o.test ? null : v.top;
  const toAsk = !!top && top.state === 'toask' && !!top.supplier;
  const word = !top ? '' : top.state === 'priceup' ? `${WORD.priceup} · ` : toAsk ? `${WORD.toask} · ${firstWord(top.supplier ? top.supplier.name : '')}` : `${WORD[top.state]}${top.at ? ' · ' : ''}`;
  const tail = !top || toAsk ? '' : top.state === 'priceup' ? fig(top.line.cost) : top.at || '';
  const open = () => nav.push('orders/order', { id: o.id });
  return (
    // The whole card opens the order for a finger; for a screen reader the name is the one button (no button inside a button).
    <div class="ow-b-orders-row" onClick={open}>
      <button type="button" class="top" aria-label={`${o.client}, ${orderNo(o.id)}: open`}>
        <Initials name={o.client} ini={initials(o.client)} />
        <span class="who"><span class="n">{o.client}</span><FromChip who={v.seller} no={o.id} /></span>
        <span class="sum">
          <span class="cap">Client pays</span>
          {v.pays > 0 || !v.coming ? <span class="mono">{fig(v.pays)}</span> : <span class="c">Price coming</span>}
          <span class="c">Cost <span class="mono">{fig(v.cost)}</span></span>
        </span>
      </button>
      <div class="foot">
        <div class="state">
          <Strip states={v.live.map((x) => x.state)} />
          {top && <span class="w" style={{ color: INK[top.state] }}>{word}<span class="mono">{tail}</span></span>}
        </div>
        {top && top.state === 'priceup' && p.decider && (
          <span class="ow-b-orders-ruth"><span aria-hidden="true">{p.decider.initials}</span>{`${firstWord(p.decider.name)} decides`}</span>
        )}
        {top && (top.state === 'asked' || toAsk) && p.waiting && <Waiting />}
        {toAsk && !p.waiting && (
          <RowAct word="Ask" busyWord="Asking" busy={p.busy} label={`Ask ${top && top.supplier ? top.supplier.name : 'the supplier'}`} on={p.onAsk} />
        )}
        {top && top.state === 'asked' && v.late && !p.waiting && (
          <RowAct icon="send" word="Ask again" busyWord="Asking" busy={p.busy} label={`Ask ${top.supplier ? top.supplier.name : 'the supplier'} again`} on={p.onAsk} />
        )}
        {top && top.state === 'notfound' && (
          <button type="button" class="ow-b-orders-nf" onClick={(e) => { e.stopPropagation(); openNotFound(o.id, top.line.key); }}>
            Not found<Icon name="chevron-right" size={16} stroke={2.2} />
          </button>
        )}
        {top && top.state === 'nosupplier' && (
          <RowAct word="Pick" busyWord="Picking" busy={false} label={`Pick a supplier for ${top.line.name}`} on={() => openNotFound(o.id, top.line.key)} />
        )}
        {hold && <span class="ow-b-orders-hold"><Pause />{`${hold.word} · ${hold.why}`}</span>}
        {o.test && !hold && <span class="ow-b-orders-hold test">Test · not counted</span>}
      </div>
    </div>
  );
}

export function OrdersList({ params }: { params: Params }): JSX.Element {
  const [chosen, choose] = useState<Filter>(isFilter(params.filter) ? params.filter : 'all');
  // The chip stays chosen when an order is opened and closed: this screen's stack entry keeps it.
  const setFilter = (f: Filter) => { params.filter = f; choose(f); };
  const [busy, setBusy] = useState<string | null>(null);
  const b = books.value;
  if (!b) return <main class="ow-b-orders" aria-busy="true" />;
  const t = now.value;
  const views = byNeed(checking(b).map((o) => orderView(o, b, t)));
  // Nothing left to ask: the To ask chip goes (board Orders, empty) and the list shows All (no undrawn "Nothing to ask").
  const filter: Filter = chosen === 'toask' && !views.some((v) => matches(v, 'toask')) ? 'all' : chosen;
  const shown = views.filter((v) => matches(v, filter));
  const lines = views.flatMap((v) => v.live);
  const total = views.reduce((s, v) => s + v.cost, 0);
  const moved = buying(b);
  const ruth = byRole(b, 'manager');
  const ruthName = ruth ? firstWord(ruth.name) : 'Ruth';
  const off = !online.value || kept.value.length > 0;
  const keptAsks = new Set(kept.value.filter((k) => k.kind === 'ask').map((k) => (Array.isArray(k.args) ? String(k.args[0]) : '')));

  const ask = async (v: OrderView) => {
    const top = v.top, sid = top && top.line.supplierId;
    if (!top || !sid) return;
    const name = top.supplier ? top.supplier.name : 'the supplier';
    setBusy(sid);
    try {
      // The one Ask (shell/ask.ts): WhatsApp with the message, or the call sheet when they have none.
      const r = await askSupplier(b, sid);
      if (!r) return;
      toast.show(r.kept ? KEPT : `Asked ${name}`, r.kept ? KEPT_TOAST : { kind: 'ok' });
    } catch (e) {
      toast.show('Not saved', { kind: 'error', sub: `Ask ${name} again`, retry: () => { void ask(v); } });
    } finally { setBusy(null); }
  };

  return (
    <main class="ow-b-orders">
      <header class="ow-b-orders-hero">
        <div class="r1">
          <button type="button" class="back" aria-label="Back to Today" onClick={() => nav.back()}><Icon name="back" size={20} stroke={2.2} /></button>
          <h1>Checking <span class="mono">{views.length}</span></h1>
          {moved.length > 0 && (
            <span class="buying"><Icon name="check" size={14} stroke={2.6} />
              {moved.length === 1 ? <><span class="mono">{orderNo(moved[0].id)}</span> Buying</> : <><span class="mono">{moved.length}</span> Buying</>}
            </span>
          )}
        </div>
        <div class="r2">
          <span class="over">{`${lines.length} ${lines.length === 1 ? 'line' : 'lines'} · still checking`}</span>
          <span class="fig"><span class="mono">{fig(total)}</span><span class="mono ugx">UGX</span></span>
        </div>
      </header>
      {off && <Notice kind="offline" action={kept.value.length ? { label: 'Try again', on: () => { void flush(); } } : undefined}>Offline · it sends when back</Notice>}
      {lines.length > 0 && <div class="ow-b-orders-all"><Strip states={byState(lines.map((x) => x.state))} /></div>}
      <div class="ow-b-orders-chips">
        <ChipRow label="Show">
          {FILTERS.map((f) => {
            const n = views.filter((v) => matches(v, f.id)).length;
            // On hold stays while it is the chosen chip (board R1WhoSees, empty filter: "On hold 0").
            if ((f.id === 'toask' || f.id === 'needs' || f.id === 'hold') && !n && !(f.id === 'hold' && filter === 'hold')) return null;
            return (
              <FilterChip key={f.id} on={filter === f.id} dot={f.dot || undefined} count={n} onClick={() => setFilter(f.id)}>
                {f.id === 'all' && <span aria-hidden="true" class="ow-b-orders-chipic"><Icon name="list" size={16} stroke={2.2} /></span>}
                {f.id === 'ruth' && <Icon name="lock" size={14} stroke={2.2} />}
                {f.id === 'toask' && <span aria-hidden="true" class="ow-b-orders-dashdot" />}
                {f.id === 'hold' && <Pause />}
                {f.id === 'ruth' ? `${ruthName} decides` : f.word}
              </FilterChip>
            );
          })}
        </ChipRow>
      </div>
      {shown.length > 0 ? (
        <div class="ow-b-orders-rows">
          {shown.map((v) => (
            <Row key={v.order.id} v={v} decider={ruth} busy={!!busy && busy === v.top?.line.supplierId}
              waiting={!!v.top?.line.supplierId && keptAsks.has(v.top.line.supplierId)} onAsk={() => { void ask(v); }} />
          ))}
          {filter === 'toask' && views.length > shown.length && (
            <button type="button" class="ow-b-orders-rest" onClick={() => setFilter('all')}>{`The other ${views.length - shown.length} ${views.length - shown.length === 1 ? 'is' : 'are'} asked or answered · `}<b>All</b></button>
          )}
        </div>
      ) : (
        <div class="ow-b-orders-empty">
          <span class="tick"><Icon name="check" size={26} stroke={2.4} /></span>
          <span class="t">{views.length ? (filter === 'ruth' ? `Nothing waits on ${ruthName}` : filter === 'notfound' ? 'No Not found lines' : `Nothing ${FILTERS.find((f) => f.id === filter)?.word.toLowerCase()}`) : 'Nothing in Checking'}</span>
          {!views.length && <span aria-hidden="true" class="bars"><span /><span /><span /><span /></span>}
        </div>
      )}
    </main>
  );
}
