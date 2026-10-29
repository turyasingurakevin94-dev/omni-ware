/*
 * The parts board, columns 3 and 4 (docs/canvas/sales-agent/boards/Main.dc.html):
 * P05 P12 P13 P15 P20 P27+P28, the icons, P26; P16 P03 P04+P18 P22. Built from src/ui's parts.
 */
import type { JSX } from 'preact';
import { Button } from '../Button.tsx';
import { CheckList } from '../CheckList.tsx';
import { Dock } from '../Dock.tsx';
import { SheetHead } from '../FullSheet.tsx';
import { AISLE, AisleIcon, Duo, Icon, phAgain, phBasket, phCoins, phFlame, phGrid, phHourglass, phLink, phSearch, phStore, phWhatsapp, type AisleKey, type IconName } from '../icons.tsx';
import { LineCard, LineNote } from '../LineCard.tsx';
import { EndOfFlow, Moment } from '../Moment.tsx';
import { Notice } from '../Notice.tsx';
import { OftenWith, OftenWithHead } from '../OftenWith.tsx';
import { HeadStat, PageHead } from '../PageHead.tsx';
import { Stepper } from '../Stepper.tsx';
import { TabBar } from '../TabBar.tsx';
import { ToastView } from '../toast.tsx';
import { TopBar, WhoPill } from '../TopBar.tsx';
import { Track } from '../Track.tsx';
import { Col, IconCell, Part, nop } from './kit.tsx';

const STROKE: IconName[] = ['today', 'chats', 'orders', 'customers', 'plus', 'search', 'grid', 'close', 'back', 'chevron-right',
  'phone', 'whatsapp', 'message', 'send', 'basket', 'truck', 'store', 'cash', 'mobile', 'bank',
  'receipt', 'check', 'checking', 'cart', 'clock', 'hourglass', 'warning', 'tag', 'return', 'undo'];
const DUO: [string, string, string][] = [
  [phSearch, '#1C2233', '#FFFFFF'], [phGrid, '#1C2233', '#FFFFFF'], [phBasket, '#5F6980', '#FFFFFF'], [phCoins, '#7A4A02', '#FDEEE1'], [phStore, '#0F6B43', '#E4F4EA'],
  [phHourglass, '#8E2A22', '#FBE5E2'], [phWhatsapp, '#0F6B43', '#E4F4EA'], [phLink, '#0E6A6A', '#DDF1F0'], [phFlame, '#C93A30', '#FDE8E4'], [phAgain, '#1C2233', '#F1EEE8'],
];
const AISLES: [AisleKey, string][] = [['roof', 'Roofing'], ['cement', 'Cement'], ['block', 'Blocks'], ['nail', 'Fasteners'], ['pipe', 'Plumbing'], ['sanit', 'Sanitary'], ['paint', 'Paint'], ['electr', 'Electrical'], ['wood', 'Timber'], ['steel', 'Steel']];

export function Column3(): JSX.Element {
  return (
    <Col gap={14}>
      <Part k="P05 · Building an order" meta="who · basket · search · aisles">
        <div style={{ margin: '-14px -16px 0' }}>
          <TopBar onClose={nop} who={<WhoPill on={nop} />}
            baskets={[{ face: { initials: 'KS', tint: 't1' }, count: 2, label: 'Open order for Kyaligonza and Sons, 2 items', on: nop }]}
            search={{ placeholder: 'Add an item', label: 'Add an item: type its name', onMic: nop }} onAisles={nop} />
        </div>
      </Part>
      <Part k="P12 · Line cards" meta="closed · open">
        <LineCard aisle="Cement" name="Cement · Hima 50kg" qty={40} unit="bag" price={33500} chip={{ kind: 'amount', v: 1340000 }} on={nop} />
        <LineCard open aisle="Roofing" name="Iron sheet G28 · 3m" qty={40} unit="pc" price={36500} chip={{ kind: 'under', v: -1500 }}>
          <div class="ow-row"><Stepper value={40} unit="pc" what="iron sheets" onChange={nop} /><LineNote>Ruth says yes<br />before it is packed</LineNote></div>
        </LineCard>
      </Part>
      <Part k="P13 · Often with">
        <OftenWithHead item="Iron sheet G28" whose="in Kato's orders" />
        <OftenWith aisle="Roofing" name="Ridge cap G28" had={7} of={14} price={18000} unit="pc" onAdd={nop} />
      </Part>
      <Part k="P15 · The dock" meta="segment · total · slide">
        <div style={{ position: 'relative', height: '158px', borderRadius: '26px', overflow: 'hidden' }}>
          <Dock inline style={{ position: 'absolute', inset: 0 }} mode={{ value: 'pickup', onChange: nop }} total={1750000} sub={{ text: '1 price coming', tone: 'amber' }}
            slide={{ label: 'Slide to place · 3 items', knobLabel: 'Place this order', onCommit: nop }} />
        </div>
      </Part>
      <Part k="P20 · What Kato gets" meta="#0552 at 10:41 · OR07">
        <CheckList title="What Kato gets" bar={['#0F6B43', '#F5B26B']} summary="1 of 2 packed" lines={[
          { aisle: 'Roofing', name: 'Iron sheet G28 · 3m', qty: 40, unit: 'pc', amount: 1520000, mark: 'confirmed', at: '10:30', markLabel: 'Packed at 10:30' },
          { aisle: 'Tools', name: 'Wheelbarrow, heavy duty', qty: 2, unit: 'pc', amount: 290000, mark: 'checking', word: 'packing', markLabel: 'Packing now' },
          { aisle: 'Doors & locks', name: 'Soft close hinge · flat', qty: 10, unit: 'pair', note: 'not found', mark: 'dropped', markLabel: 'Not found' },
        ]} />
      </Part>
      <Part k="P27 + P28 · Notice and toast" meta="Undo is 44 px">
        <div style={{ borderRadius: '14px', overflow: 'hidden' }}>
          <Notice kind="offline" action={{ label: 'Try again', on: nop }}>No signal · <b class="mono">2</b> not sent yet</Notice>
        </div>
        <div style={{ position: 'relative', height: '60px' }}><ToastView inline text="Added 40 bags" undo={nop} onClose={nop} /></div>
      </Part>
      <Part k="Icons" meta="stroke 1.8 · 24 grid">
        <div class="g-icons">{STROKE.map((n) => <IconCell key={n}><Icon name={n} size={20} /></IconCell>)}</div>
      </Part>
      <Part k="" meta="duotone · 256 grid · aisle tints" gap={4}>
        <div class="g-icons">
          {DUO.map(([i, c, bg], k) => <IconCell key={k} bg={bg} outline="rgba(0,0,0,.04)"><Duo i={i} size={20} color={c} /></IconCell>)}
          {AISLES.map(([k, n]) => <IconCell key={k} bg={`linear-gradient(145deg, ${AISLE[k].soft} 0%, #FFFFFF 150%)`} outline="rgba(0,0,0,.035)"><AisleIcon aisle={n} size={22} /></IconCell>)}
        </div>
      </Part>
      <Part k="P26 · Primary" meta="navy by default · red for money">
        <Button icon="person-plus" onClick={nop}>Add a customer</Button>
        <Button kind="red" icon="cash" onClick={nop}>Take 420,000</Button>
      </Part>
    </Col>
  );
}

export function Column4(): JSX.Element {
  return (
    <Col gap={14}>
      <Part k="P16 · Agent tab bar" meta="Today · + · Clients" gap={10}>
        <div style={{ paddingTop: '22px', overflow: 'hidden' }}>
          <TabBar inline active="today" waiting={0} notPlaced={0} plusLabel="New order" onTab={nop} onPlus={nop}
            items={[{ id: 'today', word: 'Today', icon: 'today' }, { id: 'clients', word: 'Clients', icon: 'customers' }]} />
        </div>
        <div class="g-cap"><span>P16 · Sales tab bar</span><span>Today · Chats · + · Orders · Customers</span></div>
        <div style={{ paddingTop: '22px', overflow: 'hidden' }}>
          <TabBar inline active="today" waiting={3} notPlaced={2} onTab={nop} onPlus={nop} />
        </div>
      </Part>
      <Part k="P03 · Page head" meta="title · count · picture · search · CU01">
        <div style={{ borderRadius: '0 0 28px 28px', overflow: 'hidden' }}>
          <PageHead title="Customers" count={38}
            actions={[{ icon: 'share', label: "Share the shop's price list", on: nop }, { icon: 'person-plus', label: 'New customer', on: nop, white: true }]}
            search={{ placeholder: 'Name, phone or place', label: 'Find a customer' }}>
            <HeadStat amount={1910000} word="owed" pill="4 owe" bar={{
              label: '1,910,000 owed: 585,000 past the 21-day hold, 1,200,000 under 21 days, 125,000 being checked; 474,000 being checked in all',
              parts: [{ value: 585000, color: '#F5B26B' }, { value: 1200000, color: 'rgba(255,255,255,.28)' }, { value: 125000, color: 'hatch' }],
              legend: [{ dot: '#F5B26B', text: 'Take', b: '585,000' }, { dot: 'rgba(255,255,255,.5)', text: 'Under 21 days' }, { dot: '#9DB7E0', text: 'Being checked' }],
            }} />
          </PageHead>
        </div>
      </Part>
      <Part k="P04 + P18 · One order" meta="sheet head · track rail · OR07">
        <SheetHead style={{ borderRadius: '26px', gap: '14px' }} face={{ initials: 'KC', tint: 't0' }} name="Kato Construction" sub="#0552 · today 9:14" subMono
          phone="0772418220" callLabel="Call Kato Construction" onClose={nop}>
          <Track stage="packing" sub="Musa · since 10:05" times={{ checking: '9:14', buying: '9:31' }} />
        </SheetHead>
      </Part>
      <Part k="P22 · The moment" meta="Placed · Sold · Paid · SL28">
        <Moment card title="Placed" who={{ face: { initials: 'KC', tint: 't0' }, name: 'Kato Construction', ref: '#0560', on: nop, label: 'Open #0560' }}
          note={{ duo: phWhatsapp, text: 'Picture sent to Kato' }}
          items={{ aisles: ['Roofing', 'Cement', 'Doors & locks'], title: '3 items · pickup', sub: 'Not paid yet', amount: 2190000 }}
          next={[{ icon: 'checking', title: 'Checking', sub: 'now · Moses finds the cost · Ruth prices it' }, { icon: 'cart', title: 'Buying', sub: 'Denis buys the hinge' }, { icon: 'orders', title: 'Packing', sub: 'Musa packs it' }]}
          end={<EndOfFlow on={nop} pct={60} />} />
      </Part>
    </Col>
  );
}
