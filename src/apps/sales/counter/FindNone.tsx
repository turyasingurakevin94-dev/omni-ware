/*
 * KC21 · Nothing called "tile cutter": the closest the shelf has, one tap adds one; or ask Sourcing
 * to stock it (askSourcing; SL09's language). Drawn by the counter builder, to the critic.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { Duo, Icon, phPlane, phSearch } from '../../../ui/icons.tsx';
import { ItemSquare } from '../../../ui/ItemSquare.tsx';
import { fig } from '../../../ui/Money.tsx';
import { toast } from '../../../ui/toast.tsx';
import { findItems } from '../../../core/items.ts';
import type { Books, Item } from '../../../core/types.ts';
import { act } from '../shell/store.ts';
import './findnone.css';

/** The closest: items holding any one of the words, on the shelf, two at most, A to Z. */
function closest(b: Books, words: string): Item[] {
  const seen = new Set<string>(), out: Item[] = [];
  words.split(/\s+/).filter((w) => w.length > 2).forEach((w) => findItems(b.items, w).forEach((it) => {
    if (!seen.has(it.id) && (it.onShelf || 0) > 0 && out.length < 2) { seen.add(it.id); out.push(it); }
  }));
  return out.sort((x, y) => x.name.localeCompare(y.name));
}

export function FindNone(p: { b: Books; words: string; qty: number; customer: string | null; who: string; onAdd: (it: Item) => void }): JSX.Element {
  const [when, setWhen] = useState<'week' | 'any'>('week');
  const [sent, setSent] = useState(false);
  const w = p.words.trim(), near = closest(p.b, w), lw = w.toLowerCase();
  // An ask already open with these words is asked again (askSourcing adds the request to it).
  const ask = p.b.asks.find((a) => a.status !== 'dropped' && a.name.toLowerCase().includes(lw));
  const name = ask ? ask.name : w.charAt(0).toUpperCase() + w.slice(1);
  const moses = p.b.members.find((m) => m.role === 'sourcing'), first = moses ? moses.name.split(' ')[0] : 'Sourcing';
  const send = async () => {
    if (sent) return;
    setSent(true);
    try {
      await act('askSourcing', { name, qty: p.qty, customerId: p.customer, chatId: null });
      toast.show(`Sent to ${first}`);
    } catch (e) {
      setSent(false);
      toast.show('Not sent', { kind: 'error', sub: (e as Error).message });
    }
  };
  return (
    <>
      <div class="kc-none">
        <span aria-hidden="true" class="kc-none-i"><Duo i={phSearch} size={26} color="#5F6980" /><span>?</span></span>
        <span class="kc-none-t"><b>{`Nothing called “${w}”`}</b><span>{`The shop doesn’t sell a ${lw}`}</span></span>
      </div>
      {!!near.length && (
        <div class="kc-near">
          <span class="kc-near-k">Closest in the shop</span>
          {near.map((it) => (
            <div key={it.id} class="kc-near-r">
              <ItemSquare aisle={it.aisle} size={40} />
              <span class="kc-near-t">
                <span class="n">{it.name}</span>
                <span class="s"><span class="mono">{fig(it.price || 0)}</span><span class="u">{`/${it.unit}`}</span><span class="kc-near-sh"><b class="mono">{fig(it.onShelf || 0)}</b>on shelf</span></span>
              </span>
              <button type="button" class="kc-near-a" aria-label={`Add ${it.name}`} onClick={() => p.onAdd(it)}><Icon name="plus" size={16} stroke={2.6} /></button>
            </div>
          ))}
        </div>
      )}
      <div class="kc-askm">
        <div class="kc-askm-h">
          <span aria-hidden="true"><Duo i={phPlane} size={22} color="#6FDCB0" /></span>
          <span><b>{`Ask ${first} to stock it`}</b><span>{`${name} · for ${p.who}`}</span></span>
        </div>
        <div class="kc-askm-o">
          <span class="mono">{p.qty}<span class="ow-word">pc</span></span>
          <span role="radiogroup" aria-label="When">
            <button type="button" role="radio" aria-checked={when === 'week'} class={when === 'week' ? 'on' : ''} onClick={() => setWhen('week')}>This week</button>
            <button type="button" role="radio" aria-checked={when === 'any'} class={when === 'any' ? 'on' : ''} onClick={() => setWhen('any')}>Any time</button>
          </span>
        </div>
        <button type="button" class="kc-askm-go" disabled={sent} onClick={() => void send()}><Icon name="send" size={17} stroke={2.2} />{`Send to ${first}`}</button>
      </div>
    </>
  );
}
