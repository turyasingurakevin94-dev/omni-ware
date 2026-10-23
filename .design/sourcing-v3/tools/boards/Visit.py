from ow import *

pips = '''    <div style="display: flex; align-items: center; gap: 12px">
      <div role="img" aria-label="{{done}} of 7 jobs done" style="flex: 1; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px"><sc-for list="{{pips}}" as="p" hint-placeholder-count="7"><i style="height: 8px; border-radius: 999px; {{p}}"></i></sc-for></div>
      <span class="m" style="font-size: 14px; font-weight: 600">{{done}}/7</span>
    </div>'''
pic = title_block('Owino Plumbing', '<span class="m" style="color: #FFFFFF">14</span> days credit · delivers Tue, Fri', face('OP', 'indigo', 52)) + '\n' + pips
right = '<a href="Supplier.dc.html" style="flex: none; height: 34px; padding: 0 12px; border-radius: 999px; background: rgba(255,255,255,.1); font-size: 12px; font-weight: 700; display: flex; align-items: center">Scorecard</a>'
hd = head('Visit · stop 1 of 4', circ('MarketRun.dc.html', 'back', 'Back to the walk'), right, pic)

price_row = '''      <div style="display: flex; flex-direction: column; gap: 8px; padding: 10px 10px; border-top: {{r.rule}}">
        <div style="display: flex; align-items: center; gap: 12px">
          <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px">
            <span class="nm" style="font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{{r.name}}</span>
            <span style="display: flex; align-items: center; gap: 8px"><span class="m" style="font-size: 14px; font-weight: 600">{{r.price}}</span><span style="width: 44px; height: 5px; border-radius: 3px; background: #EFECE6; display: block"><span style="display: block; height: 5px; border-radius: 3px; {{r.age}}"></span></span><span style="font-size: 12px; font-weight: 600; color: #5F6980; white-space: nowrap"><span class="m">{{r.d}}</span> d</span><sc-if value="{{r.share}}" hint-placeholder-val="{{ false }}"><span style="height: 20px; padding: 0 7px; border-radius: 999px; background: #E4F4EA; color: #0F6B43; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center">today’s share</span></sc-if></span>
          </span>
          <sc-if value="{{r.isDone}}" hint-placeholder-val="{{ false }}"><button type="button" onClick="{{r.undo}}" aria-label="{{r.undoAria}}" style="all: unset; cursor: pointer; flex: none; height: 32px; padding: 0 12px; border-radius: 999px; background: #E4F4EA; color: #0F6B43; font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 4px">''' + svg('tick', 12, 3) + '''{{r.doneWord}}<span style="color: #1C2233; font-weight: 600"> · Undo</span></button></sc-if>
        </div>
        <sc-if value="{{r.idle}}" hint-placeholder-val="{{ true }}">
          <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px">
            <button type="button" onClick="{{r.same}}" style="all: unset; cursor: pointer; height: 40px; border-radius: 999px; background: #16203C; color: #FFFFFF; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center">Same price</button>
            <button type="button" onClick="{{r.edit}}" style="all: unset; cursor: pointer; height: 40px; border-radius: 999px; background: #FFFFFF; box-shadow: inset 0 0 0 1.5px #E6E3DD; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center">New price</button>
          </div>
        </sc-if>
        <sc-if value="{{r.editing}}" hint-placeholder-val="{{ false }}">
          <div style="display: flex; align-items: center; gap: 8px">
            <input id="{{r.inputId}}" type="text" inputmode="numeric" value="{{r.guess}}" aria-label="New price" style="box-sizing: border-box; flex: 1; min-width: 0; height: 44px; padding: 0 12px; border-radius: 14px; border: none; box-shadow: inset 0 0 0 2px #16203C; font-family: 'IBM Plex Mono', monospace; font-size: 17px; font-weight: 600">
            <button type="button" onClick="{{r.save}}" style="all: unset; cursor: pointer; height: 44px; padding: 0 16px; border-radius: 999px; background: #16203C; color: #FFFFFF; font-size: 13px; font-weight: 700; display: flex; align-items: center">Save</button>
          </div>
        </sc-if>
      </div>'''
all_btn = '<sc-if value="{{canAll}}" hint-placeholder-val="{{ true }}"><button type="button" onClick="{{allSame}}" style="all: unset; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; color: #16203C; font-weight: 700">' + svg('M2 12.5l4.5 4.5L16 7.5M10 16l1 1 9.5-9.5', 14, 2.4) + 'All the same · <span class="m">{{allN}}</span></button></sc-if>'
toast = '''    <sc-if value="{{hasToast}}" hint-placeholder-val="{{ false }}"><div role="status" style="display: flex; align-items: center; gap: 10px; min-height: 46px; padding: 0 14px; border-radius: 16px; background: #16203C; color: #FFFFFF; font-size: 13px; font-weight: 600">''' + svg('tick', 16, 2.6, '#6FDCB0') + '''<span style="flex: 1">{{toast}}</span><button type="button" onClick="{{undoAll}}" style="all: unset; cursor: pointer; padding: 4px 8px; color: #6FDCB0; font-weight: 700">Undo</button></div></sc-if>'''
swipe = '    <span style="display: flex; align-items: center; gap: 8px; padding: 0 4px; font-size: 12px; font-weight: 600; color: #5F6980">' + svg('M5 7h24M9 3 5 7l4 4M25 3l4 4-4 4', 24, 1.8).replace('viewBox="0 0 24 24"', 'viewBox="0 0 34 14"') + 'Swipe a row: right for the same price, left for a new one</span>'
want = '''    <div style="''' + LIST + '''; padding: 6px">
      <div style="display: flex; align-items: center; gap: 12px; min-height: 66px; padding: 0 10px">
        <button type="button" role="checkbox" aria-checked="{{wantedOn}}" aria-label="Mark asked" onClick="{{toggleWanted}}" style="all: unset; cursor: pointer; width: 30px; height: 30px; flex: none; border-radius: 999px; display: flex; align-items: center; justify-content: center; {{wantedBox}}">''' + svg('tick', 14, 3) + '''</button>
        <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 14px; font-weight: 700">PPR pipe 25mm × 4m</span><span style="font-size: 12px; font-weight: 600; color: #5F6980">Ggaba Stores · Nansana Hardware wait</span></span>
        <a href="SupplierPrice.dc.html" style="flex: none; height: 32px; padding: 0 12px; border-radius: 999px; background: #16203C; color: #FFFFFF; font-size: 12px; font-weight: 700; display: flex; align-items: center">Their price</a>
      </div>
    </div>'''
prop = '''    <div style="''' + LIST + '''; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px">
      <div style="display: flex; align-items: center; gap: 10px"><span style="flex: 1; font-size: 14px; font-weight: 700">PVC pipe 4" × 6m</span><span class="m" style="font-size: 13px; color: #5F6980; text-decoration: line-through">42,000</span>''' + svg('M5 12h14M13 6l6 6-6 6', 14, 2, '#5F6980') + '''<span class="m" style="font-size: 15px; font-weight: 600">44,000</span><span class="m" style="height: 22px; padding: 0 7px; border-radius: 999px; background: #FDEEE1; color: #7A4A02; font-size: 11px; font-weight: 600; display: flex; align-items: center">+4.8%</span></div>
      <sc-if value="{{propOpen}}" hint-placeholder-val="{{ true }}"><div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px">
        <a href="PushBack.dc.html" style="height: 40px; border-radius: 999px; background: #FFFFFF; box-shadow: inset 0 0 0 1.5px #E6E3DD; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center">Push back</a>
        <button type="button" onClick="{{accept}}" style="all: unset; cursor: pointer; height: 40px; border-radius: 999px; background: #16203C; color: #FFFFFF; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center">Accept</button>
      </div></sc-if>
      <sc-if value="{{propDone}}" hint-placeholder-val="{{ false }}"><span style="display: flex; align-items: center; gap: 6px; min-height: 40px; padding: 0 12px; border-radius: 12px; background: #E4F4EA; color: #0F6B43; font-size: 12px; font-weight: 700">''' + svg('tick', 13, 3) + '''On the price list · Ruth is told about any order it touches</span></sc-if>
    </div>'''
photos = '''    <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px">
      <sc-for list="{{photos}}" as="ph" hint-placeholder-count="2">
        <div style="position: relative; height: 84px; border-radius: 18px; box-shadow: inset 0 0 0 1.5px #C9C4BA">
          <a href="PhotoGate.dc.html" style="position: absolute; inset: 0; padding: 12px; display: flex; flex-direction: column; justify-content: space-between">''' + svg('camera', 20, 2) + '''<span style="font-size: 13px; font-weight: 700">{{ph.name}}</span></a>
          <button type="button" role="checkbox" aria-checked="{{ph.on}}" aria-label="Mark taken" onClick="{{ph.toggle}}" style="all: unset; cursor: pointer; position: absolute; top: 10px; right: 10px; width: 28px; height: 28px; border-radius: 999px; display: flex; align-items: center; justify-content: center; {{ph.box}}">''' + svg('tick', 13, 3) + '''</button>
        </div>
      </sc-for>
    </div>'''
coach = lst('\n'.join(row(t, s, f'<span class="m" style="min-width: 42px; height: 42px; flex: none; padding: 0 6px; box-sizing: border-box; border-radius: 13px; background: #F6E4F1; color: #7A3268; font-size: 12px; font-weight: 600; display: flex; align-items: center; justify-content: center">{k}</span>', '')
                    for k, t, s in [('300', 'Ask their price for 50 PPR elbows', 'We sell about 300 a month'), ('19,500', 'Ask 17,500 for 20 gate valves', 'Kikuubo sells them at 19,500'), ('22', 'Ask for 30 days’ credit', '22 orders with them in six months')]))
bd = body('\n'.join([
    sec('Still the same price?' + '<span role="img" aria-label="Rows swipe: right for the same price, left for a new one" style="display: inline-flex; vertical-align: -3px; margin-left: 6px; color: #5F6980">' + svg('M5 7h24M9 3 5 7l4 4M25 3l4 4-4 4', 24, 1.8).replace('viewBox="0 0 24 24"', 'viewBox="0 0 34 14"').replace('width="24" height="24"', 'width="30" height="14"') + '</span>', all_btn, first=True), toast,
    '    <div style="' + LIST + '; padding: 0 6px">\n      <sc-for list="{{rows}}" as="r" hint-placeholder-count="3">\n' + price_row + '\n      </sc-for>\n    </div>',
    sec('Ask them for'), want, sec('They proposed', 'in the supplier app'), prop, sec('Photograph while here'), photos, sec('Coach · talking points'), coach,
]))
ft = foot('<a href="MarketRun.dc.html" style="height: 58px; border-radius: 999px; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; {{endStyle}}">{{endLabel}}</a>')
script = '''class Component extends DCLogic {
  constructor(p) { super(p); this.state = { price: {}, editing: null, wanted: false, prop: false, photo: {}, bulk: [] }; }
  renderVals() {
    const S = this.state;
    const base = [
      { id: 'a', name: 'PPR elbow 25mm', price: '1,200', guess: '1,200', d: 21, share: false },
      { id: 'b', name: 'Gate valve ½"', price: '18,500', guess: '18,500', d: 34, share: true },
      { id: 'c', name: 'Ball valve ¾"', price: '14,000', guess: '14,000', d: 40, share: true }
    ];
    const rows = base.map((r, i) => {
      const res = S.price[r.id];
      return {
        ...r, inputId: 'np_' + r.id, rule: i ? '1px solid #EFECE6' : 'none', undoAria: 'Undo ' + r.name,
        age: 'width:' + Math.min(100, Math.round(r.d / 45 * 100)) + '%;background:' + (r.d >= 30 ? '#95530C' : '#6B7480'),
        isDone: !!res, idle: !res && S.editing !== r.id, editing: !res && S.editing === r.id,
        doneWord: res === 'new' ? 'New price' : 'Same',
        same: () => this.setState({ price: { ...S.price, [r.id]: 'same' }, bulk: [] }),
        undo: () => { const p = { ...S.price }; delete p[r.id]; this.setState({ price: p, bulk: [] }); },
        edit: () => this.setState({ editing: r.id }),
        save: () => this.setState({ price: { ...S.price, [r.id]: 'new' }, editing: null, bulk: [] })
      };
    });
    const open = base.filter(r => !S.price[r.id]).map(r => r.id);
    const box = (on) => on ? 'background:#0F6B43;color:#FFFFFF' : 'background:#FFFFFF;color:transparent;box-shadow:inset 0 0 0 1.5px #C9C4BA';
    const photos = [{ id: 'p1', name: 'Gate valve ½"' }, { id: 'p2', name: 'Pillar tap ½"' }].map(p => ({
      ...p, on: String(!!S.photo[p.id]), box: box(!!S.photo[p.id]), toggle: () => this.setState({ photo: { ...S.photo, [p.id]: !S.photo[p.id] } })
    }));
    const done = Object.keys(S.price).length + (S.wanted ? 1 : 0) + (S.prop ? 1 : 0) + Object.values(S.photo).filter(Boolean).length;
    const left = 7 - done;
    return {
      rows, photos, done,
      pips: Array.from({ length: 7 }, (_, i) => i < done ? 'background:#6FDCB0' : 'background:rgba(255,255,255,.14)'),
      canAll: open.length > 1, allN: open.length,
      allSame: () => { const p = { ...S.price }; open.forEach(id => { p[id] = 'same'; }); this.setState({ price: p, bulk: open, editing: null }); },
      hasToast: S.bulk.length > 0, toast: S.bulk.length + ' marked the same price',
      undoAll: () => { const p = { ...S.price }; S.bulk.forEach(id => { delete p[id]; }); this.setState({ price: p, bulk: [] }); },
      wantedOn: String(S.wanted), wantedBox: box(S.wanted), toggleWanted: () => this.setState({ wanted: !S.wanted }),
      propOpen: !S.prop, propDone: S.prop, accept: () => this.setState({ prop: true }),
      endLabel: left > 0 ? 'Done here · ' + left + ' left' : 'Next stop: Kikuubo Hardware Mart',
      endStyle: left > 0 ? 'background:#FFFFFF;color:#16203C;box-shadow:inset 0 0 0 1.5px #E6E3DD' : 'background:#C93A30;color:#FFFFFF;box-shadow:0 10px 22px rgba(201,58,48,.26)'
    };
  }
}'''
html = page('Visit · Owino Plumbing', hd + '\n' + bd + '\n' + ft, script)
