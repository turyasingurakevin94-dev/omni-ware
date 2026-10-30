/*
 * SL10 · say it: the phone listens (the browser's speech recognition), the
 * words come back with what was understood marked, each item read with its
 * count, and one tap adds them all ("Add both · 1,712,000"). In the demo
 * the phone hears the sample shop's own sentence (seed/extra/sell.ts).
 */
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { Books, Item } from '../../../core/types.ts';
import { Duo, Icon, phMic } from '../../../ui/icons.tsx';
import { ItemSquare } from '../../../ui/ItemSquare.tsx';
import { fig } from '../../../ui/Money.tsx';
import { sheet } from '../../../ui/sheet.tsx';
import { toast } from '../../../ui/toast.tsx';
import { books, isDemo } from '../shell/store.ts';
import { findItems, readSaid } from './find.ts';
import { theirItems } from './insights.ts';
import { add, cur } from './model.ts';
import './voice.css';

/** The waveform as drawn: what was heard in mint, the fading tail in slate. */
const WAVE = [10, 16, 22, 14, 28, 34, 20, 38, 30, 18, 40, 26, 34, 22, 14, 30, 36, 20, 12, 24, 16, 10, 8, 6, 6, 6];
const UNITS = /^(cartons?|ctns?|bags?|pcs?|pieces?|kgs?|tins?|pairs?|boxes|box|inch|in)$/i;
const NUMS = /^(\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty|thirty|forty|fifty|sixty|hundred)$/i;

type Heard = { it: Item; qty: number; unit: string };

function understand(b: Books, text: string): Heard[] {
  const x = cur.value, c = x && x.customerId ? b.customers.find((y) => y.id === x.customerId) : null;
  return readSaid(text).map((a) => {
    const it = findItems(b, a, c ? theirItems(b, c) : new Set())[0];
    return it ? { it, qty: a.qty || 1, unit: a.unit || it.unit } : null;
  }).filter((h): h is Heard => !!h && h.it.price != null);
}

/** Their words, with the counts, the units and what the item is marked. */
function Said(p: { text: string; heard: Heard[] }): JSX.Element {
  const nouns = new Set(p.heard.flatMap((h) => h.it.name.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3).map((w) => w.replace(/s$/, ''))));
  const keep = (w: string) => NUMS.test(w) || UNITS.test(w) || nouns.has(w.toLowerCase().replace(/s$/, ''));
  const parts = p.text.split(/(\s+)/), out: (string | JSX.Element)[] = [];
  let run = '';
  const flush = (k: number) => { if (run.trim()) out.push(<mark key={k}>{run.trim()}</mark>, run.endsWith(' ') ? ' ' : ''); run = ''; };
  parts.forEach((t, i) => {
    if (/^\s+$/.test(t)) { if (run) run += t; else out.push(t); return; }
    if (keep(t)) run += t; else { flush(i); out.push(t); }
  });
  flush(parts.length);
  return <p class="sl-said">“{out}”</p>;
}

export function VoiceSheet(): JSX.Element | null {
  const b = books.value, [text, setText] = useState(''), [on, setOn] = useState(true);
  const listen = () => {
    setText(''); setOn(true);
    const demo = isDemo ? (globalThis as { owDemoVoice?: string }).owDemoVoice : undefined;
    if (demo) { window.setTimeout(() => { setText(demo); setOn(false); }, 400); return; }
    const R = (globalThis as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec }).SpeechRecognition
      || (globalThis as unknown as { webkitSpeechRecognition?: new () => SpeechRec }).webkitSpeechRecognition;
    if (!R) { setOn(false); toast.show('This phone cannot listen', { kind: 'warn', sub: 'Type the item instead' }); return; }
    const r = new R();
    r.lang = 'en-GB'; r.interimResults = true;
    r.onresult = (e) => setText(Array.from(e.results).map((x) => x[0].transcript).join(' '));
    r.onend = () => setOn(false);
    r.onerror = () => setOn(false);
    r.start();
  };
  useEffect(listen, []);
  if (!b) return null;
  const heard = text ? understand(b, text) : [];
  const total = heard.reduce((s, h) => s + h.qty * (h.it.price || 0), 0);
  const word = heard.length === 2 ? 'Add both' : heard.length === 1 ? 'Add it' : `Add ${heard.length}`;
  return (
    <div class="sl-voice">
      <button type="button" class="sl-voice-grab" aria-label="Close" onClick={sheet.close} />
      <div class="sl-voice-r">
        <button type="button" class="sl-voice-mic" aria-label={on ? 'Stop listening' : 'Listen again'} onClick={() => (on ? setOn(false) : listen())}><Duo i={phMic} size={28} color="#FFFFFF" /></button>
        <span aria-hidden="true" class={'sl-wave' + (on ? ' on' : '')}>{WAVE.map((h, i) => <span key={i} style={{ height: `${h}px` }} class={i >= 20 ? 'tail' : ''} />)}</span>
      </div>
      {text ? <Said text={text} heard={heard} /> : <p class="sl-said dim">Listening…</p>}
      {heard.length > 0 && (
        <div class="sl-heard">
          {heard.map((h) => (
            <div class="sl-heard-r" key={h.it.id}>
              <span class="sl-heard-sq"><ItemSquare aisle={h.it.aisle} size={38} icon={22} /></span>
              <span class="sl-heard-t"><span>{h.it.name}</span><span class="mono">{fig(h.qty * (h.it.price || 0))}{(h.it.onShelf || 0) > 0 && <span class="sl-heard-s"><b class="mono">{h.it.onShelf}</b> on shelf</span>}</span></span>
              <span class="mono sl-heard-n">{`×${h.qty}${h.unit !== 'pc' && h.unit !== h.it.unit ? ` ${h.unit}` : h.it.unit !== 'pc' ? ` ${h.it.unit}` : ''}`}</span>
              <span role="img" aria-label="Understood" class="sl-heard-ok"><Icon name="check" size={13} stroke={3.2} /></span>
            </div>
          ))}
        </div>
      )}
      <div class="sl-voice-f">
        <button type="button" class="sl-voice-again" aria-label="Say it again" onClick={listen}><Icon name="undo" size={22} stroke={2} /></button>
        <button type="button" class="sl-voice-add" disabled={!heard.length} onClick={() => { heard.forEach((h) => add(h.it, h.qty)); sheet.close(); }}>{`${word} · `}<span class="mono">{fig(total)}</span></button>
      </div>
    </div>
  );
}

interface SpeechRec { lang: string; interimResults: boolean; start(): void; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; onerror: () => void }
