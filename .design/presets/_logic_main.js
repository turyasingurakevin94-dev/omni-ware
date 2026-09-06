class Component extends DCLogic {
  constructor(props){
    super(props);
    this.state = {
      q: '',
      lists: {
        categories: ['Cement','Iron sheets','Nails','Paint','Plumbing','Timber','Tools'],
        units:      ['bag','piece','box','kg','metre','bundle','roll','litre','tin'],
        locations:  ['Nakawa','Kireka','Bweyogerere','Seeta','Mukono','Namugongo','Kyaliwajjala','Nansana','Kawempe','Ntinda','Naalya','Gayaza'],
        income:     ['Sales','Agent float','Loan in','Rent received','Scrap','Other'],
        expense:    ['Transport','Rent','Wages','Airtime','Fuel','Loading','Repairs','Licence','Bank charge','Meals','Other']
      },
      drafts: {categories:'', units:'', locations:'', income:'', expense:''},
      mkW: '', mkR: '', mkWt: 'percent', mkRt: 'percent',
      shopName: '', shopAddr: '',
      lim: {a:'', b:'', c:''},
      momoOn: true, momoEnv: 'sandbox', momoPending: false
    };
  }

  // ---- the lists -------------------------------------------------
  listSpec(){
    return [
      ['categories','Categories','Suggested in the Category and Sub-category fields on a product.'],
      ['units','Units','Suggested in the Unit and Pack unit fields on a price entry.'],
      ['locations','Locations','Chosen on a customer or an agent, and what groups orders going the same way on the board.'],
      ['income','Money in','Suggested when logging Cash In, and what groups the income chart on the Cash book.'],
      ['expense','Money out','Suggested when logging Cash Out, and what groups the expense chart on the Cash book.'],
      ['attributes','Attributes','Suggested when a product is built in variants.']
    ];
  }
  del(key, i){
    const next = Object.assign({}, this.state.lists);
    next[key] = next[key].filter((_, j) => j !== i);
    this.setState({lists: next});
  }
  add(key){
    const v = (this.state.drafts[key] || '').trim();
    if(!v) return;
    const lists = Object.assign({}, this.state.lists);
    if(lists[key].some(x => x.toLowerCase() === v.toLowerCase())){
      const d = Object.assign({}, this.state.drafts); d[key] = '';
      this.setState({drafts: d}); return;
    }
    lists[key] = lists[key].concat([v]).sort((a,b) => a.localeCompare(b));
    const drafts = Object.assign({}, this.state.drafts); drafts[key] = '';
    this.setState({lists: lists, drafts: drafts});
  }

  // ---- what is unset, and what depends on it ---------------------
  markupSet(){ return String(this.state.mkW).trim() !== '' || String(this.state.mkR).trim() !== ''; }
  identitySet(){ return this.state.shopName.trim() !== '' && this.state.shopAddr.trim() !== ''; }
  limitsN(){ return ['a','b','c'].filter(k => String(this.state.lim[k]).trim() !== '').length; }

  markupWords(){
    const side = (v, t, per) => {
      const s = String(v).trim();
      if(s === '') return null;
      return t === 'percent' ? ('+' + s + '% on cost') : ('+' + s + ' UGX per ' + per);
    };
    const w = side(this.state.mkW, this.state.mkWt, 'pack');
    const r = side(this.state.mkR, this.state.mkRt, 'piece');
    if(w && r) return 'Wholesale ' + w + ', retail ' + r;
    if(w) return 'Wholesale ' + w + '; no retail default';
    if(r) return 'Retail ' + r + '; no wholesale default';
    return '';
  }

  // ---- search ----------------------------------------------------
  sections(){
    return {
      words: 'words categories category sub-category units unit pack locations location place delivery money in income money out expense cash book attributes attribute variants colour gauge length spelling list vocabulary',
      rules: 'rules default price rule markup percent fixed margin agent share cluster bonus wait trust a price stale days prices to check order step limits late flag alert notification restock cover target margin dead after chase a debt watch supplier price',
      identity: 'shop identity name address phone tin receipt footer print printing paper kiosk thermal 80mm on paper',
      momo: 'mobile money momo mtn airtel merchant api key subscription client secret sandbox production credentials payment prompt agent pays',
      devices: 'signed in devices device phone computer session sign out revoke stolen login'
    };
  }
  show(){
    const q = this.state.q.trim().toLowerCase();
    const s = this.sections();
    const hit = k => q === '' || s[k].indexOf(q) !== -1;
    const identity = hit('identity'), momo = hit('momo'), devices = hit('devices');
    const words = hit('words'), rules = hit('rules');
    return {
      words: words, rules: rules,
      identity: identity, momo: momo, devices: devices,
      shop: identity || momo || devices,
      none: !(words || rules || identity || momo || devices)
    };
  }

  jump(term){ return () => this.setState({q: term}); }

  renderVals(){
    const st = this.state;
    const lists = this.listSpec().filter(sp => sp[0] !== 'attributes').map(sp => {
      const key = sp[0];
      return {
        key: key, title: sp[1], used: sp[2],
        n: String(st.lists[key].length),
        draft: st.drafts[key],
        items: st.lists[key].map((name, i) => ({name: name, del: () => this.del(key, i)})),
        onInput: (e) => { const d = Object.assign({}, st.drafts); d[key] = e.target.value; this.setState({drafts: d}); },
        onKey: (e) => { if(e.key === 'Enter') this.add(key); }
      };
    });

    const mkSet = this.markupSet(), idSet = this.identitySet(), limN = this.limitsN();
    const bad = [!mkSet, !idSet, limN === 0].filter(Boolean).length;
    const headline = bad === 1
      ? 'One setting is unset, and something depends on it.'
      : bad + ' settings are unset, and something depends on each.';
    const action = !mkSet ? 'Set the price rule' : (!idSet ? 'Name the shop' : 'Set a limit');

    const show = this.show();
    const wordCount = ['categories','units','locations','income','expense']
      .reduce((n, k) => n + st.lists[k].length, 0) + 12;

    const setV = (v, cls) => ({v: v, cls: cls});
    const row = (name, v, cls, term) => ({name: name, v: v, cls: 'ix-v ' + (cls || ''), go: this.jump(term)});

    return {
      q: st.q,
      onSearch: (e) => this.setState({q: e.target.value}),
      hits: st.q.trim() === '' ? '' : (show.none ? '0' : ''),
      show: show,
      lists: lists,
      wordCount: String(wordCount),

      unset: {
        any: bad > 0, markup: !mkSet, identity: !idSet, limits: limN === 0,
        headline: headline, action: action
      },
      fixNow: () => this.setState({q: !mkSet ? 'default price rule' : (!idSet ? 'shop identity' : 'order step limits')}),

      mk: {
        unset: !mkSet, set: mkSet, cls: mkSet ? 'rr' : 'rr rr-unset',
        words: this.markupWords(),
        w: st.mkW, r: st.mkR, wt: st.mkWt, rt: st.mkRt,
        onW: (e) => this.setState({mkW: e.target.value}),
        onR: (e) => this.setState({mkR: e.target.value}),
        onWt: (e) => this.setState({mkWt: e.target.value}),
        onRt: (e) => this.setState({mkRt: e.target.value})
      },

      lim: {
        unset: limN === 0, cls: limN === 0 ? 'rr rr-unset' : 'rr', n: String(limN),
        a: st.lim.a, b: st.lim.b, c: st.lim.c,
        onA: (e) => this.setState({lim: Object.assign({}, st.lim, {a: e.target.value})}),
        onB: (e) => this.setState({lim: Object.assign({}, st.lim, {b: e.target.value})}),
        onC: (e) => this.setState({lim: Object.assign({}, st.lim, {c: e.target.value})})
      },

      id: {
        name: st.shopName, addr: st.shopAddr,
        line1: st.shopName.trim() === '' ? '(no shop name on file)' : st.shopName,
        line2: st.shopAddr.trim() === '' ? '(no address on file)' : st.shopAddr,
        onName: (e) => this.setState({shopName: e.target.value}),
        onAddr: (e) => this.setState({shopAddr: e.target.value})
      },

      momo: {
        on: st.momoOn, env: st.momoEnv, prod: st.momoPending,
        state: st.momoOn ? (st.momoEnv === 'production' ? 'MTN live' : 'MTN on sandbox') : 'off',
        onToggle: (e) => this.setState({momoOn: e.target.checked}),
        onEnv: (e) => {
          if(e.target.value === 'production') this.setState({momoPending: true});
          else this.setState({momoEnv: 'sandbox', momoPending: false});
        },
        confirmProd: () => this.setState({momoEnv: 'production', momoPending: false}),
        cancelProd: () => this.setState({momoEnv: 'sandbox', momoPending: false})
      },

      index: {
        words: [
          row('Categories', String(st.lists.categories.length), '', 'categories'),
          row('Units', String(st.lists.units.length), '', 'units'),
          row('Locations', String(st.lists.locations.length), '', 'locations'),
          row('Money in', String(st.lists.income.length), '', 'money in'),
          row('Money out', String(st.lists.expense.length), '', 'money out'),
          row('Attributes', '3', '', 'attributes')
        ],
        rules: [
          row('Default price rule', mkSet ? 'set' : 'not set', mkSet ? 'good' : 'warn', 'default price rule'),
          row('Agent share of margin', '40 / 30%', '', 'agent share'),
          row('Cluster bonus wait', '7 d', '', 'cluster bonus'),
          row('Trust a price for', '90 d', '', 'trust a price'),
          row('Prices to check', '20 / mo', '', 'prices to check'),
          row('Order step limits', limN === 0 ? 'none of 6' : limN + ' of 6', limN === 0 ? 'warn' : '', 'order step limits'),
          row('Set on other screens', '5', '', 'restock cover')
        ],
        shop: [
          row('On paper', idSet ? 'named' : 'not named', idSet ? 'good' : 'warn', 'shop identity'),
          row('Mobile money', st.momoOn ? (st.momoEnv === 'production' ? 'MTN live' : 'sandbox') : 'off',
              st.momoEnv === 'production' && st.momoOn ? 'good' : '', 'mobile money'),
          row('Signed-in devices', '4', '', 'devices')
        ]
      }
    };
  }
}
