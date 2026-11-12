/*
 * Orders · Stock (route `orders/stock`, Added p4 AD05; D-23): Denis's restock list. Nobody asks:
 * the Manager looks and may hold a line. The navy hero holds this trip's money (Go ahead · Not
 * yet as a split bar); Planned lines, shortest first, each with its weeks left and Not yet on the
 * row; the lines held, each with Go ahead. A tap waits 10 s with Undo (the toast), then Denis is
 * told; with no signal the row says Waits.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { money } from '../../../core/money.ts';
import { restockPlan, restockValue, weeksTone, WEEKS_OF } from '../../../core/manager/decide-stock.ts';
import type { RestockLine } from '../../../core/manager/types.ts';
import { ANSWER, hm } from '../../../core/manager/words.ts';
import { firstWord } from '../../../core/names.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { SplitBar } from '../../../ui/Bar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { ItemArt } from '../../../ui/ItemArt.tsx';
import { SectionHead } from '../../../ui/SectionHead.tsx';
import { nav } from '../shell/nav.ts';
import { answer, books, kept, now, online } from '../shell/store.ts';
import './stock.css';

/** A tap made here and not yet in the books: the line drawn as answered (Undo puts it back). */
type Mine = Record<string, { hold: boolean; at: number }>;

function Weeks(p: { n: number | null }): JSX.Element | null {
  if (p.n == null) return null;
  return (
    <span class={'mg-stk-weeks ' + weeksTone(p.n)} role="img" aria-label={`${p.n} weeks left on the shelf`}>
      {Array.from({ length: WEEKS_OF }, (_, i) => <i key={i} class={i < p.n! ? 'on' : ''} />)}
    </span>
  );
}

function Row(p: { r: RestockLine; held: boolean; at: number | null; me: string; waits: boolean; buyer: string; on: () => void }): JSX.Element {
  const r = p.r;
  const sub = [money(restockValue(r)), r.weeksLeft != null ? `${r.weeksLeft} weeks left` : ''].filter(Boolean).join(' · ');
  return (
    <div class="mg-stk-row">
      <ItemArt name={r.name} size={40} />
      <span class="mg-stk-t">
        <b>{r.name} · <span class="mono">{`${r.qty} ${r.unit}`}</span></b>
        <span class="mono s">{sub}</span>
        {p.held
          ? <span class="mg-stk-tag"><span class="mg-stk-pill warn">{p.at != null ? `${ANSWER.notYet} · ${p.me}` : ANSWER.notYet}</span>{p.at != null && <span class="mono">{hm(p.at)}</span>}</span>
          : <Weeks n={r.weeksLeft} />}
      </span>
      {p.waits ? <span class="mg-stk-waits"><Icon name="clock" size={14} stroke={2} />Waits</span>
        : p.at != null ? null
          : p.held
            ? <button type="button" class="mg-stk-go" aria-label={`${ANSWER.goAhead}: let ${p.buyer} buy ${r.name}`} onClick={p.on}>{ANSWER.goAhead}</button>
            : <button type="button" class="mg-stk-hold" aria-label={`${ANSWER.notYet}: hold the ${r.name} restock, ${p.buyer} is told`} onClick={p.on}>{ANSWER.notYet}</button>}
    </div>
  );
}

export function Stock(): JSX.Element | null {
  const b = books.value;
  const [mine, setMine] = useState<Mine>({});
  if (!b) return null;
  const buyer = b.team.find((x) => x.role === 'buyer') || null;
  const bn = buyer ? firstWord(buyer.name) : 'the Buyer', me = firstWord(b.me.name);
  const lines = b.restock.map((r) => (mine[r.id] ? { ...r, held: mine[r.id].hold } : r));
  const plan = restockPlan(lines);
  const waits = (id: string) => kept.value.some((k) => k.kind === 'restock' && k.state !== 'refused' && Array.isArray(k.args) && k.args[0] === id);

  const tap = (r: RestockLine, hold: boolean) => {
    const word = hold ? ANSWER.notYet : ANSWER.goAhead;
    setMine((m) => ({ ...m, [r.id]: { hold, at: now.value } }));
    const drop = () => setMine((m) => { const n = { ...m }; delete n[r.id]; return n; });
    answer(null, `${word} · ${r.name}`, 'restock', [r.id, hold], { undo: drop, then: (res) => { if (res && !res.kept) drop(); } });
  };
  const row = (r: RestockLine) => (
    <Row key={r.id} r={r} held={r.held} at={mine[r.id] && r.held ? mine[r.id].at : null} me={me} buyer={bn}
      waits={!online.value && !!mine[r.id] || waits(r.id)} on={() => tap(r, !r.held)} />
  );

  return (
    <main class="mg-stk">
      <header class="mg-stk-hero">
        <div class="mg-stk-top">
          <button type="button" class="mg-stk-back" aria-label="Back to Orders" onClick={() => nav.back()}><Icon name="back" size={18} stroke={2.2} /></button>
          <span class="mg-stk-who"><b>{`${bn}'s restock list`}</b>
            {buyer && <span><Avatar initials={buyer.initials} tint={buyer.tint === 'me' ? 'n' : buyer.tint} size={18} />{bn}</span>}</span>
        </div>
        <span class="mg-stk-k">{`THIS TRIP · ${lines.length} ${lines.length === 1 ? 'LINE' : 'LINES'}`}</span>
        <span class="mg-stk-big"><b class="mono">{money(plan.total)}</b><span class="mono">UGX</span></span>
        <SplitBar h={6} label={`Go ahead ${money(plan.ahead)}, Not yet ${money(plan.notYet)}`}
          parts={plan.total ? [{ value: plan.ahead, color: '#FFFFFF' }, { value: plan.notYet, color: '#F5B26B' }] : [{ value: 1, color: 'rgba(255,255,255,.18)' }]} />
        <span class="mg-stk-legend">
          <span><i />{ANSWER.goAhead} <b class="mono">{money(plan.ahead)}</b></span>
          <span><i class="a" />{ANSWER.notYet} <b class="mono">{money(plan.notYet)}</b></span>
        </span>
      </header>
      <div class="mg-stk-body">
        <SectionHead title="Planned" meta={plan.planned.length > 1 ? `${plan.planned.length} · shortest first` : String(plan.planned.length)} />
        {plan.planned.length ? <div class="mg-stk-card">{plan.planned.map(row)}</div>
          : <div class="mg-stk-empty"><Icon name="check" size={18} stroke={2.4} />Nothing planned</div>}
        {plan.held.length > 0 && <>
          <SectionHead title={ANSWER.notYet} meta={String(plan.held.length)} after />
          <div class="mg-stk-card">{plan.held.map(row)}</div>
        </>}
        <span class="mg-stk-sees"><Icon name="bell" size={14} stroke={2} />{`${bn} sees`}<span class="mg-stk-pill warn">{ANSWER.notYet}</span>or<span class="mg-stk-pill good">{ANSWER.goAhead}</span></span>
      </div>
    </main>
  );
}
