/*
 * The start (board R1You, "After · Loading" and "Loading · Offline"; BUY-14): never a blank page.
 * At once the navy head with the greeting, the date and "Opening…"; with a copy kept on this phone,
 * its figures under it, dimmed, until the fresh read lands. No signal: Offline, and the band says how
 * old the copy is ("No signal · last copy 09:38"). Nothing here can be tapped: the real Today replaces it.
 */
import type { JSX } from 'preact';
import { tiles, toBuy } from '../../../core/buyer/rules.ts';
import { dayLabel } from '../../../core/time.ts';
import { fig } from '../../../ui/Money.tsx';
import { Notice } from '../../../ui/Notice.tsx';
import { TabBar, type BarItem } from '../../../ui/TabBar.tsx';
import { barW } from '../../../ui/util.tsx';
import { greeting } from '../today/Head.tsx';
import { firstName, hm } from '../today/rules.ts';
import type { Tab } from './nav.ts';
import { copy, online } from './store.ts';
import './you.css';

const none = (): void => undefined;

export function Opening(p: { items: BarItem<Tab>[] }): JSX.Element {
  const c = copy.value, b = c ? c.books : null, now = Date.now(), off = !online.value;
  const t = b ? tiles(b, now) : null;
  return (
    <div class="ow-frame with-bar ow-b-opening" aria-busy="true">
      <main>
        <header class="ow-b-today-hero">
          <div class="ow-b-today-hero-top">
            <div class="ow-b-today-hero-hi">
              <span class="ow-b-today-hero-greet">{b ? `${greeting(now)}, ${firstName(b.me)}` : greeting(now)}</span>
              <span class="ow-b-today-hero-date">{dayLabel(now)}
                {off
                  ? <span class="ow-b-today-live off"><i aria-hidden="true" />Offline</span>
                  : <span class="ow-b-today-live wait"><i aria-hidden="true" />Opening…</span>}
              </span>
            </div>
            {b && <span class="ow-b-today-me" aria-hidden="true">{b.me.initials}</span>}
          </div>
          {b && t && (
            <div class="ow-b-today-buy ow-b-opening-dim" aria-hidden="true">
              <span class="ow-b-today-buy-fig">
                <span class="ow-b-today-eyebrow">TO BUY TODAY ›</span>
                <span class="mono ow-b-today-fig">{fig(toBuy(b))} <small>UGX</small></span>
              </span>
              <span class="ow-b-today-bar"><i style={{ width: barW(t.suppliers ? (t.foundSuppliers / t.suppliers) * 100 : 0) }} /></span>
              <span class="ow-b-today-line"><b class="mono">{t.foundSuppliers}</b> of <b class="mono">{t.suppliers}</b> suppliers found ›</span>
            </div>
          )}
        </header>
        {off && c && <Notice kind="offline">No signal · last copy <span class="mono">{hm(c.at)}</span></Notice>}
      </main>
      <div inert>
        <TabBar<Tab> items={p.items} active="today" waiting={0} notPlaced={0} plusLabel="The trip" onTab={none} onPlus={none} />
      </div>
    </div>
  );
}
