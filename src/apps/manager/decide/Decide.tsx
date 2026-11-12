/*
 * Decide (route `decide`, spec 04-screens-manager §3.2): the one sheet the red + opens.
 * It shows the head of the queue (or `id`, from a push or a row; `asker`, the queue of one
 * colour of Today's bar). A tap answer leaves the queue at once, the strip "{answer} · {#order}
 * · {who} see it · Undo 10" sits on top, and the next card slides in by itself (Today p3);
 * the last opens All decided (Today p4). A slide goes at once and then moves on the same way.
 */
import type { JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { askerOf, groupOf, type AskerGroup } from '../../../core/manager/queue.ts';
import type { WriteName } from '../../../core/manager/source.ts';
import type { Ask } from '../../../core/manager/types.ts';
import { firstWord } from '../../../core/names.ts';
import { Icon } from '../../../ui/icons.tsx';
import { Avatar } from '../../../ui/Avatar.tsx';
import { waited } from '../../../core/manager/words.ts';
import type { Params } from '../../../ui/stack.ts';
import { nav } from '../shell/nav.ts';
import { act, answer, books, held, now, undoHeld, waiting } from '../shell/store.ts';
import { DockView } from './DockView.tsx';
import { Head, titleOf } from './Head.tsx';
import { KINDS } from './kinds/index.ts';
import type { Ctx, KindView } from './kit.ts';
import './decide.css';

interface Last { key: string; word: string; sub: string; told: string; slide: boolean }

function useTick(on: boolean): number {
  const [t, setT] = useState(Date.now());
  useEffect(() => { if (!on) return undefined; const i = setInterval(() => setT(Date.now()), 250); return () => clearInterval(i); }, [on]);
  return t;
}

export function Decide(p: { params: Params }): JSX.Element | null {
  const b = books.value;
  const group = (p.params.asker as AskerGroup | undefined) || null;
  const q = useMemo(() => (b ? waiting.value.filter((a) => !group || groupOf((askerOf(b, a) || { role: null }).role as never) === group) : []), [b, waiting.value, group]);
  const [key, setKey] = useState<string | null>((p.params.id as string) || null);
  const [last, setLast] = useState<Last | null>(null);
  const [busy, setBusy] = useState(false);
  const [, bump] = useState(0);
  const local = useRef<Record<string, unknown>>({});
  const tick = useTick(!!last);

  // The card on screen: the one asked for while it waits, else the head of the queue.
  const a: Ask | null = (key && q.find((x) => x.key === key)) || q[0] || null;
  useEffect(() => { if (!a && b && !held.value && !busy) nav.replace('decide/done', {}); }, [a, b, held.value, busy]);
  if (!b) return null;
  if (!a) return <div class="mg-d" />;

  const asker = askerOf(b, a);
  const n = q.indexOf(a) + 1;
  const after = q[n] || null;
  const order = a.orderId != null ? b.orders.find((o) => o.id === a.orderId) || null : null;
  const moveOn = () => { local.current = {}; setKey(after ? after.key : null); };

  const named = (told: string[]) => told.map((id) => { const x = b.team.find((pp) => pp.id === id || pp.name === id); return x ? firstWord(x.name) : firstWord(id); }).filter(Boolean);
  // eslint-disable-next-line prefer-const -- the answers read the view drawn from them
  let view: KindView = { evidence: <div />, dock: { told: [], word: '', primary: { tap: { label: '', on: () => undefined } } } };
  const ctx: Ctx = {
    a, b, now: now.value, asker,
    tap: (word: string, kind: WriteName, args: unknown[]) => {
      const told = view.dock.told.join(' · ');
      setLast({ key: a.key, word, sub: order ? `#${String(order.id).padStart(4, '0')}` : '', told, slide: false });
      answer(a.key, word, kind, args, { quiet: true, undo: () => { setKey(a.key); setLast(null); } });
      moveOn();
    },
    slide: async (word: string, kind: WriteName, args: unknown[]) => {
      setBusy(true);
      try {
        await act(kind, ...args);
        setLast({ key: a.key, word, sub: order ? `#${String(order.id).padStart(4, '0')}` : '', told: view.dock.told.join(' · '), slide: true });
        moveOn();
      } finally { setBusy(false); }
    },
    pick: <T,>(name: string, first: T): [T, (v: T) => void] => {
      const k = a.key + ':' + name;
      const v = (k in local.current ? local.current[k] : first) as T;
      return [v, (x: T) => { local.current = { ...local.current, [k]: x }; setKey(a.key); bump((i) => i + 1); }];
    },
  };
  const kind = KINDS[a.kind];
  view = kind ? kind(ctx) : { evidence: <div class="mg-card">{a.kind}</div>, dock: { told: [], word: '', primary: { tap: { label: 'Open', on: () => undefined, disabled: 'not built yet' } } } };
  view = { ...view, dock: { ...view.dock, told: named(view.dock.told) } };

  const h = held.value, left = h && last && !last.slide ? Math.max(0, Math.ceil((h.until - tick) / 1000)) : 0;
  return (
    <div class="mg-d" role="dialog" aria-label={`${view.title || a.kind}, ${n} of ${q.length}`}>
      <Head a={a} asker={asker} order={order} n={n} of={q.length} title={view.title} chip={view.chip || null} now={now.value}
        onClose={() => nav.back()} onNext={after ? () => { local.current = {}; setKey(after.key); } : null} />
      <div class="mg-d-body">
        {last && (h || last.slide) && (
          <div class="mg-strip" role="status">
            <span class="ok"><Icon name="check" size={18} stroke={2.4} /></span>
            <span class="t"><b>{last.word}</b><span>{[last.sub, last.told && `${last.told} see it`].filter(Boolean).join(' · ')}</span></span>
            {!last.slide && h && <button type="button" class="mg-undo" onClick={() => undoHeld()}><i>{left}</i>Undo</button>}
          </div>
        )}
        {view.evidence}
        {after && (
          <button type="button" class="mg-d-nextrow" onClick={() => { local.current = {}; setKey(after.key); }}>
            <span>NEXT</span>
            {askerOf(b, after) && <Avatar initials={askerOf(b, after)!.initials} tint={askerOf(b, after)!.tint === 'me' ? 'n' : askerOf(b, after)!.tint} size={24} />}
            <span class="t">{nextWords(b, after)}</span>
            <span class="m">{waited(after.at, now.value)}</span>
          </button>
        )}
      </div>
      <DockView d={view.dock} busy={busy} />
    </div>
  );
}

function nextWords(b: NonNullable<typeof books.value>, a: Ask): string {
  const p = askerOf(b, a);
  return [p ? firstWord(p.name) : '', titleOf(a), a.orderId != null ? `#${String(a.orderId).padStart(4, '0')}` : ''].filter(Boolean).join(' · ');
}
