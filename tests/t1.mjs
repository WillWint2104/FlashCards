import * as W from './worker.mjs';
let pass=0, fail=0;
const ok=(c,m)=>{ if(c){pass++;} else {fail++; console.log('  FAIL:',m);} };

const ANSWER = `McDonald's targets convenience oriented customers, so its processes are built around speed. The business introduced mobile ordering through its app, which lets customers order before they arrive. This reduces waiting time at the counter and suits customers who value speed above all else.

Physical evidence at McDonald's has been redesigned. The restaurants now include digital ordering kiosks and separate collection points. McDonald's is a large business.`;

console.log('--- deDash ---');
ok(W.deDash("This is good — but not great.")==="This is good, but not great.", 'em dash to comma: '+W.deDash("This is good — but not great."));
ok(W.deDash("Bands 1-2 stay hyphenated")==="Bands 1-2 stay hyphenated", 'hyphen untouched');
ok(W.deDash("The figure rose in 2019–20 sharply")==="The figure rose in 2019-20 sharply", 'numeric en range: '+W.deDash("The figure rose in 2019–20 sharply"));
ok(W.deDash("well-argued and cost-effective")==="well-argued and cost-effective", 'hyphenated words');
ok(W.deDash("Strong — yes.")==="Strong, yes.", 'trailing: '+W.deDash("Strong — yes."));
ok(W.deDash("— leading dash")==="leading dash", 'leading: '+JSON.stringify(W.deDash("— leading dash")));
ok(W.deDash("one, — two")==="one, two", 'no double comma: '+JSON.stringify(W.deDash("one, — two")));
ok(W.deDash("Ends with a dash —")==="Ends with a dash", 'trailing dash: '+JSON.stringify(W.deDash("Ends with a dash —")));
ok(W.deDash("a -- b")==="a, b", 'double hyphen: '+JSON.stringify(W.deDash("a -- b")));
ok(W.deDash(null)===null && W.deDash(7)===7, 'non-strings pass through');

console.log('--- verifyQuote ---');
const IDX = W.answerIndex(ANSWER);
ok(W.verifyQuote(IDX,"introduced mobile ordering through its app")===true,'exact run');
ok(W.verifyQuote(IDX,"Introduced Mobile Ordering Through Its App")===true,'case insensitive');
ok(W.verifyQuote(IDX,"introduced mobile ordering through its app,")===true,'trailing punctuation');
ok(W.verifyQuote(IDX,"McDonald’s targets convenience oriented customers")===true,'curly apostrophe');
ok(W.verifyQuote(IDX,"reduces waiting time")===true,'3-word exact run');
ok(W.verifyQuote(IDX,"the student explains the causal link clearly")===false,'fabricated quote rejected');
ok(W.verifyQuote(IDX,"your explanation could be more detailed")===false,'generic phrase rejected');
ok(W.verifyQuote(IDX,"")===false && W.verifyQuote(IDX,"speed")===false,'too short rejected');
ok(W.verifyQuote(IDX,"The business introduced mobile ordering through its app which lets customers order")===true,'light elision inside the window is tolerated');
ok(W.verifyQuote(IDX,"[2] Physical evidence at McDonald's has been redesigned")===true,'a quote copied with its paragraph marker still verifies');
ok(W.verifyQuote(IDX,"in the response")===false,'an all-function-word quote is not evidence');
ok(W.verifyQuote(IDX,ANSWER+" "+ANSWER)===false,'an over-long quote is not a pointer');
ok(W.verifyQuote(IDX,"processes speed mobile ordering app reduces waiting counter customers value")===false,'words stitched from across the answer are rejected');
ok(W.verifyQuote(IDX,"processes speed mobile app collection kiosks digital")===false,'scattered words across the whole answer rejected');

console.log('--- pass2 allowlist ---');
let threw=false;
try { W.pass2Message({subject:'x',criteria:['a','b','c','d'],marks:20,prompt:'q',plan:{argument:'leak'},response:'r',diagnosis:'d'}); } catch(e){ threw=/leak/.test(e.message); }
ok(threw,'plan in pass 2 payload throws');
ok(W.PASS2_FIELDS.indexOf('plan')<0 && W.PASS2_FIELDS.indexOf('validContent')<0,'plan and validContent are not allowlisted');
const msg = W.pass2Message({subject:'Business Studies',criteria:['a','b','c','d'],bands:[{range:'Band 6',text:'t'}],bandsSource:'general HSC band expectations',command:'Explain',marks:20,prompt:'Q?',topic:'Marketing',requirements:{concepts:['processes'],relationships:['target market to processes'],accomplish:['show cause and effect'],syllabus:'Marketing'},reference:'ref',vocab:['processes'],scaffold:'1. x',faults:'(none provided)',diagnosis:'DIAG HERE',response:'[1] para'});
ok(/DIAG HERE/.test(msg) && /Business Studies/.test(msg) && !/leak/.test(msg),'pass 2 message assembles');

console.log('--- normalizeDiagnosis: plan cannot fake presence ---');
const d = W.normalizeDiagnosis({
  coverage:[{required:'processes',state:'addressed',paragraph:1,quote:'its processes are built around speed'},
            {required:'people',state:'addressed',paragraph:1,quote:'the student clearly explains the people element'}],
  arguments:[{paragraph:1,argument:'convenience drives process design',onPathway:true,valid:true,quote:'built around speed'},
             {paragraph:2,argument:'physical evidence redesigned for self service',onPathway:false,valid:true,quote:'digital ordering kiosks and separate collection points'}],
  explanation:[{paragraph:2,level:'descriptive',note:'lists a feature',quote:'McDonald\'s is a large business'}],
  evidence:[{paragraph:1,use:'used',note:'shows the link',quote:'lets customers order before they arrive'}],
  terminology:[{term:'processes',accurate:true,note:'used correctly',quote:'its processes are built around speed'}],
  repetition:[],
  missing:[{what:'people',where:'a paragraph of its own'}],
  planVsResponse:[{planned:'explain people',present:true,quote:'the student covers people thoroughly'},
                  {planned:'explain processes',present:true,quote:'its processes are built around speed'}],
  firstToFix:'the second paragraph',
}, ANSWER);
ok(d.coverage.length===1,'unverifiable coverage row dropped ('+d.coverage.length+')');
ok(d.planVsResponse[0].present===false && d.planVsResponse[0].quote==='','planned-but-unwritten forced to absent');
ok(d.planVsResponse[1].present===true,'planned-and-written stays present');
ok(d.verified.dropped>=1 && d.verified.kept>=4,'verified counters '+JSON.stringify(d.verified));
ok(/argument of the student's own: credit it in full/.test(W.diagnosisText(d)),'off-pathway argument flagged for credit');
ok(!/one of ours|pathway|our list/i.test(W.diagnosisText(d)),'the marker is never told a canonical answer set exists');
ok(W.diagnosisText(null).length>0,'null diagnosis renders a fallback line');

console.log('--- markingInput bounds ---');
const mi = W.markingInput({topic:'x'.repeat(500), bands:new Array(30).fill({range:'r',text:'t'}), requirements:{concepts:new Array(50).fill('c')}, plan:{argument:'a',paragraphs:[{role:'Intro',point:'p',evidence:['e']}]}, validContent:{pathways:[{area:'processes',argument:'arg'}]}});
ok(mi.topic.length===120,'topic bounded');
ok(mi.bands.length===8,'bands capped');
ok(mi.requirements.concepts.length===12,'concepts capped');
ok(mi.plan.paragraphs.length===1 && mi.validContent.pathways.length===1,'plan and pathways read');
ok(W.markingInput(null).bands.length===0,'null body is safe');
ok(W.markingInput({}).plan.paragraphs.length===0,'empty body is safe');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
