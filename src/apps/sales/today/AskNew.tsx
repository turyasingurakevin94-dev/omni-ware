/*
 * TD23, TD24 · Ask Moses for something the shop does not sell: what they said (when it came from a
 * chat), what they want, how many, who asked, a photo, and who does what next. With no signal the
 * ask is kept on this phone (the outbox) and sends itself: "Not sent yet", Try again, Done.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { isDataError } from '../../../core/datasource.ts';
import { firstWord } from '../../../core/names.ts';
import { clock } from '../../../core/time.ts';
import type { Books, Ms } from '../../../core/types.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { PLAIN } from './bits.tsx';
import { Button } from '../../../ui/Button.tsx';
import { Duo, Icon, phSwap } from '../../../ui/icons.tsx';
import { Notice } from '../../../ui/Notice.tsx';
import { sheet } from '../../../ui/sheet.tsx';
import { Stepper } from '../../../ui/Stepper.tsx';
import { toast } from '../../../ui/toast.tsx';
import { act, books, chats, flush } from '../shell/store.ts';
import { go } from './go.ts';
import './asknew.css';

export interface AskPrefill {
  name: string;
  qty?: number;
  customerId?: string | null;
  chatId?: number | null;
  /** What they said in their chat, and when. */
  quote?: { body: string; at: Ms } | null;
}

/**
 * The newest thing one of Grace's customers asked for in their chat that the shop does not sell and
 * nobody asked Moses for yet ("Do you have a solar water pump, 1hp? We need 2."): what, and how many.
 */
export function prefillFromChats(b: Books, nowMs: Ms): AskPrefill {
  const cb = chats.value;
  if (!cb) return { name: '' };
  const mineChats = new Map(cb.chats.filter((c) => c.ownerId === b.me.id && c.customerId).map((c) => [c.id, c]));
  const asked = b.asks.map((a) => a.name.toLowerCase());
  const hit = cb.recent.filter((m) => m.dir === 'in' && m.kind === 'text' && m.at <= nowMs && mineChats.has(m.chatId)).sort((x, y) => y.at - x.at)
    .map((m) => ({ m, w: /do you have (?:an? |any )?([^?]+)\?/i.exec(m.body) }))
    .find((x) => x.w && !b.items.some((i) => x.w && i.name.toLowerCase().includes(x.w[1].toLowerCase().split(/[ ,]/)[0])) && !asked.some((a) => x.w && a.startsWith(x.w[1].toLowerCase().replace(/,/g, '').slice(0, 10))));
  if (!hit || !hit.w) return { name: '' };
  const words = hit.w[1].replace(/,/g, '').trim(), n = /need (\d+)/i.exec(hit.m.body);
  const c = mineChats.get(hit.m.chatId);
  return { name: words[0].toUpperCase() + words.slice(1), qty: n ? Number(n[1]) : 1, customerId: c ? c.customerId : null, chatId: hit.m.chatId, quote: { body: hit.m.body, at: hit.m.at } };
}

/** An ask being written while Grace picks another customer ("Change customer"): what she typed, and its photo. */
let held: (AskPrefill & { photo?: { file: File; url: string } | null }) | null = null;

/**
 * Open Ask Moses. After "Change customer", Sell opens it again with only the customer picked
 * (ROUTES `sell { then: 'ask' }`): what was typed comes back with them.
 */
export function openAsk(pre: Partial<AskPrefill>): void {
  const was = held;
  held = null;
  const full = { ...(was || { name: '' }), ...Object.fromEntries(Object.entries(pre).filter(([, v]) => v !== undefined)) } as AskPrefill & { photo?: { file: File; url: string } | null };
  if (was && pre.customerId !== undefined && pre.customerId !== was.customerId) { full.chatId = null; full.quote = null; }
  sheet.open(() => <AskSheet pre={full} />, { label: 'Ask Moses' });
}

function AskSheet(p: { pre: AskPrefill & { photo?: { file: File; url: string } | null } }): JSX.Element {
  const b = books.value as Books, ml = b.members.find((m) => m.role === 'sourcing'), rn = b.members.find((m) => m.role === 'manager');
  const [name, setName] = useState(p.pre.name), [qty, setQty] = useState(p.pre.qty || 1), [state, setState] = useState<'idle' | 'sending' | 'kept'>('idle');
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(p.pre.photo || null);
  const c = p.pre.customerId ? b.customers.find((x) => x.id === p.pre.customerId) : null, who = c ? firstWord(c.name) : '';
  const mlName = ml ? firstWord(ml.name) : 'Sourcing';
  const send = async () => {
    if (!name.trim()) return;
    setState('sending');
    try {
      const r = await act('askSourcing', { name: name.trim(), qty, customerId: c ? c.id : null, chatId: p.pre.chatId ?? null, photo: photo ? photo.file : null });
      if (r.kept) { setState('kept'); return; }
      sheet.close();
      toast.show(`Asked ${mlName}`);
    } catch (e) {
      setState('idle');
      toast.show('Not sent', { kind: 'error', sub: isDataError(e) ? e.message : String(e), retry: () => { void send(); } });
    }
  };
  return (
    <div class={'td-sheet td-asknew' + (state === 'kept' ? ' kept' : '')}>
      <span aria-hidden="true" class="td-sheet-grab" />
      <div class="td-sheet-h">
        <span class="td-sheet-ht"><span>Something we don’t sell</span><h2>{`Ask ${mlName}`}</h2></span>
        <button type="button" class="ow-x-tile" aria-label="Close" onClick={() => sheet.close()}><Icon name="close" size={16} stroke={2.2} /></button>
      </div>
      <div class="td-sheet-b td-asknew-b">
        {p.pre.quote && c && (
          <div class="td-asknew-q">
            <span><Avatar initials={c.initials} tint={c.tint} size={20} style={PLAIN} />{`${who} · in their chat · `}<span class="mono">{clock(p.pre.quote.at)}</span></span>
            <div>{p.pre.quote.body}</div>
          </div>
        )}
        <label class="td-asknew-f"><span>What they want</span>
          <span><input type="text" value={name} aria-label="What they want" onInput={(e) => setName((e.target as HTMLInputElement).value)} /></span></label>
        <div class="td-asknew-n"><span>How many</span><Stepper value={qty} unit="pieces" min={1} onChange={setQty} /></div>
        {c && (
          <div class="td-asknew-who"><span>Who asked</span>
            <button type="button" aria-label={`${c.name}. Change customer`} onClick={() => { held = { ...p.pre, name, qty, photo }; sheet.close(); go('sell', { then: 'ask' }); }}>
              <Avatar initials={c.initials} tint={c.tint} size={38} />
              <span><span>{c.name}</span><span>{p.pre.quote ? `from their chat · ${clock(p.pre.quote.at)}` : c.place}</span></span>
              <Duo i={phSwap} size={18} color="#5F6980" />
            </button>
          </div>
        )}
        <div class="td-asknew-ph">
          <label class="td-asknew-pic" aria-label="Add a photo">
            {photo ? <img src={photo.url} alt="" /> : <><Icon name="camera" size={22} stroke={1.8} />Photo</>}
            <input type="file" accept="image/*" capture="environment" onChange={(e) => { const f = (e.target as HTMLInputElement).files; if (f && f[0]) setPhoto({ file: f[0], url: URL.createObjectURL(f[0]) }); }} />
          </label>
          <span class="td-asknew-next">
            {ml && <span><Avatar initials={ml.initials} tint={ml.tint} size={22} style={PLAIN} />{`${mlName} looks for it`}</span>}
            {rn && <span><Avatar initials={rn.initials} tint={rn.tint} size={22} style={PLAIN} />{`${firstWord(rn.name)} sets the price`}</span>}
            <span><Avatar initials={b.me.initials} tint="me" size={22} style={PLAIN} />{`you tell ${who || 'them'}`}</span>
          </span>
        </div>
        {state === 'kept' && (
          <Notice kind="offline" class="td-asknew-ns" action={{ label: 'Try again', on: () => { void flush(); } }}>No signal · not sent yet, kept on this phone</Notice>
        )}
        <div class="td-asknew-go">
          {state === 'kept'
            ? <Button icon="check" stroke={2.6} onClick={() => sheet.close()}>Done · it sends itself</Button>
            : <Button icon="send" state={state === 'sending' ? 'sending' : name.trim() ? 'idle' : 'disabled'} onClick={() => { void send(); }}>{`Ask ${mlName}`}</Button>}
        </div>
      </div>
    </div>
  );
}
