/*
 * What the Chats screens show, derived once from the store (books, chats, the clock, drafts,
 * the outbox). Screens read these; they never re-derive a rule. The waiting rule itself is
 * src/core/chats.ts (the tab bar's count reads it too).
 *
 *   chatView(c)        one chat as a row or a head shows it: who, whose, wait, unread, typing, window
 *   salesTeam()        the people who answer chats: you first, then the team in the shop's order
 *   mineList()         the Mine list: new numbers, then yours waiting (longest first), then yours by who is due
 *   waitLine(scope)    the head's wait line: each chat waiting, placed by minutes on the 0–1 h track
 */
import type { Face } from '../../../ui/Avatar.tsx';
import { waitingChats, type Waiting } from '../../../core/chats.ts';
import { rhythm } from '../../../core/customers.ts';
import { firstWord, initials, phoneText, tintFor } from '../../../core/names.ts';
import { dayLabel, dayOf, daysApart, replyWindow, weekday, clock } from '../../../core/time.ts';
import type { Books, Chat, ChatBooks, Customer, Member, Message, Ms } from '../../../core/types.ts';
import type { Draft } from '../shell/store.ts';

/** A week: an older chat is not in Mine (core's WAIT_MAX_MS); search and New chat still find it. */
export const MINE_DAYS = 7;
/** Wait past this is late (the wait line's "30 m · late"; the ring turns crimson). */
export const LATE_MINS = 30;

export interface ChatView {
  chat: Chat;
  customer: Customer | null;
  /** The customer's name, else the number ("0701 552 904"). */
  title: string;
  /** null: a number nobody saved (the phone disc). */
  face: Face | null;
  /** Their name on WhatsApp when not saved ("Mama Shine"). */
  waName: string;
  owner: Member | null;
  last: Message | null;
  /** Minutes they have waited for a reply, or null when nobody waits. */
  waitMins: number | null;
  unread: number;
  /** A teammate typing in it, and a teammate who has it open. */
  typing: Member | null;
  looking: Member | null;
  window: ReturnType<typeof replyWindow>;
  /** Shut and quiet for a day: the lock in the list. */
  asleep: boolean;
  /** An order started from this chat and not placed yet (the row opens it). */
  draft: Draft | null;
}

export function customerOf(b: Books, c: Chat): Customer | null {
  return c.customerId ? b.customers.find((x) => x.id === c.customerId) || null : null;
}

export function memberOf(b: Books, id: string | null): Member | null {
  return id ? b.members.find((m) => m.id === id) || null : null;
}

/** In from them since we last spoke or read: the unread count. */
function unreadOf(c: Chat, msgs: Message[]): number {
  const outs = msgs.filter((m) => m.dir === 'out');
  const from = Math.max(c.lastReadAt || 0, outs.length ? outs[outs.length - 1].at : 0);
  return msgs.filter((m) => m.dir === 'in' && m.at > from).length;
}

export function chatView(b: Books, cb: ChatBooks, c: Chat, now: Ms, drafts: Draft[], waiting?: Waiting[]): ChatView {
  const cust = customerOf(b, c), msgs = cb.recent.filter((m) => m.chatId === c.id);
  const w = (waiting || waitingChats(cb, b.me.id, now, 'team')).find((x) => x.chat.id === c.id);
  const others = b.members.filter((m) => m.id !== b.me.id);
  const win = replyWindow(c.lastInAt, now);
  return {
    chat: c, customer: cust,
    title: cust ? cust.name : c.phone,
    face: cust ? { initials: cust.initials, tint: cust.tint } : null,
    waName: c.profileName,
    owner: memberOf(b, c.ownerId),
    last: msgs.length ? msgs[msgs.length - 1] : null,
    waitMins: w ? Math.max(0, Math.floor((now - w.since) / 60000)) : null,
    unread: unreadOf(c, msgs),
    typing: others.find((m) => m.typingIn === c.id) || null,
    looking: others.find((m) => m.inChat === c.id) || null,
    window: win,
    asleep: !win.open && !!c.lastAt && now - c.lastAt > 24 * 3600 * 1000,
    draft: drafts.find((d) => d.chatId === c.id) || null,
  };
}

/** The counter's shared login rings up sales; it is not a person who answers chats. */
const isPerson = (m: Member) => !/^counter$/i.test(m.name.trim());

/** The people who answer chats (the Sales team): you first, then the shop's own order of its people. */
export function salesTeam(b: Books): Member[] {
  const team = b.members.filter((m) => m.role === 'sales' && isPerson(m));
  return [...team.filter((m) => m.id === b.me.id), ...team.filter((m) => m.id !== b.me.id)];
}

/** The Manager(s), who move any chat. */
export function managers(b: Books): Member[] {
  return b.members.filter((m) => m.role === 'manager');
}

export function ownedBy(cb: ChatBooks, id: string): Chat[] {
  return cb.chats.filter((c) => c.ownerId === id);
}

/** A customer's next due day by their rhythm (core/customers.ts: last order placed plus every N days). */
export function dueDay(b: Books, cust: Customer | null, today: string): string | null {
  return cust ? rhythm(cust, b.orders, today).next : null;
}

const recent = (c: Chat, now: Ms) => !!c.lastAt && daysApart(dayOf(c.lastAt), dayOf(now)) < MINE_DAYS;

/**
 * Mine's count (the head's "Chats N" and the Mine chip): exactly what Mine lists (CH01: the new number and
 * Grace's five of this week, 6). Kevin's phone said "Mine 2" over an empty list: two chats older than a week.
 */
export function mineCount(b: Books, cb: ChatBooks, now: Ms): number {
  return mineList(b, cb, now, []).length;
}

/** Mine: the numbers nobody has taken (newest first), yours waiting (longest first), then yours by who is due soonest; this week's. */
export function mineList(b: Books, cb: ChatBooks, now: Ms, drafts: Draft[]): ChatView[] {
  const waiting = waitingChats(cb, b.me.id, now, 'team');
  const view = (c: Chat) => chatView(b, cb, c, now, drafts, waiting);
  const fresh = cb.chats.filter((c) => !c.ownerId && recent(c, now)).sort((x, y) => (y.lastAt || 0) - (x.lastAt || 0)).map(view);
  const mine = cb.chats.filter((c) => c.ownerId === b.me.id && recent(c, now)).map(view);
  const due = (v: ChatView) => dueDay(b, v.customer, dayOf(now)) || '9999';
  const wait = mine.filter((v) => v.waitMins != null).sort((x, y) => (y.waitMins as number) - (x.waitMins as number));
  const rest = mine.filter((v) => v.waitMins == null).sort((x, y) => due(x).localeCompare(due(y)));
  return [...fresh, ...wait, ...rest];
}

export interface WaitMark { key: number; face: Face | null; title: string; mins: number; pct: number; offset: number; more?: number }

/** The track's width at 360 (the head's 16 px sides, the track's 4), a face's room on it, the most faces in one place. */
const TRACK = 320, ROOM = 24, MOST = 3;

/**
 * Where the faces go: chats whose faces would touch share a place, side by side round the middle of their
 * minutes (two at 12 m sit either side of 12 m, as CH01 draws); past three in one place, two faces and "+n".
 */
export function placeMarks(marks: WaitMark[], track = TRACK): WaitMark[] {
  let groups = marks.map((m) => ({ ms: [m], at: (m.pct / 100) * track }));
  for (let merged = true; merged;) {
    merged = false;
    for (let i = 0; i + 1 < groups.length; i++) {
      const a = groups[i], b = groups[i + 1];
      if (b.at - (b.ms.length * ROOM) / 2 < a.at + (a.ms.length * ROOM) / 2) {
        const ms = [...a.ms, ...b.ms];
        groups.splice(i, 2, { ms, at: ms.reduce((s, m) => s + (m.pct / 100) * track, 0) / ms.length });
        merged = true;
        break;
      }
    }
  }
  groups = groups.map((g) => (g.ms.length <= MOST ? g : { ...g, ms: [...g.ms.slice(0, MOST - 1), { ...g.ms[MOST - 1], key: -g.ms[0].key, face: null, more: g.ms.length - (MOST - 1) }] }));
  return groups.flatMap((g) => g.ms.map((m, i) => ({ ...m, offset: Math.round(g.at + (i - (g.ms.length - 1) / 2) * ROOM - (m.pct / 100) * track) })));
}

/** The wait line: each chat waiting at its minutes on a 0–60 track (`marks`); `drawn`: where their faces go (placeMarks). */
export function waitLine(b: Books, cb: ChatBooks, now: Ms, scope: 'mine' | 'team'): { marks: WaitMark[]; drawn: WaitMark[]; oldest: number } {
  const w = waitingChats(cb, b.me.id, now, scope);
  const marks = w.map((x) => {
    const cust = customerOf(b, x.chat), mins = Math.max(0, Math.floor((now - x.since) / 60000));
    return { key: x.chat.id, face: cust ? { initials: cust.initials, tint: cust.tint } : null, title: cust ? cust.name : x.chat.phone, mins, pct: Math.min(60, mins) / 60 * 100, offset: 0 };
  }).sort((x, y) => x.mins - y.mins);
  return { marks, drawn: placeMarks(marks), oldest: marks.reduce((m, x) => Math.max(m, x.mins), 0) };
}

/** A list's time: "10:29" today, "Thu" this week, else "2 Oct" (as WhatsApp lists chats). */
export function listTime(at: Ms | null, now: Ms): string {
  if (!at) return '';
  const days = daysApart(dayOf(at), dayOf(now));
  if (days === 0) return clock(at);
  if (days < 7) return weekday(at);
  return dayLabel(at).replace(/^\w+ /, '');
}

/** The first sentence of what they said, for a quote on a row ("Do you have 3m iron sheets?"). */
export function firstSentence(body: string): string {
  const m = String(body || '').trim().match(/^.*?[?.!](?=\s|$)/);
  return m ? m[0] : String(body || '').trim();
}

/** What a message says on a row: its words, or what it is. */
export function said(m: Message | null): string {
  if (!m) return '';
  if (m.body) return m.body;
  return m.kind === 'image' ? 'Photo' : m.kind === 'audio' ? 'Voice note' : m.kind === 'document' ? 'A file' : m.kind === 'catalog' ? 'The catalogue' : '';
}

/** "Grace's" / "Faith's" (FACTS: whose, never "Yours"). */
export function whose(m: Member | null): string {
  return m ? `${firstWord(m.name)}’s` : 'Nobody’s yet';
}

/** A face for any member. */
export function faceOf(m: { name: string; initials: string; tint: Face["tint"] }): Face {
  return { initials: m.initials || initials(m.name), tint: m.tint || tintFor(m.name) };
}

/** "0701 552 904" for a number with no customer. */
export function phoneOf(c: Chat): string {
  return c.phone || phoneText(c.waId);
}

/** The wait ring's ink: amber, crimson once late. */
export function waitTone(mins: number): 'late' | 'quiet' {
  return mins >= LATE_MINS ? 'quiet' : 'late';
}
