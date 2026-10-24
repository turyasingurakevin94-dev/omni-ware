"""The two price records every price screen shares (guide, Sourcing section):
packing is one sentence, `<n> <unit> in a <outer>` or "sold singly"; prices are tiers, one sentence each,
`<n> <pack>+ cost <price>/<pack>`. Below a full outer is retail (amber dot), a full outer and up is wholesale
(indigo dot). Each tier is entered once; a tier dearer a piece than the one before is flagged, not dropped.
And the stamp strip: which passport a price feeds, and what it does to that stamp."""
from ow import svg, LIST

SLOT = ('all: unset; cursor: pointer; box-sizing: border-box; height: 40px; padding: 0 10px; border-radius: 10px; '
        'font-size: 15px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px')

PACK_HTML = '''    <div style="''' + LIST + '''; padding: 14px; display: flex; flex-direction: column; gap: 10px">
      <div aria-label="{{packAria}}" style="display: flex; flex-wrap: wrap; align-items: center; gap: 6px; {{packDim}}">
        <input inputmode="numeric" aria-label="How many in one outer" placeholder="n" value="{{pn}}" onInput="{{typePn}}" class="m" style="box-sizing: border-box; width: 58px; height: 40px; padding: 0 8px; border: none; border-radius: 10px; text-align: center; font-size: 17px; font-weight: 600; color: #1C2233; outline: none; {{pnStyle}}">
        <button type="button" onClick="{{cycleUnit}}" aria-label="The unit, tap to change" style="''' + SLOT + '''; {{puStyle}}">{{puWord}}''' + svg('M8 9l4-4 4 4M8 15l4 4 4-4', 12, 2.4) + '''</button>
        <span style="font-size: 15px; font-weight: 600; color: #5F6980">in a</span>
        <button type="button" onClick="{{cycleOuter}}" aria-label="The outer pack, tap to change" style="''' + SLOT + '''; {{poStyle}}">{{poWord}}''' + svg('M8 9l4-4 4 4M8 15l4 4 4-4', 12, 2.4) + '''</button>
      </div>
      <div style="display: flex; align-items: center; gap: 10px; border-top: 1px solid #EFECE6; padding-top: 10px">
        <button type="button" role="switch" aria-checked="{{singleStr}}" onClick="{{toggleSingle}}" style="all: unset; cursor: pointer; position: relative; width: 46px; height: 28px; flex: none; border-radius: 999px; {{singleTrack}}"><span style="position: absolute; top: 3px; width: 22px; height: 22px; border-radius: 999px; background: #FFFFFF; box-shadow: 0 1px 3px rgba(0,0,0,.25); {{singleKnob}}"></span></button>
        <span style="flex: 1; font-size: 13px; font-weight: 600; color: #5F6980">Sold singly, no outer pack</span>
      </div>
    </div>'''

TIERS_HTML = '''    <sc-if value="{{packNotSet}}" hint-placeholder-val="{{ false }}">
    <div style="''' + LIST + '''; padding: 16px; display: flex; align-items: center; gap: 12px; color: #5F6980">''' + svg('M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8', 22, 1.8) + '''<span style="font-size: 13px; font-weight: 600">Set how they pack it first. Each price follows the packing.</span></div>
    </sc-if>
    <sc-if value="{{packSet}}" hint-placeholder-val="{{ true }}">
    <div style="''' + LIST + '''; padding: 6px; display: flex; flex-direction: column">
      <sc-for list="{{tiers}}" as="t" hint-placeholder-count="2">
        <div style="display: flex; flex-direction: column; gap: 2px; padding: 8px 8px; border-radius: 14px; {{t.rowBg}}">
          <div style="display: flex; align-items: center; gap: 5px; font-size: 14px; font-weight: 600">
            <span aria-hidden="true" style="width: 8px; height: 8px; flex: none; border-radius: 999px; {{t.dot}}"></span>
            <input inputmode="numeric" aria-label="{{t.nAria}}" value="{{t.n}}" onInput="{{t.typeN}}" class="m" style="box-sizing: border-box; width: 40px; height: 36px; padding: 0 4px; border: none; border-radius: 9px; background: #F4F2EE; text-align: center; font-size: 15px; font-weight: 600; color: #1C2233; outline: none">
            <button type="button" onClick="{{t.flip}}" aria-label="{{t.flipAria}}" style="all: unset; cursor: pointer; height: 36px; padding: 0 2px; font-weight: 700; display: flex; align-items: center; {{t.wordInk}}">{{t.word}}+</button>
            <span style="color: #5F6980">{{verb}}</span>
            <button type="button" onClick="{{t.pick}}" aria-label="{{t.priceAria}}" class="m" style="all: unset; cursor: pointer; box-sizing: border-box; min-width: 92px; height: 36px; padding: 0 8px; border-radius: 9px; font-size: 15px; font-weight: 600; display: flex; align-items: center; justify-content: flex-end; {{t.priceStyle}}">{{t.price}}</button>
            <span style="color: #5F6980; white-space: nowrap">/{{t.per}}</span>
            <sc-if value="{{t.canRemove}}" hint-placeholder-val="{{ false }}"><button type="button" onClick="{{t.remove}}" aria-label="Remove this tier" style="all: unset; cursor: pointer; margin-left: auto; width: 28px; height: 28px; flex: none; border-radius: 999px; color: #5F6980; display: flex; align-items: center; justify-content: center">''' + svg('M6 6l12 12M18 6 6 18', 14, 2.4) + '''</button></sc-if>
          </div>
          <sc-if value="{{t.hasNote}}" hint-placeholder-val="{{ false }}"><span style="padding-left: 13px; font-size: 12px; font-weight: 600; {{t.noteInk}}">{{t.note}}</span></sc-if>
        </div>
      </sc-for>
      <button type="button" onClick="{{addTier}}" style="all: unset; cursor: pointer; display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 10px; color: #3A3F9B; font-size: 13px; font-weight: 700">''' + svg('M12 5v14M5 12h14', 16, 2.2) + '''{{addLabel}}</button>
    </div>
    <div aria-hidden="true" style="display: flex; gap: 14px; padding: 0 6px; font-size: 11px; font-weight: 700; color: #5F6980"><span style="display: flex; align-items: center; gap: 5px"><i style="width: 8px; height: 8px; border-radius: 999px; background: #C47A1E"></i>retail · under a full {{poShort}}</span><span style="display: flex; align-items: center; gap: 5px"><i style="width: 8px; height: 8px; border-radius: 999px; background: #3A3F9B"></i>wholesale · a full {{poShort}} and up</span></div>
    </sc-if>'''

TKEYPAD = '''<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; {{keysDim}}">
      <sc-for list="{{tkeys}}" as="k" hint-placeholder-count="12">
        <button type="button" aria-label="{{k.aria}}" onClick="{{k.press}}" style="all: unset; cursor: pointer; height: 46px; border-radius: 14px; background: #FFFFFF; box-shadow: inset 0 0 0 1px #E6E3DD; font-family: 'IBM Plex Mono', monospace; font-size: 20px; font-weight: 600; display: flex; align-items: center; justify-content: center">
          <sc-if value="{{k.isText}}" hint-placeholder-val="{{ true }}">{{k.label}}</sc-if>
          <sc-if value="{{k.isBack}}" hint-placeholder-val="{{ false }}">''' + svg('M9 5h11v14H9l-6-7zM13 10l4 4M17 10l-4 4', 22, 1.8) + '''</sc-if>
        </button>
      </sc-for>
    </div>'''

# the stamp a price feeds: a small rubber stamp, dashed until the price is in, then inked
FEED_HTML = '''    <a href="{{feedHref}}" style="display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 18px; background: #FBF8F1; box-shadow: inset 0 0 0 1px #E6DECB">
      <span aria-hidden="true" style="position: relative; width: 52px; height: 52px; flex: none; border-radius: 999px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; transform: rotate(-8deg); font-family: Oswald, Figtree, sans-serif; font-size: 8px; font-weight: 700; letter-spacing: .02em; {{feedRing}}">{{feedStamp}}</span>
      <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{{feedTitle}}</span><span style="font-size: 12px; font-weight: 600; {{feedInk}}">{{feedNote}}</span></span>
      ''' + svg('m9 6 6 6-6 6', 14, 2.6, '#6B7480') + '''
    </a>'''

# the JS behind PACK_HTML, TIERS_HTML and TKEYPAD; call this.tierVals(S, opts) inside renderVals
TIERS_METHOD = r'''
  tierVals(S, o) {
    const UNITS = ['pieces', 'lengths', 'sheets', 'rolls', 'dozens', 'pairs', 'sets'], OUTERS = ['ctn', 'bundle', 'box', 'bag'];
    const ONE = { pieces: 'piece', lengths: 'length', sheets: 'sheet', rolls: 'roll', dozens: 'dozen', pairs: 'pair', sets: 'set' };
    const MANY = { ctn: 'ctns', bundle: 'bundles', box: 'boxes', bag: 'bags' };
    const fmt = (x) => Number(x).toLocaleString('en-US');
    const pn = Number(S.pn || 0), set = S.single ? !!S.pu : !!(pn > 1 && S.pu && S.po);
    const word = (on, n) => on === 'u' ? (n === 1 ? ONE[S.pu] || 'unit' : S.pu || 'units') : (n === 1 ? S.po || 'outer' : MANY[S.po] || 'outers');
    const per = (on) => on === 'u' ? ONE[S.pu] || 'unit' : S.po || 'outer';
    const pieces = (t) => (Number(t.n) || 0) * (t.on === 'o' ? pn : 1);
    const seen = {}; let prevEach = null, prevLabel = '';
    const rows = S.tiers.map((t, i) => ({ t, i })).sort((a, b) => pieces(a.t) - pieces(b.t) || a.i - b.i);
    const out = rows.map(({ t, i }) => {
      const n = Number(t.n) || 0, v = Number(t.v || 0), key = t.on + n, dup = !!seen[key];
      const full = t.on === 'u' && !S.single && pn && n >= pn;
      seen[key] = 1;
      const each = v ? v / (t.on === 'o' ? pn : 1) : null;
      let note = '', noteInk = 'color:#5F6980', left = dup || full || !n;
      if (dup) note = 'Already there · left out';
      else if (full) note = n + ' ' + word('u', n) + ' is a full ' + S.po + ': that is wholesale · left out';
      else if (each && prevEach && each > prevEach) { note = 'Dearer a ' + per('u') + ' than ' + prevLabel + ' · kept, check it'; noteInk = 'color:#95530C'; }
      else if (each && t.on === 'o') note = '= ' + fmt(Math.round(each)) + ' a ' + per('u');
      if (each && !left) { prevEach = each; prevLabel = n + ' ' + word(t.on, n) + '+'; }
      const sel = S.sel === i, retail = t.on === 'u';
      const upd = (patch) => this.setState({ tiers: S.tiers.map((x, j) => j === i ? { ...x, ...patch } : x), sel: i });
      return { n: t.n, word: word(t.on, n), per: per(t.on), price: v ? fmt(v) : sel ? 'type it' : 'price', left, sentence: n + ' ' + word(t.on, n) + '+ ' + o.verb + ' ' + fmt(v) + '/' + per(t.on), v,
        dot: 'background:' + (retail ? '#C47A1E' : '#3A3F9B'), wordInk: retail ? 'color:#95530C' : 'color:#3A3F9B',
        priceStyle: sel ? 'background:#16203C;color:#FFFFFF' : v ? 'background:#F4F2EE;color:#1C2233' : 'background:#FFFFFF;color:#5F6980;box-shadow:inset 0 0 0 1.5px #C9C4BA',
        rowBg: left ? 'opacity:.6' : sel ? 'background:#F7F5F2' : '', hasNote: !!note, note, noteInk,
        nAria: 'How many for this tier', flipAria: 'Switch between ' + word('u', 2) + ' and ' + word('o', 2), priceAria: 'Type the price for ' + n + ' ' + word(t.on, n) + ' and up',
        typeN: (e) => upd({ n: e.target.value.replace(/[^0-9]/g, '').slice(0, 4) }),
        flip: () => { if (!S.single) upd({ on: t.on === 'u' ? 'o' : 'u' }); }, pick: () => this.setState({ sel: i }),
        canRemove: S.tiers.length > 1, remove: () => this.setState({ tiers: S.tiers.filter((x, j) => j !== i), sel: 0 }) };
    });
    const good = out.filter(t => !t.left && t.v);
    const cur = S.tiers[S.sel] || S.tiers[0] || { v: '' };
    const tkeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'back'].map(label => ({ label, isText: label !== 'back', isBack: label === 'back', aria: label === 'back' ? 'Delete a digit' : label,
      press: () => { if (!set) return; const v = String(cur.v || ''); const nv = label === 'back' ? v.slice(0, -1) : (v + label).replace(/^0+/, '').slice(0, 9); this.setState({ tiers: S.tiers.map((x, j) => j === S.sel ? { ...x, v: nv } : x) }); } }));
    const nextN = S.single ? 10 : 5;
    return {
      pn: S.pn, puWord: S.pu || 'unit', poWord: S.single ? '—' : S.po || 'outer', poShort: S.po || 'outer',
      pnStyle: S.pn ? 'background:#F4F2EE' : 'background:#FFFFFF;box-shadow:inset 0 0 0 1.5px #C9C4BA',
      puStyle: S.pu ? 'background:#F4F2EE;color:#1C2233' : 'background:#FFFFFF;color:#5F6980;box-shadow:inset 0 0 0 1.5px #C9C4BA',
      poStyle: S.po && !S.single ? 'background:#F4F2EE;color:#1C2233' : 'background:#FFFFFF;color:#5F6980;box-shadow:inset 0 0 0 1.5px #C9C4BA',
      packDim: S.single ? 'opacity:.45' : '', packAria: 'Packing: ' + (S.single ? 'sold singly' : (S.pn || 'n') + ' ' + (S.pu || 'units') + ' in a ' + (S.po || 'outer')),
      typePn: (e) => this.setState({ pn: e.target.value.replace(/[^0-9]/g, '').slice(0, 4) }),
      cycleUnit: () => this.setState({ pu: UNITS[(UNITS.indexOf(S.pu) + 1) % UNITS.length] }),
      cycleOuter: () => { if (!S.single) this.setState({ po: OUTERS[(OUTERS.indexOf(S.po) + 1) % OUTERS.length] }); },
      singleStr: String(!!S.single), toggleSingle: () => this.setState({ single: !S.single, tiers: !S.single ? S.tiers.map(x => ({ ...x, on: 'u' })) : S.tiers }),
      singleTrack: S.single ? 'background:#0F6B43' : 'background:#D9D5CE', singleKnob: S.single ? 'left:21px' : 'left:3px',
      packSet: set, packNotSet: !set, verb: o.verb, tiers: out, tkeys, keysDim: set ? '' : 'opacity:.4',
      addLabel: 'Add a tier · ' + nextN + ' ' + word(S.single ? 'u' : 'o', nextN) + '+',
      addTier: () => this.setState({ tiers: S.tiers.concat({ n: String(nextN), on: S.single ? 'u' : 'o', v: '' }), sel: S.tiers.length }),
      packSentence: S.single ? 'Sold singly' : pn + ' ' + S.pu + ' in a ' + S.po,
      tierSentences: good.map(t => t.sentence), tierCount: good.length, curV: Number(cur.v || 0), curPer: per(cur.on || 'u')
    };
  }
'''
