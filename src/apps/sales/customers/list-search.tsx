/*
 * Search (CU05): by name, phone or place. A name typed one letter off is
 * caught ("Did you mean"), with the letter shown; anyone else can be added
 * as new, with what was typed; then who was opened lately.
 */
import type { JSX } from 'preact';
import { Icon } from '../../../ui/icons.tsx';
import { short as shortMoney } from '../../../core/money.ts';
import { phone9 } from '../../../core/names.ts';
import type { Books, Customer } from '../../../core/types.ts';
import type { Acts } from './list-bodies.tsx';
import type { ListData, Who } from './list-data.ts';
import { Card, Group, Row } from './local-row.tsx';
import { placeKind } from './data.ts';

/** One edit apart (a letter missing, extra or changed): the index where they part. */
function oneOff(a: string, b: string): number | null {
  if (a === b || Math.abs(a.length - b.length) > 1) return null;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const rest = (x: string, y: string) => x === y;
  if (a.length === b.length) return rest(a.slice(i + 1), b.slice(i + 1)) ? i : null;
  if (a.length < b.length) return rest(a.slice(i), b.slice(i + 1)) ? i : null;
  return rest(a.slice(i + 1), b.slice(i)) ? i : null;
}

export interface Hit { w: Who; at: number; word: [string, string] | null }

export function search(d: ListData, q: string): { found: Who[]; near: Hit[] } {
  const t = q.trim().toLowerCase(), digits = q.replace(/\D/g, '');
  if (!t) return { found: [], near: [] };
  const found = d.all.filter((w) => w.c.name.toLowerCase().includes(t) || w.c.place.toLowerCase().includes(t) || (digits.length >= 3 && phone9(w.c.phone).includes(digits.replace(/^0/, ''))));
  const near: Hit[] = [];
  if (!found.length) {
    d.all.forEach((w) => {
      const name = w.c.name.toLowerCase(), at = oneOff(t, name);
      if (at == null) return;
      // The word it is in, as typed and as it is.
      const s = name.lastIndexOf(' ', at) + 1, e1 = (t + ' ').indexOf(' ', at), e2 = (name + ' ').indexOf(' ', at);
      near.push({ w, at, word: [q.trim().slice(s, e1), w.c.name.slice(s, e2)] });
    });
  }
  return { found, near };
}

export function SearchBody(p: { b: Books; d: ListData; q: string; a: Acts; opened: { c: Customer; when: string }[]; onNew: () => void }): JSX.Element {
  const { found, near } = search(p.d, p.q), byId = (c: Customer) => p.d.all.find((w) => w.c.id === c.id) as Who;
  const orders = (c: Customer) => p.b.orders.filter((o) => o.customerId === c.id).length;
  const row = (w: Who, sub: string, name: JSX.Element | string = w.c.name) => (
    <Row key={w.c.id} initials={w.c.initials} tint={w.c.tint} tone={w.r.tone} fill={w.r.fill} label={w.c.name.replace(/&/g, 'and')} name={name} sub={sub}
      fig={w.m.owes > 0 ? shortMoney(w.m.owes) : null} word="owes" act="wa" on={() => p.a.open(w.c)} onAct={() => p.a.wa(w.c)} />
  );
  return (
    <>
      {found.length > 0 && <div class="cu-grp"><Group title="Found" count={found.length} /><Card>{found.map((w) => row(w, [placeKind(w.c), `${orders(w.c)} orders`].filter(Boolean).join(' · ')))}</Card></div>}
      {!found.length && near.length > 0 && (
        <>
          <div class="cu-mean"><h2>Did you mean</h2><span>nobody is called that</span></div>
          {near.map((h) => {
            const n = h.w.c.name;
            const name = <>{n.slice(0, h.at)}<b class="cu-mark">{n[h.at]}</b>{n.slice(h.at + 1)}</>;
            return (
              <div key={h.w.c.id} class="cu-near">
                {row(h.w, [h.w.c.place, `${orders(h.w.c)} orders`].filter(Boolean).join(' · '), name)}
                {h.word && <div class="cu-near-fix"><s class="mono">{h.word[0]}</s><span aria-hidden="true"><Icon name="arrow-right" size={14} stroke={2.2} /></span><b>{h.word[1]}</b><span>one letter off</span></div>}
              </div>
            );
          })}
        </>
      )}
      <button type="button" class="cu-new" onClick={p.onNew}>
        <span aria-hidden="true"><Icon name="person-plus" size={20} stroke={2} /></span>
        <span><span>Someone new</span><span>{`add “${p.q.trim()}” as a customer`}</span></span>
        <span aria-hidden="true" class="ow-chev"><Icon name="chevron-right" size={16} stroke={2.4} /></span>
      </button>
      {p.opened.length > 0 && (
        <div class="cu-grp lately"><Group title="Opened lately" count={p.opened.length} /><Card>{p.opened.map((o) => row(byId(o.c), o.when))}</Card></div>
      )}
    </>
  );
}
