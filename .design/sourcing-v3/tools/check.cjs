const fs=require('fs'),path=require('path');
const dir=process.argv[2];const canvas=JSON.parse(fs.readFileSync(path.join(dir,'canvas.json'),'utf8'));
const boxes={};(function f(o){if(o&&typeof o==='object')for(const[k,v]of Object.entries(o)){if(v&&typeof v==='object'&&'h'in v&&'x'in v)boxes[k]=v;else f(v)}})(canvas);
let bad=0;
for(const fn of fs.readdirSync(dir).filter(f=>f.endsWith('.dc.html'))){
  const s=fs.readFileSync(path.join(dir,fn),'utf8');
  const m=s.match(/<script type="text\/x-dc"[^>]*data-props='([^']*)'>([\s\S]*?)<\/script>/);
  const prev=JSON.parse(m[1]).$preview;const rootH=+s.match(/<x-dc>[\s\S]*?<\/helmet>\s*<div style="(?:position: relative; )?width: \d+px; height: (\d+)px/)[1];
  if(prev.height!==rootH||!boxes[fn]||boxes[fn].h!==rootH){console.log('HEIGHT',fn,rootH,prev.height,boxes[fn]&&boxes[fn].h);bad++}
  for(const r of s.matchAll(/([A-Za-z0-9]+\.dc\.html)/g)) if(!fs.existsSync(path.join(dir,r[1]))){console.log('LINK',fn,r[1]);bad++}
  class DCLogic{constructor(p){this.props=p;this.state={}}setState(u){this.state={...this.state,...(typeof u==='function'?u(this.state):u)}}}
  let C;try{C=new Function('DCLogic',m[2]+';return Component')(DCLogic)}catch(e){console.log('PARSE',fn,e.message);bad++;continue}
  const c=new C({});const walk=(v,d)=>{if(d>4||v==null)return;if(typeof v==='function'){try{v()}catch(e){console.log('HANDLER',fn,e.message);bad++}}else if(typeof v==='object')for(const x of Object.values(v))walk(x,d+1)};
  try{for(let i=0;i<3;i++)walk(c.renderVals(),0);c.renderVals()}catch(e){console.log('RENDER',fn,e.message);bad++}
}
console.log(bad?bad+' problems':'all boards OK');process.exit(bad?1:0);
