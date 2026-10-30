/*
 * SL11 · browse the shop: every aisle as a tile, the ones this customer
 * buys from marked; quick shelves (their usual, what is new, what sells
 * most); a search over the whole shop. A tile opens the aisle (SL12).
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import type { Books, Customer } from '../../../core/types.ts';
import { Duo, phAgain, phFlame, phGrid, phSearch, phSparkle } from '../../../ui/icons.tsx';
import { ItemSquare } from '../../../ui/ItemSquare.tsx';
import { fig } from '../../../ui/Money.tsx';
import { sheet } from '../../../ui/sheet.tsx';
import { books, now } from '../shell/store.ts';
import { Frame } from './Frame.tsx';
import { aisleMarks, aisles, whose } from './insights.ts';
import { cur, query } from './model.ts';
import { openAisle } from './sheets.tsx';
import './aisles.css';

/** Items listed in the last 30 days ("New"). */
export const isNew = (listedAt: number | null, t: number) => !!listedAt && t - listedAt <= 30 * 864e5;

export function AislesSheet(): JSX.Element | null {
  const b = books.value, x = cur.value, [q, setQ] = useState('');
  if (!b) return null;
  const c: Customer | null = x && x.customerId ? b.customers.find((y) => y.id === x.customerId) || null : null;
  const all = aisles(b), n = all.reduce((s, a) => s + a.count, 0), marks = aisleMarks(b, c);
  const fresh = b.items.filter((i) => isNew(i.listedAt, now.value)).length;
  const go = (v: string) => { query.value = v; sheet.close(); };
  return (
    <Frame title="Browse the shop" sub={`${fig(n)} items · ${all.length} aisles`} onClose={sheet.close} ground pad="12px 16px 20px">
      <label class="sl-who-q">
        <Duo i={phSearch} size={19} color="#5F6980" />
        <input type="search" placeholder={`Search ${fig(n)} items`} aria-label="Search the shop" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} onKeyDown={(e) => { if (e.key === 'Enter') go(q); }} />
      </label>
      <div class="sl-shelves">
        {c && c.usual.length > 0 && <Shelf tone="info" icon={<Duo i={phAgain} size={18} color="#1A5A8A" />} word={`${whose(c.name)} usual`} n={c.usual.length} on={() => openAisle('', 'usual')} />}
        <Shelf tone="good" icon={<Duo i={phSparkle} size={18} color="#0F6B43" />} word="New" n={fresh} on={() => openAisle('', 'new')} />
        <Shelf tone="warn" icon={<Duo i={phFlame} size={18} color="#95530C" />} word="Most sold" n={20} on={() => openAisle('', 'most')} />
      </div>
      <div class="sl-sec in-sheet"><Duo i={phGrid} size={18} color="#5F6980" /><h2>Aisles</h2>{c && marks.size > 0 && <span class="sl-sec-k"><Duo i={phAgain} size={13} color="#0F6B43" />{` ${c.name.split(' ')[0]} buys here`}</span>}</div>
      <div class="sl-tiles">
        {all.map((a) => {
          const mk = marks.get(a.name);
          return (
            <a key={a.name} href="#" class="sl-tile" onClick={(e) => { e.preventDefault(); openAisle(a.name); }}>
              <ItemSquare aisle={a.name} size={38} />
              {mk ? <span class="mono sl-tile-mk"><Duo i={phAgain} size={12} color="#0F6B43" />{mk}</span> : null}
              <span class="sl-tile-t"><b>{a.name}</b><span class="mono">{`${fig(a.count)} items`}</span></span>
            </a>
          );
        })}
      </div>
    </Frame>
  );
}

function Shelf(p: { tone: 'info' | 'good' | 'warn'; icon: JSX.Element; word: string; n: number; on: () => void }): JSX.Element {
  return (
    <a href="#" class={'sl-shelfchip ' + p.tone} onClick={(e) => { e.preventDefault(); p.on(); }}>
      <span aria-hidden="true" class="sl-shelfchip-ic">{p.icon}</span>{p.word}<span class="mono sl-shelfchip-n">{p.n}</span>
    </a>
  );
}

export const shelfCount = (b: Books) => b.items.length;
