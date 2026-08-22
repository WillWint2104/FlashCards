// the plain build on purpose: this suite tests the shipped defaults
const { chromium, P: T, OUT } = require('./env');
let pass=0, fail=0;
const ok=(c,m)=>{ if(c) pass++; else {fail++; console.log('  FAIL:',m);} };

// The canned worker response, in the REBUILT contract (focus + credited + checks).
const REVIEW = (marks) => ({
  summary:"You establish the target market clearly, but the second paragraph describes rather than explains.",
  total:12, max:marks, score:12,
  paragraphs:[
    { name:"Introduction", score:3, max:4, reasons:[{kind:'good',text:'States the overall relationship'}], sentences:[
      { text:"Target markets shape every element of the marketing mix.", issues:[] }]},
    { name:"Processes", score:5, max:8, reasons:[{kind:'weak',text:'Names the process but not the cause'}], sentences:[
      { text:"McDonalds introduced mobile ordering through its app.", issues:[
        { kind:'fix', severity:'critical', head:'Say why the target market caused this',
          why:'You name mobile ordering but do not say why convenience oriented customers led there.',
          ladder:[{level:'Clear',text:'Because these customers value speed, ordering moved to the app.'},{level:'Better',text:'A convenience oriented target market pushed ordering onto the app so waiting time fell.'},{level:'Band 6',text:'Because the target market prizes speed above all, the business relocated ordering to the app, cutting queue time at the point of sale.'}] }]}]},
    { name:"Physical evidence", score:4, max:8, reasons:[{kind:'weak',text:'Evidence mentioned, not used'}], sentences:[
      { text:"The restaurants now have digital kiosks.", issues:[
        { kind:'fix', severity:'should', head:'Make the kiosks do some work',
          why:'The kiosks appear as a fact and are not linked to the target market.',
          ladder:[{level:'Clear',text:'The kiosks suit customers who want to order quickly.'},{level:'Better',text:'The kiosks exist because the target market wants to order without waiting for staff.'},{level:'Band 6',text:'The kiosks translate the target market’s preference for speed into the servicescape itself.'}] }]}]},
  ],
  rubric:[
    {name:'knowledge and understanding of course content',score:3,max:5,descriptor:'What the response knows',bands:[{range:'3-4',text:'Sound knowledge',here:true}]},
    {name:'application of business case studies and contemporary business issues',score:3,max:5,descriptor:'How the case study is used',bands:[]},
    {name:'business terminology and concepts',score:3,max:5,descriptor:'Terminology',bands:[]},
    {name:'sustained, logical and cohesive response',score:3,max:5,descriptor:'Cohesion',bands:[]},
  ],
  focus:{ area:'Explanation', paragraph:2, index:1, sentence:0,
    why:'Your processes paragraph identifies mobile ordering but does not explain why the target market caused it.',
    quote:'McDonalds introduced mobile ordering through its app.' },
  credited:[{paragraph:3,argument:'the servicescape itself carries the target market',quote:'The restaurants now have digital kiosks.'}],
  checks:{passes:2,sentences:3,sentencesVerified:3,grounded:1,focusQuoted:true,diagnosis:{kept:9,dropped:2}},
  overall:{summary:'x'}, criteria:[], next_steps:[], missing_vocabulary:[],
});

(async()=>{
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:1280,height:960}});
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  let sent=null;
  await p.route('**/marginal-grader*/**', r=>r.abort());
  await p.route(/workers\.dev/, async route => {
    const req=route.request();
    sent=JSON.parse(req.postData()||'{}');
    if (sent.action==='coach') return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({nudges:[]})});
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(REVIEW(sent.marks||20))});
  });

  await p.goto(T + '?essaydemo=1&essaymark=1');
  await p.waitForTimeout(600);
  ok(!!(await p.$('#esq')),'essay setup opens');

  // ---- marks field exists and defaults sensibly
  ok(await p.$eval('#esmarks',e=>e.value)==='20','marks field defaults to 20');
  await p.fill('#esmarks','16');
  await p.fill('#esq','Explain how target markets affect e-marketing, people, processes and physical evidence.');
  await p.fill('#estopic','Marketing');
  await p.click('#esstart'); await p.waitForTimeout(400);
  ok(!!(await p.$('#esline')),'the composer opens');

  // ---- write a plan point + text on paragraph 1, then go to full attempt
  await p.fill('#espoint','Target markets shape every element of the mix.');
  await p.fill('#esline','Target markets shape every element of the marketing mix.');
  await p.click('#esaccept'); await p.waitForTimeout(300);
  await p.click('#esmodeswitch'); await p.waitForTimeout(400);
  ok(!!(await p.$('#esfull')),'full attempt screen opens');
  await p.fill('#esfull','Target markets shape every element of the marketing mix.\n\nMcDonalds introduced mobile ordering through its app.\n\nThe restaurants now have digital kiosks.');
  await p.waitForTimeout(200);
  await p.click('#essubmit'); await p.waitForTimeout(900);

  // ---- payload assertions
  ok(!!sent,'a marking request was sent');
  ok(sent && sent.marks===16,'marks from the form reach the marker: '+(sent&&sent.marks));
  ok(sent && sent.command==='Explain','directive verb detected: '+(sent&&sent.command));
  ok(sent && sent.subject==='Ancient History','subject sent: '+(sent&&sent.subject));
  ok(sent && Array.isArray(sent.criteria) && sent.criteria.length===4,'criteria sent: '+JSON.stringify(sent&&sent.criteria));
  ok(sent && Array.isArray(sent.bands) && sent.bands.length>0,'band expectations sent: '+((sent&&sent.bands)||[]).length);
  ok(sent && sent.plan && sent.plan.paragraphs.length>=3,'the plan is sent as context: '+JSON.stringify(sent&&sent.plan&&sent.plan.paragraphs[0]));
  ok(sent && sent.topic==='Marketing','topic sent');
  ok(sent && sent.answer.indexOf('mobile ordering')>0,'the exact response is sent');

  // ---- the marked result surfaces ONE next action
  const marked = await p.$('.es-marked');
  ok(!!marked,'marked result renders');
  ok((await p.$eval('.es-markscore',e=>e.textContent)).indexOf('12')===0,'score shown');
  ok((await p.$eval('.es-markarea',e=>e.textContent)).indexOf('Explanation')>=0,'main improvement area named');
  const why = await p.$eval('.es-markwhy',e=>e.textContent);
  ok(/mobile ordering/.test(why),'feedback quotes what the student wrote: '+why.slice(0,80));
  ok(!!(await p.$('#esrevise')),'revise button present');

  // ---- REVISE returns to the writing surface at that paragraph, on that line
  await p.click('#esrevise'); await p.waitForTimeout(400);
  ok(!!(await p.$('#esline')) || !!(await p.$('[data-esedit]')),'revise lands on the composer');
  const edited = await p.$('[data-esedit]');
  ok(!!edited,'and the marker\'s sentence is open as an editable block');
  const v = await p.$eval('[data-esedit]',e=>e.value);
  ok(/mobile ordering/.test(v),'it is the RIGHT sentence: '+JSON.stringify(v.slice(0,50)));

  // ---- full review, focus strip, and revise from inside it
  await p.click('#esmodeswitch'); await p.waitForTimeout(300);
  await p.click('#essubmit'); await p.waitForTimeout(900);
  await p.click('#esseemark'); await p.waitForTimeout(400);
  ok(!!(await p.$('.rv-focus')),'focus strip renders in the review');
  ok((await p.$eval('.rv-focusarea',e=>e.textContent))==='Explanation','focus area in the review');
  ok(!!(await p.$('.rv-credited')),'off-pathway credit is shown');
  const credited=await p.$eval('.rv-credited',e=>e.textContent);
  ok(/servicescape/.test(credited),'credited argument named: '+credited.slice(0,90));
  const active=await p.$eval('.rv-pmark.active',e=>e.getAttribute('data-rvpara'));
  ok(active==='1','the review opens on the focus paragraph: '+active);
  await p.click('#rvfocusgo'); await p.waitForTimeout(400);
  ok((!!(await p.$('#esline')) || !!(await p.$('[data-esedit]'))) && !(await p.$('.rv-focus')),'revise from the review closes it and returns to writing');

  console.log('pageerrors:', errs.join(' | ')||'none');
  ok(errs.length===0,'no page errors');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
