// the plain build on purpose: this suite tests the shipped defaults
const { chromium, P: T, OUT, usePractice, pageTo } = require('./env');

// Waits that name their condition. This app fetches nothing and renders
// synchronously, so the effect of a click is present on the next frame:
// settled() is that frame, not a shorter guess at a duration.
const settled = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const here = (p, sel) => p.waitForSelector(sel, { timeout: 8000 });
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
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1280,height:960}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  let sent=null;
  await p.route(/workers\.dev/, async route => {
    const s=JSON.parse(route.request().postData()||'{}');
    if (s.action==='coach') return route.fulfill({status:200,contentType:'application/json',body:'{"nudges":[]}'});
    sent=s; await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(REVIEW)});
  });
  await p.goto(T+'?essaydemo=1&essaymark=1');
  await settled(p);

  // ---- pick an AUTHORED question: its definition must travel with the response
  await usePractice(p);
  const chip = await p.$('.qp-row');
  ok(!!chip,'authored question chips are offered');
  // BY ID, not by index. "the second Ancient History question" stopped being
  // ah-religion when the list started sorting by topic and paginating at ten, and
  // an index that quietly points at a different question makes every assertion
  // below about a question this suite did not mean to choose.
  await pageTo(p, '.qp-row[data-esq="ah-religion"]');
  await p.click('.qp-row[data-esq="ah-religion"]'); await settled(p);
  // Choosing a practice question no longer types it into a box: the box only
  // exists for a question the student brings. It is stated back to them instead,
  // and the id is what travels with the response. Choosing SELECTS the row and
  // fills the rail; the preview is the next step and is where the whole question
  // is stated. Same property, one screen along, and .es-chosenq is gone.
  const qtext = await p.evaluate(() => {
    const c = document.querySelector('.qp-rcq');
    const on = document.querySelector('.qp-row.on');
    return { shown: c ? c.textContent : '', id: on ? on.dataset.esq : null };
  });
  ok(/religious beliefs/.test(qtext.shown),'the chosen question is stated back: '+JSON.stringify(qtext.shown.slice(0,50)));
  ok(!!qtext.id,'and the row is marked as the chosen one: '+qtext.id);
  await p.click('[data-espick="preview"]');
  await here(p, '#esstart');
  await p.click('#esstart');
  await p.waitForFunction(() => !!document.querySelector('#esline, .es-startrow, [data-espath]'), null, { timeout: 8000 });

  // ---- coached mode: write the intro, SKIP the next slot, write the one after.
  // An empty middle slot is never submitted, so the marker's "paragraph 2" is the
  // student's third slot. This is the case that a naive index mapping gets wrong.
  await p.fill('#esline','Target markets shape the mix.');
  await p.click('#esaccept'); await settled(p);
  await nextSection(p);
  const emptySlot = await p.$eval('.es-pararole',e=>e.textContent.trim()).catch(()=>'');
  const emptyText = await p.$eval('#esline',e=>e.value).catch(()=>null);
  await nextSection(p);
  const skipped = await p.$eval('.es-pararole',e=>e.textContent.trim()).catch(()=>'');
  await p.fill('#esline','Overall the target market drives the strategy.');
  await p.click('#esaccept'); await settled(p);
  await settled(p);
  await p.click('#esmodeswitch'); await settled(p);
  await p.click('#essubmit'); await settled(p);
  ok(!!skipped&&!!emptySlot&&skipped!==emptySlot&&emptyText==='',
     'wrote into slot 1 and slot 3, leaving slot 2 empty (now on '+skipped+', skipped '+emptySlot+')');

  // The typed topic field is gone, so a PRACTICE question has to supply its own.
  // ui.js holds the other half: a question the student types carries none.
  ok(sent && typeof sent.topic === 'string' && sent.topic.length > 0,
     'the chosen question carried its authored topic into marking, with nobody typing one: '+JSON.stringify(sent&&sent.topic));
  ok(sent && sent.requirements && sent.requirements.relationships.length>0,
     'the picked question\'s requirements reach the marker: '+JSON.stringify(sent&&sent.requirements&&sent.requirements.concepts));
  ok(sent && sent.requirements.syllabus.length>0,'syllabus scope sent');
  ok(sent && sent.bandsSource==='general HSC band expectations','band source sent: '+(sent&&sent.bandsSource));
  ok(sent && sent.bands.length===6,'six general bands sent: '+((sent&&sent.bands)||[]).length);
  ok(sent && sent.answer.split(/\n\s*\n/).length===2,'only the written paragraphs are submitted: '+(sent&&sent.answer.split(/\n\s*\n/).length));

  // ---- revise must land on the paragraph the student actually wrote SECOND
  await p.click('#esrevise'); await settled(p);
  // page.$eval REJECTS when the selector matches nothing, so the old `||`
  // fallback could never run: a revise landing on a finished paragraph killed
  // the suite instead of failing this line.
  const v = (await p.$eval('[data-esedit], #esline',e=>e.value).catch(()=>'')) ||
            (await p.$eval('.es-prose',e=>e.textContent).catch(()=>''));
  ok(/Overall the target market/.test(v),'revise lands on the right slot despite the empty middle: '+String(v).slice(0,60));
  const role = await p.$eval('.es-pararole',e=>e.textContent.trim()).catch(()=>'');
  ok(role===skipped,'and it is the slot the student wrote in, not the skipped one: landed on '+role+', skipped slot was '+skipped);

  console.log('pageerrors:', errs.join(' | ')||'none');
  ok(errs.length===0,'no page errors');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
