from ow import *

stops = '''    <div role="tablist" aria-label="Rival shops on the walk" style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px">
      <sc-for list="{{stops}}" as="s" hint-placeholder-count="2">
        <button type="button" role="tab" aria-selected="{{s.on}}" onClick="{{s.pick}}" style="{{s.style}}">
          <span style="display: block; font-size: 13px; font-weight: 700; line-height: 1.25">{{s.name}}</span>
          <span style="display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 3px; margin-top: 8px"><sc-for list="{{s.pips}}" as="p" hint-placeholder-count="5"><i style="height: 5px; border-radius: 3px; {{p}}"></i></sc-for></span>
          <span style="display: block; margin-top: 6px; font-size: 11px; font-weight: 600">{{s.left}}</span>
        </button>
      </sc-for>
    </div>'''
hd = head('Rival run · on the walk', circ('MarketRun.dc.html', 'back', 'Back to the walk'), '', stops)
row_html = '''      <div style="display: flex; flex-direction: column; gap: 8px; padding: 10px; border-top: {{r.rule}}">
        <div style="display: flex; align-items: center; gap: 12px">
          <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px">
            <span style="font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{{r.name}}</span>
            <span style="display: flex; align-items: center; gap: 6px; min-width: 0"><span style="flex: none; height: 20px; padding: 0 7px; border-radius: 999px; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; {{r.whyStyle}}">{{r.why}}</span><span style="font-size: 12px; font-weight: 600; color: #5F6980; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{{r.last}}</span></span>
          </span>
          <sc-if value="{{r.isDone}}" hint-placeholder-val="{{ false }}"><button type="button" onClick="{{r.undo}}" aria-label="{{r.undoAria}}" style="all: unset; cursor: pointer; flex: none; height: 32px; padding: 0 12px; border-radius: 999px; background: #E4F4EA; color: #0F6B43; font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 4px">''' + svg('tick', 12, 3) + '''{{r.doneWord}}<span style="color: #1C2233; font-weight: 600"> · Undo</span></button></sc-if>
        </div>
        <sc-if value="{{r.idle}}" hint-placeholder-val="{{ true }}">
          <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px">
            <sc-if value="{{r.hasLast}}" hint-placeholder-val="{{ true }}"><button type="button" onClick="{{r.same}}" style="all: unset; cursor: pointer; height: 40px; border-radius: 999px; background: #16203C; color: #FFFFFF; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center">Same price</button></sc-if>
            <sc-if value="{{r.noLast}}" hint-placeholder-val="{{ false }}"><span></span></sc-if>
            <button type="button" onClick="{{r.edit}}" style="all: unset; cursor: pointer; height: 40px; border-radius: 999px; background: #FFFFFF; box-shadow: inset 0 0 0 1.5px #E6E3DD; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center">{{r.newWord}}</button>
          </div>
        </sc-if>
        <sc-if value="{{r.editing}}" hint-placeholder-val="{{ false }}">
          <div style="display: flex; align-items: center; gap: 8px">
            <input id="{{r.inputId}}" type="text" inputmode="numeric" value="{{r.guess}}" aria-label="Their price" style="box-sizing: border-box; flex: 1; min-width: 0; height: 44px; padding: 0 12px; border-radius: 14px; border: none; box-shadow: inset 0 0 0 2px #16203C; font-family: 'IBM Plex Mono', monospace; font-size: 17px; font-weight: 600">
            <button type="button" onClick="{{r.save}}" style="all: unset; cursor: pointer; height: 44px; padding: 0 16px; border-radius: 999px; background: #16203C; color: #FFFFFF; font-size: 13px; font-weight: 700; display: flex; align-items: center">Save</button>
          </div>
        </sc-if>
      </div>'''
all_btn = '<sc-if value="{{canAll}}" hint-placeholder-val="{{ true }}"><button type="button" onClick="{{allSame}}" style="all: unset; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; color: #16203C; font-weight: 700">' + svg('M2 12.5l4.5 4.5L16 7.5M10 16l1 1 9.5-9.5', 14, 2.4) + 'All the same · <span class="m">{{allN}}</span></button></sc-if>'
toast = '''    <sc-if value="{{hasToast}}" hint-placeholder-val="{{ false }}"><div role="status" style="display: flex; align-items: center; gap: 10px; min-height: 46px; padding: 0 14px; border-radius: 16px; background: #16203C; color: #FFFFFF; font-size: 13px; font-weight: 600">''' + svg('tick', 16, 2.6, '#6FDCB0') + '''<span style="flex: 1">{{toast}}</span><button type="button" onClick="{{undoAll}}" style="all: unset; cursor: pointer; padding: 4px 8px; color: #6FDCB0; font-weight: 700">Undo</button></div></sc-if>'''
bd = body('\n'.join([
    sec('Picked by sales and money at stake', all_btn, first=True),
    '    <span style="display: flex; align-items: center; gap: 8px; padding: 0 4px; font-size: 12px; font-weight: 600; color: #5F6980">Swipe a row: right for the same price, left for a new one</span>',
    toast,
    '    <div style="' + LIST + '; padding: 0 6px">\n      <sc-for list="{{rows}}" as="r" hint-placeholder-count="5">\n' + row_html + '\n      </sc-for>\n    </div>',
    '    <span style="padding: 0 4px; font-size: 12px; font-weight: 600; color: #5F6980">Saved on this phone first, with today’s date</span>',
]))
ft = foot('<button type="button" onClick="{{next}}" style="all: unset; cursor: pointer; box-sizing: border-box; width: 100%; height: 58px; border-radius: 999px; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; {{nextStyle}}">{{nextLabel}}</button>')
script = '''class Component extends DCLogic {
  constructor(p) { super(p); this.state = { stop: 'k', res: {}, editing: null, bulk: [] }; }
  renderVals() {
    const S = this.state;
    const TOP = 'background:#E4E6FA;color:#3A3F9B', STAKE = 'background:#F6E4F1;color:#7A3268', HUNT = 'background:#FDE8E4;color:#A82D24';
    const items = {
      k: [
        { id: 'k1', name: 'Iron sheet G28, 3m', why: 'top seller', whyStyle: TOP, last: '36,000 · 8 days ago', guess: '36,000' },
        { id: 'k2', name: 'Cement 50kg', why: 'top seller', whyStyle: TOP, last: 'never checked here', guess: '' },
        { id: 'k3', name: 'Y12 rebar, 12m', why: 'top seller', whyStyle: TOP, last: '47,500 · 7 days ago', guess: '47,500' },
        { id: 'k4', name: 'Gate valve ½"', why: 'at stake', whyStyle: STAKE, last: '19,500 · 3 days ago', guess: '19,500' },
        { id: 'k5', name: 'Shower mixer, chrome', why: 'a hunt', whyStyle: HUNT, last: 'never checked here', guess: '' }
      ],
      n: [
        { id: 'n1', name: 'Y12 rebar, 12m', why: 'at stake', whyStyle: STAKE, last: '45,000 · 5 days ago', guess: '45,000' },
        { id: 'n2', name: 'Iron sheet G28, 3m', why: 'top seller', whyStyle: TOP, last: '35,500 · 11 days ago', guess: '35,500' },
        { id: 'n3', name: 'Wire mesh BRC A142', why: 'being priced', whyStyle: HUNT, last: '152,000 · 4 days ago', guess: '152,000' },
        { id: 'n4', name: 'Cement 50kg', why: 'top seller', whyStyle: TOP, last: '34,000 · 20 days ago', guess: '34,000' }
      ]
    };
    const doneIn = (k) => items[k].filter(i => S.res[i.id]).length;
    const stops = [['k', 'Kikuubo Hardware Mart'], ['n', 'Nateete Builders’ Centre']].map(([k, name]) => {
      const n = items[k].length, d = doneIn(k), on = S.stop === k;
      return {
        name, on: String(on), pick: () => this.setState({ stop: k, editing: null, bulk: [] }),
        left: d === n ? 'all checked' : (n - d) + ' to check',
        pips: Array.from({ length: 5 }, (_, i) => i >= n ? 'background:transparent' : i < d ? 'background:#0F6B43' : (on ? 'background:#E0DCD4' : 'background:rgba(255,255,255,.14)')),
        style: 'all:unset;cursor:pointer;box-sizing:border-box;padding:12px;border-radius:18px;text-align:left;' + (on ? 'background:#FFFFFF;color:#1C2233' : 'background:rgba(255,255,255,.07);color:#FFFFFF')
      };
    });
    const rows = items[S.stop].map((r, i) => {
      const res = S.res[r.id];
      return {
        ...r, inputId: 'rr_' + r.id, rule: i ? '1px solid #EFECE6' : 'none', hasLast: !!r.guess, noLast: !r.guess, undoAria: 'Undo ' + r.name,
        newWord: r.guess ? 'New price' : 'Add price',
        isDone: !!res, idle: !res && S.editing !== r.id, editing: !res && S.editing === r.id,
        doneWord: res === 'new' ? 'New price' : 'Same',
        same: () => this.setState({ res: { ...S.res, [r.id]: 'same' }, bulk: [] }),
        undo: () => { const x = { ...S.res }; delete x[r.id]; this.setState({ res: x, bulk: [] }); },
        edit: () => this.setState({ editing: r.id }),
        save: () => this.setState({ res: { ...S.res, [r.id]: 'new' }, editing: null, bulk: [] })
      };
    });
    const open = items[S.stop].filter(r => r.guess && !S.res[r.id]).map(r => r.id);
    const allDone = doneIn('k') === items.k.length && doneIn('n') === items.n.length;
    const hereDone = doneIn(S.stop) === items[S.stop].length;
    return {
      stops, rows,
      canAll: open.length > 1, allN: open.length,
      allSame: () => { const x = { ...S.res }; open.forEach(id => { x[id] = 'same'; }); this.setState({ res: x, bulk: open, editing: null }); },
      hasToast: S.bulk.length > 0, toast: S.bulk.length + ' marked the same price',
      undoAll: () => { const x = { ...S.res }; S.bulk.forEach(id => { delete x[id]; }); this.setState({ res: x, bulk: [] }); },
      next: () => this.setState({ stop: S.stop === 'k' ? 'n' : 'k', editing: null, bulk: [] }),
      nextLabel: allDone ? 'Run finished' : S.stop === 'k' ? 'Next stop: Nateete' : 'Back to Kikuubo',
      nextStyle: hereDone ? 'background:#C93A30;color:#FFFFFF;box-shadow:0 10px 22px rgba(201,58,48,.26)' : 'background:#FFFFFF;color:#16203C;box-shadow:inset 0 0 0 1.5px #E6E3DD'
    };
  }
}'''
html = page('Rival run', hd + '\n' + bd + '\n' + ft, script)
