/*
 * Where a line to buy stands, in the one set of words Sales, the Buyer and the Manager share
 * (cross-app round 1, X-2 · SAL-1 · BUY-3; docs/audit/GLOSSARY.md; handover.md §6). One rule:
 * the Buyer's lineState and the Sales order page both call this; neither works it out again.
 *
 * The order of the checks is the rule: off the bill first, the yard next, then who buys it, then the
 * price, then the supplier's answer. A line with nothing on the shelf and no supplier "Needs a supplier"
 * (the server's Checking gate calls it 'unsourced', 0174) unless the client waits while Sourcing looks.
 * A line placed with no selling price ("Price coming", items[].priceAsk) is still asked of its supplier:
 * only a cost that rose past a price ("Price up") waits for the Manager before the ask.
 */
export type LineWord = 'toask' | 'asked' | 'found' | 'notfound' | 'priceup' | 'nosupplier' | 'clientwaits' | 'removed' | 'ontrip' | 'short' | 'in';

export interface LineFacts {
  removed: boolean;
  /** What came in; null before the goods. */
  got: number | null;
  qty: number;
  /** null or '' when nobody buys it yet. */
  supplierId: string | null;
  clientWaits: boolean;
  onTrip: boolean;
  /** The Manager decides a price on it. */
  priceWaits: boolean;
  /** …only because it was placed with no selling price (Price coming): asked all the same. */
  priceComing: boolean;
  asked: boolean;
  answer: 'found' | 'notfound' | null;
}

export function lineWord(f: LineFacts): LineWord {
  if (f.removed) return 'removed';
  if (f.got != null) return f.got < f.qty ? 'short' : 'in';
  if (!f.supplierId) return f.clientWaits ? 'clientwaits' : 'nosupplier';
  if (f.onTrip) return 'ontrip';
  if (f.priceWaits && !f.priceComing) return 'priceup';
  if (!f.asked) return 'toask';
  if (f.answer === 'found') return 'found';
  if (f.answer === 'notfound') return 'notfound';
  return 'asked';
}

/** The word each app shows. */
export const LINE_WORD: Record<LineWord, string> = {
  toask: 'To ask', asked: 'Asked', found: 'Found', notfound: 'Not found', priceup: 'Price up', nosupplier: 'Needs a supplier',
  clientwaits: 'Client waits', removed: 'Removed', ontrip: 'On the trip', short: 'Short', in: 'In',
};

/** A tick: only what is sure to come (Found, In) — never a line nobody has asked for or nobody sells. */
export const sure = (w: LineWord): boolean => w === 'found' || w === 'in' || w === 'ontrip';
