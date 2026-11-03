/*
 * The chat composer in the chat boards' measures (S01; local until the lead folds it into
 * src/ui/Composer): the note toggle, the field with the + of prices, photos and the catalogue,
 * and one disc: the green mic when the box is empty, navy Send when it has words.
 *   note   a team note: the field and the toggle sand, Send saves the note
 *   shut   the 24-hour window is shut: words go as the shop's message (the lock on Send), photos wait
 * The mic writes what is said into the box (the phone's own listening); WhatsApp voice notes have
 * no road through wa-send yet.
 */
import type { JSX } from 'preact';
import { useRef } from 'preact/hooks';
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
}

type Rec = { lang: string; interimResults: boolean; onresult: (e: { results: { 0: { transcript: string } }[] }) => void; onerror: () => void; start: () => void };

/** Say it: what is said goes into the box. A phone that cannot listen, or a word not heard, puts the cursor in the box instead (as TD11 does): no toast. */
function listen(into: (t: string) => void, type: () => void): void {
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  const R = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!R) { type(); return; }
  const r = new R();
  r.lang = 'en-UG'; r.interimResults = false;
  r.onresult = (e) => into(e.results[0][0].transcript);
  r.onerror = type;
  try { r.start(); } catch (_e) { type(); }
}

export function ChatComposer(p: ComposerProps): JSX.Element {
  const has = p.value.trim().length > 0, field = useRef<HTMLInputElement>(null);
  return (
    <div class="cv-comp">
      <button type="button" class={'note' + (p.note ? ' on' : '')} aria-label={p.note ? 'Write a message instead' : 'Write a team note'} aria-pressed={p.note} onClick={p.onNote}>
        <Icon name="note" size={18} stroke={2} />
      </button>
      <label class={'cv-field' + (p.note ? ' note' : '')}>
        <input ref={field} type="text" value={p.value} placeholder={p.note ? '' : `Message ${p.to}`} aria-label={p.note ? 'Team note' : `Message ${p.toName}`}
          onInput={(e) => p.onInput((e.target as HTMLInputElement).value)} onKeyDown={(e) => { if (e.key === 'Enter' && has) p.onSend(); }} />
        {!p.note && (p.shut
          ? <span aria-hidden="true"><Icon name="attach" size={19} stroke={2} /></span>
          : <button type="button" aria-label="Send a price, a photo, the catalogue" onClick={p.onAdd}><Icon name="attach" size={19} stroke={2} /></button>)}
      </label>
      {has || p.note || p.shut ? (
        <button type="button" class="send" aria-label={p.note ? 'Save the note' : p.shut ? 'Send as the shop’s message' : 'Send'} aria-busy={p.sending || undefined}
          disabled={!has} onClick={() => { if (has && !p.sending) p.onSend(); }}>
          {p.sending ? <span class="ow-spin" /> : <Icon name="send" size={18} stroke={2} />}
          {p.shut && !p.note && <i aria-hidden="true"><Icon name="lock" size={11} stroke={2.4} /></i>}
        </button>
      ) : (
        <button type="button" class="mic" aria-label="Say it" onClick={() => listen((t) => p.onInput((p.value ? p.value + ' ' : '') + t), () => field.current?.focus())}>
          <Icon name="mic" size={18} stroke={2} />
        </button>
      )}
    </div>
  );
}
