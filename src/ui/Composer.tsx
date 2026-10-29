/*
 * S01 · The composer (LANGUAGE.md §5.2 S01): white, 72 tall, the hairline
 * on top. A 44 px note toggle (a team note, never sent to the customer),
 * the field with attach inside, and a 44 px disc: navy Send when there is
 * text, the green mic when empty. Enter sends.
 *
 *   <Composer to="Kato" toName="Kato Construction" value={text} onInput={setText} onSend={send} onNote={toggle} onAttach={…} onMic={…} />
 *   note: the field writes a team note (sand); sending: the disc waits.
 */
import type { JSX } from 'preact';
import { Duo, Icon, phMic } from './icons.tsx';
import { cx } from './util.tsx';
import './composer.css';

export interface ComposerProps {
  /** "Kato": the placeholder says "Message Kato". */
  to: string;
  /** The field's aria-label: "Message Kato Construction". */
  toName: string;
  value: string;
  onInput: (v: string) => void;
  onSend: (v: string) => void;
  onNote?: () => void;
  /** Writing a team note. */
  note?: boolean;
  onAttach?: () => void;
  onMic?: () => void;
  sending?: boolean;
  /** The 24-hour window is shut: a plain message cannot go (CH13). */
  disabled?: boolean;
}

export function Composer(p: ComposerProps): JSX.Element {
  const has = p.value.trim().length > 0;
  const send = () => { if (has && !p.sending) p.onSend(p.value); };
  return (
    <div class={cx('ow-composer', p.note && 'note')}>
      {p.onNote && <button type="button" class={cx('ow-comp-note', p.note && 'on')} aria-label={p.note ? 'Write a message instead' : 'Write a team note'} aria-pressed={!!p.note} onClick={p.onNote}><Icon name="note" size={18} stroke={2} /></button>}
      <label class="ow-comp-field">
        <input type="text" value={p.value} disabled={p.disabled} placeholder={p.note ? 'A note for the team' : `Message ${p.to}`} aria-label={p.note ? 'Team note' : `Message ${p.toName}`}
          onInput={(e) => p.onInput((e.target as HTMLInputElement).value)} onKeyDown={(e) => { if (e.key === 'Enter') send(); }} />
        {p.onAttach && <button type="button" class="ow-comp-attach" aria-label="Attach" onClick={p.onAttach}><Icon name="attach" size={18} stroke={2} /></button>}
      </label>
      {has || !p.onMic
        ? <button type="button" class="ow-comp-send" aria-label="Send" disabled={p.disabled} aria-busy={p.sending || undefined} onClick={send}>{p.sending ? <span class="ow-spin" /> : <Icon name="send" size={18} stroke={2} />}</button>
        : <button type="button" class="ow-comp-send mic" aria-label="Say it" onClick={p.onMic}><Duo i={phMic} size={18} color="#FFFFFF" /></button>}
    </div>
  );
}
