/*
 * The gate (out/gate { id? }; OU10 default at 10:47, OU08 handing over, OU12 handed over, OU13 not paid
 * yet, OU15 nobody to hand over, OU16 no signal). Ready to collect, the oldest first: its card (since
 * when, what to read out, who collects, prefilled from the order and editable), the rest "Next at the
 * gate" (an agent by his code, out/gate-code), and what was collected today. The slide hands over
 * (W9): Delivered · collected, 10 s with Undo on the end screen. An order Not paid yet opens as its
 * own sheet (OU13): it stays; Grace takes the money, Ruth may let it go; the slide is locked.
 */
import type { ComponentChildren, JSX } from 'preact';
import { useState } from 'preact/hooks';
import { firstWord, orderNo, plural } from '../../../core/names.ts';
import { aisleLetter, aisleOf } from '../../../core/store/door.ts';
import { atTheGate, collectedToday, collector, comingToTheGate, isAgent } from '../../../core/store/gate.ts';
import type { YardBooks, YardOrder } from '../../../core/store/types.ts';
import { counts, moneyHeld } from '../../../core/store/yard.ts';
import { clock, howLong } from '../../../core/time.ts';
import { orderFace, whoIs, yardFace } from '../../../core/store/faces.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { ItemSquare } from '../../../ui/ItemSquare.tsx';
import { Slide } from '../../../ui/Slide.tsx';
import { toast } from '../../../ui/toast.tsx';
import { cx, Tap } from '../../../ui/util.tsx';
import { nav, type Params } from '../shell/nav.ts';
import { StageSheet } from '../shell/StageSheet.tsx';
import { books, me, now } from '../shell/store.ts';
import { useCommit } from './commit.ts';
import { Done } from './Done.tsx';
import { Calls, NotPaidGate, Told } from './GateHeld.tsx';
import { Card, DotHead, EmptyWords, FlowBar, Ghost, GhostRow, MiniOrder, NotPaid, SheetDock, SideTiles, SoftPill, WayIn, seller } from './parts.tsx';
import './gate.css';

/** The gate's picture: the yard's front, the gate open in mint (or locked in amber), since when. */
export function GatePic(p: { since: number; held?: boolean }): JSX.Element {
  return (
    <div role="img" aria-label="At the gate" class="gt-pic">
      <svg width="328" height="124" viewBox="0 0 328 124" aria-hidden="true" style={{ position: 'absolute', left: 0, top: '-40px' }}>
        <path d="M0 110 H328" fill="none" stroke="#FFFFFF" stroke-width="16" />
        <rect x="28" y="58" width="120" height="44" rx="4" fill="#E1E4DC" />
        <rect x="24" y="56" width="128" height="8" rx="3" fill="#D3D7CD" />
        <rect x="74" y="74" width="28" height="28" rx="3" fill="#D3D7CD" />
        <rect x="40" y="72" width="22" height="16" rx="2" fill="#D3D7CD" /><rect x="114" y="72" width="22" height="16" rx="2" fill="#D3D7CD" />
        <path d="M148 102 H300" fill="none" stroke="#D3D7CD" stroke-width="2" />
        <rect x="186" y="44" width="8" height="58" rx="2" fill="#5F6980" /><rect x="290" y="44" width="8" height="58" rx="2" fill="#5F6980" />
        <path d="M194 54 H222 M194 92 H222 M262 54 H290 M262 92 H290 M202 54 V92 M212 54 V92 M270 54 V92 M280 54 V92" fill="none" stroke="#9AA1AE" stroke-width="3" stroke-linecap="round" />
      </svg>
      <span class="gt-since">Ready since <b class={cx('mono', p.held && 'held')}>{clock(p.since)}</b></span>
      <span aria-hidden="true" class={cx('gt-mark', p.held && 'held')}>{p.held ? <Icon name="lock" size={16} stroke={2.2} /> : <Icon name="orders" size={16} stroke={2.2} />}</span>
    </div>
  );
}

/** One line to read out: the item, "2 pc · 1 line, read it out", its aisle letter. */
export function GateLine(p: { b: YardBooks; o: YardOrder; i: number; tail: string; pill?: JSX.Element | null }): JSX.Element {
  const l = p.o.lines.filter((x) => !x.dropped)[p.i];
  const letter = aisleLetter(p.b, l.key);
  return (
    <div class="gt-line">
      <ItemSquare aisle={aisleOf(p.b, l.key) || 'Tools'} size={34} radius={9} icon={20} />
      <span class="gt-line-t"><span>{l.name}</span><span class="mono">{l.pickedQty ?? l.qty} <span class="rn-u">{`${l.unit} · ${p.tail}`}</span></span></span>
      {p.pill !== undefined ? p.pill : letter && <SoftPill tone="info">{letter}</SoftPill>}
    </div>
  );
}

function Empty(p: { b: YardBooks; children?: ComponentChildren }): JSX.Element {
  const b = p.b, n = now.value, c = counts(b, me.value, n), done = collectedToday(b, n);
  const coming = comingToTheGate(b, me.value, n).slice(0, 3);
  return (
    <>
      <Ghost tile={<Icon name="store" size={34} stroke={1.8} />}>
        <div class="gt-ghost-pic" />
        <GhostRow h={56} word="Hand over" />
      </Ghost>
      <EmptyWords title="Nobody to hand over" sub="Packed pickups wait here for their name or code" />
      {p.children}
      {coming.length > 0 && (
        <div class="ou-list">
          <span class="ou-list-k">Coming to the gate</span>
          <Card>{coming.map((o) => (
            <MiniOrder key={o.id} h={52} face={orderFace(o, b)} name={isAgent(o) ? `${o.client.name} · agent` : o.client.name} on={() => nav.replace('pack')}
              sub={`${orderNo(o.id)} · ${isAgent(o) ? 'by his code' : 'they collect'}`}
              pill={o.pickingStatus === 'in_progress' ? <SoftPill tone="warn" icon={<Icon name="clock" size={12} stroke={2.4} />}>Coming</SoftPill> : <SoftPill tone="info" icon={<Icon name="orders" size={12} stroke={2.6} />}>To pack</SoftPill>} />
          ))}</Card>
        </div>
      )}
      <WayIn icon="orders" word="To pack" count={c.toPack} on={() => nav.replace('pack')} />
      <SideTiles tiles={[
        { label: 'To load, the trucks’ list', icon: <Icon name="layers" size={20} stroke={1.9} />, title: 'To load', sub: 'the trucks’ list', on: () => nav.replace('out/load') },
        { label: `Delivered ${c.deliveredToday}`, good: true, icon: <Icon name="delivered" size={20} stroke={1.9} />, title: <>Delivered <span class="mono">{c.deliveredToday}</span></>, sub: done[0] ? `collected ${clock(done[0].deliveredAt as number)}` : 'today' },
      ]} />
    </>
  );
}

export function Gate(p: { params: Params }): JSX.Element {
  const b = books.value, n = now.value;
  const list = b ? atTheGate(b, me.value, n) : [];
  const want = p.params.id != null ? Number(p.params.id) : null;
  // Asked by id (a row, OU13): that order, a Not paid yet one as its own sheet. Else the first that can go; when the money
  // holds every one, the first, held (AD07: the lock, "Not paid yet", the slide locked "Stays until paid").
  const o = want != null ? (b ? b.orders.find((x) => x.id === want) || null : null) : list.find((x) => !moneyHeld(x)) || list[0] || null;
  const [name, setName] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const c = useCommit('handOver', o ? o.id : 0);
  if (!b) return <main class="st-ph" />;
  if (o && want != null && moneyHeld(o) && c.phase === 'ready') return <NotPaidGate b={b} o={o} />;
  const held = !!o && moneyHeld(o);
  const who = name ?? (o ? collector(o) : '');
  const from = o ? seller(b, o) : null;
  const sees = from ? `${firstWord(from.name)} sees: Delivered · collected` : 'Delivered · collected';
  const args = () => [o!.id, who.split(' · ')[0].trim() || o!.client.name, false];

  if (o && c.phase === 'done') {
    const nextUp = list.filter((x) => x.id !== o.id)[0];
    return (
      <Done mark="hand-over" title="Handed over" chip={{ face: orderFace(o, b), name: o.client.name, sub: `${orderNo(o.id)}${o.client.phone ? ` · ${who.split(' · ')[1] || ''}` : ''}` }}
        sees={from ? [{ face: yardFace(b, from), who: firstWord(from.name), what: 'Delivered · collected' }] : []}
        next={[
          { icon: 'delivered', title: 'Delivered · collected', sub: `${clock(n)} · off the shelf` },
          { icon: 'receipt', title: 'The bill', sub: 'goes by itself after 24 h' },
          ...(nextUp ? [{ icon: 'store' as const, title: 'Next at the gate', sub: `${orderNo(nextUp.id)} · ${isAgent(nextUp) ? `${firstWord(nextUp.client.name)} brings his code` : nextUp.client.name}` }] : []),
        ]}
        undo={`Collected ${clock(n)} · ${who.split(' · ')[0]}`} />
    );
  }

  const rest = list.filter((x) => !o || x.id !== o.id);
  const oldest = list.length ? Math.min(...list.map((x) => x.stageEnteredAt ?? n)) : null;
  const sub = list.length && oldest != null ? `at the gate · oldest ${howLong(oldest, n)}` : `at the gate · ${clock(n)}`;
  const busy = c.phase === 'sending', kept = c.phase === 'kept', dim = c.phase !== 'ready';
  const done = collectedToday(b, n);
  const agentNow = o ? isAgent(o) : false;
  const foot = o && (held ? (
    <SheetDock hint={{ icon: 'bell', text: 'Opens when paid', iconTone: 'mint' }}>
      <Slide label="Stays until paid" onCommit={() => undefined} lock={{ icon: 'lock', label: 'Stays until paid', onTap: () => nav.push('out/gate', { id: o.id }) }} />
    </SheetDock>
  ) : (
    <SheetDock hint={busy ? { icon: 'lock', text: 'Held on this phone until the shop says yes' }
      : kept ? { icon: 'clock', text: 'Sends when the signal is back', tone: 'amber' }
        : c.phase === 'failed' ? { icon: 'check', text: 'The name is kept', iconTone: 'mint' }
          : { icon: 'bell', text: sees, iconTone: 'mint' }}>
      {busy ? <Slide label="" onCommit={() => undefined} state="sending" sendWord="Handing over…" />
        : kept ? <Slide label="Not sent yet" onCommit={() => undefined} lock={{ icon: 'lock', label: 'Not sent yet' }} />
          : c.phase === 'failed' ? <Slide label="Not saved yet" onCommit={() => undefined} lock={{ icon: 'lock', label: 'Not saved yet' }} />
            : agentNow ? <Slide label="Code first" onCommit={() => undefined} lock={{ icon: 'lock', label: 'Code first', onTap: () => nav.push('out/gate-code', { id: o.id }) }} />
              : <Slide label={`Slide to hand over ${orderNo(o.id)}`} onCommit={() => c.commit(`Handed over ${orderNo(o.id)}`, args())} onHint={() => toast.show('Slide the red button across', { kind: 'warn' })} />}
    </SheetDock>
  ));
  const paidBy = o ? whoIs(b, o.paidBy) : null;
  const next = rest.length > 0 && (
    <>
      <DotHead dot="#C9C4BA" title="Next at the gate" count={rest.length} right={rest.every(isAgent) && !dim ? <span class="gt-by">by his code</span> : null} />
      <Card>{rest.map((x) => (
        <div key={x.id} class="gt-next">
          <Avatar {...orderFace(x, b)} size={36} font={13} style={{ letterSpacing: '-.02em' }} />
          <span class="gt-next-t"><span>{isAgent(x) ? `${x.client.name} · agent` : x.client.name}</span>
            <span class="mono">{`${orderNo(x.id)} · packed ${clock(x.pickingDoneAt ?? n)} · ${x.lines.filter((l) => !l.dropped).length} ${plural(x.lines.filter((l) => !l.dropped).length, 'line')}`}</span></span>
          {moneyHeld(x) && <NotPaid />}
          {dim ? <span role="link" aria-disabled="true" class="gt-code dim"><span>{isAgent(x) ? 'Code' : 'Open'}</span></span>
            : <Tap on={() => (isAgent(x) ? nav.push('out/gate-code', { id: x.id }) : nav.push('out/gate', { id: x.id }))} class="gt-code">
              <span>{isAgent(x) ? 'Code' : 'Open'}</span>
            </Tap>}
        </div>
      ))}</Card>
    </>
  );
  return (
    <StageSheet flat gap={8} id="out/gate" lit="out/road" mint title="Ready to collect" count={list.length} sub={sub} foot={foot}
      bar={kept ? <FlowBar kind="offline" onRetry={() => { void c.again(args()); }} /> : c.phase === 'failed' ? <FlowBar kind="failed" code={c.code} onRetry={() => { void c.again(args()); }} /> : null}>
      {!o ? <Empty b={b}>{next}</Empty> : (
        <>
          <div class="gt-card">
            <GatePic since={o.stageEnteredAt ?? n} held={held} />
            <div class="gt-body">
              <div class="gt-who">
                <Avatar {...orderFace(o, b)} size={36} font={13} style={{ letterSpacing: '-.02em' }} />
                <span class="gt-who-t"><span>{o.client.name}</span><span class="mono">{orderNo(o.id)} · {clock(o.createdAt ?? n)}</span></span>
                {held ? <NotPaid /> : kept ? <SoftPill tone="warn" icon={<Icon name="clock" size={12} stroke={2.4} />}>Not sent yet</SoftPill>
                  : <SoftPill tone="good" icon={<Icon name="check" size={12} stroke={2.6} />}>{paidBy && o.paidAt != null ? `Paid · ${firstWord(paidBy.name)} ${clock(o.paidAt)}` : 'Paid'}</SoftPill>}
              </div>
              <div class="gt-lines">{o.lines.filter((l) => !l.dropped).map((_, i, all) => <GateLine key={i} b={b} o={o} i={i} tail={held ? 'leaves when paid' : `${all.length} ${plural(all.length, 'line')}, read it out`} />)}</div>
              {!held && <label class={cx('gt-field', dim && 'dim')}>
                <span class="gt-field-k">Who collects · from the order</span>
                <span class="gt-field-v">
                  <Icon name="person" size={18} stroke={2} />
                  {editing ? <input type="text" value={who} aria-label="Who collects" onInput={(e) => setName((e.target as HTMLInputElement).value)} onBlur={() => setEditing(false)} />
                    : <span class="gt-field-n">{who}</span>}
                  <button type="button" class="gt-pen" aria-label="Change who collects" disabled={dim} onClick={() => setEditing(true)}><Icon name="pen" size={15} stroke={2} /></button>
                </span>
              </label>}
            </div>
          </div>
          {held && <><Told b={b} o={o} /><Calls b={b} o={o} /></>}
          {next}
          {!kept && done[0] && (
            <div class="gt-done"><Icon name="check" size={16} stroke={2.8} /><span>Done today</span><span class="mono">{done.map((x) => `${orderNo(x.id)} · collected ${clock(x.deliveredAt as number)}`)[0]}</span></div>
          )}
        </>
      )}
    </StageSheet>
  );
}
