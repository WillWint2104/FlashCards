import * as W from './worker.mjs';
let pass=0,fail=0; const ok=(c,m)=>{ if(c) pass++; else {fail++; console.log('  FAIL:',m);} };

const ANSWER = `McDonalds targets convenience oriented customers, so its processes are built around speed. The business introduced mobile ordering through its app, which cut queue time at the counter.

The restaurants now have digital ordering kiosks. McDonalds is a large business.`;

console.log('--- pass 1 cannot score (module-load assertion) ---');
// Exercise the shipped walk rather than restating what the schema happens to
// contain. The old checks here could not fail: a property access cannot throw,
// and comparing "there is a number" to "the word paragraph appears" is true for
// any schema that has both, including one with a mark in it.
ok(typeof W.assertScoreFree==='function','the score-free walk is exported');
const clone=()=>JSON.parse(JSON.stringify(W.DIAG_TOOL.input_schema));
const refuses=(mutate,why)=>{ const sc=clone(); mutate(sc); let m='';
  try { W.assertScoreFree(sc); } catch(e){ m=String(e.message||e); }
  ok(m.indexOf('could score')>=0, why+': '+(m||'DID NOT THROW')); };
refuses(sc=>{ sc.properties.score={type:'number'}; },'a top-level numeric score is refused');
refuses(sc=>{ sc.properties.tier={type:'integer'}; },'a numeric field under any other name is refused');
refuses(sc=>{ sc.properties.evidence.items.properties.mark={type:'string'}; },'a mark-shaped property name is refused');
refuses(sc=>{ sc.properties.evidence.items.properties.use.enum=['band 4'];},'a mark-like enum is refused');
// and the shipped schema itself passes that same walk
let live=''; try { W.assertScoreFree(clone()); } catch(e){ live=String(e.message||e); }
ok(!live,'the shipped pass 1 schema passes its own walk: '+(live||'clean'));
// the schema itself must contain no mark-shaped field
const j=JSON.stringify(W.DIAG_TOOL.input_schema);
ok(!/"(score|marks?|bands?|grade|total|points)"\s*:/.test(j),'no mark-shaped property in the pass 1 schema');
const names=[]; (function walk(n){ if(!n||typeof n!=='object')return; if(n.properties) for(const k in n.properties){ names.push(k); walk(n.properties[k]); } if(n.items) walk(n.items); })(W.DIAG_TOOL.input_schema);
ok(!names.some(k=>/ladder|example|rewrite|suggest|model|starter/i.test(k)),'no pass 1 field can hold a model sentence: '+names.join(','));

console.log('--- fact and claim never in the same record ---');
const mk=(quote,claimQuote,para)=>W.normalizeDiagnosis({coverage:[],arguments:[],explanation:[],terminology:[],repetition:[],missing:[],planVsResponse:[],firstToFix:'',
  evidence:[{paragraph:para||1,use:'used',note:'n',quote,claimQuote}]}, ANSWER).evidence[0];
const distinct = mk('introduced mobile ordering through its app','which cut queue time at the counter');
ok(distinct.use==='used','distinct fact and claim counts as used: '+distinct.use);
const same = mk('introduced mobile ordering through its app','introduced mobile ordering through its app');
ok(same.use==='mentioned' && same.claimQuote==='','same words for both is only mentioned: '+same.use);
const overlapping = mk('The business introduced mobile ordering through its app','mobile ordering through its app which cut queue time');
ok(overlapping.use==='mentioned','overlapping spans are only mentioned: '+overlapping.use);
const noClaim = mk('The restaurants now have digital ordering kiosks','',2);
ok(noClaim.use==='mentioned','a bare fact is only mentioned: '+noClaim.use);
const fake = mk('introduced mobile ordering through its app','which proves the target market caused every change');
ok(fake.use==='mentioned','a fabricated claim quote does not upgrade it: '+fake.use);

console.log('--- an observation must quote the paragraph it names ---');
ok(mk('The restaurants now have digital ordering kiosks','',1)===undefined,
   'a quote from paragraph 2 attributed to paragraph 1 is rejected');
ok(mk('The restaurants now have digital ordering kiosks','',2)!==undefined,
   'and the same quote attributed correctly is kept');

console.log('--- circuit breaker ---');
const rows=(n,good)=>Array.from({length:n},(_,i)=>({paragraph:1,argument:'a',onPathway:true,valid:true,
  quote: good? 'its processes are built around speed' : 'a sentence number '+i+' the student never wrote here'}));
const trusted=W.normalizeDiagnosis({coverage:[],arguments:rows(8,true),explanation:[],evidence:[],terminology:[],repetition:[],missing:[],planVsResponse:[],firstToFix:''},ANSWER);
ok(trusted.arguments.length===8 && !trusted.verified.discarded,'a well grounded diagnosis is kept');
const bad=W.normalizeDiagnosis({coverage:[],arguments:rows(4,true).concat(rows(6,false)),explanation:[],evidence:[],terminology:[],repetition:[],missing:[],planVsResponse:[],firstToFix:''},ANSWER);
ok(bad.verified.discarded===true && !bad.coverage,'a diagnosis that invents 6 of 10 quotes is discarded whole');
ok(W.diagnosisText(bad).indexOf('not available')>=0,'a discarded diagnosis reads as absent to the marker');

console.log('--- off-pathway credit is counted in code ---');
const off=W.normalizeDiagnosis({coverage:[],explanation:[],evidence:[],terminology:[],repetition:[],missing:[],planVsResponse:[],firstToFix:'',
  arguments:[{paragraph:1,argument:'speed',onPathway:true,valid:true,quote:'its processes are built around speed'},
             {paragraph:2,argument:'servicescape',onPathway:false,valid:true,quote:'The restaurants now have digital ordering kiosks'},
             {paragraph:2,argument:'size matters',onPathway:false,valid:false,quote:'McDonalds is a large business'}]},ANSWER);
const msg=W.pass2Message({subject:'Business Studies',criteria:['a','b','c','d'],bands:[],marks:20,prompt:'q',diagnosis:W.diagnosisText(off),offPathway:2,response:'r'});
ok(/2 ARGUMENTS THAT OUR MATERIALS DID NOT ANTICIPATE/.test(msg),'the credit rule is injected when it applies');
const msg0=W.pass2Message({subject:'x',criteria:['a','b','c','d'],bands:[],marks:20,prompt:'q',diagnosis:'d',offPathway:0,response:'r'});
ok(!/DID NOT ANTICIPATE/.test(msg0),'and stays out when it does not apply');
ok(/silence is not a fault/.test(msg0),'the standing rules are always injected');
ok(/judge only what they wrote/.test(msg0),'intent never counts as evidence');

console.log('--- focus survives truncation by being early ---');
const props=Object.keys(W.REVIEW_TOOL.input_schema.properties);
ok(props.indexOf('focus')<props.indexOf('paragraphs') && props.indexOf('focus')<props.indexOf('rubric'),'focus is emitted before paragraphs and rubric: '+props.join(','));
ok(W.REVIEW_TOOL.input_schema.properties.paragraphs.items.properties.sentences.maxItems===undefined,'sentences are never capped, the UI rebuilds the paragraph from them');
const CAP=W.REVIEW_TOOL.input_schema.properties.paragraphs.items.properties.sentences.items.properties.issues.maxItems;
ok(CAP===2,'issues are capped in the schema: '+CAP);
// and capped in code, because maxItems is guidance to the model, not a rule the
// API enforces. Reading the constant alone left the two free to drift apart.
const over=W.normalizeReview({marks:{total:10},paragraphs:[{name:'Body 1',sentences:[{text:'x',issues:[
  {kind:'fix',severity:'should',head:'one',why:'w'},
  {kind:'fix',severity:'should',head:'two',why:'w'},
  {kind:'fix',severity:'should',head:'three',why:'w'}]}]}]});
const kept=(((over.paragraphs||[])[0]||{}).sentences||[])[0];
ok(!!kept&&kept.issues.length===CAP,'and capped in code to the same number: '+((kept&&kept.issues.length)||'no sentence'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
