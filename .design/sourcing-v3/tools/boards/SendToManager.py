from ow import *

ring_head = ring(5 / 6, '5/6', 60, 6, '#6FDCB0', 'rgba(255,255,255,.1)', 15, '5 of 6 checks done')
pic = title_block('Tile cutter 600mm', 'Five checks done · the markup is Ruth’s', ring_head)
hd = head('Send to Ruth', circ('Funnel.dc.html', 'back', 'Back to the Funnel'), '', pic)
tick_well = '<span style="width: 42px; height: 42px; flex: none; border-radius: 13px; background: #E4F4EA; color: #0F6B43; display: flex; align-items: center; justify-content: center">' + svg('tick', 18, 2.6) + '</span>'
checks = lst('\n'.join(row(k, v, tick_well, '') for k, v in [
    ('Photo', 'Passed the check on the phone'), ('Packing', 'By the piece'), ('Suppliers', '2 priced'),
    ('How we hold it', 'Per order · sells about 2 a month'), ('Name & aisle', 'Tools')]))
ruth = lst(row('Ruth Nakato', 'Gets a push · sets the markup · puts it on sale', face('RN', 'manager', ring='0 0 0 2px #FFFFFF, 0 0 0 4px rgba(245,178,107,.8)'), ''))
confirm = ('  <sc-if value="{{confirm}}" hint-placeholder-val="{{ true }}">\n  <div style="position: absolute; inset: 0; display: flex; flex-direction: column">\n'
           + hd + '\n' + body('\n'.join([sec('What Ruth gets', first=True), checks, sec('Who decides next'), ruth])) + '\n'
           + dock('<span class="m">5</span> of 6 · Ruth is next', 'you can take it back', slide('Slide to send to Ruth', '{{send}}', 'send'))
           + '\n  </div>\n  </sc-if>')
tr = track([
    ('done', '', 'Sent', 'by you, 18:42', '#B3BCD2'),
    ('now', '<span style="width: 44px; height: 44px; border-radius: 999px; background: #F6E4F1; color: #7A3268; font-size: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 3px #19223F, 0 0 0 5px #F5B26B; animation: owRingA 2s infinite">RN</span>', 'Ruth', 'sets the markup', '#F5B26B'),
    ('later', svg('M3 21V8l9-5 9 5v13M7 21v-8h10v8M7 17h10', 19, 2), 'On sale', 'askers told', '#B3BCD2'),
], 'A buzz on this phone when Ruth decides')
sent = ('  <sc-if value="{{sent}}" hint-placeholder-val="{{ false }}">\n'
        + done_screen('send', 'With Ruth', 'Tile cutter 600mm · pushed 18:42',
                      '<div style="width: 100%; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-radius: 20px; background: rgba(255,255,255,.06); box-shadow: inset 0 0 0 1px rgba(255,255,255,.07)">'
                      '<span style="height: 74px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px"><span class="m" style="font-size: 22px; font-weight: 600; line-height: 1; color: #6FDCB0">5/6</span><span style="font-size: 11px; font-weight: 600; color: #B3BCD2">checks done</span></span>'
                      '<span style="height: 74px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; box-shadow: -1px 0 0 rgba(255,255,255,.07)"><span class="m" style="font-size: 22px; font-weight: 600; line-height: 1">2</span><span style="font-size: 11px; font-weight: 600; color: #B3BCD2">now with Ruth</span></span></div>',
                      tr, 'Funnel.dc.html', undo_click='{{back}}')
        + '\n  </sc-if>')
script = '''class Component extends DCLogic {
  constructor(p) { super(p); this.state = { sent: false }; }
  renderVals() {
    const sent = this.state.sent;
    return { confirm: !sent, sent, send: () => this.setState({ sent: true }), back: () => this.setState({ sent: false }) };
  }
}'''
html = page('Send to Ruth', confirm + '\n' + sent, script)
