/*
 * A hired driver (OU03, a sheet over the run): the last hired drivers by their phone, one tap each
 * (the newest picked), each with his plate and where he drove last; his phone checked as a Ugandan
 * mobile; "gets the drop on WhatsApp" (W8a, nothing written); who sees it after the slide; navy
 * "Abudu drives" puts him on the run (the slide on the run still commits).
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { firstWord, orderNo, phoneText } from '../../../core/names.ts';
import { orderFace, yardFace, shortName } from '../../../core/store/faces.ts';
import { hiredPhoneOk, pastHired, type Direction, type Hired } from '../../../core/store/load.ts';
import type { YardBooks } from '../../../core/store/types.ts';
import { dayLabel, daysApart, dayOf, weekday } from '../../../core/time.ts';
import { Icon } from '../../../ui/icons.tsx';
import { LightSheet, sheet } from '../../../ui/sheet.tsx';
import { toast } from '../../../ui/toast.tsx';
import { now, side } from '../shell/store.ts';
import { AfterSlide, seller } from './parts.tsx';

export interface HiredPick { name: string; phone: string; what: string }

/** "Tue" within the week, else "Sat 3 Oct". */
function whenDrove(at: number | null): string {
  if (at == null) return '';
  const d = daysApart(dayOf(at), dayOf(now.value));
  return d > 0 && d < 7 ? weekday(at) : dayLabel(at);
}

function initialsOf(name: string): string {
  const w = name.trim().split(/\s+/);
  return (w.length > 1 ? w[0][0] + w[1][0] : name.slice(0, 2)).toUpperCase();
}

function HiredSheet(p: { d: Direction; b: YardBooks; chosen: HiredPick | null; onPick: (h: HiredPick) => void }): JSX.Element {
  const list = pastHired(p.b, side.value);
  const [sel, setSel] = useState<Hired | null>(list.find((h) => p.chosen && h.phone === p.chosen.phone) || list[0] || null);
  const o = p.d.drops[0].o, from = seller(p.b, o);
  const go = () => {
    if (!sel) return;
    if (!hiredPhoneOk(sel.phone)) { toast.show('His phone is not a mobile number', { kind: 'warn' }); return; }
    p.onPick({ name: sel.name, phone: sel.phone, what: sel.what });
    sheet.close();
  };
  return (
    <LightSheet eyebrow={`${p.d.name.replace(' way', '')} · ${p.d.drops.map((x) => orderNo(x.o.id)).join(' ')}`} title="A hired driver" onClose={sheet.close} class="hd-sheet" pad="12px 16px 20px" gap={8}
      foot={<button type="button" class="hd-go" disabled={!sel} onClick={go}><Icon name="truck" size={18} stroke={2} />{sel ? `${firstWord(sel.name)} drives` : 'Pick a driver'}</button>}>
      <div class="hd-used"><span>Used before</span><span class="mono">{list.length}</span></div>
      <div role="radiogroup" aria-label="Hired drivers used before" class="hd-list">
        {list.map((h) => {
          const on = sel === h;
          return (
            <button key={h.phone || h.name} type="button" role="radio" aria-checked={on} class={'hd-row' + (on ? ' on' : '')} onClick={() => setSel(h)}>
              <span aria-hidden="true" class="hd-av">{initialsOf(h.name)}</span>
              <span class="hd-t">
                <span>{h.name}</span>
                <span class="mono">{[h.what, h.place ? `drove ${h.place} ${whenDrove(h.at)}` : ''].filter(Boolean).join(' · ')}</span>
                {on && hiredPhoneOk(h.phone) && <span class="hd-ok"><Icon name="check" size={11} stroke={3} />Phone checked · <span class="mono">{phoneText(h.phone)}</span></span>}
              </span>
              {on ? <span aria-hidden="true" class="hd-tick"><Icon name="check" size={13} stroke={3.2} /></span> : <span aria-hidden="true" class="hd-tick off" />}
            </button>
          );
        })}
      </div>
      <button type="button" class="hd-new" onClick={() => toast.show('Someone new: not drawn yet', { kind: 'warn' })}><Icon name="plus" size={16} stroke={2.4} />Someone new · name, plate, phone</button>
      {sel && <div class="hd-wa"><Icon name="whatsapp" size={18} stroke={1.9} /><span>{firstWord(sel.name)} gets the drop on WhatsApp</span></div>}
      <AfterSlide ground="#FFFFFF" faces={[...(from ? [yardFace(p.b, from)] : []), ...p.d.drops.map((x) => orderFace(x.o, p.b))]}
        who={[from ? firstWord(from.name) : null, ...p.d.drops.map((x) => shortName(x.o))].filter(Boolean).join(' and ')} what={`On the road · ${sel ? firstWord(sel.name) : 'him'} (hired)`} />
    </LightSheet>
  );
}

export function openHired(d: Direction | null, b: YardBooks | null, chosen: HiredPick | null, onPick: (h: HiredPick) => void): void {
  if (!d || !b) return;
  sheet.open(() => <HiredSheet d={d} b={b} chosen={chosen} onPick={onPick} />, { label: 'A hired driver', top: 268 });
}
