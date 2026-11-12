/*
 * 'orders/switch' (id, key) · Switch item (docs/canvas/buyer/Orders.dc.html
 * phone 4): another item in the place of one not found. The line not found
 * in red, the Agent's search row (field, mic), why, then the price
 * list: the same item from another supplier first, each with its price
 * against what it cost and a bar against what the salesperson sells it at;
 * over the selling price, Ruth decides. + switches: act('switchItem').
 * Nothing on the list (board Additions B): the search, Ask Moses to find it, Clear search; no footer.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { firstWord } from '../../../core/names.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Button } from '../../../ui/Button.tsx';
import { FullSheet } from '../../../ui/FullSheet.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { hasSpeech, ListenSheet } from '../../../ui/Listen.tsx';
import { fig } from '../../../ui/Money.tsx';
import { Notice } from '../../../ui/Notice.tsx';
import { Search } from '../../../ui/Search.tsx';
import { sheet } from '../../../ui/sheet.tsx';
import { toast } from '../../../ui/toast.tsx';
import { barW, cx } from '../../../ui/util.tsx';
import type { Params } from '../shell/nav.ts';
import { nav } from '../shell/nav.ts';
import { act, books, kept, online } from '../shell/store.ts';
import { openNotFound } from './NotFound.tsx';
import { FromChip, KEPT, KEPT_TOAST } from './parts.tsx';
import { byRole, firstQuery, priceComing, switchOptions, type SwitchRow } from './rules.ts';
import './sheets.css';

/** Why the item changes (the Sales message says it). */
const WHY = ['That one is out', 'Client wants it', 'Wrong one taken'] as const;

/** The sells mark sits at 56% of the bar; a price is drawn against it. */
const SELLS_AT = 0.56;

function Option(p: { r: SwitchRow; sell: number; qty: number; best: boolean; ruth: string; busy: boolean; disabled: boolean; on: () => void }): JSX.Element {
  const { r } = p, tone = r.ruth ? '#8E2A22' : r.diff > 0 ? '#7A4A02' : '#0F6B43';
  // Price coming (sell 0): the bar is drawn against the price itself, never divided by 0 (BUY-08).
  const scale = (p.sell > 0 ? p.sell : r.price.price || 1) / SELLS_AT;
  return (
    <div class={cx('ow-b-orders-opt', p.best && 'best')}>
      <div class="r">
        <span class="t">
          <span class="n"><span>{r.price.item}</span>
            {r.same && <span class="tag same">same</span>}
            {r.ruth && <span class="tag ruth"><Icon name="lock" size={11} stroke={2.4} />{`${p.ruth} decides`}</span>}
          </span>
          <span class="s">{r.supplier.name}</span>
        </span>
        <span class="p"><span class="mono">{fig(r.price.price)}</span><span class="mono d" style={{ color: tone }}>{r.diff ? fig(r.diff, false, true) : '±0'}</span></span>
        <button type="button" class="plus" aria-label={`Switch to ${r.price.item}, ${r.supplier.name}, ${fig(r.price.price)}`} aria-busy={p.busy || undefined}
          disabled={p.busy || p.disabled} onClick={p.on}>
          {p.busy ? <span aria-hidden="true" class="ow-b-orders-spin" /> : <Icon name="plus" size={22} stroke={2.4} />}
        </button>
      </div>
      <div class="pic" aria-hidden="true">
        <span class="bar"><span style={{ width: barW((r.price.price / scale) * 100), background: tone }} /><i style={{ left: `${SELLS_AT * 100}%` }} /></span>
        <span class="mono m">{`${p.qty} × ${fig(r.price.price)} = ${fig(r.total)}`}</span>
      </div>
    </div>
  );
}

export function SwitchScreen({ params }: { params: Params }): JSX.Element {
  const b = books.value, id = Number(params.id), key = String(params.key || '');
  const o = b ? b.orders.find((x) => x.id === id) : null;
  const l = o ? o.lines.find((x) => x.key === key) : null;
  const [q, setQ] = useState(l ? firstQuery(l.name) : '');
  const [why, setWhy] = useState<string>(WHY[0]);
  const [busy, setBusy] = useState<string | null>(null);
  const back = () => { nav.back(); if (o && l) window.setTimeout(() => openNotFound(o.id, l.key), 0); };
  if (!b || !o || !l) {
    return <FullSheet onBack={() => nav.back()} backLabel="Back" head={<div />}><span class="ow-b-orders-gone">This line is not here any more</span></FullSheet>;
  }
  const seller = b.team.find((m) => m.id === o.sellerId) || null;
  const sName = seller ? firstWord(seller.name) : 'Sales';
  const ruth = byRole(b, 'manager');
  const rows = switchOptions(b, l, q);
  const off = !online.value || kept.value.length > 0;
  const none = rows.length === 0, words = q.trim(), moses = byRole(b, 'sourcing'), finder = moses ? firstWord(moses.name) : 'Sourcing';

  const pick = async (r: SwitchRow) => {
    const k = `${r.price.supplierId}|${r.price.item}`;
    setBusy(k);
    try {
      const res = await act('switchItem', o.id, l.key, { name: r.price.item, productId: r.price.productId, supplierId: r.price.supplierId, cost: r.price.price, why });
      toast.show(res.kept ? KEPT : `Switched · ${r.price.item}`, res.kept ? KEPT_TOAST : { kind: 'ok' });
      nav.back();
    } catch (e) {
      toast.show('Not saved', { kind: 'error', sub: `Switch to ${r.price.item} · ${fig(r.price.price)}`, retry: () => { void pick(r); } });
    } finally { setBusy(null); }
  };
  const askMoses = async () => {
    setBusy('sourcing');
    try {
      const res = await act('askSourcing', words);
      toast.show(res.kept ? KEPT : `${finder} is told`, res.kept ? KEPT_TOAST : { kind: 'ok', sub: `${words} · Asked` });
    } catch (e) {
      toast.show('Not sent', { kind: 'error', sub: `Ask ${finder} to find ${words}`, retry: () => { void askMoses(); } });
    } finally { setBusy(null); }
  };
  const listen = () => sheet.open(() => <ListenSheet act="Find" onDone={(w) => { sheet.close(); setQ(w); }} />, { label: 'Say it' });

  const head = (
    <div class="ow-b-orders-swh">
      <span class="ow-grab" aria-hidden="true" />
      <div class="r1">
        <button type="button" class="back" aria-label="Back to Not found" onClick={back}><Icon name="back" size={20} stroke={2.2} /></button>
        <h1>Switch item</h1>
        <FromChip who={seller} no={o.id} />
      </div>
      {none ? null : <div class="was">
        <Icon name="close" size={18} stroke={2.4} />
        <span class="n">{l.name}</span>
        <span class="mono">{`${l.qty} ${l.unit} × ${fig(l.cost)}`}</span>
      </div>}
      <div class="find">
        <Search placeholder="Find an item" label="Find an item to switch to" value={q} onInput={setQ} autoFocus onMic={hasSpeech() ? listen : undefined} />
        {/* The board's aisles button (phone 4) is left out: where it goes is not drawn yet, and a button that does nothing is not shown. */}
      </div>
      {!none && (
        <div class="why" role="group" aria-label="Why">
          {WHY.map((w) => <button key={w} type="button" aria-pressed={why === w} class={cx(why === w && 'on')} onClick={() => setWhy(w)}>{w}</button>)}
        </div>
      )}
    </div>
  );
  const foot = (
    <div class="ow-b-orders-swf">
      <div class="in">
        {seller && <Avatar initials={seller.initials} tint={seller.tint} size={32} />}
        <span class="t">{`${sName} sees:`} <b>Switched</b></span>
        <span aria-hidden="true" class="bell"><Icon name="bell" size={16} stroke={2} /></span>
      </div>
    </div>
  );
  return (
    <FullSheet onBack={() => nav.back()} backLabel={null} head={head} foot={none ? undefined : foot} pad="4px 16px 16px" gap={8}>
      {off && <Notice kind="offline">Offline · it sends when back</Notice>}
      {!none && <div class="ow-b-orders-lh"><span>On the price list</span>
        {priceComing(l) ? <span class="sells">{`Price coming · ${ruth ? firstWord(ruth.name) : 'the Manager'} prices it`}</span> : <span class="sells">sells <span class="mono">{fig(l.sell)}</span></span>}</div>}
      {rows.map((r, i) => (
        <Option key={`${r.price.supplierId}|${r.price.item}`} r={r} sell={l.sell} qty={l.qty} best={i === 0} ruth={ruth ? firstWord(ruth.name) : 'Ruth'}
          busy={busy === `${r.price.supplierId}|${r.price.item}`} disabled={!!busy} on={() => { void pick(r); }} />
      ))}
      {none && (
        <>
          <div class="ow-b-orders-none">
            <span aria-hidden="true" class="tile"><Icon name="search" size={22} stroke={2} /></span>
            <b>Nothing on the list</b>
            <span class="mono">{`"${words}" · 0 of ${b.suppliers.length} suppliers`}</span>
          </div>
          {words && <Button icon="send" state={busy === 'sourcing' ? 'sending' : 'idle'} onClick={() => { void askMoses(); }}>{`Ask ${finder} to find it`}</Button>}
          <button type="button" class="ow-b-orders-clear" onClick={() => setQ('')}>Clear search</button>
        </>
      )}
    </FullSheet>
  );
}
