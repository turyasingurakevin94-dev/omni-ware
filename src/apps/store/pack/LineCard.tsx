/*
 * The pack card's bodies (store-agent PK02 the line, PK03 pressed, PK18 sending, PK11 kept with
 * no signal, PK12 not saved; PK04 Pack short, PK16 sending, PK19 not saved; PK05 the short sent).
 * One card per line, the picture first and the aisle letter big; the line opens at what was
 * ordered. Red packs the whole line, Short is amber. The dock is the body's last child.
 */
import type { JSX } from 'preact';
import { orderNo } from '../../../core/names.ts';
import { whoIs, personFace } from '../../../core/store/faces.ts';
import { aisleOf, dropped, unitWord, whereOf } from '../../../core/store/pack.ts';
import type { YardBooks, YardLine, YardOrder } from '../../../core/store/types.ts';
import { clock } from '../../../core/time.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { AISLE, Duo, Icon, aisleKey } from '../../../ui/icons.tsx';
import { Tap, cx } from '../../../ui/util.tsx';
import { nav } from '../shell/nav.ts';
import { now } from '../shell/store.ts';
import type { Busy } from './Pack.tsx';
import { NotDoneCard, TopNotice, WhereCard } from './parts.tsx';
import { Boxes } from './pics.tsx';

const no = (b: YardBooks, l: YardLine, o: YardOrder) => `Line ${o.lines.indexOf(l) + 1} of ${o.lines.length}`;

/** The aisle's letter, big, on its colour (52 px). */
export function AisleTile(p: { b: YardBooks; l: YardLine }): JSX.Element {
  const a = aisleOf(p.b, p.l), c = AISLE[aisleKey(a ? a.name : p.l.name)];
  return (
    <span role="img" aria-label={a ? `Aisle ${a.letter}, ${a.name}` : 'No aisle yet'} class="pk-aisle" style={{ background: c.soft, color: c.ink }}>
      <span class="mono">{a ? a.letter : '·'}</span><span>{a ? a.name : 'No aisle'}</span>
    </span>
  );
}

/** "Came in 10:05 · Denis's trip": a bought-in line that is here. */
function cameIn(b: YardBooks, o: YardOrder, l: YardLine): string | null {
  if (!l.supplierId || l.supplierId === '__stock__' || l.receivedAt == null) return null;
  const t = b.trips.find((x) => x.lines.some((y) => y.orderId === o.id && y.productId === l.productId));
  const r = t ? whoIs(b, t.runnerId) : null;
  return `Came in ${clock(l.receivedAt)}${r ? ` · ${r.name.split(' ')[0]}’s trip` : t ? ` · ${t.supplierName}` : ''}`;
}

/** The line's name, broken where its own comma is ("Wheelbarrow, / heavy duty"). */
function Name(p: { name: string }): JSX.Element {
  const i = p.name.indexOf(', ');
  return <span class="pk-line-n">{i > 0 ? <>{p.name.slice(0, i + 1)}<br />{p.name.slice(i + 2)}</> : p.name}</span>;
}

function Dropped(p: { b: YardBooks; o: YardOrder; taker: string }): JSX.Element {
  const t = whoIs(p.b, p.o.takenBy);
  return (
    <>
      {dropped(p.o).map((l) => (
        <div key={l.idx} class="pk-card pk-drop">
          <span aria-hidden="true" class="pk-drop-i" style={{ background: `linear-gradient(145deg, ${AISLE[aisleKey(aisleOf(p.b, l)?.name || l.name)].soft} 0%, #FFFFFF 150%)` }}>
            <Duo i={AISLE[aisleKey(aisleOf(p.b, l)?.name || l.name)].i} size={18} color={AISLE[aisleKey(aisleOf(p.b, l)?.name || l.name)].ink} />
          </span>
          <span class="pk-drop-t"><s>{`${l.name.split(' · ')[0]} · `}<span class="mono">{l.qty}</span>{` ${l.unit}`}</s><span>not found · nothing to pack</span></span>
          {t && <span class="pk-drop-w"><Avatar {...personFace(t)} size={20} />{`${p.taker} knows`}</span>}
        </div>
      ))}
    </>
  );
}

export interface LineViewProps {
  b: YardBooks;
  o: YardOrder;
  l: YardLine | null;
  busy: Busy;
  kept: boolean;
  taker: string;
  onPacked: () => void;
  onShort: () => void;
  /** Every line answered, the order not finished: finish it onto its bay. */
  onFinish: () => void;
  retry: (() => void) | null;
  onClose: () => void;
}

/** The dock with no signal: kept on this phone, "Back online to finish" (PK11). */
function KeptDock(): JSX.Element {
  return (
    <div class="pk-dock col">
      <span class="pk-kept"><Icon name="clock" size={14} stroke={2.2} />Kept on this phone · it sends by itself</span>
      <button type="button" class="pk-btn off" aria-disabled="true"><Icon name="offline" size={18} stroke={2.2} />Back online to finish</button>
    </div>
  );
}

/** PK02: the line now, the where card, the dropped lines, then Short and Packed. */
export function LineView(p: LineViewProps): JSX.Element {
  const { b, o, l } = p;
  if (!l) {
    return (
      <>
        <TopNotice waitingWord="not sent yet" />
        <WhereCard where={whereOf(o, b)} name={o.client.name} /><Dropped b={b} o={o} taker={p.taker} />
        {p.kept ? <KeptDock /> : (
          <div class="pk-dock one">
            <button type="button" class="pk-btn red" onClick={p.onFinish}><Icon name="check" size={18} stroke={2.6} />{`Finish ${orderNo(o.id)}`}</button>
          </div>
        )}
      </>
    );
  }
  const came = cameIn(b, o, l), a = aisleOf(b, l), c = AISLE[aisleKey(a ? a.name : l.name)];
  const it = b.items.find((x) => x.key === l.key);
  const stamp = p.kept ? 'Packed · not sent' : p.busy === 'failed' ? 'Packed · not saved' : null;
  return (
    <>
      <TopNotice waitingWord="not sent yet" />
      <div class="pk-card pk-line">
        <div class="pk-line-h">
          <AisleTile b={b} l={l} />
          <span class="pk-line-e"><span>{`${no(b, l, o)}${a ? ` · aisle ${a.letter}` : ''}`}</span>{came && <span class="pk-came"><Icon name="came-in" size={14} stroke={2.2} />{came}</span>}</span>
        </div>
        <Tap on={() => nav.push('shelf/item', { key: l.key })} label={`${l.name}: open the item`} class={cx('pk-pic', stamp && 'stamped')}>
          {it && it.image ? <img src={it.image} alt="" /> : <Duo i={c.i} size={84} color={c.ink} />}
          <span class="mono pk-pic-x">{`×${l.qty}`}</span>
          {stamp && <span class={cx('pk-stamp', p.busy === 'failed' && !p.kept && 'bad')}><Icon name="clock" size={16} stroke={2.4} />{stamp}</span>}
        </Tap>
        <div class="pk-line-f"><Name name={l.name} /><span class="pk-line-q"><span class="mono">{l.qty}</span><span>{l.unit}</span></span></div>
      </div>
      <WhereCard where={whereOf(o, b)} name={o.client.name} />
      {!p.kept && p.busy !== 'failed' && <Dropped b={b} o={o} taker={p.taker} />}
      {p.busy === 'failed' && p.retry ? <NotDoneCard what={`Packed ${orderNo(o.id)} · your ticks are kept on this phone`} onRetry={p.retry} onClose={p.onClose} />
        : p.kept ? <KeptDock /> : (
          <div class="pk-dock">
            <button type="button" class="pk-btn white" disabled={p.busy === 'sending'} onClick={p.onShort}><Icon name="minus" size={18} stroke={2.4} />Short</button>
            <button type="button" class="pk-btn red" disabled={p.busy === 'sending'} aria-busy={p.busy === 'sending'} onClick={p.onPacked}>
              {p.busy === 'sending' ? <><span aria-hidden="true" class="pk-spin" />Sending…</> : <><Icon name="check" size={18} stroke={2.6} />{'Packed · '}<span class="mono">{l.qty}</span>{` ${l.unit}`}</>}
            </button>
          </div>
        )}
    </>
  );
}

export interface ShortViewProps {
  b: YardBooks;
  o: YardOrder;
  l: YardLine;
  n: number;
  busy: Busy;
  onN: (n: number) => void;
  onSend: () => void;
  retry: (() => void) | null;
  onClose: () => void;
}

/** PK04: how many are here, in the unit you can see; Ruth settles the short, Grace is told. */
export function ShortView(p: ShortViewProps): JSX.Element {
  const { b, o, l, n } = p, a = aisleOf(b, l), q = l.qty, ruth = b.people.find((x) => x.role === 'manager'), t = whoIs(b, o.takenBy);
  const opts = q <= 4 ? Array.from({ length: q + 1 }, (_v, i) => i) : [Math.max(0, q - 2), q - 1, q];
  const rn = ruth ? ruth.name.split(' ')[0] : 'Ruth', tn = t ? t.name.split(' ')[0] : 'Sales';
  return (
    <>
      <div class="pk-card pk-line pk-short">
        <div class="pk-line-h">
          <AisleTile b={b} l={l} />
          <span class="pk-line-e"><span>{`${no(b, l, o)}${a ? ` · aisle ${a.letter}` : ''}`}</span><b>{l.name}</b>
            <span class="pk-asks">the order asks <b class="mono">{q}</b>{` ${l.unit}`}</span></span>
        </div>
        <span class="pk-q">{`How many ${unitWord(l.unit)} are here?`}</span>
        <div class="pk-tiles" style={{ gridTemplateColumns: `repeat(${opts.length}, minmax(0, 1fr))` }}>
          {opts.map((x) => (
            <button key={x} type="button" aria-pressed={x === n} class={cx('pk-tile', x === n && 'on')} disabled={p.busy === 'sending'} onClick={() => p.onN(x)}>
              <span class="mono">{x}</span><span>{x === q ? `${l.unit} · all` : l.unit}</span>
              {x === n && <span class="pk-tile-k"><Icon name="check" size={12} stroke={3.2} /></span>}
            </button>
          ))}
        </div>
        <div role="img" aria-label={`${n} of ${q} ${unitWord(l.unit)} here, ${q - n} short`} class="pk-goes">
          <Boxes have={n} of={q} size={38} />
          <span><b class="good"><span class="mono">{n}</span>{` ${l.unit} goes`}</b><b class="warn"><span class="mono">{q - n}</span>{` ${l.unit} short`}</b></span>
        </div>
      </div>
      <div class="pk-card pk-who2">
        {ruth && <div><Avatar {...personFace(ruth)} size={32} /><span><b>{`${rn} settles the short`}</b><span>she decides what goes</span></span><span class="pk-tag info">{`${rn} decides`}</span></div>}
        {t && <div><Avatar {...personFace(t)} size={32} /><span><b>{`${tn} is told`}</b><span>{`she sees “${q - n} short · ${rn} settles”`}</span></span><span class="pk-tag"><Icon name="bell" size={13} stroke={2.4} />push</span></div>}
      </div>
      {p.busy !== 'failed' && <WhereCard where={whereOf(o, b)} name={o.client.name} />}
      {p.busy === 'failed' && p.retry ? <NotDoneCard what={`Pack short ${orderNo(o.id)} · your count is kept`} onRetry={p.retry} onClose={p.onClose} />
        : (
          <div class="pk-dock one">
            <button type="button" class="pk-btn amber" disabled={p.busy === 'sending'} aria-busy={p.busy === 'sending'} onClick={p.onSend}>
              {p.busy === 'sending' ? <><span aria-hidden="true" class="pk-spin" />Sending…</> : <><Icon name="minus" size={18} stroke={2.4} />{`Pack short · ${n} of ${q} ${l.unit}`}</>}
            </button>
          </div>
        )}
    </>
  );
}

/** PK05: the short is with Ruth; every line is done and the order finishes (tap to finish now). */
export function SentView(p: { b: YardBooks; o: YardOrder; l: YardLine; n: number; at: number; taker: string; onFinish: () => void }): JSX.Element {
  const { b, o, l, n } = p, a = aisleOf(b, l), ruth = b.people.find((x) => x.role === 'manager'), rn = ruth ? ruth.name.split(' ')[0] : 'Ruth';
  const steps: [string, string, boolean][] = [
    [`Sent to ${rn}`, `${n} of ${l.qty} ${l.unit} packed · ${clock(now.value)}`, true],
    [`${p.taker} told`, `she sees “${l.qty - n} short · ${rn} settles”`, true],
    [`${rn} settles the short`, 'her answer comes back here as a push', false],
  ];
  return (
    <>
      <div class="pk-card pk-line">
        <div class="pk-line-h">
          <AisleTile b={b} l={l} />
          <span class="pk-line-e"><span>{`${no(b, l, o)}${a ? ` · aisle ${a.letter}` : ''}`}</span><b>{l.name}</b></span>
        </div>
        <div role="img" aria-label={`${n} ${unitWord(l.unit, n)} packed, ${l.qty - n} short`} class="pk-pic small"><Boxes have={n} of={l.qty} size={72} max={2} /></div>
        <div class="pk-sent-f"><span>packed</span><span><span class="mono">{n}</span>{` of ${l.qty} ${l.unit}`}</span></div>
        <span class="pk-stamp warn">{`${l.qty - n} short`}</span>
      </div>
      <div class="pk-card pk-steps">
        {steps.map(([t, s, done], i) => (
          <div key={t}>
            <span class={cx('pk-step-i', done ? 'done' : 'wait')}><Icon name={done ? 'check' : 'hourglass'} size={15} stroke={done ? 3 : 2.2} /></span>
            {i < steps.length - 1 && <span aria-hidden="true" class="pk-step-l" />}
            <span><b>{t}</b><span>{s}</span></span>
          </div>
        ))}
      </div>
      <button type="button" class="pk-finishing" onClick={p.onFinish}>
        <span class="pk-finishing-t"><Icon name="check" size={14} stroke={3} /></span>
        <span>{`Every line done · finishing ${orderNo(o.id)}`}</span>
        <span aria-hidden="true" class="pk-spin mint" />
      </button>
    </>
  );
}
