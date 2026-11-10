/*
 * One supplier (Suppliers.dc.html phone 2): the navy hero with how often
 * they have it and how fast they answer, Call and WhatsApp; then the lines
 * with them now (each with the order and what its salesperson sees), and
 * what we buy from them with how old each price is. A price row opens the
 * fix sheet (suppliers/fix) to put what they said on the list.
 */
import type { JSX } from 'preact';
import { WORD } from '../../../core/buyer/rules.ts';
import type { LineState } from '../../../core/buyer/types.ts';
import { orderNo, phoneText } from '../../../core/names.ts';
import { GroupCard, IconTile, TILE_TONE } from '../../../ui/ActRow.tsx';
import { AisleIcon, Duo, Icon, phWhatsapp, type IconName } from '../../../ui/icons.tsx';
import { fig } from '../../../ui/Money.tsx';
import { cx } from '../../../ui/util.tsx';
import { nav } from '../shell/nav.ts';
import { books, now } from '../shell/store.ts';
import { chipTone, Face, byRole, first, member, SupTile } from './parts.tsx';
import { ageWord, boughtFrom, intlPhone, isFast, withThem } from './rules.ts';
import './one.css';

const ICON: Partial<Record<LineState, IconName>> = { found: 'check', priceup: 'trend', notfound: 'close', asked: 'clock', toask: 'clock', clientwaits: 'hourglass', ontrip: 'truck' };

export function One(p: { params: Record<string, unknown> }): JSX.Element {
  const b = books.value, id = String(p.params.id || '');
  const s = b ? b.suppliers.find((x) => x.id === id) : null;
  if (!b || !s) return <main class="ow-b-suppliers-one"><p class="ow-b-suppliers-gone">This supplier is not on the list</p></main>;
  const t = now.value, lines = withThem(b, s.id), bought = boughtFrom(b, s.id, t);
  const ruth = first(byRole(b, 'manager'), 'Ruth'), old = bought.filter((x) => !x.fresh).length;
  const short = s.name.split(' ')[0];
  const wa = `https://wa.me/${intlPhone(s.phone)}`;

  return (
    <main class="ow-b-suppliers-one">
      <header class="ow-b-suppliers-hero">
        <div class="ow-b-suppliers-hero-top">
          <button type="button" class="ow-b-suppliers-back" aria-label="Back to Suppliers" onClick={() => nav.back()}><Icon name="back" size={20} stroke={2} /></button>
          <SupTile name={s.name} size={52} />
          <span class="ow-b-suppliers-hero-n">
            <h1>{s.name}</h1>
            <span>{s.place}{s.phone && <> · <span class="mono">{phoneText(s.phone)}</span></>}</span>
          </span>
        </div>
        <div class="ow-b-suppliers-hero-stats">
          <div><span>Found</span><span class="ow-b-suppliers-big"><b class="mono">{s.found}</b><span class="mono">{`of ${s.asked}`}</span></span></div>
          <div>
            <span>Reply</span>
            <span class="ow-b-suppliers-big">
              {s.replyMins != null ? <><b class="mono">{s.replyMins < 60 ? s.replyMins : Math.round(s.replyMins / 60)}</b><span class="mono">{s.replyMins < 60 ? 'min' : 'h'}</span></> : <b class="mono">—</b>}
              {isFast(s) && <span class="ow-b-suppliers-fast">Fast</span>}
            </span>
          </div>
        </div>
        <div class="ow-b-suppliers-segs" role="img" aria-label={`Found ${s.found} of the last ${s.asked} asks`}>
          {Array.from({ length: s.asked }, (_, i) => <i key={i} class={i < s.found ? 'on' : undefined} />)}
        </div>
        <div class="ow-b-suppliers-calls">
          <a class="ow-b-suppliers-call" href={`tel:+${intlPhone(s.phone)}`} aria-label={`Call ${s.name}`}><Icon name="phone" size={22} stroke={2} /></a>
          <a class="ow-b-suppliers-wa" href={wa} target="_blank" rel="noopener">
            <Duo i={phWhatsapp} size={20} color={TILE_TONE.good.fg} />{`WhatsApp ${short}`}
          </a>
        </div>
      </header>

      <div class="ow-b-suppliers-one-body">
        {lines.length > 0 && (
          <section>
            <h2 class="ow-b-suppliers-sh"><Icon name="list" size={16} stroke={2} /><span>With them now</span><b class="mono">{lines.length}</b></h2>
            <GroupCard pad={12}>
              {lines.map((r) => {
                const seller = member(b, r.order.sellerId), tone = chipTone(r.state);
                return (
                  <div key={r.order.id + r.line.key} class="ow-b-suppliers-wl">
                    <IconTile tone={tone} icon={ICON[r.state] || 'clock'} size={38} />
                    <span class="ow-b-suppliers-wl-t">
                      <span>{r.line.name} <span class="mono">{`× ${r.line.qty}`}</span></span>
                      <span><span class="mono">{orderNo(r.order.id)}</span>{` · ${first(seller, 'Sales')} sees: `}<span class={cx('st', 't-' + tone)}>{WORD[r.state]}</span></span>
                    </span>
                    {r.line.ruthDecides && <span class="ow-b-suppliers-bell"><Icon name="bell" size={13} stroke={2} />{ruth}</span>}
                    <Face m={seller} size={30} />
                  </div>
                );
              })}
            </GroupCard>
          </section>
        )}
        {bought.length > 0 && (
          <section>
            <h2 class="ow-b-suppliers-sh">
              <Icon name="tag" size={16} stroke={2} /><span>What we buy <b class="mono">{bought.length}</b></span>
              <em class={old ? 'warn' : undefined}>{old ? `${old} old` : 'All fresh'}</em>
            </h2>
            <GroupCard pad={12}>
              {bought.map((x) => (
                <button key={x.price.item} type="button" class="ow-b-suppliers-pr" onClick={() => nav.push('suppliers/fix', { id: s.id, item: x.price.item })}
                  aria-label={`${x.price.item}: ${fig(x.now)} a ${x.price.unit}, ${x.days ? `${x.days} days old` : 'today'}. Fix the price`}>
                  <span class="ow-b-suppliers-pr-ic"><AisleIcon aisle={x.price.item} size={22} color="#1C2233" /></span>
                  <span class="ow-b-suppliers-pr-t">
                    <span>{x.price.item}</span>
                    <span class="mono">{fig(x.now)} <small>UGX</small> / {x.price.unit}</span>
                    {x.was != null && <span class="mono was">{`was ${fig(x.was)}`}</span>}
                  </span>
                  <span class={cx('ow-b-suppliers-age', !x.fresh && 'old')}>
                    <span>{ageWord(x.days)}</span>
                    <span class="track"><i style={{ width: `${Math.max(6, Math.min(100, (x.days / 30) * 100))}%` }} /></span>
                  </span>
                  <span aria-hidden="true" class="ow-chev"><Icon name="chevron-right" size={16} stroke={2.2} /></span>
                </button>
              ))}
            </GroupCard>
          </section>
        )}
      </div>
    </main>
  );
}
