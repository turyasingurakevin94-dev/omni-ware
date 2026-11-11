/*
 * 'orders/order' (id) · One order (docs/canvas/buyer/Orders.dc.html phone 2):
 * a full sheet with the client, where it came from in Sales, its total and
 * how many lines are found; then each line with its supplier and state word;
 * the Ruth fold under a line whose new price is over the selling price (the
 * Manager decides, nothing for the Buyer to do); and what the salesperson
 * sees. A Not found or No supplier line opens the Not found sheet. A held order (a cancel asked,
 * cross-app round 1 BUY-1) shows its hold card first and its lines with no act.
 */
import type { JSX } from 'preact';
import { firstWord, initials, orderNo } from '../../../core/names.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { FullSheet, TitleHead } from '../../../ui/FullSheet.tsx';
import { Icon, type IconName } from '../../../ui/icons.tsx';
import { fig } from '../../../ui/Money.tsx';
import { Notice } from '../../../ui/Notice.tsx';
import { barW } from '../../../ui/util.tsx';
import type { LineState } from '../../../core/buyer/types.ts';
import { priceTagWord, WORD } from '../../../core/buyer/rules.ts';
import type { Params } from '../shell/nav.ts';
import { nav } from '../shell/nav.ts';
import { books, flush, kept, now, online } from '../shell/store.ts';
import { HoldCard, HoldPill } from './Held.tsx';
import { openNotFound } from './NotFound.tsx';
import { FromChip, Initials, StateWord, Strip } from './parts.tsx';
import { byRole, INK, orderView, PILL, seesWords, type LineView } from './rules.ts';

const TILE: Partial<Record<LineState, IconName>> = {
  found: 'check', in: 'check', notfound: 'close', nosupplier: 'warning', priceup: 'warning', asked: 'clock', toask: 'send',
  clientwaits: 'hourglass', removed: 'trash', ontrip: 'truck', short: 'warning',
};

function LineRow(p: { x: LineView; onNotFound: () => void; held: boolean; tag: string | null }): JSX.Element {
  const { x } = p, l = x.line, [bg, ink] = p.held ? PILL.toask : PILL[x.state];
  const body = (
    <>
      <span aria-hidden="true" class="tile" style={{ background: bg, color: ink }}><Icon name={p.held ? 'pause' : TILE[x.state] || 'clock'} size={20} stroke={2.2} /></span>
      <span class="t">
        <span class="n">{l.name}</span>
        <span class="mono q">{`${l.qty} ${l.unit} × ${fig(l.cost)}`}<br />{`= ${fig(x.total)}`}</span>
        {x.supplier && <span class="s">{x.supplier.name}</span>}
        {p.tag && <span class="ow-b-orders-tag"><Icon name="bell" size={13} stroke={2.2} />{p.tag}</span>}
      </span>
      {p.held ? <HoldPill short /> : <StateWord state={x.state} at={x.state === 'removed' ? null : x.at} />}
    </>
  );
  return !p.held && (x.state === 'notfound' || x.state === 'nosupplier')
    ? <button type="button" class="ow-b-orders-line tap" aria-label={`${l.name}: ${WORD[x.state].toLowerCase()}. Choose what to do`} onClick={p.onNotFound}>{body}</button>
    : <div class={'ow-b-orders-line' + (x.state === 'removed' ? ' off' : p.held ? ' hold' : '')}>{body}</div>;
}

/** Ruth decides: the new cost over the selling price, as a picture (was · sells · cost). */
function RuthFold(p: { x: LineView; who: { name: string; initials: string } }): JSX.Element {
  const l = p.x.line, was = l.priceWas ?? l.cost;
  const scale = Math.max(was, l.sell, l.cost) / 0.9;
  const pct = (v: number) => (v / scale) * 100;
  return (
    <div class="ow-b-orders-ruthfold">
      <div class="h">
        <span aria-hidden="true" class="av">{p.who.initials}</span>
        <span class="t"><span>{`${firstWord(p.who.name)} decides`}</span><span>{l.name}</span></span>
        <span class="bell" title={`${firstWord(p.who.name)} sees it`} aria-label={`${firstWord(p.who.name)} sees it`}><Icon name="bell" size={16} stroke={2} /></span>
      </div>
      <div class="pic" role="img" aria-label={`Cost ${fig(l.cost)} is above the selling price ${fig(l.sell)}`}>
        <div class="bar">
          <span class="was" style={{ width: barW(pct(was)) }} />
          <span class="cost" style={{ width: barW(pct(l.cost)) }} />
          <span class="sell" style={{ left: barW(pct(l.sell)) }} />
        </div>
        <div class="k">
          <span>was <span class="mono">{fig(was)}</span></span>
          <span>sells <span class="mono">{fig(l.sell)}</span></span>
          <span class="bad">cost <span class="mono">{fig(l.cost)}</span></span>
        </div>
      </div>
    </div>
  );
}

export function OrderScreen({ params }: { params: Params }): JSX.Element {
  const b = books.value, id = Number(params.id);
  const o = b ? b.orders.find((x) => x.id === id) : null;
  if (!b || !o) {
    return (
      <FullSheet onBack={() => nav.back()} backLabel="Back" head={<TitleHead small title={b ? 'Not found' : '…'} onClose={() => nav.back()} />}>
        <span class="ow-b-orders-gone">{b ? `${orderNo(id)} is not in Checking any more` : ''}</span>
      </FullSheet>
    );
  }
  const v = orderView(o, b, now.value);
  const ruth = byRole(b, 'manager');
  const seller = v.seller ? firstWord(v.seller.name) : 'Sales';
  const rn = ruth ? firstWord(ruth.name) : 'Ruth', held = !!o.hold;
  const sees = held ? [{ word: 'Cancel asked', state: 'priceup' as const }] : seesWords(v, rn);
  const off = !online.value || kept.value.length > 0;
  const head = (
    <TitleHead small class="ow-b-orders-ohead" lead={<Initials name={o.client} ini={initials(o.client)} size={44} />}
      title={o.client} sub={<FromChip who={v.seller} no={o.id} navy />} onClose={() => nav.back()}>
      <div class="fig">
        <span><span class="mono big">{fig(v.total)}</span><span class="mono ugx">UGX</span></span>
        <span class="found"><span class="mono g">{v.found}</span> of <span class="mono">{v.live.length}</span> Found</span>
      </div>
      <Strip navy gap={4} states={v.live.map((x) => x.state)} />
    </TitleHead>
  );
  return (
    <FullSheet onBack={() => nav.back()} backLabel="Back to Checking" head={head} pad="14px 16px 24px" gap={8}>
      {off && <Notice kind="offline" action={kept.value.length ? { label: 'Try again', on: () => { void flush(); } } : undefined}>Offline · it sends when back</Notice>}
      <HoldCard b={b} o={o} />
      <div class="ow-b-orders-lh"><span>Lines</span><span class="mono">{v.live.length}</span></div>
      {v.lines.map((x) => (
        <div key={x.line.key} class="ow-b-orders-lwrap">
          <LineRow x={x} held={held} tag={x.line.priceTag && x.state !== 'removed' ? priceTagWord(x.line.priceTag, rn) : null} onNotFound={() => openNotFound(o.id, x.line.key)} />
          {!held && x.state === 'priceup' && ruth && <RuthFold x={x} who={ruth} />}
        </div>
      ))}
      <div class="ow-b-orders-seecard">
        {v.seller && <Avatar initials={v.seller.initials} tint={v.seller.tint} size={32} />}
        <span class="t">
          <span class="n">{`${seller} sees`}</span>
          <span class="w">
            {sees.map((s, i) => (
              <span key={s.word}>{i > 0 && <span class="dot">·</span>}<span style={{ color: INK[s.state] }}>{s.word}</span></span>
            ))}
          </span>
        </span>
      </div>
    </FullSheet>
  );
}

