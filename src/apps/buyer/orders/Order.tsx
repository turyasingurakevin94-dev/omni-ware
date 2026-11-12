/*
 * 'orders/order' (id) · One order (docs/canvas/buyer/Orders.dc.html phone 2;
 * Buyer round 1 boards R1CostPrice and R1WhoSees): a full sheet with the
 * client, where it came from in Sales, what the client pays and what it costs
 * us (BUY-02: two figures, labelled; the Buyer never changes Client pays);
 * then each line with its supplier, its state word and what the salesperson
 * sees of it ("{Seller} sees: {word}", BUY-04); the Ruth fold under a line
 * whose new cost is over the selling price, the Price coming fold under a line
 * with no selling price (BUY-08); an order on hold says so first (BUY-05). A
 * Not found line opens the Not found sheet.
 */
import type { JSX } from 'preact';
import { firstWord, initials, orderNo } from '../../../core/names.ts';
import type { Member } from '../../../core/types.ts';
import { FullSheet, TitleHead } from '../../../ui/FullSheet.tsx';
import { Icon, type IconName } from '../../../ui/icons.tsx';
import { fig } from '../../../ui/Money.tsx';
import { Notice } from '../../../ui/Notice.tsx';
import { barW } from '../../../ui/util.tsx';
import type { LineState } from '../../../core/buyer/types.ts';
import { seesWord } from '../replies/rules.ts';
import type { Params } from '../shell/nav.ts';
import { nav } from '../shell/nav.ts';
import { books, flush, kept, now, online } from '../shell/store.ts';
import { openNotFound } from './NotFound.tsx';
import { FromChip, Initials, Pause, Sees, SeesCard, StateWord, Strip } from './parts.tsx';
import { byRole, HOLD_INK, holdOf, INK, lineSees, orderView, PILL, priceComing, type LineView } from './rules.ts';

const TILE: Partial<Record<LineState, IconName>> = {
  found: 'check', in: 'check', notfound: 'close', priceup: 'warning', asked: 'clock', toask: 'send', nosupplier: 'search',
  clientwaits: 'hourglass', removed: 'trash', ontrip: 'truck', short: 'warning',
};

/** "2 prices coming". */
const comingWord = (n: number): string => `${n} ${n === 1 ? 'price' : 'prices'} coming`;

function LineRow(p: { x: LineView; onNotFound: () => void }): JSX.Element {
  const { x } = p, l = x.line, [bg, ink] = PILL[x.state];
  // BUY-13: the old cost is a grey "was" word, never struck.
  const was = l.priceWas != null && l.priceWas !== l.cost ? ` · was ${fig(l.priceWas)}` : '';
  const body = (
    <>
      <span aria-hidden="true" class="tile" style={{ background: bg, color: ink }}><Icon name={TILE[x.state] || 'clock'} size={20} stroke={2.2} /></span>
      <span class="t">
        <span class="n">{l.name}</span>
        <span class="mono q">{`${l.qty} ${l.unit} × ${fig(l.cost)}${was}`}<br />{`= ${fig(x.total)}`}</span>
        {x.supplier && <span class="s">{x.supplier.name}</span>}
      </span>
      <StateWord state={x.state} at={x.state === 'removed' ? null : x.at} />
    </>
  );
  return x.state === 'notfound' || x.state === 'nosupplier'
    ? <button type="button" class="ow-b-orders-line tap" aria-label={`${l.name}: ${x.state === 'notfound' ? 'not found' : 'needs a supplier'}. Choose what to do`} onClick={p.onNotFound}>{body}</button>
    : <div class="ow-b-orders-line">{body}</div>;
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

/** Price coming · Ruth prices it (BUY-08): the line has no selling price; the Manager prices it, nothing for the Buyer. */
function ComingFold(p: { who: Member | null }): JSX.Element {
  const name = p.who ? firstWord(p.who.name) : 'The Manager';
  return (
    <div class="ow-b-orders-coming">
      {p.who && <span aria-hidden="true" class="av">{p.who.initials}</span>}
      <span>{`Price coming · ${name} prices it`}</span>
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
  const ruth = byRole(b, 'manager'), ruthName = ruth ? firstWord(ruth.name) : 'the Manager';
  const seller = v.seller ? firstWord(v.seller.name) : 'Sales';
  const hold = holdOf(o);
  const sees = seesWord(b, o);
  const off = !online.value || kept.value.length > 0;
  const head = (
    <TitleHead small class="ow-b-orders-ohead" lead={<Initials name={o.client} ini={initials(o.client)} size={44} />}
      title={o.client} sub={<FromChip who={v.seller} no={o.id} navy />} onClose={() => nav.back()}>
      <div class="fig">
        <span class="pays">
          <span class="cap">Client pays</span>
          {v.pays > 0 || !v.coming ? <span><span class="mono big">{fig(v.pays)}</span><span class="mono ugx">UGX</span></span> : null}
          {v.coming > 0 && <span class="coming">{v.pays > 0 ? `+ ${comingWord(v.coming)}` : comingWord(v.coming)}</span>}
        </span>
        <span class="cost"><span class="cap">Cost</span><span class="mono">{fig(v.cost)}</span></span>
      </div>
      <Strip navy gap={4} states={v.live.map((x) => x.state)} />
    </TitleHead>
  );
  return (
    <FullSheet onBack={() => nav.back()} backLabel="Back to Checking" head={head} pad="14px 16px 24px" gap={8}>
      {off && <Notice kind="offline" action={kept.value.length ? { label: 'Try again', on: () => { void flush(); } } : undefined}>Offline · it sends when back</Notice>}
      <div class="ow-b-orders-lh"><span>Lines</span><span class="mono">{v.live.length}</span></div>
      {hold && (
        <div class="ow-b-orders-holdbar" role="status">
          {ruth && <span aria-hidden="true" class="av">{ruth.initials}</span>}
          <span class="t">{`${hold.word} · ${hold.why} · ${ruthName} decides`}</span>
          <span aria-hidden="true" class="ic"><Pause size={16} /></span>
        </div>
      )}
      {v.lines.map((x) => (
        <div key={x.line.key} class={'ow-b-orders-lwrap' + (x.state === 'removed' ? ' off' : '')}>
          <LineRow x={x} onNotFound={() => openNotFound(o.id, x.line.key)} />
          {x.state === 'priceup' && ruth && <RuthFold x={x} who={ruth} />}
          {x.state !== 'removed' && priceComing(x.line) && <ComingFold who={ruth} />}
          <div class="ow-b-orders-lfoot">
            <Sees who={seller} ink={hold ? HOLD_INK : INK[x.state]}>{lineSees(o, x.state)}</Sees>
          </div>
        </div>
      ))}
      <SeesCard who={v.seller} word={sees.word} />
    </FullSheet>
  );
}
