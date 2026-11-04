/*
 * The chat composer in the chat boards' measures (S01; local until the lead folds it into
 * src/ui/Composer): the note toggle, the field with the + of prices, photos and the catalogue,
 * and one disc: the green mic ("Say it") when the box is empty, navy Send when it has words.
 *   note       a team note: the field and the toggle sand, Send saves the note
 *   shut       the 24-hour window is shut: words go as the shop's message (the lock on Send), photos wait
 *   listening  CH16: the strip says "Listening" with SL10's waveform; the words go into the box as they
 *              are heard, the newest in view with the caret; the disc is Stop
 * The mic writes what is said into the box (the phone's own listening); WhatsApp voice notes have
 * no road through wa-send yet. A phone that cannot listen, or a word not heard, puts the cursor in
 * the box (as TD11 does): no toast.
 */
import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { HEARD, readFlags } from '../../../core/demo/flags.ts';
import { Icon } from '../../../ui/icons.tsx';

export interface ComposerProps {
  to: string;
  toName: string;
  value: string;
  onInput: (v: string) => void;
  onSend: () => void;
  note: boolean;
  onNote: () => void;
  shut: boolean;
  onAdd: () => void;
  sending: boolean;
  /** Told when listening starts and stops (the chat hides its quick replies meanwhile). */
  onListen?: (on: boolean) => void;
}

type Rec = {
  lang: string; interimResults: boolean;
  onresult: (e: { results: ArrayLike<{ 0: { transcript: string } }> }) => void;
  onerror: () => void; onend: () => void; start: () => void; stop: () => void;
};

const flags = readFlags(typeof location === 'undefined' ? '' : location.search);
/** SL10's waveform heights (3 px bars, 3 px apart); the last ones are still to come. */
const WAVE = [6, 9, 12, 8, 15, 19, 11, 21, 16, 10, 22, 14, 19, 12, 8, 16, 20, 11, 7, 13, 9, 6, 4, 4, 4, 4];

export function ChatComposer(p: ComposerProps): JSX.Element {
  const has = p.value.trim().length > 0, field = useRef<HTMLInputElement>(null);
  const [listening, setListening] = useState(false);
  const rec = useRef<Rec | null>(null);
  const on = (b: boolean) => { setListening(b); if (p.onListen) p.onListen(b); };
  const type = () => { on(false); setTimeout(() => field.current?.focus(), 0); };
  useEffect(() => () => { if (rec.current) rec.current.stop(); }, []);

  const listen = () => {
    const base = p.value ? p.value + ' ' : '';
    if (flags.on && flags.listen) { on(true); p.onInput(base + HEARD); return; }
    const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    const R = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!R) { type(); return; }
    const r = new R();
    r.lang = 'en-UG'; r.interimResults = true;
    r.onresult = (e) => p.onInput(base + Array.from(e.results).map((x) => x[0].transcript).join(''));
    r.onerror = () => { rec.current = null; type(); };
    r.onend = () => { if (rec.current === r) { rec.current = null; on(false); } };
    rec.current = r;
    try { r.start(); on(true); } catch (_e) { rec.current = null; type(); }
  };
  const stop = () => { const r = rec.current; rec.current = null; if (r) r.stop(); type(); };

  return (
    <>
      {listening && (
        <div role="status" class="ch-cv-listen">
          <Icon name="mic" size={16} stroke={2.2} /><span>Listening</span>
          <span aria-hidden="true">{WAVE.map((h, k) => <i key={k} class={k >= 20 ? 'to' : undefined} style={{ height: `${h}px` }} />)}</span>
        </div>
      )}
      <div class="ch-cv-comp">
        <button type="button" class={'note' + (p.note ? ' on' : '')} aria-label={p.note ? 'Write a message instead' : 'Write a team note'} aria-pressed={p.note} onClick={p.onNote}>
          <Icon name="note" size={18} stroke={2} />
        </button>
        <label class={'ch-cv-field' + (p.note ? ' note' : '')}>
          {listening
            ? <span role="textbox" aria-readonly="true" aria-label={`Message ${p.toName}`} class="ch-cv-heard"><span>{p.value}</span><i aria-hidden="true" /></span>
            : <input ref={field} type="text" value={p.value} placeholder={p.note ? '' : `Message ${p.to}`} aria-label={p.note ? 'Team note' : `Message ${p.toName}`}
              onInput={(e) => p.onInput((e.target as HTMLInputElement).value)} onKeyDown={(e) => { if (e.key === 'Enter' && has) p.onSend(); }} />}
          {!p.note && (p.shut
            ? <span aria-hidden="true"><Icon name="attach" size={19} stroke={2} /></span>
            : <button type="button" aria-label="Send a price, a photo, the catalogue" onClick={p.onAdd}><Icon name="attach" size={19} stroke={2} /></button>)}
        </label>
        {listening ? (
          <button type="button" class="stop" aria-label="Stop listening" onClick={stop}><span aria-hidden="true" /></button>
        ) : has || p.note || p.shut ? (
          <button type="button" class="send" aria-label={p.note ? 'Save the note' : p.shut ? 'Send as the shop’s message' : 'Send'} aria-busy={p.sending || undefined}
            disabled={!has} onClick={() => { if (has && !p.sending) p.onSend(); }}>
            {p.sending ? <span class="ow-spin" /> : <Icon name="send" size={18} stroke={2} />}
            {p.shut && !p.note && <i aria-hidden="true"><Icon name="lock" size={11} stroke={2.4} /></i>}
          </button>
        ) : (
          <button type="button" class="mic" aria-label="Say it" onClick={listen}>
            <Icon name="mic" size={18} stroke={2} />
          </button>
        )}
      </div>
    </>
  );
}
