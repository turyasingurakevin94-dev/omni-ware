/*
 * The Customers list's bodies, one per filter (CU01–CU08). Each row acts
 * where it stands: Take payment from the row, WhatsApp from the row.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { Duo, Icon, phWhatsapp } from '../../../ui/icons.tsx';
import { Shim, Loading } from '../../../ui/Skeleton.tsx';
import { money, short as shortMoney } from '../../../core/money.ts';
import { orderNo, TINTS } from '../../../core/names.ts';
import { weekday } from '../../../core/time.ts';
import type { Books, Customer, Day } from '../../../core/types.ts';
import { dueSub, oweSub, waitingNote, type ListData, type Who } from './list-data.ts';
import { Card, Group, QuietRow, Row } from './local-row.tsx';
import { short } from './data.ts';

export interface Acts {
  open: (c: Customer) => void;
  take: (c: Customer) => void;
  wa: (c: Customer) => void;
}

const label = (c: Customer) => c.name.replace(/&/g, 'and');
const face = (w: Who) => ({ initials: w.c.initials, tint: w.c.tint, tone: w.r.tone, fill: w.r.fill, label: label(w.c) });
/** Faces of customers the list does not name: soft dots, not identity tints. */
export const GHOST = ['#ECE7F7', '#DDF1F0', '#F6EBD9', '#FBE5E2'];

function oweRow(b: Books, w: Who, today: Day, a: Acts): JSX.Element {
  const note = waitingNote(b, w.c);
  return (
    <Row key={w.c.id} {...face(w)} name={w.c.name} sub={oweSub(w, today)} chip={w.m.checkedIn > 0 ? `${shortMoney(w.m.checkedIn)} checked` : null}
      fig={shortMoney(w.m.take)} word="to take" note={note ? [`+${shortMoney(note[0])}`, orderNo(note[1])] : null}
      act="take" on={() => a.open(w.c)} onAct={() => a.take(w.c)} />
  );
}

/** Owe (CU01, CU02, CU07): past the hold, under it, then what is being checked, the promises, and the end. */
export function OweBody(p: { b: Books; d: ListData; today: Day; a: Acts; more: boolean }): JSX.Element {
  const { b, d, today, a } = p;
  return (
    <>
      {d.past.length > 0 && <div class="cu-grp"><Group dot="#F5B26B" title="Past 21 days" count={d.past.length} sum={shortMoney(d.take)} word="to take" /><Card>{d.past.map((w) => oweRow(b, w, today, a))}</Card></div>}
      {d.under.length > 0 && <div class="cu-grp"><Group dot="#C9C4BA" title="Under 21 days" count={d.under.length} sum={shortMoney(d.under21)} word="to take" /><Card>{d.under.map((w) => oweRow(b, w, today, a))}</Card></div>}
      <div class={'cu-more' + (p.more ? '' : ' plain')}>
        {p.more && d.checked.length > 0 && (
          <div class="cu-grp"><Group hatch title="Being checked" count={d.checked.length} sum={shortMoney(d.checkedAll)} word="Esther" />
            <Card>{d.checked.map((w) => {
              const bill = w.m.bills.find((x) => x.checked);
              const sub = w.m.apart > 0 ? `${w.m.bills.length} bills · ${shortMoney(w.m.apart)} apart · owes ${money(w.m.owes)}` : bill ? `${orderNo(bill.id)} · ${shortMoney(bill.left)} · Esther` : '';
              return <Row key={w.c.id} {...face(w)} name={w.c.name} sub={sub} subTone="info" act="chev" on={() => a.open(w.c)} />;
            })}</Card></div>
        )}
        {p.more && d.promised.length > 0 && (
          <div class="cu-grp"><Group dot="#0F6B43" title="Promised to pay" count={d.promised.length} sum={shortMoney(d.promised.reduce((s, w) => s + (w.promise?.amount || 0), 0))} word={`of the ${d.owe.length} who owe`} />
            <div class="cu-prom">{d.promised.map((w) => {
              const t = TINTS[w.c.tint], pr = w.promise!, on = pr.on === today;
              return (
                <button key={w.c.id} type="button" class="cu-prom-t" onClick={() => a.open(w.c)}>
                  <span aria-hidden="true" style={{ background: t.bg, color: t.fg }}>{w.c.initials}</span>
                  <span><b class="mono">{money(pr.amount || 0)}</b><span class={on ? 'good' : undefined}>{`${short(w.c.name)} · ${on ? 'today' : weekday(pr.on)}`}</span></span>
                </button>
              );
            })}</div></div>
        )}
        {d.owe.length > 0 && (
          <div class="cu-end">
            <span aria-hidden="true"><Icon name="check" size={15} stroke={3} /></span>
            <span><span>{`That’s all ${d.owe.length} who owe`}</span><span>{`${d.all.length - d.owe.length} more customers owe nothing`}</span></span>
            <b class="mono">{money(d.owes)}</b>
          </div>
        )}
      </div>
    </>
  );
}


/** Due (CU03): reach out today, then who is coming up this week. */
export function DueBody(p: { d: ListData; a: Acts; day: Day | null }): JSX.Element {
  const { d, a } = p, [open, setOpen] = useState(false);
  const coming = d.week.filter(([, l]) => l.length > 0), comingAll = coming.flatMap(([, l]) => l);
  const reach = p.day ? (d.week.find(([x]) => x === p.day) || [p.day, []])[1] : d.due;
  return (
    <>
      <div class="cu-grp"><Group dot="#95530C" title={p.day ? `Due ${weekday(p.day)}` : 'Reach out today'} count={reach.length} />
        {reach.length > 0 && <Card>{reach.map((w) => (
          <Row key={w.c.id} {...face(w)} name={w.c.name} sub={dueSub(w, true)} subTone={w.r.tone === 'late' ? 'late' : w.r.tone === 'due' ? 'due' : null}
            fig={w.m.owes > 0 ? shortMoney(w.m.owes) : null} word="owes" act="wa" on={() => a.open(w.c)} onAct={() => a.wa(w.c)} />
        ))}</Card>}
      </div>
      {!p.day && comingAll.length > 0 && (
        <div class="cu-grp"><Group dot="#9AA1AE" title="Coming up" count={comingAll.length} />
          {open ? <Card>{comingAll.map((w) => <Row key={w.c.id} {...face(w)} name={w.c.name} sub={dueSub(w, false)} act="wa" on={() => a.open(w.c)} onAct={() => a.wa(w.c)} />)}</Card> : (
            <button type="button" class="cu-coming" onClick={() => setOpen(true)}>
              <span aria-hidden="true" class="cu-ghosts s26">{comingAll.slice(0, 4).map((_, i) => <span key={i} style={{ background: GHOST[i % 3] }} />)}</span>
              <span class="cu-coming-t">{coming.map(([day, l]) => `${weekday(day)} ${l.length}`).join(' · ')}</span>
              <span class="cu-coming-s">{`Show ${comingAll.length}`}<Icon name="chevron-down" size={14} stroke={2.4} /></span>
            </button>
          )}
        </div>
      )}
    </>
  );
}

/** All (CU04): gone quiet first, with one hello for all of them, then everyone A–Z with a letter rail. */
export function AllBody(p: { d: ListData; a: Acts; onHello: () => void; sending: boolean }): JSX.Element {
  const { d, a } = p, [show, setShow] = useState(4), [letter, setLetter] = useState<string | null>(null);
  const everyone = d.all.slice().sort((x, y) => x.c.name.localeCompare(y.c.name));
  const letters = [...new Set(everyone.map((w) => w.c.name[0].toUpperCase()))];
  const from = letter ? everyone.findIndex((w) => w.c.name[0].toUpperCase() === letter) : 0;
  const rows = everyone.slice(from, from + show), left = everyone.length - rows.length - from;
  const cur = rows.length ? rows[0].c.name[0].toUpperCase() : null;
  return (
    <>
      {d.quiet.length > 0 && <QuietCard d={d} onHello={p.onHello} sending={p.sending} />}
      <div class="cu-grp"><Group title="Everyone" count={everyone.length} right="A–Z" railGap />
        <div class="cu-az">
          <div class="cu-az-l"><Card>
            {rows.map((w) => <Row key={w.c.id} {...face(w)} name={w.c.name} sub={dueSub(w, false)} subTone={w.r.tone === 'late' || w.r.tone === 'quiet' ? 'late' : w.r.tone === 'due' ? 'due' : null}
              fig={w.m.owes > 0 ? shortMoney(w.m.owes) : null} word="owes" act="wa" on={() => a.open(w.c)} onAct={() => a.wa(w.c)} />)}
            {left > 0 && <button type="button" class="cu-showmore" onClick={() => setShow(show + left)}>{`Show ${left} more`}<Icon name="chevron-down" size={14} stroke={2.4} /></button>}
          </Card></div>
          <nav aria-label="Jump to a letter" class="cu-rail">
            {letters.slice(Math.max(0, letters.indexOf(cur || letters[0])), Math.max(0, letters.indexOf(cur || letters[0])) + 5).map((l) => (
              <button key={l} type="button" aria-label={`Jump to ${l}`} class={l === cur ? 'on' : undefined} onClick={() => { setLetter(l); setShow(4); }}>{l}</button>
            ))}
          </nav>
        </div></div>
    </>
  );
}

/** Gone quiet: who it is, at a glance, and one hello for all of them (CU04, CU09). */
function QuietCard(p: { d: ListData; onHello: () => void; sending: boolean; words?: string }): JSX.Element {
  const { d } = p;
  return (
    <div class="cu-grp"><Group dot="#8E2A22" title="Gone quiet" count={d.quiet.length} right="worth a hello" />
      <div class="cu-quiet">
        <div><span aria-hidden="true" class="cu-ghosts s30">{d.quiet.slice(0, 4).map((_, i) => <span key={i} style={{ background: GHOST[i % 4] }} />)}{d.quiet.length > 4 && <span class="more mono">{`+${d.quiet.length - 4}`}</span>}</span>
          <span>{p.words || `${d.quiet.length} regulars · twice their usual gap or more`}</span></div>
        <button type="button" class="cu-hello" disabled={p.sending} onClick={p.onHello}><Duo i={phWhatsapp} size={20} color="#FFFFFF" />{p.sending ? 'Sending…' : `Say hi to all ${d.quiet.length}`}</button>
      </div></div>
  );
}

/** Quiet (CU09): the hello for all of them, then each one, the longest gap first, its gap as two bars, WhatsApp from the row. */
export function QuietBody(p: { d: ListData; a: Acts; onHello: () => void; sending: boolean }): JSX.Element {
  const { d, a } = p, rows = d.quiet.slice().sort((x, y) => x.r.toDue - y.r.toDue);
  const now = (w: Who) => (w.r.every || 0) - w.r.toDue, scale = Math.max(1, ...rows.map(now));
  return (
    <>
      <QuietCard d={d} onHello={p.onHello} sending={p.sending} words={`${d.quiet.length} regulars`} />
      <div class="cu-grp"><Group title="Longest gap first" count={rows.length} />
        <Card>{rows.map((w) => <QuietRow key={w.c.id} {...face(w)} name={w.c.name} sub={dueSub(w, false)} subTone="quiet" act="wa" on={() => a.open(w.c)} onAct={() => a.wa(w.c)}
          every={w.r.every || 0} now={now(w)} scale={scale} />)}</Card></div>
    </>
  );
}

/** Nobody owes (CU06): a ghost of the list with a tick, then who is due. */
export function NobodyBody(p: { d: ListData; a: Acts }): JSX.Element {
  return (
    <>
      <div class="cu-ghost">
        <div aria-hidden="true" class="cu-ghost-row"><span /><span><span /><span /></span><span /></div>
        <div class="cu-ghost-ok"><span aria-hidden="true"><Icon name="check" size={22} stroke={2.8} /></span><span><span>Nobody owes</span><span>Every bill is paid</span></span></div>
      </div>
      {p.d.due.length > 0 && <div class="cu-grp after"><Group dot="#95530C" title="Who’s due" count={p.d.due.length} />
        <Card>{p.d.due.map((w) => <Row key={w.c.id} {...face(w)} name={w.c.name} sub={dueSub(w, true)} subTone={w.r.tone === 'late' ? 'late' : 'due'} act="wa" on={() => p.a.open(w.c)} onAct={() => p.a.wa(w.c)} />)}</Card></div>}
    </>
  );
}

/** First open (CU08): the chips without counts, the groups as shimmers. */
export function LoadingBody(): JSX.Element {
  const rows = () => (
    <Card>{[0, 1].map((i) => (
      <div key={i} class="cu-skrow"><Shim w={44} h={44} round /><span><Shim w="70%" h={12} /><Shim w="40%" h={10} /></span><Shim w={44} h={12} /><span aria-hidden="true" /></div>
    ))}</Card>
  );
  return (
    <>
      <div aria-hidden="true" class="cu-chips-ghost"><span style={{ width: '64px' }}>Owe</span><span style={{ width: '62px' }}>Due</span><span style={{ width: '72px' }}>Quiet</span><span style={{ width: '58px' }}>All</span></div>
      <div class="cu-grp"><div class="cu-loadhead"><Shim w={120} h={12} /><Loading text="Getting your customers" /></div>{rows()}</div>
      <div class="cu-grp"><div class="cu-loadhead"><Shim w={96} h={12} /></div>{rows()}</div>
    </>
  );
}
