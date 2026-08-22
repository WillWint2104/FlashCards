import * as W from './worker.mjs';
let pass=0,fail=0; const ok=(c,m)=>{ if(c) pass++; else {fail++; console.log('  FAIL:',m);} };

console.log('--- deDash, by rule ---');
const d=W.deDash;
ok(d("a cost–benefit analysis")==="a cost-benefit analysis",'en dash between word chars is a hyphen: '+d("a cost–benefit analysis"));
ok(d("e‑marketing and e–commerce")==="e-marketing and e-commerce",'non-breaking and en hyphens: '+d("e‑marketing and e–commerce"));
ok(d("Bands 3–4 and 2019–20")==="Bands 3-4 and 2019-20",'numeric ranges keep hyphens: '+d("Bands 3–4 and 2019–20"));
ok(d("Strong work — keep going")==="Strong work, keep going",'spaced em dash becomes a comma: '+d("Strong work — keep going"));
ok(d("Strong, — keep going")==="Strong, keep going",'no doubled comma: '+JSON.stringify(d("Strong, — keep going")));
ok(d("— leading")==="leading" && d("trailing —")==="trailing",'leading and trailing dashes drop');
ok(d("2019--20")==="2019-20",'double hyphen between digits is a range: '+d("2019--20"));
ok(d("well-argued")==="well-argued" && d("no dashes here")==="no dashes here",'untouched text is untouched');
ok(d("minus −5 degrees")==="minus -5 degrees",'minus sign is a minus: '+d("minus −5 degrees"));

console.log('--- the review shows the student their OWN words ---');
const ANSWER = "McDonald's targets convenience-oriented customers, so its processes are built around speed. The kiosks were added later.";
const IDX = W.answerIndex(ANSWER);
const rv = { paragraphs:[{ sentences:[
  { text:"McDonalds targets convenience oriented customers so its processes are built around speed", issues:[] },   // paraphrased punctuation
  { text:"The kiosks were added later.", issues:[] },
  { text:"The student demonstrates a sophisticated grasp of the servicescape.", issues:[] },                        // never written
  { text:null, link:true, missing_label:'a link', issues:[] },
]}]};
const snap = W.snapSentences(rv, IDX);
ok(rv.paragraphs[0].sentences[0].text==="McDonald's targets convenience-oriented customers, so its processes are built around speed",
   'a lightly altered sentence is snapped back to the exact characters typed: '+JSON.stringify(rv.paragraphs[0].sentences[0].text));
ok(rv.paragraphs[0].sentences[2].unplaced===true,'a sentence the student never wrote is flagged unplaced');
ok(snap.total===3 && snap.snapped===2 && snap.unplaced===1,'snap counters: '+JSON.stringify(snap));
ok(rv.paragraphs[0].sentences[3].unplaced===undefined,'a missing-sentence slot is not counted');
ok(ANSWER.indexOf(rv.paragraphs[0].sentences[0].text)>=0,'the snapped text is a literal substring of the response');

console.log('--- focus quote is snapped too ---');
const r2 = W.finalize({ summary:'s',
  paragraphs:[{name:'P',score:2,max:4,reasons:[],sentences:[{text:"The kiosks were added later.",issues:[
    {kind:'fix',severity:'critical',head:'h',why:'w',ladder:[{level:'Clear',text:'a'},{level:'Better',text:'b'},{level:'Band 6',text:'c'}]}]}]}],
  rubric:[], focus:{area:'Explanation',paragraph:1,why:'w',quote:'targets convenience oriented customers so its processes'} }, 4, ANSWER, null);
ok(ANSWER.indexOf(r2.focus.quote)>=0,'focus quote is the student\'s literal text: '+JSON.stringify(r2.focus.quote));
ok(r2.checks.sentencesUnplaced===0,'checks report unplaced sentences');

// appended: literal-text guarantees added after the design critique
{
  const A2 = "McDonald's targets convenience-oriented customers, so its processes are built around speed, and the app now carries most orders because those customers will not queue for a counter that they can bypass entirely with a phone they already hold in their hand while they walk toward the store.";
  const I2 = W.answerIndex(A2);
  const d = W.normalizeDiagnosis({coverage:[],explanation:[],terminology:[],repetition:[],missing:[],planVsResponse:[],firstToFix:'',evidence:[],
    arguments:[{paragraph:1,argument:'a',onPathway:false,valid:true,quote:'McDonalds targets convenience oriented customers'}]}, I2, '');
  ok(A2.indexOf(d.arguments[0].quote)>=0,'a diagnosis quote is snapped to literal text: '+JSON.stringify(d.arguments[0].quote));
  const rv2={paragraphs:[{sentences:[{text:A2,issues:[]}]}]};
  const s2=W.snapSentences(rv2,I2);
  ok(s2.unplaced===0,'a long run-on sentence still locates: '+JSON.stringify(s2));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail?1:0);
}
