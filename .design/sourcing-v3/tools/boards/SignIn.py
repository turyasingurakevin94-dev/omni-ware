from ow import *

# Sign in: the app's real door (email and password, sourcing.html's sx_ form), drawn on navy.
# States: the form, a wrong password (the first tap on the canvas), the reset link sent; then the walkthrough.
BG = 'radial-gradient(120% 70% at 50% 0%, #2B3866 0%, #16203C 60%, #111A33 100%)'
mark = ('<span style="width: 64px; height: 64px; border-radius: 20px; background: #C93A30; color: #FFFFFF; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 26px rgba(201,58,48,.4)">'
        + svg('M3 5h18l-7 8v6l-4-2v-4z', 30, 2.2) + '</span>')
field = lambda label, inp, right='': (
    f'<label style="display: flex; flex-direction: column; gap: 6px"><span style="font-size: 12px; font-weight: 700; color: #B3BCD2">{label}</span>'
    f'<span style="display: flex; align-items: center; gap: 8px; height: 54px; padding: 0 6px 0 16px; border-radius: 16px; background: rgba(255,255,255,.08); box-shadow: {{{{fieldRing}}}}">{inp}{right}</span></label>')
email = field('Email', '<input value="moses@mukasahardware.co.ug" type="email" autocomplete="username" aria-label="Email" style="flex: 1; min-width: 0; height: 44px; border: none; outline: none; background: transparent; font: inherit; font-size: 16px; font-weight: 600; color: #FFFFFF">')
pw = field('Password', '<input value="{{pwVal}}" type="{{pwType}}" autocomplete="current-password" aria-label="Password" style="flex: 1; min-width: 0; height: 44px; border: none; outline: none; background: transparent; font: inherit; font-size: 16px; font-weight: 600; color: #FFFFFF">',
           '<button type="button" onClick="{{toggleShow}}" aria-label="{{showAria}}" style="all: unset; cursor: pointer; width: 44px; height: 44px; flex: none; border-radius: 12px; color: #B3BCD2; display: flex; align-items: center; justify-content: center">' + svg('rival', 18, 2) + '</button>')
msg = ('<sc-if value="{{hasMsg}}" hint-placeholder-val="{{ false }}"><div role="status" style="display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 0 14px; border-radius: 16px; {{msgStyle}}">'
       '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{{msgIcon}}"></path></svg>'
       '<span style="flex: 1; font-size: 13px; font-weight: 700">{{msg}}</span></div></sc-if>')
form = f'''  <div style="position: absolute; inset: 0; background: {BG}; color: #FFFFFF; display: flex; flex-direction: column; padding: 56px 24px 26px; box-sizing: border-box">
    <div style="display: flex; flex-direction: column; gap: 18px">
      {mark}
      <span style="display: flex; flex-direction: column; gap: 6px"><span style="font-size: 12px; font-weight: 700; color: #6FDCB0">Omni-Ware · Sourcing</span><span style="font-size: 30px; font-weight: 700; letter-spacing: -.02em; line-height: 1.15">Find it, price it,<br>put it on sale</span></span>
    </div>
    <div style="flex: 1"></div>
    <div style="display: flex; flex-direction: column; gap: 14px">
      {email}
      {pw}
      {msg}
      <button type="button" onClick="{{forgot}}" style="all: unset; cursor: pointer; align-self: flex-end; height: 32px; padding: 0 4px; display: flex; align-items: center; font-size: 13px; font-weight: 700; color: #B3BCD2">Forgot password?</button>
    </div>
    <div style="height: 18px"></div>
    <sc-if value="{{first}}" hint-placeholder-val="{{ true }}"><button type="button" onClick="{{go}}" style="all: unset; cursor: pointer; box-sizing: border-box; width: 100%; height: 58px; border-radius: 999px; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px; {{goStyle}}">Sign in</button></sc-if>
    <sc-if value="{{again}}" hint-placeholder-val="{{ false }}"><a href="Welcome.dc.html" style="box-sizing: border-box; width: 100%; height: 58px; border-radius: 999px; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px; {{goStyle}}">Sign in</a></sc-if>
    <span style="margin-top: 14px; text-align: center; font-size: 12px; font-weight: 600; color: #B3BCD2">No account? Ask Joseph to add you as Sourcing</span>
  </div>'''

import re
form = re.sub(r'(?<!\{)\{(\w+)\}(?!\})', r'{{\1}}', form)
script = '''class Component extends DCLogic {
  constructor(p) { super(p); this.state = { mode: 'form', show: false }; }
  renderVals() {
    const S = this.state, m = S.mode;
    const MSG = {
      wrong: ['That email and password don’t match · try again, or reset it', 'background:rgba(245,178,107,.14);color:#F5B26B', 'M12 8v5M12 16.5h.01M12 3 2.5 20h19z'],
      sent: ['A reset link is on its way to moses@…co.ug', 'background:rgba(111,220,176,.14);color:#6FDCB0', 'M4 6h16v12H4zM4 7l8 6 8-6']
    }[m];
    return {
      hasMsg: !!MSG, msg: MSG ? MSG[0] : '', msgStyle: MSG ? MSG[1] : '', msgIcon: MSG ? MSG[2] : '',
      fieldRing: m === 'wrong' ? 'inset 0 0 0 1.5px #F5B26B' : 'inset 0 0 0 1px rgba(255,255,255,.14)',
      pwVal: 'kiseka-118', pwType: S.show ? 'text' : 'password', showAria: S.show ? 'Hide the password' : 'Show the password',
      toggleShow: () => this.setState({ show: !S.show }),
      forgot: () => this.setState({ mode: 'sent' }),
      go: () => this.setState({ mode: 'wrong' }), first: m === 'form', again: m !== 'form',
      goStyle: 'background:#C93A30;color:#FFFFFF;box-shadow:0 10px 24px rgba(201,58,48,.35)'
    };
  }
}'''
html = page('Sign in', form, script)
