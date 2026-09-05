// The pathway is the lesson. A vertical slice on the three Processes pathways,
// which are the only ones with enough authored depth to judge the experience.
//
// What this has to prove, in order: the option says enough to choose and no more;
// choosing opens ONE surface, not five drawers; the learning is optional and the
// way back is there before a word is read; the relationship is visual; Try asks
// the student to USE the idea; a wrong answer gets a targeted repair and a retry,
// not the lesson again; every route lands back in the paragraph; and a student who
// knows this already never meets any of it.
const { chromium, T, OUT, usePractice, chooseQuestion } = require('./env');

// Waits that name what they are waiting for. The app renders synchronously and
// fetches nothing, so a click's effect is present on the next frame: settled() is
// that frame, not a guess at a duration. Where a specific thing should appear or
// go, the wait says so instead.
const settled = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const here = (p, sel) => p.waitForSelector(sel, { timeout: 8000 });
const gone = (p, sel) => p.waitForFunction(s => !document.querySelector(s), sel, { timeout: 8000 });
let pass=0,fail=0; const ok=(c,m)=>{ if(c) pass++; else {fail++; console.log('  FAIL:',m);} };
async function open(p){
  await p.goto(T); await here(p, '.navtab');
  await p.evaluate(()=>localStorage.removeItem('marginal.essay.v1'));
  await p.goto(T); await here(p, '.navtab');
  await p.$$eval('.navtab',es=>{const t=es.find(x=>/Essay practice/i.test(x.textContent));t&&t.click();});
  await here(p, '#essubject');
  await p.selectOption('#essubject','business_studies'); await settled(p);
  await chooseQuestion(p, /target markets affect/i);
  await p.click('#esstart');
  await p.waitForFunction(() => !!document.querySelector('#esline, .es-startrow, [data-espath]'), null, { timeout: 8000 });
}
const text=(p,sel)=>p.$eval(sel,e=>e.innerText.replace(/\s+/g,' ').trim()).catch(()=>'');
const all=(p,sel)=>p.$$eval(sel,es=>es.map(e=>e.innerText.replace(/\s+/g,' ').trim())).catch(()=>[]);
const count=(p,sel)=>p.$$eval(sel,es=>es.length).catch(()=>0);
async function toProcesses(p){
  await p.$$eval('.es-startrow',es=>{const t=es.find(x=>/Body 3/.test(x.textContent));t&&t.click();});
  await settled(p);
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
  await settled(p);
  ok(!(await p.$('.es-lesson')),'choosing an argument does not drop the student into a lesson');
  ok(!!(await p.$('#esstartwriting')),'writing is right there');
  ok(!!(await p.$('#eslessonopen')),'and so is the way in, if they want it');
  await p.click('#eslessonopen'); await here(p, '.es-lesson, .esl-panel');
  ok((await count(p,'.es-lesson'))===1,'one surface opens');
  ok((await count(p,'.es-drawer'))===0,'and not a stack of drawers');
  const lesson=await text(p,'.es-lesson');
  // it reads as one flow, not as four labelled pedagogical modes
  ok(!/\bknow\b\s*$/im.test(lesson)&&!/^\s*see\s*$/im.test(lesson)&&!/^\s*explore\s*$/im.test(lesson),
    'the instructional framework is not shown to the student as headings');
  ok(!!(await p.$('.es-lessonp.lead'))&&!!(await p.$('.es-chain'))&&!!(await p.$('.es-lessonsec.try')),
    'but the explanation, the relationship and the check are all on the one surface');
  ok(/systems a customer moves through/i.test(lesson),'the definition is here, where it was chosen for');
  await p.screenshot({path:OUT+'shot-lesson.png'});

  console.log('3. the paragraph stays visible, and the way back is at the top');
  const ctx=await text(p,'.es-lessonctx');
  console.log('   ',ctx.slice(0,140));
  ok(/body 3/i.test(ctx)&&/processes/i.test(ctx),'the strip says which paragraph and which part of the question');
  ok(/wanting less effort/i.test(ctx),'and which argument they chose');
  ok(/return to my/i.test(ctx),'with the way back named for the component they came from: '+(ctx.match(/return to my [a-z ]+/i)||[])[0]);
  ok((await count(p,'[data-eslessonuse]'))>=1,'a route into the paragraph is on the surface from the start');

  console.log('3b. the reading before the next action is short');
  const beforeTry=await p.evaluate(()=>{
    const t=document.querySelector('.es-lessonsec.try'); if(!t) return -1;
    let n=0; for (const el of document.querySelectorAll('.es-lesson > *')) {
      if (el===t) break;
      n += el.innerText.trim().split(/\s+/).filter(Boolean).length;
    }
    return n;
  });
  console.log('    words before the check:',beforeTry);
  ok(beforeTry>0&&beforeTry<=150,'the student reaches something to do after '+beforeTry+' words, not the whole resource');
  ok(!(await p.$('.es-contrast')),'the contrast is not in the way');
  ok(!/cinema/i.test(await text(p,'.es-lesson')),'and neither is the worked example');
  ok(!!(await p.$('#eslessonmore')),'both are one quiet press away');

  console.log('4. the relationship is visual, and authored');
  const steps=await all(p,'.es-chainstep');
  console.log('   ',JSON.stringify(steps));
  ok(steps.length===4,'the chain has the authored number of steps: '+steps.length);
  ok(steps[0]===steps[0].toLowerCase().slice(0,1)+steps[0].slice(1),'the steps read as fragments in a chain');
  ok(/convenience/i.test(steps[0])&&/experience/i.test(steps[steps.length-1]),'running from what the customer values to what it achieves');
  const chainAt=await p.evaluate(()=>{
    const k=[...document.querySelectorAll('.es-lesson > *')];
    return { chain:k.findIndex(e=>e.classList.contains('es-chain')), lead:k.findIndex(e=>e.classList.contains('lead')),
             tryAt:k.findIndex(e=>e.classList.contains('try')) };
  });
  ok(chainAt.lead<chainAt.chain&&chainAt.chain<chainAt.tryAt,'and it sits between the explanation and the check: '+JSON.stringify(chainAt));

  console.log('4b. the deeper material is secondary, and reachable');
  await p.click('#eslessonmore'); await settled(p);
  const contrast=await text(p,'.es-contrast');
  ok(/processes/i.test(contrast)&&/people/i.test(contrast),'the two elements most easily confused are set beside each other: '+contrast.slice(0,80));
  ok(/cinema/i.test(await text(p,'.es-lessonmore')),'the worked example is deliberately somewhere else');
  ok(!/mcdonald/i.test(await text(p,'.es-lesson')),'never the business they are writing about');
  await p.click('#eslessonmore'); await settled(p);
  ok(!(await p.$('.es-contrast')),'and it folds away again');

  console.log('4c. a student coming back can jump to the part they need');
  const jumps=await all(p,'[data-esjump]');
  console.log('   ',JSON.stringify(jumps));
  ok(jumps.length===3,'three shortcuts into the same page: '+jumps.length);
  await p.$$eval('[data-esjump]',es=>{const t=es.find(x=>x.dataset.esjump==='connection'); t&&t.click();});
  await settled(p);
  ok(!!(await p.$('.es-chain.focus')),'the connection shortcut points at the relationship');
  await p.$$eval('[data-esjump]',es=>{const t=es.find(x=>x.dataset.esjump==='example'); t&&t.click();});
  await settled(p);
  ok(/cinema/i.test(await text(p,'.es-lessonmore')),'and the example shortcut opens the example');
  await p.$$eval('[data-esjump]',es=>{const t=es.find(x=>x.dataset.esjump==='example'); t&&t.click();});
  await settled(p);

  console.log('5. try asks the student to use the idea, not to recall it');
  const tryText=await text(p,'.es-lessonsec.try');
  console.log('   ',tryText.slice(0,120));
  ok(!/what is the definition|what does .* mean/i.test(tryText),'it is not a definition question');
  ok(/ordering takes too long/i.test(tryText),'it is a situation to act on');
  ok((await count(p,'[data-estry]'))===3,'with three ways to answer');

  console.log('6. a wrong answer is repaired, and repaired specifically');
  await p.$$eval('[data-estry]',es=>es[1]&&es[1].click()); await settled(p);
  const repair1=await text(p,'.es-tryrepair');
  console.log('   ',repair1.slice(0,130));
  ok(!!repair1,'a wrong answer says something');
  ok(/advertising changes promotion/i.test(repair1),'and says what THAT answer got wrong, not what the lesson said');
  ok(repair1.length<300,'in one line, not the lesson again: '+repair1.length+' chars');
  ok(!!(await p.$('#estryagain')),'with a retry');
  ok((await count(p,'.es-lesson'))===1,'and without leaving the surface');
  await p.click('#estryagain'); await settled(p);
  ok(!(await p.$('.es-tryrepair')),'retrying clears the repair');
  await p.$$eval('[data-estry]',es=>es[2]&&es[2].click()); await settled(p);
  const repair2=await text(p,'.es-tryrepair');
  ok(repair2!==repair1,'a different wrong answer gets a different repair');
  ok(/physical evidence/i.test(repair2),'aimed at that mistake: '+repair2.slice(0,80));

  console.log('7. a right answer says why, and hands them straight back');
  await p.click('#estryagain'); await settled(p);
  await p.$$eval('[data-estry]',es=>es[0]&&es[0].click()); await settled(p);
  const right=await text(p,'.es-tryright');
  console.log('   ',right.slice(0,140));
  ok(/you have got the relationship/i.test(right),'success is named');
  ok(/ordering is a step the customer moves through/i.test(right),'and it says why that answer was right');
  ok(/use this in my/i.test(right),'the next thing offered is the writing');
  ok(!/use this in my paragraph\b/i.test(right),'named for the component they were on, not "the paragraph": '+(right.match(/use this in my [a-z ]+/i)||[])[0]);
  await p.$$eval('[data-eslessonuse]',es=>es[es.length-1]&&es[es.length-1].click());
  await settled(p);
  ok(!(await p.$('.es-lesson')),'taking it closes the lesson');
  ok(!!(await p.$('#esline')),'and lands on the writing line, not a menu');
  await p.fill('#esline','Customers who want less effort push McDonald’s to take steps out of ordering.');
  await p.click('#esaccept'); await settled(p);
  ok(/take steps out of ordering/.test(await text(p,'.es-prose')),'writing continues from there');

  console.log('8. it stays reachable, and every route out lands in the paragraph');
  ok(!!(await p.$('[data-eslessonchip]')),'the lesson is one press away while writing');
  await p.click('[data-eslessonchip]'); await settled(p);
  ok(!!(await p.$('.es-lesson')),'and reopens');
  const was=await text(p,'.es-lessonctx');
  ok(/take steps out of ordering/.test(was),'and it shows them the sentence they were on: '+was.slice(-70));
  await p.$$eval('[data-eslessonuse]',es=>es[0]&&es[0].click()); await settled(p);
  ok(!(await p.$('.es-lesson'))&&!!(await p.$('#esline')),'the strip returns them to the paragraph, not to the setup card');
  ok(/take steps out of ordering/.test(await text(p,'.es-prose')),'with the sentence still there');

  console.log('9. a student who knows this never meets any of it');
  await open(p);
  await toProcesses(p);
  await p.$$eval('[data-espath]',es=>{const t=es.find(x=>/pr-speed/.test(x.dataset.espath)); t&&t.click();});
  await settled(p);
  await p.click('#esstartwriting'); await here(p, '#esline');
  ok(!(await p.$('.es-lesson')),'straight past the lesson');
  ok(!!(await p.$('#esline')),'straight to the line');
  await p.fill('#esline','Customers expecting speed push the business to move a step out of the queue.');
  await p.click('#esaccept'); await settled(p);
  ok((await count(p,'.es-lesson'))===0,'and it never appears uninvited');
  const seen=await text(p,'.es-compose');
  ok(!/systems a customer moves through/i.test(seen),'none of the teaching was put in front of them');

  console.log('10. each of the three pathways is its own lesson');
  await open(p); await toProcesses(p);
  const lessons=[];
  for (const id of ['pr-convenience','pr-speed','pr-customisation']) {
    await p.$$eval('[data-espath]',(es,x)=>{const t=es.find(e=>e.dataset.espath.indexOf(x)>=0); t&&t.click();}, id);
    await settled(p);
    await p.click('#eslessonopen'); await settled(p);
    lessons.push({id, know: await text(p,'.es-lessonp.lead'), steps: (await all(p,'.es-chainstep')).length,
                  prompt: (await text(p,'.es-lessonsec.try')).slice(0,60)});
    await p.$$eval('[data-eslessonuse]',es=>es[0]&&es[0].click()); await settled(p);
    await p.$$eval('[data-esrestchange]',es=>{const t=es.find(x=>x.dataset.esrestchange==='argument'); t&&t.click();});
    await settled(p);
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
