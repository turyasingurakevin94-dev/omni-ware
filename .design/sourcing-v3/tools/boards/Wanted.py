from ow import *

faces_strip = '''    <div style="display: flex; align-items: center; gap: 14px">
      <span style="display: flex; align-items: baseline; gap: 8px"><span class="m" style="font-size: 40px; font-weight: 600; line-height: 1">{{left}}</span><span style="font-size: 14px; font-weight: 600; color: #B3BCD2">to sort</span></span>
      <span style="flex: 1"></span>
      <span role="img" aria-label="{{facesAria}}" style="display: flex">
        <sc-for list="{{asks}}" as="a" hint-placeholder-count="3"><span style="width: 40px; height: 40px; margin-left: -8px; border-radius: 999px; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; {{a.faceStyle}}">{{a.ini}}</span></sc-for>
      </span>
    </div>'''
hd = head('New asks', circ('Main.dc.html', 'back', 'Back to Today'), '', faces_strip)

row_html = '''      <div style="display: flex; flex-direction: column; gap: 10px; padding: 12px 10px; border-radius: 16px; border-top: {{a.rule}}">
        <div style="display: flex; align-items: center; gap: 12px">
          <span style="width: 42px; height: 42px; flex: none; border-radius: 999px; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; {{a.lead}}">{{a.ini}}</span>
          <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px">
            <span style="font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{{a.what}} <span class="m" style="color: #5F6980">{{a.qty}}</span></span>
            <span style="font-size: 12px; font-weight: 600; color: #5F6980; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{{a.from}}</span>
          </span>
          <span class="m" style="flex: none; font-size: 11px; font-weight: 600; color: #9AA1AE">{{a.when}}</span>
        </div>
        <sc-if value="{{a.hasHint}}" hint-placeholder-val="{{ false }}">
          <span style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 12px; background: #E4E6FA; color: #3A3F9B; font-size: 12px; font-weight: 700">''' + svg('item', 15, 2) + '''{{a.hint}}</span>
        </sc-if>
        <sc-if value="{{a.open}}" hint-placeholder-val="{{ true }}">
          <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px">
            <button type="button" onClick="{{a.aside}}" style="all: unset; cursor: pointer; height: 42px; border-radius: 999px; background: #FFFFFF; box-shadow: inset 0 0 0 1.5px #E6E3DD; font-size: 13px; font-weight: 700; color: #5F6980; display: flex; align-items: center; justify-content: center">{{a.asideLabel}}</button>
            <button type="button" onClick="{{a.go}}" style="all: unset; cursor: pointer; height: 42px; border-radius: 999px; background: #FFFFFF; box-shadow: inset 0 0 0 1.5px #E6E3DD; font-size: 13px; font-weight: 700; color: #16203C; display: flex; align-items: center; justify-content: center; gap: 6px">{{a.goLabel}}''' + svg('chev', 14, 2.4) + '''</button>
          </div>
        </sc-if>
        <sc-if value="{{a.done}}" hint-placeholder-val="{{ false }}">
          <div style="display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 12px; border-radius: 12px; {{a.doneStyle}}">
            <span style="flex: 1; font-size: 13px; font-weight: 700">{{a.result}}</span>
            <button type="button" onClick="{{a.undo}}" style="all: unset; cursor: pointer; font-size: 13px; font-weight: 700; color: #16203C">Undo</button>
          </div>
        </sc-if>
      </div>'''
bd = body('\n'.join([
    sec('From people and searches', 'newest first', first=True),
    '    <div style="' + LIST + '; padding: 0 6px; display: flex; flex-direction: column">\n      <sc-for list="{{asks}}" as="a" hint-placeholder-count="3">\n' + row_html + '\n      </sc-for>\n    </div>',
    '    <a href="Funnel.dc.html" style="display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 0 14px; border-radius: 20px; box-shadow: inset 0 0 0 1px #E6E3DD"><span class="m" style="font-size: 18px; font-weight: 600">9</span><span style="flex: 1; font-size: 13px; font-weight: 700">already in Wanted</span>' + chev() + '</a>',
]))
ft = foot('<a href="Funnel.dc.html" style="height: 58px; border-radius: 999px; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; {{doneStyle}}">{{doneLabel}}</a>')

script = '''class Component extends DCLogic {
  constructor(p) { super(p); this.state = { res: {} }; }
  renderVals() {
    const res = this.state.res;
    const set = (id, v) => () => this.setState({ res: { ...res, [id]: v } });
    const base = [
      { id: 'a', ini: 'GA', tint: ['#DCEAF8', '#1A5A8A'], from: 'Grace Akello · for Kato Construction', when: '10:42',
        what: 'Door closer, medium', qty: '× 6', asideLabel: 'Set aside', goLabel: 'Hunt it',
        out: { hunt: 'Hunting · in the Funnel', aside: 'Set aside · Grace is told' } },
      { id: 'b', ini: 'PS', tint: ['#FDE8E4', '#A82D24'], from: 'Peter Sserwadda · agent', when: '09:15',
        what: 'Shower mixer, chrome', qty: '× 4', asideLabel: 'Set aside', goLabel: 'Hunt it',
        out: { hunt: 'Hunting · Peter is told', aside: 'Set aside · Peter is told' } },
      { id: 'c', ini: '5×', tint: ['#F1EEE8', '#5F6980'], from: '5 searches · 3 named people · this week', when: 'week',
        what: '“pvc glue”', qty: '', hint: 'We sell Solvent cement 500ml · teach it this name?', asideLabel: 'Set the words aside', goLabel: 'Teach the name',
        out: { hunt: 'Taught · “pvc glue” finds Solvent cement 500ml', aside: 'Set aside · these words stop showing' } }
    ];
    const asks = base.map((a, i) => {
      const r = res[a.id];
      return {
        ...a, hasHint: !!a.hint, open: !r, done: !!r, rule: i ? '1px solid #EFECE6' : 'none',
        lead: 'background:' + a.tint[0] + ';color:' + a.tint[1],
        faceStyle: 'background:' + a.tint[0] + ';color:' + a.tint[1] + ';box-shadow:0 0 0 2px #1D2747' + (r ? ',0 0 0 4px #6FDCB0' : ',0 0 0 4px rgba(245,178,107,.6)'),
        result: r ? a.out[r] : '',
        doneStyle: r === 'hunt' ? 'background:#E4F4EA;color:#0F6B43' : 'background:#F1EEE8;color:#5F6980',
        go: set(a.id, 'hunt'), aside: set(a.id, 'aside'), undo: set(a.id, undefined)
      };
    });
    const left = asks.filter(a => a.open).length;
    return {
      asks, left,
      facesAria: 'Grace Akello, Peter Sserwadda and a search; ' + left + ' to sort',
      doneLabel: left ? left + ' still to sort' : 'Done · to the Funnel',
      doneStyle: left ? 'background:#FFFFFF;color:#5F6980;box-shadow:inset 0 0 0 1.5px #E6E3DD' : 'background:#C93A30;color:#FFFFFF;box-shadow:0 10px 22px rgba(201,58,48,.26)'
    };
  }
}'''
html = page('New asks', hd + '\n' + bd + '\n' + ft, script)
