/* The category list at this shop's real scale: 17 categories, 64
   sub-categories, 39 of them under one name. Click a row to work on it. */
class Component extends DCLogic {
  constructor(props){
    super(props);
    this.state = { open: 0 };
  }
  cats(){
    return [
      {n:'Furniture', subs:['Drawer Runners','Drawer Locks','Hinges','Sofa Legs','Wall Plugs','Silicone','Bow Saw','Brackets','Cable Outlets','Casters','Chrome Pipes','Curtain Pipe','Door Handles','Bits','Engines','Sealants','Hack Saw','Jack Planer','Brushes','Machines','Sand Papers','Spanners','Spray Gun','Stains','Staple wires','Tape Measure','Wrapping Films','Corner Tape','Gate Latch','Tools','Adhesive','Weighing Scales','Jig Saw','Sanding Sealer','chains','Hammers','Stands','Lipping','Drawer Handles'],
       dup:['Hinges','Wall Plugs'],
       note:'39 of this shop’s 64 sub-categories sit under this one name, and at least 21 of them are tools or consumables rather than furniture — Bow Saw, Hack Saw, Jack Planer, Spanners, Hammers, Spray Gun, Tape Measure, Weighing Scales, Jig Saw, Sand Papers, Adhesive, Sealants, Silicone, Stains, Sanding Sealer, chains, Machines, Engines, Brushes, Bits and Tools. This is where a word goes when nobody picks a category.'},
      {n:'Fasteners', subs:['Drywall','Chipboard','Clamps','Truss Head','Concrete Nails','Self Drilling','Wood Screws','Nuts','Threaded Bar','Panel Pin','Hooks','Anchor Bolts','Washer'], dup:[], note:''},
      {n:'Welding', subs:['Window Rollers','Expansion Bolts','Cutting Disc','Door Roller','Patta'], dup:[], note:''},
      {n:'Gypsum', subs:['Joint Tapes','Channels','Boards','Gypsum Filler','Wall Plugs'], dup:['Channels','Wall Plugs'], note:''},
      {n:'Bolts & Nuts', subs:['Bolts'], dup:[], note:''},
      {n:'Aluminum', subs:['Channels'], dup:['Channels'], note:''},
      {n:'Plumbing', subs:[], dup:[], note:''},
      {n:'Handles', subs:[], dup:[],
       note:'Nothing under it — while Furniture holds Door Handles and Drawer Handles. Either those two belong here, or this name does not need to exist.'},
      {n:'Locks', subs:[], dup:[],
       note:'Nothing under it — while Furniture holds Drawer Locks.'},
      {n:'Hinges', subs:[], dup:[],
       note:'Nothing under it — and Hinges is ALSO a sub-category of Furniture. The same word in two places, which is the one thing a suggestion list cannot survive.'},
      {n:'Runners', subs:[], dup:[],
       note:'Nothing under it — while Furniture holds Drawer Runners.'},
      {n:'Curtain Fittings', subs:[], dup:[],
       note:'Nothing under it — while Furniture holds Curtain Pipe.'},
      {n:'Fittings', subs:[], dup:[], note:''},
      {n:'Door Hardware', subs:[], dup:[], note:''}
    ];
  }
  renderVals(){
    const open = this.state.open;
    const rows = this.cats().map((c, i) => ({
      name: c.n,
      n: c.subs.length ? String(c.subs.length) : '—',
      nCls: c.subs.length ? 'cr-s' : 'cr-s zero',
      cls: open === i ? 'cr is-open' : 'cr',
      isOpen: open === i,
      note: c.note,
      hasNote: !!c.note,
      hasSubs: c.subs.length > 0,
      subs: c.subs.map((s) => ({
        label: s,
        cls: c.dup.indexOf(s) !== -1 ? 'wc dup' : 'wc'
      })),
      toggle: () => this.setState({ open: open === i ? null : i })
    }));
    return { rows: rows };
  }
}
