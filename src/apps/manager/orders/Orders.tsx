/*
 * Orders (route `orders`, Orders p1): the navy head "Orders 10" with the five stage columns (the count,
 * the salespeople's dots, the badge of how many wait on you), "1 stuck · 5 wait on you · 8,810,000 on
 * the move"; the chips All · Stuck · {Ruth} decides; the stuck orders first with their answers on the
 * row; then the rest by stage. A column scrolls to its stage (Delivered opens To bill).
 */
import type { JSX } from 'preact';
import { columns, headLine, listed } from '../../../core/manager/orders.ts';
import { stuck as stuckOf } from '../../../core/manager/watch.ts';
import type { MOrder, Stage } from '../../../core/manager/types.ts';
import { STAGE, STAGES } from '../../../core/manager/words.ts';
import { money } from '../../../core/money.ts';
import { firstWord } from '../../../core/names.ts';
import { PageHead } from '../../../ui/PageHead.tsx';
import { ChipRow, FilterChip } from '../../../ui/Pill.tsx';
import type { Params } from '../../../ui/stack.ts';
import { nav } from '../shell/nav.ts';
import { books, now, waiting } from '../shell/store.ts';
import { Empty, H2, StageCols, tintBg } from './Bits.tsx';
import { OrderCard } from './OrderCard.tsx';
import './orders.css';

export type Filter = 'all' | 'stuck' | 'ruth';

export function Orders(p: { params: Params }): JSX.Element | null {
  const b = books.value;
  if (!b) return null;
  const q = waiting.value, t = now.value;
  const f = (['all', 'stuck', 'ruth'].includes(p.params.filter as string) ? p.params.filter : 'all') as Filter;
  const all = listed(b), st = stuckOf(b, t).map((x) => x.o), line = headLine(b, q, t);
  const waits = (o: MOrder) => q.some((a) => a.orderId === o.id);
  const shown = f === 'stuck' ? st : f === 'ruth' ? all.filter(waits) : all;
  const top = shown.filter((o) => st.includes(o));
  const rest = shown.filter((o) => !st.includes(o));
  const seller = (o: MOrder) => tintBg(b.team.find((x) => x.id === o.sellerId));
  const go = (s: Stage) => {
    if (s === 'completed') { nav.push('orders/bill', {}); return; }
    const el = document.getElementById('mg-orders-' + s);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const setF = (x: Filter) => nav.replace('orders', x === 'all' ? {} : { filter: x });
  return (
    <main class="mg-orders">
      <PageHead title="Orders" count={line.count}>
        <StageCols cols={columns(b, q)} tint={seller} on={go} />
        <div class="mg-orders-line">
          <button type="button" class="w" disabled={!line.stuck} onClick={() => nav.push('orders/stuck', {})}>{`${line.stuck} stuck`}</button>
          <span>{`${line.waits} wait on you`}</span>
          <span><span class="mono">{money(line.moving)}</span> on the move</span>
        </div>
      </PageHead>
      <div class="mg-orders-body">
        <ChipRow label="Show">
          <FilterChip on={f === 'all'} count={all.length} onClick={() => setF('all')}>All</FilterChip>
          <FilterChip on={f === 'stuck'} dot="#8E2A22" count={st.length} onClick={() => setF('stuck')}>Stuck</FilterChip>
          <FilterChip on={f === 'ruth'} count={all.filter(waits).length} onClick={() => setF('ruth')}>{`${firstWord(b.me.name)} decides`}</FilterChip>
        </ChipRow>
        {!shown.length && <Empty />}
        {top.map((o) => <OrderCard key={o.id} o={o} b={b} q={q} now={t} stuck />)}
        {STAGES.map((s) => {
          const os = rest.filter((o) => o.stage === s);
          if (!os.length) return null;
          return (
            <section key={s} class="mg-orders-group">
              <H2 id={'mg-orders-' + s} title={STAGE[s]} count={os.length} />
              {os.map((o) => <OrderCard key={o.id} o={o} b={b} q={q} now={t} />)}
            </section>
          );
        })}
      </div>
    </main>
  );
}
