/*
 * A search nobody matches (Suppliers.dc.html phone 4): "Nobody sells it",
 * none of the suppliers lit, the close match from the price list, and the
 * one move: Ask Moses to find it (Sourcing gets it in his Asked list).
 * Clear search is the quiet way back.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import type { BuyerBooks } from '../../../core/buyer/types.ts';
import { GroupCard } from '../../../ui/ActRow.tsx';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Button } from '../../../ui/Button.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { fig } from '../../../ui/Money.tsx';
import { SectionHead } from '../../../ui/SectionHead.tsx';
import { toast } from '../../../ui/toast.tsx';
import { nav } from '../shell/nav.ts';
import { act } from '../shell/store.ts';
import { byRole, first, SupTile } from './parts.tsx';
import { closeTo } from './rules.ts';
import './nomatch.css';

export function NoMatch(p: { b: BuyerBooks; q: string; onClear: () => void }): JSX.Element {
  const [sending, setSending] = useState(false);
  const moses = byRole(p.b, 'sourcing'), who = first(moses, 'Sourcing');
  const close = closeTo(p.b, p.q), n = p.b.suppliers.length, words = p.q.trim();

  const ask = async () => {
    setSending(true);
    try {
      const r = await act('askSourcing', words);
      if (r.kept) toast.show('No signal · saved on this phone', { kind: 'warn', sub: `${who} sees it when back` });
      else toast.show(`${who} is told`, { sub: `${words} · Asked` });
      p.onClear();
    } catch (_e) {
      toast.show('Not sent', { kind: 'error', sub: `Ask ${who} to find ${words}`, retry: () => { void ask(); } });
    } finally { setSending(false); }
  };

  return (
    <div class="ow-b-suppliers-none">
      <div class="ow-b-suppliers-none-card">
        <span aria-hidden="true" class="ow-b-suppliers-none-mark">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2M9 9l4 4M13 9l-4 4" /></svg>
        </span>
        <span class="ow-b-suppliers-none-t">Nobody sells it</span>
        <span class="ow-b-suppliers-none-bars" role="img" aria-label={`0 of ${n} suppliers`}>
          {Array.from({ length: n }, (_, i) => <i key={i} />)}
        </span>
        <span class="mono ow-b-suppliers-none-n">{`0 of ${n} suppliers`}</span>
      </div>
      {close.length > 0 && (
        <>
          <SectionHead title="Close to it" right={<b class="mono ow-b-suppliers-zero">{close.length}</b>} />
          <GroupCard pad={12}>
            {close.map((c) => (
              <button key={c.price.supplierId + c.price.item} type="button" class="ow-b-suppliers-close"
                aria-label={`${c.price.item} from ${c.supplier.name}, ${fig(c.price.price)} a ${c.price.unit}`}
                onClick={() => nav.push('suppliers/one', { id: c.supplier.id })}>
                <SupTile name={c.supplier.name} size={38} />
                <span class="ow-b-suppliers-close-t">
                  <span>{c.price.item.split(' ').map((w, i) => (
                    <span key={i}>{i ? ' ' : ''}{c.same.has(w.toLowerCase().replace(/×/g, 'x')) ? w : <b>{w}</b>}</span>
                  ))}</span>
                  <span class="mono">{`${c.supplier.name} · ${fig(c.price.price)} / ${c.price.unit}`}</span>
                </span>
                <span aria-hidden="true" class="ow-chev"><Icon name="chevron-right" size={16} stroke={2.2} /></span>
              </button>
            ))}
          </GroupCard>
        </>
      )}
      <Button h={52} icon="send" state={sending ? 'sending' : 'idle'} onClick={() => { void ask(); }}>{`Ask ${who} to find it`}</Button>
      <button type="button" class="ow-b-suppliers-quiet" onClick={p.onClear}>Clear search</button>
      <div class="ow-b-suppliers-told" role="img" aria-label={`${who} is told and gets it in his Asked list`}>
        {moses && <Avatar initials={moses.initials} tint={moses.tint} size={30} />}
        {`${who} is told · `}<b>Asked</b><Icon name="bell" size={14} stroke={2} />
      </div>
    </div>
  );
}
