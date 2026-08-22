import worker, * as W from './worker.mjs';
let pass=0,fail=0; const ok=(c,m)=>{ if(c) pass++; else {fail++; console.log('  FAIL:',m);} };
const A = "McDonalds uses mobile ordering. It is popular with customers.";
const rung=t=>[{level:'Clear',text:t},{level:'Better',text:t},{level:'Band 6',text:t}];
const REVIEW = { summary:'s',
  focus:{area:'Explanation',paragraph:1,why:'w',quote:'McDonalds uses mobile ordering'},
  paragraphs:[{name:'Your answer',score:2,max:4,reasons:[],sentences:[
    {text:'McDonalds uses mobile ordering.',issues:[{kind:'fix',severity:'critical',head:'h',why:'w',ladder:rung('x')}]},
    {text:'It is popular with customers.',issues:[]}]}],
  // a well-behaved short-answer review returns no rubric
  rubric:[] };
const DIAG = {coverage:[],arguments:[],explanation:[],evidence:[],terminology:[],repetition:[],missing:[],planVsResponse:[],firstToFix:''};

async function run(body){
  const seen=[];
  globalThis.fetch = async (u,init)=>{ const b=JSON.parse(init.body); seen.push(b);
    const name=b.tools[0].name;
    return new Response(JSON.stringify({content:[{type:'tool_use',name,input: name==='submit_diagnosis'?DIAG:JSON.parse(JSON.stringify(REVIEW))}],stop_reason:'tool_use'}),{status:200}); };
  const req=new Request('https://w/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const res=await worker.fetch(req,{ANTHROPIC_API_KEY:'k'},{});
  return {out: await res.json(), seen, status: res.status};
}
const base = { prompt:'Outline ONE benefit of mobile ordering.', command:'Outline', answer:A,
  subject:'Business Studies', criteria:['a','b','c','d'],
  bands:[{range:'Band 6',text:'holds one judgement'}], bandsSource:'general HSC band expectations' };

console.log('--- a short answer is marked as a short answer ---');
let r = await run(Object.assign({}, base, {marks:2, responseType:'short', stimulus:true}));
const p2 = r.seen[1].messages[0].content, p1 = r.seen[0].messages[0].content;
ok(/RESPONSE TYPE: short answer, worth 2 marks/.test(p2),'pass 2 is told what it is marking');
ok(/not a miniature essay/.test(p2),'and told not to mark it as one');
ok(/directive verb is "Outline"/.test(p2),'the directive verb drives it: '+((/directive verb is "([^"]+)"/.exec(p2)||[])[1]||'none'));
ok(/roughly 2 distinct creditworthy things/.test(p2),'depth is set by the mark value');
ok(/A stimulus was provided/.test(p2),'a stimulus is flagged so it must actually be used');
ok(!/BAND EXPECTATIONS/.test(p2),'band expectations are not sent to a short answer');
ok(!/MARKING CRITERIA/.test(p2),'nor the four extended-response criteria');
ok(/RESPONSE TYPE: short answer/.test(p1),'pass 1 knows too');
ok(/no introduction or conclusion to be missing/.test(p1),'so it does not report a missing introduction');
ok(r.out.rubric.length===0,'no rubric comes back: '+JSON.stringify(r.out.rubric));
// the stub claims 2 of 4; on a 2-mark question that is half marks, and the
// reconciliation keeps the PROPORTION while putting it on the right scale
ok(r.out.max===2,'the denominator is the question, not the marker\'s: '+r.out.max);
ok(r.out.total===1,'and the marker\'s proportion survives the rescale: '+r.out.total+'/'+r.out.max);
ok(r.out.focus && r.out.focus.area,'a focus still comes back: '+(r.out.focus||{}).area);

console.log('--- an extended response is unchanged ---');
r = await run(Object.assign({}, base, {marks:20, responseType:'extended',
  prompt:'Explain how target markets affect the marketing mix.'}));
const e2 = r.seen[1].messages[0].content;
ok(/RESPONSE TYPE: extended response, worth 20 marks/.test(e2),'declared as extended');
ok(/BAND EXPECTATIONS/.test(e2),'band expectations are sent');
ok(/MARKING CRITERIA/.test(e2),'and the criteria');
ok(r.out.rubric.length===4,'a full rubric comes back: '+r.out.rubric.length);
ok(r.out.rubric.reduce((a,c)=>a+c.score,0)===r.out.total,'and it lands on the same mark');

console.log('--- an older client that sends no responseType is unchanged ---');
r = await run(Object.assign({}, base, {marks:20}));
ok(/RESPONSE TYPE: extended response/.test(r.seen[1].messages[0].content),'defaults to extended');
ok(r.out.rubric.length===4,'and still gets its rubric');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
