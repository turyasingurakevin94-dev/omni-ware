/*
 * Check in a trip (route `in/checkin { trip }`; IN02–IN09, IN13, IN16): blind, line by line, grouped
 * by where the goods go, then one slide. The count is kept on this phone until it goes (FLOW-05).
 *
 *   count     IN02 one line open (quick tiles) · IN03 a line differs (why) · IN04/IN16 Not on the list
 *   sending   IN05 the stages moving, "Sending…"
 *   kept      IN07 no signal: where it goes, "Not sent yet", Waiting to send
 *   failed    IN08 the red bar, the counts kept, the slide again
 *   done      IN06 Checked in (CheckedIn.tsx); someone else did it IN09; Ruth answered the extra IN13
 *
 * Rules: core/store/checkin.ts. The write: W14 checkIn, through the shell's act().
 */
import { Fragment, type JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { orderNo } from '../../../core/names.ts';
import { clock } from '../../../core/time.ts';
import {
  differs, groupsOf, lineDone, MISCOUNTED, outcome, payload, progress, ready, toCount, tripOf, countedWords,
  type CheckLine, type CheckTrip, type Draft, type Group,
} from '../../../core/store/checkin.ts';
import { isDataError } from '../../../core/datasource.ts';
import type { YardBooks } from '../../../core/store/types.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { nav } from '../shell/nav.ts';
import { act, books, notDone, now } from '../shell/store.ts';
import { GoneRow, GroupRow, LineRow, OpenLine } from './CheckLines.tsx';
import { CheckedIn, Answered, SomeoneDid, type Sent } from './CheckedIn.tsx';
import { openNotOnList } from './NotOnList.tsx';
import { byLogin, byRole, Card, customerFace, faceOf, first, GroupHead, HeadPill, InBar, InDock, Pill, Screen, Sees, TripHead, Updating } from './parts.tsx';

type Phase = 'count' | 'sending' | 'kept' | 'failed' | 'done';

const KEY = (id: string) => `ow-store-ci:${id}`;
function loadDraft(id: string): Draft {
  try { const v = JSON.parse(localStorage.getItem(KEY(id)) || 'null'); if (v && v.counts && v.whys) return v; } catch (_e) { /* no storage */ }
  return { counts: {}, whys: {} };
}
function saveDraft(id: string, d: Draft | null): void {
  try { if (d) localStorage.setItem(KEY(id), JSON.stringify(d)); else localStorage.removeItem(KEY(id)); } catch (_e) { /* no storage */ }
}

/** Who the orders' salesperson is (the one who placed the first of them). */
export function sellerOf(b: YardBooks, ids: (number | null)[]): string {
  const o = ids.map((id) => b.orders.find((x) => x.id === id)).find(Boolean);
  const p = o ? byLogin(b, o.takenBy) : null;
  return first(p ? p.name : 'Sales');
}
export const tellsOf = (b: YardBooks, l: CheckLine): string => {
  const o = b.orders.find((x) => x.id === l.orderId);
  return `${sellerOf(b, [l.orderId])} tells ${o ? first(o.client.name) : 'the customer'}`;
};

/** A group gathered into one row (IN03's #0549, IN05's #0546). */
function Gathered(p: { b: YardBooks; g: Group; d: Draft; on?: () => void }): JSX.Element {
  const { b, g, d } = p, name = g.order ? `${orderNo(g.order.id)} ${g.order.client.name}` : 'The shelf';
  const ls = g.lines.filter((l) => !l.notFound), diff = ls.filter((l) => differs(l, d.counts[l.id]));
  const words = diff.length
    ? `${countedWords(ls, d)} · ${diff.map((l) => `${Math.abs((d.counts[l.id] as number) - l.expected)} ${(d.whys[l.id] || 'differ').toLowerCase()}`).join(' · ')}`
    : countedWords(ls, d);
  const face = g.order ? customerFace(b, g.order.client.name) : { initials: 'SH', tint: 't4' as const };
  return (
    <Card>
      <GroupRow title={name} lines={g.lines} words={words} face={face} kind={diff.length ? 'diff' : 'ok'}
        label={p.on ? `${name}: ${ls.length > 1 ? 'both lines' : 'the line'} counted. Open to change` : undefined} on={p.on} />
      {g.lines.filter((l) => l.notFound).map((l) => <GoneRow key={l.id} l={l} tells={tellsOf(b, l)} />)}
    </Card>
  );
}

export function Checkin(p: { trip: string }): JSX.Element {
  const b = books.value as YardBooks, t = b ? tripOf(b, p.trip) : null;
  const [draft, setDraft] = useState<Draft>(() => loadDraft(p.trip));
  const [open, setOpen] = useState<string | null>(() => (t ? (toCount(t).find((l) => !lineDone(l, loadDraft(p.trip))) || { id: null }).id : null));
  const [phase, setPhase] = useState<Phase>('count');
  const [sent, setSent] = useState<Sent | null>(null);
  useEffect(() => { if (phase === 'count' || phase === 'failed') saveDraft(p.trip, draft); }, [draft, phase]);

  if (!b || !t) return <Screen head={<TripHead lead={null} name="Check in" sub="" onClose={() => nav.home()} />}><p class="in-gone-p">That trip is gone.</p></Screen>;
  if (phase === 'done' && sent) return <CheckedIn sent={sent} />;
  if (t.checkedAt != null && phase !== 'sending') {
    const answered = b.asks.find((a) => a.kind === 'extra' && a.by === b.me.userId && a.status !== 'sent' && t.stops.some((s) => s.id === a.ref));
    if (answered && t.checkedBy === b.me.userId) return <Answered t={t} ask={answered} />;
    return <SomeoneDid t={t} mine={Object.keys(draft.counts).length > 0} />;
  }

  const runner = b.people.find((x) => x.id === t.runnerId) || null, denis = first(runner ? runner.name : 'The Buyer');
  const ruth = byRole(b, 'manager'), ruthName = first(ruth ? ruth.name : 'Ruth');
  const groups = groupsOf(t, b.orders), lines = toCount(t), pr = progress(t, draft), out = outcome(t, draft, b.orders);
  const locked = phase === 'sending' || phase === 'kept';
  const setCount = (l: CheckLine, n: number, close: boolean) => {
    const d: Draft = { counts: { ...draft.counts, [l.id]: n }, whys: { ...draft.whys } };
    if (!differs(l, n)) delete d.whys[l.id];
    if (d.whys[l.id] === MISCOUNTED) delete d.whys[l.id];
    setDraft(d);
    if (close && !differs(l, n)) setOpen((lines.find((x) => x.id !== l.id && !lineDone(x, d)) || { id: null }).id);
  };
  const setWhy = (l: CheckLine, w: string) => {
    const d: Draft = { counts: { ...draft.counts }, whys: { ...draft.whys, [l.id]: w } };
    if (w === MISCOUNTED) { delete d.counts[l.id]; delete d.whys[l.id]; }
    setDraft(d);
    if (w !== MISCOUNTED) { const next = lines.find((x) => x.id !== l.id && !lineDone(x, d)); if (next) setOpen(next.id); }
  };

  const send = async () => {
    const snap: Sent = { t, draft, out, at: now.value, denis: runner, ruth };
    setPhase('sending');
    notDone.value = null;
    try {
      const r = await act('checkIn', payload(t, draft));
      if (r.kept) { setPhase('kept'); return; }
      saveDraft(p.trip, null);
      setSent({ ...snap, at: now.value });
      setPhase('done');
    } catch (e) {
      setPhase(isDataError(e) && e.kind === 'clash' ? 'count' : 'failed');
    }
  };

  const moving = out.orders.map((o) => orderNo(o.orderId));
  const seller = sellerOf(b, out.orders.map((o) => o.orderId)), sellerP = b.people.find((x) => first(x.name) === seller && x.role === 'sales') || null;
  const lineDenis = <Sees face={faceOf(runner)} who={denis} what={phase === 'kept' || phase === 'failed' ? 'Back at the yard' : 'Checked in'} />;
  const second = phase === 'kept'
    ? <Updating at={clock(b.at)} />
    : phase === 'sending' && out.differs.length
      ? <Sees face={faceOf(ruth)} who={ruthName} what={`${out.differs.length} differs`} />
      : <Sees face={faceOf(sellerP)} who={seller} what={phase === 'failed' || !moving.length ? 'Buying' : `${moving.join(' · ')} → Packing`} />;
  const left = lines.length - pr.done, isReady = ready(t, draft);
  const move = phase === 'sending' ? { kind: 'slide' as const, props: { label: 'Sending…', onCommit: () => undefined, state: 'sending' as const } }
    : phase === 'kept' ? { kind: 'wait' as const, label: 'Waiting to send' }
      : isReady ? { kind: 'slide' as const, props: { label: `Slide to check in · ${lines.length} ${lines.length === 1 ? 'line' : 'lines'}`, onCommit: send } }
        : { kind: 'wait' as const, label: left > 0 ? `Count ${left} more first` : 'Say why first' };

  const head = (
    <TripHead lead={<Avatar {...faceOf(runner)} size={44} />} name={`${denis}'s trip`} sub="back at the yard" onScan={() => { if (!locked) nav.push('shelf/scan', { then: 'checkin' }); }}
      onClose={() => nav.back()} closeLabel="Close: back to Coming in"
      chips={<>
        <HeadPill face={faceOf(runner)}>{`From ${denis} · Buyer`}</HeadPill><span class="in-flex" />
        <button type="button" class="in-extra" disabled={locked} onClick={() => openNotOnList(t.stops[t.stops.length - 1].id)}><span><Icon name="plus" size={13} stroke={2.6} />Not on the list</span></button>
      </>} />
  );
  const foot = (
    <div class="in-foot">
      <InBar kept={phase === 'kept'} what="counts" retry={phase === 'failed' ? () => { void send(); } : undefined} />
      <InDock ring={{ done: pr.done, of: pr.of, amber: out.differs.length }} lines={<>{lineDenis}{second}</>} move={move} />
    </div>
  );

  const counting = phase === 'count';
  return (
    <Screen head={head} foot={foot} back="Back to Coming in">
      {groups.map((g) => {
        const ls = g.lines.filter((l) => !l.notFound), allDone = ls.length > 0 && ls.every((l) => lineDone(l, draft)) && !ls.some((l) => l.id === open);
        if (!counting || allDone) return <Gathered key={String(g.orderId)} b={b} g={g} d={draft} on={counting ? () => setOpen(ls[0].id) : undefined} />;
        const gone = g.lines.filter((l) => l.notFound).length;
        const parts: JSX.Element[] = [];
        let run: JSX.Element[] = [];
        const flushRun = () => { if (run.length) { parts.push(<Card key={'c' + parts.length}>{run}</Card>); run = []; } };
        g.lines.forEach((l) => {
          if (l.notFound) { run.push(<GoneRow key={l.id} l={l} tells={tellsOf(b, l)} />); return; }
          if (l.id === open) {
            flushRun();
            parts.push(<OpenLine key={l.id} l={l} nth={lines.indexOf(l) + 1} of={lines.length} count={draft.counts[l.id]} why={draft.whys[l.id]} ruth={faceOf(ruth)} ruthName={ruthName}
              denisName={denis} onCount={(n, c) => setCount(l, n, c)} onWhy={(w) => setWhy(l, w)} />);
            return;
          }
          run.push(<LineRow key={l.id} l={l} count={draft.counts[l.id]} on={() => setOpen(l.id)} />);
        });
        flushRun();
        return (
          <Fragment key={String(g.orderId)}>
            <GroupHead face={g.order ? customerFace(b, g.order.client.name) : undefined} icon={g.order ? undefined : 'rack'} title={g.order ? `${orderNo(g.order.id)} ${g.order.client.name}` : 'The shelf'}
              right={gone ? <Pill tone="bad" icon="close" size={10} stroke={3.4}>{`${gone} not found`}</Pill> : <span class="mono">{`${g.lines.length} ${g.lines.length === 1 ? 'line' : 'lines'}`}</span>} />
            {parts}
          </Fragment>
        );
      })}
      {counting && !out.differs.length && <WaitOn b={b} t={t} />}
      {phase === 'sending' && <Moving b={b} t={t} draft={draft} ruthName={ruthName} />}
      {(phase === 'kept' || phase === 'failed') && <WhereItGoes b={b} t={t} draft={draft} ruthName={ruthName} />}
    </Screen>
  );
}

/** "2 orders wait on it · → Packing" (IN02). */
function WaitOn(p: { b: YardBooks; t: CheckTrip }): JSX.Element | null {
  const ids = [...new Set(p.t.lines.map((l) => l.orderId).filter((x): x is number => x != null))].map((id) => p.b.orders.find((o) => o.id === id)).filter((o) => o && o.status === 'awaiting_goods');
  if (!ids.length) return null;
  return (
    <div class="in-wait-on">
      <span aria-hidden="true" class="in-faces2 tight">{ids.map((o) => <Avatar key={o!.id} {...customerFace(p.b, o!.client.name)} size={28} />)}</span>
      <span class="t">{`${ids.length} ${ids.length === 1 ? 'order waits' : 'orders wait'} on it`}</span>
      <Icon name="orders" size={16} stroke={2.2} /><span class="p">→ Packing</span>
    </div>
  );
}

/** IN05: each order Buying → Packing, and what goes to Ruth. */
function Moving(p: { b: YardBooks; t: CheckTrip; draft: Draft; ruthName: string }): JSX.Element {
  const out = outcome(p.t, p.draft, p.b.orders), ruth = byRole(p.b, 'manager');
  return (
    <div class="in-card in-card16 in-moving">
      <div class="in-moving-h"><span>Stages moving</span><span class="in-pill t-plain"><span aria-hidden="true" class="in-spin dark" />Sending…</span></div>
      {out.orders.map((o) => (
        <div key={o.orderId} class="in-moving-r">
          <Avatar {...customerFace(p.b, o.order ? o.order.client.name : '')} size={32} />
          <span class="in-line-t"><span class="mono">{orderNo(o.orderId)}</span><span>{o.allIn ? `${first(o.order ? o.order.client.name : '')} · all in` : `${o.got} of ${o.want} came`}</span></span>
          <Pill tone="info" icon="cart">Buying</Pill><span aria-hidden="true" class="ci-chev"><Icon name="arrow-right" size={14} stroke={2.2} /></span><Pill tone="navy" icon="orders">Packing</Pill>
        </div>
      ))}
      {out.differs.map((d) => (
        <div key={d.line.id} class="in-moving-r">
          <Avatar {...faceOf(ruth)} size={32} />
          <span class="in-line-t"><span class="mono">{`${Math.abs(d.diff)} ${d.line.unit} ${d.line.name.split(' · ')[0].split(' ').pop()}`}</span><span>{`${d.why.toLowerCase()} · she decides`}</span></span>
          <Pill tone="warn" icon="hourglass">{`With ${p.ruthName}`}</Pill>
        </div>
      ))}
    </div>
  );
}

/** IN07, IN08: where it goes, not sent yet. */
function WhereItGoes(p: { b: YardBooks; t: CheckTrip; draft: Draft; ruthName: string }): JSX.Element {
  const out = outcome(p.t, p.draft, p.b.orders), ruth = byRole(p.b, 'manager');
  const lines = (id: number) => p.t.lines.filter((l) => l.orderId === id && !l.notFound).length;
  return (
    <div class="in-card in-card16 in-goes">
      <div class="in-goes-h"><span>Where it goes</span><Pill tone="warn">Not sent yet</Pill></div>
      <div class="in-goes-g">
        {out.orders.map((o) => (
          <div key={o.orderId} class="in-goes-t">
            <Avatar {...customerFace(p.b, o.order ? o.order.client.name : '')} size={32} />
            <span class="mono">{orderNo(o.orderId)}</span><span class="i"><Icon name="orders" size={11} stroke={2.4} />Packing</span>
            <span class="s">{o.allIn ? `${lines(o.orderId)} ${lines(o.orderId) === 1 ? 'line' : 'lines'}` : `pack ${o.got} of ${o.want}`}</span>
          </div>
        ))}
        {out.differs.map((d) => (
          <div key={d.line.id} class="in-goes-t">
            <Avatar {...faceOf(ruth)} size={32} /><span class="mono">{`${Math.abs(d.diff)} ${d.line.unit}`}</span><span class="i r">{p.ruthName}</span><span class="s">decides</span>
          </div>
        ))}
      </div>
    </div>
  );
}

