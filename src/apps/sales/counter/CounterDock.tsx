/*
 * The counter's dock (P15 with S02 inside), from the shared parts: Dock, MethodPicker, TheyGave,
 * RefField, Slide (its lock and sending looks), Notice (under the dock), FailCard. Its states, one
 * per board:
 *   empty KC01 · cash KC03 (Exact chosen), KC05 (change), KC07 (short) · counted KC06 → fourth tile ·
 *   mobile KC08 (the ID first), KC09 (ID in) · under the shop's price KC10 (Ask Ruth first) ·
 *   short on the shelf KC18 · sending KC13 · no signal KC17 · not sold KC19 (above the dock).
 * What stays here is the counter's own: paste reads the ID out of their SMS.
 */
import type { JSX } from 'preact';
import { Dock } from '../../../ui/Dock.tsx';
import { toast } from '../../../ui/toast.tsx';
import './dock.css';

export function EmptyDock(): JSX.Element {
  return <Dock above={null} words="Counter sale" total={null} slide={{ label: 'Add an item to sell', onCommit: () => undefined }} />;
}

/** Paste: the ID out of the SMS they showed (MTN "ID: 12045889301", or any long number). */
export async function pasteRef(onInput: (v: string) => void): Promise<void> {
  try {
    const t = await navigator.clipboard.readText();
    const id = (t.match(/ID\s*:?\s*([A-Z0-9]{6,})/i) || t.match(/(\d{8,})/) || [])[1];
    if (id) onInput(id); else toast.show('Copy the SMS first', { kind: 'warn' });
  } catch (_e) { toast.show('Copy the SMS first', { kind: 'warn' }); }
}
