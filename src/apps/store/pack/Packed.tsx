/*
 * Packed (store-agent PK06; PK07 a pickup, Ready to collect) and Unpacked (PK15). The moment on
 * navy: the tick, who it is for, the bay picked for you (Change), what goes back to the other apps,
 * three figures, the next job, and one button, Back to Today. While the pack waits its 10 s the
 * Undo ring sits top left; Undo unpacks it: back to Packing now, ticks kept, the bay freed.
 */
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { firstWord, orderNo } from '../../../core/names.ts';
import { bayCount, bayMap, freeBays } from '../../../core/store/bays.ts';
import { customerFace, personFace, whoIs } from '../../../core/store/faces.ts';
import { aisleOf, dropped, packLines, progress, whereOf } from '../../../core/store/pack.ts';
import type { YardOrder } from '../../../core/store/types.ts';
import { isMine, moneyHeld } from '../../../core/store/yard.ts';
import { clock, howLong } from '../../../core/time.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { FullSheet } from '../../../ui/FullSheet.tsx';
import { Track } from '../../../ui/Track.tsx';
import { Duo, Icon, phPlay, AISLE, aisleKey } from '../../../ui/icons.tsx';
import { Tap, cx } from '../../../ui/util.tsx';
import { nav } from '../shell/nav.ts';
import { readyJobs, yardJobs } from '../../../core/store/jobs.ts';
import { books, held, me, now } from '../shell/store.ts';
import { StateHead } from './head.tsx';
import { WhereCard, toSheet } from './parts.tsx';
import './moment.css';
import { Glyph } from './glyphs.tsx';

/** The Undo ring's seconds left, while the pack waits. */
function useLeft(): number {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 500); return () => clearInterval(t); }, []);
  const h = held.value;
  return h ? Math.max(0, Math.ceil((h.until - Date.now()) / 1000)) : 0;
}

function Bays(p: { o: YardOrder; bay: number | null; pickup: boolean; onBay: (n: number) => void }): JSX.Element {
  const b = books.value;
  const [choose, setChoose] = useState(false);
  if (!b) return <></>;
  const map = bayMap(b), n = bayCount(b), free = freeBays(b), shown = p.pickup ? Math.min(n, 3) : Math.min(n, 12);
  const title = p.pickup ? 'At the gate · they collect' : p.bay != null ? `Bay ${p.bay} · picked for you` : 'Every bay is full · leave it by the gate';
  const tiles: JSX.Element[] = [];
  for (let i = 1; i <= shown; i++) {
    const x = map.get(i), mine = !p.pickup && (p.bay === i || (x && x.id === p.o.id));
    const other = x && x.id !== p.o.id ? x : null;
    const canPick = choose && !other && !mine;
    const inner = <><span>{`Bay ${i}`}</span>{mine ? <b class="mono">{orderNo(p.o.id)}</b> : other ? <b class={cx('mono', moneyHeld(other) && 'amber')}>{orderNo(other.id)}</b> : <span>free</span>}</>;
    tiles.push(canPick || (choose && mine)
      ? <button key={i} type="button" class={cx('mo-bay', mine ? 'mine' : 'free', 'pick')} onClick={() => { p.onBay(i); setChoose(false); }}>{inner}</button>
      : <span key={i} class={cx('mo-bay', mine ? 'mine' : other ? 'taken' : 'free')}>{inner}</span>);
  }
  if (p.pickup) tiles.push(<span key="gate" class="mo-bay mine"><span>Gate</span><b class="mono">{orderNo(p.o.id)}</b></span>);
  return (
    <div class="mo-card mo-bays">
      <div class="mo-bays-h"><span class="mo-eye">{title}</span>{free.length > 0 && <button type="button" class="mo-change" aria-pressed={choose} onClick={() => setChoose(!choose)}>{choose ? 'Done' : 'Change'}</button>}</div>
      <div class="mo-bays-g">{tiles}</div>
    </div>
  );
}

interface Back { face?: JSX.Element; icon?: JSX.Element; tone: 'mint' | 'amber' | 'glass'; title: string; sub: string; on?: () => void }

function GoesBack(p: { rows: Back[] }): JSX.Element {
  return (
    <div class="mo-card mo-back">
      <span class="mo-eye">What goes back</span>
      {p.rows.map((r, i) => {
        const inner = (
          <>
            <span class={'mo-back-i t-' + r.tone}>{r.face || r.icon}</span>
            {i < p.rows.length - 1 && <span aria-hidden="true" class="mo-back-l" />}
            <span class="mo-back-t"><b>{r.title}</b><span class={'t-' + r.tone}>{r.sub}</span></span>
            {r.on && <span class="mo-chev"><Icon name="chevron-right" size={14} stroke={2.4} /></span>}
          </>
        );
        return r.on ? <Tap key={r.title} on={r.on} class="mo-back-r">{inner}</Tap> : <div key={r.title} class="mo-back-r">{inner}</div>;
      })}
    </div>
  );
}

export function Packed(p: { o: YardOrder; bay: number | null; held: boolean; onUndo: () => void; onBay: (n: number) => void }): JSX.Element {
  const b = books.value, left = useLeft();
  if (!b) return <></>;
  const o = p.o, c = customerFace(o, b), w = whereOf(o, b), pickup = w.pickup, pr = progress(o);
  const t = whoIs(b, o.takenBy), tn = t ? firstWord(t.name) : 'Sales', ruth = b.people.find((x) => x.role === 'manager'), rn = ruth ? firstWord(ruth.name) : 'Ruth';
  const agent = o.originAgentId ? b.agents.find((a) => a.id === o.originAgentId) : null;
  const at = clock(o.pickingDoneAt ?? now.value), notPaid = moneyHeld(o), driver = whoIs(b, o.runDriver);
  const rows: Back[] = [];
  if (agent) rows.push({ face: <Avatar {...c} size={24} />, tone: 'mint', title: `${firstWord(agent.name)} sees: Ready to collect`, sub: `push to agent ${firstWord(agent.name)} · ${at}` });
  if (t) rows.push({ face: <Avatar {...personFace(t)} size={24} onNavy />, tone: 'mint', title: `${tn} sees: ${pickup ? 'Ready to collect' : 'Packed'}`, sub: `push to ${tn} · ${at}` });
  if (notPaid) rows.push({ icon: <Icon name="clock" size={18} stroke={2} />, tone: 'amber', title: `Not paid yet · ${tn} takes the money`, sub: `${rn} may let it go on credit · push to both` });
  if (pickup) {
    rows.push({ icon: <Icon name="store" size={18} stroke={2} />, tone: 'glass', title: agent ? `At the gate · code ${String(o.id).padStart(4, '0')}` : 'At the gate · they collect',
      sub: agent ? `${firstWord(agent.name)} shows it · Hand over · one slide` : `${notPaid ? 'leaves when paid · ' : ''}Hand over · one slide`, on: () => nav.push('out/gate', { id: o.id }) });
  } else {
    rows.push({ icon: <Glyph name="layers" size={18} stroke={2} />, tone: 'glass', title: `To load → ${w.to.split(/[ ,]/)[0]}${w.when ? ' · ' + w.when : ''}`,
      sub: `${driver ? firstWord(driver.name) + ' · ' : ''}${notPaid ? 'leaves when paid' : 'goes on the next run'}`, on: () => nav.replace('out/load') });
  }
  const ls = packLines(o), one = ls.length === 1 ? ls[0] : null, drops = dropped(o).length;
  const took = o.workerAcceptedAt != null && o.pickingDoneAt != null ? o.pickingDoneAt - o.workerAcceptedAt : o.workerAcceptedAt != null ? now.value - o.workerAcceptedAt : null;
  const tiles: [string, string, string][] = [
    one ? [String(one.pickedQty ?? one.qty), `${one.unit} packed`, ''] : [took != null ? howLong(0, took).replace(/ /g, '') : '—', 'to pack', ''],
    [`${pr.done}/${pr.of}`, 'lines in', 'mint'],
    drops ? [String(drops), 'dropped', 'rose'] : [String(pr.short), 'short', ''],
  ];
  // The next job ready now (core/store/jobs.ts, Today's list), not this order.
  const next = readyJobs(yardJobs(b, me.value, now.value)).find((j) => j.orderId !== o.id && j.kind !== 'close');
  const nextO = next && next.orderId != null ? b.orders.find((x) => x.id === next.orderId) : null;
  const WORD: Record<string, string> = { checkin: 'Check in the trip', delivery: 'Check in the delivery', ride: 'Ride the trip', return: 'Check a return', coming: 'Coming in', report: 'Report a loss', count: 'Count an aisle', load: 'Load', gate: 'Hand over at the gate' };
  const nextLabel = nextO && (next?.kind === 'carry-on' || next?.kind === 'for-you' || next?.kind === 'pack')
    ? `${next.kind === 'carry-on' || (isMine(nextO, me.value) && nextO.pickingStatus === 'in_progress') ? 'Carry on' : 'Pack'} ${orderNo(nextO.id)} · ${firstWord(nextO.client.name)}`
    : next ? WORD[next.kind] || 'Next job' : '';
  return (
    <main class="mo" data-route="pack/order">
      <button type="button" class="mo-x" aria-label="Close: back to Today" onClick={() => nav.home()}><Icon name="close" size={16} stroke={2.2} /></button>
      {p.held && left > 0 && (
        <button type="button" class="mo-undo" aria-label={`Undo: unpack, ${left} seconds left`} onClick={p.onUndo}>
          <span>
            <svg width="24" height="24" viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="9" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="2.5" /><circle cx="11" cy="11" r="9" fill="none" stroke="#6FDCB0" stroke-width="2.5" stroke-linecap="round" stroke-dasharray={`${(56.5 * left) / 10} 56.5`} transform="rotate(-90 11 11)" /></svg>
            Undo<b class="mono">{`${left}s`}</b>
          </span>
        </button>
      )}
      <div class="mo-in">
        <div class="mo-top">
          <span class="mo-tick"><Icon name="check" size={40} stroke={2.8} /></span>
          <h1>{pickup ? 'Ready to collect' : 'Packed'}</h1>
          <span class="mo-who"><Avatar {...c} size={28} /><span>{firstWord(c.name)}</span><span class="mono">{`${orderNo(o.id)} · ${ls.length} line${ls.length === 1 ? '' : 's'}`}</span></span>
        </div>
        <Bays o={o} bay={p.bay} pickup={pickup} onBay={p.onBay} />
        <GoesBack rows={rows} />
        <div class="mo-figs">{tiles.map(([v, k, tone]) => <span key={k}><b class={cx('mono', tone && 't-' + tone)}>{v}</b><span>{k}</span></span>)}</div>
        <div class="mo-end">
          {next && (
            <Tap on={() => { nav.home(); nav.push(next.route, next.params); }} class="mo-next">
              <span class="mo-next-i"><Duo i={phPlay} size={14} color="#FFFFFF" /></span>
              <span class="mo-next-t"><span>Next job</span><b>{nextLabel}</b></span>
              <span class="mo-next-go">Start<Icon name="chevron-right" size={13} stroke={2.6} /></span>
            </Tap>
          )}
          <button type="button" class="mo-home" onClick={() => nav.home()}>Back to Today</button>
        </div>
      </div>
    </main>
  );
}

/** PK15: unpacked. Back in Packing, the bay free, the ticks kept; "Packed again" packs it onto its bay. */
export function Unpacked(p: { o: YardOrder; bay: number | null; onAgain: () => void }): JSX.Element {
  const b = books.value;
  if (!b) return <></>;
  const o = p.o, t = whoIs(b, o.takenBy), tn = t ? firstWord(t.name) : 'Sales', ls = packLines(o), pr = progress(o);
  const log = o.stageLog, when = (s: string) => { const x = log.find((e) => e.status === s); return x ? clock(x.at) : undefined; };
  const bought = o.lines.some((l) => l.supplierId && l.supplierId !== '__stock__');
  const times = { checking: clock(o.createdAt ?? o.savedAt ?? now.value), buying: when('awaiting_goods') };
  const since = o.workerAcceptedAt != null ? `since ${clock(o.workerAcceptedAt)}` : '';
  return (
    <FullSheet onBack={toSheet} backLabel="Back to To pack" pad="14px 16px 16px"
      head={(
        <StateHead b={b} o={o} sub={`${orderNo(o.id)} · ${since}`} word="Packing" tail="unpacked · your ticks stay" onClose={toSheet}
          who={null} sees="" tone="glass">
          <Track stage="packing" sub="" times={times} skipped={bought ? [] : ['buying']} />
        </StateHead>
      )}>
      <div role="img" aria-label={`Bay ${p.bay ?? ''} is free, ${orderNo(o.id)} is back in To pack`} class="pk-card pk-fromto">
        <span class="pk-ft-a dash"><b>Bay <span class="mono">{p.bay ?? '—'}</span></b><span class="good">free now</span></span>
        <span class="pk-ft-arrow"><Icon name="arrow-right" size={20} stroke={2} /></span>
        <span class="pk-ft-b info"><Icon name="orders" size={18} stroke={2} /><span>For you · to pack</span></span>
      </div>
      <div class="pk-card pk-list">
        <div class="pk-list-h"><span>Your ticks stay</span><span class="pk-list-p"><span aria-hidden="true">{ls.map((l) => <i key={l.idx} class={l.pickStatus ? 'on' : ''} />)}</span><b class="mono">{`${pr.done} of ${pr.of}`}</b></span></div>
        {ls.map((l) => {
          const a = aisleOf(b, l), k = AISLE[aisleKey(a ? a.name : l.name)];
          return (
            <div key={l.idx} class="pk-list-r">
              <span aria-hidden="true" class="pk-list-i" style={{ background: `linear-gradient(145deg, ${k.soft} 0%, #FFFFFF 150%)` }}><Duo i={k.i} size={20} color={k.ink} /></span>
              <span class="pk-list-t"><b>{l.name}</b><span class="mono">{`${l.pickedQty ?? l.qty} `}<span class="pk-sans">{l.unit}</span>{a ? ` · aisle ${a.letter}` : ''}</span></span>
              {l.pickStatus && <span class="pk-list-k"><span role="img" aria-label="Packed" class="pk-tick"><Icon name="check" size={13} stroke={3} /></span></span>}
            </div>
          );
        })}
      </div>
      {t && <div class="pk-told"><Avatar {...personFace(t)} size={28} /><span>{`${tn} sees: `}<b>Packing</b> again</span><span class="pk-tag"><Icon name="bell" size={13} stroke={2.4} />push</span></div>}
      <WhereCard where={whereOf(o, b)} name={o.client.name} />
      <button type="button" class="pk-btn navy" style={{ marginTop: 'auto' }} onClick={p.onAgain}><Icon name="check" size={18} stroke={2.6} />Packed again</button>
    </FullSheet>
  );
}
