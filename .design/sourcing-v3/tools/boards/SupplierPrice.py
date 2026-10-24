from ow import *
from _keypad import TOAST
from _tiers import PACK_HTML, TIERS_HTML, TKEYPAD, FEED_HTML, TIERS_METHOD

fig = '''    <div style="display: flex; align-items: baseline; justify-content: center; gap: 8px; padding: 4px 0 2px">
      <span class="m" style="font-size: 40px; font-weight: 600; line-height: 1; letter-spacing: -.03em">{{shown}}</span><span style="font-size: 14px; font-weight: 600; color: #B3BCD2">{{unitWord}}</span>
    </div>'''
pic = title_block('PPR pipe 25mm × 4m', 'Owino Plumbing · our first price for it', face('OP', 'indigo', 52)) + '\n' + fig
hd = head('Their price', circ('Visit.dc.html', 'back', 'Back to the visit'), '', pic, gap=14)
segp = lambda lst_, item: '    <div role="radiogroup" style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; padding: 3px; border-radius: 14px; background: #F1EEE8"><sc-for list="{{' + lst_ + '}}" as="' + item + '" hint-placeholder-count="2"><button type="button" role="radio" aria-checked="{{' + item + '.on}}" onClick="{{' + item + '.pick}}" style="{{' + item + '.style}}">{{' + item + '.label}}</button></sc-for></div>'
has_block = '''    <sc-if value="{{has}}" hint-placeholder-val="{{ false }}">
    <div style="display: flex; flex-direction: column; gap: 10px">
''' + sec('How they pack it', 'one sentence') + '\n' + PACK_HTML + '\n' + sec('Their prices', 'one line a tier') + '\n' + TIERS_HTML + '\n    ' + TKEYPAD + '\n' + sec('Delivers in', 'optional') + '''
    <div style="display: flex; gap: 6px"><sc-for list="{{lead}}" as="l" hint-placeholder-count="3"><button type="button" aria-pressed="{{l.on}}" onClick="{{l.pick}}" style="{{l.style}}">{{l.label}}</button></sc-for></div>
    </div>
    </sc-if>
    <sc-if value="{{hasNot}}" hint-placeholder-val="{{ false }}">
''' + lst(row('Owino Plumbing doesn’t sell it', 'Nobody asks them again for 90 days', icon_well('close', 'plain'), '')) + '''
    </sc-if>'''
bd = body('\n'.join([FEED_HTML, sec('Do they have it?'), segp('haves', 'h'), has_block]))
ft = '''  <div style="flex: none; padding: 12px 16px 22px; display: flex; flex-direction: column; gap: 8px">
    <sc-if value="{{notSaved}}" hint-placeholder-val="{{ true }}">
      <button type="button" onClick="{{save}}" style="all: unset; cursor: pointer; box-sizing: border-box; width: 100%; height: 58px; border-radius: 999px; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; {{ctaStyle}}">{{cta}}</button>
    </sc-if>
    <sc-if value="{{saved}}" hint-placeholder-val="{{ false }}">
      ''' + TOAST + '''
      ''' + pill('Back to the visit', href='Visit.dc.html', kind='ghost') + '''
    </sc-if>
  </div>'''
script = '''class Component extends DCLogic {
  constructor(p) { super(p); this.state = { has: null, lead: null, saved: false, pn: '', pu: '', po: '', single: false, sel: 0, tiers: [{ n: '1', on: 'u', v: '' }, { n: '1', on: 'o', v: '' }] }; }
''' + TIERS_METHOD + '''
  renderVals() {
    const S = this.state, { has, lead, saved } = S;
    const T = this.tierVals(S, { verb: 'cost' });
    const fmt = (x) => x.toLocaleString('en-US');
    const seg = (on) => 'all:unset;cursor:pointer;box-sizing:border-box;height:40px;border-radius:11px;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;' + (on ? 'background:#FFFFFF;color:#1C2233;box-shadow:0 1px 3px rgba(22,32,60,.12)' : 'color:#5F6980');
    const chip = (on) => 'all:unset;cursor:pointer;box-sizing:border-box;height:36px;padding:0 14px;border-radius:999px;font-size:13px;font-weight:700;display:flex;align-items:center;' + (on ? 'background:#16203C;color:#FFFFFF' : 'background:#FFFFFF;box-shadow:inset 0 0 0 1.5px #E6E3DD');
    const haves = [[true, 'They have it'], [false, 'They don’t']].map(([k, label]) => ({ label, on: String(has === k), pick: () => this.setState({ has: k }), style: seg(has === k) }));
    const leadOpts = ['Same day', '2 d', '7 d'].map(label => ({ label, on: String(lead === label), pick: () => this.setState({ lead: lead === label ? null : label }), style: chip(lead === label) }));
    const ready = has === false || (has === true && T.packSet && T.tierCount > 0);
    const cta = has === null ? 'Do they have it?' : has === false ? 'Save: they don’t sell it' : !T.packSet ? 'Set how they pack it' : !T.tierCount ? 'Type a price' : 'Save ' + T.tierCount + (T.tierCount === 1 ? ' price' : ' prices');
    // the passport this price feeds: PPR pipe is in Find with one stamp (Asked); a supplier with packing and prices makes Sourced ready
    const inked = saved && has === true, none = saved && has === false;
    return {
      ...T, haves, lead: leadOpts, has: has === true, hasNot: has === false,
      shown: T.curV ? fmt(T.curV) : '0', unitWord: T.packSet ? '/' + T.curPer : '',
      saved, notSaved: !saved, cta,
      ctaStyle: ready ? 'background:#C93A30;color:#FFFFFF;box-shadow:0 10px 22px rgba(201,58,48,.26)' : 'background:#F3D3CF;color:#8E2A22',
      save: () => { if (ready) this.setState({ saved: true, sel: -1 }); },
      undo: () => this.setState({ saved: false, sel: 0 }),
      savedWord: has ? 'Saved · ' + T.packSentence + ' · ' + T.tierCount + (T.tierCount === 1 ? ' tier' : ' tiers') : 'Saved · Owino doesn’t sell it',
      feedHref: 'Rooms.dc.html', feedTitle: 'Feeds the passport · PPR pipe 25mm',
      feedStamp: inked ? 'SOURCED' : 'STAMP 2',
      feedRing: inked ? 'border: 3px solid #2B3A8C; color: #2B3A8C; background: rgba(43,58,140,.08)' : 'border: 2px dashed #B9AE99; color: #8A7A62',
      feedNote: inked ? 'Sourced is ready for your stamp · in Find' : none ? 'Still waiting for a supplier · 2 more asked' : 'Packing and one price make Sourced ready',
      feedInk: inked ? 'color:#2B3A8C' : 'color:#5F6980'
    };
  }
}'''
html = page('Their price', hd + '\n' + bd + '\n' + ft, script)
