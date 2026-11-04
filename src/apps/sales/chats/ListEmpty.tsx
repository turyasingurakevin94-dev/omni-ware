/*
 * CH06 · no chats yet: a dashed ghost of the list with the WhatsApp mark, the first moves
 * (the number connected, send it to customers, take the first new number), and one way in:
 * Send the shop's number (the phone's share sheet, else WhatsApp with the number written).
 * CH07 · loading: the real layout as shimmer, "Reading the chats".
 */
import type { JSX } from 'preact';
import { Button } from '../../../ui/Button.tsx';
import { Icon, type IconName } from '../../../ui/icons.tsx';
import { Shim } from '../../../ui/Skeleton.tsx';
import { toast } from '../../../ui/toast.tsx';
import { books } from '../shell/store.ts';

function Ghost(): JSX.Element {
  const row = (a: string, b: string) => <div class="ch-ghost-r"><span /><span><span style={{ height: '12px', width: a }} /><span style={{ height: '10px', width: b }} /></span><span /></div>;
  return (
    <div class="ch-ghost">
      <div><span>Your chats</span><span>fill as customers write</span></div>
      {row('58%', '80%')}
      {row('46%', '64%')}
      <span aria-hidden="true" class="ch-ghost-mark"><Icon name="whatsapp" size={28} stroke={1.8} /></span>
    </div>
  );
}

async function shareNumber(): Promise<void> {
  const b = books.value, phone = b ? b.settings.shopPhone : '', shop = b ? b.shop.name : '';
  const text = `${shop}: write to us on WhatsApp at ${phone}`;
  try {
    if (navigator.share) { await navigator.share({ text }); return; }
  } catch (_e) { return; /* they closed the share sheet */ }
  // Beside the app, never in its place (sales.html:7503 window.open(…, '_blank')).
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
  toast.show('Opening WhatsApp');
}

export function Empty(p: { connected: boolean }): JSX.Element {
  const steps: { done?: boolean; icon: IconName; title: string; sub: string }[] = [
    { done: p.connected, icon: 'check', title: 'The shop’s number is on WhatsApp', sub: p.connected ? 'done · connected' : 'not connected yet' },
    { icon: 'share', title: 'Send customers the number', sub: 'they write, you answer here' },
    { icon: 'check', title: 'Take the first new number', sub: 'first to take it has it' },
  ];
  return (
    <main class="ch-main pad">
      <Ghost />
      <div class="ch-gg"><h2>Get going</h2><span class="mono">{`${steps.filter((s) => s.done).length} of ${steps.length}`}</span></div>
      <div class="ch-steps">
        {steps.map((s) => (
          <div key={s.title} class={'ch-step' + (s.done ? ' done' : '')}>
            <span aria-hidden="true">{s.done ? <Icon name="check" size={14} stroke={3.2} /> : <Icon name={s.icon} size={15} stroke={2} />}</span>
            <span><span>{s.title}</span><span>{s.sub}</span></span>
          </div>
        ))}
      </div>
      <Button icon="share" onClick={() => { void shareNumber(); }}>Send the shop’s number</Button>
    </main>
  );
}

const sk = (w: number | string, h: number, round?: boolean) => <Shim w={w} h={h} round={round} />;

export function Loading(): JSX.Element {
  return (
    <main class="ch-main">
      <div role="group" aria-label="Show" class="ch-chips">
        <button type="button" class="ch-chip on" aria-pressed="true">Mine</button>
        <button type="button" class="ch-chip"><i aria-hidden="true" />Waiting</button>
        <button type="button" class="ch-chip">New</button>
        <button type="button" class="ch-chip">Team</button>
      </div>
      <div class="ch-list">
        <div class="ch-gh" style={{ justifyContent: 'space-between' }}><h2 style={{ flex: 'none' }}>Your chats</h2><span role="status" class="ch-reading"><span aria-hidden="true" />Reading the chats</span></div>
        <div class="ow-group">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} class="ch-sk">{sk(44, 44, true)}<span>{sk('62%', 11)}{sk('84%', 9)}</span><span>{sk(34, 9)}<Shim w={20} h={18} r={999} /></span></div>
          ))}
        </div>
      </div>
    </main>
  );
}
