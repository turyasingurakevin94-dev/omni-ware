/*
 * Who is on now (member_presence, 0170), written as the old app wrote it (sales.html chTouch,
 * chPresenceTick): touch_presence every 20 s while the app is on the screen, with the chat that is open,
 * and "typing" at most every 8 s while a reply is typed. The write is the shop's own function
 * (security definer, a member of the shop only), so a Sales login may make it. Without it everyone on
 * the new app, the person holding the phone too, read as away ("0 on").
 */
import { stack } from './nav.ts';
import { source } from './store.ts';

const EVERY = 20000, TYPING = 8000;
let seenAt = 0, typedAt = 0;

/** The chat open on top, if any (chats/chat { id }). */
function openChat(): number | null {
  const t = stack.value[stack.value.length - 1];
  return t && t.id === 'chats/chat' && t.params.id != null ? Number(t.params.id) : null;
}

/** When to write: a touch at most every 20 s, a typing touch at most every 8 s (sales.html:9865). */
export function due(now: number, typing: boolean, last: { seen: number; typed: number }): boolean {
  return typing ? now - last.typed >= TYPING : now - last.seen >= EVERY;
}

function touch(typing: boolean, force = false): void {
  const now = Date.now();
  if (!source || (!force && !due(now, typing, { seen: seenAt, typed: typedAt }))) return;
  if (typing) typedAt = now;
  seenAt = now;
  source.touch(openChat(), typing);
}

/** A reply is being typed in the chat on top. */
export function typingNow(): void { touch(true); }

export function startPresence(): void {
  const tick = () => { if (document.visibilityState === 'visible') touch(false); };
  setInterval(tick, EVERY);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') touch(false, true); });
  setTimeout(() => touch(false, true), 1500);
}
