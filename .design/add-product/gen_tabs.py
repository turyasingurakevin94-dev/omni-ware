# Generates every artboard body for the sectioned dialog from one shell,
# so the chrome can never say different things on two boards.
X = lambda s: s

def rail(active, st, variable=True, foot=None):
    def item(key, name, state, extra='', none=False):
        on = ' on' if key == active else ''
        cls = ' none' if none else ''
        return (f'          <div class="tb-i{on}"><span class="tb-n">{name}</span>'
                f'{extra}<span class="tb-s{cls}">{state}</span></div>\n')
    out = ['        <nav class="tb-rail">\n', '          <p class="tb-g">The product</p>\n']
    out.append(item('basics', 'Basics', st['basics'], st.get('basics_x',''), st.get('basics_none',False)))
    out.append(item('photo', 'Photo', st['photo'], st.get('photo_x',''), st.get('photo_none',False)))
    out.append('          <p class="tb-g">Money</p>\n')
    out.append(item('markup', 'Markup rules', st['markup'], '', st.get('markup_none',False)))
    out.append(item('agent', 'Agent share', st['agent'], '', st.get('agent_none',False)))
    if variable:
        out.append('          <p class="tb-g">What it comes in</p>\n')
        out.append(item('variants', 'Variants', st['variants'], '', st.get('variants_none',False)))
    out.append(f'          <p class="tb-foot">{foot or "A price is not set here. It is entered per supplier in the Price Registry, once this is saved."}</p>\n')
    out.append('        </nav>\n')
    return ''.join(out)

def dialog(active, st, pane, foot_note, save='Save product', variable=True,
           save_cls='btn-accent', rail_foot=None, step=''):
    return f'''<div class="modal fixed" style="position:relative;">
    <div class="modal-head">
      <h2>Add product</h2>{step}
      <span class="mh-id">will be filed as <b>P014</b></span>
      <span class="modal-close" style="margin-left:14px;"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></span>
    </div>
    <div class="modal-body">
      <div class="tb-shell">
{rail(active, st, variable, rail_foot)}        <div class="tb-pane">
{pane}
        </div>
      </div>
    </div>
    <div class="modal-foot">
      <span class="mf-note{' bad' if save_cls=='dis' and 'Not saved' in foot_note else ''}">{foot_note}</span>
      <span class="btn btn-ghost">Cancel</span>
      <span class="btn {save_cls}">{save}</span>
    </div>
  </div>'''

FULL = dict(
  basics='Iron sheets — G28, 3m box profile',
  photo='Chosen', photo_x='<span class="tb-thumb"><svg viewBox="0 0 24 24"><path d="M4 16l4.5-4.5a2 2 0 0 1 2.8 0L16 16M14 14l1.5-1.5a2 2 0 0 1 2.8 0L21 16M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM9 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/></svg></span>',
  markup='<span class="mono">+18%</span> wholesale · <span class="mono">+12%</span> retail',
  agent='Shop default — <span class="mono">30%</span>', agent_none=True,
  variants='<span class="mono">24</span> · 2 with own markup')

EMPTY = dict(
  basics='Not named yet', basics_none=True, basics_x='<span class="tb-d need"></span>',
  photo='None', photo_none=True,
  markup='No rule set', markup_none=True,
  agent='Shop default — <span class="mono">30%</span>', agent_none=True,
  variants='None built yet', variants_none=True)

REFUSED = dict(EMPTY, basics='A name is needed', basics_x='<span class="tb-d bad"></span>')
