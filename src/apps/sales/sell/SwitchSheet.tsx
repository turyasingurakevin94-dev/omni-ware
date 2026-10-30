/*
 * Another customer for the order being built. The who pill opens the same
 * "Who is it for?" sheet (SL01); a choice made while the order holds lines
 * asks first (SL26): the lines go along ("Change · 3 items"), or this order
 * waits under "Still open" ("Keep for later") and a new one starts.
 */
import type { JSX } from 'preact';
import { avatarStyle } from '../../../ui/Avatar.tsx';
import { Duo, Icon, phBasket } from '../../../ui/icons.tsx';
import { ItemSquare } from '../../../ui/ItemSquare.tsx';
import { sheet } from '../../../ui/sheet.tsx';
import { nav } from '../shell/nav.ts';
import { books } from '../shell/store.ts';
import { Frame } from './Frame.tsx';
import { first, whose } from './insights.ts';
import { cur, itemOf, keep, moveTo, resume, start } from './model.ts';
import { openSwitchTo } from './sheets.tsx';
import { WhoBody, type Pick } from './Who.tsx';
import './who.css';

function choose(x: Pick): void {
  const o = cur.value, has = !!o && o.lines.length > 0;
  if (x.kind === 'customer') {
    if (o && o.customerId === x.id) { sheet.close(); return; }
    if (has) { openSwitchTo(x.id); return; }
    sheet.close(); start(x.id); return;
  }
  keep();
  sheet.close();
  if (x.kind === 'walkin') start(null);
  else if (x.kind === 'draft') resume(x.key);
  else if (x.kind === 'counter') { cur.value = null; nav.replace('counter'); }
  else { cur.value = null; nav.replace('customers/new', { ...(x.name ? { name: x.name } : {}), ...(x.phone ? { phone: x.phone } : {}) }); }
}

/** The who pill: the same sheet as the red +. */
export function PickSheet(): JSX.Element {
  return (
    <div class="ow-lsheet ground">
      <button type="button" class="ow-grab" aria-label="Close" onClick={sheet.close} />
      <div class="ow-lsheet-h">
        <div class="ow-lsheet-ht"><h2 class="sl-frame-h">Who is it for?</h2></div>
        <button type="button" class="ow-x-tile" aria-label="Close" onClick={sheet.close}><Icon name="close" size={16} stroke={2.2} /></button>
      </div>
      <WhoBody b={books.value} pick={choose} />
    </div>
  );
}

/** SL26 · change to another customer? */
export function SwitchSheet(p: { to: string }): JSX.Element | null {
  const b = books.value, x = cur.value, to = b ? b.customers.find((c) => c.id === p.to) : null;
  if (!b || !x || !to) return null;
  const from = x.customerId ? b.customers.find((c) => c.id === x.customerId) || null : null, n = x.lines.length;
  const who = from ? whose(from.name) : 'This';
  const items = `${n} item${n === 1 ? '' : 's'}`;
  return (
    <Frame title={`Change to ${first(to.name)}?`} eyebrow={`${who} order · ${items}`} onClose={sheet.close} pad="12px 16px 20px"
      foot={<div class="sl-two"><button type="button" class="sl-btn ghost" onClick={() => { keep(); sheet.close(); start(to.id); }}>Keep for later</button>
        <button type="button" class="sl-btn navy" onClick={() => { moveTo(to.id); sheet.close(); }}>{`Change · ${items}`}</button></div>}>
      <div role="img" aria-label={`${from ? `${from.name}'s` : 'The'} ${items} change to ${to.name}`} class="sl-sw">
        {from && <span aria-hidden="true" class="ow-av sl-sw-av" style={avatarStyle({ initials: from.initials, tint: from.tint, size: 48, font: 15 })}>{from.initials}</span>}
        <span class="sl-sw-items">{x.lines.slice().reverse().slice(0, 3).map((l) => <ItemSquare key={l.lineId} aisle={(itemOf(b, l.itemId, l.variantIdx) || { aisle: '' }).aisle} size={30} radius={9} icon={18} />)}</span>
        <span class="sl-sw-arrow"><Icon name="arrow-right" size={20} stroke={2.2} /></span>
        <span aria-hidden="true" class="ow-av sl-sw-av" style={{ ...avatarStyle({ initials: to.initials, tint: to.tint, size: 48, font: 15 }), boxShadow: '0 0 0 3px #FFFFFF, 0 0 0 5px #16203C' }}>{to.initials}</span>
      </div>
      <div class="sl-sw-note"><Duo i={phBasket} size={18} color="#95530C" /><span>{`Keep for later puts ${from ? whose(from.name) : 'this'} under `}<b>Still open</b></span></div>
    </Frame>
  );
}
