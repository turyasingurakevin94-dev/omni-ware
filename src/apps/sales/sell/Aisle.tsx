/*
 * sell/aisle · an aisle open (SL12): its kinds as chips (Nails 9 · Screws 24
 * · Bolts 18), the cards of the kind most sold first, each with what tells
 * one from another on the shelf (a nail drawn to its length), its price,
 * the shelf, and a + in the unit it sells by; one in the order shows its
 * count. The bar at the foot is the order so far, and Done goes back to it.
 * Opened with { aisle, group? }, or a shelf: { group: 'usual' | 'new' | 'most' }.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import type { Books, Item } from '../../../core/types.ts';
import { avatarStyle } from '../../../ui/Avatar.tsx';
import { AisleIcon, Icon } from '../../../ui/icons.tsx';
import { fig } from '../../../ui/Money.tsx';
import { nav } from '../shell/nav.ts';
import { books, now } from '../shell/store.ts';
import type { ScreenProps } from '../shell/types.ts';
import { isNew } from './AislesSheet.tsx';
import { itemKey, whose } from './insights.ts';
import { add, cur, setQty, sums } from './model.ts';
import { openAisles } from './sheets.tsx';
import { ShelfCard, type Card } from './ShelfCard.tsx';
import './aisle.css';

/** An item's kind: the plural word in its name ("Wire nails 4"" → Nails), else its first word. */
export function kindOf(name: string): string {
  const w = name.split(' · ')[0].split(/\s+/), k = w.find((x) => /^[a-z]{4,}s$/i.test(x)) || w[0];
  return k.charAt(0).toUpperCase() + k.slice(1).toLowerCase();
}

/** Cards: an item and its other sizes of sale under one name, most sold first. */
function cardsOf(b: Books, items: Item[]): Card[] {
  const sold = new Map<string, number>();
  b.orders.forEach((o) => { if (!o.voided && !o.cancelled) o.lines.forEach((l) => sold.set(l.itemId, (sold.get(l.itemId) || 0) + 1)); });
  const by = new Map<string, Item[]>();
  items.forEach((it) => { const k = it.name.split(' · ')[0]; by.set(k, [...(by.get(k) || []), it]); });
  return [...by].map(([name, its]) => {
    const list = its.slice().sort((x, y) => (sold.get(y.id) || 0) - (sold.get(x.id) || 0));
    return { name, items: list, sold: list.reduce((s, i) => s + (sold.get(i.id) || 0), 0) };
  }).sort((x, y) => y.sold - x.sold || x.name.localeCompare(y.name));
}

export function AisleScreen(p: ScreenProps): JSX.Element | null {
  const b = books.value, x = cur.value, aisle = String(p.params.aisle || ''), shelf = String(p.params.group || '');
  const shelfMode = !aisle && !!shelf;
  const all = b ? b.items.filter((i) => (shelfMode ? true : i.aisle === aisle)) : [];
  const kinds = [...new Set(all.map((i) => kindOf(i.name)))].map((k) => ({ k, n: cardsOf(b as Books, all.filter((i) => kindOf(i.name) === k)).length }))
    .sort((m, n) => n.n - m.n);
  const [kind, setKind] = useState(shelfMode ? '' : String(p.params.group || '') || (kinds.find((k) => k.k === 'Nails') || kinds[0] || { k: '' }).k);
  const [q, setQ] = useState(''), [more, setMore] = useState(false);
  if (!b || !x) return null;
  const c = x.customerId ? b.customers.find((y) => y.id === x.customerId) || null : null;
  let pool = shelfMode
    ? shelf === 'usual' && c ? b.items.filter((i) => c.usual.some((u) => u.itemId === i.id)) : shelf === 'new' ? b.items.filter((i) => isNew(i.listedAt, now.value)) : b.items
    : all.filter((i) => !kind || kindOf(i.name) === kind);
  if (q.trim()) pool = all.filter((i) => i.name.toLowerCase().includes(q.trim().toLowerCase()));
  const cards = cardsOf(b, pool).slice(0, shelf === 'most' ? 20 : undefined), shown = more ? cards : cards.slice(0, 4);
  const s = sums.value, n = x.lines.length, word = (kind || 'items').toLowerCase();
  const inOrder = new Map(x.lines.map((l) => [itemKey(l), l]));
  return (
    <div class="sl-aisle">
      <div class="sl-aisle-top">
        <div class="sl-aisle-r">
          <button type="button" class="ow-close-c" aria-label={`Back to ${c ? whose(c.name) : 'the'} order`} onClick={() => nav.back()}><Icon name="back" size={20} stroke={2.2} /></button>
          <label class="sl-aisle-q"><Icon name="search" size={20} stroke={2} /><input type="search" placeholder={`Search ${aisle || 'the shop'}`} aria-label={`Search ${aisle || 'the shop'}`} value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} /></label>
        </div>
        <div role="group" aria-label="Show" class="sl-aisle-k">
          <a href="#" class="sl-aisle-a" onClick={(e) => { e.preventDefault(); openAisles(); }}><span aria-hidden="true"><AisleIcon aisle={aisle} size={18} color="#FFFFFF" /></span>{aisle || shelf}<Icon name="chevron-down" size={16} stroke={2.4} /></a>
          {!shelfMode && kinds.map((k) => <button key={k.k} type="button" aria-pressed={kind === k.k} class={kind === k.k ? 'on' : ''} onClick={() => { setKind(k.k); setMore(false); }}>{k.k}<b class="mono">{k.n}</b></button>)}
        </div>
      </div>
      <main class="sl-aisle-m">
        <div class="sl-aisle-c"><span><b class="mono">{cards.length}</b>{` ${word} · most sold first`}</span><span>tap + to add</span></div>
        <div class="sl-aisle-g">
          {shown.map((cd) => {
            const l = cd.items.map((i) => inOrder.get(itemKey(i))).find(Boolean) || null;
            return <ShelfCard key={cd.name} card={cd} kind={kind} line={l} onAdd={(it) => add(it, 1)} onQty={(id, v) => setQty(id, v)} />;
          })}
        </div>
        {!more && cards.length > 4 && <button type="button" class="sl-aisle-more" onClick={() => setMore(true)}>Show <span class="mono">{cards.length - 4}</span>{` more ${word}`}<Icon name="chevron-down" size={16} stroke={2.4} /></button>}
      </main>
      <div class="sl-aisle-bar">
        <span class="sl-aisle-who">{c ? <span aria-hidden="true" class="ow-av" style={avatarStyle({ initials: c.initials, tint: c.tint, size: 42, font: 13 })}>{c.initials}</span> : null}<span aria-hidden="true" class="mono sl-aisle-n">{n}</span></span>
        <span class="sl-aisle-t"><span class="mono">{fig(s ? s.total : 0)}</span>{s && s.coming > 0 && <span class="mono">{`${s.coming} price${s.coming === 1 ? '' : 's'} coming`}</span>}</span>
        <a href="#" class="sl-aisle-done" onClick={(e) => { e.preventDefault(); nav.back(); }}>Done<Icon name="check" size={18} stroke={2.4} /></a>
      </div>
    </div>
  );
}
