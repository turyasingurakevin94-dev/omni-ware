/*
 * Finding an item while building the order (P05's search):
 *   SL08  "40 sheets" read as ×40 · sheets: the one they buy first, with the count and "Add · 1,520,000";
 *         more of the same word under it, each "+40" (or "Ask Moses" when it is out)
 *   SL09  nothing called that: the closest the shop has, and "Ask Moses to stock it" (an ask of Sourcing)
 * Enter takes the first answer: added with the count, or its "Price coming" sheet, or a carton for a kg.
 */
import { signal } from '@preact/signals';
import type { JSX } from 'preact';
import { lineTotal } from '../../../core/money.ts';
import type { Books, Customer, Item } from '../../../core/types.ts';
import { Duo, Icon, phAgain, phSearch } from '../../../ui/icons.tsx';
import { ItemSquare } from '../../../ui/ItemSquare.tsx';
import { fig } from '../../../ui/Money.tsx';
import { Stepper } from '../../../ui/Stepper.tsx';
import { useEffect } from 'preact/hooks';
import { books, now, source } from '../shell/store.ts';
import { closest, findItems, readAsk, sameAsk, type Asked } from './find.ts';
import { first, itemKey, lastQty, rankFor, theirItems } from './insights.ts';
import { AskCard, send } from './AskCard.tsx';
import { askedAs, closeLine } from './Lines.tsx';
import { add, cur, lineFor, openId, query } from './model.ts';
import { sourcing } from './people.ts';
import { openPriceComing } from './sheets.tsx';
import './find.css';

/** The count on the first answer (its stepper). */
const count = signal<number | null>(null);

function Mark(p: { name: string; words: string[] }): JSX.Element {
  const ws = p.words.map((w) => w.replace(/(es|s)$/, '').toLowerCase()).filter((w) => w.length > 1);
  const parts = p.name.split(/(\s+)/);
  return <>{parts.map((t, i) => (ws.includes(t.toLowerCase()) ? <mark key={i}>{t}</mark> : t))}</>;
}

/** Add what was found, as it was asked: a whole carton for kg of a carton-only item (SL15). */
export function addAsked(b: Books, it: Item, a: Asked, c: Customer | null): void {
  if (it.price == null) { openPriceComing(it.id, null, a.qty || (c ? lastQty(b, c.id, it.id) : null) || 1); return; }
  closeLine();
  const qty = a.qty || 1;
  if (a.unit && a.unit !== it.unit && it.packUnit === a.unit && it.packQty > 0) {
    const whole = Math.max(1, Math.ceil(qty / it.packQty)), l = add(it, whole);
    const alt = b.items.find((x) => x.id !== it.id && x.unit === a.unit && x.name.split(' · ')[0] === it.name.split(' · ')[0]) || null;
    askedAs.value = new Map([[l.lineId, { qty, unit: a.unit, alt }]]);
    openId.value = l.lineId;
  } else add(it, qty);
  query.value = '';
  count.value = null;
}

export function enterFind(): void {
  const b = books.value, x = cur.value;
  if (!b || !x) return;
  const c = x.customerId ? b.customers.find((y) => y.id === x.customerId) || null : null;
  const a = readAsk(query.value), hits = findItems(b, a, rankFor(b, c, now.value));
  // Added: the field lets go (SL15); a "Price coming" sheet keeps it (SL21).
  if (hits[0] && hits[0].price != null) (document.activeElement as HTMLElement | null)?.blur();
  if (hits[0]) addAsked(b, hits[0], a, c);
}

export function Find(p: { b: Books; c: Customer | null }): JSX.Element {
  const b = p.b, c = p.c, a = readAsk(query.value), theirs = c ? theirItems(b, c) : new Set<string>();
  const hits = findItems(b, a, rankFor(b, c, now.value));
  if (!hits.length) return <Nothing b={b} c={c} a={a} />;
  const top = hits[0], more = hits.slice(1), q = count.value ?? (a.qty || 1);
  const word = a.words[a.words.length - 1] || '';
  const line = lineFor(top, q, 0);
  return (
    <>
      <div class="sl-read"><Icon name="spark" size={15} stroke={2} />Read as{a.qty != null && <span class="mono sl-read-n">{`×${a.qty}`}</span>}{a.words.map((w) => <span key={w} class="sl-read-w">{w}</span>)}</div>
      <div class="sl-top">
        <div class="sl-top-h">
          <ItemSquare aisle={top.aisle} size={44} />
          <div class="sl-top-t"><span><Mark name={top.name} words={a.words} /></span><span><span class="mono">{fig(top.price || 0)}</span><span>{`/${top.unit}`}</span>{(top.onShelf || 0) > 0 && <span class="sl-shelf5"><b class="mono">{fig(top.onShelf as number)}</b> on shelf</span>}</span></div>
          {c && theirs.has(itemKey(top)) && <span class="sl-buys"><Duo i={phAgain} size={12} color="#0F6B43" />{`${first(c.name)} buys`}</span>}
        </div>
        <div class="sl-top-r">
          <Stepper value={q} unit={top.unit} min={1} onChange={(n) => { count.value = n; }} />
          <a href="#" class="sl-top-add" onClick={(e) => { e.preventDefault(); addAsked(b, top, { ...a, qty: q }, c); }}>Add · <span class="mono">{fig(lineTotal(line))}</span></a>
        </div>
      </div>
      {more.length > 0 && (
        <>
          <div class="sl-more-h"><span>{`More ${word}`}</span><span class="mono">{more.length}</span></div>
          <div class="sl-more">
            {more.map((it) => {
              const out = !it.orderIn && !(it.onShelf || 0);
              return (
                <div class="sl-more-r" key={itemKey(it)}>
                  <ItemSquare aisle={it.aisle} size={40} />
                  <span class="sl-more-t"><span><Mark name={it.name} words={a.words} /></span><span><span class="mono">{fig(it.price || 0)}</span><span>{`/${it.unit}`}</span>
                    {out ? <span class="sl-tag bad">Out</span> : it.orderIn && !(it.onShelf || 0) ? <span class="sl-tag info">Order in</span> : <span class="sl-shelf5"><b class="mono">{fig(it.onShelf as number)}</b> on shelf</span>}</span></span>
                  {out
                    ? <a href="#" class="sl-more-ask" onClick={(e) => { e.preventDefault(); void send(it.name, q, c, `Sent to ${sourcing(b).first}`); }}>{`Ask ${sourcing(b).first}`}</a>
                    : <button type="button" class="mono sl-more-add" aria-label={`Add ${q}`} onClick={() => addAsked(b, it, { ...a, qty: q }, c)}>{`+${q}`}</button>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

function Nothing(p: { b: Books; c: Customer | null; a: Asked }): JSX.Element {
  const b = p.b, c = p.c, a = p.a, near = closest(b, a), ask = sameAsk(b.asks, a);
  const name = ask ? ask.name : a.words.join(' ').replace(/^./, (s) => s.toUpperCase());
  const plain = name.replace(/\s+\d+\s*(mm|cm|m|inch|")$/i, '').toLowerCase();
  useEffect(() => {
    // A search that found nothing goes to Sourcing's log (log_search_miss), once per words.
    const t = window.setTimeout(() => source.logSearchMiss(query.value.trim(), c ? c.name : null), 1200);
    return () => clearTimeout(t);
  }, [query.value]);
  return (
    <div class="sl-nothing">
      <div class="sl-none">
        <span aria-hidden="true" class="sl-none-ic"><Duo i={phSearch} size={26} color="#5F6980" /><span>?</span></span>
        <span class="sl-none-t"><span>{`Nothing called “${a.words.join(" ") || query.value.trim()}”`}</span><span>{`The shop doesn’t sell a ${plain}`}</span></span>
      </div>
      {near.length > 0 && (
        <div class="sl-near">
          <span class="sl-near-h">Closest in the shop</span>
          {near.map((it) => (
            <div class="sl-near-r" key={itemKey(it)}>
              <ItemSquare aisle={it.aisle} size={40} />
              <span class="sl-more-t"><span>{it.name}</span><span><span class="mono b">{fig(it.price || 0)}</span><span>{`/${it.unit}`}</span>{(it.onShelf || 0) > 0 && <span class="sl-shelf"><b class="mono">{fig(it.onShelf as number)}</b> on shelf</span>}</span></span>
              <button type="button" class="sl-near-add" aria-label={`Add ${it.name}`} onClick={() => addAsked(b, it, { ...a, qty: 1, unit: null }, c)}><Icon name="plus" size={16} stroke={2.6} /></button>
            </div>
          ))}
        </div>
      )}
      <AskCard b={b} c={c} ask={ask && ask.status !== 'listed' ? ask : null} name={name} qty={a.qty || 1} />
    </div>
  );
}
