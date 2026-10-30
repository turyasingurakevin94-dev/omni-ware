/*
 * A local variant of P20 (src/ui/CheckList.tsx), for the lead to fold in: the order's boards draw
 * more marks than the part has (Ruth's face in an amber ring for a price she decides, "2 back"
 * for a return, a dashed disc with "on the way · 9:45"), a struck old figure beside the new one,
 * a word after the figure ("Order in", "Price coming"), counted pills in the head (✓ 1  × 1  ↩ 1),
 * and a row that carries a picture under it (the price ladder, OR12).
 */
import type { ComponentChildren, JSX } from 'preact';
import { Avatar, type Face } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { ItemSquare } from '../../../ui/ItemSquare.tsx';
import { fig } from '../../../ui/Money.tsx';
import { cx } from '../../../ui/util.tsx';
import '../../../ui/checklist.css';

export type Mark =
  | { k: 'ok'; at?: string; label: string }
  | { k: 'spin'; word?: string; wordTone?: 'warn' | 'info'; label: string }
  | { k: 'wait'; label: string }
  | { k: 'no'; label: string }
  | { k: 'face'; face: Face; label: string }
  | { k: 'back'; n: number; label: string };

export interface CLine {
  aisle: string;
  name: string;
  qty: number;
  unit: string;
  /** The figure; with `was`, the old one struck before it. */
  amount?: number;
  was?: number;
  /** A word after the figure, or instead of it. */
  word?: { text: string; tone: 'info' | 'warn' };
  /** Words instead of the figure ("not found"). */
  note?: string;
  gone?: boolean;
  mark: Mark;
  /** A picture under the row (OR12's ladder). */
  under?: ComponentChildren;
}

export interface CHead { title: string; bar?: string[]; summary?: string; pills?: { k: 'ok' | 'no' | 'back'; n: number }[] }

function MarkView(p: { m: Mark }): JSX.Element {
  const m = p.m;
  switch (m.k) {
    case 'ok': return <span class="ow-chk-m">{m.at && <span class="mono ow-chk-at">{m.at}</span>}<span role="img" aria-label={m.label} class="ow-chk-d ok"><Icon name="check" size={13} stroke={3.2} /></span></span>;
    case 'spin': return <span class="ow-chk-m">{m.word && <span class={cx('ow-chk-w', m.wordTone === 'info' && 'or-info')}>{m.word}</span>}<span role="img" aria-label={m.label} class="ow-chk-d spin" /></span>;
    case 'no': return <span role="img" aria-label={m.label} class="ow-chk-d no"><Icon name="close" size={11} stroke={3.4} /></span>;
    case 'face': return <span role="img" aria-label={m.label} style={{ display: 'flex' }}><Avatar {...m.face} size={24} style={{ boxShadow: '0 0 0 2px #F5B26B' }} /></span>;
    case 'back': return <span role="img" aria-label={m.label} class="or-back"><Icon name="return" size={13} stroke={2.2} />{`${m.n} back`}</span>;
    default: return <span role="img" aria-label={m.label} class="ow-chk-d wait" />;
  }
}

export function Pills(p: { pills: NonNullable<CHead['pills']> }): JSX.Element {
  return (
    <>
      {p.pills.map((x) => x.k === 'back'
        ? <span key={x.k} class="or-back h"><Icon name="return" size={12} stroke={2.2} />{x.n}</span>
        : <span key={x.k} class={cx('or-cpill', x.k)}><Icon name={x.k === 'ok' ? 'check' : 'close'} size={x.k === 'ok' ? 11 : 10} stroke={3.2} />{x.n}</span>)}
    </>
  );
}

export function CheckList(p: { head: CHead; lines: CLine[] }): JSX.Element {
  const h = p.head;
  return (
    <div class="ow-chk or-chk">
      <div class="ow-chk-h">
        <span class="ow-chk-title">{h.title}</span>
        {(h.bar || h.summary) && (
          <span class="ow-chk-sum">
            {h.bar && <span aria-hidden="true" class="ow-chk-bar">{h.bar.map((c, i) => <span key={i} style={{ background: c }} />)}</span>}
            {h.summary && <span class="mono">{h.summary}</span>}
          </span>
        )}
        {h.pills && <Pills pills={h.pills} />}
      </div>
      {p.lines.map((l, i) => {
        const row = (
          <div class={cx('ow-chk-row', l.gone && 'gone')}>
            <ItemSquare aisle={l.aisle} size={34} radius={9} icon={20} dropped={l.gone} />
            <span class="ow-chk-t">
              <span class="ow-chk-n">{l.name}</span>
              <span class={cx('mono ow-chk-s', (l.was != null || !!l.word || !!l.under || l.mark.k === 'face') && 'or-chk-s')}>
                {`${fig(l.qty)} `}<span class="ow-word or-unit">{l.unit}</span>{' · '}
                {l.note ? l.note : <>{l.was != null && <><s>{fig(l.was)}</s>{' '}</>}{l.amount != null && fig(l.amount)}</>}
                {l.word && <>{l.amount != null ? ' · ' : ''}<span class={cx('or-w', l.word.tone)}>{l.word.text}</span></>}
              </span>
            </span>
            <MarkView m={l.mark} />
          </div>
        );
        return l.under ? <div key={i} class="or-chk-under">{row}{l.under}</div> : <div key={i} class="or-chk-wrap">{row}</div>;
      })}
    </div>
  );
}
