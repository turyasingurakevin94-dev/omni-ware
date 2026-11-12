/*
 * Change the limit (route `money/limit` { customer }, Added2 p1, AD03, D-25): the limit chips (the
 * step under the limit now, now, two above; Cash only) and the terms (7 · 14 · 30 d), each with
 * "now" under it; what they owe against the pick. Save goes at once (`setLimit`), the salesperson
 * is told; Undo 10 puts the old limit back. Nothing changed: "Nothing to save".
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { money, short } from '../../../core/money.ts';
import { firstWord } from '../../../core/names.ts';
import { termsFor } from '../../../core/manager/credit.ts';
import { limitBar, limitLadder, TERMS } from '../../../core/manager/money.ts';
import type { LimitPick } from '../../../core/manager/source.ts';
import { ANSWER } from '../../../core/manager/words.ts';
import type { Params } from '../../../ui/stack.ts';
import { toast } from '../../../ui/toast.tsx';
import { cx } from '../../../ui/util.tsx';
import { nav } from '../shell/nav.ts';
import { act, books, online, waiting } from '../shell/store.ts';
import type { LimitAsk } from '../../../core/manager/types.ts';
import { sellerOf } from './Money.tsx';
import { ErrStrip, MoneyDock, MoneySheet, Tile } from './parts.tsx';
import './sheets.css';

const pickWord = (l: LimitPick | null) => (l ? `Limit ${money(l.limit)} · ${l.days} days` : ANSWER.cashOnly);

function Chip(p: { on: boolean; now: boolean; wide?: boolean; mono?: boolean; label: string; aria?: string; go: () => void }): JSX.Element {
  return (
    <button type="button" class={cx('mg-mo-lchip', p.on && 'on', p.wide && 'wide', p.mono !== false && 'mono')} aria-pressed={p.on} aria-label={p.aria} onClick={p.go}>
      {p.label}{p.now && <span class="now">now</span>}
    </button>
  );
}

export function LimitSheet(p: { params: Params }): JSX.Element | null {
  const b = books.value;
  const c0 = b ? b.customers.find((x) => x.id === p.params.customer) : null;
  const [limit, setLimit] = useState<number | null>(c0 ? c0.limit : null);
  const [days, setDays] = useState<number>(c0 && c0.termsDays ? c0.termsDays : 14);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  if (!b || !c0) return null;
  const c = c0, seller = sellerOf(b, c);
  const now: LimitPick | null = c.limit ? { limit: c.limit, days: c.termsDays || termsFor(c.limit, null) } : null;
  const pick: LimitPick | null = limit ? { limit, days } : null;
  const same = (!now && !pick) || (!!now && !!pick && now.limit === pick.limit && now.days === pick.days);
  const bar = limitBar(c.owes, c.limit, limit);
  const save = async () => {
    setBusy(true);
    setError(false);
    try {
      // Esther's ask for this customer waits (D-32): the limit set answers it, so it never stays live.
      const ask = waiting.peek().find((a): a is LimitAsk => a.kind === 'limit' && a.customerId === c.id);
      const r = ask ? await act('limitAsk', ask.askId, !!pick, pick) : await act('setLimit', c.id, pick);
      nav.back();
      toast.show(pick ? `Limit set · ${money(pick.limit)}` : ANSWER.cashOnly, {
        sub: r.kept ? 'Waits for signal' : seller ? `${firstWord(seller.name)} sees it` : '',
        undo: () => { void act('setLimit', c.id, now).catch(() => undefined); },
      });
    } catch (_e) {
      setBusy(false);
      setError(true);
    }
  };
  return (
    <MoneySheet label={`Change the limit for ${c.name}`} top={206}
      head={<div class="mg-mo-sh"><Tile c={c} /><span class="mg-mo-sh-t"><b>{c.name}</b><span>{now ? `Limit now ${money(now.limit)} · ${now.days} days` : `Limit now · ${ANSWER.cashOnly}`}</span></span></div>}
      dock={error ? <MoneyDock strip={<ErrStrip word={pickWord(pick)} why={online.value ? 'Not saved' : 'Not saved · no signal'} retry={() => { void save(); }} />} />
        : <MoneyDock told={same || !seller ? [] : [seller]} word={same ? undefined : pickWord(pick)} mint
        tap={{ label: `Save · ${pickWord(pick)}`, icon: 'check', on: () => { void save(); }, busy, disabled: same ? 'Nothing to save' : undefined,
          label2: `Save: ${pickWord(pick)} for ${c.name}.${seller ? ` ${firstWord(seller.name)} sees it` : ''}` }} />}>
      <h2 class="mg-mo-h">Limit</h2>
      <div class="mg-mo-lchips">
        {limitLadder(c.limit, c.owes).map((l) => <Chip key={l} on={limit === l} now={c.limit === l} label={short(l)} aria={`Limit ${money(l)}`} go={() => setLimit(l)} />)}
        <Chip on={limit === null} now={!c.limit} wide mono={false} label={ANSWER.cashOnly} go={() => setLimit(null)} />
      </div>
      {limit !== null && (
        <>
          <h2 class="mg-mo-h">Terms</h2>
          <div class="mg-mo-lchips">
            {TERMS.map((d) => <Chip key={d} on={days === d} now={!!now && now.days === d} label={`${d} d`} aria={`${d} days`} go={() => setDays(d)} />)}
          </div>
        </>
      )}
      <div class="mg-mo-card mg-mo-lbar">
        <div class="h"><span>{`Owes · ${c.orders === 1 ? '1 order' : `${c.orders} orders`}`}</span><b class="mono">{money(Math.max(0, c.owes))}</b></div>
        {limit !== null && (
          <>
            <div class="bar"><div><i style={{ width: `${Math.min(100, bar.fill * 100)}%` }} /></div>{bar.nowAt != null && limit !== c.limit && <i class="line" style={{ left: `${bar.nowAt * 100}%` }} />}</div>
            <div class="k">
              {bar.nowAt != null && limit !== c.limit && <span class="now" style={{ left: `${bar.nowAt * 100}%` }}>now <b class="mono">{short(c.limit)}</b></span>}
              <b class="mono pick">{short(limit)}</b>
            </div>
            <div class="left"><span>{bar.left >= 0 ? 'Left' : 'Over'}</span><b class={cx('mono', bar.left < 0 && 'over')}>{money(Math.abs(bar.left))}</b></div>
          </>
        )}
      </div>
    </MoneySheet>
  );
}
