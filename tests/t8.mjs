import worker, * as W from './worker.mjs';
let pass=0,fail=0; const ok=(c,m)=>{ if(c) pass++; else {fail++; console.log('  FAIL:',m);} };

const ANSWER = `McDonalds targets convenience oriented customers, so its processes are built around speed. The business introduced mobile ordering through its app.

The restaurants now have digital ordering kiosks. McDonalds is a large business.`;

const DIAG = { coverage:[{required:'processes',state:'addressed',paragraph:1,quote:'its processes are built around speed'}],
  arguments:[{paragraph:2,argument:'the servicescape carries the target market',onPathway:false,valid:true,quote:'The restaurants now have digital ordering kiosks'}],
  explanation:[{paragraph:2,mode:'descriptive',note:'lists a feature',quote:'McDonalds is a large business'}],
  evidence:[{paragraph:1,use:'used',note:'shows the link',quote:'introduced mobile ordering through its app',claimQuote:'its processes are built around speed'}],
  terminology:[{term:'processes',accurate:true,note:'ok',quote:'its processes are built around speed'}],
  repetition:[], missing:[{what:'a judgement',where:'the conclusion'}],
  planVsResponse:[{planned:'explain people',present:true,quote:'a sentence never written'}], firstToFix:'paragraph 2' };
const rung=t=>[{level:'Clear',text:t},{level:'Better',text:t},{level:'Band 6',text:t}];
const REVIEW = { summary:'Clear start, thin second paragraph.',
  focus:{area:'Explanation',paragraph:2,why:'Your second paragraph names the kiosks but does not say why.',quote:'The restaurants now have digital ordering kiosks'},
  paragraphs:[
    {name:'Processes',score:6,max:10,reasons:[{kind:'good',text:'Names the target market'}],sentences:[
      {text:'McDonalds targets convenience oriented customers, so its processes are built around speed.',issues:[]},
      {text:'The business introduced mobile ordering through its app.',issues:[{kind:'fix',severity:'critical',head:'Say why',why:'You name it, you do not explain it.',ladder:rung('Because they value speed, ordering moved to the app.')}]}]},
    {name:'Physical evidence',score:3,max:10,reasons:[],sentences:[
      {text:'The restaurants now have digital ordering kiosks.',issues:[]},
      {text:'McDonalds is a large business.',issues:[{kind:'fix',severity:'should',head:'Does no work',why:'Being large says nothing here.',ladder:rung('The kiosks show the target market shaped the space.')}]}]}],
  rubric:[{name:'knowledge and understanding of course content',score:3,max:5,descriptor:'d',bands:[{range:'3-4',text:'t',here:true}]},
          {name:'application of relevant evidence or examples',score:2,max:5,descriptor:'d',bands:[]},
          {name:'subject terminology and concepts',score:2,max:5,descriptor:'d',bands:[]},
          {name:'sustained, logical and cohesive response',score:2,max:5,descriptor:'d',bands:[]}] };

const seen=[];
globalThis.fetch = async (url, init) => {
  const body=JSON.parse(init.body); seen.push(body);
  const name = body.tools[0].name;
  const input = name==='submit_diagnosis' ? DIAG : JSON.parse(JSON.stringify(REVIEW));
  return new Response(JSON.stringify({content:[{type:'tool_use',name,input}],stop_reason:'tool_use'}),{status:200});
};

const REQBODY = {
  prompt:'Explain how target markets affect processes and physical evidence.', command:'Explain', marks:20, answer:ANSWER,
  subject:'Business Studies', criteria:['knowledge and understanding of course content','application of relevant evidence or examples','subject terminology and concepts','sustained, logical and cohesive response'],
  bands:[{range:'Band 6',text:'holds one judgement throughout'}], bandsSource:'general HSC band expectations',
  topic:'Marketing', requirements:{concepts:['processes'],relationships:['target market to processes'],accomplish:['show cause and effect'],syllabus:'Marketing'},
  validContent:{pathways:[{area:'processes',argument:'convenience drives faster ordering'}]},
  plan:{argument:'Target markets shape every element.',paragraphs:[{role:'Body 1',point:'Explain how people are recruited and trained for service quality'}]},
  model_answer:'A strong response links each element back to the target market.',
};
const mkReq = () => new Request('https://w/', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(REQBODY)});
const req = mkReq();
const res = await worker.fetch(req, {ANTHROPIC_API_KEY:'k'}, {});
const out = await res.json();

console.log('--- two passes actually ran ---');
ok(seen.length===2,'two upstream calls: '+seen.length);
ok(seen[0].tools[0].name==='submit_diagnosis' && seen[1].tools[0].name==='submit_review','diagnose then judge');
ok(out.checks.passes===2,'the response says it was marked in two passes');

console.log('--- the plan went to pass 1 and nowhere else ---');
const p1 = seen[0].messages[0].content, p2 = seen[1].messages[0].content;
ok(/Explain how people are recruited and trained/.test(p1),'pass 1 sees the plan');
ok(!/Explain how people are recruited and trained/.test(p2),'pass 2 never sees the plan');
ok(/convenience drives faster ordering/.test(p1),'pass 1 sees our argument pathways');
ok(!/convenience drives faster ordering/.test(p2),'pass 2 never sees them');
ok(!/PLAN/.test(p2),'the word plan does not appear in the marking prompt');

console.log('--- pass 2 gets the question, the criteria, the bands and the diagnosis ---');
ok(/SUBJECT: Business Studies/.test(p2),'subject');
ok(/MARKING CRITERIA/.test(p2) && /subject terminology and concepts/.test(p2),'criteria by name');
ok(/BAND EXPECTATIONS \(general HSC band expectations\)/.test(p2),'band expectations with their source');
ok(/WHAT THIS QUESTION REQUIRES/.test(p2) && /target market to processes/.test(p2),'question requirements');
ok(/DIAGNOSIS OF THIS RESPONSE/.test(p2) && /its processes are built around speed/.test(p2),'the verified diagnosis');
ok(/silence is not a fault/.test(p2),'the standing rules');
ok(/1 ARGUMENT THAT OUR MATERIALS DID NOT ANTICIPATE/.test(p2),'the credit rule, because a pathway list was supplied');
ok(/STUDENT RESPONSE \(numbered paragraphs\)/.test(p2) && /\[2\] The restaurants/.test(p2),'the exact response, numbered');

console.log('--- what came back ---');
ok(out.total===9 && out.max===20,'total is the sum of paragraph marks on the question scale: '+out.total+'/'+out.max);
ok(out.rubric.reduce((a,c)=>a+c.score,0)===out.total,'the rubric lands on the same mark');
ok(out.focus.index===1 && out.focus.area==='Explanation','focus points at the second paragraph');
ok(ANSWER.indexOf(out.focus.quote)>=0,'focus quotes the student literally');
ok(out.credited.length===1 && /servicescape/.test(out.credited[0].argument),'the off-list argument is credited: '+JSON.stringify(out.credited[0].argument));
ok(out.diagnosis.planVsResponse[0].present===false,'a planned item claimed present without a real quote is forced absent');
ok(out.checks.grounded===1,'every marked sentence is the student\'s own: '+JSON.stringify(out.checks));
ok(Array.isArray(out.criteria) && out.next_steps.length>0,'the legacy fields the current sheet reads are still derived');

console.log('--- pass 1 failing does not stop marking ---');
seen.length=0;
let n=0;
globalThis.fetch = async (url, init) => {
  const body=JSON.parse(init.body); seen.push(body); n++;
  if (n===1) return new Response('upstream boom',{status:500});
  return new Response(JSON.stringify({content:[{type:'tool_use',name:'submit_review',input:JSON.parse(JSON.stringify(REVIEW))}],stop_reason:'tool_use'}),{status:200});
};
const res2 = await worker.fetch(mkReq(), {ANTHROPIC_API_KEY:'k'}, {});
const out2 = await res2.json();
ok(res2.status===200 && out2.total>0,'marking still returns when the diagnosis fails: '+res2.status);
ok(out2.checks.passes===1,'and says it was single pass');
ok(/not available for this response/.test(seen[1].messages[0].content),'the marker is told the diagnosis is absent');

console.log('--- a truncated review is refused, never shown as a low mark ---');
globalThis.fetch = async (url, init) => {
  const body=JSON.parse(init.body);
  if (body.tools[0].name==='submit_diagnosis') return new Response(JSON.stringify({content:[{type:'tool_use',name:'submit_diagnosis',input:DIAG}],stop_reason:'tool_use'}),{status:200});
  const cut = JSON.parse(JSON.stringify(REVIEW)); cut.paragraphs = [cut.paragraphs[0]];
  return new Response(JSON.stringify({content:[{type:'tool_use',name:'submit_review',input:cut}],stop_reason:'max_tokens'}),{status:200});
};
const res3 = await worker.fetch(mkReq(), {ANTHROPIC_API_KEY:'k'}, {});
ok(res3.status===502,'a review cut off half way is refused: '+res3.status);
ok(/cut off/.test((await res3.json()).error),'with a message the app can show');

console.log('--- a bad mark value is refused up front ---');
const bad = new Request('https://w/',{method:'POST',headers:{'content-type':'application/json'},
  body: JSON.stringify({prompt:'q',marks:'twenty',answer:ANSWER})});
const res4 = await worker.fetch(bad,{ANTHROPIC_API_KEY:'k'},{});
ok(res4.status===400,'non-numeric marks rejected: '+res4.status);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
