class Component extends DCLogic {
  constructor(props){ super(props); this.state = { verb: 'never' }; }
  renderVals(){
    const s = this.state, INK = '#14171B', DIM = '#8A939C';
    const V = [
      { id:'never',   title:'It never happened',     sub:'Goods I recorded that never arrived.' },
      { id:'figures', title:'The figures are wrong', sub:'The count, cost, supplier or bill.' },
      { id:'shelf',   title:'The shelf disagrees',   sub:'The record is right; the shelf differs.' }
    ];
    const verbs = V.map((v)=> ({ ...v, cls: s.verb === v.id ? 'on' : '', pick: ()=> this.setState({ verb: v.id }) }));
    let effects, cta, footNote;
    if(s.verb === 'never'){
      effects = [
        { label:'On the shelf', before:'16 Ctn', after:'0 Ctn', col: INK },
        { label:'What the stock here is worth', before:'4,960,000', after:'0', col: INK },
        { label:'What you owe Shafik Katwe', before:'nothing', after:'nothing', col: DIM }
      ];
      cta = 'Take it back off';
      footNote = 'Nothing is erased. A reversal is posted and the original row stays, marked.';
    } else if(s.verb === 'figures'){
      effects = [
        { label:'On the shelf', before:'16 Ctn', after:'16 Ctn', col: DIM },
        { label:'What the stock here is worth', before:'4,960,000', after:'4,960,000', col: DIM },
        { label:'What you owe Shafik Katwe', before:'nothing', after:'nothing', col: DIM }
      ];
      cta = 'Save the correction';
      footNote = 'Change a figure and this panel says what it does before you save.';
    } else {
      effects = [
        { label:'On the shelf', before:'16 Ctn', after:'16 Ctn', col: DIM },
        { label:'The movement log', before:'6 rows', after:'7 rows', col: INK }
      ];
      cta = 'Post the count';
      footNote = 'A count never rewrites a purchase — it is its own movement.';
    }
    return { verbs, effects, cta, footNote };
  }
}
