import * as W from './worker.mjs';
let pass=0,fail=0; const ok=(c,m)=>{ if(c) pass++; else {fail++; console.log('  FAIL:',m);} };
const CRIT=['knowledge','application','terminology','cohesion'];
const A="One two three four five. Six seven eight nine ten.";
const sent=t=>({text:t,issues:[]});
const mk=(paras,rubric,marks)=>W.finalize({summary:'s',paragraphs:paras,rubric:rubric||[],focus:{area:'A',paragraph:1,why:'w',quote:'One two three four five'}}, marks, A, null, CRIT);

console.log('--- the denominator is the question, not the marker\'s split ---');
// four paragraphs at max 6 = 24 for a 20-mark question. 22/24 must not read 20/20.
let r=mk([1,2,3,4].map(i=>({name:'P'+i,score:i===1?4:6,max:6,reasons:[],sentences:[sent('One two three four five.')]})),[],20);
ok(r.max===20,'max is the question value: '+r.max);
ok(r.paragraphs.reduce((a,p)=>a+p.max,0)===20,'paragraph maxima sum to the question: '+r.paragraphs.map(p=>p.max).join('+'));
ok(r.total===r.paragraphs.reduce((a,p)=>a+p.score,0),'total is the sum of paragraph marks: '+r.total);
ok(r.total<20 && r.total>=16,'an imperfect response is not rescaled into full marks: '+r.total+'/20');

console.log('--- a zero-max paragraph cannot swallow the question ---');
r=mk([{name:'A',score:14,max:0,reasons:[],sentences:[sent('One two three four five.')]},
      {name:'B',score:2,max:6,reasons:[],sentences:[sent('Six seven eight nine ten.')]}],[],20);
ok(r.paragraphs[0].max>0 || r.paragraphs[0].score===0,'no paragraph renders as x / 0: '+r.paragraphs.map(p=>p.score+'/'+p.max).join(' '));
ok(r.total<=20,'total within the question value: '+r.total);

console.log('--- bad marks value cannot produce NaN ---');
r=mk([{name:'A',score:3,max:4,reasons:[],sentences:[sent('One two three four five.')]}],[],'twenty');
ok(Number.isFinite(r.total) && Number.isFinite(r.max),'NaN marks never reach the student: '+r.total+'/'+r.max);
r=mk([{name:'A',score:3,max:4,reasons:[],sentences:[sent('One two three four five.')]}],[],-5);
ok(r.max>=1 && r.total>=0,'a negative mark value is clamped: '+r.total+'/'+r.max);
ok(!/NaN/.test(JSON.stringify(r)),'no NaN anywhere in the response');

console.log('--- the rubric is the same response seen again, so it lands on the same mark ---');
r=mk([{name:'A',score:6,max:10,reasons:[],sentences:[sent('One two three four five.')]},
      {name:'B',score:5,max:10,reasons:[],sentences:[sent('Six seven eight nine ten.')]}],
     [{name:'wrong name',score:9,max:9,descriptor:'d',bands:[{range:'1',text:'t',here:true},{range:'2',text:'t',here:true}]},
      {name:'another',score:9,max:9,descriptor:'d',bands:[]}], 20);
ok(r.rubric.length===4,'the rubric has one entry per criterion asked for: '+r.rubric.length);
ok(r.rubric.map(c=>c.name).join('|')===CRIT.join('|'),'and uses this subject\'s names: '+r.rubric.map(c=>c.name).join(', '));
ok(r.rubric.reduce((a,c)=>a+c.max,0)===20,'rubric maxima sum to the question: '+r.rubric.map(c=>c.max).join('+'));
ok(r.rubric.reduce((a,c)=>a+c.score,0)===r.total,'rubric marks sum to the total: '+r.rubric.map(c=>c.score).join('+')+' vs '+r.total);
ok(r.rubric[0].bands.filter(b=>b.here).length===1,'exactly one you-are-here band: '+r.rubric[0].bands.filter(b=>b.here).length);
ok(r.rubric.every(c=>c.score<=c.max),'no criterion scores above its own maximum');

console.log('--- a full-marks response still reads full marks ---');
r=mk([{name:'A',score:10,max:10,reasons:[],sentences:[sent('One two three four five.')]},
      {name:'B',score:10,max:10,reasons:[],sentences:[sent('Six seven eight nine ten.')]}],
     [{name:'knowledge',score:5,max:5,descriptor:'',bands:[]},{name:'application',score:5,max:5,descriptor:'',bands:[]},
      {name:'terminology',score:5,max:5,descriptor:'',bands:[]},{name:'cohesion',score:5,max:5,descriptor:'',bands:[]}],20);
ok(r.total===20 && r.rubric.reduce((a,c)=>a+c.score,0)===20,'20/20 survives reconciliation: '+r.total);

console.log('--- legacy criteria stay derived from the reconciled rubric ---');
ok(r.criteria.length===4 && r.criteria.every(c=>c.status==='met'),'legacy criteria: '+JSON.stringify(r.criteria.map(c=>c.status)));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
