/*
 * The Ask sheet (board Today, phone 3): a supplier with no WhatsApp. The navy head: the
 * supplier, "No WhatsApp · call", the call button, and what we ask them for (each line,
 * from which salesperson and order, and what it costs). Then "What did they say?":
 *
 *   Yes · same    every line Found at the same price (the ask is marked first, as a call)
 *   New price     the Replies price screen for this supplier (Ruth decides a price over the selling price)
 *   Not found     every line Not found; the salesperson is told (the bell); the first line's Not found sheet opens
 *
 * Sending shows on the button tapped; the others wait. A refusal shows as a toast with Try again.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import type { SupplierGroup } from '../../../core/buyer/rules.ts';
import type { BuyerBooks } from '../../../core/buyer/types.ts';
import { Button } from '../../../ui/Button.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { fig } from '../../../ui/Money.tsx';
import { sheet } from '../../../ui/sheet.tsx';
import { toast } from '../../../ui/toast.tsx';
import { cx } from '../../../ui/util.tsx';
import { nav } from '../shell/nav.ts';
import { act, now } from '../shell/store.ts';
import { whenShort } from '../../../core/time.ts';
import { Chip, FromChip, Sees } from './Rows.tsx';
import { sellersOf, seeWord, unitWord } from './rules.ts';
import { openNotFound } from '../orders/NotFound.tsx';
import { KEPT, KEPT_TOAST } from '../orders/parts.tsx';
import './asksheet.css';

type Pick = 'yes' | 'price' | 'no';

export function openAskSheet(b: BuyerBooks, g: SupplierGroup): void {
  sheet.open(() => <AskSheet b={b} g={g} />, { label: `Ask ${g.supplier.name}` });
}

const initialsOf = (name: string) => name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();

function AskSheet(p: { b: BuyerBooks; g: SupplierGroup }): JSX.Element {
  const { b, g } = p, s = g.supplier, who = sellersOf(b, g.orders);
  const [busy, setBusy] = useState<Pick | null>(null);
  const asked = g.askedAt != null;

  const run = async (pick: Pick): Promise<void> => {
    setBusy(pick);
    try {
      // New price opens at once; the price screen books the ask with the price on Save (BUY-06).
      if (pick === 'price') { sheet.close(); nav.push('replies/price', { supplier: s.id }); return; }
      if (!asked) await act('ask', s.id, 'call');
      const r = await act(pick === 'yes' ? 'answerYes' : 'answerNo', s.id);
      sheet.close();
      if (r.kept) toast.show(KEPT, KEPT_TOAST);
      // Not found: the line's Not found sheet next, as Replies' "No" does (other supplier · client waits · remove);
      // any other line waits on Today's Needs you.
      else if (pick === 'no') openNotFound(g.lines[0].order.id, g.lines[0].line.key);
      else toast.show(`${s.name} · Found`, { sub: who.length ? `${seeWord(who)} it` : undefined });
    } catch (e) {
      setBusy(null);
      toast.show('Not saved', { kind: 'error', sub: String((e as Error).message || e), retry: () => { void run(pick); } });
    }
  };

  return (
    <div class="ow-b-today-ask">
      <div class="ow-b-today-ask-head">
        <button type="button" class="ow-b-today-ask-grab" aria-label="Close" onClick={() => sheet.close()}><i aria-hidden="true" /></button>
        <div class="ow-b-today-ask-who">
          <span aria-hidden="true" class="ow-b-today-ask-tile">{initialsOf(s.name)}</span>
          <div class="ow-b-today-ask-name"><span>{s.name}</span><span>No WhatsApp · call</span></div>
          <a href={`tel:${s.phone.replace(/\s/g, '')}`} class="ow-b-today-ask-call" aria-label={`Call ${s.name}`}><Icon name="phone" size={22} stroke={2} /></a>
        </div>
        <div class="ow-b-today-ask-lines">
          {g.lines.map((r) => (
            <div key={`${r.order.id}-${r.line.key}`} class="ow-b-today-ask-line">
              <div class="ow-b-today-ask-line-t">
                <span>{`${r.line.name} · `}<span class="mono">{r.line.qty}</span>{` ${unitWord(r.line.qty, r.line.unit)}`}</span>
                <span class="ow-b-today-ask-from">From<FromChip b={b} o={r.order} name navy /></span>
              </div>
              <div class="ow-b-today-ask-line-m">
                <span class="mono">{fig(r.line.cost * r.line.qty)}</span>
                <span class="mono">{`${fig(r.line.cost)} a ${r.line.unit}`}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div class="ow-b-today-ask-body">
        <div class="ow-b-today-ask-q">What did they say?</div>
        <Button icon="check" stroke={2.4} state={busy === 'yes' ? 'sending' : busy ? 'disabled' : 'idle'} onClick={() => { void run('yes'); }} label="Yes, same price: Found">Yes · same</Button>
        <div class="ow-b-today-ask-pair">
          <button type="button" class={cx('ow-b-today-ask-alt', 'warn')} disabled={!!busy} aria-busy={busy === 'price' || undefined}
            aria-label="New price: Ruth decides when it is over the selling price" onClick={() => { void run('price'); }}>
            {busy === 'price' ? <span aria-hidden="true" class="ow-spin" /> : <Icon name="trend" size={18} stroke={2} />}New price
          </button>
          <button type="button" class={cx('ow-b-today-ask-alt', 'bad')} disabled={!!busy} aria-busy={busy === 'no' || undefined}
            aria-label={`Not found: ${who.map((m) => m.name.split(' ')[0]).join(' and ')} told`} onClick={() => { void run('no'); }}>
            {busy === 'no' ? <span aria-hidden="true" class="ow-spin" /> : <Icon name="close" size={18} stroke={2.2} />}Not found<Icon name="bell" size={14} stroke={2} />
          </button>
        </div>
        <Sees who={who} class="ow-b-today-ask-sees" tail={<><span style={{ flex: 1 }} />{asked && g.askedAt != null && <span>Asked · <span class="mono">{whenShort(g.askedAt, now.value)}</span></span>}</>}>
          <Chip tone="good">Found</Chip>
        </Sees>
      </div>
    </div>
  );
}
