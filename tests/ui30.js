// The pathway is the lesson. A vertical slice on the three Processes pathways,
// which are the only ones with enough authored depth to judge the experience.
//
// What this has to prove, in order: the option says enough to choose and no more;
// choosing opens ONE surface, not five drawers; the learning is optional and the
// way back is there before a word is read; the relationship is visual; Try asks
// the student to USE the idea; a wrong answer gets a targeted repair and a retry,
// not the lesson again; every route lands back in the paragraph; and a student who
// knows this already never meets any of it.
const { chromium, T, OUT } = require('./env');
let pass=0,fail=0; const ok=(c,m)=>{ if(c) pass++; else {fail++; console.log('  FAIL:',m);} };
async function open(p){
  await p.goto(T); await p.waitForTimeout(650);
  await p.evaluate(()=>localStorage.removeItem('marginal.essay.v1'));
  await p.goto(T); await p.waitForTimeout(650);
  await p.$$eval('.navtab',es=>{const t=es.find(x=>/Essay practice/i.test(x.textContent));t&&t.click();});
  await p.waitForTimeout(400);
  await p.selectOption('#essubject','business_studies'); await p.waitForTimeout(200);
  await p.$$eval('.es-qchip',es=>{const t=es.find(x=>/target markets affect/i.test(x.textContent));t&&t.click();});
  await p.click('#esstart'); await p.waitForTimeout(700);
}
const text=(p,sel)=>p.$eval(sel,e=>e.innerText.replace(/\s+/g,' ').trim()).catch(()=>'');
const all=(p,sel)=>p.$$eval(sel,es=>es.map(e=>e.innerText.replace(/\s+/g,' ').trim())).catch(()=>[]);
const count=(p,sel)=>p.$$eval(sel,es=>es.length).catch(()=>0);
async function toProcesses(p){
  await p.$$eval('.es-startrow',es=>{const t=es.find(x=>/Body 3/.test(x.textContent));t&&t.click();});
  await p.waitForTimeout(650);
}
(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1500,height:1050},deviceScaleFactor:2})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  let calls=0; await p.route(/workers\.dev/, r=>{calls++;r.abort();});

  console.log('1. the option says enough to choose, and no more');
  await open(p);
  await toProcesses(p);
  const subs=await all(p,'[data-espath] .es-picksub');
  console.log('   ',JSON.stringify(subs[0]));
  ok(subs.length>=3,'each processes option carries a line about itself: '+subs.length);
  ok(subs.every(s=>s.length<=170),'each is short enough to compare at a glance: '+Math.max(...subs.map(s=>s.length)));
  ok(subs.every(s=>(s.match(/[.!?]/g)||[]).length<=1),'and is one sentence');
  const choice=await text(p,'.es-setup');
  ok(!/servicescape/i.test(choice),'the choice surface does not introduce terminology it has not explained');
  ok(!/systems a customer moves through/i.test(choice),'nor the formal definition, which belongs after the choice');
  ok(!(await p.$('.es-lesson')),'and no lesson is open before anything has been chosen');
  await p.screenshot({path:OUT+'shot-lesson-choice.png'});

  console.log('2. choosing opens one surface, and does not force it');
  await p.$$eval('[data-espath]',es=>{const t=es.find(x=>/pr-convenience/.test(x.dataset.espath)); t&&t.click();});
  await p.waitForTimeout(480);
  ok(!(await p.$('.es-lesson')),'choosing an argument does not drop the student into a lesson');
  ok(!!(await p.$('#esstartwriting')),'writing is right there');
  ok(!!(await p.$('#eslessonopen')),'and so is the way in, if they want it');
  await p.click('#eslessonopen'); await p.waitForTimeout(500);
  ok((await count(p,'.es-lesson'))===1,'one surface opens');
  ok((await count(p,'.es-drawer'))===0,'and not a stack of drawers');
  const lesson=await text(p,'.es-lesson');
  ok(/know/i.test(lesson)&&/see/i.test(lesson)&&/try/i.test(lesson),'know, see and try are all on it at once');
  ok(/systems a customer moves through/i.test(lesson),'the definition is here, where it was chosen for');
  await p.screenshot({path:OUT+'shot-lesson.png'});

  console.log('3. the way back is there before a word has been read');
  ok((await count(p,'[data-eslessonuse]'))>=1,'a route into the paragraph is on the surface from the start');
  const firstBtn=await text(p,'.es-lessonh');
  ok(/use this in my paragraph/i.test(firstBtn),'at the top, above everything: '+firstBtn.slice(0,70));
  ok(!!(await p.$('#eslessonback')),'and a plain way back as well');

  console.log('4. the relationship is visual, and authored');
  const steps=await all(p,'.es-chainstep');
  console.log('   ',JSON.stringify(steps));
  ok(steps.length===4,'the chain has the authored number of steps: '+steps.length);
  ok(steps[0]===steps[0].toLowerCase().slice(0,1)+steps[0].slice(1),'the steps read as fragments in a chain');
  ok(/convenience/i.test(steps[0])&&/experience/i.test(steps[steps.length-1]),'running from what the customer values to what it achieves');
  const contrast=await text(p,'.es-contrast');
  ok(/processes/i.test(contrast)&&/people/i.test(contrast),'the two elements most easily confused are set beside each other: '+contrast.slice(0,80));
  const ex=await text(p,'.es-lesson .es-lessonsec:nth-of-type(3)');
  ok(!/mcdonald/i.test(await text(p,'.es-lesson')),'and the worked example is deliberately somewhere else');

  console.log('5. try asks the student to use the idea, not to recall it');
  const tryText=await text(p,'.es-lessonsec.try');
  console.log('   ',tryText.slice(0,120));
  ok(!/what is the definition|what does .* mean/i.test(tryText),'it is not a definition question');
  ok(/ordering takes too long/i.test(tryText),'it is a situation to act on');
  ok((await count(p,'[data-estry]'))===3,'with three ways to answer');

  console.log('6. a wrong answer is repaired, and repaired specifically');
  await p.$$eval('[data-estry]',es=>es[1]&&es[1].click()); await p.waitForTimeout(430);
  const repair1=await text(p,'.es-tryrepair');
  console.log('   ',repair1.slice(0,130));
  ok(!!repair1,'a wrong answer says something');
  ok(/advertising changes promotion/i.test(repair1),'and says what THAT answer got wrong, not what the lesson said');
  ok(repair1.length<300,'in one line, not the lesson again: '+repair1.length+' chars');
  ok(!!(await p.$('#estryagain')),'with a retry');
  ok((await count(p,'.es-lesson'))===1,'and without leaving the surface');
  await p.click('#estryagain'); await p.waitForTimeout(400);
  ok(!(await p.$('.es-tryrepair')),'retrying clears the repair');
  await p.$$eval('[data-estry]',es=>es[2]&&es[2].click()); await p.waitForTimeout(430);
  const repair2=await text(p,'.es-tryrepair');
  ok(repair2!==repair1,'a different wrong answer gets a different repair');
  ok(/physical evidence/i.test(repair2),'aimed at that mistake: '+repair2.slice(0,80));

  console.log('7. a right answer says why, and hands them straight back');
  await p.click('#estryagain'); await p.waitForTimeout(400);
  await p.$$eval('[data-estry]',es=>es[0]&&es[0].click()); await p.waitForTimeout(430);
  const right=await text(p,'.es-tryright');
  console.log('   ',right.slice(0,120));
  ok(/ordering is a step the customer moves through/i.test(right),'it says why that answer was right');
  ok(/use it in my paragraph/i.test(right),'and the next thing offered is the paragraph');
  await p.$$eval('[data-eslessonuse]',es=>es[es.length-1]&&es[es.length-1].click());
  await p.waitForTimeout(560);
  ok(!(await p.$('.es-lesson')),'taking it closes the lesson');
  ok(!!(await p.$('#esline')),'and lands on the writing line, not a menu');
  await p.fill('#esline','Customers who want less effort push McDonald’s to take steps out of ordering.');
  await p.click('#esaccept'); await p.waitForTimeout(420);
  ok(/take steps out of ordering/.test(await text(p,'.es-prose')),'writing continues from there');

  console.log('8. it stays reachable, and every route out lands in the paragraph');
  ok(!!(await p.$('[data-eslessonchip]')),'the lesson is one press away while writing');
  await p.click('[data-eslessonchip]'); await p.waitForTimeout(500);
  ok(!!(await p.$('.es-lesson')),'and reopens');
  await p.click('#eslessonback'); await p.waitForTimeout(520);
  ok(!(await p.$('.es-lesson'))&&!!(await p.$('#esline')),'Back returns to the paragraph too, not to the setup card');
  ok(/take steps out of ordering/.test(await text(p,'.es-prose')),'with the sentence still there');

  console.log('9. a student who knows this never meets any of it');
  await open(p);
  await toProcesses(p);
  await p.$$eval('[data-espath]',es=>{const t=es.find(x=>/pr-speed/.test(x.dataset.espath)); t&&t.click();});
  await p.waitForTimeout(460);
  await p.click('#esstartwriting'); await p.waitForTimeout(500);
  ok(!(await p.$('.es-lesson')),'straight past the lesson');
  ok(!!(await p.$('#esline')),'straight to the line');
  await p.fill('#esline','Customers expecting speed push the business to move a step out of the queue.');
  await p.click('#esaccept'); await p.waitForTimeout(420);
  ok((await count(p,'.es-lesson'))===0,'and it never appears uninvited');
  const seen=await text(p,'.es-compose');
  ok(!/systems a customer moves through/i.test(seen),'none of the teaching was put in front of them');

  console.log('10. each of the three pathways is its own lesson');
  await open(p); await toProcesses(p);
  const lessons=[];
  for (const id of ['pr-convenience','pr-speed','pr-customisation']) {
    await p.$$eval('[data-espath]',(es,x)=>{const t=es.find(e=>e.dataset.espath.indexOf(x)>=0); t&&t.click();}, id);
    await p.waitForTimeout(430);
    await p.click('#eslessonopen'); await p.waitForTimeout(460);
    lessons.push({id, know: await text(p,'.es-lessonp'), steps: (await all(p,'.es-chainstep')).length,
                  prompt: (await text(p,'.es-lessonsec.try')).slice(0,60)});
    await p.click('#eslessonback'); await p.waitForTimeout(420);
    await p.click('#esbackarg').catch(()=>{}); await p.waitForTimeout(420);
  }
  lessons.forEach(l=>console.log('   ',l.id,'|',l.steps,'steps |',l.prompt.slice(0,52)));
  ok(new Set(lessons.map(l=>l.know)).size===3,'three different explanations');
  ok(new Set(lessons.map(l=>l.prompt)).size===3,'three different things to try');
  ok(lessons.every(l=>l.steps>=3),'and a chain on each');

  ok(calls===0,'no model calls anywhere: nothing here is generated: '+calls);
  console.log('pageerrors:',errs.join(' | ')||'none');
  ok(errs.length===0,'no page errors');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
