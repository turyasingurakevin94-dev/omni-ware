from ow import *

def ptile(top, fig, word, hi=False):
    bg = 'background: #FFFFFF; color: #16203C' if hi else 'background: rgba(255,255,255,.07)'
    sub = 'color: #5F6980' if hi else 'color: #B3BCD2'
    return (f'<span style="flex: 1; min-width: 0; height: 74px; border-radius: 16px; {bg}; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px">'
            f'<span style="font-size: 11px; font-weight: 700; {sub}">{top}</span><span class="m" style="font-size: 20px; font-weight: 600; line-height: 1">{fig}</span><span style="font-size: 11px; font-weight: 600; {sub}">{word}</span></span>')
arrow = f'<span style="flex: none; color: #8D99B5; display: flex">{svg("chev", 16, 2.4)}</span>'
chain = ('    <div role="img" aria-label="{{chainAria}}" style="display: flex; align-items: center; gap: 4px">'
         + ptile('Carton', '× {{boxes}}', 'boxes') + arrow + ptile('Box', '× {{pcs}}', 'pieces') + arrow + ptile('Piece', '1', 'we sell', True) + '</div>')
pic = title_block('Self-drilling screws 10×25', 'Template · drawn for screws') + '\n' + chain
hd = head('How it is packed', circ('Passport.dc.html', 'back', 'Back to the passport'), '', pic)

sup_row = '''      <div style="display: flex; align-items: center; gap: 12px; min-height: 66px; padding: 0 10px; border-top: {{r.rule}}">
        <span style="width: 42px; height: 42px; flex: none; border-radius: 999px; background: #E4E6FA; color: #3A3F9B; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center">{{r.ini}}</span>
        <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 14px; font-weight: 700">{{r.name}}</span><span style="font-size: 12px; font-weight: 600; color: #5F6980">sells {{r.pack}}</span></span>
        <span style="flex: none; height: 26px; padding: 0 10px; border-radius: 999px; font-size: 12px; font-weight: 700; display: flex; align-items: center; {{r.chip}}">{{r.says}}</span>
      </div>'''
bd = body('\n'.join([
    sec('Pieces in a box', first=True),
    '    <div style="' + LIST + '; padding: 12px 14px">' + stepper('pk_pcs', '{{pcs}}', 'pcs', '{{lessPcs}}', '{{morePcs}}', 'Pieces in a box') + '</div>',
    sec('Boxes in a carton'),
    '    <div style="' + LIST + '; padding: 12px 14px">' + stepper('pk_box', '{{boxes}}', 'boxes', '{{lessBox}}', '{{moreBox}}', 'Boxes in a carton') + '</div>',
    '    <div style="display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 48px; border-radius: 16px; box-shadow: inset 0 0 0 1px #E6E3DD; font-size: 13px; font-weight: 700; color: #5F6980">1 carton = <span class="m" style="font-size: 17px; color: #1C2233">{{total}}</span> pieces</div>',
    sec('Each supplier’s own pack', 'from their price row'),
    '    <div style="' + LIST + '; padding: 0 6px">\n      <sc-for list="{{rows}}" as="r" hint-placeholder-count="2">\n' + sup_row + '\n      </sc-for>\n    </div>',
]))
ft = foot('<a href="Passport.dc.html" style="height: 58px; border-radius: 999px; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; {{okStyle}}">{{okLabel}}</a>')

script = '''class Component extends DCLogic {
  constructor(p) { super(p); this.state = { pcs: 100, boxes: 50 }; }
  renderVals() {
    const { pcs, boxes } = this.state;
    const fmt = (n) => n.toLocaleString('en-US');
    // each supplier's pack is read from its own price row (pack_qty), never from ours
    const sup = [
      { ini: 'KF', name: 'Katwe Fabricators', pack: 'a carton of 5,000', of: 5000 },
      { ini: 'NS', name: 'Namanve Sheets', pack: 'roofing screws by the 1,000', of: 1000 }
    ];
    const rows = sup.map((s, i) => {
      const whole = s.of % pcs === 0;
      return { ...s, rule: i ? '1px solid #EFECE6' : 'none', says: whole ? '= ' + fmt(s.of / pcs) + ' boxes' : 'not whole boxes',
        chip: whole ? 'background:#E4F4EA;color:#0F6B43' : 'background:#FDEEE1;color:#7A4A02', fails: !whole };
    });
    const failing = rows.filter(r => r.fails).map(r => r.name.split(' ')[0]);
    const step = (k, d, lo) => () => this.setState({ [k]: Math.max(lo, this.state[k] + d) });
    const ok = failing.length === 0;
    return {
      pcs, boxes, total: fmt(pcs * boxes), rows,
      chainAria: '1 carton holds ' + boxes + ' boxes; 1 box holds ' + pcs + ' pieces; we sell the piece',
      lessPcs: step('pcs', -50, 50), morePcs: step('pcs', 50, 50), lessBox: step('boxes', -10, 10), moreBox: step('boxes', 10, 10),
      okLabel: ok ? 'Packing is right' : failing.length > 1 ? 'Doesn’t fit ' + failing.join(' or ') : 'Doesn’t fit ' + failing[0] + '’s pack',
      okStyle: ok ? 'background:#C93A30;color:#FFFFFF;box-shadow:0 10px 22px rgba(201,58,48,.26)' : 'background:rgba(201,58,48,.45);color:#FFFFFF;pointer-events:none'
    };
  }
}'''
html = page('How it is packed', hd + '\n' + bd + '\n' + ft, script)
