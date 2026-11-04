/*
 * An order with nothing in it yet: what the books say to start with.
 *   SL03  a regular: their usual (P29), their last order with "Sell again", the aisles they buy from
 *   SL30  what they asked for is in now ("Add 6 · 1,110,000"), their order not paid yet ("Take 1.1M")
 *   SL31  a walk-in: what I sell most (the last 30 days), the aisles
 * At most two cards above the aisles: what they asked for, what waits on money, their usual, their last order.
 */
import type { JSX } from 'preact';
import { chipAisles } from '../../../core/aisles.ts';
import { orderTotal, short } from '../../../core/money.ts';
import { orderNo } from '../../../core/names.ts';
import { heldFor } from '../../../core/orders.ts';
import { owingOf, takeWithHeld } from '../../../core/owing.ts';
import { clock, dayOf } from '../../../core/time.ts';
import type { Books, Customer, Item } from '../../../core/types.ts';
import { Duo, Icon, phAgain, phCoins, phFlame, phGrid, phSparkle } from '../../../ui/icons.tsx';
import { ItemSquare } from '../../../ui/ItemSquare.tsx';
import { fig, isPriced, PRICE_COMING } from '../../../ui/Money.tsx';
import { UsualCard } from '../../../ui/UsualCard.tsx';
import { nav } from '../shell/nav.ts';
import { me, now } from '../shell/store.ts';
import { aisleMarks, aisles, dayWord, first, item, itemKey, lastOrder, sellMost, whose } from './insights.ts';
import { add, cur, itemOf } from './model.ts';
import { openAisle, openAisles } from './sheets.tsx';
import './start.css';

export const inchLabel = (s: string) => s.replace(/"/g, ' inch');
/** A tile's name: the first words, no grade (FACTS §7: "Iron sheet", "Cement", "Wire nails 4""). */
export const tileName = (s: string) => s.split(' · ')[0].split(' ').filter((w) => !/^G\d+$/.test(w)).join(' ');

/** One order's lines again, at today's prices (manifest note: "Sell again uses today's prices"): what was not dropped. */
export function sellAgain(b: Books, lines: { itemId: string; variantIdx?: number | null; qty: number; state?: string | null }[]): void {
  lines.filter((l) => l.state !== 'dropped' && l.qty > 0).forEach((l) => { const it = itemOf(b, l.itemId, l.variantIdx ?? null) || b.items.find((i) => i.id === l.itemId); if (it) add(it, l.qty); });
}

/** Their usual, all of it (Today's "Order usual": { from: 'usual' }). */
export function usualInto(b: Books, customerId: string): void {
  const c = b.customers.find((x) => x.id === customerId);
  if (c) c.usual.forEach((u) => { const it = itemOf(b, u.itemId, u.variantIdx); if (it) add(it, u.qty); });
}

/** What they asked Sourcing for that is now listed (SL30: Mukono's 6 tins of roof paint, FACTS §6): their own requests on the lead. */
function askedIn(b: Books, c: Customer): { it: Item; qty: number } | null {
  for (const ask of b.asks.filter((a) => a.status === 'listed' && a.itemId)) {
    const it = b.items.find((i) => i.id === ask.itemId), qty = ask.requests.filter((r) => r.customerId === c.id).reduce((n, r) => n + r.qty, 0);
    if (it && qty > 0) return { it, qty };
  }
  return null;
}

export function Start(p: { b: Books; c: Customer | null }): JSX.Element {
  const b = p.b, c = p.c, x = cur.value, mine = me.value ? me.value.id : '';
  const cards: JSX.Element[] = [];
  if (c) {
    const asked = askedIn(b, c);
    if (asked) {
      const { it, qty } = asked;
      cards.push(
        <div class="sl-card" key="asked">
          <div class="sl-card-h"><span aria-hidden="true" class="sl-card-ic good"><Duo i={phSparkle} size={18} color="#0F6B43" /></span><span class="sl-card-t">{`What ${first(c.name)} asked for is in`}</span><span class="sl-card-m">{`listed ${clock(it.listedAt as number)}`}</span></div>
          <div class="sl-card-i">
            <ItemSquare aisle={it.aisle} size={44} />
            <span class="sl-card-it"><span>{it.name}</span><span><span class="mono">{`${qty} `}<span class="ow-word">{it.unit}</span>{` × ${fig(it.price || 0)}`}</span>{it.onShelf ? <span class="sl-shelf"><b class="mono">{it.onShelf}</b> on shelf</span> : null}</span></span>
          </div>
          <button type="button" class="sl-card-add" onClick={() => add(it, qty)}><Icon name="plus" size={18} stroke={2.4} />{`Add ${qty} · `}<span class="mono">{fig(qty * (it.price || 0))}</span></button>
        </div>,
      );
    }
    // Held for my money (core/orders.ts heldFor); its Take is what they owe and the order (core/owing.ts takeWithHeld).
    const unpaid = b.orders.find((o) => o.customerId === c.id && heldFor(o, mine));
    const take = unpaid ? takeWithHeld(owingOf(b, c, dayOf(now.value)), c.id, unpaid) : null;
    if (unpaid) {
      cards.push(
        <div class="sl-unpaid" key="unpaid">
          <span aria-hidden="true" class="sl-unpaid-ic"><Duo i={phCoins} size={20} color="#95530C" /></span>
          <span class="sl-unpaid-t"><span><span class="mono">{orderNo(unpaid.id)}</span> · Not paid yet</span><span>waits in Checking</span></span>
          <a href="#" class="sl-unpaid-take" onClick={(e) => { e.preventDefault(); if (take) nav.push('customers/pay', { customer: take.customer, bills: take.bills }); }}><span>Take <span class="mono">{short(take ? take.amount : 0)}</span></span></a>
        </div>,
      );
    }
    if (c.usual.length && cards.length < 2) {
      const inIt = new Set((x ? x.lines : []).map(itemKey));
      const items = c.usual.map((u) => ({ u, it: item(b, itemKey(u)) })).filter((r): r is { u: typeof r.u; it: Item } => !!r.it);
      cards.push(
        <UsualCard key="usual" title={`${whose(c.name)} usual`.replace('’', "'")}
          items={items.map(({ u, it }) => ({
            aisle: it.aisle, name: tileName(it.name), qty: `×${u.qty} ${it.unit}`, in: inIt.has(itemKey(u)),
            note: u.seen === u.of ? 'every order' : `${u.seen} of ${u.of}`, label: `Add ${inchLabel(it.name.split(' · ')[0])}, usual ×${u.qty} ${it.unit}`, on: () => add(it, u.qty),
          }))}
          onAll={() => items.filter(({ u }) => !inIt.has(itemKey(u))).forEach(({ u, it }) => add(it, u.qty))} />,
      );
    }
    const last = lastOrder(b, c.id);
    if (last && cards.length < 2) {
      cards.push(<LastOrder key="last" b={b} c={c} />);
    }
  }
  const most = c ? [] : sellMost(b, mine, now.value);
  const marks = aisleMarks(b, c), shown = tileAisles(b, mine);
  const all = aisles(b);
  return (
    <>
      {cards}
      {most.length > 0 && (
        <>
          <div class="sl-sec"><Duo i={phFlame} size={18} color="#C93A30" /><h2>You sell most</h2><span>last 30 days</span></div>
          {most.map(({ it }, i) => (
            <div class="sl-most" key={it.id}>
              <span class="sl-most-sq"><ItemSquare aisle={it.aisle} size={44} /><span aria-hidden="true" class={'mono sl-rank' + (i === 0 ? ' top' : '')}>{i + 1}</span></span>
              <span class="sl-most-t"><span>{it.name}</span>{it.onShelf ? <span class="sl-shelf"><b class="mono">{it.onShelf}</b> on shelf</span> : null}</span>
              {isPriced(it.price) ? <span class="ow-often-p"><b class="mono">{fig(it.price)}</b><small>per {it.unit}</small></span> : <span class="ow-often-p"><small>{PRICE_COMING}</small></span>}
              <button type="button" class="ow-often-add" aria-label={`Add ${inchLabel(it.name)}`} onClick={() => add(it, 1)}><Icon name="plus" size={16} stroke={2.6} /></button>
            </div>
          ))}
        </>
      )}
      <div class="sl-sec"><Duo i={phGrid} size={18} color="#5F6980" /><h2>Aisles</h2>{c && marks.size > 0 && <span>{`${first(c.name)} buys from ${marks.size}`}</span>}</div>
      <div class="sl-tiles">
        {shown.map((a) => {
          const n = all.find((x) => x.name === a)?.count || 0, mk = marks.get(a);
          return (
            <a key={a} href="#" class="sl-tile" onClick={(e) => { e.preventDefault(); openAisle(a); }}>
              <ItemSquare aisle={a} size={38} />
              {mk ? <span class="mono sl-tile-mk"><Duo i={phAgain} size={12} color="#0F6B43" />{mk}</span> : null}
              <span class="sl-tile-t"><b>{a}</b><span class="mono">{`${fig(n)} items`}</span></span>
            </a>
          );
        })}
        <a href="#" class="sl-tile all" onClick={(e) => { e.preventDefault(); openAisles(); }}>
          <span aria-hidden="true" class="sl-tile-all"><Icon name="grid" size={20} /></span>
          <span class="sl-tile-t"><b>All aisles</b><span class="mono">{`${all.length} · ${fig(all.reduce((s, a) => s + a.count, 0))}`}</span></span>
        </a>
      </div>
    </>
  );
}

/** The five aisles worth a tile: the ones I sell from most, in the shop's order (agent.html topCategories). */
/** The aisle tiles (SL03, SL31): the seller's five by the one rule (core/aisles.ts), in the shop's order. */
export function tileAisles(b: Books, mine: string): string[] {
  const top = new Set(chipAisles(b.items, b.orders, null, mine));
  return aisles(b).map((a) => a.name).filter((a) => top.has(a));
}

/** Their last order, and Sell again (SL03; under the usual shelf, SL33). */
export function LastOrder(p: { b: Books; c: Customer }): JSX.Element | null {
  const b = p.b, last = lastOrder(b, p.c.id);
  if (!last || !last.lines.length) return null;
  return (
    <a href="#" class="sl-last" onClick={(e) => { e.preventDefault(); sellAgain(b, last.lines); }}>
      <ItemSquare aisle={(itemOf(b, last.lines[0].itemId, last.lines[0].variantIdx) || { aisle: '' }).aisle} size={36} radius={10} icon={22} />
      <span class="sl-last-t"><span>Last order <span class="mono">{orderNo(last.id)}</span></span><span class="mono">{`${dayWord(last.placedAt, now.value)} ${clock(last.placedAt)} · ${fig(orderTotal(last))}`}</span></span>
      <span class="sl-last-again"><Icon name="return" size={15} stroke={2.2} />Sell again</span>
    </a>
  );
}
