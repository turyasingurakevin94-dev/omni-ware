from ow import *

segh = '''    <div role="radiogroup" aria-label="Where the prices come from" style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; padding: 3px; border-radius: 14px; background: rgba(255,255,255,.08)">
      <sc-for list="{{sources}}" as="s" hint-placeholder-count="2"><button type="button" role="radio" aria-checked="{{s.on}}" onClick="{{s.pick}}" style="{{s.style}}">{{s.label}}</button></sc-for>
    </div>'''
paper = '''    <sc-if value="{{isPhoto}}" hint-placeholder-val="{{ true }}">
    <div style="display: flex; align-items: center; gap: 14px">
      <div role="img" aria-label="Photo of Namanve’s printed price list" style="width: 64px; height: 80px; flex: none; border-radius: 8px; background: #FBFAF7; box-shadow: 0 6px 16px rgba(0,0,0,.3); padding: 8px 7px; box-sizing: border-box; display: flex; flex-direction: column; gap: 5px; transform: rotate(-3deg)"><i style="height: 4px; width: 60%; border-radius: 2px; background: #1C2233"></i><i style="height: 3px; width: 92%; border-radius: 2px; background: #9AA1B2"></i><i style="height: 3px; width: 80%; border-radius: 2px; background: #9AA1B2"></i><i style="height: 3px; width: 88%; border-radius: 2px; background: #9AA1B2"></i><i style="height: 3px; width: 70%; border-radius: 2px; background: #9AA1B2"></i><i style="height: 3px; width: 84%; border-radius: 2px; background: #9AA1B2"></i></div>
      <span style="flex: 1; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 17px; font-weight: 700">Namanve’s printed list</span><span style="font-size: 12px; font-weight: 600; color: #B3BCD2">snapped <span class="m" style="color: #FFFFFF">10:42</span> · <span class="m" style="color: #FFFFFF">6</span> lines read</span></span>
    </div>
    </sc-if>
    <sc-if value="{{isChat}}" hint-placeholder-val="{{ false }}">
    <div style="display: flex; flex-direction: column; gap: 6px">
      <span style="font-size: 12px; font-weight: 600; color: #B3BCD2">Shared from WhatsApp · Namanve Sheets · <span class="m">09:15</span></span>
      <div style="align-self: flex-start; max-width: 300px; padding: 10px 12px; border-radius: 4px 16px 16px 16px; background: rgba(255,255,255,.1); font-size: 13px; line-height: 1.5">Good morning boss. Prices this week:<br>G28 3m <span class="m">34,200</span> (100+ <span class="m">33,500</span>) · G30 3m <span class="m">30,500</span><br>gutter 4" <span class="m">18,000</span> · nails 1kg <span class="m">9,800</span><br>ridge cap <span class="m">2?,500</span> · valley gutter 3m <span class="m">21,000</span> new</div>
    </div>
    </sc-if>'''
hd = head('Read their prices', circ('Capture.dc.html', 'back', 'Back'), '<span style="flex: none; height: 30px; padding: 0 12px; border-radius: 999px; background: #E4E6FA; color: #3A3F9B; font-size: 12px; font-weight: 700; display: flex; align-items: center">Namanve</span>', segh + '\n' + paper, gap=14)
rrow = '''      <div style="display: flex; flex-direction: column; gap: 8px; padding: 10px; border-top: {{r.rule}}; {{r.rowBg}}">
        <div style="display: flex; align-items: center; gap: 12px">
          <button type="button" role="checkbox" aria-checked="{{r.onStr}}" aria-label="{{r.aria}}" onClick="{{r.toggle}}" style="all: unset; cursor: pointer; width: 28px; height: 28px; flex: none; border-radius: 9px; display: flex; align-items: center; justify-content: center; {{r.box}}">''' + svg('tick', 14, 3) + '''</button>
          <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{{r.name}}</span><span style="font-size: 12px; font-weight: 600; color: #5F6980; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">read “{{r.read}}”</span></span>
          <span style="flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 3px"><span class="m" style="font-size: 15px; font-weight: 600">{{r.price}}</span><span style="height: 20px; padding: 0 7px; border-radius: 999px; font-size: 11px; font-weight: 700; display: flex; align-items: center; white-space: nowrap; {{r.tagStyle}}">{{r.tag}}</span></span>
        </div>
        <sc-if value="{{r.unsure}}" hint-placeholder-val="{{ false }}">
          <div style="display: flex; align-items: center; gap: 8px; padding-left: 40px">
            <input id="{{r.inputId}}" type="text" inputmode="numeric" value="{{r.guess}}" aria-label="Which price is it?" style="box-sizing: border-box; flex: 1; min-width: 0; height: 42px; padding: 0 12px; border-radius: 14px; border: none; box-shadow: inset 0 0 0 2px #95530C; font-family: 'IBM Plex Mono', monospace; font-size: 16px; font-weight: 600">
            <button type="button" onClick="{{r.fix}}" style="all: unset; cursor: pointer; height: 42px; padding: 0 14px; border-radius: 999px; background: #16203C; color: #FFFFFF; font-size: 13px; font-weight: 700; display: flex; align-items: center">That’s it</button>
          </div>
        </sc-if>
        <sc-if value="{{r.isNew}}" hint-placeholder-val="{{ false }}"><span style="padding-left: 40px; font-size: 12px; font-weight: 600; color: #5F6980">Ticked, it starts a hunt with this as the first quote</span></sc-if>
      </div>'''
bd = body('\n'.join([
    sec('What it read', 'against our last price', first=True),
    '    <div style="' + LIST + '; padding: 0 6px">\n      <sc-for list="{{rows}}" as="r" hint-placeholder-count="6">\n' + rrow + '\n      </sc-for>\n    </div>',
    '    <span style="display: flex; align-items: center; gap: 6px; padding: 0 4px; font-size: 12px; font-weight: 600; color: #5F6980">' + svg('outbox', 14, 2) + 'Reading needs signal · without it, the photo waits on this phone</span>',
]))
ft = foot(pill('{{saveLabel}}', href='Main.dc.html', kind='red'))
script = '''class Component extends DCLogic {
  constructor(p) { super(p); this.state = { src: 'photo', off: {}, fixed: false, hunt: false }; }
  renderVals() {
    const S = this.state;
    const SAME = 'background:#E4F4EA;color:#0F6B43', UP = 'background:#FDEEE1;color:#7A4A02', NEW = 'background:#FDE8E4;color:#A82D24';
    const base = [
      { id: 'a', name: 'Iron sheet G28 3m', read: 'G28 3m 34,200 (100+ 33,500)', price: '34,200', tag: 'same · 100+ 33,500', tagStyle: SAME },
      { id: 'b', name: 'Iron sheet G30 3m', read: 'G30 3m 30,500', price: '30,500', tag: '+700 on 29,800', tagStyle: UP },
      { id: 'c', name: 'Gutter 4" × 3m', read: 'gutter 4" 18,000', price: '18,000', tag: 'same', tagStyle: SAME },
      { id: 'd', name: 'Roofing nails 1kg', read: 'nails 1kg 9,800', price: '9,800', tag: '+300 on 9,500', tagStyle: UP },
      { id: 'e', name: 'Ridge cap 0.4mm, 2m', read: 'ridge cap 2?,500', price: '2?,500', tag: 'not sure', tagStyle: UP, unsure: true, guess: '23,500' },
      { id: 'f', name: 'Valley gutter 3m', read: 'valley gutter 3m 21,000 new', price: '21,000', tag: 'not on our list', tagStyle: NEW, isNew: true }
    ];
    const rows = base.map((r, i) => {
      const unsure = !!r.unsure && !S.fixed;
      const on = r.isNew ? S.hunt : (unsure ? false : !S.off[r.id]);
      return {
        ...r, unsure, isNew: !!r.isNew, inputId: 'rp_' + r.id, onStr: String(on), rule: i ? '1px solid #EFECE6' : 'none',
        price: r.unsure && S.fixed ? '23,500' : r.price,
        tag: r.unsure && S.fixed ? 'same' : r.tag, tagStyle: r.unsure && S.fixed ? SAME : r.tagStyle,
        aria: (on ? 'Leave out ' : 'Include ') + r.name, rowBg: unsure ? 'background:#FFFBF6;border-radius:14px' : '',
        box: on ? 'background:#16203C;color:#FFFFFF' : 'background:#FFFFFF;color:transparent;box-shadow:inset 0 0 0 1.5px #C9C4BA',
        toggle: () => { if (r.isNew) this.setState({ hunt: !S.hunt }); else if (!unsure) this.setState({ off: { ...S.off, [r.id]: on } }); },
        fix: () => this.setState({ fixed: true })
      };
    });
    const prices = rows.filter(r => r.onStr === 'true' && !r.isNew).length;
    const sources = [['photo', 'Photo of their list'], ['chat', 'WhatsApp message']].map(([k, label]) => ({
      label, on: String(S.src === k), pick: () => this.setState({ src: k }),
      style: 'all:unset;cursor:pointer;box-sizing:border-box;height:38px;border-radius:11px;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;' + (S.src === k ? 'background:#FFFFFF;color:#16203C' : 'color:#B3BCD2')
    }));
    return { rows, sources, isPhoto: S.src === 'photo', isChat: S.src === 'chat',
      saveLabel: 'Save ' + prices + (prices === 1 ? ' price' : ' prices') + (S.hunt ? ' · start 1 hunt' : '') };
  }
}'''
html = page('Read their prices', hd + '\n' + bd + '\n' + ft, script)
