from ow import *

stepper_h = '''    <div role="list" aria-label="Steps" style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px">
      <sc-for list="{{steps}}" as="s" hint-placeholder-count="4"><span role="listitem" aria-current="{{s.cur}}" style="display: flex; flex-direction: column; gap: 6px; align-items: center"><span style="width: 100%; height: 8px; border-radius: 999px; {{s.bar}}"></span><span style="font-size: 11px; font-weight: 700; {{s.ink}}">{{s.label}}</span></span></sc-for>
    </div>'''
ring_h = ('<span role="img" aria-label="{{ringAria}}" style="position: relative; width: 52px; height: 52px; flex: none; display: block"><svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true">'
          '<circle cx="26" cy="26" r="22.5" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="5"></circle>'
          '<circle cx="26" cy="26" r="22.5" fill="none" stroke="#6FDCB0" stroke-width="5" stroke-linecap="round" stroke-dasharray="{{ringDash}} 141.4" transform="rotate(-90 26 26)"></circle>'
          '<sc-if value="{{hasPart}}" hint-placeholder-val="{{ true }}"><circle cx="26" cy="26" r="22.5" fill="none" stroke="#6FDCB0" stroke-opacity=".6" stroke-width="5" stroke-dasharray="{{partDash}}" transform="rotate({{partRot}} 26 26)"></circle></sc-if></svg>'
          '<span class="m" style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600">{{doneN}}/6</span></span>')
pic = title_block('Wire mesh BRC A142', '{{stepWord}}', ring_h) + '\n' + stepper_h
hd = head('Fix the gaps', circ('Passport.dc.html', 'close', 'Back to the passport'), '', pic)
keep = '''    <sc-if value="{{onCheck}}" hint-placeholder-val="{{ true }}">
''' + sec('Filled for you · keep them, or change one', first=True) + '''
    <div style="''' + LIST + '''; padding: 6px; display: flex; flex-direction: column; gap: 2px">
''' + row('Packing · by the sheet', 'From Kiseka’s price row', icon_well('box', 'green'), '<span style="flex: none; font-size: 13px; font-weight: 700; color: #16203C">Change</span>', href='PackingGate.dc.html', sub_style='color: #0F6B43') + '''
''' + row('Name &amp; aisle · Steel &amp; mesh', 'From the askers’ words: “brc mesh”, “a142”', icon_well('name', 'green'), '<span style="flex: none; font-size: 13px; font-weight: 700; color: #16203C">Change</span>', href='NameAisle.dc.html', sub_style='color: #0F6B43') + '''
    </div>
    </sc-if>'''
photo = '''    <sc-if value="{{onPhoto}}" hint-placeholder-val="{{ false }}">
    <div style="display: flex; flex-direction: column; gap: 12px; align-items: center">
      <div style="position: relative; width: 280px; height: 280px; border-radius: 24px; overflow: hidden; {{frame}}">
        <sc-if value="{{noShot}}" hint-placeholder-val="{{ true }}"><div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: #5F6980">''' + svg('camera', 40, 1.6) + '''<span style="font-size: 13px; font-weight: 700">Fill the square with one sheet</span></div></sc-if>
        <sc-if value="{{shot}}" hint-placeholder-val="{{ false }}"><div role="img" aria-label="The photo: one sheet of mesh on a plain floor" style="position: absolute; inset: 0; background: #E9E5DE; display: flex; align-items: center; justify-content: center"><span style="width: 200px; height: 200px; border-radius: 6px; background-color: #F6F3EE; background-image: repeating-linear-gradient(0deg, #6B7480 0 2px, transparent 2px 20px), repeating-linear-gradient(90deg, #6B7480 0 2px, transparent 2px 20px); box-shadow: 0 10px 24px rgba(22,32,60,.18)"></span></div></sc-if>
      </div>
      <sc-if value="{{shot}}" hint-placeholder-val="{{ false }}"><div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 6px"><sc-for list="{{checks}}" as="c" hint-placeholder-count="4"><span style="height: 28px; padding: 0 10px; border-radius: 999px; background: #E4F4EA; color: #0F6B43; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px">''' + svg('tick', 12, 3) + '''{{c}}</span></sc-for></div></sc-if>
    </div>
    </sc-if>'''
hold = '''    <sc-if value="{{onHold}}" hint-placeholder-val="{{ false }}">
    <div style="display: flex; flex-direction: column; gap: 10px">
''' + sec('Stock is recommended · 68', 'confidence 67, under 70 · your pick', first=True) + '''
    <div role="radiogroup" aria-label="How we hold it" style="''' + LIST + '''; padding: 6px; display: flex; flex-direction: column; gap: 2px">
      <sc-for list="{{holds}}" as="h" hint-placeholder-count="3">
        <button type="button" role="radio" aria-checked="{{h.on}}" onClick="{{h.pick}}" style="{{h.style}}">
          <span style="width: 22px; height: 22px; flex: none; border-radius: 999px; {{h.dot}}"></span>
          <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; text-align: left"><span class="nm" style="font-size: 14px; font-weight: 700">{{h.label}}</span><span style="font-size: 12px; font-weight: 600; color: #5F6980">{{h.sub}}</span></span>
          <span style="flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 1px"><span class="m" style="font-size: 14px; font-weight: 600">{{h.cash}}</span><span style="font-size: 11px; font-weight: 600; color: #5F6980">cash out</span></span>
        </button>
      </sc-for>
    </div>
    <sc-if value="{{isConsign}}" hint-placeholder-val="{{ false }}"><a href="Verdict.dc.html" style="display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 0 14px; border-radius: 20px; background: #FFFBF6; box-shadow: inset 0 0 0 1.5px #F3DCC4"><span style="flex: 1; font-size: 13px; font-weight: 700; color: #7A4A02">Kiseka must agree to consign first · ask on the verdict</span>''' + chev('#95530C') + '''</a></sc-if>
    </div>
    </sc-if>'''
ready = '''    <sc-if value="{{onSend}}" hint-placeholder-val="{{ false }}">
''' + sec('What Ruth gets', first=True) + '''
    <div style="''' + LIST + '''; padding: 6px; display: flex; flex-direction: column; gap: 2px">
      <sc-for list="{{ticks}}" as="t" hint-placeholder-count="6">
        <div style="display: flex; align-items: center; gap: 12px; min-height: 52px; padding: 0 10px"><span style="width: 36px; height: 36px; flex: none; border-radius: 11px; display: flex; align-items: center; justify-content: center; {{t.well}}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{{t.mark}}"></path></svg></span><span style="flex: 1; font-size: 14px; font-weight: 700">{{t.label}}</span><span style="font-size: 12px; font-weight: 600; color: #5F6980">{{t.v}}</span></div>
      </sc-for>
    </div>
    </sc-if>'''
walk = ('  <sc-if value="{{walking}}" hint-placeholder-val="{{ true }}">\n  <div style="position: absolute; inset: 0; display: flex; flex-direction: column">\n' + hd + '\n' + body('\n'.join([keep, photo, hold, ready])) + '\n'
        + '  <sc-if value="{{dockBtn}}" hint-placeholder-val="{{ true }}"><div style="flex: none; padding: 12px 16px 22px"><button type="button" onClick="{{go}}" style="all: unset; cursor: pointer; box-sizing: border-box; width: 100%; height: 58px; border-radius: 999px; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; {{goStyle}}">{{goLabel}}</button></div></sc-if>\n'
        + '  <sc-if value="{{onSend}}" hint-placeholder-val="{{ false }}">' + dock('<span class="m">5</span> of 6 · Ruth is next', 'you can take it back', slide('Slide to send to Ruth', '{{send}}', 'send')) + '</sc-if>\n'
        + '  </div>\n  </sc-if>')
tr = track([
    ('done', '', 'Sent', 'by you, 18:30', '#B3BCD2'),
    ('now', '<span style="width: 44px; height: 44px; border-radius: 999px; background: #F6E4F1; color: #7A3268; font-size: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 3px #19223F, 0 0 0 5px #F5B26B; animation: owRingA 2s infinite">RN</span>', 'Ruth', 'sets the markup', '#F5B26B'),
    ('later', svg('M3 21V8l9-5 9 5v13M7 21v-8h10v8M7 17h10', 19, 2), 'On sale', '3 customers told', '#B3BCD2'),
], 'A buzz on this phone when Ruth decides')
sent = ('  <sc-if value="{{sent}}" hint-placeholder-val="{{ false }}">\n'
        + done_screen('send', 'With Ruth', 'Wire mesh BRC A142 · 2 checked, 2 gaps fixed',
                      '<div style="width: 100%; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-radius: 20px; background: rgba(255,255,255,.06); box-shadow: inset 0 0 0 1px rgba(255,255,255,.07)"><span style="height: 74px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px"><span class="m" style="font-size: 22px; font-weight: 600; line-height: 1; color: #6FDCB0">5/6</span><span style="font-size: 11px; font-weight: 600; color: #B3BCD2">checks kept</span></span><span style="height: 74px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; box-shadow: -1px 0 0 rgba(255,255,255,.07)"><span class="m" style="font-size: 22px; font-weight: 600; line-height: 1">40</span><span style="font-size: 11px; font-weight: 600; color: #B3BCD2">sheets waiting</span></span></div>',
                      tr, 'Funnel.dc.html', undo_click='{{undo}}')
        + '\n  </sc-if>')
script = '''class Component extends DCLogic {
  constructor(p) { super(p); this.state = { step: 0, shot: false, hold: null, sent: false }; }
  renderVals() {
    const S = this.state;
    const steps = ['Check', 'Photo', 'Hold', 'Send'].map((label, i) => ({
      label, cur: i === S.step ? 'step' : 'false',
      bar: i < S.step ? 'background:#6FDCB0' : i === S.step ? 'background:#FFFFFF' : 'background:rgba(255,255,255,.14)',
      ink: i <= S.step ? 'color:#FFFFFF' : 'color:#A9B3CC'
    }));
    const holds = [
      { k: 'Stock', sub: 'Recommended · sells in ≈16 days', cash: '4,720,000' },
      { k: 'Per order', sub: 'Kiseka takes 3 days each time', cash: '0' },
      { k: 'Consign', sub: '125,100 a sheet · needs Kiseka', cash: '0' }
    ].map(h => ({ label: h.k, sub: h.sub, cash: h.cash, on: String(S.hold === h.k), pick: () => this.setState({ hold: h.k }),
      dot: S.hold === h.k ? 'background:#16203C;box-shadow:inset 0 0 0 5px #FFFFFF,0 0 0 2px #16203C' : 'box-shadow:inset 0 0 0 2px #C9C4BA',
      style: 'all:unset;cursor:pointer;box-sizing:border-box;width:100%;display:flex;align-items:center;gap:12px;min-height:66px;padding:0 10px;border-radius:16px;' + (S.hold === h.k ? 'background:#F7F5F2' : '') }));
    const OK = { well: 'background:#E4F4EA;color:#0F6B43', mark: 'M5 12.5l4.5 4.5L19 7.5' };
    const ticks = [['Photo', 'passed the check', OK], ['Packing', 'by the sheet', OK], ['Suppliers', '2 priced', OK], ['How we hold it', S.hold || '', OK], ['Name & aisle', 'Steel & mesh', OK],
      ['Markup', 'Ruth sets it', { well: 'background:#F1EEE8;color:#5F6980', mark: 'M7 12h10' }]].map(([label, v, t]) => ({ label, v, ...t }));
    let goLabel = '', goOk = true, go = () => {};
    if (S.step === 0) { goLabel = 'Keep both'; go = () => this.setState({ step: 1 }); }
    else if (S.step === 1) { goLabel = S.shot ? 'Next: how we hold it' : 'Take the photo'; go = () => this.setState(S.shot ? { step: 2 } : { shot: true }); }
    else if (S.step === 2) { goOk = !!S.hold && S.hold !== 'Consign'; goLabel = !S.hold ? 'Pick how we hold it' : S.hold === 'Consign' ? 'Waiting on Kiseka' : 'Next: send it'; go = () => { if (goOk) this.setState({ step: 3 }); }; }
    // only kept checks count; the two filled for you are the dashed arc until kept
    const doneN = 1 + (S.step >= 1 ? 2 : 0) + (S.shot ? 1 : 0) + (S.step >= 3 ? 1 : 0);
    const toCheck = S.step === 0 ? 2 : 0;
    const c = 2 * 3.14159 * 22.5;
    return {
      steps, holds, ticks, walking: !S.sent, sent: S.sent, doneN,
      ringDash: (c * doneN / 6).toFixed(1),
      hasPart: toCheck > 0, partDash: '2.5 2 2.5 2 2.5 2 2.5 2 2.5 2 2.5 2 2.5 2 2.5 2 2.5 2 2.5 2 2.5 ' + c.toFixed(1), partRot: (-90 + doneN * 60 + 3).toFixed(1),
      ringAria: doneN + ' of 6 kept' + (toCheck ? ', ' + toCheck + ' to check' : ''),
      stepWord: S.step === 0 ? '1 of 6 kept · 2 to check' : S.step === 3 ? 'Both gaps fixed · ready for Ruth' : 'Gap ' + S.step + ' of 2 · ' + (S.step === 1 ? 'the photo' : 'how we hold it'),
      onCheck: S.step === 0, onPhoto: S.step === 1, onHold: S.step === 2, onSend: S.step === 3, dockBtn: S.step < 3,
      shot: S.shot, noShot: !S.shot, frame: S.shot ? 'background:#E9E5DE' : 'background:#FFFFFF;box-shadow:inset 0 0 0 2px #C9C4BA',
      checks: ['Sharp', 'Bright enough', '1,200 px', 'Plain background'], isConsign: S.hold === 'Consign',
      go, goLabel, goStyle: goOk ? 'background:#C93A30;color:#FFFFFF;box-shadow:0 10px 22px rgba(201,58,48,.26)' : 'background:#F3D3CF;color:#8E2A22',
      send: () => this.setState({ sent: true }), undo: () => this.setState({ sent: false })
    };
  }
}'''
html = page('Fix the gaps', walk + '\n' + sent, script)
