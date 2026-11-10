/*
 * P20 · The item check list, "What Kato gets" (LANGUAGE.md §3 P20; as
 * built: OR07): one row per line, its mark saying where it is: confirmed
 * (a green tick, and when), checking or packing (an amber ring and the
 * word), waiting (a dashed disc), short ("32/60"), dropped (crimson ×, the
 * line struck through), Ruth decides its price (her face in an amber ring),
 * coming back ("2 back"). The header counts it as a little bar, or as
 * counted pills (✓ 1  × 1  ↩ 1).
 *
 *   <CheckList head={{ title: 'What Kato gets', bar: ['#0F6B43', '#F5B26B'], summary: '1 of 2 packed' }} lines={[
 *     { aisle: 'Roofing', name: 'Iron sheet G28 · 3m', qty: 40, unit: 'pc', amount: 1520000, mark: { k: 'ok', at: '10:30', label: 'Packed at 10:30' } },
 *     { aisle: 'Tools', name: 'Wheelbarrow, heavy duty', qty: 2, unit: 'pc', amount: 290000, mark: { k: 'spin', word: 'packing', label: 'Packing now' } },
 *     { aisle: 'Doors & locks', name: 'Soft close hinge · flat', qty: 10, unit: 'pair', note: 'not found', gone: true, mark: { k: 'no', label: 'Not found' } }]} />
 *   was: the old figure struck before the new; word: a word after the figure ("Order in", "Price coming");
 *   under: a picture under the row (OR12's price ladder).
 */
import type { ComponentChildren, JSX } from 'preact';
import { Avatar, type Face } from './Avatar.tsx';
import { Icon } from './icons.tsx';
import { ItemSquare } from './ItemSquare.tsx';
import { fig } from './Money.tsx';
import { cx, type Fig } from './util.tsx';
import './checklist.css';

export type CheckMark =
  | { k: 'ok'; at?: string; label: string }
  | { k: 'spin'; word?: string; wordTone?: 'warn' | 'info'; label: string }
  | { k: 'wait'; label: string }
  | { k: 'short'; got: string; label: string }
  | { k: 'no'; label: string }
  | { k: 'face'; face: Face; label: string }
  | { k: 'back'; n: number; label: string };

export interface CheckLine {
  aisle: string;
  name: string;
  qty: Fig;
  unit: string;
  /** The figure; with `was`, the old one struck before it. */
  amount?: Fig;
  was?: number;
  /** A word after the figure, or instead of it. */
  word?: { text: string; tone: 'info' | 'warn' };
  /** Words instead of the figure ("not found"). */
  note?: string;
  /** Dropped: the line struck through. */
  gone?: boolean;
  mark: CheckMark;
  under?: ComponentChildren;
}

export interface CheckHead { title: string; bar?: string[]; summary?: string; pills?: { k: 'ok' | 'no' | 'back'; n: number }[] }

function Mark(p: { m: CheckMark }): JSX.Element {
  const m = p.m;
  switch (m.k) {
    case 'ok': return <span class="ow-chk-m">{m.at && <span class="mono ow-chk-at">{m.at}</span>}<span role="img" aria-label={m.label} class="ow-chk-d ok"><Icon name="check" size={13} stroke={3.2} /></span></span>;
    case 'spin': return <span class="ow-chk-m">{m.word && <span class={cx('ow-chk-w', m.wordTone === 'info' && 'info')}>{m.word}</span>}<span role="img" aria-label={m.label} class="ow-chk-d spin" /></span>;
    case 'short': return <span class="ow-chk-m"><span class="mono ow-chk-w">{m.got}</span><span role="img" aria-label={m.label} class="ow-chk-d short" /></span>;
    case 'no': return <span role="img" aria-label={m.label} class="ow-chk-d no"><Icon name="close" size={11} stroke={3.4} /></span>;
    case 'face': return <span role="img" aria-label={m.label} style={{ display: 'flex' }}><Avatar {...m.face} size={24} style={{ boxShadow: '0 0 0 2px #F5B26B' }} /></span>;
    case 'back': return <span role="img" aria-label={m.label} class="ow-chk-back"><Icon name="return" size={13} stroke={2.4} />{`${m.n} back`}</span>;
    default: return <span role="img" aria-label={m.label} class="ow-chk-d wait" />;
  }
}

/** The head's counted pills (also on a folded order: OR19). */
export function CheckPills(p: { pills: NonNullable<CheckHead['pills']> }): JSX.Element {
  return (
    <>
      {p.pills.map((x) => x.k === 'back'
        ? <span key={x.k} class="ow-chk-back h"><Icon name="return" size={12} stroke={2.4} />{x.n}</span>
        : <span key={x.k} class={cx('ow-chk-pill', x.k)}><Icon name={x.k === 'ok' ? 'check' : 'close'} size={x.k === 'ok' ? 11 : 10} stroke={x.k === 'ok' ? 3.2 : 3.4} />{x.n}</span>)}
    </>
  );
}

function Sub(l: CheckLine): JSX.Element {
  const rich = l.was != null || !!l.word || !!l.under || l.mark.k === 'face';
  if (!rich) return <span class="mono ow-chk-s">{`${fig(l.qty)} `}<span class="ow-word">{l.unit}</span>{` · ${l.note || (l.amount != null ? fig(l.amount) : '')}`}</span>;
  return (
    <span class="mono ow-chk-s rich">
      {`${fig(l.qty)} `}<span class="ow-word">{l.unit}</span>{' · '}
      {l.note ? l.note : <>{l.was != null && <><s>{fig(l.was)}</s>{' '}</>}{l.amount != null && fig(l.amount)}</>}
      {l.word && <>{l.amount != null ? ' · ' : ''}<span class={cx('ow-chk-after', l.word.tone)}>{l.word.text}</span></>}
    </span>
  );
}

/** tight: the head 36 and the rows 48, under a picture that leaves less room (OR38). */
export function CheckList(p: { head: CheckHead; lines: CheckLine[]; tight?: boolean }): JSX.Element {
  const h = p.head;
  return (
    <div class={cx('ow-chk', p.tight && 'tight')}>
      <div class="ow-chk-h">
        <span class="ow-chk-title">{h.title}</span>
        {(h.bar || h.summary) && (
          <span class="ow-chk-sum">
            {h.bar && <Dashes bar={h.bar} />}
            {h.summary && <span class={cx('mono', h.summary.startsWith('0 ') && 'none')}>{h.summary}</span>}
          </span>
        )}
        {h.pills && <CheckPills pills={h.pills} />}
      </div>
      {p.lines.map((l, i) => {
        const row = (
          <div key={i} class={cx('ow-chk-row', l.gone && 'gone')}>
            <ItemSquare aisle={l.aisle} size={34} radius={9} icon={20} dropped={l.gone} />
            <span class="ow-chk-t"><span class="ow-chk-n">{l.name}</span>{Sub(l)}</span>
            <Mark m={l.mark} />
          </div>
        );
        return l.under ? <div key={i} class="ow-chk-under">{row}{l.under}</div> : row;
      })}
    </div>
  );
}

/** One dash a line, as the boards draw it; past eight lines one bar of the same colours, so 25 lines never push the count out. */
const DASHES = 8;
function Dashes(p: { bar: string[] }): JSX.Element {
  if (p.bar.length <= DASHES) return <span aria-hidden="true" class="ow-chk-bar">{p.bar.map((c, i) => <span key={i} style={{ background: c }} />)}</span>;
  const runs: { c: string; n: number }[] = [];
  p.bar.forEach((c) => { const r = runs[runs.length - 1]; if (r && r.c === c) r.n++; else runs.push({ c, n: 1 }); });
  return <span aria-hidden="true" class="ow-chk-bar long">{runs.map((r, i) => <span key={i} style={{ background: r.c, flexGrow: r.n }} />)}</span>;
}
