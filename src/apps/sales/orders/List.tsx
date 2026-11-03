/*
 * OR01–OR04 · Orders: Grace's orders by stage, acted on from the row, and Find.
 *   OR01 all stages (Take 1.1M, Tell from the row; Packing folds behind "Show 2 more")
 *   OR02 Delivered this week (the chip row scrolled to it)
 *   OR03 Find "kato": the customer, Take 420k, their orders on the move and delivered
 *   OR04 nothing on the move: the ghost, Get going, New order
 */
import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { orderOwes, orderTotal, short } from '../../../core/money.ts';
import { STAGES, STAGE_WORD, orderNo } from '../../../core/names.ts';
import { dayOf, daysApart, dayLabel, weekday, clock } from '../../../core/time.ts';
import type { Books, Order, Stage } from '../../../core/types.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { GroupCard } from '../../../ui/ActRow.tsx';
import { Checklist } from '../../../ui/Empty.tsx';
import { Button } from '../../../ui/Button.tsx';
import { Duo, Icon, phSearch, phWhatsapp, STAGE_ICON } from '../../../ui/icons.tsx';
import { PageHead, StageBar } from '../../../ui/PageHead.tsx';
import { ChipRow, FilterChip } from '../../../ui/Pill.tsx';
import { GroupHead } from '../../../ui/SectionHead.tsx';
import { STAGE_DOT } from '../../../ui/StageGroup.tsx';
import { GhostTiles } from '../../../ui/StageTiles.tsx';
import { nav } from '../shell/nav.ts';
import { books, now } from '../shell/store.ts';
import type { ScreenProps } from '../shell/types.ts';
import { LIVE, doneThisWeek, faceOf, findOrders, liveOrders, nameOf, placedWhen, doneWhen, rowStatus, shortItem, shownRows, sortRows, stageCounts, takeAmount, kept, twinOf } from './data.ts';
import { CustOrderRow, OrderRow, ShowMore } from './local-OrderRow.tsx';
import { go, openOrder, payFor } from './links.ts';
import { openTell } from './Tell.tsx';

type Filter = Stage | 'all';

export function OrdersList(p: ScreenProps): JSX.Element {
  const b = books.value, t = now.value;
  const [filter, setFilter] = useState<Filter>((p.params.stage as Stage) || 'all');
  const [oldest, setOldest] = useState(false);
  const [q, setQ] = useState(typeof p.params.q === 'string' ? p.params.q : '');
  const [open, setOpen] = useState<Stage[]>([]);
  const chips = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = chips.current?.querySelector('[role=group]') as HTMLElement | null;
    const on = row?.querySelector('[aria-pressed=true]') as HTMLElement | null;
    if (!row || !on) return;
    const over = on.getBoundingClientRect().right + 32 - row.getBoundingClientRect().right;
    if (filter === 'all') row.scrollLeft = 0; else if (over > 0) row.scrollLeft += over;
  }, [filter]);
  if (!b) return <main class="or-main" aria-busy="true" />;
  const counts = stageCounts(b, t), total = STAGES.reduce((a, s) => a + counts[s], 0);
  const live = liveOrders(b), done = doneThisWeek(b, t);
  const list = (s: Stage) => sortRows(s === 'delivered' ? done : live.filter((o) => o.stage === s), s, oldest);
  const head = (
    <PageHead title="Orders" count={total}
      actions={[{ icon: 'sort', label: oldest ? 'Sort: newest first' : 'Sort: oldest first', on: () => setOldest(!oldest) }]}>
      {total ? <StageBar counts={counts} /> : <EmptyBar />}
      <FindField value={q} onInput={setQ} />
    </PageHead>
  );
  // Every way off this list first writes the Find query into its params ('' once cleared), so Back lands where it
  // left: on the search rows (OR29 → OR30), or on the full list after Clear. Written on leaving, not per key: a
  // replace remounts the screen, which would drop the field's focus on every letter.
  const leave: Leave = (go1) => () => { if ((typeof p.params.q === 'string' ? p.params.q : '') !== q) nav.replace('orders', { ...p.params, q }); go1(); };
  if (q.trim()) return <>{head}<Found b={b} q={q} t={t} leave={leave} /></>;
  if (!total) return <>{head}<Empty b={b} /></>;
  const stages = filter === 'all' ? STAGES : [filter];
  return (
    <>
      {head}
      <main class="or-main">
        <div ref={chips}>
          <ChipRow label="Show">
            <FilterChip on={filter === 'all'} count={total} onClick={() => setFilter('all')}>All</FilterChip>
            {STAGES.map((s) => <FilterChip key={s} on={filter === s} dot={STAGE_DOT[s]} count={counts[s]} dim={!counts[s]} onClick={() => setFilter(s)}>{STAGE_WORD[s]}</FilterChip>)}
          </ChipRow>
        </div>
        {stages.filter((s) => (filter === 'all' ? s !== 'delivered' || counts[s] : true)).map((s) => {
          const rows = list(s), shown = open.includes(s) ? rows : shownRows(rows, filter === 'all'), folded = rows.filter((o) => !shown.includes(o));
          if (!rows.length) return null;
          return (
            <div key={s} class="ow-sgroup">
              <GroupHead dot={STAGE_DOT[s]} title={s === 'delivered' ? 'Delivered this week' : STAGE_WORD[s]} count={rows.length} sum={rows.reduce((a, o) => a + orderTotal(o), 0)} />
              <GroupCard>
                {shown.map((o) => <Row key={o.id} b={b} o={o} t={t} leave={leave} />)}
                {folded.length > 0 && <ShowMore faces={uniqueFaces(b, folded)} n={folded.length} on={() => setOpen([...open, s])} />}
              </GroupCard>
            </div>
          );
        })}
      </main>
    </>
  );
}

function uniqueFaces(b: Books, l: Order[]) {
  const seen = new Set<string>();
  return l.map((o) => faceOf(b, o)).filter((f) => (seen.has(f.initials) ? false : (seen.add(f.initials), true))).slice(0, 3);
}

type Leave = (go1: () => void) => () => void;

function Row(p: { b: Books; o: Order; t: number; leave: Leave }): JSX.Element {
  const { b, o, t } = p, st = rowStatus(b, o, t), name = nameOf(b, o);
  const act = st.act === 'take'
    ? { word: 'Take', amount: short(takeAmount(b, o)), tone: 'warn' as const, label: `Take payment from ${name}, ${takeAmount(b, o).toLocaleString('en-US')}`, on: p.leave(() => payFor(b, o)) }
    : st.act === 'tell' ? { word: 'Tell', duo: phWhatsapp, tone: 'good' as const, label: `Tell ${name} what was found`, on: () => openTell(o.id) } : undefined;
  return <OrderRow face={faceOf(b, o)} name={name} no={orderNo(o.id)} status={st} amount={orderTotal(o)}
    time={o.stage === 'delivered' && o.deliveredAt ? doneWhen(o.deliveredAt, t) : placedWhen(o, t)} act={act} on={p.leave(() => openOrder(o.id))} />;
}

/** The head's bar when nothing moves: one quiet track, every count 0. */
function EmptyBar(): JSX.Element {
  return (
    <div class="ow-stagebar" role="img" aria-label="No orders on the move">
      <span aria-hidden="true" class="ow-split" style={{ height: '8px' }}><span style={{ flex: 1, background: 'rgba(255,255,255,.12)' }} /></span>
      <span aria-hidden="true" class="ow-stagebar-l">{STAGES.map((s) => <span key={s}>{`0 ${s === 'delivered' ? 'done' : s === 'road' ? 'road' : s}`}</span>)}</span>
    </div>
  );
}

/** The navy find field; once typed, its ring is white and a Clear button takes the words away (OR03). */
function FindField(p: { value: string; onInput: (v: string) => void }): JSX.Element {
  const on = !!p.value;
  return (
    <label class={'ow-search navy' + (on ? ' or-q' : '')}>
      <Duo i={phSearch} size={19} color={on ? '#FFFFFF' : '#B3BCD2'} />
      <input type="search" placeholder="Customer or #0552" aria-label="Find an order" value={p.value} onInput={(e) => p.onInput((e.target as HTMLInputElement).value)} />
      {on && <button type="button" class="or-search-x" aria-label="Clear" onClick={() => p.onInput('')}><span><Icon name="close" size={15} stroke={2.4} /></span></button>}
    </label>
  );
}

/** OR03 · what Find found: the customer with the one act, then their orders on the move and delivered. */
function Found(p: { b: Books; q: string; t: number; leave: Leave }): JSX.Element {
  const { b, t } = p, r = findOrders(b, p.q), c = r.customer;
  const moving = r.orders.filter((o) => o.stage !== 'delivered').sort((x, y) => y.placedAt - x.placedAt);
  const gone = r.orders.filter((o) => o.stage === 'delivered').sort((x, y) => (y.invoicedAt || y.deliveredAt || 0) - (x.invoicedAt || x.deliveredAt || 0));
  const [more, setMore] = useState(false);
  const today = dayOf(t);
  const when = (at: number) => (dayOf(at) === today ? 'today ' + clock(at) : daysApart(dayOf(at), today) < 7 ? `${weekday(at)} ${clock(at)}` : dayLabel(at));
  return (
    <main class="or-main find">
      {c && (
        <div class="or-cust">
          <Avatar initials={c.initials} tint={c.tint} size={36} font={13} />
          <span class="or-cust-t"><span>{c.name}</span><span><span class="mono">{r.orders.length}</span>{' orders · owes '}<span class="mono">{c.owes.toLocaleString('en-US')}</span></span></span>
          {c.owes > 0 && (
            <button type="button" class="or-cust-act" aria-label={`Take payment from ${c.name}, ${c.owes.toLocaleString('en-US')}`} onClick={p.leave(() => go('customers/pay', { customer: c.id }))}>
              <span class="or-apill warn">Take <span class="mono">{short(c.owes)}</span></span>
            </button>
          )}
        </div>
      )}
      {moving.length > 0 && (
        <div class="ow-sgroup">
          <GroupHead dot="#16203C" title="On the move" count={moving.length} sum={moving.reduce((a, o) => a + orderTotal(o), 0)} />
          <GroupCard>
            {moving.map((o) => {
              const k = kept(o), first = k[0];
              const it = first && b.items.find((x) => x.id === first.itemId);
              const what = o.stage === 'road' ? `with ${(b.members.find((m) => m.id === o.holderId)?.name || 'the driver').split(' ')[0]}` : first ? (k.length > 1 ? `${shortItem(first.name)} +${k.length - 1}` : `${shortItem(first.name)} ×${first.qty}`) : '';
              return <CustOrderRow key={o.id} aisle={o.stage === 'road' ? undefined : it?.aisle} icon={STAGE_ICON.road} title={`Placed ${when(o.placedAt)}`} sub={`${orderNo(o.id)} · ${what}`}
                amount={orderTotal(o)} pill={{ text: STAGE_WORD[o.stage], tone: 'info' }} on={p.leave(() => openOrder(o.id))} />;
            })}
          </GroupCard>
        </div>
      )}
      {gone.length > 0 && (
        <div class="ow-sgroup">
          <GroupHead dot={STAGE_DOT.delivered} title="Delivered" count={gone.length} sum="" />
          <GroupCard>
            {(more ? gone : gone.slice(0, 4)).map((o) => {
              const owes = !o.voided && orderOwes(o) > 0 && o.invoicedAt != null;
              const at = owes ? (o.invoicedAt as number) : (o.deliveredAt || o.placedAt);
              const age = daysApart(dayOf(at), today), tw = o.voided ? twinOf(b, o, true) : null;
              return <CustOrderRow key={o.id} icon="receipt" title={`${owes ? 'Billed' : 'Delivered'} ${daysApart(dayOf(at), today) < 7 ? weekday(at) + ' ' + clock(at) : dayLabel(at)}`}
                sub={owes ? `${orderNo(o.id)} · ${age} day${age === 1 ? '' : 's'}` : o.voided && tw && tw.copy === o ? `${orderNo(o.id)} · copy of ${orderNo(tw.orig.id)}` : orderNo(o.id)} amount={orderTotal(o)} struck={o.voided}
                pill={o.voided ? { text: 'Void', tone: 'bad' } : owes ? { text: 'Owes', tone: 'warn' } : { text: 'Paid', tone: 'good', tick: true }} on={p.leave(() => openOrder(o.id))} />;
            })}
            {!more && gone.length > 4 && <ShowMore faces={[]} n={gone.length - 4} on={() => setMore(true)} />}
          </GroupCard>
        </div>
      )}
    </main>
  );
}

/** OR04 · nothing on the move: the ghost of the stages and of a row, then the first steps and New order. */
function Empty(p: { b: Books }): JSX.Element {
  const n = p.b.customers.filter((c) => !c.qa).length;
  const steps = [
    { done: n > 0, title: 'Add your customers', sub: `${n} customers · done`, on: () => go('customers/new', {}) },
    { icon: 'plus' as const, title: 'Place an order', sub: 'with the red + · it shows here', on: () => go('sell', {}) },
    { icon: 'whatsapp' as const, stroke: 2, title: 'Tell the customer', sub: 'one tap, from the order', on: () => nav.tab('chats') },
  ];
  return (
    <main class="or-main or-empty">
      <GhostTiles title="On the move" meta="fills as you sell" />
      <div aria-hidden="true" class="or-ghostrow"><div><span /><span><span /><span /></span><span /></div></div>
      <div class="ow-sec or-empty-h"><h2>Get going</h2><span class="mono ow-sec-meta good">{`${steps.filter((s) => s.done).length} of ${steps.length}`}</span></div>
      <Checklist steps={steps} />
      <Button icon="plus" stroke={2.4} onClick={() => go('sell', {})}>New order</Button>
    </main>
  );
}

export { LIVE };
