from ow import *

gauge = '''<span role="img" aria-label="Score 68 of 100" style="position: relative; width: 96px; height: 54px; flex: none; overflow: hidden">
        <span style="position: absolute; left: 0; top: 0; width: 96px; height: 96px; border-radius: 999px; background: conic-gradient(from 270deg, #6FDCB0 0deg 122deg, rgba(255,255,255,.12) 122deg 180deg, transparent 180deg 360deg)"></span>
        <span style="position: absolute; left: 11px; top: 11px; width: 74px; height: 74px; border-radius: 999px; background: #1C2647"></span>
        <span class="m" style="position: absolute; left: 0; right: 0; bottom: 0; text-align: center; font-size: 24px; font-weight: 600; line-height: 1">68</span>
      </span>'''
pic = title_block('Stock a small first batch', 'Wire mesh BRC A142 · confidence <span class="m" style="color: #FFFFFF">67</span> of 100', gauge)
hd = head('How we hold it', circ('Passport.dc.html', 'back', 'Back to the passport'), '', pic)

part_row = '''      <div style="display: flex; flex-direction: column; gap: 6px; padding: 12px 10px; border-top: {{p.rule}}">
        <span style="display: flex; align-items: baseline; gap: 8px"><span style="flex: 1; font-size: 14px; font-weight: 700">{{p.label}} <span style="font-size: 12px; font-weight: 600; color: #5F6980">· weight <span class="m">{{p.w}}</span></span></span><span class="m" style="font-size: 15px; font-weight: 600">{{p.v}}</span></span>
        <span style="height: 6px; border-radius: 3px; background: #EFECE6; display: block"><span style="display: block; height: 6px; border-radius: 3px; {{p.bar}}"></span></span>
        <span style="font-size: 12px; font-weight: 600; color: #5F6980">{{p.basis}}</span>
      </div>'''
tiles = '''    <div role="radiogroup" aria-label="How we hold it" style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px">
      <sc-for list="{{options}}" as="o" hint-placeholder-count="3">
        <button type="button" role="radio" aria-checked="{{o.on}}" onClick="{{o.pick}}" style="{{o.tile}}">
          <span style="width: 34px; height: 34px; border-radius: 11px; display: flex; align-items: center; justify-content: center; {{o.well}}"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{{o.icon}}"></path></svg></span>
          <span style="font-size: 13px; font-weight: 700">{{o.k}}</span>
          <span style="font-size: 11px; font-weight: 700; {{o.subInk}}">{{o.sub}}</span>
        </button>
      </sc-for>
    </div>'''
facts = '''    <div style="''' + LIST + '''; padding: 4px 14px">
      <div style="display: grid; grid-template-columns: 1.3fr repeat(3, minmax(0, 1fr)); gap: 4px; min-height: 40px; align-items: center; font-size: 11px; font-weight: 700; color: #5F6980"><span></span><span style="text-align: right">Stock</span><span style="text-align: right">Per order</span><span style="text-align: right">Consign</span></div>
      <sc-for list="{{facts}}" as="f" hint-placeholder-count="4">
        <div style="display: grid; grid-template-columns: 1.3fr repeat(3, minmax(0, 1fr)); gap: 4px; min-height: 44px; align-items: center; border-top: 1px solid #EFECE6">
          <span style="font-size: 12px; font-weight: 600; color: #5F6980">{{f.k}}</span>
          <span class="m" style="text-align: right; font-size: 13px; font-weight: 600; {{f.ia}}">{{f.a}}</span>
          <span class="m" style="text-align: right; font-size: 13px; font-weight: 600; {{f.ib}}">{{f.b}}</span>
          <span class="m" style="text-align: right; font-size: 13px; font-weight: 600; {{f.ic}}">{{f.c}}</span>
        </div>
      </sc-for>
    </div>'''
consign = '''    <sc-if value="{{isConsign}}" hint-placeholder-val="{{ false }}">
    <div style="''' + LIST + '''; padding: 6px; display: flex; flex-direction: column; gap: 2px">
      <div style="display: flex; align-items: center; gap: 12px; min-height: 66px; padding: 0 10px">
        <span style="width: 42px; height: 42px; flex: none; border-radius: 999px; background: #E4E6FA; color: #3A3F9B; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center">KS</span>
        <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 14px; font-weight: 700">Kiseka Steel has to agree</span><span style="font-size: 12px; font-weight: 600; color: #7A4A02">Until then the verdict stays open</span></span>
      </div>
      <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; padding: 0 6px 8px">
        <button type="button" onClick="{{ask}}" style="all: unset; cursor: pointer; height: 42px; border-radius: 999px; background: #FFFFFF; box-shadow: inset 0 0 0 1.5px #E6E3DD; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center">{{askLabel}}</button>
        <button type="button" onClick="{{agree}}" aria-pressed="{{agreedStr}}" style="{{agreeStyle}}">{{agreeLabel}}</button>
      </div>
    </div>
    </sc-if>'''
reasons = '''    <sc-if value="{{overriding}}" hint-placeholder-val="{{ false }}">
    <span style="padding: 8px 4px 0; font-size: 13px; font-weight: 700; color: #5F6980">Why not Stock?</span>
    <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px">
      <sc-for list="{{reasons}}" as="r" hint-placeholder-count="4"><button type="button" aria-pressed="{{r.on}}" onClick="{{r.pick}}" style="{{r.style}}">{{r.label}}</button></sc-for>
    </div>
    </sc-if>'''
track_rec = '''    <div style="display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 0 14px; border-radius: 20px; box-shadow: inset 0 0 0 1px #E6E3DD">
      ''' + svg('clock', 18, 2, '#5F6980') + '''
      <span style="flex: 1; font-size: 12px; font-weight: 600; color: #5F6980">Its track record shows here once <span class="m" style="color: #1C2233">8</span> items have sold for <span class="m" style="color: #1C2233">30</span> days</span>
    </div>'''
bd = body('\n'.join([
    sec('Why 68', 'cost, rivals and demand · no markup', first=True),
    '    <div style="' + LIST + '; padding: 0 6px">\n      <sc-for list="{{parts}}" as="p" hint-placeholder-count="5">\n' + part_row + '\n      </sc-for>\n    </div>',
    sec('Three ways to hold it'),
    tiles, facts, consign, reasons, track_rec,
]))
ft = foot('<button type="button" onClick="{{choose}}" style="all: unset; cursor: pointer; box-sizing: border-box; width: 100%; height: 58px; border-radius: 999px; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; {{ctaStyle}}">{{cta}}</button>')

script = '''class Component extends DCLogic {
  constructor(p) { super(p); this.state = { pick: null, agreed: false, reason: null, asked: false, chosen: false }; }
  renderVals() {
    const { pick, agreed, reason, asked, chosen } = this.state;
    // The Sourcing score: cost, rivals and demand only. Weights 30/30/10/15/15.
    const parts = [
      { label: 'Demand', w: 30, v: 43, basis: '3 buyers · 40 sheets · waiting 9 days' },
      { label: 'Room', w: 30, v: 88, basis: '31,000 under the cheapest rival in stock' },
      { label: 'Competition', w: 10, v: 54, basis: '2 rivals have it in stock' },
      { label: 'Supply', w: 15, v: 85, basis: '2 suppliers priced' },
      { label: 'Cash back', w: 15, v: 73, basis: 'about 16 days, counting none of the 40 as sure' }
    ].map((p, i) => ({ ...p, rule: i ? '1px solid #EFECE6' : 'none', bar: 'width:' + p.v + '%;background:' + (p.v >= 70 ? '#0F6B43' : p.v < 50 ? '#95530C' : '#5F6980') }));
    const AMB = 'color:#7A4A02', NO = '';
    const facts = [
      { k: 'Cash out', a: '4,720,000', b: '0', c: '0', ia: NO, ib: NO, ic: NO },
      { k: 'Cost a sheet', a: '118,000', b: '118,000', c: '125,100', ia: NO, ib: NO, ic: AMB },
      { k: 'Room', a: '31,000', b: '31,000', c: '23,900', ia: NO, ib: NO, ic: AMB },
      { k: 'They wait', a: '0 d', b: '≈ 3 d', c: '0 d', ia: NO, ib: AMB, ic: NO }
    ];
    const ICON = { Stock: 'M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5zM3.5 7.5 12 12l8.5-4.5M12 12v9', 'Per order': 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', Consign: 'M7 11V7a5 5 0 0 1 10 0v4M5 11h14v10H5z' };
    const options = [['Stock', 'Recommended'], ['Per order', 'no cash out'], ['Consign', 'needs Kiseka']].map(([k, sub]) => {
      const on = pick === k;
      return { k, sub, on: String(on), icon: ICON[k], pick: () => this.setState({ pick: k, reason: null, chosen: false }),
        tile: 'all:unset;cursor:pointer;box-sizing:border-box;height:104px;border-radius:18px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;text-align:center;' + (on ? 'background:#16203C;color:#FFFFFF' : 'background:#FFFFFF;color:#1C2233;box-shadow:inset 0 0 0 1.5px #E6E3DD'),
        well: on ? 'background:rgba(255,255,255,.12);color:#FFFFFF' : (k === 'Stock' ? 'background:#E4F4EA;color:#0F6B43' : 'background:#F1EEE8;color:#5F6980'),
        subInk: on ? 'color:#B3BCD2' : (k === 'Stock' ? 'color:#0F6B43' : 'color:#5F6980') };
    });
    const reasons = ['A customer was promised', 'Cash is short', 'The supplier offered terms', 'Something else'].map(label => ({
      label, on: String(reason === label), pick: () => this.setState({ reason: label }),
      style: 'all:unset;cursor:pointer;box-sizing:border-box;min-height:52px;padding:0 12px;border-radius:16px;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;text-align:center;' +
        (reason === label ? 'background:#16203C;color:#FFFFFF' : 'background:#FFFFFF;box-shadow:inset 0 0 0 1.5px #E6E3DD')
    }));
    const isConsign = pick === 'Consign', overriding = !!pick && pick !== 'Stock';
    const ready = !!pick && (!overriding || !!reason) && (!isConsign || agreed);
    const cta = chosen ? pick + ' chosen · Denis is told' : !pick ? 'Pick how we hold it' : overriding && !reason ? 'Say why not Stock' : isConsign && !agreed ? 'Waiting on Kiseka' : 'Choose ' + pick;
    return {
      parts, facts, options, reasons, isConsign, overriding,
      ask: () => this.setState({ asked: true }), askLabel: asked ? 'Asked 18:20' : 'Ask on WhatsApp',
      agree: () => this.setState({ agreed: !agreed }), agreedStr: String(agreed), agreeLabel: agreed ? 'Kiseka agreed' : 'They agreed',
      agreeStyle: 'all:unset;cursor:pointer;height:42px;border-radius:999px;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;' + (agreed ? 'background:#E4F4EA;color:#0F6B43' : 'background:#FFFFFF;box-shadow:inset 0 0 0 1.5px #E6E3DD'),
      choose: () => { if (ready) this.setState({ chosen: true }); }, cta,
      ctaStyle: chosen ? 'background:#E4F4EA;color:#0F6B43' : ready ? 'background:#C93A30;color:#FFFFFF;box-shadow:0 10px 22px rgba(201,58,48,.26)' : 'background:rgba(201,58,48,.45);color:#FFFFFF'
    };
  }
}'''
html = page('How we hold it', hd + '\n' + bd + '\n' + ft, script)
