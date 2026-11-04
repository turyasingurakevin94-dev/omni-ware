/*
 * TD19, TD20 · Asked of Sourcing: what Grace asked Moses for, as a five-step funnel (Asked · Looking ·
 * Found · Priced · Listed); what is ready to tell first (Tell, or start their order), then what is with
 * Moses, each on its own steps. In her first week: the ghost of an ask, one way in, and her searches
 * that found nothing this week. Every ask opens on its own screen (Ask.tsx, today/asks { id }).
 */
import type { JSX } from 'preact';
import { money } from '../../../core/money.ts';
import { firstWord } from '../../../core/names.ts';
import { clock, dayOf, daysApart, weekday } from '../../../core/time.ts';
import type { Books, Customer, SourcingAsk } from '../../../core/types.ts';
import { Avatar, PLAIN } from '../../../ui/Avatar.tsx';
import { ItemSquare } from '../../../ui/ItemSquare.tsx';
import { Duo, Icon, phWhatsapp, type IconName } from '../../../ui/icons.tsx';
import { Tap, cx } from '../../../ui/util.tsx';
import { nav } from '../shell/nav.ts';
import type { ScreenProps } from '../shell/types.ts';
import { books, now } from '../shell/store.ts';
import { Ask, tellAsk } from './Ask.tsx';
import { openAsk, prefillFromChats } from './AskNew.tsx';
import { askValue, weekStart } from './data.ts';
import { askAisle } from './data.ts';
import { useLocal } from './local.ts';
import { ASK_STAGES } from './You.tsx';
import './asks.css';

export const STEP_WORD: Record<string, string> = { asked: 'Asked', looking: 'Looking', found: 'Found', priced: 'Priced', listed: 'Listed' };
/** Each step's mark: asked a message, looking the lens, found the lens ticked, priced the tag, listed the shop. */
export function StepIcon(p: { s: string; size: number; stroke: number }): JSX.Element {
  const name: Record<string, IconName> = { asked: 'message', looking: 'search', found: 'found', priced: 'tag', listed: 'store' };
  return <Icon name={name[p.s]} size={p.size} stroke={p.stroke} />;
}

/** My asks: the ones with a request of mine, not dropped. */
export function myAsks(b: Books): SourcingAsk[] {
  return b.asks.filter((a) => a.status !== 'dropped' && a.requests.some((r) => r.by === b.me.id));
}
export const askCustomer = (b: Books, a: SourcingAsk): Customer | null => {
  const r = a.requests.find((x) => x.customerId);
  return r ? b.customers.find((c) => c.id === r.customerId) || null : null;
};
export const askQty = (a: SourcingAsk) => a.requests.reduce((s, r) => s + r.qty, 0);

const FUNNEL: Record<string, string> = { asked: 'rgba(255,255,255,.55)', looking: 'rgba(255,255,255,.55)', found: '#9DB7E0', priced: '#F5B26B', listed: '#6FDCB0' };

/** The navy head: back, the title and its count, Ask, the funnel, and a line when nothing waits to be asked. */
export function AsksHead(p: { b: Books; asks: SourcingAsk[]; first: boolean; onAdd: () => void }): JSX.Element {
  const b = p.b, ml = b.members.find((m) => m.role === 'sourcing'), rn = b.members.find((m) => m.role === 'manager');
  const n = (s: string) => p.asks.filter((a) => a.status === s).length;
  return (
    <header class="td-asks-h">
      <div class="td-asks-top">
        <Tap on={() => nav.back()} label="Back" class="td-asks-back"><Icon name="back" size={20} stroke={2.2} /></Tap>
        <h1>Asked of Sourcing<span class="mono">{p.asks.length}</span></h1>
        {!p.first && <Tap on={p.onAdd} label={`Ask ${ml ? firstWord(ml.name) : 'Sourcing'} for something`} class="td-asks-add"><Icon name="plus" size={20} stroke={2.4} /></Tap>}
      </div>
      <div role="img" aria-label={ASK_STAGES.map((s) => `${n(s)} ${s}`).join(', ')} class="td-funnel">
        {ASK_STAGES.map((s) => (
          <span key={s}>
            <span><b class="mono" style={{ color: n(s) ? (s === 'asked' || s === 'looking' ? '#FFFFFF' : FUNNEL[s]) : '#8D99B5' }}>{n(s)}</b></span>
            <span style={{ background: n(s) ? FUNNEL[s] : 'rgba(255,255,255,.12)' }} />
            <span>{STEP_WORD[s]}</span>
          </span>
        ))}
      </div>
      {(p.first || n('asked') === 0) && (
        <div class="td-asks-who">
          {p.first && <span class="td-asks-first">Your first week</span>}
          {ml && <Avatar initials={ml.initials} tint={ml.tint} size={24} style={PLAIN} />}
          <span><b>{ml ? firstWord(ml.name) : 'Sourcing'}</b>{` finds them${p.first || !rn ? '' : ` · ${firstWord(rn.name)} sets the price`}`}</span>
        </div>
      )}
    </header>
  );
}

/** One ask's five steps, small (TD19): done navy with a tick, now ringed, the rest dashed. */
function Steps(p: { at: number; label: string }): JSX.Element {
  return (
    <span role="img" aria-label={`${p.label}: step ${p.at + 1} of 5`} class="td-steps5">
      {ASK_STAGES.map((s, i) => (
        <span key={s} class={i < p.at ? 'done' : i === p.at ? 'now' : undefined}>
          <span>{i < p.at ? <Icon name="check" size={12} stroke={3} /> : <StepIcon s={s} size={13} stroke={2} />}</span>
          <span>{STEP_WORD[s]}</span>
        </span>
      ))}
    </span>
  );
}

export function Asks(p: ScreenProps): JSX.Element {
  const b = books.value, n = now.value, L = useLocal();
  if (p.params.id) return <Ask params={p.params} />;
  if (!b) return <main class="td-wait" aria-busy="true" />;
  const asks = myAsks(b), ready = asks.filter((a) => a.status === 'listed' && !L.told.includes('ask:' + a.id)), withMl = asks.filter((a) => a.status !== 'listed').sort((x, y) => ASK_STAGES.indexOf(y.status) - ASK_STAGES.indexOf(x.status));
  const ml = b.members.find((m) => m.role === 'sourcing'), rn = b.members.find((m) => m.role === 'manager');
  const mine = b.orders.filter((o) => o.placedBy === b.me.id).map((o) => o.placedAt);
  const first = !asks.length && (!mine.length || daysApart(dayOf(Math.min(...mine)), dayOf(n)) < 7);
  const add = () => openAsk(prefillFromChats(b, n));
  const misses = L.misses.filter((x) => dayOf(x.at) >= weekStart(dayOf(n))).sort((x, y) => y.n - x.n);
  return (
    <div class="td-asks">
      <AsksHead b={b} asks={asks} first={first} onAdd={add} />
      <main class="td-asks-main">
        {first ? (
          <>
            <div class="td-ghostask">
              <div class="td-ghostask-h"><span>Your first ask</span><span>moves step by step</span></div>
              <div aria-hidden="true" class="td-ghostask-row"><span /><span><span /><span /></span></div>
              <div role="img" aria-label={`You ask, ${ml ? firstWord(ml.name) : 'Sourcing'} looks and finds it, ${rn ? firstWord(rn.name) : 'the Manager'} prices it, it is listed and you tell them`} class="td-steps5 ghost">
                {ASK_STAGES.map((s) => {
                  const who = s === 'asked' ? b.me : s === 'priced' ? rn : s === 'listed' ? null : ml;
                  return (
                    <span key={s}>
                      <span><StepIcon s={s} size={13} stroke={2} /></span><span>{STEP_WORD[s]}</span>
                      <span aria-hidden="true">{who ? <Avatar initials={who.initials} tint={who.id === b.me.id ? 'me' : who.tint} size={20} style={PLAIN} /> : <Duo i={phWhatsapp} size={18} color="#0F6B43" />}</span>
                    </span>
                  );
                })}
              </div>
            </div>
            <Tap on={add} class="td-alerts"><Icon name="plus" size={18} stroke={2.4} />{`Ask ${ml ? firstWord(ml.name) : 'Sourcing'} for something`}</Tap>
            {misses.length > 0 && (
              <>
                <div class="td-asks-sec"><h2>Found nothing this week</h2><span>your searches</span></div>
                <div class="ow-group p14">
                  {misses.map((x) => (
                    <Tap key={x.words} on={() => openAsk({ name: x.words })} class="td-miss">
                      <span aria-hidden="true"><Icon name="search" size={18} stroke={2} /></span>
                      <span>{`“${x.words}”`}</span><span class="mono">{`${x.n}×`}</span>
                      <span aria-hidden="true" class="ow-chev"><Icon name="chevron-right" size={16} stroke={2.2} /></span>
                    </Tap>
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <>
            {ready.length > 0 && (
              <>
                <div class="td-asks-dot"><span aria-hidden="true" style={{ background: '#0F6B43' }} /><h2>Ready to tell</h2><span class="mono">{ready.length}</span></div>
                {ready.map((a) => <Ready key={a.id} b={b} a={a} />)}
              </>
            )}
            {withMl.length > 0 && (
              <>
                <div class={cx('td-asks-dot', ready.length > 0 && 'after')}><span aria-hidden="true" style={{ background: '#1A5A8A' }} /><h2>{`With ${ml ? firstWord(ml.name) : 'Sourcing'}`}</h2>
                  {ml && <Avatar initials={ml.initials} tint={ml.tint} size={22} style={PLAIN} />}<span class="mono">{withMl.length}</span></div>
                <div class="ow-group p14">
                  {withMl.map((a) => {
                    const c = askCustomer(b, a), at = ASK_STAGES.indexOf(a.status);
                    const why = a.status === 'found' ? `${rn ? firstWord(rn.name) : 'The Manager'} prices it` : a.status === 'looking' ? `${a.tried.length} suppliers asked`
                      : `${dayOf(a.createdAt) === dayOf(n) ? 'today ' : weekday(a.createdAt) + ' '}${clock(a.createdAt)}`;
                    const body = (
                      <>
                        <span class="td-withml-h">
                          <ItemSquare aisle={askAisle(b, a)} size={38} icon={22} />
                          <span class="td-withml-t"><span>{a.name}</span>
                            <span>{c && <Avatar initials={c.initials} tint={c.tint} size={18} style={PLAIN} />}{`${c ? firstWord(c.name) : ''} · ${askQty(a)} · ${why}`}</span></span>
                          <span aria-hidden="true" class="ow-chev"><Icon name="chevron-right" size={16} stroke={2.2} /></span>
                        </span>
                        <Steps at={at} label={STEP_WORD[a.status]} />
                      </>
                    );
                    return <Tap key={a.id} on={() => nav.push('today/asks', { id: a.id })} class="td-withml">{body}</Tap>;
                  })}
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

/** A listed ask, ready to tell: the item, its price, who asked and what it comes to, Tell or start their order. */
function Ready(p: { b: Books; a: SourcingAsk }): JSX.Element {
  const b = p.b, a = p.a, it = a.itemId ? b.items.find((i) => i.id === a.itemId) : null, c = askCustomer(b, a);
  const ml = b.members.find((m) => m.role === 'sourcing'), listedAt = a.stageAt;
  const open = () => nav.push('today/asks', { id: a.id });
  return (
    <div class="td-ready">
      <Tap on={open} class="td-ready-h">
        <ItemSquare aisle={askAisle(b, a)} size={44} icon={26} />
        <span class="td-ready-t"><span>{it ? it.name : a.name}</span>
          <span><Icon name="check" size={12} stroke={3} />{`Listed by ${ml ? firstWord(ml.name) : 'Sourcing'} · ${dayOf(listedAt) === dayOf(now.value) ? '' : weekday(listedAt) + ' '}${clock(listedAt)}`}</span></span>
        {it && it.price != null && <span class="td-find-fig"><b class="mono big">{money(it.price)}</b><small>{`a ${it.unit === 'pc' ? 'piece' : it.unit}`}</small></span>}
      </Tap>
      {c && (
        <span class="td-ready-who"><Avatar initials={c.initials} tint={c.tint} size={24} style={PLAIN} /><span>{`${firstWord(c.name)} asked for ${askQty(a)}`}</span><b class="mono">{money(askValue(b, a))}</b></span>
      )}
      <div class="td-ready-acts">
        {c && <button type="button" class="td-ready-tell" onClick={() => { void tellAsk(b, a, askQty(a), false); }}><Duo i={phWhatsapp} size={18} color="#FFFFFF" />{`Tell ${firstWord(c.name)}`}</button>}
        <Tap on={open} class="td-ready-start"><Icon name="plus" size={15} stroke={2.6} />Start their order</Tap>
      </div>
    </div>
  );
}
