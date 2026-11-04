/*
 * The Chats tab's own small parts (local until the lead moves them to src/ui):
 *   Ring       the wait of a chat on src/ui RingAvatar (the hour it waits)
 *   Dots       the three typing dots
 *   Pic        a photo they sent: the picture once its link is known; in the demo, the item's aisle
 *   open       open a screen another tab owns, by its ROUTES.md id
 *   say        word a write's outcome: kept on this phone, or the server's reason
 */
import { signal } from '@preact/signals';
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { isDataError } from '../../../core/datasource.ts';
import type { Message } from '../../../core/types.ts';
import { RingAvatar, type Face } from '../../../ui/Avatar.tsx';
import { AISLE, Duo, Icon, aisleKey } from '../../../ui/icons.tsx';
import { toast } from '../../../ui/toast.tsx';
import { nav, screen } from '../shell/nav.ts';
import { act, source } from '../shell/store.ts';
import type { Params } from '../shell/types.ts';
import { waitTone } from './model.ts';

/** The 44 px wait ring round a face (P10's ring): the hour a chat waits; no saved name, a dashed ring; whose chat at its foot. */
export function Ring(p: { face: Face | null; mins: number | null; badge?: Face | null }): JSX.Element {
  return <RingAvatar face={p.face} tone={p.mins == null ? 'late' : waitTone(p.mins)} fill={p.mins == null ? 0 : Math.min(1, p.mins / 60)} badge={p.badge} />;
}

export function Dots(): JSX.Element {
  return <span aria-hidden="true" class="ch-dots" style={{ display: 'flex', gap: '3px' }}><i /><i /><i /></span>;
}

/** A photo they sent, in a box of the given size. */
export function Pic(p: { m: Message; w: number | string; h: number; r: number; icon: number; flat?: boolean }): JSX.Element {
  const [link, setLink] = useState<string | null>(p.m.media && !p.m.media.startsWith('aisle:') ? p.m.media : null);
  const aisle = p.m.media && p.m.media.startsWith('aisle:') ? p.m.media.slice(6) : '';
  useEffect(() => {
    if (link || aisle || p.m.dir !== 'in') return;
    source.media(p.m.id).then((x) => setLink(x.link), () => { /* the placeholder stays */ });
  }, [p.m.id]);
  const a = AISLE[aisleKey(aisle)];
  const style: JSX.CSSProperties = { width: typeof p.w === 'number' ? `${p.w}px` : p.w, height: `${p.h}px`, borderRadius: `${p.r}px`,
    background: link ? '#E6E3DD' : p.flat ? `linear-gradient(160deg, ${a.soft} 0%, #FFFFFF 160%)` : `linear-gradient(145deg, ${a.soft} 0%, #FFFFFF 150%)`,
    boxShadow: p.flat ? undefined : 'inset 0 0 0 1px rgba(0,0,0,.05)' };
  return (
    <span role="img" aria-label={p.m.body ? `Their photo: ${p.m.body}` : 'Their photo'} class="ch-pic" style={style}>
      {link ? <img src={link} alt="" /> : aisle ? <Duo i={a.i} size={p.icon} color={a.ink} /> : <Icon name="camera" size={p.icon} stroke={1.8} style={{ color: '#5F6980' }} />}
    </span>
  );
}

/** Open a screen by its ROUTES.md id; a tab not built yet opens nothing. */
export function open(id: string, params: Params = {}): void {
  if (screen(id)) nav.push(id, params);
}

/** Each write that landed or was kept (a chat reads its thread again). */
export const wrote = signal(0);

/** A write, worded: done (ok), kept on this phone, or refused with the server's reason. Resolves true when it landed or was kept. */
export async function write(kind: Parameters<typeof act>[0], args: unknown[], done?: string): Promise<boolean> {
  try {
    const r = await act(kind, ...args);
    wrote.value += 1;
    if (r.kept) toast.show('Kept on this phone', { kind: 'warn' });
    else if (done) toast.show(done);
    return true;
  } catch (e) {
    toast.show(isDataError(e) && e.kind === 'offline' ? 'No signal' : 'Not sent', { kind: 'error', sub: (e as Error).message });
    return false;
  }
}
