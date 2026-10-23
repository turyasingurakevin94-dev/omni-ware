from ow import *

pic = title_block('Wire mesh BRC A142', 'In every app since <span class="m" style="color: #FFFFFF">18:10</span> · priced by Ruth', ring(1, '6/6', 60, 6, '#6FDCB0', 'rgba(255,255,255,.1)', 15, 'All six checks done')) + '\n' + stats([('147,500', 'shelf price', None), ('3', 'customers told', '#6FDCB0'), ('20', 'sheets reserved', None)])
hd = head('On sale', circ('Funnel.dc.html', 'back', 'Back to the Funnel'), '', pic)
pushed = '<span style="flex: none; height: 26px; padding: 0 10px; border-radius: 999px; background: #E4F4EA; color: #0F6B43; font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 4px">' + svg('tick', 12, 3) + 'Pushed</span>'
told = lst('\n'.join(row(n, w, face(i, t), pushed) for i, t, n, w in [
    ('GA', 'sky', 'Grace Akello', 'Sales · tells Kato Construction'),
    ('BO', 'manager', 'Brian Ouma', 'Sales · tells Lubowa Builders'),
    ('AN', 'teal', 'Aisha Namutebi', 'Agent · tells Mukono Roofing'),
    ('DO', 'indigo', 'Denis Okello', 'Buyer · first batch, ≈40')]))
def st(word, ok):
    c = 'background: #E4F4EA; color: #0F6B43' if ok else 'background: #F1EEE8; color: #5F6980'
    return f'<span style="flex: none; height: 26px; padding: 0 10px; border-radius: 999px; {c}; font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 4px">{word}</span>'
cust = lst('\n'.join(row(n, f'Told 147,500 · by {who}', icon_well('user', 'green' if ok else 'plain'), st(word, ok))
                     for n, who, word, ok in [('Kato Construction', 'Grace', 'Reserved 20', True), ('Lubowa Builders', 'Brian', 'Seen · 12 asked', False), ('Mukono Roofing', 'Aisha', 'Not seen · 8 asked', False)]))
bd = body('\n'.join([sec('Already told', 'a push each', first=True), told, sec('The customers who asked', 'one tap reserves it'), cust,
                     lst(row('First look on 16 Nov', 'Did 40 sell? Your Stock calls: 7 of 9 right', icon_well('gauge', 'green'), chev(), href='ReportCard.dc.html')),
                     '    <div style="display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 0 14px; border-radius: 20px; box-shadow: inset 0 0 0 1px #E6E3DD">' + face('RN', 'manager', 32) + '<span style="flex: 1; font-size: 12px; font-weight: 600; color: #5F6980">{{pinSub}}</span></div>']))
ft = foot('<button type="button" onClick="{{pin}}" style="all: unset; cursor: pointer; box-sizing: border-box; width: 100%; height: 58px; border-radius: 999px; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px; {{pinStyle}}">{{pinLabel}}</button>')
script = '''class Component extends DCLogic {
  constructor(p) { super(p); this.state = { pin: false }; }
  renderVals() {
    const on = this.state.pin;
    return {
      pin: () => this.setState({ pin: !on }),
      pinSub: on ? 'Asked at 18:12 · Ruth decides the agents’ feed' : 'Pinned on the agents’ feed for 14 days, agents sell it · Ruth decides',
      pinLabel: on ? 'Asked Ruth · tap to take it back' : 'Ask Ruth to pin it for the agents',
      pinStyle: on ? 'background:#E4F4EA;color:#0F6B43' : 'background:#C93A30;color:#FFFFFF;box-shadow:0 10px 22px rgba(201,58,48,.26)'
    };
  }
}'''
html = page('On sale', hd + '\n' + bd + '\n' + ft, script)
