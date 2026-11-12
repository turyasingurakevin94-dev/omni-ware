/*
 * What a decision kind gives the one Decide sheet (spec 04-screens-manager §3.2): its chip,
 * its evidence, and its dock. Each kind lives in decide/kinds/<kind>.tsx and registers here.
 *
 *   export const short: Kind<ShortAsk> = (c) => ({ chip, evidence: <…/>, dock: { told, word, total, primary, secondary } })
 *
 * A kind never writes by itself: it calls c.tap (a reversible answer: the strip "Approved · #0555 ·
 * Grace sees it" with Undo 10, then the next card) or c.slide (a money or books move: sent at once).
 */
import type { JSX } from 'preact';
import type { WriteName } from '../../../core/manager/source.ts';
import type { Ask, ManagerBooks, Person } from '../../../core/manager/types.ts';

export interface Ctx<A extends Ask = Ask> {
  a: A;
  b: ManagerBooks;
  now: number;
  /** Who asked (or the order's salesperson when the app spotted it). */
  asker: Person | null;
  /** A tap answer: `word` is what the asker sees ("Approved · 46,000"). */
  tap: (word: string, kind: WriteName, args: unknown[]) => void;
  /** A slide answer: sent at once; resolves when the books have it. */
  slide: (word: string, kind: WriteName, args: unknown[]) => Promise<void>;
  /** Kind-local state that survives a redraw (a picked chip, a stepper). */
  pick: <T>(name: string, first: T) => [T, (v: T) => void];
}

export interface DockAnswer { label: string; on: () => void; disabled?: string }
export interface DockSlide { label: string; on: () => Promise<void>; disabled?: string }

export interface Dock {
  /** Who is told (display names): "Musa · Grace see". */
  told: string[];
  /** The answer word they see (the green pill). */
  word: string;
  /** The figure the answer moves, and its line under it ("gain 240,000", "3 bags at cost"). */
  total?: { v: number; sub?: string } | null;
  /** Above the answers: a chip row (limit chips, refund or deposit). */
  above?: JSX.Element | null;
  /** The one primary answer: a white pill (tap) or the red-knob slide. */
  primary: ({ tap: DockAnswer } | { slide: DockSlide });
  /** The outline second answer. */
  secondary?: DockAnswer | null;
}

export interface KindView {
  /** The reason chip under the title ("No limit set", "Nothing paid", "−1,000 under cost"). */
  chip?: { text: string; tone: 'amber' | 'mint' | 'rose' } | null;
  /** Several reason chips (D-3: "Cost 24,000 → 27,000" and "−1,000 under cost"); over `chip`. */
  chips?: { text: string; tone: 'amber' | 'mint' | 'rose' }[];
  /** The asked line after the time when there is no order ("Cement 50 kg · 3 bags", "Denis's trip · Owino"). */
  where?: string;
  /** The title, when the kind words it itself ("Damaged · Cement 50 kg", "Musa's check-in differs"). */
  title?: string;
  evidence: JSX.Element;
  dock: Dock;
}

export type Kind<A extends Ask = Ask> = (c: Ctx<A>) => KindView;
