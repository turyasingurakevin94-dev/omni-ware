# The six-month chart, drawn at real pixel size so nothing is stretched.
NET  = [14.2, 11.6, 18.9, -2.4, 16.8, 20.9]
CASH = [19.8, 17.1, 22.4, 12.6, 24.9, 31.4]
LAB  = ['Mar','Apr','May','Jun','Jul','Aug']

def chart(w, h, path, stretched=False):
    top, bot = 8, 8
    mx = max(max(NET+CASH), -min(NET+CASH))
    # zero line placed so the one loss month has room, not at the middle
    lo = min(0, min(NET+CASH)); hi = max(NET+CASH)
    span = hi - lo
    def y(v): return top + (hi - v) / span * (h - top - bot)
    zero = y(0)
    slots = w / 6
    barw = 15; gap = 5
    out = []
    out.append(f'<svg class="st2-tr-svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" '
               f'aria-label="Net profit and cash from trading, month by month">')
    out.append(f'<line x1="0" y1="{zero:.1f}" x2="{w}" y2="{zero:.1f}" stroke="#CFD5DA" stroke-width="1"/>')
    for i,(n,c) in enumerate(zip(NET, CASH)):
        cx = i*slots + slots/2
        for j,(v,fill) in enumerate(((n,'#252A31'), (c,'#1C6B58'))):
            x = cx - barw - gap/2 + j*(barw+gap)
            yy = y(v) if v >= 0 else zero
            hh = abs(y(v) - zero)
            op = ' opacity=".55"' if v < 0 else ''
            out.append(f'<rect x="{x:.1f}" y="{yy:.1f}" width="{barw}" height="{max(hh,1.5):.1f}" '
                       f'fill="{fill}"{op} rx="1"/>')
    out.append('</svg>')
    open(path,'w').write('\n'.join(out))

def chart_before(w, h, path):
    """The current one: viewBox 100x46 stretched with preserveAspectRatio=none."""
    W, H, gap = 100, 46, 2
    mx = max(abs(v) for v in NET+CASH)
    slot = (W-gap)/6; barw = (slot-gap)/2; zero = H/2
    out = [f'<svg viewBox="0 0 {W} {H}" preserveAspectRatio="none" width="{w}" height="{h}" '
           f'style="display:block;width:100%;height:{h}px;overflow:visible">',
           f'<line x1="0" y1="{zero}" x2="{W}" y2="{zero}" stroke="#CFD5DA" stroke-width="0.4"/>']
    for i,(n,c) in enumerate(zip(NET, CASH)):
        for j,(v,fill) in enumerate(((n,'#252A31'), (c,'#1C6B58'))):
            hh = abs(v)/mx * (H/2 - 3)
            x = gap/2 + i*slot + j*barw
            yy = zero - hh if v >= 0 else zero
            op = ' opacity=".55"' if v < 0 else ''
            out.append(f'<rect x="{x:.2f}" y="{yy:.2f}" width="{barw-0.5:.2f}" height="{max(hh,0.4):.2f}" fill="{fill}"{op}/>')
    out.append('</svg>')
    open(path,'w').write('\n'.join(out))

chart(792, 104, '_ch_after.svg')
chart_before(1058, 120, '_ch_before.svg')
print('charts ok')
