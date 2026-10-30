/*
 * The Sell tab's sheets, opened from one place (P17; sheets are not routes):
 *   openPrice        SL18–SL20  their price on a line, on a keypad
 *   openPriceComing  SL21       an item with no selling price yet
 *   openCharge       SL16       a charge at the shop's rate
 *   openAmount                  any other amount (a charge, the delivery fee), on the same keypad
 *   openDelivery     SL17       the shop delivers: where, the site phone, when, the fee
 *   openSwitch       SL26       another customer: the lines go along, or this order waits
 *   openVoice        SL10       say it
 *   openAisles       SL11       browse the shop;  openAisle → sell/aisle (SL12)
 */
import { sheet } from '../../../ui/sheet.tsx';
import { nav } from '../shell/nav.ts';
import { AislesSheet } from './AislesSheet.tsx';
import { AmountSheet } from './AmountSheet.tsx';
import { ChargeSheet } from './ChargeSheet.tsx';
import { ComingSheet } from './ComingSheet.tsx';
import { DeliverySheet } from './DeliverySheet.tsx';
import { PriceSheet } from './PriceSheet.tsx';
import { PickSheet, SwitchSheet } from './SwitchSheet.tsx';
import { VoiceSheet } from './VoiceSheet.tsx';

export function openPrice(lineId: number): void {
  sheet.open(() => <PriceSheet lineId={lineId} />, { label: 'Their price', top: 150 });
}
export function openPriceComing(itemId: string, lineId: number | null, qty?: number): void {
  sheet.open(() => <ComingSheet itemId={itemId} lineId={lineId} qty={qty} />, { label: 'No selling price yet', top: 282 });
}
export function openCharge(): void {
  sheet.open(() => <ChargeSheet />, { label: 'Add a charge', top: 380 });
}
export function openAmount(o: { title: string; eyebrow?: string; value: number; onUse: (n: number) => void }): void {
  sheet.open(() => <AmountSheet {...o} />, { label: o.title, top: 150 });
}
export function openDelivery(): void {
  sheet.open(() => <DeliverySheet />, { label: 'The shop delivers', top: 214 });
}
export function openSwitch(): void {
  sheet.open(() => <PickSheet />, { label: 'Who is it for?', top: 40 });
}
export function openSwitchTo(customerId: string): void {
  sheet.open(() => <SwitchSheet to={customerId} />, { label: 'Change the customer', top: 480 });
}
export function openVoice(): void {
  sheet.open(() => <VoiceSheet />, { label: 'Say it' });
}
export function openAisles(): void {
  sheet.open(() => <AislesSheet />, { label: 'Browse the shop', top: 84 });
}
export function openAisle(aisle: string, group?: string): void {
  sheet.close();
  nav.push('sell/aisle', group ? { aisle, group } : { aisle });
}
