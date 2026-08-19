import worker, * as W from './worker.mjs';
let pass=0,fail=0; const ok=(c,m)=>{ if(c) pass++; else {fail++; console.log('  FAIL:',m);} };
const A = "McDonalds uses mobile ordering. It suits customers who value speed.";
const BLOCKS = [
  { id:'b1', slot:'point', paragraph:1, text:'McDonalds uses mobile ordering.' },
  { id:'b2', slot:'analysis', paragraph:1, text:'It suits customers who value speed.' },
];
const rung=t=>[{level:'Clear',text:t},{level:'Better',text:t},{level:'Band 6',text:t}];
const mkReview = targetBlockId => ({ summary:'s',
  focus:{area:'Explanation',paragraph:1,why:'w',quote:'McDonalds uses mobile ordering',targetBlockId},
  paragraphs:[{name:'P',score:2,max:4,reasons:[],sentences:[
    {text:'McDonalds uses mobile ordering.',issues:[{kind:'fix',severity:'critical',head:'h',why:'w',ladder:rung('x')}]},
    {text:'It suits customers who value speed.',issues:[]}]}],
  rubric:[] });
const DIAG={coverage:[],arguments:[],explanation:[],evidence:[],terminology:[],repetition:[],missing:[],planVsResponse:[],firstToFix:''};
async function run(target){
  const seen=[];
  globalThis.fetch=async(u,init)=>{const b=JSON.parse(init.body);seen.push(b);const n=b.tools[0].name;
    return new Response(JSON.stringify({content:[{type:'tool_use',name:n,input:n==='submit_diagnosis'?DIAG:mkReview(target)}],stop_reason:'tool_use'}),{status:200});};
  const req=new Request('https://w/',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({prompt:'Explain.',command:'Explain',marks:4,answer:A,responseType:'short',
      subject:'Business Studies',criteria:['a','b','c','d'],blocks:BLOCKS})});
  const res=await worker.fetch(req,{ANTHROPIC_API_KEY:'k'},{});
  return {out:await res.json(), seen};
}
console.log('--- the sentence list reaches the marker with its ids ---');
let r=await run('b2');
const p2=r.seen[1].messages[0].content;
ok(/SENTENCE BY SENTENCE, WITH IDS/.test(p2),'the block list is sent');
ok(/b1 \[point\] P1: McDonalds uses mobile ordering\./.test(p2),'each line carries id, slot and paragraph');
ok(/targetBlockId/.test(JSON.stringify(W.REVIEW_TOOL)),'the tool asks for a target block');

console.log('--- a real id comes back and is trusted ---');
ok(r.out.focus.targetBlockId==='b2','the id survives: '+r.out.focus.targetBlockId);
ok(r.out.checks.focusBlock===true,'and is reported in checks');

console.log('--- an invented id is dropped, never followed ---');
r=await run('b99');
ok(r.out.focus.targetBlockId==='','a block id we never sent is refused: '+JSON.stringify(r.out.focus.targetBlockId));
ok(r.out.focus.quote.length>0,'and the quote fallback still points somewhere');
ok(r.out.checks.focusBlock===false,'checks say there is no block target');

console.log('--- no blocks sent: nothing breaks ---');
{
  const seen=[];
  globalThis.fetch=async(u,init)=>{const b=JSON.parse(init.body);seen.push(b);const n=b.tools[0].name;
    return new Response(JSON.stringify({content:[{type:'tool_use',name:n,input:n==='submit_diagnosis'?DIAG:mkReview('b1')}],stop_reason:'tool_use'}),{status:200});};
  const req=new Request('https://w/',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({prompt:'Explain.',marks:4,answer:A,subject:'x',criteria:['a','b','c','d']})});
  const out=await (await worker.fetch(req,{ANTHROPIC_API_KEY:'k'},{})).json();
  ok(!/SENTENCE BY SENTENCE/.test(seen[1].messages[0].content),'no block section when none were sent');
  ok(out.focus.targetBlockId==='','and no target is claimed');
  ok(out.total>=0,'marking still works');
}
// appended: the safeguards
{
  const seen=[];
  globalThis.fetch=async(u,init)=>{const b=JSON.parse(init.body);seen.push(b);const n=b.tools[0].name;
    return new Response(JSON.stringify({content:[{type:'tool_use',name:n,input:n==='submit_diagnosis'?DIAG:mkReview('b1')}],stop_reason:'tool_use'}),{status:200});};
  const req=new Request('https://w/',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({prompt:'Explain.',marks:4,answer:A,subject:'x',criteria:['a','b','c','d'],blocks:BLOCKS})});
  await worker.fetch(req,{ANTHROPIC_API_KEY:'k'},{});
  const m=seen[1].messages[0].content;
  console.log('--- block metadata is navigation, never credit ---');
  ok(/NAVIGATION AND CONTEXT ONLY/.test(m),'the rule is stated');
  ok(/never evidence that they did it/.test(m),'intent is not achievement');
  ok(/If the sentence does not communicate it, it does not earn it/.test(m),'and the mark follows the writing');
}
{
  console.log('--- an ambiguous quotation points at no sentence ---');
  const dupAnswer='It suits customers. It suits customers.';
  const rv=W.finalize({summary:'s',rubric:[],
    focus:{area:'A',paragraph:1,why:'w',quote:'It suits customers',targetBlockId:''},
    paragraphs:[{name:'P',score:1,max:2,reasons:[],sentences:[
      {text:'It suits customers.',issues:[]},{text:'It suits customers.',issues:[]}]}]},
    2, dupAnswer, null, ['a','b','c','d'], false, 'short', []);
  ok(rv.focus.sentence===null,'two identical sentences means neither is named: '+JSON.stringify(rv.focus.sentence));
  ok(rv.focus.index===0,'but the paragraph is still where to go: '+rv.focus.index);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
