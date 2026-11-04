/*
 * Something the shop does not sell (SL09, SL37, SL38), as Sourcing holds it:
 *   - nobody asked yet: "Ask Moses to stock it", how many, Send (SL38);
 *   - already asked (FACTS §6: the tile cutter, found, Ruth prices it): how far it has got
 *     (Asked · Looking · Found · Priced · Listed), who asked, and one button that adds
 *     this customer's ask to it (SL09);
 *   - this customer's ask in it: "Sent to Moses · just now", no button (SL37, the TD24 way).
 * Every ask is kept as its own request on the lead (sourcing_leads.requests, 0072).
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { dayOf, howLong, when } from '../../../core/time.ts';
import type { Books, Customer, SourcingAsk } from '../../../core/types.ts';
import { avatarStyle } from '../../../ui/Avatar.tsx';
import { Duo, Icon, phPlane, phSearch } from '../../../ui/icons.tsx';
import { toast } from '../../../ui/toast.tsx';
import { act, me, now } from '../shell/store.ts';
import { first, whose } from './insights.ts';
import { cur } from './model.ts';
import { manager, sourcing } from './people.ts';

const STAGES = [['asked', 'Asked'], ['looking', 'Looking'], ['found', 'Found'], ['priced', 'Priced'], ['listed', 'Listed']] as const;

/** Add this customer's ask to Sourcing (a new lead, or a request on the one there). `say`: a toast says it went (an item out, SL08's rows). */
export async function send(name: string, qty: number, c: Customer | null, say = ''): Promise<void> {
  const x = cur.value;
  try {
    const r = await act('askSourcing', { name, qty, customerId: c ? c.id : null, chatId: x ? x.chatId : null });
    if (r.kept) toast.show('Kept on this phone', { kind: 'warn', sub: 'It goes when the signal is back' });
    else if (say) toast.show(say, { kind: 'ok' });
  } catch (e) {
    toast.show('Not sent yet', { kind: 'error', sub: (e as Error).message, retry: () => void send(name, qty, c, say) });
  }
}

/** This customer's ask, made from this order (or since it began). */
function mine(ask: SourcingAsk, c: Customer | null): SourcingAsk['requests'][number] | null {
  const x = cur.value, from = x ? x.at : 0, id = me.value ? me.value.id : '';
  return ask.requests.find((r) => r.by === id && r.customerId === (c ? c.id : null) && r.at >= from) || null;
}

/** Sourcing's steps, Asked to Listed, with how far this one has got (-1: not asked yet, all to come). */
function Steps(p: { at: number; label: string }): JSX.Element {
  return (
    <div role="img" aria-label={p.label} class="sl-ask-steps">
      <span aria-hidden="true" class="sl-ask-track" />{p.at > 0 && <span aria-hidden="true" class="sl-ask-done" style={{ width: `${p.at * 20}%` }} />}
      {STAGES.map(([k, w], i) => (
        <span key={k} class={i < p.at ? 'done' : i === p.at ? 'now' : ''}><span>{i < p.at ? <Icon name="check" size={12} stroke={3.2} /> : i === p.at ? <i /> : null}</span><span>{w}</span></span>
      ))}
    </div>
  );
}

/** What else this customer has asked Sourcing for, still open (SL38: Kato's solar pump), a plain row each. */
function OtherAsks(p: { b: Books; c: Customer; not: string }): JSX.Element | null {
  const t = now.value, rows = p.b.asks.filter((a) => a.status !== 'dropped' && a.status !== 'listed' && a.name !== p.not && a.requests.some((q) => q.customerId === p.c.id));
  if (!rows.length) return null;
  return (
    <>
      {rows.map((a) => {
        const reqs = a.requests.filter((q) => q.customerId === p.c.id), n = reqs.reduce((s, q) => s + q.qty, 0), at = Math.max(...reqs.map((q) => q.at));
        const day = dayOf(at) === dayOf(t) ? 'today ' : '';
        return (
          <div key={a.id} class="sl-ask-other">
            <span aria-hidden="true" class="sl-ask-other-ic"><Duo i={phSearch} size={20} color="#5F6980" /></span>
            <span class="sl-line-t"><span class="sl-line-n">{a.name}</span><span class="sl-ask-other-s">{`${whose(p.c.name)} other ask · `}<b class="mono">{n}</b>{` · ${day}`}<span class="mono">{when(at, t)}</span></span></span>
            <span class="sl-ask-other-st">{STAGES.find(([k]) => k === a.status)?.[1] || 'Asked'}</span>
          </div>
        );
      })}
    </>
  );
}

export function AskCard(p: { b: Books; c: Customer | null; ask: SourcingAsk | null; name: string; qty: number }): JSX.Element {
  const b = p.b, c = p.c, ask = p.ask, m = sourcing(b), r = manager(b);
  const [qty, setQty] = useState(p.qty);
  if (!ask) {
    return (
      <>
        <div class="sl-stock">
          <div class="sl-stock-h"><span aria-hidden="true"><Duo i={phPlane} size={22} color="#6FDCB0" /></span><span><span>{`Ask ${m.first} to stock it`}</span><span>{`${p.name}${c ? ` · for ${first(c.name)}` : ''}`}</span></span></div>
          <Steps at={-1} label={`Not asked yet: ${m.first} asks, looks, finds; ${r.first} prices; then it is listed`} />
          <div class="sl-ask-none">Nobody else has asked for it</div>
          <div class="sl-stock-r">
            <span class="sl-ask-qty">
              <button type="button" aria-label="Fewer" onClick={() => setQty(Math.max(1, qty - 1))}><Icon name="minus" size={16} stroke={2.4} /></button>
              <span class="mono">{qty}<span class="ow-word">pc</span></span>
              <button type="button" aria-label="More" onClick={() => setQty(qty + 1)}><Icon name="plus" size={16} stroke={2.4} /></button>
            </span>
            <button type="button" class="sl-stock-go" onClick={() => void send(p.name, qty, c)}><Icon name="send" size={17} stroke={2.2} />{`Send to ${m.first}`}</button>
          </div>
        </div>
        {c && <OtherAsks b={b} c={c} not={p.name} />}
      </>
    );
  }
  const at = STAGES.findIndex(([k]) => k === ask.status), sent = mine(ask, c);
  const title = ask.status === 'asked' ? `Asked of ${m.first}` : ask.status === 'looking' ? `${m.first} is looking` : ask.status === 'found' ? `${m.first} found it` : `${r.first} priced it`;
  const next = ask.status === 'found' ? `${r.first} prices it next` : ask.status === 'priced' ? `${m.first} lists it next` : `${m.first} looks for it`;
  const people = [...new Set(ask.requests.map((q) => q.customerId))].map((id) => b.customers.find((y) => y.id === id) || null);
  const names = people.map((y) => (y ? first(y.name) : 'A walk-in')), faces = people.filter((y): y is Customer => !!y).slice(0, 3);
  const asked = ask.requests.reduce((n, q) => n + q.qty, 0), ago = sent ? howLong(sent.at, now.value) : '';
  return (
    <div class="sl-stock">
      <div class="sl-stock-h"><span aria-hidden="true"><Duo i={phSearch} size={22} color="#6FDCB0" /></span><span><span>{title}</span><span>{`${ask.name} · ${next}`}</span></span></div>
      <Steps at={at} label={`${STAGES.slice(0, at + 1).map(([, w]) => w).join(', ')}; ${next}`} />
      <div class="sl-ask-who">
        {faces.length > 0 && <span aria-hidden="true" class="sl-ask-faces">{faces.map((y) => <span key={y.id} class="ow-av" style={avatarStyle({ initials: y.initials, tint: y.tint, size: 24, font: 10 })}>{y.initials}</span>)}</span>}
        {`${names.join(' and ')} asked for `}<b class="mono">{asked}</b>
      </div>
      {sent
        ? <div role="status" class="sl-ask-sent"><Icon name="check" size={16} stroke={2.8} />{`Sent to ${m.first} · ${ago === '0 m' ? 'just now' : `${ago} ago`}`}</div>
        : <button type="button" class="sl-stock-go" onClick={() => void send(ask.name, p.qty, c)}><Icon name="plus" size={17} stroke={2.4} />{`Add ${c ? whose(c.name) : 'this'} ask · `}<span class="mono">{p.qty}</span> pc</button>}
    </div>
  );
}
