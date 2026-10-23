from ow import *
import re

# Sign in. The phone remembers who last signed in, so most mornings it is "Welcome back, Moses"
# and one field. Above it, the app at work: three of today's cards drift in the glow.
# States: back (default), wrong password, the reset link sent, someone else (both fields).
BG = 'radial-gradient(90% 55% at 50% 30%, #34447A 0%, #1C2747 55%, #111A33 100%)'
CSS = ('@keyframes owFloatA{0%,100%{transform:translateY(0) rotate(-7deg)}50%{transform:translateY(-8px) rotate(-6deg)}}'
       '@keyframes owFloatB{0%,100%{transform:translateY(0) rotate(5deg)}50%{transform:translateY(-10px) rotate(6deg)}}'
       '@keyframes owFloatC{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-6px) rotate(-3deg)}}'
       '@keyframes owGlow{0%,100%{opacity:.55}50%{opacity:.9}}')

def floatcard(inner, pos, anim, bg='#FFFFFF', ink='#1C2233', w=220):
    return (f'<div aria-hidden="true" style="position: absolute; {pos}; width: {w}px; box-sizing: border-box; padding: 12px 14px; border-radius: 20px; background: {bg}; color: {ink}; '
            f'box-shadow: 0 18px 40px rgba(0,0,0,.35); white-space: nowrap; display: flex; align-items: center; gap: 12px; animation: {anim} 6s ease-in-out infinite">{inner}</div>')
cardA = floatcard('<span style="width: 40px; height: 40px; flex: none; border-radius: 999px; background: conic-gradient(#0F6B43 0 300deg, #EFECE6 300deg 360deg); display: flex; align-items: center; justify-content: center"><span class="m" style="width: 30px; height: 30px; border-radius: 999px; background: #FFFFFF; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 600">5/6</span></span>'
                  '<span style="display: flex; flex-direction: column; gap: 2px"><span class="nm" style="font-size: 13px; font-weight: 700">Wire mesh BRC A142</span><span style="font-size: 11px; font-weight: 600; color: #0F6B43">Ready for Ruth</span></span>',
                  'left: 18px; top: 96px', 'owFloatA')
cardB = floatcard('<span style="width: 40px; height: 40px; flex: none; border-radius: 12px; background: #E4E6FA; color: #3A3F9B; display: flex; align-items: center; justify-content: center">' + svg('tag', 18, 2) + '</span>'
                  '<span style="display: flex; flex-direction: column; gap: 2px"><span class="m" style="font-size: 17px; font-weight: 600">118,000</span><span style="font-size: 11px; font-weight: 600; color: #5F6980">Kiseka · same price</span></span>'
                  '<span style="margin-left: auto; width: 26px; height: 26px; border-radius: 999px; background: #0F6B43; color: #FFFFFF; display: flex; align-items: center; justify-content: center">' + svg('tick', 13, 3) + '</span>',
                  'right: 14px; top: 196px', 'owFloatB', w=236)
cardC = floatcard('<span style="display: flex"><span style="width: 30px; height: 30px; border-radius: 999px; background: #DCEAF8; color: #1A5A8A; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 2px #1C2747">GA</span><span style="width: 30px; height: 30px; margin-left: -8px; border-radius: 999px; background: #F6E4F1; color: #7A3268; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 2px #1C2747">BO</span><span style="width: 30px; height: 30px; margin-left: -8px; border-radius: 999px; background: #DDF1EE; color: #0E5E57; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 2px #1C2747">AN</span></span>'
                  '<span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 13px; font-weight: 700">On sale</span><span style="font-size: 11px; font-weight: 600; color: #B3BCD2">3 askers told</span></span>'
                  '<span style="margin-left: auto; width: 8px; height: 8px; border-radius: 999px; background: #6FDCB0; box-shadow: 0 0 0 4px rgba(111,220,176,.2)"></span>',
                  'left: 40px; top: 292px', 'owFloatC', bg='#26335E', ink='#FFFFFF', w=226)
scene = ('<div style="position: relative; flex: none; height: 380px">'
         '<span aria-hidden="true" style="position: absolute; left: 50%; top: 210px; width: 360px; height: 360px; margin: -180px 0 0 -180px; border-radius: 999px; background: radial-gradient(circle, rgba(111,220,176,.22) 0%, rgba(111,220,176,0) 62%); animation: owGlow 5s ease-in-out infinite"></span>'
         '<div style="position: absolute; left: 24px; top: 34px; display: flex; align-items: center; gap: 10px">'
         '<span style="width: 40px; height: 40px; border-radius: 13px; background: #C93A30; color: #FFFFFF; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 20px rgba(201,58,48,.45)">' + svg('M3 5h18l-7 8v6l-4-2v-4z', 20, 2.2) + '</span>'
         '<span style="font-size: 14px; font-weight: 700">Omni-Ware <span style="color: #6FDCB0">Sourcing</span></span></div>'
         + cardA + cardB + cardC + '</div>')

inp = 'flex: 1; min-width: 0; height: 44px; border: none; outline: none; background: transparent; font: inherit; font-size: 16px; font-weight: 600; color: #FFFFFF'
box = 'display: flex; align-items: center; gap: 8px; height: 56px; padding: 0 6px 0 16px; border-radius: 16px; background: rgba(255,255,255,.08); box-shadow: {fieldRing}'
who = f'''      <sc-if value="{{back}}" hint-placeholder-val="{{ true }}">
      <div style="display: flex; align-items: center; gap: 14px">
        {face('ML', 'sky', 52, '0 0 0 3px #16203C, 0 0 0 5px rgba(111,220,176,.6)')}
        <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 24px; font-weight: 700; letter-spacing: -.02em">Welcome back, Moses</span><span style="font-size: 12px; font-weight: 600; color: #B3BCD2">moses@mukasahardware.co.ug</span></span>
        <button type="button" onClick="{{notMe}}" style="all: unset; cursor: pointer; flex: none; height: 32px; padding: 0 10px; border-radius: 999px; background: rgba(255,255,255,.1); font-size: 12px; font-weight: 700; display: flex; align-items: center">Not you?</button>
      </div>
      </sc-if>
      <sc-if value="{{other}}" hint-placeholder-val="{{ false }}">
      <span style="font-size: 26px; font-weight: 700; letter-spacing: -.02em">Sign in to Sourcing</span>
      <label style="{box}"><input value="" placeholder="Your work email" type="email" autocomplete="username" aria-label="Email" style="{inp}"></label>
      </sc-if>'''
pw = (f'      <label style="{box}"><input value="{{pwVal}}" type="{{pwType}}" autocomplete="current-password" aria-label="Password" placeholder="Password" style="{inp}">'
      '<button type="button" onClick="{toggleShow}" aria-label="{showAria}" style="all: unset; cursor: pointer; width: 44px; height: 44px; flex: none; border-radius: 12px; color: #B3BCD2; display: flex; align-items: center; justify-content: center">' + svg('rival', 18, 2) + '</button></label>')
msg = ('      <sc-if value="{hasMsg}" hint-placeholder-val="{ false }"><div role="status" style="display: flex; align-items: center; gap: 10px; min-height: 46px; padding: 0 14px; border-radius: 14px; {msgStyle}">'
       '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{msgIcon}"></path></svg>'
       '<span style="flex: 1; font-size: 13px; font-weight: 700">{msg}</span></div></sc-if>')
form = f'''  <div style="position: absolute; inset: 0; background: {BG}; color: #FFFFFF; display: flex; flex-direction: column; overflow: hidden">
    {scene}
    <div style="flex: 1; display: flex; flex-direction: column; justify-content: flex-end; gap: 14px; padding: 0 24px 26px">
{who}
{pw}
{msg}
      <div style="display: flex; align-items: center; justify-content: space-between">
        <span style="display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: #B3BCD2">{svg('M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z', 14, 2)}Stays signed in on this phone</span>
        <button type="button" onClick="{{forgot}}" style="all: unset; cursor: pointer; height: 32px; padding: 0 4px; display: flex; align-items: center; font-size: 13px; font-weight: 700; color: #FFFFFF">Forgot password?</button>
      </div>
      <sc-if value="{{first}}" hint-placeholder-val="{{ true }}"><button type="button" onClick="{{go}}" style="all: unset; cursor: pointer; box-sizing: border-box; width: 100%; height: 58px; border-radius: 999px; background: #C93A30; color: #FFFFFF; box-shadow: 0 12px 28px rgba(201,58,48,.45); font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px">Sign in{svg('chev', 18, 2.4)}</button></sc-if>
      <sc-if value="{{again}}" hint-placeholder-val="{{ false }}"><a href="Welcome.dc.html" style="box-sizing: border-box; width: 100%; height: 58px; border-radius: 999px; background: #C93A30; color: #FFFFFF; box-shadow: 0 12px 28px rgba(201,58,48,.45); font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px">Sign in{svg('chev', 18, 2.4)}</a></sc-if>
    </div>
  </div>'''
# single-brace holes written inside f-strings become {{holes}} again
form = re.sub(r'(?<!\{)\{(\s?[\w.]+\s?)\}(?!\})', r'{{\1}}', form)

script = '''class Component extends DCLogic {
  constructor(p) { super(p); this.state = { mode: 'form', who: 'back', show: false }; }
  renderVals() {
    const S = this.state, m = S.mode;
    const MSG = {
      wrong: ['That password doesn’t match · try again, or reset it', 'background:rgba(245,178,107,.14);color:#F8C994', 'M12 8v5M12 16.5h.01M12 3 2.5 20h19z'],
      sent: ['A reset link is on its way to your email', 'background:rgba(111,220,176,.14);color:#6FDCB0', 'M4 6h16v12H4zM4 7l8 6 8-6']
    }[m];
    return {
      back: S.who === 'back', other: S.who === 'other', notMe: () => this.setState({ who: 'other', mode: 'form' }),
      hasMsg: !!MSG, msg: MSG ? MSG[0] : '', msgStyle: MSG ? MSG[1] : '', msgIcon: MSG ? MSG[2] : '',
      fieldRing: m === 'wrong' ? 'inset 0 0 0 1.5px #F5B26B' : 'inset 0 0 0 1px rgba(255,255,255,.14)',
      pwVal: S.who === 'back' ? 'kiseka-118' : '', pwType: S.show ? 'text' : 'password', showAria: S.show ? 'Hide the password' : 'Show the password',
      toggleShow: () => this.setState({ show: !S.show }),
      forgot: () => this.setState({ mode: 'sent' }),
      go: () => this.setState({ mode: 'wrong' }), first: m === 'form', again: m !== 'form'
    };
  }
}'''
html = page('Sign in', form, script, extra_css=CSS)
