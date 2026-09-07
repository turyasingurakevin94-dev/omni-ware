class Component extends DCLogic {
  renderVals(){
    return {
      today: [
        { screen:'Inventory', acts:['Receive more of this','Correct the count','Correct the cost','Set a restock floor','Override the price rule'] },
        { screen:'Movements', acts:['Edit — on purchase rows only'] },
        { screen:'Purchase invoices', acts:['Correct it','Void','Undo the delivery'] },
        { screen:'Orders', acts:['Undo receipt','Un-invoice'] }
      ],
      mv: [
        { date:'2026-08-28', type:'Restock', delta:'+16', dir:'up', note:'Purchased from Shafik Katwe @ 310,000 UGX per Ctn' },
        { date:'2026-08-22', type:'Sold',    delta:'−1', dir:'dn', note:'Quote for Rebbeca' },
        { date:'2026-08-19', type:'Restock', delta:'+2',  dir:'up', note:'Purchased from Jeff Kenyos @ 310,000 UGX per Ctn' }
      ]
    };
  }
}
