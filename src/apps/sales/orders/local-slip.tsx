/*
 * The paper slip (OR34–OR37), drawn exactly as KC16's: the shop and the order's number, the day and
 * who it is for, QTY · ITEM · RATE · AMOUNT on KC16's grid (46px 1fr 56px 62px), the total, two rows of
 * money and the pill. It takes plain words and figures, no counter data, so it and the counter's
 * receipt (counter/Receipt.tsx) can fold into one src/ui part (SHARED-QUEUE "Local parts to fold").
 */
import type { JSX } from 'preact';
import { Icon } from '../../../ui/icons.tsx';
import './slip.css';

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
  by?: string;
}

export function Slip(p: SlipProps): JSX.Element {
  return (
    <div class="or-slip">
      <div class="or-slip-h">
        <span><b>{p.shop}</b><span>{`${p.word} · `}<span class="mono">{p.no}</span>{p.stands && <> · <b class="or-slip-st">as it stands</b></>}</span></span>
        <span class="r"><span>{`${p.day} · `}<span class="mono">{p.at}</span></span><b>{`For: ${p.forName}`}</b></span>
      </div>
      <div>
        <div class="or-slip-tbl h"><span>QTY</span><span>ITEM</span><span>RATE</span><span>AMOUNT</span></div>
        {p.lines.map((l) => (l.gone
          ? <div key={l.key} class="or-slip-tbl gone"><span class="mono b"><s>{l.qty}</s> <span class="ow-word">{l.unit}</span></span><s class="n">{l.name}</s><span class="nf">not found · 0</span></div>
          : (
            <div key={l.key} class="or-slip-tbl">
              <span class="mono b">{`${l.qty} `}<span class="ow-word">{l.unit}</span></span>
              <span class="n">{l.name}</span>
              <span class="mono soft">{l.rate}</span>
              <span class="mono b">{l.amount}</span>
            </div>
          )))}
      </div>
      <div class="or-slip-t"><span>Total</span>{p.struck ? <s class="mono">{`UGX ${p.total}`}</s> : <span class="mono">{`UGX ${p.total}`}</span>}</div>
      <div class="or-slip-g">{p.rows.flatMap(([k, v, warn]) => [<span key={k}>{k}</span>, <span key={k + ':v'} class="r"><span class={'mono' + (warn ? ' w' : '')}>{v}</span></span>])}</div>
      <div class="or-slip-f">
        <span class={'or-slip-pill ' + p.pill.tone}>{p.pill.tick && <Icon name="check" size={11} stroke={3.2} />}{p.pill.text}</span>
        {p.by && <span>{`Taken by ${p.by}`}</span>}
      </div>
    </div>
  );
}
