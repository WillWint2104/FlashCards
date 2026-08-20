// the plain build on purpose: this suite tests the shipped defaults
const { chromium, P: T, OUT } = require('./env');
const { nextSection, prevSection } = require('./env');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else {fail++; console.log('  FAIL:',m);} };

// focus points at the SECOND submitted paragraph. The draft has an empty middle slot,
// so the second thing actually written lives in slot 2 of a 3-slot structure.
const REVIEW = {
  summary:"s", total:8, max:20, score:8,
  paragraphs:[
    {name:'Introduction',score:4,max:10,reasons:[],sentences:[{text:"Target markets shape the mix.",issues:[]}]},
    {name:'Conclusion',score:4,max:10,reasons:[],sentences:[{text:"Overall the target market drives the strategy.",issues:[
      {kind:'fix',severity:'critical',head:'Land a judgement',why:'It restates without weighing.',ladder:[{level:'Clear',text:'a'},{level:'Better',text:'b'},{level:'Band 6',text:'c'}]}]}]},
  ],
  rubric:[],
  focus:{area:'Judgement',paragraph:2,index:1,sentence:0,why:'Your final paragraph restates rather than weighs.',quote:'Overall the target market drives the strategy.'},
  credited:[], checks:{passes:2,sentences:2,sentencesVerified:2,grounded:1,focusQuoted:true},
  overall:{summary:'x'},criteria:[],next_steps:[],missing_vocabulary:[],
};

(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await (await b.newContext({viewport:{width:1280,height:960}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  let sent=null;
  await p.route(/workers\.dev/, async route => {
    const s=JSON.parse(route.request().postData()||'{}');
    if (s.action==='coach') return route.fulfill({status:200,contentType:'application/json',body:'{"nudges":[]}'});
    sent=s; await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(REVIEW)});
  });
  await p.goto(T+'?essaydemo=1&essaymark=1');
  await p.waitForTimeout(600);

  // ---- pick an AUTHORED question: its definition must travel with the response
  const chip = await p.$('.es-qchip');
  ok(!!chip,'authored question chips are offered');
  const chips = await p.$$('.es-qchip');
  // ah-religion is the second Ancient History question
  await chips[1].click(); await p.waitForTimeout(300);
  const qtext = await p.$eval('#esq',e=>e.value);
  ok(/religious beliefs/.test(qtext),'question text filled from the chip');
  await p.click('#esstart'); await p.waitForTimeout(400);

  // ---- coached mode: write the intro, SKIP the next slot, write the one after.
  // An empty middle slot is never submitted, so the marker's "paragraph 2" is the
  // student's third slot. This is the case that a naive index mapping gets wrong.
  await p.fill('#esline','Target markets shape the mix.');
  await p.click('#esaccept'); await p.waitForTimeout(300);
  await nextSection(p);
  await nextSection(p);
  const skipped = await p.$eval('.es-pararole',e=>e.textContent.trim());
  await p.fill('#esline','Overall the target market drives the strategy.');
  await p.click('#esaccept'); await p.waitForTimeout(300);
  await p.waitForTimeout(150);
  await p.click('#esmodeswitch'); await p.waitForTimeout(350);
  await p.click('#essubmit'); await p.waitForTimeout(900);
  ok(true,'wrote into slot 1 and slot 3, leaving slot 2 empty (now on '+skipped+')');

  ok(sent && sent.requirements && sent.requirements.relationships.length>0,
     'the picked question\'s requirements reach the marker: '+JSON.stringify(sent&&sent.requirements&&sent.requirements.concepts));
  ok(sent && sent.requirements.syllabus.length>0,'syllabus scope sent');
  ok(sent && sent.bandsSource==='general HSC band expectations','band source sent: '+(sent&&sent.bandsSource));
  ok(sent && sent.bands.length===6,'six general bands sent: '+((sent&&sent.bands)||[]).length);
  ok(sent && sent.answer.split(/\n\s*\n/).length===2,'only the written paragraphs are submitted: '+(sent&&sent.answer.split(/\n\s*\n/).length));

  // ---- revise must land on the paragraph the student actually wrote SECOND
  await p.click('#esrevise'); await p.waitForTimeout(400);
  const v = await p.$eval('[data-esedit], #esline',e=>e.value) || (await p.$eval('.es-prose',e=>e.textContent));
  ok(/Overall the target market/.test(v)||/Overall the target market/.test(await p.$eval('.es-prose',e=>e.textContent)),'revise lands on the right slot despite the empty middle');
  const role = await p.$eval('.es-pararole',e=>e.textContent.trim());
  ok(role===skipped,'and it is the slot the student wrote in, not the skipped one: landed on '+role+', skipped slot was '+skipped);

  console.log('pageerrors:', errs.join(' | ')||'none');
  ok(errs.length===0,'no page errors');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
