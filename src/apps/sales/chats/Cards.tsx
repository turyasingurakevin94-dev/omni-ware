/*
 * What the app reads in a chat, as a card under it, so the next step is one tap:
 *   WantsCard  CH14: a new number's words or photo read as an item on our shelf; Start order
 *   PaidCard   CH15: "I sent 165,000 on Mobile this morning" beside what they owe, split into
 *              what to collect and what Esther is checking; Take payment
 */
import type { JSX } from 'preact';
import { money } from '../../../core/money.ts';
import { firstWord } from '../../../core/names.ts';
import { clock } from '../../../core/time.ts';
import type { Item } from '../../../core/types.ts';
import { Duo, Icon, phSparkle } from '../../../ui/icons.tsx';
import { ItemSquare } from '../../../ui/ItemSquare.tsx';
import { Tap } from '../../../ui/util.tsx';
import { METHOD_WORD, type SaysPaid } from './read.ts';

export function WantsCard(p: { who: string; at: number; items: Item[]; onStart: () => void }): JSX.Element {
  const n = p.items.length;
  return (
    <div class="cv-card buy">
      <div class="cv-card-h"><span style={{ display: 'flex' }}><Duo i={phSparkle} size={16} color="#0F6B43" /></span><span>{`${p.who} wants to buy`}</span><span>{`read from ${clock(p.at)}`}</span></div>
      {p.items.map((it) => (
        <div key={it.id} class="cv-line">
          <ItemSquare aisle={it.aisle} size={34} radius={10} icon={20} />
          <span><span>{it.name}</span><span class="mono">{`${money(it.price)} a ${it.unit}`}</span></span>
          {(it.onShelf || 0) > 0 ? <span class="cv-shelf mono">{`${it.onShelf} on shelf`}</span> : <span class="cv-shelf">{it.orderIn ? 'Order in' : 'Out'}</span>}
        </div>
      ))}
      <div class="cv-buy-f">
        <span><b>How many?</b><span>{`${n} line${n === 1 ? '' : 's'} · ask them`}</span></span>
        <Tap on={p.onStart} class="cv-go">Start order<Icon name="arrow-right" size={16} stroke={2.4} /></Tap>
      </div>
    </div>
  );
}

export interface PaidCardProps {
  who: string;
  paid: SaysPaid;
  owes: number;
  checked: number;
  checker: string;
  onTake: () => void;
}

export function PaidCard(p: PaidCardProps): JSX.Element {
  const collect = Math.max(0, p.owes - p.checked), take = Math.min(p.paid.amount, collect || p.paid.amount);
  const how = [p.paid.method ? METHOD_WORD[p.paid.method] : '', p.paid.when].filter(Boolean).join(' · ');
  return (
    <div class="cv-card paid">
      <div class="cv-card-h"><span style={{ display: 'flex', color: '#1A5A8A' }}><Icon name="mobile" size={15} stroke={2.2} /></span><span>{`${firstWord(p.who)} says they paid`}</span><span>{`read from ${clock(p.paid.at)}`}</span></div>
      <div class="cv-paid-n"><b>{money(p.paid.amount)}</b><span>{how}</span></div>
      {p.owes > 0 && (
        <div role="img" aria-label={`They owe ${money(p.owes)}: ${money(collect)} to collect, ${money(p.checked)} being checked by ${p.checker}`} class="cv-split">
          <span>
            {collect > 0 && <span style={{ flex: collect, background: '#95530C' }} />}
            {p.checked > 0 && <span style={{ flex: p.checked, background: 'repeating-linear-gradient(135deg, #1A5A8A 0 4px, #9DB7E0 4px 8px)' }} />}
          </span>
          <span><span style={{ color: '#7A4A02' }}><b>{money(collect)}</b> to collect</span>{p.checked > 0 && <span style={{ color: '#1A5A8A' }}><b>{money(p.checked)}</b> Being checked</span>}</span>
        </div>
      )}
      <Tap on={p.onTake} class="cv-take-pay"><Icon name="cash" size={17} stroke={2} />Take payment · <span class="mono">{money(take)}</span></Tap>
    </div>
  );
}
