# Renders body_main.html's TEMPLATE into plain HTML for screenshotting only.
# It is not the runtime: it expands <sc-for>/<sc-if> and {{ dotted.holes }}
# against the initial state of _logic_main.js so the artboard can be looked
# at before it is seeded. Handlers render as nothing.
import re, sys, json

L = {
 'categories': ['Cement','Iron sheets','Nails','Paint','Plumbing','Timber','Tools'],
 'units': ['bag','piece','box','kg','metre','bundle','roll','litre','tin'],
 'locations': ['Nakawa','Kireka','Bweyogerere','Seeta','Mukono','Namugongo','Kyaliwajjala','Nansana','Kawempe','Ntinda','Naalya','Gayaza'],
 'income': ['Sales','Agent float','Loan in','Rent received','Scrap','Other'],
 'expense': ['Transport','Rent','Wages','Airtime','Fuel','Loading','Repairs','Licence','Bank charge','Meals','Other'],
}
SPEC = [('categories','Categories','Suggested in the Category and Sub-category fields on a product.'),
        ('units','Units','Suggested in the Unit and Pack unit fields on a price entry.'),
        ('locations','Locations','Chosen on a customer or an agent, and what groups orders going the same way on the board.'),
        ('income','Money in','Suggested when logging Cash In, and what groups the income chart on the Cash book.'),
        ('expense','Money out','Suggested when logging Cash Out, and what groups the expense chart on the Cash book.')]

def row(n,v,cls): return {'name':n,'v':v,'cls':'ix-v '+cls,'go':''}

V = {
 'q':'', 'hits':'', 'onSearch':'', 'fixNow':'',
 'wordCount': str(sum(len(v) for v in L.values())+12),
 'show': {'words':True,'rules':True,'identity':True,'momo':True,'devices':True,'shop':True,'none':False},
 'lists': [{'key':k,'title':t,'used':u,'n':str(len(L[k])),'draft':'','onInput':'','onKey':'',
            'items':[{'name':x,'del':''} for x in L[k]]} for k,t,u in SPEC],
 'unset': {'any':True,'markup':True,'identity':True,'limits':True,
           'headline':'3 settings are unset, and something depends on each.','action':'Set the price rule'},
 'mk': {'unset':True,'set':False,'cls':'rr rr-unset','words':'','w':'','r':'','wt':'percent','rt':'percent',
        'onW':'','onR':'','onWt':'','onRt':''},
 'lim': {'unset':True,'cls':'rr rr-unset','n':'0','a':'','b':'','c':'','onA':'','onB':'','onC':''},
 'id': {'name':'','addr':'','line1':'(no shop name on file)','line2':'(no address on file)','onName':'','onAddr':''},
 'momo': {'on':True,'env':'sandbox','prod':False,'state':'MTN on sandbox','onToggle':'','onEnv':'','confirmProd':'','cancelProd':''},
 'index': {
   'words':[row('Categories','7',''),row('Units','9',''),row('Locations','12',''),row('Money in','6',''),row('Money out','11',''),row('Attributes','3','')],
   'rules':[row('Default price rule','not set','warn'),row('Agent share of margin','40 / 30%',''),row('Cluster bonus wait','7 d',''),
            row('Trust a price for','90 d',''),row('Prices to check','20 / mo',''),row('Order step limits','none of 6','warn'),row('Set on other screens','5','')],
   'shop':[row('On paper','not named','warn'),row('Mobile money','sandbox',''),row('Signed-in devices','4','')]},
}

def look(scope, path):
    cur = scope
    for part in path.split('.'):
        if isinstance(cur, dict) and part in cur: cur = cur[part]
        else: return None
    return cur

def holes(s, scope):
    def r(m):
        v = look(scope, m.group(1).strip())
        if v is None or v is False or callable(v): return ''
        if v is True: return 'true'
        return str(v)
    return re.sub(r'\{\{\s*([\w.$]+)\s*\}\}', r, s)

TAG = re.compile(r'<sc-(for|if)\b([^>]*)>', re.S)

def expand(s, scope):
    out = []
    i = 0
    while True:
        m = TAG.search(s, i)
        if not m:
            out.append(holes(s[i:], scope)); break
        out.append(holes(s[i:m.start()], scope))
        kind = m.group(1); attrs = m.group(2)
        # find matching close
        depth = 1; j = m.end()
        close = '</sc-%s>' % kind; openp = '<sc-%s' % kind
        while depth:
            no = s.find(openp, j); nc = s.find(close, j)
            if nc == -1: raise SystemExit('unclosed sc-'+kind)
            if no != -1 and no < nc: depth += 1; j = no + len(openp)
            else:
                depth -= 1; j = nc + len(close)
                if depth == 0: inner = s[m.end():nc]
        if kind == 'if':
            cond = re.search(r'value="\{\{\s*([\w.$]+)\s*\}\}"', attrs).group(1)
            if look(scope, cond): out.append(expand(inner, scope))
        else:
            lst = re.search(r'list="\{\{\s*([\w.$]+)\s*\}\}"', attrs).group(1)
            alias = re.search(r'as="([\w$]+)"', attrs).group(1)
            for it in (look(scope, lst) or []):
                sc = dict(scope); sc[alias] = it
                out.append(expand(inner, sc))
        i = j
    return ''.join(out)

import os, json as _json
_stem = os.path.basename(sys.argv[1]).split('.')[0]
_pv = '_preview_%s.json' % _stem
if os.path.exists(_pv):
    V = _json.load(open(_pv))

src = open(sys.argv[1]).read()
head = src.split('</helmet>')[0].split('<helmet>')[1]
body = src.split('</helmet>')[1].split('</x-dc>')[0]
body = expand(body, V)
w, h = re.search(r'width:(\d+)px;height:(\d+)px', body).groups()
open(sys.argv[2],'w').write(
  '<!doctype html><html><head><meta charset="utf-8">' + head.replace('<style>','<style>*{box-sizing:border-box}')
  + '</head><body style="margin:0">' + body + '</body></html>')
print(w, h)
