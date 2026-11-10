/*
 * Under the shop's price, Ruth decides (decision-rights: the Manager prices).
 *   KC10  the ask, in the content: three steps (Ask · Ruth decides · They pay), the shop's price
 *         in white or a navy "Ask Ruth" (asks are navy, lead ruling)
 *   KC11  waiting: Ruth's face glowing, how long, her price against the shop's, the steps further on
 *   KC12  Ruth said yes: in how long, the shop's price struck to hers
 */
import type { JSX } from 'preact';
import { Avatar, type Face } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { fig } from '../../../ui/Money.tsx';
import { Steps } from '../../../ui/Track.tsx';
import './ask.css';

export function AskCard(p: { ruth: Face & { first: string }; shopTotal: number; onShop: () => void; onAsk: () => void; asking: boolean }): JSX.Element {
  return (
    <div class="kc-ask">
      <span class="kc-ask-k">Under the shop’s price</span>
      <Steps steps={[
        { word: `Ask ${p.ruth.first}`, icon: 'bell', state: 'now' },
        { word: `${p.ruth.first} decides`, icon: 'hourglass', state: 'next' },
        { word: 'They pay', icon: 'cash', state: 'next' },
      ]} />
      <div class="kc-ask-b">
        <button type="button" class="kc-ask-shop" onClick={p.onShop}>Shop price<span class="mono">{fig(p.shopTotal)}</span></button>
        <button type="button" class="kc-ask-go" disabled={p.asking} onClick={p.onAsk}>
          <Avatar initials={p.ruth.initials} tint={p.ruth.tint} size={30} font={11} />{`Ask ${p.ruth.first}`}
        </button>
      </div>
    </div>
  );
}

/** "185,000 → 170,000 a tin". */
export function Struck(p: { was: number; now: number; unit: string; good?: boolean }): JSX.Element {
  return (
    <div class="kc-struck">
      <s class="mono">{fig(p.was)}</s>
      <span class="kc-struck-a"><Icon name="arrow-right" size={14} stroke={2.2} /></span>
      <span class={'mono kc-struck-n' + (p.good ? ' good' : '')}>{fig(p.now)}</span>
      <span class="kc-struck-u">{`a ${p.unit}`}</span>
    </div>
  );
}

export function WaitCard(p: { ruth: Face & { first: string }; waited: string; was: number; now: number; unit: string }): JSX.Element {
  return (
    <div class="kc-waitc">
      <div class="kc-waitc-h">
        <Avatar initials={p.ruth.initials} tint={p.ruth.tint} size={52} class="kc-glow" />
        <span class="kc-waitc-t">
          <b>{`Waiting for ${p.ruth.first}`}</b>
          <span><Icon name="bell" size={14} stroke={2} />On her phone ·<span class="mono">{p.waited}</span></span>
        </span>
      </div>
      <Struck was={p.was} now={p.now} unit={p.unit} />
      <div class="kc-waitc-s">
        <Steps steps={[
          { word: 'Asked', icon: 'bell', state: 'done' },
          { word: `${p.ruth.first} decides`, icon: 'hourglass', state: 'now' },
          { word: 'They pay', icon: 'cash', state: 'next' },
        ]} />
      </div>
    </div>
  );
}

export function YesCard(p: { ruth: Face & { first: string }; took: string; was: number; now: number; unit: string }): JSX.Element {
  return (
    <div class="kc-yes">
      <div class="kc-yes-h">
        <span aria-hidden="true" class="kc-yes-f">
          <Avatar initials={p.ruth.initials} tint={p.ruth.tint} size={48} font={16} />
          <span class="kc-yes-t"><Icon name="check" size={12} stroke={3.2} /></span>
        </span>
        <span class="kc-yes-w"><b>{`${p.ruth.first} said yes`}</b><span>{'in '}<span class="mono">{p.took}</span></span></span>
      </div>
      <div class="kc-yes-p"><Struck was={p.was} now={p.now} unit={p.unit} good /></div>
    </div>
  );
}
