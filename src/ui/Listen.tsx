/*
 * The phone listening (SL34, drawn by Sell; Today's Find and Sell's Say it, SL10, both use it): a navy sheet with
 * the stop button, the waveform, what it heard so far, "Say it again" and one action. The phone's own speech to
 * text; where the phone has none, `hasSpeech()` is false and the caller focuses its field instead (the
 * keyboard's mic is one tap away).
 *
 *   sheet.open(() => <ListenSheet act="Find" onDone={(words) => setQ(words)} />, { label: 'Say it' })
 *
 * A caller that shows what it understood before acting (SL10) passes `hold` (the sheet stays when the phone stops
 * listening), `said` (the words, marked), `children` (what was understood) and `ready` (when the action may go);
 * `demo` is what the demo's phone hears, which has no microphone.
 */
import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Duo, Icon, phMic } from './icons.tsx';
import { sheet } from './sheet.tsx';
import { toast } from './toast.tsx';
import './listen.css';

interface Rec { lang: string; interimResults: boolean; start(): void; stop(): void; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; onerror: (e: { error?: string }) => void }
type RecCtor = new () => Rec;

function recognizer(): RecCtor | null {
  const g = globalThis as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
  return g.SpeechRecognition || g.webkitSpeechRecognition || null;
}

/** Whether this phone can listen (the installed app's WebView often cannot). */
export const hasSpeech = (): boolean => !!recognizer();

/** The waveform as drawn: what was heard in mint, the fading tail in slate. */
const WAVE = [10, 16, 22, 14, 28, 34, 20, 38, 30, 18, 40, 26, 34, 22, 14, 30, 36, 20, 12, 24, 16, 10, 8, 6, 6, 6];

export interface ListenProps {
  /** The action's words, or what to draw for what was heard ("Add both · 1,712,000"). */
  act: string | ((text: string) => ComponentChildren);
  onDone: (words: string) => void;
  /** Keep the sheet open when listening stops, until the action is tapped (SL10). */
  hold?: boolean;
  /** Listening stopped with these words (SL10: words with no item go to the find). */
  onHeard?: (words: string) => void;
  said?: (text: string) => ComponentChildren;
  children?: (text: string, on: boolean) => ComponentChildren;
  ready?: (text: string) => boolean;
  /** What the demo's phone hears, after 1.2 s (no microphone). */
  demo?: string;
}

export function ListenSheet(p: ListenProps): JSX.Element {
  const [text, setText] = useState(''), [on, setOn] = useState(true), rec = useRef<Rec | null>(null);
  const finish = (words: string) => { sheet.close(); if (words.trim()) p.onDone(words.trim()); };
  const heard = (words: string) => { setOn(false); if (p.onHeard) p.onHeard(words.trim()); if (!p.hold && words.trim()) finish(words); };
  const listen = () => {
    const R = recognizer();
    setText(''); setOn(true);
    if (p.demo) { const said = p.demo; window.setTimeout(() => { setText(said); heard(said); }, 1200); return; }
    if (!R) { setOn(false); return; }
    const r = new R();
    rec.current = r;
    let words = '';
    r.lang = 'en-GB'; r.interimResults = true;
    r.onresult = (e) => { words = Array.from(e.results).map((x) => x[0].transcript).join(' '); setText(words); };
    r.onend = () => heard(words);
    r.onerror = (e) => {
      setOn(false);
      if (e && e.error !== 'no-speech' && e.error !== 'aborted') toast.show('This phone could not listen', { kind: 'error', sub: 'Type it instead' });
    };
    try { r.start(); } catch (_e) { setOn(false); }
  };
  useEffect(() => { listen(); return () => { if (rec.current) { try { rec.current.stop(); } catch (_e) { /* already stopped */ } } }; }, []);
  const stop = () => { if (rec.current) { try { rec.current.stop(); } catch (_e) { /* already stopped */ } } setOn(false); };
  const ok = p.ready ? p.ready(text) : !!text.trim();
  return (
    <div class="ow-listen">
      <button type="button" class="ow-listen-grab" aria-label="Close" onClick={sheet.close} />
      <div class="ow-listen-r">
        <button type="button" class="ow-listen-mic" aria-label={on ? 'Stop listening' : 'Listen again'} onClick={() => (on ? stop() : listen())}><Duo i={phMic} size={28} color="#FFFFFF" /></button>
        <span aria-hidden="true" class={'ow-wave' + (on ? ' on' : '')}>{WAVE.map((h, i) => <span key={i} style={{ height: `${h}px` }} class={i >= 20 ? 'tail' : undefined} />)}</span>
      </div>
      {text && p.said ? p.said(text) : <p class={'ow-listen-said' + (text ? '' : ' dim')} aria-live="polite">{text ? `“${text}”` : on ? 'Listening…' : 'Nothing heard'}</p>}
      {p.children && p.children(text, on)}
      <div class="ow-listen-f">
        <button type="button" class="ow-listen-again" aria-label="Say it again" onClick={listen}><Icon name="undo" size={22} stroke={2} /></button>
        <button type="button" class="ow-listen-act" disabled={!ok} onClick={() => finish(text)}>{typeof p.act === 'string' ? p.act : p.act(text)}</button>
      </div>
    </div>
  );
}
