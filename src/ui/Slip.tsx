/*
 * The paper slip (KC16 a counter sale's receipt; OR34–OR37 an order's paper): the shop and the
 * number (and "as it stands" when its prices are not final), the day and who it is for, QTY · ITEM ·
 * RATE · AMOUNT on a 46px 1fr 56px 62px grid (a line not found struck), the total (struck when
 * voided), rows of money (a figure in warn ink), the pill and who took it. SlipHead is the light
 * head of the sheet it sits on (the grabber, the eyebrow, "Receipt", the ×).
 *
 *   <Slip shop="Lubowa Hardware" word="Counter sale" no="#0550" day="17 Oct 2026" at="9:02" forName="Walk-in"
 *     lines={[…]} total="52,000" rows={[['Cash given', '55,000'], ['Change', '3,000']]} pill={{ text: 'Paid · cash', tone: 'good', tick: true }} foot="Sold by Grace" />
 */
import type { JSX } from 'preact';
import { Icon } from './icons.tsx';
import './slip.css';

/** The sheet's light head over the slip: the grabber, the eyebrow and the title, the ×. */
export function SlipHead(p: { eyebrow: string; title: string; onClose: () => void }): JSX.Element {
  return (
    <div class="ow-slip-head">
      <span aria-hidden="true" class="ow-slip-grab" />
      <div class="ow-lsheet-h">
        <div class="ow-lsheet-ht"><span class="ow-lsheet-eye">{p.eyebrow}</span><h2>{p.title}</h2></div>
        <button type="button" class="ow-x-tile" aria-label="Close" onClick={p.onClose}><Icon name="close" size={16} stroke={2.2} /></button>
      </div>
    </div>
  );
}

export interface SlipLine { key: string | number; qty: string; unit: string; name: string; rate: string; amount: string; gone?: boolean }
export interface SlipProps {
  shop: string;
  /** "Order · #0552" or "Bill · #0537", and "· as it stands" when its prices are not final. */
  word: string; no: string; stands?: boolean;
  day: string; at: string; forName: string;
  lines: SlipLine[];
  total: string; struck?: boolean;
  rows: [string, string, boolean?][];
  pill: { text: string; tone: 'warn' | 'good' | 'bad'; tick?: boolean };
  /** Under it, at the right: "Sold by Grace", "Taken by Grace". */
  foot?: string;
}

export function Slip(p: SlipProps): JSX.Element {
  return (
    <div class="ow-slip">
      <div class="ow-slip-h">
        <span><b>{p.shop}</b><span>{`${p.word} · `}<span class="mono">{p.no}</span>{p.stands && <> · <b class="ow-slip-st">as it stands</b></>}</span></span>
        <span class="r"><span>{`${p.day} · `}<span class="mono">{p.at}</span></span><b>{`For: ${p.forName}`}</b></span>
      </div>
      <div>
        <div class="ow-slip-tbl h"><span>QTY</span><span>ITEM</span><span>RATE</span><span>AMOUNT</span></div>
        {p.lines.map((l) => (l.gone
          ? <div key={l.key} class="ow-slip-tbl gone"><span class="mono b"><s>{l.qty}</s> <span class="ow-word">{l.unit}</span></span><s class="n">{l.name}</s><span class="nf">not found · 0</span></div>
          : (
            <div key={l.key} class="ow-slip-tbl">
              <span class="mono b">{`${l.qty} `}<span class="ow-word">{l.unit}</span></span>
              <span class="n">{l.name}</span>
              <span class="mono soft">{l.rate}</span>
              <span class="mono b">{l.amount}</span>
            </div>
          )))}
      </div>
      <div class="ow-slip-t"><span>Total</span>{p.struck ? <s class="mono">{`UGX ${p.total}`}</s> : <span class="mono">{`UGX ${p.total}`}</span>}</div>
      <div class="ow-slip-g">{p.rows.flatMap(([k, v, warn]) => [<span key={k}>{k}</span>, <span key={k + ':v'} class="r"><span class={'mono' + (warn ? ' w' : '')}>{v}</span></span>])}</div>
      <div class="ow-slip-f">
        <span class={'ow-slip-pill ' + p.pill.tone}>{p.pill.tick && <Icon name="check" size={11} stroke={3.2} />}{p.pill.text}</span>
        {p.foot && <span>{p.foot}</span>}
      </div>
    </div>
  );
}
