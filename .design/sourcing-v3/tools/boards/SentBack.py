from ow import *

lead = face('RN', 'manager', 56, '0 0 0 3px #1D2747, 0 0 0 5px rgba(245,178,107,.6)')
strip = '''    <div role="img" aria-label="4 of 6 checks done; the photo is open again" style="display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 6px">''' + ''.join(
    f'<span style="display: flex; flex-direction: column; align-items: center; gap: 6px"><span style="width: 100%; height: 8px; border-radius: 999px; background: {c}"></span><span style="font-size: 10px; font-weight: 700; color: #B3BCD2">{w}</span></span>'
    for c, w in [('#F5B26B', 'Photo'), ('#6FDCB0', 'Pack'), ('#6FDCB0', 'Supply'), ('#6FDCB0', 'Hold'), ('#6FDCB0', 'Name'), ('rgba(255,255,255,.14)', 'Markup')]) + '</div>'
pic = title_block('Ruth sent it back', 'Door hinge 4" brass · <span class="m" style="color: #FFFFFF">16:20</span> · the photo is open again', lead) + '\n' + strip
hd = head('Sent back', circ('Main.dc.html', 'back', 'Back to Today'), '', pic)
note = '''    <div style="display: flex; align-items: flex-end; gap: 8px">
      ''' + face('RN', 'manager', 32) + '''
      <span style="max-width: 280px; padding: 12px 14px; border-radius: 18px 18px 18px 4px; background: #F6E4F1; color: #1C2233; font-size: 14px; line-height: 1.45">The brass looks brown. Take it again in daylight.</span>
    </div>'''
thumb = '<span role="img" aria-label="The old photo, too dark" style="width: 42px; height: 42px; flex: none; border-radius: 13px; background: radial-gradient(circle at 50% 45%, #4A3A22 0%, #241C12 60%, #120E09 100%)"></span>'
gauge = ('<span role="img" aria-label="Light 18; the pass mark is 30" style="position: relative; flex: none; width: 70px; height: 12px; display: block">'
         '<span style="position: absolute; left: 0; right: 0; top: 4px; height: 4px; border-radius: 2px; background: #EFECE6"></span>'
         '<span style="position: absolute; left: 0; top: 4px; width: 18%; height: 4px; border-radius: 2px; background: #95530C"></span>'
         '<span style="position: absolute; left: 30%; top: 0; width: 2px; height: 12px; border-radius: 1px; background: #5F6980"></span></span>')
saw = lst(row('Light · too dark', 'Stand by the door or a window', thumb, gauge, sub_style='color: #7A4A02'))
then = lst(row('Then back to Ruth', 'One tap once the new photo passes', icon_well('send', 'manager'), ''))
bd = body('\n'.join([sec('Ruth’s note', first=True), note, sec('What the phone saw'), saw, sec('After the retake'), then]))
ft = foot(pill('Retake the photo', href='PhotoGate.dc.html', kind='red', icon='camera'))
html = page('Sent back', hd + '\n' + bd + '\n' + ft, 'class Component extends DCLogic {\n  renderVals() { return {}; }\n}')
