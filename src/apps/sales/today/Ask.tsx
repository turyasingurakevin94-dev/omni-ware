/*
 * TD21, TD22 · One ask of Sourcing, on its own screen (every ask has one): the item, who asked, the five
 * steps with their days. Before it is listed (TD21, looking): who Moses asked and what they said, how long the
 * customer has waited, and telling them where it is. Listed (TD22): its price and shelf, how many they want and what
 * it comes to, the message, then Tell them or start their order.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { money } from '../../../core/money.ts';
import { firstWord } from '../../../core/names.ts';
import { clock, dayLabel, dayOf, daysApart, weekday } from '../../../core/time.ts';
import type { Books, SourcingAsk } from '../../../core/types.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Button } from '../../../ui/Button.tsx';
import { FullSheet } from '../../../ui/FullSheet.tsx';
import { ItemSquare } from '../../../ui/ItemSquare.tsx';
import { Icon, phWhatsapp } from '../../../ui/icons.tsx';
import { Stepper } from '../../../ui/Stepper.tsx';
import { toast } from '../../../ui/toast.tsx';
import { nav } from '../shell/nav.ts';
import type { ScreenProps } from '../shell/types.ts';
import { books, chats, now } from '../shell/store.ts';
import { Asks, StepIcon, STEP_WORD, askCustomer, askQty } from './Asks.tsx';
import { askAisle } from './data.ts';
import { go, itemsParam } from './go.ts';
import { markTold } from './local.ts';
import { Preview, sendTo, sentToast } from './Tell.tsx';
import { ASK_STAGES } from './You.tsx';
import './ask.css';

type Logged = SourcingAsk & { log?: { status: string; at: number; by: string }[] };
type Tried = SourcingAsk['tried'][0] & { answer?: 'none' | 'has' | null };

/** "the maroon roof paint", "the 56 inch ceiling fans": what it is, as said to a customer. */
function said(a: SourcingAsk, b: Books, qty: number): string {
  const it = a.itemId ? b.items.find((i) => i.id === a.itemId) : null, name = it ? it.name : a.name;
  const [base, variant] = name.split(/ · |, /);
  const v = (variant || '').replace(/\b\d+\s?(L|kg|m|mm)\b/g, '').trim();
  return `the ${v ? v + ' ' : ''}${base.toLowerCase()}${!it && qty > 1 ? 's' : ''}`;
}

export function askMessage(b: Books, a: SourcingAsk, qty: number): string {
  const c = askCustomer(b, a), who = c ? firstWord(c.name) : '', it = a.itemId ? b.items.find((i) => i.id === a.itemId) : null;
  if (a.status === 'listed' && it && it.price != null) {
    const u = it.unit === 'pc' ? 'piece' : it.unit;
    return `Hello ${who}, ${said(a, b, qty)} is in: ${money(it.price)} a ${u}. Shall I put ${qty} ${u}s on an order for you? That is ${money(it.price * qty)}.`;
  }
  if (a.status === 'found' || a.status === 'priced') return `Hello ${who}, we have found ${said(a, b, qty)}. I will tell you the price as soon as it is set.`;
  return `Hello ${who}, we are still looking for ${said(a, b, qty)}. I will tell you as soon as we have them.`;
}

/** Its photo: the item's own, else the one sent with the ask (a link in the shop's bucket), or null. */
export function askPhoto(b: Books, a: SourcingAsk): string | null {
  const it = a.itemId ? b.items.find((i) => i.id === a.itemId) : null;
  return (it && it.image) || a.image || null;
}

/**
 * Tell the customer on WhatsApp, with the photo when asked; a listed ask is then told (kept on this phone).
 * Nothing sent (no chat with them): an error, and it stays untold. `back` leaves the ask's own screen.
 */
export async function tellAsk(b: Books, a: SourcingAsk, qty: number, back: boolean, photo: boolean = false): Promise<void> {
  const c = askCustomer(b, a), pic = photo ? askPhoto(b, a) : null;
  try {
    const sent = await sendTo(chats.value, c ? c.id : null, askMessage(b, a, qty), now.value, pic);
    if (!sentToast(sent, c ? firstWord(c.name) : 'them', !!pic)) return;
    if (a.status === 'listed') markTold('ask:' + a.id);
    if (back) nav.back();
  } catch (e) {
    toast.show('Not sent', { kind: 'error', sub: (e as Error).message, retry: () => { void tellAsk(b, a, qty, back, photo); } });
  }
}

/** When a step happened: the weekday, or the time today. */
const stamp = (at: number, today: string) => (dayOf(at) === today ? clock(at) : weekday(at));

function Rail(p: { a: Logged; today: string }): JSX.Element {
  const at = ASK_STAGES.indexOf(p.a.status), log = p.a.log || [], last = at === ASK_STAGES.length - 1;
  const when = (s: string) => { const e = log.find((x) => x.status === s); return e ? stamp(e.at, p.today) : s === 'asked' ? stamp(p.a.createdAt, p.today) : ''; };
  return (
    <div class="td-rail">
      <div role="img" aria-label={`${STEP_WORD[p.a.status]}: step ${at + 1} of 5`} class="td-rail-dots">
        <span aria-hidden="true" class="td-rail-track" /><span aria-hidden="true" class="td-rail-done" style={{ width: `${at * 20}%` }} />
        {ASK_STAGES.map((s, i) => (
          <span key={s} class={i < at ? 'done' : i === at ? 'now' : undefined}>
            {i < at || (i === at && last) ? <Icon name="check" size={i === at ? 16 : 12} stroke={i === at ? 2.2 : 2.8} /> : <StepIcon s={s} size={i === at ? 16 : 12} stroke={2.2} />}
          </span>
        ))}
      </div>
      <div class="td-rail-words">
        {ASK_STAGES.map((s, i) => (
          <span key={s} class={i < at ? 'done' : i === at ? 'now' : undefined}>
            <b>{STEP_WORD[s]}</b>
            <em class={i < at || (i === at && last) ? 'mono' : undefined}>{i === at && !last ? 'now' : i <= at ? when(s) : ''}</em>
          </span>
        ))}
      </div>
    </div>
  );
}

export function Ask(p: ScreenProps): JSX.Element {
  const b = books.value, n = now.value, a = b ? (b.asks.find((x) => x.id === p.params.id) as Logged | undefined) : undefined;
  const [qty, setQty] = useState(a ? askQty(a) : 1), [photo, setPhoto] = useState(true);
  if (!b) return <main class="td-wait" aria-busy="true" />;
  if (!a || a.status === 'dropped') return <Asks params={{}} />;
  const today = dayOf(n), c = askCustomer(b, a), who = c ? firstWord(c.name) : '', it = a.itemId ? b.items.find((i) => i.id === a.itemId) : null;
  const ml = b.members.find((m) => m.role === 'sourcing'), by = (s: string) => { const e = (a.log || []).find((x) => x.status === s); return e ? b.members.find((m) => m.id === e.by) : null; };
  const since = (a.log || []).find((x) => x.status === a.status), sinceAt = since ? since.at : a.stageAt;
  const first = a.requests[0], close = () => nav.back();
  const u = it ? (it.unit === 'pc' ? 'piece' : it.unit) : 'piece', pic = askPhoto(b, a);
  return (
    <FullSheet onBack={close} backLabel="Back to Asked of Sourcing" head={
      <div class="ow-shead">
        <span aria-hidden="true" class="ow-shead-grab" />
        <div class="ow-shead-row">
          <ItemSquare aisle={askAisle(b, a)} size={44} icon={26} />
          <div class="td-ask-ht"><span>{it ? it.name : a.name}</span>
            <span>{c && <Avatar initials={c.initials} tint={c.tint} size={20} style={{ letterSpacing: 'normal' }} />}{`${c ? c.name : 'They'} asked for ${askQty(a)} · ${weekday(first.at)}`}</span></div>
          <button type="button" class="ow-shead-x" aria-label="Close" onClick={close}><Icon name="close" size={16} stroke={2.2} /></button>
        </div>
        <div class="td-ask-state">
          <div class="td-ask-st"><span>{STEP_WORD[a.status]}</span><span>{`${ml ? firstWord(ml.name) : 'Sourcing'} · ${dayOf(sinceAt) === today ? 'today ' + clock(sinceAt) : 'since ' + weekday(sinceAt)}`}</span></div>
          <Rail a={a} today={today} />
        </div>
      </div>
    }>
      {a.status !== 'listed' ? (
        <>
          {a.tried.length > 0 && <div class="td-tried">
            <div class="td-tried-h"><span>{`Who ${ml ? firstWord(ml.name) : 'Sourcing'} asked`}</span>
              {(a.tried as Tried[]).some((t) => t.answer === 'none') && <span class="td-spill b"><Icon name="close" size={10} stroke={3.4} />{(a.tried as Tried[]).filter((t) => t.answer === 'none').length}</span>}
              {(a.tried as Tried[]).some((t) => !t.answer) && <span class="td-spill t"><Icon name="clock" size={11} stroke={2.6} />{(a.tried as Tried[]).filter((t) => !t.answer).length}</span>}</div>
            {(a.tried as Tried[]).map((t) => (
              <div key={t.supplier} class="td-tried-r">
                <span aria-hidden="true"><Icon name="store" size={17} stroke={1.8} /></span>
                <span><span>{t.supplier}</span><span class="mono">{dayLabel(t.at)}</span></span>
                {t.answer === 'none' ? <span class="td-spill b">Has none</span> : t.answer === 'has' ? <span class="td-spill g">Has it</span> : <span class="td-spill w">No answer yet</span>}
              </div>
            ))}
          </div>}
          <div class="td-ask-tiles">
            <div class="warn"><span>{`${who} waits`}</span><span class="mono">{`${daysApart(dayOf(first.at), today)} days`}</span></div>
            <div><span>Asked for</span><span class="mono">{`${askQty(a)} `}<span class="ow-word">{askQty(a) === 1 ? u : u + 's'}</span></span></div>
          </div>
          <Preview chip="What they get" who={firstWord(b.me.name)} wide>{askMessage(b, a, askQty(a))}</Preview>
          <div class="td-ask-foot"><Button kind="green" duo={phWhatsapp} onClick={() => { void tellAsk(b, a, askQty(a), true); }}>{`Tell ${who} · ${a.status === 'found' || a.status === 'priced' ? 'found' : 'still looking'}`}</Button></div>
        </>
      ) : (
        <>
          <div class="td-ask-tiles">
            <div><span>{`A ${u}`}</span><span class="mono">{money(it && it.price)}</span>
              {by('priced') && <span class="td-ask-by"><Avatar initials={(by('priced') as { initials: string }).initials} tint={(by('priced') as { tint: 't2' }).tint} size={16} font={11} style={{ letterSpacing: 'normal' }} />{`${firstWord((by('priced') as { name: string }).name)} priced it`}</span>}</div>
            <div class="good"><span>Ready to sell</span><span class="mono">{`${it && it.onShelf ? it.onShelf : 0} `}<span class="ow-word">on shelf</span></span><span>{`${u}s`}</span></div>
          </div>
          <div class="td-ask-qty">
            {c && <Avatar initials={c.initials} tint={c.tint} size={36} />}
            <Stepper value={qty} unit={`${u}s`} min={1} onChange={setQty} />
            <span class="mono">{money((it && it.price ? it.price : 0) * qty)}</span>
          </div>
          <Preview chip="What they get" who={firstWord(b.me.name)} wide>{askMessage(b, a, qty)}</Preview>
          {pic && <label class="td-ask-photo">
            <span aria-hidden="true"><Icon name="camera" size={18} stroke={2} /></span>
            <span>{`Send a photo of the ${u}`}</span>
            <input type="checkbox" checked={photo} aria-label={`Send a photo of the ${u}`} onChange={() => setPhoto(!photo)} />
            <span aria-hidden="true" class={'td-switch' + (photo ? ' on' : '')}><i /></span>
          </label>}
          <div class="td-ask-foot">
            <Button kind="green" duo={phWhatsapp} onClick={() => { void tellAsk(b, a, qty, true, photo && !!pic); }}>{`Tell ${who}`}</Button>
            <Button kind="ghost" h={52} class="td-btn-in" onClick={() => go('sell/order', { customer: c ? c.id : null, items: a.itemId ? itemsParam(a.itemId, qty) : null })}><Icon name="plus" size={16} stroke={2.6} />Start their order</Button>
          </div>
        </>
      )}
    </FullSheet>
  );
}
