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
import { howLong } from '../../../core/time.ts';
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

export function AskCard(p: { b: Books; c: Customer | null; ask: SourcingAsk | null; name: string; qty: number }): JSX.Element {
  const b = p.b, c = p.c, ask = p.ask, m = sourcing(b), r = manager(b);
  if (!ask) {
    return (
      <div class="sl-stock">
        <div class="sl-stock-h"><span aria-hidden="true"><Duo i={phPlane} size={22} color="#6FDCB0" /></span><span><span>{`Ask ${m.first} to stock it`}</span><span>{`${p.name}${c ? ` · for ${first(c.name)}` : ''}`}</span></span></div>
        <div class="sl-stock-r">
          <span class="mono sl-stock-n">{p.qty} <span class="ow-word">pc</span></span>
          <button type="button" class="sl-stock-go" onClick={() => void send(p.name, p.qty, c)}><Icon name="send" size={17} stroke={2.2} />{`Send to ${m.first}`}</button>
        </div>
      </div>
    );
  }
  const at = STAGES.findIndex(([k]) => k === ask.status), sent = mine(ask, c);
  const title = ask.status === 'asked' ? `Asked of ${m.first}` : ask.status === 'looking' ? `${m.first} is looking` : ask.status === 'found' ? `${m.first} found it` : `${r.first} priced it`;
  const next = ask.status === 'found' ? `${r.first} prices it next` : ask.status === 'priced' ? `${m.first} lists it next` : `${m.first} looks for it`;
  const people = [...new Set(ask.requests.map((q) => q.customerId))].map((id) => b.customers.find((y) => y.id === id) || null);
  const names = people.map((y) => (y ? first(y.name) : 'A walk-in')), lead = people.find((y) => !!y) || null;
  const qty = ask.requests.reduce((n, q) => n + q.qty, 0), ago = sent ? howLong(sent.at, now.value) : '';
  return (
    <div class="sl-stock">
      <div class="sl-stock-h"><span aria-hidden="true"><Duo i={phSearch} size={22} color="#6FDCB0" /></span><span><span>{title}</span><span>{`${ask.name} · ${next}`}</span></span></div>
      <div role="img" aria-label={`${STAGES.slice(0, at + 1).map(([, w]) => w).join(', ')}; ${next}`} class="sl-ask-steps">
        <span aria-hidden="true" class="sl-ask-track" /><span aria-hidden="true" class="sl-ask-done" style={{ width: `${at * 20}%` }} />
        {STAGES.map(([k, w], i) => (
          <span key={k} class={i < at ? 'done' : i === at ? 'now' : ''}><span>{i < at ? <Icon name="check" size={12} stroke={3.2} /> : i === at ? <i /> : null}</span><span>{w}</span></span>
        ))}
      </div>
      <div class="sl-ask-who">
        {lead && <span aria-hidden="true" class="ow-av" style={avatarStyle({ initials: lead.initials, tint: lead.tint, size: 24, font: 10 })}>{lead.initials}</span>}
        {`${names.join(' and ')} asked for `}<b class="mono">{qty}</b>
      </div>
      {sent
        ? <div role="status" class="sl-ask-sent"><Icon name="check" size={16} stroke={2.8} />{`Sent to ${m.first} · ${ago === '0 m' ? 'just now' : `${ago} ago`}`}</div>
        : <button type="button" class="sl-stock-go" onClick={() => void send(ask.name, p.qty, c)}><Icon name="plus" size={17} stroke={2.4} />{`Add ${c ? whose(c.name) : 'this'} ask · `}<span class="mono">{p.qty}</span> pc</button>}
    </div>
  );
}
