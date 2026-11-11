/*
 * A return at the gate (route `in/return { order }`; IN20–IN25): what the salesperson asked back
 * (Grace's 2 of 3 bags, Damaged) is already filled in; the yard looks, takes a photo, and sends it to
 * Ruth with the navy "Send to Ruth". Damaged is set aside, never back on the shelf. No credit note and
 * no money here: "Ruth checks it" (screens Q6).
 *
 *   IN20 the form · IN23 sending · IN24 no signal · IN25 not done · IN21 sent (Undo 10 s) · IN22 Ruth decided
 *
 * Rules: core/store/returns.ts. Writes: W18 returnAsk, W18a withdrawReturn (Undo).
 */
import { orderFace, personFace } from '../../../core/store/faces.ts';
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { orderNo, firstWord } from '../../../core/names.ts';
import { askOf, backLines, canSend, clampBack, returnAt, startDraft, type Condition, type ReturnDraft, type ReturnLine } from '../../../core/store/returns.ts';
import type { StoreReturn, YardBooks } from '../../../core/store/types.ts';
import { clock, weekday } from '../../../core/time.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { artOf, BagArt, ItemArt } from '../../../ui/ItemArt.tsx';
import { Stepper } from '../../../ui/Stepper.tsx';
import { cx } from '../../../ui/util.tsx';
import { nav } from '../shell/nav.ts';
import { act, books, notDone, now } from '../shell/store.ts';
import { BackToToday, byLogin, byRole, Card, Done, DoneWho, FlowCard, HeadPill, HeadRail, InBar, NavyChip, Pill, Screen, Steps, TripHead } from './parts.tsx';
import { takePhoto, type Photo } from './photo.ts';
import './return.css';

type Phase = 'form' | 'sending' | 'kept' | 'failed' | 'sent';

/** The demo's photo: the torn bags at the gate, as the board draws it. */
const TORN_PHOTO = (
  <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
    <rect x="0" y="44" width="64" height="20" fill="#3B4253" />
    <g transform="translate(4 8) scale(.8)"><BagShape /></g><g transform="translate(22 14) scale(.8)"><BagShape /></g>
  </svg>
);
function BagShape(): JSX.Element {
  return (
    <>
      <path d="M15 20c0-3 2-5 5-5h24c3 0 5 2 5 5l2 28c0 3-2 5-5 5H18c-3 0-5-2-5-5z" fill="#E6DDCB" /><path d="M14.4 30h35.2l.8 11H13.6z" fill="#5F6980" />
      <path d="M38 44l4-4 2 5 4-2-1 8H36z" fill="#B9B2A4" /><path d="M36 51l2-7 4-4 2 5 4-2" fill="none" stroke="#8E2A22" stroke-width="1.6" stroke-linejoin="round" />
      <circle cx="42" cy="52" r="1.2" fill="#B9B2A4" /><circle cx="46" cy="54" r="1" fill="#B9B2A4" />
    </>
  );
}

/** One unit's picture on a tile (a bag, else the item's own picture). */
const Unit = (p: { name: string; torn?: boolean; size: number }): JSX.Element => (artOf(p.name) === 'bag' ? <BagArt size={p.size} torn={p.torn} /> : <ItemArt name={p.name} size={p.size} />);

/** The line coming back: one tile per unit ("kept" or "back"), Good or Damaged. */
function BackCard(p: { r: ReturnLine; seller: string; d: ReturnDraft; set: (d: ReturnDraft) => void }): JSX.Element {
  const l = p.r.line, idx = l.idx, n = p.d.qty[idx] || 0, cond = p.d.condition[idx] || 'good', of = l.pickedQty ?? l.qty;
  const setN = (v: number) => p.set({ ...p.d, qty: { ...p.d.qty, [idx]: clampBack(p.r, v) } });
  const setC = (c: Condition) => p.set({ ...p.d, condition: { ...p.d.condition, [idx]: c } });
  const tiles = of <= 6;
  return (
    <div class="in-card open-navy">
      <div class="in-open-h">
        <ItemArt name={l.name} size={56} radius={14} torn={cond === 'damaged'} />
        <div class="in-open-t">
          <span class="rt-nw">{l.name}</span>
          <span class="in-open-s rt-nw">{p.r.asked ? <>{`${p.seller} asked `}<b class="mono rt-b">{`${p.r.asked} of ${of}`}</b>{` ${l.unit}`}</> : `How many came back? · of ${of} ${l.unit}`}</span>
        </div>
      </div>
      {tiles ? (
        <div class="rt-units" role="group" aria-label={`Of ${of} ${l.unit}s, ${of - n} stays and ${n} came back. Tap one to change`}>
          {Array.from({ length: of }, (_, i) => {
            const back = i >= of - n;
            return (
              <button key={i} type="button" class={cx('rt-unit', back && 'back')} aria-pressed={back} disabled={!back && n >= p.r.left}
                aria-label={back ? `${l.unit} ${i + 1} came back` : `${l.unit} ${i + 1} stays`} onClick={() => setN(back ? of - i - 1 : of - i)}>
                <span class="rt-pic"><Unit name={l.name} size={36} torn={back && cond === 'damaged'} />{back && <span class="rt-badge"><Icon name="return" size={10} stroke={3} /></span>}</span>
                <span class="rt-w">{back ? 'back' : 'kept'}</span>
              </button>
            );
          })}
        </div>
      ) : <div class="in-loose"><span>Came back</span><Stepper value={n} unit={l.unit} max={p.r.left} onChange={setN} /></div>}
      <div class="rt-seg" role="radiogroup" aria-label="What state is it in">
        <button type="button" role="radio" aria-checked={cond === 'good'} class={cx(cond === 'good' && 'on')} onClick={() => setC('good')}><Icon name="rack" size={15} stroke={2} />Good · to the shelf</button>
        <button type="button" role="radio" aria-checked={cond === 'damaged'} class={cx('bad', cond === 'damaged' && 'on')} onClick={() => setC('damaged')}><Icon name="damaged" size={15} stroke={2} />Damaged</button>
      </div>
      {cond === 'damaged' && <span class="rt-aside"><Icon name="lock" size={14} stroke={2.2} />Set aside · never back on the shelf</span>}
    </div>
  );
}

export function Return(p: { order: number }): JSX.Element {
  const b = books.value as YardBooks, r = b ? returnAt(b, p.order) : null;
  const [d, setD] = useState<ReturnDraft | null>(() => (r ? startDraft(r) : null));
  const [photo, setPhoto] = useState<Photo | null>(null), [phase, setPhase] = useState<Phase>('form'), [open, setOpen] = useState<number[]>([]);
  const [gateAt] = useState(() => now.value);
  if (!b || !r || !d) return <Screen head={<TripHead lead={null} name="Return" sub="" onClose={() => nav.home()} />}><p class="in-gone-p">That order is gone.</p></Screen>;
  const o = r.order, name = o.client.name, ruth = byRole(b, 'manager'), ruthName = firstWord(ruth ? ruth.name : 'Ruth');
  const asker = r.asked ? byLogin(b, r.asked.by) : null, seller = firstWord(asker ? asker.name : (byLogin(b, o.takenBy) || { name: 'Sales' }).name);
  const sellerP = asker || byLogin(b, o.takenBy), bringer = o.carrier && o.carrier.kind === 'staff' ? b.people.find((x) => x.id === o.carrier!.staffId) || null : null;

  if (r.mine && r.mine.status !== 'sent' && phase !== 'sent') return <Decided b={b} mine={r.mine} />;
  if (r.mine && r.mine.status === 'sent' && phase !== 'sending') {
    const ls = r.mine.lines, qty = ls.reduce((s, l) => s + l.qty, 0), unit = ls[0] ? ls[0].unit : '', dmg = ls.some((l) => l.condition === 'damaged');
    const undo = async () => { try { await act('withdrawReturn', r.mine!.id); setPhase('form'); } catch (_e) { /* the bar says it */ } };
    return (
      <Done title={`Sent to ${ruthName}`} icon="send" tick={88} undo={phase === 'sent' ? () => { void undo(); } : undefined}
        who={<DoneWho lead={<Avatar {...orderFace(o, b)} size={30} />} name={name} sub={`${orderNo(o.id)} · ${qty} ${unit}`} />}
        chips={<NavyChip tone="glass" face={personFace(sellerP)}>{`${seller} sees Return asked`}</NavyChip>}>
        <FlowCard pics={Array.from({ length: Math.min(qty, 3) }, (_, i) => <Unit key={i} name={ls[0].name} size={30} torn={dmg} />)} n={String(qty)} unit={unit}
          to={<span class={cx('in-to', dmg ? 'amber' : 'mint')}><Icon name={dmg ? 'damaged' : 'rack'} size={15} stroke={2.2} />{dmg ? 'Damaged' : 'Good'}</span>}
          label={`${qty} ${dmg ? 'torn ' : ''}${unit}s put aside in ${dmg ? 'Damaged' : 'Good'}${dmg ? ', not for sale' : ''}`} />
        <Steps steps={[
          { lead: 'check', state: 'done', title: 'Checked at the gate', sub: `${clock(r.mine.createdAt)} · photo and ${qty} ${unit} ${dmg ? 'damaged' : 'good'}` },
          { lead: ruth ? ruth.initials : 'RN', state: 'now', title: `${ruthName} checks it`, sub: 'now · you get a push with her answer' },
          { lead: 'send', state: 'next', title: `${seller} tells ${firstWord(name)}`, sub: `when ${ruthName} has decided` },
        ]} />
      </Done>
    );
  }

  const send = async () => {
    if (!canSend(r, d, !!photo)) return;
    setPhase('sending');
    notDone.value = null;
    try {
      const x = await act('returnAsk', askOf(r, d, photo ? photo.blob : null));
      setPhase(x.kept ? 'kept' : 'sent');
      // Undo 10 s (FLOW-02): after that the return stays sent.
      if (!x.kept) window.setTimeout(() => setPhase((ph) => (ph === 'sent' ? 'form' : ph)), 10000);
    } catch (_e) { setPhase('failed'); }
  };
  const locked = phase === 'sending' || phase === 'kept', ready = canSend(r, d, !!photo);
  const shown = r.lines.filter((l) => l.asked > 0 || open.includes(l.line.idx) || (d.qty[l.line.idx] || 0) > 0);
  const head = (
    <TripHead lead={<Avatar {...orderFace(o, b)} size={44} />} name={`${name} · return`} sub={`${orderNo(o.id)} · at the gate ${clock(gateAt)}`} onClose={() => nav.back()}
      chips={<>
        {r.asked && <HeadPill face={personFace(sellerP)}>{`From ${seller} · asked ${weekday(r.asked.createdAt)} ${clock(r.asked.createdAt)}`}</HeadPill>}
        {bringer && <HeadPill face={personFace(bringer)}>{`${firstWord(bringer.name)} brought it`}</HeadPill>}
        <span class="in-flex" />
      </>} />
  );
  const foot = (
    <div class="in-foot">
      <InBar kept={phase === 'kept'} what="return" offlineWords="No signal · sends by itself" retry={phase === 'failed' ? () => { void send(); } : undefined} />
      <div class="rt-end">
        {phase === 'kept'
          ? <button type="button" class="rt-kept" disabled><Icon name="lock" size={18} stroke={2.2} />Not sent yet · kept on this phone</button>
          : <button type="button" class={cx('in-navybtn', phase === 'sending' && 'sending')} disabled={!ready && phase !== 'sending'} aria-busy={phase === 'sending'} onClick={() => { if (phase !== 'sending') void send(); }}>
            {phase === 'sending' ? <><span aria-hidden="true" class="in-spin" />Sending…</> : <><Icon name="send" size={18} stroke={2} />{`Send to ${ruthName}`}</>}
          </button>}
      </div>
    </div>
  );
  return (
    <Screen head={head} foot={foot} back="Back" pad="14px 16px 12px" gap={10}>
      <fieldset class={cx('rt-form', phase === 'sending' && 'locked')} disabled={locked}>
        {shown.map((l) => <BackCard key={l.line.idx} r={l} seller={seller} d={d} set={setD} />)}
        {r.lines.filter((l) => !shown.includes(l)).length > 0 && (
          <Card>
            {r.lines.filter((l) => !shown.includes(l)).map((l) => (
              <button key={l.line.idx} type="button" class="in-line" aria-label={`${l.line.name}: ${l.line.qty} ${l.line.unit}, not asked back. Tap if it came back`} onClick={() => setOpen([...open, l.line.idx])}>
                <ItemArt name={l.line.name} size={40} />
                <span class="in-line-t"><span>{l.line.name}</span><span class="mono">{`${l.line.qty} ${l.line.unit} · not asked back`}</span></span>
                <Pill tone="plain">stays</Pill>
              </button>
            ))}
          </Card>
        )}
        <div class="rt-photo">
          <span aria-hidden="true" class="rt-photo-pic">{photo ? (photo.url ? <img src={photo.url} alt="" width={64} height={64} /> : TORN_PHOTO) : <Icon name="camera" size={22} stroke={2} />}</span>
          <span class="in-line-t">
            <span>{photo ? `1 photo · ${backLines(r, d).some((l) => d.condition[l.line.idx] === 'damaged') ? 'torn bags' : 'what came back'}` : 'Take a photo'}</span>
            <span>{photo ? `${clock(photo.at)} · ${ruthName} sees it` : `${ruthName} sees it`}</span>
          </span>
          <button type="button" class="nl-cam" aria-label={photo ? 'Take another photo' : 'Take a photo'} onClick={async () => { const x = await takePhoto(now.value); if (x) setPhoto(x); }}><Icon name="camera" size={18} stroke={2} /></button>
        </div>
        <div class="rt-who">
          <span><Avatar {...personFace(ruth)} size={22} /><b>{`${ruthName} checks it`}</b>· she gets a push</span>
          <span><Avatar {...personFace(sellerP)} size={22} />{`${seller} sees`}<b>Return asked</b></span>
        </div>
      </fieldset>
    </Screen>
  );
}

/** IN22: Ruth decided; the damaged ones go to the damaged place, not for sale. */
function Decided(p: { b: YardBooks; mine: StoreReturn }): JSX.Element {
  const { b, mine } = p, o = b.orders.find((x) => x.id === mine.orderId)!, name = o.client.name, ruth = byRole(b, 'manager'), ruthName = firstWord(ruth ? ruth.name : 'Ruth');
  const took = mine.status === 'accepted', at = mine.decidedAt ? clock(mine.decidedAt) : '', seller = firstWord((byLogin(b, o.takenBy) || { name: 'Sales' }).name);
  const qty = mine.lines.reduce((s, l) => s + l.qty, 0), unit = mine.lines[0] ? mine.lines[0].unit : '', dmg = mine.lines.some((l) => l.condition === 'damaged');
  const stayed = o.lines.filter((l) => !l.dropped && !mine.lines.some((m) => m.idx === l.idx));
  const head = (
    <TripHead lead={<Avatar {...orderFace(o, b)} size={44} />} name={`${name} · return`} sub={`${orderNo(o.id)} · ${o.invoicedAt ? `${weekday(o.invoicedAt)} ${clock(o.invoicedAt)}` : ''}`} onClose={() => nav.home()}>
      <div class="rt-dhead">
        <div class="rt-dtitle"><span>{took ? 'Taken back' : 'Not taken back'}</span><span>{`${ruthName} · ${at}`}</span></div>
        <HeadRail tone="amber" label={`Return: at the gate ${clock(mine.createdAt)}, sent to ${ruthName} ${clock(mine.createdAt)}, ${ruthName} ${took ? 'took it back' : 'said no'} ${at}${dmg ? ', put aside now' : ''}`} stops={[
          { word: 'At the gate', at: clock(mine.createdAt), state: 'done' }, { word: 'Sent', at: clock(mine.createdAt), state: 'done' },
          { word: ruthName, at, state: 'done' }, { word: dmg ? 'Put aside' : 'On the shelf', at: 'now', state: 'now', icon: dmg ? 'damaged' : 'rack' },
        ]} />
      </div>
    </TripHead>
  );
  return (
    <Screen head={head} back="Back" pad="14px 16px 20px" gap={10}>
      <div class="in-card in-card16 in-ans">
        <div class="in-ans-h">
          <Avatar {...personFace(ruth)} size={40} />
          <span class="in-who-t"><span>{took ? `${ruthName} took it back` : `${ruthName} did not take it back`}</span><span class="mono">{`${at} · ${seller} told`}</span></span>
          <Pill tone="good" icon="check" size={11} stroke={3.2}>Decided</Pill>
        </div>
        <div class="in-ans-flow" role="img" aria-label={`${qty} ${unit}s of ${mine.lines[0] ? mine.lines[0].name.split(' · ')[0].toLowerCase() : ''} go to ${dmg ? 'damaged, not for sale' : 'the shelf'}`}>
          <ItemArt name={mine.lines[0] ? mine.lines[0].name : ''} size={44} torn={dmg} />
          <span class="mono in-ans-n">{qty}<span>{` ${unit}`}</span></span>
          <span class="in-ans-arrow"><i /><Icon name="chevron-right" size={14} stroke={2.4} /></span>
          <span class={cx('rt-to', dmg && 'bad')}><Icon name={dmg ? 'damaged' : 'rack'} size={15} stroke={2.2} />{dmg ? 'Damaged' : 'The shelf'}</span>
        </div>
        {dmg && <span class="in-by"><Icon name="lock" size={14} stroke={2.2} />{`Not for sale · ${ruthName} writes it off from there`}</span>}
      </div>
      {dmg && (
        <div class="in-card in-card16 in-shelfto">
          <span aria-hidden="true" class="rt-dmg"><Icon name="damaged" size={22} stroke={2} /></span>
          <span class="in-line-t"><span>The damaged place</span><span class="mono">{`${qty} ${unit} · back wall`}</span></span>
          <Pill tone="bad">not for sale</Pill>
        </div>
      )}
      {stayed.length > 0 && (
        <Card>
          {stayed.map((l) => (
            <div key={l.idx} class="in-line">
              <ItemArt name={l.name} size={40} />
              <span class="in-line-t"><span>{l.name}</span><span class="mono">{`${l.qty} ${l.unit} · stayed with ${firstWord(name)}`}</span></span>
              <Pill tone="plain">stayed</Pill>
            </div>
          ))}
        </Card>
      )}
      <div class="rt-who one"><span><Avatar {...personFace(byLogin(b, o.takenBy))} size={22} />{`${seller} sees`}<b>{took ? `Taken back · ${qty} ${unit}` : 'Not taken back'}</b></span></div>
      <BackToToday />
    </Screen>
  );
}
