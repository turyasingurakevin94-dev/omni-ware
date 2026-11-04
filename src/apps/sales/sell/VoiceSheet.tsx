/*
 * SL10 · say it: the phone listens (the browser's speech recognition), the
 * words come back with what was understood marked, each item read with its
 * count, and one tap adds them all ("Add both · 1,712,000"). While it
 * listens (SL34) Add waits. Words with no item in them go into Add an item,
 * where the find shows the closest (SL09). In the demo the phone hears the
 * sample shop's own sentence (seed/extra/sell.ts) after 1.2 s. The sheet itself is the shared listening
 * part (src/ui/Listen.tsx); only what was understood is Sell's.
 */
import type { JSX } from 'preact';
import type { Books, Item } from '../../../core/types.ts';
import { Icon } from '../../../ui/icons.tsx';
import { ListenSheet, hasSpeech } from '../../../ui/Listen.tsx';
import { ItemSquare } from '../../../ui/ItemSquare.tsx';
import { fig, isPriced, PRICE_COMING } from '../../../ui/Money.tsx';
import { sheet } from '../../../ui/sheet.tsx';
import { toast } from '../../../ui/toast.tsx';
import { books, isDemo, now } from '../shell/store.ts';
import { findItems, readSaid } from '../../../core/find.ts';
import { rankFor } from './insights.ts';
import { add, cur, query } from './model.ts';
import './voice.css';

const UNITS = /^(cartons?|ctns?|bags?|pcs?|pieces?|kgs?|tins?|pairs?|boxes|box|inch|in)$/i;
const NUMS = /^(\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty|thirty|forty|fifty|sixty|hundred)$/i;

type Heard = { it: Item; qty: number; unit: string };

function understand(b: Books, text: string): Heard[] {
  const x = cur.value, c = x && x.customerId ? b.customers.find((y) => y.id === x.customerId) : null;
  return readSaid(text).map((a) => {
    const it = findItems(b, a, rankFor(b, c || null, now.value))[0];
    return it ? { it, qty: a.qty || 1, unit: a.unit || it.unit } : null;
  }).filter((h): h is Heard => !!h && h.it.price != null);
}

/** Their words, with the counts, the units and what the item is marked. */
function Said(p: { text: string; heard: Heard[] }): JSX.Element {
  const nouns = new Set(p.heard.flatMap((h) => h.it.name.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3).map((w) => w.replace(/s$/, ''))));
  const keep = (w: string) => NUMS.test(w) || UNITS.test(w) || nouns.has(w.toLowerCase().replace(/s$/, ''));
  // Each word read is marked; a size stays with its word ("four inch nails").
  const out: (string | JSX.Element)[] = [];
  let run: string[] = [], last = '';
  const flush = () => { if (run.length) out.push(<mark key={out.length}>{run.join(' ')}</mark>); run = []; };
  p.text.split(/\s+/).forEach((w, i) => {
    const k = keep(w), join = k && run.length > 0 && (w === 'inch' || last === 'inch');
    if (!join) { flush(); if (i) out.push(' '); }
    if (k) run.push(w); else out.push(w);
    last = k ? w : '';
  });
  flush();
  return <p class="ow-listen-said sl-said" aria-live="polite">“{out}”</p>;
}

/** What the demo's phone hears (seed/extra/sell.ts), or nothing on a real phone. */
const demoSaid = (): string | undefined => (isDemo ? (globalThis as { owDemoVoice?: string }).owDemoVoice : undefined);

/** Whether Say it can open: the phone listens, or the demo says the sample sentence. */
export function canListen(): boolean {
  if (demoSaid() || hasSpeech()) return true;
  toast.show('This phone cannot listen', { kind: 'warn', sub: 'Type the item instead' });
  return false;
}

export function VoiceSheet(): JSX.Element | null {
  const b = books.value;
  if (!b) return null;
  const heardOf = (text: string) => (text ? understand(b, text) : []);
  const word = (n: number) => (n === 2 ? 'Add both' : n === 1 ? 'Add it' : n ? `Add ${n}` : 'Add');
  return (
    <ListenSheet hold demo={demoSaid()}
      // Said, but no item in it: the words go into Add an item, where the find shows the closest (SL09).
      onHeard={(text) => { if (text && !heardOf(text).length) { query.value = text; sheet.close(); } }}
      ready={(text) => heardOf(text).length > 0}
      onDone={(text) => heardOf(text).forEach((h) => add(h.it, h.qty))}
      act={(text) => {
        const heard = heardOf(text), total = heard.reduce((s, h) => s + h.qty * (h.it.price || 0), 0);
        return heard.length ? <>{`${word(heard.length)} · `}<span class="mono">{fig(total)}</span></> : word(0);
      }}
      said={(text) => <Said text={text} heard={heardOf(text)} />}>
      {(text) => {
        const heard = heardOf(text);
        return heard.length > 0 && (
          <div class="sl-heard">
            {heard.map((h) => (
              <div class="sl-heard-r" key={h.it.id}>
                <span class="sl-heard-sq"><ItemSquare aisle={h.it.aisle} size={38} icon={22} /></span>
                <span class="sl-heard-t"><span>{h.it.name}</span><span class="mono">{isPriced(h.it.price) ? fig(h.qty * h.it.price) : PRICE_COMING}{(h.it.onShelf || 0) > 0 && <span class="sl-heard-s"><b>{h.it.onShelf}</b> on shelf</span>}</span></span>
                <span class="mono sl-heard-n">{`×${h.qty}${h.unit !== 'pc' && h.unit !== h.it.unit ? ` ${h.unit}` : h.it.unit !== 'pc' ? ` ${h.it.unit}` : ''}`}</span>
                <span role="img" aria-label="Understood" class="sl-heard-ok"><Icon name="check" size={13} stroke={3.2} /></span>
              </div>
            ))}
          </div>
        );
      }}
    </ListenSheet>
  );
}
