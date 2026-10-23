from ow import *

pic = '''    <div style="display: flex; align-items: center; gap: 14px">
      <span style="width: 60px; height: 60px; flex: none; border-radius: 999px; display: flex; align-items: center; justify-content: center; {{badge}}">''' + svg('M4 9a12 12 0 0 1 16 0M7 12.5a7.5 7.5 0 0 1 10 0M10 16a3 3 0 0 1 4 0M12 19h.01', 26, 2.2) + '''</span>
      <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 22px; font-weight: 700; letter-spacing: -.01em">{{title}}</span><span style="font-size: 12px; font-weight: 600; color: #B3BCD2">{{sub}}</span></span>
    </div>
''' + stats([('{{waitingN}}', 'on this phone', '#F5B26B'), ('{{upN}}', 'went up today', '#6FDCB0')])
hd = head('Saved on this phone', circ('Main.dc.html', 'back', 'Back to Today'), '', pic)
q_row = '''      <div style="display: flex; align-items: center; gap: 12px; min-height: 66px; padding: 0 10px">
        <span style="width: 42px; height: 42px; flex: none; border-radius: 13px; display: flex; align-items: center; justify-content: center; {{q.well}}"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{{q.icon}}"></path></svg></span>
        <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{{q.what}}</span><span style="font-size: 12px; font-weight: 600; color: #5F6980">{{q.sub}}</span></span>
        <span style="flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 4px"><span style="width: 8px; height: 8px; border-radius: 999px; {{q.dot}}"></span><span class="m" style="font-size: 11px; font-weight: 600; color: #9AA1AE">{{q.at}}</span></span>
      </div>'''
bd = body('\n'.join([
    sec('{{listHead}}', first=True),
    '    <div style="' + LIST + '; padding: 6px; display: flex; flex-direction: column; gap: 2px">\n      <sc-for list="{{queue}}" as="q" hint-placeholder-count="2">\n' + q_row + '\n      </sc-for>\n    </div>',
    sec('If someone changed the same price meanwhile'),
    lst(row('The newer one stays on the list', 'You see both here and pick', icon_well('twins', 'plain'), '')),
]))
ft = foot('<button type="button" onClick="{{send}}" style="all: unset; cursor: pointer; box-sizing: border-box; width: 100%; height: 58px; border-radius: 999px; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; {{btnStyle}}">{{btnLabel}}</button>')
script = '''class Component extends DCLogic {
  constructor(p) { super(p); this.state = { sent: false }; }
  renderVals() {
    const sent = this.state.sent;
    const dot = sent ? 'background:#0F6B43' : 'background:#F5B26B;animation:owPulseA 2s infinite';
    const queue = [
      { what: 'Wire mesh BRC A142 · 149,000', sub: 'Rival price · Kikuubo Hardware Mart', at: '18:02', well: 'background:#F6E4F1;color:#7A3268', dot,
        icon: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z' },
      { what: 'Gate valve ½"', sub: 'Photo · passed the check', at: '18:05', well: 'background:#F1EEE8;color:#1C2233', dot,
        icon: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z' }
    ];
    return {
      queue, waitingN: sent ? '0' : '2', upN: sent ? '11' : '9',
      title: sent ? 'All up' : '2 waiting for signal', sub: sent ? 'Everything is on the shop’s books' : 'They send by themselves when the phone is back online',
      badge: sent ? 'background:#6FDCB0;color:#16203C' : 'background:#FDEEE1;color:#95530C;animation:owPulseA 2s infinite',
      listHead: sent ? 'Sent just now' : 'Waiting to send',
      send: () => this.setState({ sent: true }),
      btnLabel: sent ? 'Back to Today' : 'Try now',
      btnStyle: sent ? 'background:#FFFFFF;color:#16203C;box-shadow:inset 0 0 0 1.5px #E6E3DD' : 'background:#C93A30;color:#FFFFFF;box-shadow:0 10px 22px rgba(201,58,48,.26)'
    };
  }
}'''
html = page('Saved on this phone', hd + '\n' + bd + '\n' + ft, script)
