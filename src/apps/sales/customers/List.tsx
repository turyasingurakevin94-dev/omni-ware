/*
 * customers { filter? } · the Customers list (CU01–CU08). Owe first (who to
 * take money from, past and under the 21-day hold), Due (who to reach out
 * to this week), Quiet, All; search by name, phone or place. The head
 * folds to a compact bar as the list scrolls. With no signal it is the
 * copy saved on the phone; on first open, the skeleton.
 */
import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { ChipRow, FilterChip } from '../../../ui/Pill.tsx';
import { Notice } from '../../../ui/Notice.tsx';
import { toast } from '../../../ui/toast.tsx';
import { clock, dayOf } from '../../../core/time.ts';
import type { Books, Customer } from '../../../core/types.ts';
import { nav } from '../shell/nav.ts';
import { act, books, chats, flush, now, online } from '../shell/store.ts';
import type { ScreenProps } from '../shell/types.ts';
import { AllBody, DueBody, LoadingBody, NobodyBody, OweBody, type Acts } from './list-bodies.tsx';
import { listData, openedLately } from './list-data.ts';
import { CompactHead, LoadingHead, NoneHead, OweHead, PlainHead, TypingHead } from './list-head.tsx';
import { SearchBody } from './list-search.tsx';
import { WeekHead } from './local-week.tsx';
import { openedOf } from './opened.ts';
import { shareList } from './share.ts';
import { whoPicked } from './pay-walkin.tsx';
import { short } from './data.ts';
import './customers.css';
import './list.css';

export type Filter = 'owe' | 'due' | 'quiet' | 'all';

export function ListScreen(p: ScreenProps): JSX.Element {
  const [filter, setFilter] = useState<Filter>((p.params.filter as Filter) || 'owe');
  const [q, setQ] = useState(String(p.params.q || ''));
  const [day, setDay] = useState<string | null>(null);
  const [folded, setFolded] = useState(false);
  const [hello, setHello] = useState(false);
  const head = useRef<HTMLDivElement>(null);
  const b = books.value, t = now.value, today = dayOf(t);

  useEffect(() => {
    const on = () => { const h = head.current; setFolded(!!h && window.scrollY > h.offsetHeight - 112); };
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  const go = { onShare: () => { if (b) void shareList(b).then((w) => w && toast.show(w)); }, onNew: () => nav.push('customers/new', q.trim() ? { name: q.trim() } : {}) };
  const findTop = () => { window.scrollTo(0, 0); setFilter('owe'); setTimeout(() => { const el = document.querySelector<HTMLInputElement>('input[aria-label="Find a customer"]'); if (el) el.focus(); }, 0); };

  if (!b) {
    return (
      <div class="cu-list">
        <LoadingHead count={null} {...go} q={q} onQ={setQ} />
        <main class="cu-main g14"><LoadingBody /></main>
      </div>
    );
  }

  const d = listData(b, today), off = !online.value;
  const a: Acts = {
    // Picking who owes a walk-in's rest (CU34 "Find someone else"): the row is the answer.
    open: (c) => (p.params.pick != null ? (whoPicked.value = { order: Number(p.params.pick), id: c.id }, nav.back()) : nav.push('customers/customer', { id: c.id })),
    take: (c) => nav.push('customers/pay', { customer: c.id }),
    wa: (c) => whatsapp(b, c),
  };
  const sayHi = async () => {
    setHello(true);
    let n = 0;
    for (const w of d.quiet) {
      const ch = chats.value ? chats.value.chats.find((x) => x.customerId === w.c.id) : null;
      if (!ch) continue;
      try { await act('sendTemplate', ch.id, `Hello ${short(w.c.name)}, it has been a while. ${b.shop.name} has what you need when you are ready.`); n++; } catch (_e) { /* the rest still go */ }
    }
    setHello(false);
    toast.show(n ? `Said hi to ${n}` : 'Nobody to say hi to on WhatsApp', { kind: n ? 'ok' : 'warn' });
  };

  const typing = q.trim().length > 0;
  const chips = (
    <ChipRow label="Show">
      {([['owe', 'Owe', d.owe.length], ['due', 'Due', d.due.length], ['quiet', 'Quiet', d.quiet.length], ['all', 'All', d.all.length]] as [Filter, string, number][]).map(([f, w, n]) => (
        <FilterChip key={f} on={filter === f} count={n} onClick={() => { setFilter(f); setDay(null); window.scrollTo(0, 0); }}>{w}</FilterChip>
      ))}
    </ChipRow>
  );
  const bar = { owes: d.owes, take: d.take, under: d.under21, checkedIn: d.checkedIn, checkedAll: d.checkedAll };
  const compact = !typing && (off || filter === 'all' || filter === 'quiet');

  let headEl: JSX.Element;
  if (typing) headEl = <TypingHead count={d.all.length} {...go} q={q} onQ={setQ} />;
  else if (compact) headEl = <CompactHead count={d.all.length} {...go} o={filter === 'owe' && d.owes > 0 ? bar : null} onFind={findTop} />;
  else if (filter === 'due') headEl = <PlainHead count={d.all.length} {...go} q={q} onQ={setQ}><WeekHead d={d} today={today} day={day} onDay={(x) => setDay(!x || day === x ? null : x)} /></PlainHead>;
  else if (filter === 'owe' && d.owes > 0) headEl = <OweHead count={d.all.length} {...go} o={bar} owe={d.owe.length} q={q} onQ={setQ} />;
  else if (filter === 'owe') headEl = <NoneHead count={d.all.length} {...go} q={q} onQ={setQ} />;
  else headEl = <PlainHead count={d.all.length} {...go} q={q} onQ={setQ} />;

  let body: JSX.Element;
  let gap = 16;
  if (typing) { body = <SearchBody b={b} d={d} q={q} a={a} opened={openedLately(b, openedOf(b), t)} onNew={go.onNew} />; gap = 10; }
  else if (filter === 'due') body = <>{chips}<DueBody d={d} a={a} day={day} /></>;
  else if (filter === 'all') body = <>{chips}<AllBody d={d} a={a} onHello={() => { void sayHi(); }} sending={hello} /></>;
  else if (filter === 'quiet') body = <>{chips}<AllBody d={{ ...d, all: d.quiet }} a={a} onHello={() => { void sayHi(); }} sending={hello} /></>;
  else if (d.owes > 0) { body = <>{chips}<OweBody b={b} d={d} today={today} a={a} more={!off} /></>; gap = off ? 14 : 12; }
  else { body = <>{chips}<NobodyBody d={d} a={a} /></>; gap = 12; }

  return (
    <div class="cu-list">
      <div ref={head}>{headEl}</div>
      {filter === 'owe' && !typing && !compact && folded && <div class="cu-fold"><CompactHead count={d.all.length} {...go} o={d.owes > 0 ? bar : null} onFind={findTop} /></div>}
      {off && (
        <div class="cu-off"><Notice kind="offline" action={{ label: 'Try again', on: () => { void flush(); } }}>
          {`No signal · the list saved ${clock(b.at)}`}</Notice></div>
      )}
      <main class={'cu-main g' + gap + (off ? ' off' : '')}>{body}</main>
    </div>
  );
}

/** WhatsApp from the row: their chat when there is one, else WhatsApp itself with their number. */
function whatsapp(b: Books, c: Customer): void {
  const ch = chats.value ? chats.value.chats.find((x) => x.customerId === c.id) : null;
  if (ch) { nav.push('chats/chat', { id: ch.id }); return; }
  const n = c.phone.replace(/\D/g, '').replace(/^0/, '256');
  if (n) window.open(`https://wa.me/${n}`, '_blank');
  else toast.show(`${short(c.name)} has no phone number yet`, { kind: 'warn' });
  void b;
}
