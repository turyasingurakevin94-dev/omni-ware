/*
 * Stuck (route `orders/stuck`, Orders p3): the stage columns with the stuck order's stage lit; each
 * stuck order (oldest first) with its clock against the limit (placed · the limit · how far over), its
 * line, who holds it and Nudge {Denis} (the push "{Ruth} nudged you" and its words, shown before it
 * goes), and Give it to {Moses}; who is told under it. Answered in place: Nudging, the strip with
 * Undo, Not sent · Try again, Waits.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { clockOf, columns, giveTo, holderOf } from '../../../core/manager/orders.ts';
import type { ManagerBooks, MOrder } from '../../../core/manager/types.ts';
import { stuck as stuckOf } from '../../../core/manager/watch.ts';
import { ANSWER, hm, inStage, limitWord, ROLE, STAGE } from '../../../core/manager/words.ts';
import { money } from '../../../core/money.ts';
import { firstWord, orderNo } from '../../../core/names.ts';
import { IconTile } from '../../../ui/ActRow.tsx';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { PageHead } from '../../../ui/PageHead.tsx';
import { nav } from '../shell/nav.ts';
import { books, now, undoHeld, waiting } from '../shell/store.ts';
import { Clock, Empty, StageCols, tintBg, Told } from './Bits.tsx';
import { nudgeWords, whatItIs } from './OrderCard.tsx';
import { useInPlace } from './useAnswer.ts';
import './orders.css';

function Spin(): JSX.Element {
  return <svg width="16" height="16" viewBox="0 0 24 24" class="mg-orders-spin" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="2.6" /><path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5" fill="none" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round" /></svg>;
}

function StuckCard(p: { o: MOrder; b: ManagerBooks; t: number }): JSX.Element {
  const { o, b, t } = p;
  const spot = useInPlace(true);
  const [act, setAct] = useState('');
  const seller = b.team.find((x) => x.id === o.sellerId) || null;
  const holder = holderOf(b, o), to = giveTo(b, o);
  const c = clockOf(o, b.shop, t, true);
  const l = o.lines[0];
  const me = firstWord(b.me.name);
  const busy = spot.st === 'held' || spot.st === 'sending';
  const nudge = () => { if (!holder || busy) return; setAct('nudge'); spot.go(`${ANSWER.nudged} ${firstWord(holder.name)} · ${hm(t)}`, 'nudge', [holder.id, o.id, nudgeWords(o, c.mins)]); };
  const give = () => { if (!to || busy) return; setAct('give'); spot.go(`Given to ${firstWord(to.name)} · ${orderNo(o.id)}`, 'giveTo', [o.id, to.id]); };
  const actWord = act === 'give' && to ? `Give it to ${firstWord(to.name)}` : holder ? `Nudge ${firstWord(holder.name)}` : '';
  return (
    <>
      <div class="mg-orders-stuck">
        <div class="h">
          {seller && <Avatar initials={seller.initials} tint={seller.tint} size={36} font={13} />}
          <div class="mid">
            <div class="nm"><span class="no mono">{orderNo(o.id)}</span><span class="cu">{o.customerName}</span></div>
            <span class="mono s">{`${seller ? `From ${firstWord(seller.name)} · ` : ''}${o.lines.length} ${o.lines.length === 1 ? 'line' : 'lines'}`}</span>
          </div>
          <span class="mono tot">{money(o.total)}</span>
        </div>
        <div class="clockbox">
          <div class="r"><span class="mono big">{inStage(c.mins)}</span><span class="mono s">{`in ${STAGE[o.stage]} · limit ${limitWord(c.limit)}`}</span></div>
          <Clock fill={c.fillPct} tick={c.tickPct} over h={8} text="" />
          <div class="r3 mono"><span>{`${hm(o.stageAt)} placed`}</span><b>{`${hm(o.stageAt + c.limit * 60000)} limit`}</b><b>{`${inStage(c.over)} over`}</b></div>
        </div>
        {l && (
          <div class="ln">
            <IconTile tone="warn" icon="clock" size={38} iconSize={18} />
            <div class="mid"><span class="t">{o.lines.length === 1 ? `${l.name} · ${l.qty} ${l.unit}` : whatItIs(o)}</span><span class="mono s">{`${whatItIs(o).split(' · ').slice(1).join(' · ') || l.supplierName} · ${hm(o.stageAt)}`}</span></div>
          </div>
        )}
        <i class="hr" />
        {holder && (
          <div class="ln">
            <Avatar initials={holder.initials} tint={holder.tint} size={36} font={13} />
            <div class="mid"><span class="t">{`${firstWord(holder.name)} holds it`}</span><span class="mono s">{holder.holds || ROLE[holder.role]}</span></div>
            {spot.st === 'kept' ? <span class="mg-orders-waits"><Icon name="clock" size={16} stroke={2} />Waits</span>
              : holder.id !== b.me.id && (
                <button type="button" class="mg-orders-btn navy h44" aria-disabled={busy ? 'true' : undefined} onClick={nudge}>
                  {spot.st === 'sending' && act === 'nudge' ? <><Spin />Nudging</> : <><Icon name="send" size={16} stroke={2} />{`Nudge ${firstWord(holder.name)}`}</>}
                </button>
              )}
          </div>
        )}
        {(spot.st === 'held' || spot.st === 'done') ? (
          <div class="mg-orders-strip" role="status">
            <Icon name="check" size={18} stroke={2.4} />
            <span>{spot.label}</span>
            {spot.st === 'held' && <button type="button" onClick={() => undoHeld()}><Icon name="undo" size={16} stroke={2.2} />Undo</button>}
          </div>
        ) : spot.st === 'error' ? (
          <div class="mg-orders-err" role="alert">
            <span class="ic"><Icon name="warning" size={18} stroke={2} /></span>
            <span class="t"><b>Not sent</b><span class="mono">{`${actWord} · ${orderNo(o.id)}`}</span></span>
            <button type="button" class="mg-orders-btn navy" onClick={spot.retry}><Icon name="retry" size={16} stroke={2.2} />Try again</button>
          </div>
        ) : holder && holder.id !== b.me.id && (
          <div class="mg-orders-preview">
            <Icon name="bell" size={14} stroke={2} />
            <span>{`${firstWord(holder.name)} sees: `}<b>{`${me} nudged you`}</b>{` · ${nudgeWords(o, c.mins)}`}</span>
          </div>
        )}
        {to && (
          <button type="button" class="mg-orders-give" aria-disabled={busy ? 'true' : undefined} onClick={give}>
            <Avatar initials={to.initials} tint={to.tint} size={32} />
            <span class="mid"><b>{`Give it to ${firstWord(to.name)}`}</b><span class="mono s">{ROLE[to.role]}</span></span>
            {spot.st === 'sending' && act === 'give' ? <span class="mg-orders-spin-dark" aria-hidden="true" /> : <Icon name="chevron-right" size={18} stroke={2.2} />}
          </button>
        )}
      </div>
      {seller && to && <Told card face={seller} who={`${firstWord(seller.name)} sees`} word={`Given to ${firstWord(to.name)}`} />}
    </>
  );
}

export function Stuck(): JSX.Element | null {
  const b = books.value;
  if (!b) return null;
  const t = now.value, list = stuckOf(b, t);
  const seller = (o: MOrder) => tintBg(b.team.find((x) => x.id === o.sellerId));
  return (
    <main class="mg-orders">
      <PageHead title="Stuck" count={list.length} onBack={() => nav.back()}>
        <StageCols cols={columns(b, waiting.value)} tint={seller} lit={list.map((x) => x.o.stage)}
          on={(s) => (s === 'completed' ? nav.push('orders/bill', {}) : nav.replace('orders', {}))} />
      </PageHead>
      <div class="mg-orders-body">
        {!list.length && <Empty />}
        {list.map((x) => <StuckCard key={x.o.id} o={x.o} b={b} t={t} />)}
      </div>
    </main>
  );
}
