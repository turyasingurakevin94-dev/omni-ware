class Component extends DCLogic {
  constructor(props){
    super(props);
    this.state = { verb: 'never', qty: '16', cost: '310000', sup: 'Shafik Katwe', bill: 'none' };
  }
  renderVals(){
    const s = this.state;
    const n = (x)=> Number(x || 0).toLocaleString('en-UG');
    const INK = '#14171B', DIM = '#8A939C', BAD = '#7F1D1A';

    const rows = [
      { date:'08-19', type:'Restock', delta:'+2',  after:'2',  note:'Purchased from Jeff Kenyos @ 310,000 UGX per Ctn', here:false },
      { date:'08-22', type:'Sold',    delta:'−1', after:'1',  note:'Quote for Rebbeca', here:false },
      { date:'08-28', type:'Restock', delta:'+16', after:'17', note:'Purchased from Shafik Katwe @ 310,000 UGX per Ctn', here:true },
      { date:'09-05', type:'Sold',    delta:'−1', after:'16', note:'Quote for Bright (PAM)', here:false }
    ].map((r)=> ({ ...r, cls: r.here ? 'here' : '', dir: r.delta.charAt(0) === '+' ? 'up' : 'dn' }));

    const V = [
      { id:'never',   title:'It never happened',     sub:'I recorded goods that never arrived. Take it back off entirely.' },
      { id:'figures', title:'The figures are wrong', sub:'It happened, but the count, the cost, the supplier or the bill is wrong.' },
      { id:'shelf',   title:'The shelf disagrees',   sub:'The record is right. What is standing there is different.' }
    ];
    const verbs = V.map((v)=> ({ ...v, cls: s.verb === v.id ? 'on' : '', pick: ()=> this.setState({ verb: v.id }) }));

    const qty = Number(s.qty) || 0;
    const cost = Number(s.cost) || 0;
    const billClash = s.bill !== 'none';

    let effects, cta, footNote;
    if(s.verb === 'never'){
      effects = [
        { label:'On the shelf',                 before:'16 Ctn',    after:'0 Ctn',   col: INK },
        { label:'What the stock here is worth', before:'4,960,000', after:'0',       col: INK },
        { label:'What you owe Shafik Katwe',    before:'nothing',   after:'nothing', col: DIM },
        { label:'The movement log',             before:'6 rows',    after:'7 rows',  col: INK }
      ];
      cta = 'Take it back off';
      footNote = 'A reversal is posted; the original row stays in the log, marked.';
    } else if(s.verb === 'figures'){
      effects = [
        { label:'On the shelf',                 before:'16 Ctn',    after: n(qty) + ' Ctn', col: INK },
        { label:'What the stock here is worth', before:'4,960,000', after: n(qty * cost),   col: INK },
        { label:'What you owe ' + s.sup,        before:'nothing',
          after: billClash ? 'rewrites a settled bill' : 'nothing', col: billClash ? BAD : DIM },
        { label:'The price registry',           before:'310,000',
          after: cost === 310000 ? 'unchanged' : n(cost), col: cost === 310000 ? DIM : INK }
      ];
      cta = 'Save the correction';
      footNote = billClash
        ? 'This cannot be saved while it points at another delivery’s bill.'
        : 'The old figures stay in the log; a correction is posted over them.';
    } else {
      effects = [
        { label:'On the shelf',                 before:'16 Ctn',    after:'16 Ctn',    col: DIM },
        { label:'What the stock here is worth', before:'4,960,000', after:'4,960,000', col: DIM },
        { label:'What you owe',                 before:'nothing',   after:'nothing',   col: DIM },
        { label:'The movement log',             before:'6 rows',    after:'7 rows',    col: INK }
      ];
      cta = 'Post the count';
      footNote = 'A count never rewrites a purchase — it is its own movement.';
    }

    return { rows, verbs, effects, cta, footNote,
      isNever: s.verb === 'never', isFigures: s.verb === 'figures', isShelf: s.verb === 'shelf',
      qty: s.qty, cost: s.cost, billClash,
      setQty: (e)=> this.setState({ qty: e.target.value }),
      setQtyUnit: (e)=> this.setState({ qtyUnit: e.target.value }),
      setCost: (e)=> this.setState({ cost: e.target.value }),
      setSup: (e)=> this.setState({ sup: e.target.value }),
      setBill: (e)=> this.setState({ bill: e.target.value.indexOf('PINV') === 0 ? 'pinv' : 'none' }) };
  }
}
