/*
 * P20 · The item check list, "What Kato gets" (LANGUAGE.md §3 P20; as
 * built: OR07): one row per line, its mark saying where it is: confirmed
 * (a green tick, and when), checking or packing (an amber ring and the
 * word), waiting (a dashed disc), short ("32/60"), dropped (crimson ×, the
 * line struck through). The header counts it as a little bar.
 *
 *   <CheckList title="What Kato gets" bar={['#0F6B43', '#F5B26B']} summary="1 of 2 packed" lines={[
 *     { aisle: 'Roofing', name: 'Iron sheet G28 · 3m', qty: 40, unit: 'pc', amount: 1520000, mark: 'confirmed', at: '10:30', markLabel: 'Packed at 10:30' },
 *     { aisle: 'Tools', name: 'Wheelbarrow, heavy duty', qty: 2, unit: 'pc', amount: 290000, mark: 'checking', word: 'packing', markLabel: 'Packing now' },
 *     { aisle: 'Doors & locks', name: 'Soft close hinge · flat', qty: 10, unit: 'pair', note: 'not found', mark: 'dropped', markLabel: 'Not found' }]} />
 */
import type { JSX } from 'preact';
import { Icon } from './icons.tsx';
import { ItemSquare } from './ItemSquare.tsx';
import { fig } from './Money.tsx';
import { cx, type Fig } from './util.tsx';
import './checklist.css';

export type CheckMark = 'confirmed' | 'checking' | 'waiting' | 'short' | 'dropped';

export interface CheckLine {
  aisle: string;
  name: string;
  qty: Fig;
  unit: string;
  amount?: Fig;
  /** Instead of the amount ("not found"). */
  note?: string;
  mark: CheckMark;
  /** confirmed: when ("10:30"). */
  at?: string;
  /** checking: the word before the ring ("checking", "packing"). */
  word?: string;
  /** short: "32/60". */
  got?: string;
  markLabel: string;
}

function Mark(l: CheckLine): JSX.Element {
  switch (l.mark) {
    case 'confirmed':
      return <span class="ow-chk-m">{l.at && <span class="mono ow-chk-at">{l.at}</span>}<span role="img" aria-label={l.markLabel} class="ow-chk-d ok"><Icon name="check" size={13} stroke={3.2} /></span></span>;
    case 'checking':
      return <span class="ow-chk-m"><span class="ow-chk-w">{l.word || 'checking'}</span><span role="img" aria-label={l.markLabel} class="ow-chk-d spin" /></span>;
    case 'short':
      return <span class="ow-chk-m"><span class="mono ow-chk-w">{l.got}</span><span role="img" aria-label={l.markLabel} class="ow-chk-d short" /></span>;
    case 'dropped':
      return <span role="img" aria-label={l.markLabel} class="ow-chk-d no"><Icon name="close" size={11} stroke={3.4} /></span>;
    default:
      return <span role="img" aria-label={l.markLabel} class="ow-chk-d wait" />;
  }
}

export interface CheckListProps {
  title: string;
  /** One little pill per counted line, its tone (#0F6B43 done, #F5B26B on its way). */
  bar?: string[];
  summary?: string;
  lines: CheckLine[];
}

export function CheckList(p: CheckListProps): JSX.Element {
  return (
    <div class="ow-chk">
      <div class="ow-chk-h">
        <span class="ow-chk-title">{p.title}</span>
        {(p.bar || p.summary) && (
          <span class="ow-chk-sum">
            {p.bar && <span aria-hidden="true" class="ow-chk-bar">{p.bar.map((c, i) => <span key={i} style={{ background: c }} />)}</span>}
            {p.summary && <span class="mono">{p.summary}</span>}
          </span>
        )}
      </div>
      {p.lines.map((l, i) => {
        const gone = l.mark === 'dropped';
        return (
          <div key={i} class={cx('ow-chk-row', gone && 'gone')}>
            <ItemSquare aisle={l.aisle} size={34} radius={9} icon={20} dropped={gone} />
            <span class="ow-chk-t">
              <span class="ow-chk-n">{l.name}</span>
              <span class="mono ow-chk-s">{`${fig(l.qty)} `}<span class="ow-word">{l.unit}</span>{` · ${l.note || (l.amount != null ? fig(l.amount) : '')}`}</span>
            </span>
            {Mark(l)}
          </div>
        );
      })}
    </div>
  );
}
