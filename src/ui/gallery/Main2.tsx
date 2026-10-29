/*
 * The Sales-only parts board (docs/canvas/sales-agent/boards/Main2.dc.html, 1600 × 1000):
 * S01 S04 · S02 S06 · S03 S10 · S07 S05 S08 S09. Built from src/ui's parts.
 */
import type { JSX } from 'preact';
import { Avatar } from '../Avatar.tsx';
import { BillMatch } from '../BillMatch.tsx';
import { Button } from '../Button.tsx';
import { Bubble, ChatDay, ChatThread, TeamNote, Typing } from '../Chat.tsx';
import { Composer } from '../Composer.tsx';
import { DayBlocks } from '../DayBlocks.tsx';
import { Dock } from '../Dock.tsx';
import { HeadChip, SheetHead } from '../FullSheet.tsx';
import { Icon } from '../icons.tsx';
import { Keypad, Outcome, PriceField, PriceLadder } from '../Keypad.tsx';
import { MoneySplit } from '../MoneySplit.tsx';
import { NavyCard } from '../NavyCard.tsx';
import { Callout } from '../Notice.tsx';
import { StageBar } from '../PageHead.tsx';
import { AmountField, MethodPicker, TheyGave } from '../PayMethod.tsx';
import { PersonPicker } from '../PersonPicker.tsx';
import { ChipRow, FilterChip } from '../Pill.tsx';
import { ReasonCard } from '../ReasonCard.tsx';
import { LightSheet } from '../sheet.tsx';
import { OrderRow, STAGE_DOT, StageGroup } from '../StageGroup.tsx';
import { Col, Part, nop } from './kit.tsx';

const RN = { initials: 'RN', tint: 't2' as const };

export function Main2Board(): JSX.Element {
  return (
    <div class="g-board two">
      <header class="g-title2"><h1>The language</h1><span>Sales-only parts in the same voice</span></header>
      <div class="g-row">
        <Col gap={16}>
          <Part k="S01 · Chat" meta="theirs · ours · team note · composer">
            <div style={{ borderRadius: '26px 26px 22px 22px', overflow: 'hidden', boxShadow: 'var(--sh-row)', background: '#EDE7DD' }}>
              <SheetHead pad="chat" face={{ initials: 'KC', tint: 't0' }} name="Kato Construction" sub={<>Owes <b>420k</b> · every 10 days</>} onName={nop}
                phone="0772418220" callLabel="Call Kato Construction" onClose={nop} chips={<>
                  <HeadChip on={nop} label="Grace's. Give Kato to a teammate"><Avatar initials="GA" tint="me" size={22} ring="0 0 0 1.5px rgba(255,255,255,.35)" />Grace's<span style={{ display: 'flex', color: '#B3BCD2' }}><Icon name="swap" size={14} stroke={2.2} /></span></HeadChip>
                  <HeadChip on={nop} label="Order #0552, Packing. Open it"><span style={{ display: 'flex', color: '#F5B26B' }}><Icon name="orders" size={14} stroke={2.4} /></span><span class="mono" style={{ fontWeight: 600 }}>#0552</span><span style={{ color: '#B3BCD2' }}>·</span>Packing<span style={{ display: 'flex', color: '#B3BCD2' }}><Icon name="chevron-right" size={13} stroke={2.4} /></span></HeadChip>
                </>} />
              <Typing face={{ initials: 'BO', tint: 't3' }}>Brian is typing a reply</Typing>
              <ChatThread>
                <ChatDay>Today</ChatDay>
                <Bubble from="theirs" at="9:02">Can you do 40 iron sheets G28 by Friday? Also 2 wheelbarrows.</Bubble>
                <Bubble from="ours" who="Grace" at="9:06" read>Yes Kato. Sending the price now.</Bubble>
                <TeamNote who="Grace">Brian, #0552 leaves only when Kato pays 1,810,000.</TeamNote>
              </ChatThread>
              <Composer to="Kato" toName="Kato Construction" value="" onInput={nop} onSend={nop} onNote={nop} onAttach={nop} />
            </div>
          </Part>
          <Part k="S04 · Hand over" meta="who is free, as a load bar">
            <PersonPicker value="BO" onChange={nop} people={[
              { id: 'GA', face: { initials: 'GA', tint: 'me' }, name: 'Grace Akello', line: 'You · 6 chats · 2 waiting', load: 33, heavy: true, presence: 'on', self: true },
              { id: 'BO', face: { initials: 'BO', tint: 't3' }, name: 'Brian Ouma', line: '9 chats · none waiting', load: 30, presence: 'on' },
              { id: 'FN', face: { initials: 'FN', tint: 't1' }, name: 'Faith Nambi', line: '4 chats · 1 waiting · away', load: 30, presence: 'away' },
            ]} />
            <Button h={52} icon="hand-over" onClick={nop}>Give to Brian</Button>
          </Part>
        </Col>
        <Col gap={16}>
          <Part k="S02 · Take payment" meta="amount · how they paid">
            <AmountField who="Kato pays now" value={420000} options={[{ word: 'All', amount: 420000, on: nop }]} chosen={0} onOther={nop} />
            <MethodPicker value="cash" onChange={nop} />
          </Part>
          <Part k="S02 · They gave / Give change" meta="inside the dock, cash only">
            <Dock inline style={{ borderRadius: '26px', padding: '16px' }} words="Counter sale · 2 items" total={52000}
              slide={{ label: 'Slide to sell · 52,000', knobLabel: 'Sell this', onCommit: nop }}>
              <MethodPicker navy value="cash" onChange={nop} />
              <TheyGave notes={[55000, 60000]} value={55000} onPick={nop} change={3000} />
            </Dock>
          </Part>
          <Part k="S06 · Being checked" meta="what to collect vs what Esther checks">
            <NavyCard><MoneySplit owes={290000} collect={165000} checked={125000} checker={{ face: { initials: 'EA', tint: 't5' }, name: 'Esther' }} onCollect={nop} onChecked={nop} /></NavyCard>
          </Part>
        </Col>
        <Col gap={16}>
          <Part k="S03 · Price keypad" meta="the ladder shows where it sits">
            <LightSheet class="g-sheetcard" title="Price · Iron sheet G28" onClose={nop} pad="8px 16px 16px">
                <PriceLadder pct={66} shop={38000} label="36,500 is under the shop's price of 38,000" />
                <PriceField label="Their price, each" value={36500} diff={-1500} style={{ height: '64px' }} />
                <Outcome words="40 sheets come to" was={1520000} now={1460000} />
                <Callout tone="warn" icon="clock">Under the shop's price. Ruth says yes before it is packed.</Callout>
                <Keypad value="36500" onChange={nop} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                  <Button kind="ghost" h={52} fs={15} onClick={nop}>Keep <span class="mono">38,000</span></Button>
                  <Button h={52} fs={15} onClick={nop}>Use <span class="mono">36,500</span></Button>
                </div>
            </LightSheet>
          </Part>
          <Part k="S10 · Bill being checked" meta="side by side · CU12">
            <BillMatch eyebrow="BILL #0528 · GGABA STORES · PAID ALREADY?" label="This bill, 125,000 open from 17 Aug, matches order #0264, 125,000 paid in cash the same day"
              bill={{ k: '#0528 · open', v: 125000, sub: 'billed 17 Aug' }} paid={{ k: 'paid in cash', v: 125000, sub: 'receipt · 17 Aug' }} />
          </Part>
        </Col>
        <Col gap={16}>
          <Part k="S07 · Something wrong" meta={'opened by "Fix it" on an order'}>
            <div class="g-stack"><ReasonCard kind="return" on={nop} /><ReasonCard kind="void" on={nop} /><ReasonCard kind="payment" on={nop} /></div>
          </Part>
          <Part k="S05 · Orders by stage" meta="the bar is the filter's key">
            <NavyCard ground="head"><StageBar counts={{ checking: 3, buying: 2, packing: 4, road: 3, delivered: 8 }} /></NavyCard>
            <ChipRow label="Show" wrap>
              <FilterChip count={20} onClick={nop}>All</FilterChip>
              <FilterChip on dot={STAGE_DOT.checking} count={3} onClick={nop}>Checking</FilterChip>
              <FilterChip dot={STAGE_DOT.buying} count={2} onClick={nop}>Buying</FilterChip>
              <FilterChip dot={STAGE_DOT.packing} count={4} onClick={nop}>Packing</FilterChip>
              <FilterChip dot={STAGE_DOT.road} count={3} onClick={nop}>On the road</FilterChip>
              <FilterChip dot={STAGE_DOT.delivered} count={8} onClick={nop}>Delivered</FilterChip>
            </ChipRow>
          </Part>
          <Part k="S08 · Day blocks" meta="one customer's rhythm">
            <DayBlocks title="Kyaligonza · every 14 days" pill="4 days late" rhythm={14} late={4} labels={['29 Sep', 'due 13 Oct', 'today']} label="Last order Tue 29 Sep, due Tue 13 Oct, 4 days late" />
          </Part>
          <Part k="S09 · A stage group in Orders" meta="header · sum · rows · OR01">
            <StageGroup stage="checking" count={3} sum={542000}>
              <OrderRow face={{ initials: 'KC', tint: 't0' }} name="Kato Construction" no="#0553" status={{ face: RN, text: 'Ruth decides' }} amount={170000} time="10:16" on={nop} />
              <OrderRow face={{ initials: 'MR', tint: 't3' }} name="Mukono Roofing" no="#0551" status={{ text: 'Not paid yet' }} amount={320000}
                act={{ word: 'Take', amount: '1.1M', label: 'Take payment from Mukono Roofing, 1,100,000', on: nop }} on={nop} />
              <OrderRow face={{ initials: 'WI', tint: 't4' }} name="Walk-in" no="#0550" status={{ face: RN, text: 'Cancel asked' }} amount={52000} time="9:02" on={nop} />
            </StageGroup>
          </Part>
        </Col>
      </div>
    </div>
  );
}
