import * as W from './worker.mjs';
let pass=0,fail=0; const ok=(c,m)=>{ if(c) pass++; else {fail++; console.log('  FAIL:',m);} };

const ANSWER = "McDonalds introduced mobile ordering through its app. The kiosks were added later on.";
const IDX = W.answerIndex(ANSWER);
const PLAN = { argument: "Convenience oriented target markets reshape service processes end to end",
               paragraphs:[{role:'Body 1', point:'Explain how physical evidence signals brand positioning to customers'}] };

console.log('--- the plan cannot reach the marker through pass 1 prose ---');
const d = W.normalizeDiagnosis({
  coverage:[], terminology:[], repetition:[], missing:[
    {what:'how physical evidence signals brand positioning to customers', where:'a paragraph of its own'},
    {what:'a judgement', where:'the conclusion'}],
  arguments:[
    {paragraph:1,argument:'Convenience oriented target markets reshape service processes end to end',onPathway:true,valid:true,quote:'introduced mobile ordering through its app'},
    {paragraph:1,argument:'ordering moved to the app',onPathway:true,valid:true,quote:'introduced mobile ordering through its app'}],
  explanation:[{paragraph:2,mode:'descriptive',note:'Explain how physical evidence signals brand positioning to customers',quote:'The kiosks were added later on'}],
  evidence:[], planVsResponse:[], firstToFix:'Explain how physical evidence signals brand positioning to customers',
}, IDX, W.planProse ? W.planProse(PLAN) : (PLAN.argument+' '+PLAN.paragraphs[0].point));

ok(d.arguments.length===1 && d.arguments[0].argument==='ordering moved to the app',
   'an "argument" that just repeats the plan wording is dropped: '+JSON.stringify(d.arguments.map(a=>a.argument)));
ok(d.explanation.length===0,'a note that repeats the plan is dropped');
ok(d.missing.length===1 && d.missing[0].what==='a judgement','a missing-item that echoes the plan is dropped: '+JSON.stringify(d.missing));
ok(d.firstToFix==='','firstToFix that echoes the plan is blanked');

console.log('--- but the student\'s own words are never mistaken for an echo ---');
const PLAN2 = { argument:'introduced mobile ordering through its app', paragraphs:[] };
const d2 = W.normalizeDiagnosis({coverage:[],terminology:[],repetition:[],missing:[],evidence:[],planVsResponse:[],firstToFix:'',
  explanation:[{paragraph:1,mode:'explained',note:'introduced mobile ordering through its app is explained',quote:'introduced mobile ordering through its app'}],
  arguments:[]}, IDX, PLAN2.argument);
ok(d2.explanation.length===1,'a plan phrase the student actually wrote is not treated as an echo');

console.log('--- planVsResponse never travels to the marker ---');
const withPlan = W.normalizeDiagnosis({coverage:[{required:'processes',state:'addressed',paragraph:1,quote:'introduced mobile ordering through its app'}],
  arguments:[],explanation:[],evidence:[],terminology:[],repetition:[],missing:[],firstToFix:'',
  planVsResponse:[{planned:'a secret plan phrase nobody wrote',present:false,quote:''}]}, IDX, '');
const text = W.diagnosisText(withPlan);
ok(withPlan.planVsResponse.length===1,'planVsResponse is computed');
ok(text.indexOf('secret plan phrase')<0,'and never rendered into the marking prompt');
ok(W.DIAG_TO_PASS2.indexOf('planVsResponse')<0,'planVsResponse is not in the cleared list');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
