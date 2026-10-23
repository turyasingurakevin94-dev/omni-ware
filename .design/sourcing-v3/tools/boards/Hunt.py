from ow import *

pic = title_block('Gutter bracket, galvanised', 'Searched for · nobody we know sells it') + '\n' + stats([('7', 'searches', None), ('4', 'named people', None), ('0', 'suppliers sell it', '#F5B26B')])
hd = head('Hunt it', circ('Main.dc.html', 'back', 'Back to Today'), '', pic)

sup_row = '''      <button type="button" role="checkbox" aria-checked="{{s.on}}" onClick="{{s.toggle}}" style="all: unset; cursor: pointer; box-sizing: border-box; width: 100%; display: flex; align-items: center; gap: 12px; min-height: 66px; padding: 0 10px; border-radius: 16px">
        <span style="width: 42px; height: 42px; flex: none; border-radius: 999px; background: #E4E6FA; color: #3A3F9B; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center">{{s.ini}}</span>
        <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 14px; font-weight: 700">{{s.name}}</span><span style="font-size: 12px; font-weight: 600; color: #5F6980; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{{s.sells}} · {{s.why}}</span></span>
        <span style="width: 28px; height: 28px; flex: none; border-radius: 9px; display: flex; align-items: center; justify-content: center; {{s.box}}">''' + svg('tick', 15, 3) + '''</span>
      </button>'''
bd = body('\n'.join([
    sec('Who to ask', 'by what they sell', first=True),
    '    <div style="' + LIST + '; padding: 6px; display: flex; flex-direction: column; gap: 2px">\n      <sc-for list="{{sups}}" as="s" hint-placeholder-count="3">\n' + sup_row + '\n      </sc-for>\n'
    + row('A supplier we don’t have yet', 'Add them, then ask', icon_well('plus', 'plain'), chev(), href='NewSupplier.dc.html') + '\n    </div>',
    sec('The message'),
    '    <div style="align-self: flex-end; max-width: 300px; padding: 12px 14px; border-radius: 18px 18px 4px 18px; background: #E4F4EA; font-size: 14px; line-height: 1.45">Hello, do you have galvanised gutter brackets? Your price for <span class="m">10</span>, and for <span class="m">50</span>? A photo helps. · Moses, Mukasa Hardware</div>',
    '    <span style="align-self: flex-end; padding: 0 4px; font-size: 12px; font-weight: 600; color: #5F6980">Opens WhatsApp once for each one you pick</span>',
]))
dk = dock('{{pickedLine}}', '<a href="MarketRun.dc.html" style="color: #FFFFFF; text-decoration: underline; text-underline-offset: 3px">or ask on the walk</a>',
          slide('{{askLabel}}', '{{ask}}', 'send', disabled_hole='{{slideOff}}'))

script = '''class Component extends DCLogic {
  constructor(p) { super(p); this.state = { on: {}, asked: false }; }
  renderVals() {
    const on = this.state.on, asked = this.state.asked;
    const base = [
      { id: 'a', ini: 'NS', name: 'Namanve Sheets', sells: 'Gutters · roofing', why: 'sells gutters' },
      { id: 'b', ini: 'KF', name: 'Katwe Fabricators', sells: 'Fabrication', why: 'can make them' },
      { id: 'c', ini: 'KS', name: 'Kiseka Steel', sells: 'Flat bar · wire', why: 'sells the metal' }
    ];
    const sups = base.map(s => ({
      ...s, on: String(!!on[s.id]),
      box: on[s.id] ? 'background:#16203C;color:#FFFFFF' : 'background:#FFFFFF;color:transparent;box-shadow:inset 0 0 0 1.5px #C9C4BA',
      toggle: () => { if (!asked) this.setState({ on: { ...on, [s.id]: !on[s.id] } }); }
    }));
    const n = base.filter(s => on[s.id]).length;
    return {
      sups,
      pickedLine: asked ? 'Asked ' + n + ' on WhatsApp' : n ? n + ' picked' : 'Nobody picked yet',
      askLabel: asked ? 'Asked · answers come to Proposals' : n ? 'Slide to ask ' + n + ' on WhatsApp' : 'Pick who to ask first',
      slideOff: String(!n || asked), slideOpacity: !n || asked ? '.5' : '1',
      ask: () => { if (n && !asked) this.setState({ asked: true }); }
    };
  }
}'''
html = page('Hunt it', hd + '\n' + bd + '\n' + dk, script)
