from ow import *
from _keypad import TOAST
from _tiers import PACK_HTML, TIERS_HTML, TKEYPAD, FEED_HTML, TIERS_METHOD

fig = '''    <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 2px 0">
      <span style="display: flex; align-items: baseline; gap: 8px"><span class="m" style="font-size: 44px; font-weight: 600; line-height: 1; letter-spacing: -.03em">{{shown}}</span><span style="font-size: 14px; font-weight: 600; color: #B3BCD2">{{unitWord}}</span></span>
      <span style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: #B3BCD2">last read: sold singly, <span class="m" style="color: #FFFFFF">147,000</span>/sheet · 8 Oct
        <button type="button" onClick="{{useLast}}" style="all: unset; cursor: pointer; height: 26px; padding: 0 10px; border-radius: 999px; background: rgba(255,255,255,.1); color: #FFFFFF; font-size: 12px; font-weight: 700; display: flex; align-items: center">Same</button>
      </span>
    </div>'''
pic = title_block('Wire mesh BRC A142', 'Kikuubo Hardware Mart · a rival', face('KH', 'manager', 52)) + '\n' + fig
hd = head('Rival price', circ('ListPhone.dc.html', 'back', 'Back to the walk'), '', pic, gap=14)
segp = lambda lst_, item, n=2: '    <div role="radiogroup" style="display: grid; grid-template-columns: repeat(' + str(n) + ', minmax(0, 1fr)); gap: 4px; padding: 3px; border-radius: 14px; background: #F1EEE8"><sc-for list="{{' + lst_ + '}}" as="' + item + '" hint-placeholder-count="' + str(n) + '"><button type="button" role="radio" aria-checked="{{' + item + '.on}}" onClick="{{' + item + '.pick}}" style="{{' + item + '.style}}">{{' + item + '.label}}</button></sc-for></div>'
room = '''    <div role="img" aria-label="{{roomAria}}" style="''' + LIST + '''; padding: 14px; display: flex; flex-direction: column; gap: 10px">
      <div style="position: relative; height: 34px">
        <i style="position: absolute; left: 0; right: 0; top: 14px; height: 6px; border-radius: 999px; background: #EFECE6"></i>
        <i style="position: absolute; top: 14px; height: 6px; border-radius: 999px; background: rgba(15,107,67,.25); {{roomBand}}"></i>
        <span style="position: absolute; top: 8px; width: 2px; height: 18px; background: #3A3F9B; {{costX}}"></span>
        <span style="position: absolute; top: 9px; width: 16px; height: 16px; margin-left: -8px; border-radius: 999px; background: #7A3268; box-shadow: 0 0 0 3px #FFFFFF; {{rivalX}}"></span>
      </div>
      <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; font-weight: 700"><span style="color: #3A3F9B">our cost <span class="m">118,000</span>/sheet</span><span style="height: 24px; padding: 0 9px; border-radius: 999px; display: flex; align-items: center; {{bandStyle}}">{{band}}</span></div>
    </div>'''
bd = body('\n'.join([FEED_HTML, sec('Do they have it?'), segp('stock', 's', 3), sec('How they pack it', 'their packing, not ours'), PACK_HTML,
                     sec('What they sell it for', 'one line a tier'), TIERS_HTML, '    ' + TKEYPAD, sec('The room under them', 'a sheet'), room]))
ft = '''  <div style="flex: none; padding: 12px 16px 22px; display: flex; flex-direction: column; gap: 8px">
    <sc-if value="{{notSaved}}" hint-placeholder-val="{{ true }}">
    <button type="button" onClick="{{save}}" style="all: unset; cursor: pointer; box-sizing: border-box; width: 100%; height: 56px; border-radius: 999px; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; {{ctaStyle}}">{{cta}}</button>
    </sc-if>
    <sc-if value="{{saved}}" hint-placeholder-val="{{ false }}">
      ''' + TOAST + '''
      <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px">
        <a href="Search.dc.html" style="height: 52px; border-radius: 999px; background: #16203C; color: #FFFFFF; font-size: 15px; font-weight: 700; display: flex; align-items: center; justify-content: center">Next item here</a>
        <a href="ListPhone.dc.html" style="height: 52px; border-radius: 999px; background: #FFFFFF; box-shadow: inset 0 0 0 1.5px #E6E3DD; font-size: 15px; font-weight: 700; display: flex; align-items: center; justify-content: center">Back to the walk</a>
      </div>
    </sc-if>
  </div>'''
script = '''class Component extends DCLogic {
  constructor(p) { super(p); this.state = { stock: null, saved: false, pn: '', pu: '', po: '', single: false, sel: 0, tiers: [{ n: '1', on: 'u', v: '' }, { n: '1', on: 'o', v: '' }] }; }
''' + TIERS_METHOD + '''
  renderVals() {
    const S = this.state, { stock, saved } = S;
    const T = this.tierVals(S, { verb: 'sells' });
    const fmt = (x) => x.toLocaleString('en-US');
    const seg = (on) => 'all:unset;cursor:pointer;box-sizing:border-box;height:40px;border-radius:11px;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;' + (on ? 'background:#FFFFFF;color:#1C2233;box-shadow:0 1px 3px rgba(22,32,60,.12)' : 'color:#5F6980');
    const stockL = ['Yes', 'A few', 'No'].map(label => ({ label, on: String(stock === label), pick: () => this.setState({ stock: label }), style: seg(stock === label) }));
    // the room is read per sheet against our cost (Kiseka, 118,000 a sheet), at their cheapest tier
    const COST = 118000, pn = Number(S.pn || 0);
    const eachs = T.tiers.filter(t => !t.left && t.v).map(t => t.v / (t.per === S.po && !S.single ? pn : 1));
    const low = eachs.length ? Math.min(...eachs) : 0, r = low ? (low - COST) / low * 100 : 0;
    const band = !low ? 'type a price' : r >= 12 ? 'STRONG · ' + r.toFixed(0) + '%' : r >= 5 ? 'FAIR · ' + r.toFixed(0) + '%' : r > 0 ? 'THIN · ' + r.toFixed(0) + '%' : 'NONE';
    const lo = 100000, hi = 170000, X = (v) => Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100));
    const ready = stock === 'No' || (!!stock && T.packSet && T.tierCount > 0);
    return {
      ...T, stock: stockL, shown: T.curV ? fmt(T.curV) : '0', unitWord: T.packSet ? '/' + T.curPer : '',
      useLast: () => this.setState({ single: true, pu: 'sheets', pn: '', po: '', tiers: [{ n: '1', on: 'u', v: '147000' }], sel: 0 }),
      band, bandStyle: !low ? 'background:#F4F2EE;color:#5F6980' : r >= 12 ? 'background:#E4F4EA;color:#0F6B43' : r > 0 ? 'background:#FDEEE1;color:#7A4A02' : 'background:#FDE8E4;color:#A82D24',
      roomBand: low ? 'left:' + X(COST) + '%;width:' + Math.max(0, X(low) - X(COST)) + '%' : 'display:none', costX: 'left:' + X(COST) + '%', rivalX: low ? 'left:' + X(low) + '%' : 'display:none',
      roomAria: low ? 'Kikuubo sells at ' + fmt(Math.round(low)) + ' a sheet; our cost 118,000; room ' + band : 'No price yet',
      saved, notSaved: !saved,
      cta: !stock ? 'Do they have it?' : stock === 'No' ? 'Save: not on their shelf' : !T.packSet ? 'Set how they pack it' : !T.tierCount ? 'Type what they sell it for' : 'Save ' + T.tierCount + (T.tierCount === 1 ? ' price' : ' prices'),
      ctaStyle: ready ? 'background:#C93A30;color:#FFFFFF;box-shadow:0 10px 22px rgba(201,58,48,.26)' : 'background:#F3D3CF;color:#8E2A22',
      save: () => { if (ready) this.setState({ saved: true, sel: -1 }); },
      undo: () => this.setState({ saved: false, sel: 0 }),
      savedWord: stock === 'No' ? 'Saved · not on Kikuubo’s shelf' : 'Saved · Kikuubo ' + T.tierSentences.join(' · '),
      // wire mesh was Compared 16 days ago; a fresh rival read keeps the stamp from fading at 30 days
      feedHref: 'Rooms.dc.html', feedTitle: 'Feeds the passport · Wire mesh BRC A142',
      feedStamp: 'COMPARED', feedRing: saved ? 'border: 3px solid #1E6E47; color: #1E6E47; background: rgba(30,110,71,.08)' : 'border: 2px solid rgba(30,110,71,.45); color: rgba(30,110,71,.7)',
      feedNote: saved ? 'Compared is fresh again · room ' + band.toLowerCase() : 'Compared 16 days ago · this read keeps it fresh',
      feedInk: saved ? 'color:#1E6E47' : 'color:#5F6980'
    };
  }
}'''
html = page('Rival price', hd + '\n' + bd + '\n' + ft, script)
