/*
 * ?demo&parts=try: the parts that act, wired up live at 360 wide, so their
 * behaviour can be tried by hand and by test/ui-parts.test.js: the slide
 * drags and commits (and Undo undoes it), a light sheet opens and closes
 * with a drag, a full sheet goes back by its strip, the stepper counts, the
 * keypad types, chips and methods choose. #log says what happened.
 */
import { signal } from '@preact/signals';
import type { JSX } from 'preact';
import { orderNo } from '../../core/names.ts';
import type { Method } from '../../core/types.ts';
import { Button } from '../Button.tsx';
import { Composer } from '../Composer.tsx';
import { Dock, type Mode } from '../Dock.tsx';
import { FullSheet, SheetHead } from '../FullSheet.tsx';
import { Keypad, PriceField } from '../Keypad.tsx';
import { MethodPicker } from '../PayMethod.tsx';
import { ChipRow, FilterChip } from '../Pill.tsx';
import { LightSheet, SheetHost, sheet } from '../sheet.tsx';
import { Stepper } from '../Stepper.tsx';
import { ToastHost, toast } from '../toast.tsx';
import { Track } from '../Track.tsx';

const placed = signal(0), qty = signal(40), typed = signal('365'), chip = signal('all'), mode = signal<Mode>('pickup');
const method = signal<Method>('cash'), text = signal(''), order = signal(false), sent = signal<string[]>([]), log = signal<string[]>([]);
const say = (s: string) => { log.value = [...log.value, s]; };

function place(): Promise<void> {
  return new Promise((done) => window.setTimeout(() => {
    placed.value += 1; say(`placed ${placed.value}`);
    toast.show(`Placed ${orderNo(557 + placed.value)}`, { undo: () => { placed.value -= 1; say(`undone ${placed.value}`); } });
    done();
  }, 250));
}

function openSheet(): void {
  say('sheet open');
  sheet.open(() => (
    <LightSheet title="Who is it for?" onClose={() => sheet.close()} foot={<Button onClick={() => sheet.close()}>Done</Button>}>
      <span style={{ fontSize: '14px', color: '#5F6980' }}>Pull me down to close.</span>
      <div style={{ height: '220px' }} />
    </LightSheet>
  ), { label: 'Who is it for?', top: 300, onClose: () => say('sheet closed') });
}

export function TryBoard(): JSX.Element {
  return (
    <div class="g-try">
      <ChipRow label="Show">
        {['all', 'checking', 'packing'].map((c) => <FilterChip key={c} on={chip.value === c} onClick={() => { chip.value = c; say('chip ' + c); }}>{c}</FilterChip>)}
      </ChipRow>
      <div class="ow-row"><Stepper value={qty.value} unit="pc" what="iron sheets" onChange={(n) => { qty.value = n; say('qty ' + n); }} /></div>
      <PriceField label="Their price, each" value={Number(typed.value || 0)} />
      <Keypad value={typed.value} onChange={(v) => { typed.value = v; say('typed ' + v); }} />
      <MethodPicker value={method.value} onChange={(m) => { method.value = m; say('method ' + m); }} />
      <Button kind="ghost" onClick={openSheet}>Open a sheet</Button>
      <Button kind="ghost" onClick={() => { order.value = true; say('order open'); }}>Open one order</Button>
      <Composer to="Kato" toName="Kato Construction" value={text.value} onInput={(v) => { text.value = v; }} onSend={(v) => { sent.value = [...sent.value, v]; text.value = ''; say('sent ' + v); }} onMic={() => say('mic')} />
      <output id="log">{log.value.join('\n')}</output>
      <div style={{ height: '200px' }} />
      <Dock mode={{ value: mode.value, onChange: (m) => { mode.value = m; say('mode ' + m); } }} total={1750000 * (placed.value + 1)} sub={{ text: `${placed.value} placed`, tone: 'mint' }}
        slide={{ label: 'Slide to place · 3 items', knobLabel: 'Place this order', onCommit: place, onHint: () => { say('hint'); toast.show('Slide the red button across', { kind: 'warn' }); } }} />
      {order.value && (
        <FullSheet onBack={() => { order.value = false; say('order closed'); }} backLabel="Back to Orders"
          head={<SheetHead face={{ initials: 'KC', tint: 't0' }} name="Kato Construction" sub="#0552 · today 9:14" subMono phone="0772418220" onClose={() => { order.value = false; say('order closed'); }}>
            <Track stage="packing" sub="Musa · since 10:05" times={{ checking: '9:14', buying: '9:31' }} />
          </SheetHead>}>
          <span style={{ fontSize: '14px' }}>One order, over the screen it came from.</span>
        </FullSheet>
      )}
      <SheetHost />
      <ToastHost above={170} />
    </div>
  );
}
