from ow import svg
KEYPAD = '''<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px">
      <sc-for list="{{keys}}" as="k" hint-placeholder-count="12">
        <button type="button" aria-label="{{k.aria}}" onClick="{{k.press}}" style="all: unset; cursor: pointer; height: 48px; border-radius: 14px; background: #FFFFFF; box-shadow: inset 0 0 0 1px #E6E3DD; font-family: 'IBM Plex Mono', monospace; font-size: 20px; font-weight: 600; display: flex; align-items: center; justify-content: center">
          <sc-if value="{{k.isText}}" hint-placeholder-val="{{ true }}">{{k.label}}</sc-if>
          <sc-if value="{{k.isBack}}" hint-placeholder-val="{{ false }}">''' + svg('M9 5h11v14H9l-6-7zM13 10l4 4M17 10l-4 4', 22, 1.8) + '''</sc-if>
        </button>
      </sc-for>
    </div>'''
KEYS_JS = """const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'back'].map(label => ({
      label, isText: label !== 'back', isBack: label === 'back', aria: label === 'back' ? 'Delete a digit' : label,
      press: () => this.setState({ v: label === 'back' ? v.slice(0, -1) : (v + label).replace(/^0+/, '').slice(0, 9) })
    }));"""
TOAST = '''<div role="status" style="display: flex; align-items: center; gap: 10px; min-height: 50px; padding: 0 14px; border-radius: 16px; background: #16203C; color: #FFFFFF; font-size: 14px; font-weight: 600">''' + svg('tick', 18, 2.6, '#6FDCB0') + '''<span style="flex: 1">{{savedWord}}</span><button type="button" onClick="{{undo}}" style="all: unset; cursor: pointer; padding: 6px 8px; color: #6FDCB0; font-weight: 700">Undo</button></div>'''
