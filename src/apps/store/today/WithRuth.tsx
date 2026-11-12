/*
 * today/with-ruth (TD11, TD30 empty): every yard ask with Ruth as a step track, yours first, then what
 * waits on her, then what she answered in the last 7 days (WORD-05; the rule: core/store/ruth.ts).
 * Blind: a count shows only what was counted, never the books.
 */
import type { JSX } from 'preact';
import { firstWord, orderNo } from '../../../core/names.ts';
import { personFace, shortName, whoIs } from '../../../core/store/faces.ts';
import { withRuth, type RuthItem } from '../../../core/store/ruth.ts';
import type { YardBooks } from '../../../core/store/types.ts';
import { NOT_PAID } from '../../../core/store/yard.ts';
import { clock, when } from '../../../core/time.ts';
import { IconTile, type TileTone } from '../../../ui/ActRow.tsx';
import { ItemSquare } from '../../../ui/ItemSquare.tsx';
import { avatarStyle, FaceStack, type Face } from '../../../ui/Avatar.tsx';
import { Button } from '../../../ui/Button.tsx';
import { Icon, type IconName } from '../../../ui/icons.tsx';
import { PageHead } from '../../../ui/PageHead.tsx';
import { Tap, cx } from '../../../ui/util.tsx';
import { nav } from '../shell/nav.ts';
import { books, me, now } from '../shell/store.ts';
import { sinceDays } from './parts.tsx';
import './alerts.css';

/** The aisle an aisle count was of ("Aisle A · Roofing" → Roofing); null for a spot count. */
const aisleOf = (c: { aisle: string }): string | null => (/^Aisle \w+ · /.test(c.aisle) ? c.aisle.replace(/^Aisle \w+ · /, '') : null);

interface Step { word: string; sub?: string; state: 'done' | 'now' | 'next'; icon: IconName }
interface Said { icon: IconName; aisle?: string | null; tone: TileTone; title: string; sub: string; steps: Step[]; act?: { word: string; on: () => void }; faces?: Face[]; on?: () => void }

function say(x: RuthItem, b: YardBooks, n: number): Said {
  const ruth = b.people.find((p) => p.role === 'manager'), rn = ruth ? firstWord(ruth.name) : 'Ruth';
  const o = x.order, d = (ms: number | null | undefined) => (ms == null ? '' : when(ms, n).split(' ')[0] === when(ms, n) ? clock(ms) : when(ms, n).split(' ')[0]);
  switch (x.kind) {
    case 'return': {
      const r = x.ret!, s = whoIs(b, r.by), q = r.lines.map((l) => `${l.qty} ${l.unit}`).join(' + '), acc = b.people.find((p) => p.role === 'accounts');
      return { icon: 'return', tone: 'info', title: `Return · ${orderNo(r.orderId)}${o ? ` ${shortName(o)}` : ''}`, sub: `${when(r.createdAt, n)} · ${q} ${(r.reason || '').split(' ')[0].toLowerCase()}`,
        act: { word: 'Gate', on: () => nav.push('in/return', { order: r.orderId }) },
        steps: [{ word: `${s ? firstWord(s.name) : 'Sales'} asked`, sub: d(r.createdAt), state: 'done', icon: 'check' }, { word: 'You check', sub: r.dueAt ? `~${clock(r.dueAt)}` : 'at the gate', state: 'now', icon: 'gate' },
          { word: `${rn} decides`, state: 'next', icon: 'person' }, { word: `${acc ? firstWord(acc.name) : 'Accounts'} told`, state: 'next', icon: 'receipt' }] };
    }
    case 'count': {
      const c = x.count!, l = c.lines[0];
      const title = c.lines.length === 1 ? `Count · ${l.name.split(' · ')[0]}` : `Count · ${c.aisle}`;
      // An aisle count answered: the aisle's own picture (TD30, Roofing's house), as Today's tiles draw it.
      if (x.state === 'answered') return { icon: 'orders', aisle: aisleOf(c), tone: 'info', title: c.lines.length === 1 && /^Spot/.test(c.aisle) ? title : `Count · ${c.aisle.replace(/^Aisle/, 'aisle')}`, sub: `${when(x.at, n)} · ${firstWord(c.countedByName)}`, steps: [] };
      return { icon: 'count', tone: 'warn', title, sub: `you counted ${l ? `${l.counted} ${(b.items.find((i) => i.key === l.key) || { unit: '' }).unit}` : ''} · ${clock(c.createdAt)}`.replace('  ', ' '),
        on: () => nav.push('shelf/count', l ? { key: l.key } : {}),
        steps: [{ word: 'You counted', sub: clock(c.createdAt), state: 'done', icon: 'check' }, { word: `${rn} looks`, sub: 'now', state: 'now', icon: 'eye' }, { word: 'The shelf', state: 'next', icon: 'shelf' }] };
    }
    case 'unpaid': {
      const s = whoIs(b, o!.takenBy);
      return { icon: 'hourglass', tone: 'warn', title: `${NOT_PAID} · ${orderNo(o!.id)}`, sub: `${shortName(o!)}${o!.bay != null ? ` · bay ${o!.bay}` : ''} · ${sinceDays(x.at, n)}`,
        faces: [s, ruth].filter(Boolean).map((p) => personFace(p) as Face), on: () => nav.push('out/load'),
        steps: [{ word: 'Packed', sub: d(o!.pickingDoneAt), state: 'done', icon: 'check' }, { word: `${s ? firstWord(s.name) : 'Sales'} takes it · ${rn} may let it go`, state: 'now', icon: 'person' }, { word: 'You load', state: 'next', icon: 'trolley' }] };
    }
    case 'cancel':
      return { icon: 'void', tone: 'bad', title: `Cancel · ${orderNo(o!.id)} ${shortName(o!)}`, sub: `a copy of ${orderNo(o!.copyOf as number)} · don't pack`, on: () => nav.push('pack/look', { id: o!.id }),
        steps: [{ word: 'Copy found', sub: clock(x.at), state: 'done', icon: 'check' }, { word: `${rn} cancels`, sub: 'now', state: 'now', icon: 'person' }, { word: 'Gone', state: 'next', icon: 'trash' }] };
    case 'report': {
      const r = x.report!;
      if (x.state === 'answered') return { icon: 'warning', tone: 'bad', title: `Report · ${r.name.split(' · ')[0]}`, sub: `${when(x.at, n)} · ${r.qty} ${r.why}`, steps: [] };
      return { icon: 'warning', tone: 'bad', title: `Report · ${r.name.split(' · ')[0]}`, sub: `${r.qty} ${r.why} · ${clock(r.createdAt)}`, on: () => nav.push('shelf/item', { key: r.key }),
        steps: [{ word: 'You reported', sub: clock(r.createdAt), state: 'done', icon: 'check' }, { word: `${rn} decides`, sub: 'now', state: 'now', icon: 'person' }, { word: 'Back to you', state: 'next', icon: 'shelf' }] };
    }
    default: {
      const title = x.kind === 'yard-return' ? `Return · ${o ? orderNo(o.id) : ''}` : x.kind === 'extra' ? 'Not on the list' : 'Ask for more';
      return { icon: x.kind === 'yard-return' ? 'return' : 'tray-in', tone: 'info', title, sub: `${when(x.at, n)}${x.ask ? ` · ${x.ask.byName.split(' ')[0]}` : ''}`,
        steps: x.state === 'answered' ? [] : [{ word: 'You sent', sub: clock(x.at), state: 'done', icon: 'check' }, { word: `${rn} decides`, sub: 'now', state: 'now', icon: 'person' }, { word: 'Back to you', state: 'next', icon: 'shelf' }] };
    }
  }
}

function Track(p: { steps: Step[]; yours?: boolean }): JSX.Element {
  return (
    <div class={cx('st-track', p.yours && 'yours')} aria-label={p.steps.map((s) => `${s.word}${s.state === 'done' ? ', done' : s.state === 'now' ? ', now' : ''}`).join('; ')} role="img">
      {p.steps.map((s, i) => (
        <span key={i} class={cx('st-track-s', s.state)}>
          <span aria-hidden="true" class="st-track-d">{s.state === 'done' ? <Icon name="check" size={14} stroke={3} /> : <Icon name={s.icon} size={14} stroke={2} />}</span>
          <span class="st-track-w">{s.word}</span>{s.sub && <span class="st-track-sub">{s.sub}</span>}
        </span>
      ))}
    </div>
  );
}

function Card(p: { s: Said; yours?: boolean }): JSX.Element {
  const head = (
    <>
      <IconTile tone={p.s.tone} icon={p.s.icon} size={40} />
      <span class="st-need-t"><span>{p.s.title}</span><span class="mono">{p.s.sub}</span></span>
    </>
  );
  return (
    <div class="st-rcard">
      <div class="st-rcard-h">
        {p.s.on ? <Tap on={p.s.on} class="st-rcard-main">{head}</Tap> : <span class="st-rcard-main">{head}</span>}
        {/* A 44 px button with the board's 36 px pill drawn inside it (TD11). */}
        {p.s.act && <button type="button" class="st-rcard-act" onClick={p.s.act.on}><span>{p.s.act.word}</span></button>}
        {p.s.faces && <FaceStack faces={p.s.faces} ground="#FFFFFF" />}
      </div>
      {p.s.steps.length > 0 && <Track steps={p.s.steps} yours={p.yours} />}
    </div>
  );
}

export function WithRuth(): JSX.Element {
  const b = books.value, n = now.value;
  if (!b) return <main class="st-ph" />;
  const all = withRuth(b, me.value, n), ruth = b.people.find((p) => p.role === 'manager'), rn = ruth ? firstWord(ruth.name) : 'Ruth';
  const yours = all.filter((x) => x.state === 'yours'), wr = all.filter((x) => x.state === 'with-ruth'), ans = all.filter((x) => x.state === 'answered');
  const open = yours.length + wr.length;
  const shorts = b.orders.filter((o) => o.lines.some((l) => l.pickStatus === 'short') && !o.pickShortfallAckAt).length;
  return (
    <>
      <PageHead title={`With ${rn}`} count={wr.length} onBack={() => nav.back()}>
        <div class={cx('st-ruth-who', open ? 'some' : 'none')}>
          {ruth && <span class="st-al-f"><span aria-hidden="true" class="ow-av" style={avatarStyle({ ...personFace(ruth), size: 40, font: 13 })}>{ruth.initials}</span><span aria-hidden="true" class="st-on navy" /></span>}
          <span class="st-al-t"><span class="big w">{ruth ? ruth.name : 'The manager'}</span><span class="on">Manager · on now · she decides</span></span>
          {ruth && ruth.phone && <Tap href={'tel:' + ruth.phone.replace(/\s/g, '')} label={`Call ${ruth.name}`} class="st-ruth-call"><Icon name="phone" size={20} stroke={2} /></Tap>}
        </div>
        <span aria-hidden="true" class="st-ruth-bar">{[...yours.map(() => 'y'), ...wr.map(() => 'w'), ...ans.map(() => 'a')].map((x, i) => <span key={i} class={x} />)}</span>
        <span class="st-ruth-leg"><span><span aria-hidden="true" class="y" /><b class="mono">{yours.length}</b> yours first</span><span><span aria-hidden="true" class="w" /><b class="mono">{wr.length}</b> with {rn}</span><span><span aria-hidden="true" class="a" /><b class="mono">{ans.length}</b> answered</span></span>
      </PageHead>
      <main class="st-alerts">
        {open === 0 && <>
          <div aria-hidden="true" class="st-ghostcard"><span class="sq" /><span class="l1" /><span class="l2" />
            <span class="st-ghostcard-t"><span><i />You send</span><span><i />{`${rn} decides`}</span><span><i />Back to you</span></span></div>
          <div class="st-empty"><span aria-hidden="true" class="st-empty-ic"><Icon name="check" size={30} stroke={2.4} /></span>
            <b>{`Nothing waiting on ${rn}`}</b><span>Counts, returns and short picks show here</span></div>
        </>}
        {yours.length > 0 && <>
          <div class="st-al-h"><span aria-hidden="true" class="d warn" /><h2>{`Before ${rn} · yours`}</h2><span class="mono">{yours.length}</span></div>
          {yours.map((x, i) => <Card key={i} s={say(x, b, n)} yours />)}
        </>}
        {wr.length > 0 && <>
          <div class="st-al-h"><span aria-hidden="true" class="d info" /><h2>{`With ${rn}`}</h2><span class="mono">{wr.length}</span></div>
          {wr.map((x, i) => <Card key={i} s={say(x, b, n)} />)}
          <div class="st-al-old quiet"><span>{shorts ? `Short picks · ${shorts}` : 'Short picks · none today'}</span></div>
        </>}
        {ans.length > 0 && <>
          <div class="st-al-h"><span aria-hidden="true" class="d good" /><h2>Answered</h2><span class="mono">{ans.length}</span><span class="r">last 7 days</span></div>
          <div class="st-al-card">{ans.map((x, i) => { const s = say(x, b, n); return (
            <div key={i} class="st-al">
              {s.aisle ? <ItemSquare aisle={s.aisle} size={38} radius={12} icon={22} /> : <IconTile tone="info" icon={s.icon} size={40} />}
              <span class="st-al-t wrap"><span>{s.title}</span><span class="mono">{s.sub}</span></span>
              <span class="st-al-now good"><Icon name="check" size={12} stroke={2.4} />{x.answer}</span>
            </div>); })}</div>
        </>}
        {open === 0 && <Button kind="navy" onClick={() => nav.home()}>Back to Today</Button>}
      </main>
    </>
  );
}
