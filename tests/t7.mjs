import * as W from './worker.mjs';
let pass=0,fail=0; const ok=(c,m)=>{ if(c) pass++; else {fail++; console.log('  FAIL:',m);} };
const A = "McDonalds introduced mobile ordering through its app. The kiosks came later.";
const rung=t=>[{level:'Clear',text:t},{level:'Better',text:t},{level:'Band 6',text:t}];

console.log('--- a quotation mark is a claim, and it is checked ---');
const r = W.finalize({
  summary: 'You write "introduced mobile ordering through its app" but never say why.',
  paragraphs:[{name:'P',score:2,max:4,reasons:[{kind:'weak',text:'You say "the kiosks came later" without explaining them.'}],
    sentences:[{text:'The kiosks came later.',issues:[
      {kind:'fix',severity:'critical',head:'h',
       why:'Your sentence "the customer journey was reimagined end to end" asserts rather than shows.',
       ladder:rung('x')}]}]}],
  rubric:[], focus:{area:'A',paragraph:1,why:'You wrote "The kiosks came later" and stopped.',quote:'The kiosks came later'},
}, 4, A, null, ['a','b','c','d'], false);

ok(/"introduced mobile ordering through its app"/.test(r.summary),'a real quotation keeps its quotation marks');
ok(!/"the customer journey was reimagined end to end"/.test(r.paragraphs[0].sentences[0].issues[0].why),
   'a quotation the student never wrote loses its quotation marks: '+r.paragraphs[0].sentences[0].issues[0].why);
ok(/the customer journey was reimagined end to end/.test(r.paragraphs[0].sentences[0].issues[0].why),
   'but the point itself is kept, not deleted');
ok(/"the kiosks came later"/i.test(r.paragraphs[0].reasons[0].text),'reasons are checked too');
ok(r.checks.prose.quoted===3 && r.checks.prose.unquoted===1,'prose grounding counted: '+JSON.stringify(r.checks.prose));

console.log('--- caps applied in code, sentences never ---');
const many = { summary:'s', rubric:[], focus:{area:'A',paragraph:1,why:'w',quote:'The kiosks came later'},
  paragraphs:[{name:'P',score:1,max:4,reasons:new Array(9).fill({kind:'weak',text:'r'}),
    sentences:[{text:'The kiosks came later.',issues:new Array(9).fill({kind:'fix',severity:'should',head:'h',why:'w',ladder:rung('x')})},
               {text:'McDonalds introduced mobile ordering through its app.',issues:[]}]}]};
const r2 = W.finalize(many, 4, A, null, ['a','b','c','d'], false);
ok(r2.paragraphs[0].reasons.length===3,'reasons capped at 3: '+r2.paragraphs[0].reasons.length);
ok(r2.paragraphs[0].sentences[0].issues.length===3,'issues capped at 3: '+r2.paragraphs[0].sentences[0].issues.length);
ok(r2.paragraphs[0].sentences.length===2,'both sentences survive: '+r2.paragraphs[0].sentences.length);

console.log('--- pass 1 stays off rather than taking the app down ---');
ok(typeof W.diagnose==='function','diagnose exists');
ok(W.DIAG_SAFE===true,'the pass 1 schema passes its own score-free check');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
