from ow import *

line = '''    <div role="img" aria-label="Was 42,000; yours {{offerShown}}; they ask 44,000" style="position: relative; height: 72px; margin: 0 6px">
      <span style="position: absolute; left: 0; right: 0; top: 34px; height: 4px; border-radius: 2px; background: rgba(255,255,255,.12)"></span>
      <sc-for list="{{marks}}" as="k" hint-placeholder-count="3">
        <span style="position: absolute; display: flex; gap: 5px; {{k.pos}}">
          <span style="display: flex; align-items: baseline; gap: 5px; white-space: nowrap"><span style="font-size: 11px; font-weight: 700; {{k.ink}}">{{k.label}}</span><span class="m" style="font-size: 11px; font-weight: 600; color: #B3BCD2">{{k.v}}</span></span>
          <span style="width: 12px; height: 12px; border-radius: 999px; {{k.dot}}"></span>
        </span>
      </sc-for>
    </div>'''
pic = title_block('PVC pipe 4" × 6m', 'Owino Plumbing asks <span class="m" style="color: #FFFFFF">44,000</span> · +4.8%', face('OP', 'indigo', 52)) + '\n' + line
hd = head('Push back', circ('Visit.dc.html', 'back', 'Back to the visit'), '', pic)
tiles = '''    <div role="radiogroup" aria-label="Your counter" style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px">
      <sc-for list="{{offers}}" as="o" hint-placeholder-count="3"><button type="button" role="radio" aria-checked="{{o.on}}" onClick="{{o.pick}}" style="{{o.style}}">{{o.label}}</button></sc-for>
    </div>
    <label style="display: flex; align-items: center; gap: 10px; height: 52px; padding: 0 14px; border-radius: 16px; background: #FFFFFF; box-shadow: inset 0 0 0 1.5px #E6E3DD"><span style="font-size: 13px; font-weight: 700; color: #5F6980">Or type it</span><input value="{{typed}}" inputmode="numeric" placeholder="0" aria-label="Your counter, typed" style="flex: 1; min-width: 0; border: none; outline: none; background: transparent; font-family: 'IBM Plex Mono', monospace; font-size: 18px; font-weight: 600; text-align: right"></label>'''
whys = '''    <div style="display: flex; flex-wrap: wrap; gap: 6px"><sc-for list="{{reasons}}" as="r" hint-placeholder-count="3"><button type="button" aria-pressed="{{r.on}}" onClick="{{r.toggle}}" style="{{r.style}}">{{r.label}}</button></sc-for></div>'''
keep = '    <div style="display: flex; align-items: center; gap: 12px; min-height: 52px; padding: 0 14px; border-radius: 20px; box-shadow: inset 0 0 0 1px #E6E3DD">' + svg('clock', 17, 2, '#5F6980') + '<span style="flex: 1; font-size: 12px; font-weight: 600; color: #5F6980">Until Owino answers, <span class="m" style="color: #1C2233">42,000</span> stays on the price list</span></div>'
form = ('  <sc-if value="{{editing}}" hint-placeholder-val="{{ true }}">\n  <div style="position: absolute; inset: 0; display: flex; flex-direction: column">\n' + hd + '\n'
        + body('\n'.join([sec('Your counter', first=True), tiles, sec('Why they should agree', 'pick any'), whys, keep])) + '\n'
        + dock('{{dockLine}}', 'answers come to Proposals', slide('{{slideLabel}}', '{{send}}', 'send', disabled_hole='{{slideOff}}')) + '\n  </div>\n  </sc-if>')
tr = track([
    ('done', '', 'Sent', 'by you, 17:10', '#B3BCD2'),
    ('now', '<span style="width: 44px; height: 44px; border-radius: 999px; background: #E4E6FA; color: #3A3F9B; font-size: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 3px #19223F, 0 0 0 5px #F5B26B; animation: owRingA 2s infinite">OP</span>', 'Owino', 'answers in their app', '#F5B26B'),
    ('later', svg('tag', 19, 2), 'Price list', 'you accept', '#B3BCD2'),
], 'A buzz on this phone when Owino answers')
sent = ('  <sc-if value="{{sent}}" hint-placeholder-val="{{ false }}">\n'
        + done_screen('send', 'Counter sent', 'PVC pipe 4" × 6m · to Owino Plumbing',
                      '<div style="width: 100%; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-radius: 20px; background: rgba(255,255,255,.06); box-shadow: inset 0 0 0 1px rgba(255,255,255,.07)"><span style="height: 74px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px"><span class="m" style="font-size: 22px; font-weight: 600; line-height: 1; color: #6FDCB0">{{offerShown}}</span><span style="font-size: 11px; font-weight: 600; color: #B3BCD2">your counter</span></span><span style="height: 74px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; box-shadow: -1px 0 0 rgba(255,255,255,.07)"><span class="m" style="font-size: 22px; font-weight: 600; line-height: 1">44,000</span><span style="font-size: 11px; font-weight: 600; color: #B3BCD2">they asked</span></span></div>',
                      tr, 'Visit.dc.html', undo_click='{{undo}}', done_label='Back to the visit')
        + '\n  </sc-if>')
script = '''class Component extends DCLogic {
  constructor(p) { super(p); this.state = { offer: null, why: {}, sent: false }; }
  renderVals() {
    const { offer, why, sent } = this.state;
    const fmt = (n) => n.toLocaleString('en-US');
    const lo = 41000, hi = 45000;
    const at = (v) => (v - lo) / (hi - lo) * 100;
    const pts = [
      { label: 'Was', v: '42,000', p: 42000, dot: 'background:#8D99B5', ink: 'color:#B3BCD2', pos: 'top:12px;flex-direction:column;right:calc(' + (100 - at(42000)).toFixed(1) + '% - 6px);align-items:flex-end' },
      { label: 'They ask', v: '44,000', p: 44000, dot: 'background:#F5B26B', ink: 'color:#F5B26B', pos: 'top:12px;flex-direction:column;left:calc(' + at(44000).toFixed(1) + '% - 6px);align-items:flex-start' }
    ];
    const marks = offer ? pts.concat([{ label: 'Yours', v: fmt(offer), dot: 'background:#FFFFFF', ink: 'color:#FFFFFF', pos: 'top:30px;flex-direction:column-reverse;left:calc(' + at(offer).toFixed(1) + '% - 6px);align-items:flex-start' }]) : pts;
    const offers = [42000, 42500, 43000].map(v => ({
      label: fmt(v), on: String(offer === v), pick: () => this.setState({ offer: v }),
      style: 'all:unset;cursor:pointer;box-sizing:border-box;height:56px;border-radius:16px;font-family:"IBM Plex Mono",monospace;font-size:15px;font-weight:600;display:flex;align-items:center;justify-content:center;' +
        (offer === v ? 'background:#16203C;color:#FFFFFF' : 'background:#FFFFFF;box-shadow:inset 0 0 0 1.5px #E6E3DD')
    }));
    const reasons = [['a', 'We buy about 60 a month'], ['b', '22 orders in six months'], ['c', 'We buy every week']].map(([k, label]) => ({
      label, on: String(!!why[k]), toggle: () => this.setState({ why: { ...why, [k]: !why[k] } }),
      style: 'all:unset;cursor:pointer;box-sizing:border-box;height:36px;padding:0 14px;border-radius:999px;font-size:13px;font-weight:700;display:flex;align-items:center;' + (why[k] ? 'background:#16203C;color:#FFFFFF' : 'background:#FFFFFF;box-shadow:inset 0 0 0 1.5px #E6E3DD')
    }));
    const n = Object.values(why).filter(Boolean).length;
    return {
      marks, offers, reasons, editing: !sent, sent, typed: offer ? fmt(offer) : '',
      offerShown: offer ? fmt(offer) : '—',
      dockLine: offer ? 'Counter ' + fmt(offer) + (n ? ' · ' + n + ' reason' + (n > 1 ? 's' : '') : '') : 'No counter yet',
      slideLabel: offer ? 'Slide to send ' + fmt(offer) + ' to Owino' : 'Pick your counter first',
      slideOff: String(!offer), slideOpacity: offer ? '1' : '.72',
      send: () => { if (offer) this.setState({ sent: true }); },
      undo: () => this.setState({ sent: false })
    };
  }
}'''
html = page('Push back', form + '\n' + sent, script)
