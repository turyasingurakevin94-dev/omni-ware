/*
 * The parts board, columns 1 and 2 (docs/canvas/sales-agent/boards/Main.dc.html):
 * the tokens, P25 P19 P21 P23; P02 P06+P07 P08 P09 P10 P24. Built from src/ui's parts.
 */
import type { JSX } from 'preact';
import { ActBar } from '../ActTiles.tsx';
import { GroupCard, MiniRow } from '../ActRow.tsx';
import { Avatar } from '../Avatar.tsx';
import { CustomerRow } from '../CustomerRow.tsx';
import { EmptyState } from '../Empty.tsx';
import { Hero } from '../Hero.tsx';
import { phWhatsapp } from '../icons.tsx';
import { MoneyTiles } from '../MoneyTiles.tsx';
import { NeedsRow } from '../NeedsRow.tsx';
import { NextMove } from '../NextMove.tsx';
import { ActionPill, DarkPill, StatusPill } from '../Pill.tsx';
import { SectionHead } from '../SectionHead.tsx';
import { LoadingHead, SkeletonRows } from '../Skeleton.tsx';
import { GhostTiles, StageTiles } from '../StageTiles.tsx';
import { Col, Corner, Part, Swatch, TypeRow, nop } from './kit.tsx';

const COLOURS: [string, string][] = [
  ['navy', '#16203C'], ['navy-2', '#243052'], ['navy-3', '#2A3350'], ['ground', '#F7F5F2'], ['panel', '#FFFFFF'],
  ['tile', '#F1EEE8'], ['line', '#E6E3DD'], ['ink', '#1C2233'], ['ink-soft', '#5F6980'], ['oxide', '#C93A30'],
  ['good', '#0F6B43'], ['warn', '#95530C'], ['bad', '#8E2A22'], ['info', '#1A5A8A'], ['mint', '#6FDCB0'],
];

export function Column1(): JSX.Element {
  return (
    <Col gap={16}>
      <header class="g-title">
        <span class="g-eyebrow">Omni-ware Sales · in the agent's language</span>
        <h1>The language</h1>
        <span>Shared parts, copied from the live agent app. Navy carries money and state, white carries work, one red move.</span>
      </header>
      <Part k="Colour" meta="1.1" gap={10}>
        <div class="g-sws">{COLOURS.map(([n, h]) => <Swatch key={n} name={n} hex={h} />)}</div>
        <div class="g-tones">
          <StatusPill tone="good">Paid</StatusPill><StatusPill tone="caution">Owes</StatusPill><StatusPill tone="bad">Out</StatusPill>
          <StatusPill tone="info">Buying</StatusPill><StatusPill tone="neutral">Done</StatusPill>
        </div>
      </Part>
      <Part k="Avatar tints" meta="identity, never state">
        <div class="g-avs">
          <Avatar initials="KC" tint="t0" /><Avatar initials="KS" tint="t1" /><Avatar initials="LB" tint="t2" /><Avatar initials="MR" tint="t3" />
          <Avatar initials="GS" tint="t4" /><Avatar initials="NH" tint="t5" /><Avatar initials="GA" tint="me" onNavy ring="0 0 0 2px #F4F2EE, 0 0 0 4px rgba(111,220,176,.55)" />
        </div>
      </Part>
      <Part k="Type" meta="Figtree · IBM Plex Mono">
        <div class="g-type">
          <TypeRow meta="Figtree 26/800"><span style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-.02em' }}>Customers</span></TypeRow>
          <TypeRow meta="20/700"><span style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-.01em' }}>Good morning, Grace</span></TypeRow>
          <TypeRow meta="17/700"><span style={{ fontSize: '17px', fontWeight: 700 }}>On the move</span></TypeRow>
          <TypeRow meta="14/600"><span style={{ fontSize: '14px', fontWeight: 600 }}>Cement · Hima 50kg</span></TypeRow>
          <TypeRow meta="12/600"><span style={{ fontSize: '12px', fontWeight: 600, color: '#5F6980' }}>Every 10 days · owes 420k</span></TypeRow>
          <TypeRow meta="11/700 +.1em"><span class="g-eyebrow">Sold · October</span></TypeRow>
          <TypeRow meta="Mono 38 hero"><span style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}><span style={{ fontSize: '12px', fontWeight: 700, color: '#5F6980' }}>UGX</span><span class="mono" style={{ fontSize: '30px', fontWeight: 600, letterSpacing: '-.04em', lineHeight: 1 }}>12,480,000</span></span></TypeRow>
          <TypeRow meta="22/600"><span class="mono" style={{ fontSize: '22px', fontWeight: 600, letterSpacing: '-.03em' }}>1,750,000</span></TypeRow>
          <TypeRow meta="12/400"><span class="mono" style={{ fontSize: '12px', color: '#5F6980' }}>40 <span class="ow-word">bag</span> × 33,500</span></TypeRow>
        </div>
      </Part>
      <Part k="Radii" meta="px">
        <div class="g-radii">{[8, 12, 14, 16, 18, 20, 22, 26, 28].map((r) => <Corner key={r} r={r} />)}</div>
      </Part>
      <Part k="P25 · Loading" meta="skeleton in the real layout · CU08">
        <div class="g-stack"><LoadingHead text="Getting your customers" /><SkeletonRows rows={2} /></div>
      </Part>
      <Part k="P19 · Money tiles" meta="OR07">
        <MoneyTiles tiles={[{ k: 'Kato pays', v: 1810000, note: '2 lines' }, { k: 'Not paid yet', v: 1810000, note: 'leaves when paid', tone: 'warn' }]} />
      </Part>
      <Part k="P21 · Acts" meta="joined bar">
        <ActBar acts={[
          { tone: 'call', icon: 'phone', word: 'Call', sub: 'Kato', href: 'tel:0772418220' },
          { tone: 'tell', duo: phWhatsapp, word: 'Tell them', sub: "it's packing", on: nop },
          { tone: 'receipt', icon: 'receipt', word: 'Receipt', sub: '1,810,000', on: nop },
        ]} />
      </Part>
      <Part k="P23 · Status" meta="good · caution · bad · info · neutral · dark">
        <div class="g-wrap">
          <StatusPill tone="info" size="md" icon="checking">Checking</StatusPill>
          <StatusPill tone="caution">Not paid yet</StatusPill>
          <StatusPill tone="good" tick>Paid</StatusPill>
          <StatusPill tone="bad">Out</StatusPill>
          <StatusPill tone="neutral">Delivered</StatusPill>
          <DarkPill amount="1.9M" />
        </div>
      </Part>
    </Col>
  );
}

export function Column2(): JSX.Element {
  return (
    <Col gap={14}>
      <Part k="P02 · Today hero" meta="sold, never earned · TD01">
        <Hero greeting="Good morning, Grace" date="Sat 17 Oct" me={{ initials: 'GA', tint: 'me' }} onMe={nop}
          month="October" sold={12480000} onSold={nop} goal={{ pct: 36, movePct: 9, target: '35M', daysLeft: 14 }} onGoal={nop}
          doors={[{ tone: 'mint', icon: 'trend', value: '+3.2M', label: 'on the move', on: nop }, { tone: 'amber', icon: 'cash', value: '1.9M', label: 'to collect', on: nop }]} />
      </Part>
      <Part k="P06 + P07 · On the move" meta="4 live stages">
        <SectionHead title="On the move" meta="12 live · 8 done" />
        <StageTiles tiles={[
          { stage: 'checking', count: 3, need: 1, mark: 'money', faces: [{ initials: 'KC', tint: 't0' }, { initials: 'MR', tint: 't3' }, { initials: 'WI', tint: 't4' }], on: nop },
          { stage: 'buying', count: 2, faces: [{ initials: 'GS', tint: 't4' }, { initials: 'LB', tint: 't2' }], on: nop },
          { stage: 'packing', count: 4, mark: 'late', label: '4 packing, 1 late', faces: [{ initials: 'KS', tint: 't1' }, { initials: 'NH', tint: 't5' }], more: 2, on: nop },
          { stage: 'road', count: 3, mark: 'ready', label: '3 on the road, 1 ready to collect', faces: [{ initials: 'KC', tint: 't0' }, { initials: 'GS', tint: 't4' }, { initials: 'WI', tint: 't4' }], on: nop },
        ]}>
          <MiniRow face={{ initials: 'MR', tint: 't3' }} name="Mukono Roofing" pill={<ActionPill tone="warn" word="Take" amount="1.1M" />} on={nop} />
        </StageTiles>
      </Part>
      <Part k="P08 · Needs you" meta="one row per kind">
        <NeedsRow kind="packing" title="Packing 2+ days" sub="ask Musa in one message" count={1} on={nop} />
      </Part>
      <Part k="P09 · Next move" meta="the best play, large · TD03">
        <NextMove tag={{ tone: 'amber', icon: 'clock', text: 'Due for their usual' }} pos="1 of 4" face={{ initials: 'KS', tint: 't1' }}
          rhythm={1} late={66.4 / 232.5} name="Kyaligonza & Sons" big="+4 days" bigSub="past their rhythm" legend={['every 14 days', 'late']}
          usual={[{ aisle: 'Cement', text: '40 bag' }, { aisle: 'Roofing', text: '30 pc' }, { aisle: 'Fasteners', text: '2 ctn' }]}
          footLabel="Their usual" footValue={2672000} phone="+256772000105" callLabel="Call Kyaligonza and Sons" act={{ label: 'Order usual', on: nop }} />
      </Part>
      <Part k="P10 · Customer row" meta="due ring">
        <GroupCard>
          <CustomerRow class="div" face={{ initials: 'KS', tint: 't1' }} tone="late" fill={1} name="Kyaligonza & Sons" sub="4 days late · every 14 days" owes="420k" on={nop} onWhatsApp={nop} />
        </GroupCard>
      </Part>
      <Part k="P24 · Empty" meta="ghost · checklist · one way in · OR04">
        <EmptyState ghost={<GhostTiles title="On the move" meta="fills as you sell" />} steps={[
          { done: true, title: 'Add your customers', sub: '38 customers · done' },
          { icon: 'plus', title: 'Place an order', sub: 'with the red + · it shows here', on: nop },
          { icon: 'whatsapp', stroke: 2, title: 'Tell the customer', sub: 'one tap, from the order', on: nop },
        ]} way={{ label: 'New order', icon: 'plus', on: nop }} />
      </Part>
    </Col>
  );
}
