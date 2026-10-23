from ow import *

pic = title_block('Moses Lubega', 'Sourcing · Mukasa Hardware', '<span style="width: 60px; height: 60px; flex: none; border-radius: 999px; background: #243052; box-shadow: 0 0 0 2px #16203C, 0 0 0 4px rgba(111,220,176,.55); color: #FFFFFF; font-size: 20px; font-weight: 700; display: flex; align-items: center; justify-content: center">ML</span>') + '\n' + stats([('12', 'went live in Oct', '#6FDCB0'), ('118', 'prices confirmed', None), ('41', 'asks sorted', None)])
hd = head('You', circ('Main.dc.html', 'back', 'Back to Today'), '', pic)
toggle = '<button type="button" role="switch" aria-checked="{{pushOn}}" aria-label="Notifications" onClick="{{togglePush}}" style="all: unset; cursor: pointer; position: relative; width: 50px; height: 30px; flex: none; border-radius: 999px; {{track}}"><span style="position: absolute; top: 3px; width: 24px; height: 24px; border-radius: 999px; background: #FFFFFF; box-shadow: 0 1px 3px rgba(22,32,60,.25); {{knob}}"></span></button>'
bd = body('\n'.join([
    sec('Prices to confirm a day', 'oldest first', first=True),
    '    <div style="' + LIST + '; padding: 12px 14px">' + stepper('pf_day', '{{perDay}}', 'a day', '{{less}}', '{{more}}', 'Prices to confirm a day') + '</div>',
    sec('This phone'),
    lst('\n'.join([
        row('Notifications', 'New asks, sent back, on sale, proposals', icon_well('bell', 'plain'), toggle),
        row('Shop', 'Mukasa Hardware', icon_well('supplier', 'plain'), ''),
    ])),
    '    <a href="Outbox.dc.html" style="display: flex; align-items: center; gap: 12px; min-height: 64px; padding: 0 14px; border-radius: 20px; background: #FFFBF6; box-shadow: inset 0 0 0 1.5px #F3DCC4">' + icon_well('outbox', 'amber', 40, 12) + '<span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; font-weight: 700"><span class="m">2</span> captures only on this phone</span><span style="font-size: 12px; font-weight: 600; color: #7A4A02">Signing out now loses them</span></span>' + chev('#95530C') + '</a>',
]))
ft = '''  <div style="flex: none; padding: 12px 16px 22px; display: flex; flex-direction: column; gap: 8px">
    <sc-if value="{{notConfirming}}" hint-placeholder-val="{{ true }}">''' + pill('Sign out', onclick='{{signOut}}', kind='ghost') + '''</sc-if>
    <sc-if value="{{confirmOut}}" hint-placeholder-val="{{ false }}">
      <span style="padding: 0 4px; font-size: 12px; font-weight: 700; color: #7A4A02; text-align: center">Wait for signal, or lose the 2 captures</span>
      <button type="button" onClick="{{outAnyway}}" style="all: unset; cursor: pointer; box-sizing: border-box; width: 100%; height: 58px; border-radius: 999px; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; {{outStyle}}">{{outLabel}}</button>
    </sc-if>
  </div>'''
script = '''class Component extends DCLogic {
  constructor(p) { super(p); this.state = { perDay: 6, push: true, out: false, gone: false }; }
  renderVals() {
    const S = this.state;
    return {
      perDay: S.perDay, less: () => this.setState({ perDay: Math.max(1, S.perDay - 1) }), more: () => this.setState({ perDay: S.perDay + 1 }),
      pushOn: String(S.push), togglePush: () => this.setState({ push: !S.push }),
      track: S.push ? 'background:#0F6B43' : 'background:#E0DCD4', knob: S.push ? 'left:23px' : 'left:3px',
      confirmOut: S.out, notConfirming: !S.out, signOut: () => this.setState({ out: true }),
      outAnyway: () => this.setState({ gone: true }), outLabel: S.gone ? 'Signed out' : 'Sign out anyway',
      outStyle: S.gone ? 'background:#F1EEE8;color:#5F6980' : 'background:#C93A30;color:#FFFFFF;box-shadow:0 10px 22px rgba(201,58,48,.26)'
    };
  }
}'''
html = page('You', hd + '\n' + bd + '\n' + ft, script)
