// THE WITHHOLDING CONTRACT, at the student's screen.
//
// t14.mjs proves the rule. This proves the student is on the right side of it:
//
//   unreviewed  -> no "Understand this argument", no lesson, no concept
//                  definitions, and NOTHING that tells them the content is
//                  unfinished. Writing is unaffected.
//   authored    -> the control is offered.
//
// Driven from a fixture this test owns, injected at runtime, so finishing a real
// question cannot break it and cannot silently empty it.
//
// THIS TEST IS HALF OF THE CONTRACT. t14.mjs is the other half: it reads the real
// rule out of app.js and trips when the implementation drifts. This half knows
// nothing about the implementation and asks only what the student can see, which
// is the half that can still fail when the code is self-consistently wrong.
//
// ui31 keeps the same contract as an end-to-end journey through real content.
// Three tests, three different ways to be wrong.
const { chromium, P } = require('./env');
const { WITHHOLDING_FIXTURE } = require('./fixtures/withholding.js');
let pass=0,fail=0; const ok=(c,m)=>{ if(c) pass++; else {fail++; console.log('  FAIL:',m);} };

async function openFixture(p){
  await p.goto(P); await p.waitForTimeout(600);
  await p.evaluate(()=>localStorage.removeItem('marginal.essay.v1'));
  await p.goto(P); await p.waitForTimeout(600);
  // the fixture subject, added to the pack the page already loaded
  await p.evaluate(f=>{ window.ESSAY.subjects[f.key]=f; }, WITHHOLDING_FIXTURE);
  await p.$$eval('.navtab',es=>{const t=es.find(x=>/Essay practice/i.test(x.textContent));t&&t.click();});
  await p.waitForTimeout(400);
  await p.selectOption('#essubject','contract_test');
  await p.waitForTimeout(300);
  await p.$$eval('.es-qchip',es=>{const t=es.find(x=>/fixture question/i.test(x.textContent));t&&t.click();});
  await p.waitForTimeout(200);
  await p.click('#esstart'); await p.waitForTimeout(700);
  if (await p.$('.es-startrow')) await p.$$eval('.es-startrow',es=>{const t=es.filter(x=>/Body/.test(x.textContent))[0];t&&t.click();});
  else await p.$$eval('.es-mapitem',es=>{const t=es.filter(x=>/Body/.test(x.textContent))[0];t&&t.click();});
  await p.waitForTimeout(650);
}
const text=(p,sel)=>p.$eval(sel,e=>e.innerText.replace(/\s+/g,' ').trim()).catch(()=>'');
async function choose(p,id){
  // Once an argument is chosen the list is replaced by a summary, so a second
  // choice has to reopen it first. Asserted rather than assumed: if the pathway
  // is not on screen after this, the caller's assertions would be inspecting a
  // screen that never offered the thing they claim was withheld.
  if (!(await p.$('[data-espath]'))) {
    await p.click('#esbackarg').catch(()=>{});
    await p.waitForTimeout(420);
  }
  const seen = await p.$$eval('[data-espath]',es=>es.map(e=>e.dataset.espath));
  if (seen.indexOf(id) < 0) throw new Error('pathway '+id+' was not offered; saw '+JSON.stringify(seen));
  await p.$$eval('[data-espath]',(es,want)=>{const t=es.find(x=>x.dataset.espath===want);t&&t.click();},id);
  await p.waitForTimeout(460);
}

(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1500,height:1080}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  await p.route(/workers\.dev/, r=>r.abort());

  await openFixture(p);
  const ids=await p.$$eval('[data-espath]',es=>es.map(e=>e.dataset.espath));
  console.log('--- the fixture reached the screen ---');
  console.log('    pathways offered:', JSON.stringify(ids));
  // Asserted before anything else. A probe that inspects an empty list would
  // otherwise report every withholding assertion below as a pass.
  ok(ids.indexOf('ct-unreviewed')>=0 && ids.indexOf('ct-authored')>=0,
    'both fixture pathways are selectable: '+JSON.stringify(ids));

  console.log('--- unreviewed: nothing offered, nothing claimed ---');
  await choose(p,'ct-unreviewed');
  ok(!(await p.$('#eslessonopen')),'no "Understand this argument" control');
  ok(!(await p.$('[data-eslessonchip]')),'and no lesson chip either');
  ok(!(await p.$('.es-lesson')),'no lesson body');
  ok((await p.$$('.es-concept')).length===0,'and no concept definitions');
  const said=await text(p,'.es-setup');
  // text() yields '' for a missing element, and '' satisfies every negative
  // regex below. Prove the surface is there before asking what it does not say.
  ok(said.length>0,'the setup surface rendered, so the assertion below means something');
  ok(!/unreviewed|incomplete|not yet|coming soon|unfinished|no lesson/i.test(said),
    'the student is never told the content is unfinished: '+said.slice(0,80));
  ok(!!(await p.$('#esstartwriting')),'and writing is unaffected');

  console.log('--- authored: the control is offered ---');
  await choose(p,'ct-authored');
  ok(!!(await p.$('#eslessonopen')),'"Understand this argument" is offered');

  console.log('--- the two states are reached from the same screen ---');
  // Not two runs of the app in two states. One screen, one student, both
  // pathways, and switched between in both directions, so the difference cannot
  // be an artefact of how the screen was opened.
  await choose(p,'ct-unreviewed');
  ok(!(await p.$('#eslessonopen')),'switching back withholds it again');
  await choose(p,'ct-authored');
  ok(!!(await p.$('#eslessonopen')),'and switching forward offers it again');

  console.log('--- and the lesson it opens is that pathway\u2019s own ---');
  // Opened last, because the lesson panel covers the argument controls and
  // nothing after this needs them.
  await p.click('#eslessonopen'); await p.waitForTimeout(480);
  const lesson=await text(p,'.es-lesson');
  ok(lesson.length>0,'it opens a lesson: '+lesson.slice(0,60));
  ok(/fixture/i.test(lesson),'which is this pathway\u2019s own authored content');

  console.log('pageerrors:', errs.length?errs.slice(0,3):'none');
  ok(errs.length===0,'no page errors');
  console.log(pass+' passed, '+fail+' failed');
  await b.close();
  process.exit(fail?1:0);
})();
