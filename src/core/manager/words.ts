/*
 * The Manager's words, once (docs/audit/manager/handover.md §3, the agreed words;
 * docs/audit/GLOSSARY.md). A screen never spells an ask or an answer itself: it
 * takes them from here, so the asker's app, the push and the Manager say the same.
 */
import type { AskKind, PriceMode, Stage, TeamRole } from './types.ts';

export const STAGE: Record<Stage, string> = {
  draft: 'Checking',
  awaiting_goods: 'Buying',
  preparing: 'Packing',
  pending_delivery: 'On the road',
  completed: 'Delivered',
  cancelled: 'Cancelled',
};

/** The four stages an order moves through on the Manager's tiles, then Delivered. */
export const STAGES: Stage[] = ['draft', 'awaiting_goods', 'preparing', 'pending_delivery', 'completed'];

export const ROLE: Record<TeamRole, string> = {
  sales: 'Sales', buyer: 'Buyer', store: 'Store', accounts: 'Accounts', sourcing: 'Sourcing',
  agent: 'Agent', driver: 'Driver', manager: 'Manager', owner: 'Owner',
};

/** The ask's title on the sheet, the row and the push (§3 "Ask word"). */
export function askWord(kind: AskKind, mode?: PriceMode | 'limit' | 'age' | 'nolimit', loss?: 'damaged' | 'lost' | 'stolen'): string {
  switch (kind) {
    case 'price': return mode === 'coming' ? 'Price coming' : mode === 'up' ? 'Price up' : 'Under the shop\'s price';
    case 'counter': return 'At the counter · under the shop\'s price';
    case 'markup': return 'A new item to price';
    case 'credit': return 'On credit?';
    case 'storecredit': return 'Not paid yet · on credit?';
    case 'limit': return 'Credit asked';
    case 'bill': return 'Can\'t bill itself';
    case 'given': return 'Can\'t bill itself · a line at 0';
    case 'short': return 'Packed short';
    case 'checkin': return 'check-in differs';
    case 'extra': return 'Not on the list · keep it?';
    case 'loss': return loss === 'lost' ? 'Lost' : loss === 'stolen' ? 'Stolen' : 'Damaged';
    case 'count': return 'A count to check';
    case 'return': return 'Return asked';
    case 'void': return 'Void asked';
    case 'cancel': return 'Cancel asked';
    case 'twins': return 'Taken twice?';
    case 'agent': return 'asks: fewer';
  }
  return '';
}

/** The reason chip under a credit ask (§3: Over the limit · Old bill · 34 days · No limit set). */
export function creditChip(why: 'limit' | 'age' | 'nolimit', oldDays: number): string {
  if (why === 'nolimit') return 'No limit set';
  if (why === 'age') return `Old bill · ${oldDays} days`;
  return 'Over the limit';
}

/** Why the hourly run could not bill an order, by the database's code (handover M-34). */
export function heldWord(code: string, total: number): string {
  switch (code) {
    case 'OWSML': return `Only ${total.toLocaleString('en-US')} · check it`;
    case 'OWGIV': return 'A line at 0 · given away?';
    case 'OWTPC':
    case 'OWPRC': return 'Price coming';
    case 'OWSHP': return 'Packed short';
    default: return 'Open it';
  }
}

/** The answers (Manager's buttons = asker's screen = push title). */
export const ANSWER = {
  approved: 'Approved',
  priceSet: 'Price set',
  shopsPrice: 'Shop\'s price',
  markup: 'Markup',
  onCredit: 'On credit',
  cashFirst: 'Cash first',
  loadIt: 'On credit · load it',
  itStays: 'Cash first · it stays',
  cashOnly: 'Cash only',
  billIt: 'Bill it',
  givenAway: 'Given away',
  billWent: 'Bill what went',
  billAll: 'Bill it all',
  takeCheckin: 'Take the check-in',
  keepIt: 'Keep it',
  goesBack: 'It goes back',
  writtenOff: 'Written off',
  keptShelf: 'Kept on the shelf',
  countTaken: 'Count taken',
  countAgain: 'Count it again',
  creditNote: 'Credit note raised',
  keptSold: 'Kept as sold',
  voided: 'Voided',
  keptBilled: 'Kept as billed',
  refund: 'Refund',
  deposit: 'Deposit',
  cancelled: 'Cancelled',
  kept: 'Kept',
  bothReal: 'Both are real',
  agreed: 'Agreed',
  notYet: 'Not yet',
  goAhead: 'Go ahead',
  shelfOk: 'Shelf part OK',
  orderOnly: 'Order only',
  promised: 'Promised',
  nudged: 'Nudged',
} as const;

/** The one reason list for a bill or order that goes (handover M-21). */
export const REASONS = ['Entered twice', 'Wrong customer', 'Wrong price', 'Damaged', 'Changed their mind', 'Something else'] as const;

/** Why a line is given away (D-10, DecideOrders p5). */
export const GIVEN_WHY = ['Sample', 'Goodwill', 'Replacement', 'Other'] as const;

/** "{names} see(s)": "Grace sees", "Musa · Grace see". */
export function whoSee(names: string[]): string {
  const n = names.filter(Boolean);
  if (!n.length) return '';
  return n.join(' · ') + (n.length === 1 ? ' sees' : ' see');
}

/** "1 h 05", "25 m", "3 h", "2 d": how long an ask has waited (the age chip). */
export function waited(fromMs: number, nowMs: number): string {
  const m = Math.max(0, Math.round((nowMs - fromMs) / 60000));
  if (m < 60) return `${m} m`;
  const h = Math.floor(m / 60), r = m % 60;
  if (h < 24) return r ? `${h} h ${String(r).padStart(2, '0')}` : `${h} h`;
  return `${Math.floor(h / 24)} d`;
}

/** "2 h 40 m": a stage clock (Orders, Stuck). */
export function inStage(mins: number): string {
  const m = Math.max(0, Math.round(mins));
  const h = Math.floor(m / 60), r = m % 60;
  return h ? `${h} h ${r} m` : `${r} m`;
}

/** A limit in minutes as the Goals page says it: 2 h · 1 d · 4 h. */
export function limitWord(mins: number): string {
  if (!mins) return 'no limit';
  if (mins % 1440 === 0) return `${mins / 1440} d`;
  if (mins % 60 === 0) return `${mins / 60} h`;
  return `${mins} m`;
}
