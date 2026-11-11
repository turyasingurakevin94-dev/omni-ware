/*
 * To pack, the stage sheet (store-agent PK01; PK08 For you, PK13 someone else just did this,
 * PK14 empty, PK20 offline; routes `pack { first? }`). Over Today: the navy head with the rail,
 * the chips For you · To pack · Packing now · Packed · Waiting on goods (the chosen one's
 * section first), then the sections. Act from the list: Pack, Carry on; a copy, someone else's
 * order and Waiting on goods open look-only screens; a cancelled one opens Put back.
 */
import type { JSX } from 'preact';
import { firstWord, orderNo } from '../../../core/names.ts';
import type { YardOrder } from '../../../core/store/types.ts';
import { clock } from '../../../core/time.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { StatusPill } from '../../../ui/Pill.tsx';
import { Tap, cx } from '../../../ui/util.tsx';
import { nav } from '../shell/nav.ts';
import { StageSheet } from '../shell/StageSheet.tsx';
import { books, me, now } from '../shell/store.ts';
import { FaceBadge, PushCard, Section, TopNotice, savedLine } from './parts.tsx';
import { ToPackEmpty } from './ToPackEmpty.tsx';
import { CHIPS, chipPicked, moved, sheetOf, type Chip, type Row, type Sheet } from './sheet-data.ts';
import { Glyph } from './glyphs.tsx';

const MARK: Record<string, string> = { done: '#0F6B43', short: '#95530C', now: '#F5B26B', open: '#F5B26B', dropped: '#8E2A22' };

const open = (o: YardOrder) => nav.push('pack/order', { id: o.id });

function Sub(p: { r: Row }): JSX.Element {
  const r = p.r, no = orderNo(r.o.id), o = r.o;
  if (r.kind === 'copy') return <span class="mono pk-row-s">{`${no} · copy of ${orderNo(o.copyOf as number)}`}</span>;
  if (r.kind === 'theirs') return <span class="mono pk-row-s">{`${no} · ${r.whose.replace(/’s$/, '')}${o.workerAcceptedAt != null ? ' · ' + clock(o.workerAcceptedAt) : ''}`}</span>;
  if (r.kind === 'packed' || r.kind === 'cancelled') {
    return <span class="mono pk-row-s">{`${no}${o.bay != null ? ` · bay ${o.bay}` : ''}${r.notPaid && r.kind === 'packed' ? ' · ' : ''}`}{r.notPaid && r.kind === 'packed' && <b class="pk-notpaid">Not paid yet</b>}</span>;
  }
  if (r.pickup && r.kind === 'pack') return <span class="mono pk-row-s">{`${no} · `}<Icon name="store" size={12} stroke={2.2} />they collect</span>;
  return <span class="mono pk-row-s">{`${no} · ${o.deliverWhen || r.to}`}</span>;
}

export function PackRow(p: { r: Row; first?: boolean }): JSX.Element {
  const r = p.r;
  if (r.kind === 'copy' || r.kind === 'theirs' || r.kind === 'cancelled') {
    const go = () => nav.push(r.kind === 'cancelled' ? 'pack/put-back' : 'pack/look', { id: r.o.id });
    return (
      <Tap on={go} class={cx('pk-row', !p.first && 'line')}>
        <FaceBadge face={r.face} badge={r.kind === 'theirs' ? r.badge : null} dim={r.kind === 'copy'} />
        <span class={cx('pk-row-t', r.kind === 'copy' && 'soft', r.kind === 'theirs' && 'gap')}><b>{r.name}</b><Sub r={r} /></span>
        {r.kind === 'copy' && <StatusPill tone="bad" icon="lock" style={{ height: '26px' }}>Don’t pack</StatusPill>}
        {r.kind === 'theirs' && <StatusPill tone="info" style={{ height: '26px' }}><Glyph name="eye" size={14} stroke={2.4} />{r.whose}</StatusPill>}
        {r.kind === 'cancelled' && <StatusPill tone="bad" style={{ height: '26px' }}>Cancelled · put it back</StatusPill>}
        <span class="pk-chev"><Icon name="chevron-right" size={14} stroke={2.4} /></span>
      </Tap>
    );
  }
  const act = r.kind === 'pack' ? 'Pack' : r.kind === 'mine' ? 'Carry on' : null;
  const label = r.kind === 'mine' ? `Carry on packing ${orderNo(r.o.id)}` : `Pack ${orderNo(r.o.id)}`;
  const body = (
    <>
      <FaceBadge face={r.face} badge={r.badge} />
      <span class="pk-row-t">
        <b>{r.name}</b>
        <Sub r={r} />
        {r.kind === 'mine' && (
          <span class="pk-row-m">
            <span aria-hidden="true" class="pk-mini">{r.marks.map((m, i) => <span key={i} style={{ background: MARK[m] }} />)}</span>
            <span class="pk-row-ms"><b class="mono">{r.done}</b>{' packed · '}<Icon name={r.pickup ? 'store' : 'truck'} size={12} stroke={2.2} />{r.to}</span>
          </span>
        )}
      </span>
    </>
  );
  return (
    <div class={cx('pk-row', !p.first && 'line')}>
      {act ? <Tap on={() => open(r.o)} class="pk-row-go">{body}</Tap> : <span class="pk-row-go">{body}</span>}
      {r.pill && <span class={cx('pk-pill', r.pillBad ? 'bad' : 'mono')}>{r.pill}</span>}
      {act && <Tap on={() => open(r.o)} label={label} class="pk-act"><span>{act}</span></Tap>}
    </div>
  );
}

function Rows(p: { rows: Row[]; lit?: boolean; foot?: JSX.Element | null }): JSX.Element {
  return (
    <div class={cx('pk-card pk-rows', p.lit && 'lit')}>
      {p.rows.map((r, i) => <PackRow key={r.o.id} r={r} first={i === 0} />)}
      {p.foot}
    </div>
  );
}

function Waiting(p: { s: Sheet }): JSX.Element {
  const s = p.s, b = s.buyer;
  const names = s.waiting.map((o) => `${orderNo(o.id)} ${firstWord(o.client.name)}`).join(' · ');
  return (
    <Tap on={() => open(s.waiting[0])} class="pk-card pk-row pk-wait">
      {b ? <Avatar {...b.face} size={32} /> : <span class="pk-face" />}
      <span class="pk-row-t"><b class="mono pk-wait-n">{names}</b>
        {b && <span class="pk-row-w"><Icon name="cart" size={12} stroke={2.2} />{`${b.name} is buying${b.due != null ? ` · back ~${clock(b.due)}` : ''}`}</span>}
      </span>
      <span class="pk-chev"><Icon name="chevron-right" size={14} stroke={2.4} /></span>
    </Tap>
  );
}

function Group(p: { id: Chip; s: Sheet; lit: number | null }): JSX.Element | null {
  const s = p.s, c = CHIPS.find((x) => x.id === p.id) as (typeof CHIPS)[number];
  const has = (rows: Row[]) => p.lit != null && rows.some((r) => r.o.id === p.lit);
  switch (p.id) {
    case 'for-you': {
      if (!s.forYou.length) return null;
      const r = s.forYou[0];
      const foot = r.seenBy ? <div class="pk-seen"><Icon name="lock" size={14} stroke={2.2} /><span>{r.seenBy}<b>{`${firstWord(books.value?.me.name || '')}’s`}</b> · look only</span></div> : null;
      return <><Section dot={c.dot} title="For you" count={s.forYou.length} meta={s.forYouMeta} /><Rows rows={s.forYou} foot={foot} lit={has(s.forYou)} /></>;
    }
    case 'to-pack':
      if (!s.toPack.length) return null;
      return <><Section dot={c.dot} title="To pack" count={s.chips['to-pack']} meta={s.chips['to-pack'] ? 'oldest first' : undefined} /><Rows rows={s.toPack} lit={has(s.toPack)} /></>;
    case 'packing':
      if (!s.packing.length) return null;
      return <><Section dot={c.dot} title="Packing now" count={s.packing.length} meta={s.packingMeta} /><Rows rows={s.packing} lit={has(s.packing)} /></>;
    case 'packed':
      if (!s.packed.length) return null;
      return <><Section dot={c.dot} title="Packed" count={s.chips.packed} meta={s.packedMeta} /><Rows rows={s.packed} lit={has(s.packed)} /></>;
    case 'waiting':
      if (!s.waiting.length) return null;
      return <><Section dot={c.dot} title="Waiting on goods" count={s.waiting.length} /><Waiting s={s} /></>;
    default: return null;
  }
}

export function ToPack(p: { first?: number | null }): JSX.Element {
  const b = books.value;
  if (!b) return <StageSheet id="pack" title="To pack" />;
  const s = sheetOf(b, me.value, now.value), saved = savedLine();
  const fy = s.forYou[0], gave = b.alerts.find((a) => a.kind === 'order.pick' && a.forYou && fy && Number(a.data.orderId) === fy.o.id);
  const lit = p.first ?? (moved.value ? moved.value.id : null);
  const chips = CHIPS.map((c) => (
    <button key={c.id} type="button" aria-pressed={s.picked === c.id} class={cx('pk-chip', s.picked === c.id && 'on')} onClick={() => { chipPicked.value = c.id; moved.value = null; }}>
      <span aria-hidden="true" style={{ background: c.dot }} />{c.word}<b class="mono">{s.chips[c.id]}</b>
    </button>
  ));
  return (
    <StageSheet id="pack" title="To pack" count={s.title} sub={saved ? <span class="pk-amber">{saved}</span> : s.sub} chips={chips}>
      <div class="pk-body">
        <TopNotice />
        {fy && gave && s.picked === 'for-you' && (
          <PushCard face={fy.badge || fy.face} title={gave.text} sub={`${clock(gave.at)} · ${fy.pickup ? 'they collect' : fy.to} · ${fy.o.lines.length} lines`} on={() => { chipPicked.value = 'for-you'; }} label={gave.text} />
        )}
        {s.empty ? <ToPackEmpty s={s} /> : s.order.map((id) => <Group key={id} id={id} s={s} lit={lit} />)}
      </div>
    </StageSheet>
  );
}
