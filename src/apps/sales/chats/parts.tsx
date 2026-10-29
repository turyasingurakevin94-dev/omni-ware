/*
 * The Chats tab's own small parts (local until the lead moves them to src/ui):
 *   Ring       the 44 px wait ring round a face (P10's ring, plus the dashed ring of a number
 *              nobody has saved, and the 22 px face of whose chat it is)
 *   Dots       the three typing dots
 *   Pic        a photo they sent: the picture once its link is known; in the demo, the item's aisle
 *   open       open a screen another tab owns, by its ROUTES.md id
 *   say        word a write's outcome: kept on this phone, or the server's reason
 */
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { isDataError } from '../../../core/datasource.ts';
import type { Message } from '../../../core/types.ts';
import { Avatar, RING_TONE, type Face } from '../../../ui/Avatar.tsx';
import { AISLE, Duo, Icon, aisleKey } from '../../../ui/icons.tsx';
import { toast } from '../../../ui/toast.tsx';
import { nav, screen } from '../shell/nav.ts';
import { act, source } from '../shell/store.ts';
import type { Params } from '../shell/types.ts';
import { waitTone } from './model.ts';

const C = 125.7;

export function Ring(p: { face: Face | null; mins: number | null; badge?: Face | null }): JSX.Element {
  const f = p.mins == null ? 0 : Math.min(1, p.mins / 60);
  return (
    <span aria-hidden="true" class="ch-ring">
      <svg width="44" height="44" viewBox="0 0 44 44">
        {p.face ? <circle cx="22" cy="22" r="20" fill="none" stroke="#EFECE6" stroke-width="3" />
          : <circle cx="22" cy="22" r="20" fill="none" stroke="#9AA1AE" stroke-width="1.5" stroke-dasharray="3 4" />}
        {f > 0 && <circle cx="22" cy="22" r="20" fill="none" stroke={RING_TONE[waitTone(p.mins as number)]} stroke-width="3" stroke-linecap="round"
          stroke-dasharray={`${(C * f).toFixed(1)} ${C}`} transform="rotate(-90 22 22)" />}
      </svg>
      {p.face ? <Avatar {...p.face} size={32} font={12} /> : <span class="ch-ring-ph"><Icon name="phone" size={15} stroke={2} /></span>}
      {p.badge && <Avatar {...p.badge} size={22} class="badge" />}
    </span>
  );
}

export function Dots(): JSX.Element {
  return <span aria-hidden="true" class="ch-dots" style={{ display: 'flex', gap: '3px' }}><i /><i /><i /></span>;
}

/** A photo they sent, in a box of the given size. */
export function Pic(p: { m: Message; w: number | string; h: number; r: number; icon: number }): JSX.Element {
  const [link, setLink] = useState<string | null>(p.m.media && !p.m.media.startsWith('aisle:') ? p.m.media : null);
  const aisle = p.m.media && p.m.media.startsWith('aisle:') ? p.m.media.slice(6) : '';
  useEffect(() => {
    if (link || aisle || p.m.dir !== 'in') return;
    source.media(p.m.id).then((x) => setLink(x.link), () => { /* the placeholder stays */ });
  }, [p.m.id]);
  const a = AISLE[aisleKey(aisle)];
  const style: JSX.CSSProperties = { width: typeof p.w === 'number' ? `${p.w}px` : p.w, height: `${p.h}px`, borderRadius: `${p.r}px`,
    background: link ? '#E6E3DD' : `linear-gradient(145deg, ${a.soft} 0%, #FFFFFF 150%)`, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.05)' };
  return (
    <span aria-hidden="true" class="ch-pic" style={style}>
      {link ? <img src={link} alt="" /> : aisle ? <Duo i={a.i} size={p.icon} color={a.ink} /> : <Icon name="camera" size={p.icon} stroke={1.8} style={{ color: '#5F6980' }} />}
    </span>
  );
}

/** Open a screen by its ROUTES.md id; a tab not built yet opens nothing. */
export function open(id: string, params: Params = {}): void {
  if (screen(id)) nav.push(id, params);
}

/** A write, worded: done (ok), kept on this phone, or refused with the server's reason. Resolves true when it landed or was kept. */
export async function write(kind: Parameters<typeof act>[0], args: unknown[], done?: string): Promise<boolean> {
  try {
    const r = await act(kind, ...args);
    if (r.kept) toast.show('Kept on this phone', { kind: 'warn' });
    else if (done) toast.show(done);
    return true;
  } catch (e) {
    toast.show(isDataError(e) && e.kind === 'offline' ? 'No signal' : 'Not sent', { kind: 'error', sub: (e as Error).message });
    return false;
  }
}
