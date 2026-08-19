import * as W from './worker.mjs';
let pass=0,fail=0; const ok=(c,m)=>{ if(c) pass++; else {fail++; console.log('  FAIL:',m);} };

const ANSWER = `McDonald's targets convenience oriented customers, so its processes are built around speed. The business introduced mobile ordering through its app.

Physical evidence has been redesigned with digital kiosks. McDonald's is a large business.`;
const rung=(t)=>[{level:'Clear',text:t},{level:'Better',text:t},{level:'Band 6',text:t}];
const review = {
  summary: "A clear start — but the second paragraph describes rather than explains.",
  paragraphs: [
    { name:'Processes', score:6, max:8, reasons:[{kind:'good',text:'Names the target market'},{kind:'weak',text:'Does not say why speed followed'}],
      sentences:[
        { text:"McDonald's targets convenience oriented customers, so its processes are built around speed.", issues:[] },
        { text:"The business introduced mobile ordering through its app.", issues:[
          { kind:'fix', severity:'critical', head:'Say why the target market caused this', why:'You name mobile ordering — but not why convenience oriented customers led to it.', ladder:rung('Because these customers value speed, the business moved ordering to the app.') }]},
        { text:null, link:true, missing_label:'a link back to the question', issues:[
          { kind:'fix', severity:'should', head:'Tie it back', why:'The paragraph stops without answering the question.', ladder:rung('This shows the target market shaped the process.') }]},
      ]},
    { name:'Physical evidence', score:3, max:8, reasons:[{kind:'weak',text:'Describes the change without explaining it'}],
      sentences:[
        { text:"Physical evidence has been redesigned with digital kiosks.", issues:[] },
        { text:"McDonald's is a large business.", issues:[
          { kind:'fix', severity:'critical', head:'This sentence does no work', why:'Being large is not evidence about physical evidence.', ladder:rung('The kiosks show the target market shaped the servicescape.') }]},
      ]},
  ],
  rubric:[
    {name:'knowledge and understanding of course content',score:3,max:5,descriptor:'d',bands:[{range:'1-2',text:'a',here:false},{range:'3-4',text:'b',here:true}]},
    {name:'application of business case studies and contemporary business issues',score:2,max:5,descriptor:'d',bands:[]},
    {name:'business terminology and concepts',score:2,max:3,descriptor:'d',bands:[]},
    {name:'sustained, logical and cohesive response',score:2,max:3,descriptor:'d',bands:[]},
  ],
  focus: { area:'Explanation', paragraph:2, why:"Your physical evidence paragraph names the kiosks — but never says why the target market led there.", quote:"Physical evidence has been redesigned with digital kiosks." },
};
const diag = W.normalizeDiagnosis({
  coverage:[], explanation:[], evidence:[], terminology:[], repetition:[], missing:[], planVsResponse:[], firstToFix:'paragraph 2',
  arguments:[{paragraph:2,argument:'servicescape redesign follows the target market',onPathway:false,valid:true,quote:'Physical evidence has been redesigned with digital kiosks'},
             {paragraph:1,argument:'speed driven processes',onPathway:true,valid:true,quote:'its processes are built around speed'}],
}, ANSWER);

const r = W.finalize(JSON.parse(JSON.stringify(review)), 16, ANSWER, diag, null, true);

console.log('--- focus ---');
ok(r.focus.index===1 && r.focus.paragraph===2, 'focus paragraph 1-based and 0-based: '+JSON.stringify({p:r.focus.paragraph,i:r.focus.index}));
ok(r.focus.sentence===0, 'focus locates the sentence: '+r.focus.sentence);
ok(r.focus.quote.length>0 && r.checks.focusQuoted, 'focus quote verified');
ok(!/—/.test(r.focus.why), 'focus why de-dashed: '+r.focus.why);

console.log('--- focus fallback ---');
const noFocus = JSON.parse(JSON.stringify(review)); delete noFocus.focus;
const r2 = W.finalize(noFocus, 16, ANSWER, null);
ok(r2.focus && r2.focus.index>=0 && r2.focus.area, 'derived focus when the model omitted it: '+JSON.stringify(r2.focus.area));
ok(r2.checks.passes===1, 'passes reports 1 when the diagnosis failed');
const badFocus = JSON.parse(JSON.stringify(review)); badFocus.focus={area:'X',paragraph:99,why:'w',quote:'a sentence the student never wrote at all'};
const r3 = W.finalize(badFocus, 16, ANSWER, null);
ok(r3.focus.index>=0 && r3.focus.index<2, 'out-of-range paragraph clamped to a real one: '+r3.focus.index);
ok(r3.focus.quote!=='a sentence the student never wrote at all', 'fabricated focus quote replaced');

console.log('--- credited ---');
ok(r.credited.length===1 && r.credited[0].paragraph===2, 'off-pathway valid argument credited: '+JSON.stringify(r.credited));
const noPaths = W.finalize(JSON.parse(JSON.stringify(review)), 16, ANSWER, diag, null, false);
ok(noPaths.credited.length===0, 'nothing is "off the list" when there was no list: '+JSON.stringify(noPaths.credited));

console.log('--- grounding + dashes ---');
ok(r.checks.sentences===4 && r.checks.sentencesVerified===4, 'sentence grounding: '+JSON.stringify(r.checks));
ok(r.checks.grounded===1, 'grounded ratio 1');
ok(!/—/.test(JSON.stringify({s:r.summary,p:r.paragraphs.map(p=>p.sentences.map(x=>x.issues))})), 'no em-dash in our writing');
ok(r.summary==="A clear start, but the second paragraph describes rather than explains.", 'summary de-dashed: '+r.summary);

console.log('--- students own words preserved ---');
const dashy = JSON.parse(JSON.stringify(review));
dashy.paragraphs[0].sentences[0].text = "I wrote this — with a dash.";
const r4 = W.finalize(dashy, 16, ANSWER, null);
ok(r4.paragraphs[0].sentences[0].text==="I wrote this — with a dash.", 'the students own sentence is not edited: '+r4.paragraphs[0].sentences[0].text);

console.log('--- marks arithmetic ---');
ok(r.total===9 && r.max===16 && r.score===9, 'total is the sum of paragraph marks: '+r.total);
const over = JSON.parse(JSON.stringify(review)); over.paragraphs[0].score=99;
const r5 = W.finalize(over, 16, ANSWER, null);
ok(r5.total<=16 && r5.paragraphs[0].score<=8, 'runaway paragraph mark clamped: '+r5.total+' / '+r5.paragraphs[0].score);

console.log('--- legacy contract survives ---');
ok(Array.isArray(r.criteria) && r.criteria.length===4 && r.overall && typeof r.overall.summary==='string', 'legacy fields still derived');
ok(Array.isArray(r.next_steps) && r.next_steps.length>0, 'next_steps derived: '+JSON.stringify(r.next_steps));
ok(r.paragraphs[0].sentences[1].issues[0].ladder.length===3, 'ladder still 3 rungs');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
