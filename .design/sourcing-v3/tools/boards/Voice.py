from ow import *

mic = '''    <div style="display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 4px 0 2px">
      <button type="button" onClick="{{toggle}}" aria-label="{{micAria}}" aria-pressed="{{listeningStr}}" style="all: unset; cursor: pointer; position: relative; width: 120px; height: 120px; border-radius: 999px; display: flex; align-items: center; justify-content: center; {{ringStyle}}">
        <span style="width: 84px; height: 84px; border-radius: 999px; display: flex; align-items: center; justify-content: center; {{micStyle}}">''' + svg('mic', 34, 1.9) + '''</span>
      </button>
      <div aria-hidden="true" style="display: flex; align-items: center; gap: 3px; height: 24px"><sc-for list="{{level}}" as="b" hint-placeholder-count="15"><i style="width: 4px; border-radius: 2px; {{b}}"></i></sc-for></div>
      <span style="font-size: 12px; font-weight: 600; color: #B3BCD2">{{hint}}</span>
    </div>'''
hd = head('Say it', circ('Capture.dc.html', 'back', 'Back'), '', mic)
heard = '''    <sc-if value="{{heard}}" hint-placeholder-val="{{ true }}">
    <div style="display: flex; flex-direction: column; gap: 10px">
      <span style="padding: 4px 4px 0; font-size: 20px; font-weight: 700; letter-spacing: -.01em; line-height: 1.3">“Kiseka, wire mesh, one eighteen”</span>
      <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px">
        <sc-for list="{{chips}}" as="c" hint-placeholder-count="4">
          <a href="{{c.href}}" style="min-height: 64px; padding: 10px 12px; border-radius: 18px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; gap: 3px; {{c.style}}"><span style="font-size: 11px; font-weight: 700">{{c.k}}</span><span style="font-size: 15px; font-weight: 700; color: #1C2233; {{c.face}}">{{c.v}}</span></a>
        </sc-for>
      </div>
      <div style="display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 0 14px; border-radius: 16px; background: #E4F4EA; color: #0F6B43; font-size: 13px; font-weight: 700">''' + svg('tick', 16, 2.6) + '''<span>Same as <span class="m">2</span> days ago · saves as “Same price”</span></div>
    </div>
    </sc-if>
    <sc-if value="{{notHeard}}" hint-placeholder-val="{{ false }}">
''' + sec('Say it like', first=True) + '''
    <div style="''' + LIST + '''; padding: 6px; display: flex; flex-direction: column; gap: 2px">
      <sc-for list="{{examples}}" as="e" hint-placeholder-count="3">
        <div style="display: flex; align-items: center; gap: 12px; min-height: 52px; padding: 0 10px"><span style="width: 10px; height: 10px; flex: none; border-radius: 999px; {{e.dot}}"></span><span style="flex: 1; font-size: 14px; font-weight: 700">“{{e.say}}”</span><span style="font-size: 12px; font-weight: 600; color: #5F6980">{{e.kind}}</span></div>
      </sc-for>
    </div>
    </sc-if>
    <span style="display: flex; align-items: center; gap: 6px; padding: 0 4px; font-size: 12px; font-weight: 600; color: #5F6980">''' + svg('outbox', 14, 2) + '''Some phones need signal to hear you · what it heard is kept</span>'''
bd = body(heard)
ft = '''  <div style="flex: none; padding: 12px 16px 22px">
    <sc-if value="{{heard}}" hint-placeholder-val="{{ true }}">''' + pill('Save · same price', href='Main.dc.html', kind='red') + '''</sc-if>
    <sc-if value="{{notHeard}}" hint-placeholder-val="{{ false }}">''' + pill('Type it instead', href='SupplierPrice.dc.html', kind='ghost') + '''</sc-if>
  </div>'''
script = '''class Component extends DCLogic {
  constructor(p) { super(p); this.state = { mode: 'heard' }; }
  renderVals() {
    const mode = this.state.mode, listening = mode === 'listening', heard = mode === 'heard';
    const H = [6, 10, 16, 22, 14, 24, 18, 24, 12, 20, 16, 10, 22, 14, 8];
    const level = H.map(h => 'height:' + (listening ? h : 4) + 'px;background:' + (listening ? '#F0A39B' : 'rgba(255,255,255,.18)'));
    const SUP = 'background:#E4E6FA;color:#3A3F9B', NEUT = 'background:#FFFFFF;color:#5F6980;box-shadow:inset 0 0 0 1.5px #E6E3DD', MONO = "font-family:'IBM Plex Mono',monospace;font-weight:600";
    const chips = [
      { k: 'Supplier', v: 'Kiseka Steel', style: SUP, face: '', href: 'Search.dc.html' },
      { k: 'Item', v: 'Wire mesh BRC A142', style: NEUT, face: '', href: 'Search.dc.html' },
      { k: 'Price', v: '118,000', style: NEUT, face: MONO, href: 'SupplierPrice.dc.html' },
      { k: 'For', v: 'a sheet', style: NEUT, face: '', href: 'SupplierPrice.dc.html' }
    ];
    const examples = [
      { say: 'Kiseka, wire mesh, one eighteen', kind: 'supplier price', dot: 'background:#3A3F9B' },
      { say: 'Kikuubo, cement, thirty-four', kind: 'rival price', dot: 'background:#7A3268' },
      { say: 'Owino, gate valve, same', kind: 'same price', dot: 'background:#0F6B43' }
    ];
    return {
      heard, notHeard: !heard, listeningStr: String(listening), level, chips, examples,
      toggle: () => this.setState({ mode: listening ? 'heard' : 'listening' }),
      micAria: listening ? 'Stop listening' : 'Hold to talk',
      hint: listening ? 'Listening… let go when you are done' : heard ? 'Tap a box to fix it · hold to say it again' : 'Hold to talk',
      ringStyle: listening ? 'background:rgba(201,58,48,.18);box-shadow:0 0 0 12px rgba(201,58,48,.08)' : 'background:rgba(255,255,255,.07)',
      micStyle: listening ? 'background:#C93A30;color:#FFFFFF' : 'background:#FFFFFF;color:#16203C'
    };
  }
}'''
html = page('Say it', hd + '\n' + bd + '\n' + ft, script)
