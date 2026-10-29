/*
 * S04 · The hand-over person picker (LANGUAGE.md §5.2 S04): who is free,
 * as a load bar. Teammates in a group card, 60 px rows: the avatar with its
 * presence dot (green on, grey away), the name, the load in words, a load
 * bar (green light, amber heavy), and a radio. The phone's owner is first,
 * "You", with a "has it" chip in place of the radio (they cannot be picked).
 * Under it the caller puts the note field and the navy "Give to Brian".
 *
 *   <PersonPicker name="to" value={to} onChange={setTo} people={[
 *     { id: 'GA', face: { initials: 'GA', tint: 'me' }, name: 'Grace Akello', line: 'You · 6 chats · 2 waiting', load: 33, heavy: true, presence: 'on', self: true },
 *     { id: 'BO', face: { initials: 'BO', tint: 't3' }, name: 'Brian Ouma', line: '9 chats · none waiting', load: 30, presence: 'on' }, …]} />
 */
import type { JSX } from 'preact';
import { Avatar, type Face } from './Avatar.tsx';
import { Meter } from './Bar.tsx';
import { GroupCard } from './ActRow.tsx';
import { Icon } from './icons.tsx';
import './personpicker.css';

export interface Person {
  id: string;
  face: Face;
  name: string;
  /** "9 chats · none waiting" ("away" said in it when away). */
  line: string;
  /** How full their hands are, 0 to 100. */
  load: number;
  heavy?: boolean;
  presence: 'on' | 'away';
  self?: boolean;
}

export function PersonPicker(p: { people: Person[]; value: string | null; onChange: (id: string) => void; name?: string }): JSX.Element {
  return (
    <GroupCard pad={14} class="ow-people">
      {p.people.map((x) => {
        const on = p.value === x.id;
        return (
          <label key={x.id} class="ow-person">
            <span class="ow-person-av"><Avatar {...x.face} size={40} /><span aria-hidden="true" class={'ow-person-dot ' + x.presence} /></span>
            <span class="ow-person-t"><span>{x.name}</span><span>{x.line}</span></span>
            <Meter pct={x.load} w={48} h={6} fill={x.heavy ? '#95530C' : '#0F6B43'} />
            <input type="radio" name={p.name || 'to'} checked={on} disabled={x.self} aria-label={x.name} class="ow-person-radio" onChange={() => p.onChange(x.id)} />
            {x.self ? <span class="ow-person-has">has it</span>
              : <span aria-hidden="true" class={'ow-person-mark' + (on ? ' on' : '')}>{on && <Icon name="check" size={13} stroke={3} />}</span>}
          </label>
        );
      })}
    </GroupCard>
  );
}
