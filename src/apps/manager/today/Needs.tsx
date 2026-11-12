/*
 * Today's Needs you (Today p1; spec §3.4 "Answer on the row"): one row per decision waiting, in
 * queue order. The row carries the asker, the ask word, "Musa · #0551 · 25 m" in mono, and the one
 * safe answer as a navy pill — the same write and args as the Decide kind's primary (core/manager/
 * today.ts safeAnswer). A slide decision's pill is Open. The row's body opens `decide { id }`.
 *
 * A row answered here walks the board's states: held (the success row, Undo n, "Grace sees Approved
 * in 8 s") → sending (the spinner in the pill) → gone; with no signal it stays as "sends when back ·
 * Waits"; refused, it comes back red with Try again. Empty: "Nothing waits on you".
 */
import { signal } from '@preact/signals';
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { isDataError } from '../../../core/datasource.ts';
import { money, signed } from '../../../core/money.ts';
import { firstWord, orderNo } from '../../../core/names.ts';
import { askerOf } from '../../../core/manager/queue.ts';
import { rowEvidence, rowTitle, safeAnswer, type SafeAnswer } from '../../../core/manager/today.ts';
import type { Ask, ManagerBooks, Person, Tint } from '../../../core/manager/types.ts';
import { hm, waited } from '../../../core/manager/words.ts';
import { TINTS } from '../../../core/names.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { COOL_MS } from '../decide/Decide.tsx';
import { nav } from '../shell/nav.ts';
import { act, answer, books, held, undoHeld, waiting } from '../shell/store.ts';

/** A face dot: the person's tint, ringed (the stage tiles, the told line). */
export function Dot(p: { tint: Tint }): JSX.Element {
  const t = TINTS[p.tint === 'me' ? 'n' : p.tint] || TINTS.n;
  return <i aria-hidden="true" class="mg-today-dot" style={{ background: t.bg, boxShadow: `inset 0 0 0 2px ${t.fg}` }} />;
}

type Phase = 'held' | 'sending' | 'kept' | 'error' | 'someone';
interface Mine { a: Ask; s: SafeAnswer; label: string; sub: string; told: Person[]; at: number; pos: number; phase: Phase }

/** The rows answered from Today in this session, by ask key. */
const mine = signal<Record<string, Mine>>({});
const put = (key: string, x: Partial<Mine> | null): void => {
  const next = { ...mine.value };
  if (x && !next[key] && !x.a) return; // an update for a row already gone
  if (x) next[key] = { ...next[key], ...x } as Mine; else delete next[key];
  mine.value = next;
};

function labelOf(s: SafeAnswer): string {
  return s.amount == null ? s.word : `${s.word} · ${s.amount < 0 ? signed(s.amount) : money(s.amount)}`;
}

function subOf(a: Ask, b: ManagerBooks): string {
  const o = a.orderId != null ? b.orders.find((x) => x.id === a.orderId) : null;
  const line = o && (a.kind === 'price' || a.kind === 'counter') ? o.lines[a.idx] : null;
  return (line && o ? [orderNo(o.id), line.name] : rowEvidence(a)).join(' · ');
}

/** When a row last answered: the rows under it move up under the same thumb, so pill taps wait COOL_MS (as the Decide dock). */
let cool = 0;

function tap(a: Ask, s: SafeAnswer, b: ManagerBooks, pos: number): void {
  if (Date.now() - cool < COOL_MS) return;
  cool = Date.now();
  const told = s.told.map((id) => b.team.find((p) => p.id === id)).filter((p): p is Person => !!p);
  const label = labelOf(s);
  put(a.key, { a, s, label, sub: subOf(a, b), told, at: b.at, pos, phase: 'held' });
  answer(a.key, label, s.kind, s.args, {
    quiet: true,
    // Undo is only possible while held; a refused send also calls it, then `then` marks the row red.
    undo: () => { const m = mine.value[a.key]; if (m && m.phase === 'held') put(a.key, null); },
    then: (r, e) => {
      if (r) { put(a.key, r.kept ? { phase: 'kept' } : null); return; }
      put(a.key, { phase: isDataError(e) && e.kind === 'clash' ? 'someone' : 'error' });
    },
  });
}

function again(m: Mine): void {
  if (Date.now() - cool < COOL_MS) return;
  cool = Date.now();
  put(m.a.key, { phase: 'sending' });
  act(m.s.kind, ...m.s.args).then((r) => put(m.a.key, r.kept ? { phase: 'kept' } : null), (e) => put(m.a.key, { phase: isDataError(e) && e.kind === 'clash' ? 'someone' : 'error' }));
}

function Told(p: { who: Person[]; word: string; tail?: string; still?: boolean }): JSX.Element | null {
  if (!p.who.length) return null;
  const names = p.who.map((x) => firstWord(x.name));
  return (
    <div class={'mg-today-told' + (p.still ? ' still' : '')}>
      <Icon name={p.still ? 'eye' : 'bell'} size={14} stroke={2} />
      {!p.still && p.who.map((x) => <Dot key={x.id} tint={x.tint} />)}
      <span>{`${names.join(' · ')} ${p.still ? 'still ' : ''}${names.length === 1 ? 'sees' : 'see'}`}</span>
      <b>{p.word}</b>
      {p.tail && <span class="mono">{p.tail}</span>}
    </div>
  );
}

function useTick(on: boolean): number {
  const [t, setT] = useState(Date.now());
  useEffect(() => { if (!on) return undefined; const i = setInterval(() => setT(Date.now()), 250); return () => clearInterval(i); }, [on]);
  return t;
}

function Row(p: { a: Ask; b: ManagerBooks; at: number; pos: number; m: Mine | null }): JSX.Element {
  const { a, b, m } = p;
  const asker = askerOf(b, a);
  const s = safeAnswer(a, b);
  const sub = [asker ? firstWord(asker.name) : '', ...rowEvidence(a), waited(a.at, p.at)].filter(Boolean).join(' · ');
  const title = rowTitle(a, b);
  const open = () => nav.push('decide', { id: a.key });
  const sending = m && m.phase === 'sending';
  const bad = m && (m.phase === 'error' || m.phase === 'someone');
  const who = s ? s.told.map((id) => b.team.find((x) => x.id === id)).filter((x): x is Person => !!x).map((x) => firstWord(x.name)) : [];
  const pill = s
    ? <button type="button" class={'mg-today-pill' + (sending ? ' sending' : '')} disabled={!!sending} aria-busy={sending ? 'true' : undefined}
        aria-label={`${labelOf(s)}. ${who.join(' and ')} ${who.length === 1 ? 'sees' : 'see'} it`} onClick={() => tap(a, s, b, p.pos)}>
        <span>{sending && <i class="spin" aria-hidden="true" />}{s.word}</span>
      </button>
    : <button type="button" class="mg-today-pill open" aria-label={`Open: ${title}`} onClick={open}><span>Open</span></button>;
  return (
    <div class={'mg-today-rowwrap' + (bad ? ' bad' : '')}>
      <div class="mg-today-row">
        {bad ? <span class="mg-today-warn" aria-hidden="true"><Icon name="warning" size={16} stroke={2.2} /></span>
          : asker ? <Avatar initials={asker.initials} tint={asker.tint === 'me' ? 'n' : asker.tint} size={30} />
            : <span class="mg-today-app" aria-hidden="true"><Icon name="spark" size={15} stroke={2} /></span>}
        <button type="button" class="mg-today-rb" aria-label={`${title}, ${sub}. Open`} onClick={open}>
          <span class="t">{title}</span>
          <span class={'s' + (bad ? ' bad' : '')}>{bad ? (m!.phase === 'someone' ? 'Someone else just did this' : `Not sent · ${hm(m!.at)}`) : sub}</span>
        </button>
        {bad && m!.phase === 'error'
          ? <button type="button" class="mg-today-pill" onClick={() => again(m!)}><span><Icon name="retry" size={15} stroke={2.2} />Try again</span></button>
          : bad ? null : pill}
      </div>
      {sending && m && <Told who={m.told} word={m.s.word} />}
      {bad && m && m.phase === 'error' && asker && <Told who={[asker]} word={`${firstWord(b.me.name)} decides`} still />}
    </div>
  );
}

function Done(p: { m: Mine; until: number | null }): JSX.Element {
  const t = useTick(p.until != null);
  const left = p.until != null ? Math.max(0, Math.ceil((p.until - t) / 1000)) : 0;
  const waits = p.m.phase === 'kept';
  return (
    <div class="mg-today-rowwrap">
      <div class="mg-today-row">
        <span class={'mg-today-ok' + (waits ? ' waits' : '')} aria-hidden="true"><Icon name={waits ? 'clock' : 'check'} size={16} stroke={2.4} /></span>
        <div class="mg-today-rb" role="status">
          <span class="t">{p.m.label}</span>
          <span class="s">{waits ? `${p.m.sub.split(' · ')[0]} · sends when back` : p.m.sub}</span>
        </div>
        {waits ? <span class="mg-today-waits"><Icon name="clock" size={14} stroke={2.2} />Waits</span>
          : <button type="button" class="mg-today-undo" onClick={() => undoHeld()}><span><Icon name="undo" size={15} stroke={2.2} />{`Undo ${left}`}</span></button>}
      </div>
      {!waits && <Told who={p.m.told} word={p.m.s.word} tail={`in ${left} s`} />}
    </div>
  );
}

export function Needs(p: { b: ManagerBooks; at: number }): JSX.Element {
  const q = waiting.value, my = mine.value, h = held.value;
  // A held row whose 10 s ran out (or that a second answer pushed out) is now sending.
  useEffect(() => {
    Object.values(my).forEach((m) => { if (m.phase === 'held' && (!h || h.label !== m.label)) put(m.a.key, { phase: 'sending' }); });
  }, [h, my]);
  // A kept answer leaves once the books no longer have its ask.
  useEffect(() => {
    const bk = books.value;
    if (bk) Object.values(my).forEach((m) => { if ((m.phase === 'kept' || m.phase === 'sending') && !bk.asks.some((a) => a.key === m.a.key)) put(m.a.key, null); });
  }, [p.b, my]);

  const rows: JSX.Element[] = q.map((a, i) => <Row key={a.key} a={a} b={p.b} at={p.at} pos={i} m={my[a.key] || null} />);
  Object.values(my).filter((m) => !q.some((a) => a.key === m.a.key) && m.phase !== 'error' && m.phase !== 'someone')
    .sort((x, y) => y.pos - x.pos)
    .forEach((m) => {
      const el = m.phase === 'sending'
        ? <Row key={m.a.key} a={m.a} b={p.b} at={p.at} pos={m.pos} m={m} />
        : <Done key={m.a.key} m={m} until={m.phase === 'held' && h && h.label === m.label ? h.until : null} />;
      rows.splice(Math.min(m.pos, rows.length), 0, el);
    });
  const n = q.length;
  return (
    <>
      <div class="mg-today-sec">
        <i class={'mg-today-nd' + (n ? '' : ' off')} aria-hidden="true" />
        <span class="t">Needs you</span>
        {n > 0 && <span class="m">the pill = what they see</span>}
        <b>{n}</b>
      </div>
      {rows.length ? <div class="mg-today-needs">{rows}</div>
        : <div class="mg-today-empty"><Icon name="check" size={18} stroke={2.4} />Nothing waits on you</div>}
    </>
  );
}
