/*
 * sell/order · building an order (SL03–SL27, SL30, SL31): the top bar (who
 * it is for, "Add an item" with "Say it", the aisles), what the books
 * suggest for an empty order, the lines, what they take with them, the
 * order's foot, and the dock that places it.
 *
 * Opened with { customer } (a regular, "" for a walk-in), { draft } (an
 * order still open), { customer, from: 'usual' | 'again' } (their usual or
 * last order in it), or { customer, from: 'chat', chat } (what they asked on
 * WhatsApp: SL04).
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { isDataError } from '../../../core/datasource.ts';
import type { Books, Order } from '../../../core/types.ts';
import { Notice } from '../../../ui/Notice.tsx';
import { toast } from '../../../ui/toast.tsx';
import { TopBar, WhoPill } from '../../../ui/TopBar.tsx';
import { nav, stack } from '../shell/nav.ts';
import { act, books, flush, me, now, online } from '../shell/store.ts';
import type { ScreenProps } from '../shell/types.ts';
import { askMatch, ChatAsk, fromChat } from './ChatAsk.tsx';
import { enterFind, Find } from './Find.tsx';
import { CreditLine, Foot } from './Foot.tsx';
import { whoLine } from './insights.ts';
import { closeLine, Lines } from './Lines.tsx';
import { cur, customerOf, forget, keep, plain, query, resume, start, toDraft } from './model.ts';
import { OrderDock } from './OrderDock.tsx';
import { sendPicture } from './picture.ts';
import { openAisles, openSwitch, openVoice } from './sheets.tsx';
import { sellAgain, Start, usualInto } from './Start.tsx';
import { Suggest } from './Suggest.tsx';
import './order.css';

function init(b: Books, p: ScreenProps['params']): void {
  if (typeof p.draft === 'string' && p.draft) { if (resume(p.draft)) return; }
  const id = typeof p.customer === 'string' && p.customer ? p.customer : null;
  if (cur.value && cur.value.customerId === id && !p.from && !p.draft) return;
  start(id, { chatId: typeof p.chat === 'number' ? p.chat : null });
  if (id && p.from === 'usual') usualInto(b, id);
  if (id && p.from === 'again') sellAgain(b, id);
  if (p.from === 'chat' && typeof p.chat === 'number') fromChat(b, p.chat);
}

/** Close the order: what is in it is kept under "Still open". */
function close(): void {
  closeLine();
  keep();
  cur.value = null;
  query.value = '';
  if (stack.value.length > 1) nav.back(); else nav.home();
}

export function OrderScreen(p: ScreenProps): JSX.Element {
  const b = books.value;
  const [ready] = useState(() => { if (b) init(b, p.params); return !!b; });
  const [sending, setSending] = useState(false);
  if (b && !ready && !cur.value) init(b, p.params);
  const x = cur.value;
  if (!b || !x) return <main class="sl-order" aria-busy="true" />;
  const c = customerOf(b, x.customerId), mine = me.value ? me.value.id : '';
  const line = c ? whoLine(b, c, now.value) : null;
  const typing = query.value.trim().length > 0;

  const place = async (): Promise<void> => {
    closeLine();
    const now = cur.value;
    if (!now) return;
    setSending(true);
    try {
      const r = await act<Order>('placeOrder', toDraft(now));
      if (r.kept) { toast.show('Kept on this phone', { kind: 'warn', sub: 'It places when the signal is back' }); return; }
      const o = r.value;
      forget(now.key);
      cur.value = null;
      if (now.pic && now.chatId != null) void sendPicture(o, now.chatId);
      nav.replace('sell/placed', { id: o.id });
    } catch (e) {
      const why = isDataError(e) && e.code === 'OWCST' ? 'A price is under what it costs the shop' : (e as Error).message;
      toast.show('Not placed', { kind: 'error', sub: why, retry: () => void place() });
    } finally {
      setSending(false);
    }
  };

  return (
    <div class="sl-order">
      <TopBar onClose={close}
        who={c ? <WhoPill on={() => openSwitch()} face={{ initials: c.initials, tint: c.tint }} name={c.name} sub={line ? line.text : ''} dot={line ? line.dot : undefined} />
          : <WhoPill on={() => openSwitch()} face={{ initials: 'WI', tint: 't4' }} name="Walk-in order" sub="no name · the shop packs it" dot="#9AA1AE" />}
        search={{ placeholder: 'Add an item', label: 'Add an item: type its name', value: query.value, onInput: (v) => { query.value = v; }, onEnter: () => enterFind(), onMic: openVoice }}
        onAisles={openAisles} />
      <main class={'sl-main' + (typing ? ' find' : !c && x.lines.length === 0 ? ' walkin' : '')}>
        {typing ? <Find b={b} c={c} />
          : x.lines.length === 0 ? <Start b={b} c={c} />
          : (
            <>
              <ChatAsk b={b} c={c} />
              <div class={'sl-first' + (plain.value ? ' fill' : '') + (askMatch(b, c) ? ' asked' : '')}>
                <Lines me={mine} extra={<CreditLine b={b} />} />
                {plain.value && <Suggest b={b} c={c} />}
              </div>
              <Foot b={b} c={c} />
            </>
          )}
      </main>
      {!online.value && (
        <Notice kind="offline" class="sl-notice" action={{ label: 'Try again', on: () => { void flush(); } }}>No signal · kept on this phone</Notice>
      )}
      <OrderDock onPlace={place} sending={sending} />
    </div>
  );
}
