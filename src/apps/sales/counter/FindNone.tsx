/*
 * KC21 · Nothing called "tile cutter": the closest the shelf has (one tap adds one), and Sourcing's
 * open ask for it: where it stands, and "Add this walk-in" (askSourcing adds the request to the open
 * lead, as sales.html does). KC26 · nobody has asked: "Ask Moses to stock it". KC25 · sent:
 * "Sent to Moses · just now", the button gone.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Duo, Icon, phPlane, phSearch, type IconName } from '../../../ui/icons.tsx';
import { ItemSquare } from '../../../ui/ItemSquare.tsx';
import { fig } from '../../../ui/Money.tsx';
import { toast } from '../../../ui/toast.tsx';
import { closest, readAsk } from '../../../core/find.ts';
import { weekday } from '../../../core/time.ts';
import type { Books, Item, SourcingAsk } from '../../../core/types.ts';
import { act, now } from '../shell/store.ts';
import { shopAisles } from '../today/data.ts';
import { sale, set } from './state.ts';
import './findnone.css';

/** The closest (core/find.ts, the one rule SL09 uses): what is on the shelf, two at most. */
const near = (b: Books, words: string): Item[] => closest(b, readAsk(words), 2, (it) => (it.onShelf || 0) > 0 && it.price != null);

const STEPS: { status: SourcingAsk['status']; word: string; icon: IconName }[] = [
  { status: 'asked', word: 'Asked', icon: 'clock' }, { status: 'looking', word: 'Looking', icon: 'search' },
  { status: 'found', word: 'Found', icon: 'search' }, { status: 'priced', word: 'Priced', icon: 'tag' }, { status: 'listed', word: 'Listed', icon: 'store' },
];

/** Where the ask stands, in words: "Moses found it · Ruth prices it". */
function standing(a: SourcingAsk, moses: string, ruth: string): string {
  if (a.status === 'asked') return `Asked · ${moses} looks for it`;
  if (a.status === 'looking') return `${moses} is looking`;
  if (a.status === 'found') return `${moses} found it · ${ruth} prices it`;
  return `${ruth} priced it · ${moses} lists it`;
}

/** Found: the magnifier with a tick (TD21). */
const found = (n: number) => <svg width={n} height={n} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2M8.3 11.2l1.9 1.9 3.4-3.6" /></svg>;

/** The five steps on navy (TD21's dot row), the one it is at in mint. */
function Dots(p: { a: SourcingAsk }): JSX.Element {
  const at = STEPS.findIndex((s) => s.status === p.a.status);
  return (
    <div class="kc-dots">
      <div role="img" aria-label={`${STEPS[at].word}: step ${at + 1} of 5`} class="kc-dots-r">
        <span aria-hidden="true" class="rail" /><span aria-hidden="true" class="fill" style={{ width: `${at * 20}%` }} />
        {STEPS.map((s, i) => (
          <span key={s.status} class={i < at ? 'done' : i === at ? 'now' : 'next'}>
            {i < at ? <Icon name="check" size={12} stroke={2.8} /> : s.status === 'found' ? found(i === at ? 16 : 12) : <Icon name={s.icon} size={i === at ? 16 : 12} stroke={2.2} />}
          </span>
        ))}
      </div>
      <div class="kc-dots-l">
        {STEPS.map((s, i) => (
          <span key={s.status} class={i < at ? 'done' : i === at ? 'now' : ''}>
            <b>{s.word}</b>
            <em class="mono">{i === 0 ? weekday(p.a.createdAt) : i === at ? weekday(p.a.stageAt) : ''}</em>
          </span>
        ))}
      </div>
    </div>
  );
}

export function FindNone(p: { b: Books; words: string; qty: number; customer: string | null; who: string; onAdd: (it: Item) => void; onAisle: (name: string) => void }): JSX.Element {
  const [busy, setBusy] = useState(false);
  const w = p.words.trim(), close = near(p.b, w), lw = w.toLowerCase();
  // An ask Sourcing has open with these words: this walk-in's request is added to it.
  const ask = p.b.asks.find((a) => a.status !== 'dropped' && a.status !== 'listed' && a.name.toLowerCase().includes(lw));
  const name = ask ? ask.name : w;
  // Asked once per sale: what this sale sent is shown sent (KC25), never asked again.
  const sent = sale.value.asked.includes(name.toLowerCase());
  const [count, setCount] = useState(0);
  const moses = p.b.members.find((m) => m.role === 'sourcing'), first = moses ? moses.name.split(' ')[0] : 'Sourcing';
  const ruth = p.b.members.find((m) => m.role === 'manager'), ruthFirst = ruth ? ruth.name.split(' ')[0] : 'the Manager';
  const send = async () => {
    if (busy || sent) return;
    setBusy(true);
    try {
      const r = await act<SourcingAsk>('askSourcing', { name, qty: p.qty, customerId: p.customer, chatId: null });
      setCount(r.kept ? (ask ? ask.requests.length + 1 : 1) : r.value.requests.length);
      set({ asked: [...sale.peek().asked, name.toLowerCase()] });
    } catch (e) {
      toast.show('Not sent', { kind: 'error', sub: (e as Error).message });
    } finally { setBusy(false); }
  };
  const foot = sent ? (
    <div role="status" class="kc-sent">
      <span aria-hidden="true"><Icon name="check" size={14} stroke={3.2} /></span>
      <b>{`Sent to ${first} · just now`}</b>
      <span>{`${count || (ask ? ask.requests.length : 1)} asked`}</span>
    </div>
  ) : (
    <div class="kc-askm-o">
      <span class="mono">{p.qty}<span class="ow-word">pc</span></span>
      <button type="button" class="kc-askm-go" disabled={busy} onClick={() => void send()}>
        {ask ? <><Icon name="plus" size={17} stroke={2.6} />Add this walk-in</> : <><Icon name="send" size={17} stroke={2.2} />{`Send to ${first}`}</>}
      </button>
    </div>
  );
  return (
    <>
      <div class="kc-none">
        <span aria-hidden="true" class="kc-none-i"><Duo i={phSearch} size={26} color="#5F6980" /><span>?</span></span>
        <span class="kc-none-t"><b>{`Nothing called “${w}”`}</b><span>{`The shop doesn’t sell a ${w}`}</span></span>
      </div>
      {!!close.length && (
        <div class="kc-near">
          <span class="kc-near-k">Closest in the shop</span>
          {close.map((it) => (
            <div key={it.id} class="kc-near-r">
              <ItemSquare aisle={it.aisle} size={40} />
              <span class="kc-near-t">
                <span class="n">{it.name}</span>
                <span class="s"><span class="mono">{fig(it.price || 0)}</span><span class="u">{`/${it.unit}`}</span><span class="kc-near-sh"><b class="mono">{fig(it.onShelf || 0)}</b>on shelf</span></span>
              </span>
              <button type="button" class="kc-near-a" aria-label={`Add ${it.name}`} onClick={() => p.onAdd(it)}><Icon name="plus" size={16} stroke={2.6} /></button>
            </div>
          ))}
        </div>
      )}
      <div class="kc-askm">
        {ask ? (
          <>
            <div class="kc-askm-h">
              {moses ? <Avatar initials={moses.initials} tint={moses.tint} size={40} /> : <span />}
              <span><b>{ask.name}</b><span>{standing(ask, first, ruthFirst)}</span></span>
            </div>
            <Dots a={ask} />
          </>
        ) : (
          <div class="kc-askm-h">
            <span aria-hidden="true" class="plane"><Duo i={phPlane} size={22} color="#6FDCB0" /></span>
            <span><b>{`Ask ${first} to stock it`}</b><span>{`${name} · for ${p.who}`}</span></span>
          </div>
        )}
        {foot}
      </div>
      <OpenAisle b={p.b} near={close} onAisle={p.onAisle} />
    </>
  );
}

/**
 * "Or open an aisle" (TD14's tiles; KC26, KC28): the closest item's aisle first, then the shop's aisles in
 * the shop's order (today/data.ts shopAisles over Books.aisles), three. Shown where one close item or none
 * leaves the room (KC21's two close items fill it).
 */
function OpenAisle(p: { b: Books; near: Item[]; onAisle: (name: string) => void }): JSX.Element | null {
  const all = shopAisles(p.b, now.value), own = p.near[0] ? all.find((a) => a.name === p.near[0].aisle) : undefined;
  const tiles = [...(own ? [own] : []), ...all.filter((a) => a !== own)].slice(0, 3);
  if (!tiles.length) return null;
  return (
    <>
      <div class="kc-aisles-h">Or open an aisle</div>
      <div class="kc-aisles">
        {tiles.map((a) => (
          <a key={a.name} href="#" class="kc-aisle" onClick={(e) => { e.preventDefault(); p.onAisle(a.name); }}>
            <ItemSquare aisle={a.name} size={38} icon={22} />
            <span><span>{a.name}</span><span class="mono">{`${a.count} items`}</span></span>
          </a>
        ))}
      </div>
    </>
  );
}
