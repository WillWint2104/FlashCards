// The routing contract. A concept authored in the pack is worth nothing to a
// student on a pathway that cannot surface it, and the People pathway is here
// because it is the one that exposed that: training and service standards
// existed and could not be reached from the argument that needed them.
//
// This also proves the lesson architecture is not Processes-shaped. The People
// lesson is assembled from concepts authored once, in the same schema, and
// declaring a concept is what makes it eligible: nothing is shown because it
// merely exists.
const { chromium, T, OUT } = require('./env');
let pass=0,fail=0; const ok=(c,m)=>{ if(c) pass++; else {fail++; console.log('  FAIL:',m);} };
const { execFileSync } = require('child_process');
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
async function body(p,n){
  if (await p.$('.es-startrow')) await p.$$eval('.es-startrow',(es,i)=>{const t=es.filter(x=>/Body/.test(x.textContent))[i-1];t&&t.click();},n);
  else await p.$$eval('.es-mapitem',(es,i)=>{const t=es.filter(x=>/Body/.test(x.textContent))[i-1];t&&t.click();},n);
  await p.waitForTimeout(650);
}
// the concept store, read straight from the pack, so the test compares the
// rendered lesson against the single authored source rather than against itself
const store = (()=>{
  const out = execFileSync('node',['-e',`
    const vm=require("vm"),fs=require("fs");const s={window:{}};vm.createContext(s);
    vm.runInContext(fs.readFileSync("essay-content.js","utf8"),s);
    process.stdout.write(JSON.stringify(s.window.ESSAY.subjects.business_studies.concepts));`],
    {cwd: require('path').resolve(__dirname,'..'), encoding:'utf8'});
  return JSON.parse(out);
})();

(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1500,height:1050},deviceScaleFactor:2})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  let calls=0; await p.route(/workers\.dev/, r=>{calls++;r.abort();});

  console.log('1. the People pathway now has a lesson, built from shared concepts');
  await open(p);
  await body(p,2);
  ok(/people/i.test(await text(p,'.es-setuph')),'body 2 is the people part of the question');
  await p.$$eval('[data-espath]',es=>{const t=es.find(x=>/pe-service/.test(x.dataset.espath)); t&&t.click();});
  await p.waitForTimeout(470);
  ok(!!(await p.$('#eslessonopen')),'and it offers a lesson, where before it offered none');
  await p.click('#eslessonopen'); await p.waitForTimeout(500);
  const concepts=await all(p,'.es-concept');
  console.log('   ',JSON.stringify(concepts));
  ok(concepts.length===2,'two concepts are named on the surface: '+concepts.length);
  ok(concepts.some(c=>c.indexOf(store.people.oneLine)>=0),'people, word for word from the pack');
  ok(concepts.some(c=>c.indexOf(store.training.oneLine)>=0),'and training, word for word from the pack');
  await p.screenshot({path:OUT+'shot-lesson-people.png'});

  console.log('2. declaring a concept makes it eligible, not shown');
  const surface=await text(p,'.es-lesson');
  ok(!/service standards is the level/i.test(surface),'the supporting term is not on the surface');
  ok(surface.indexOf(store.serviceStandards.quick)<0,'nothing supporting is pushed at them');
  await p.click('#eslessonmore'); await p.waitForTimeout(440);
  const deeper=await text(p,'.es-lessonmore');
  ok(deeper.indexOf(store.serviceStandards.quick)>=0,'and it is there when they ask: '+deeper.slice(0,90));
  ok(!/servicescape/i.test(await text(p,'.es-lesson')),'a concept this pathway does not depend on never appears');

  console.log('3. the same schema, a different argument');
  const know=await text(p,'.es-lessonp.lead');
  ok(/only reaches the customer through what those staff are taught/i.test(know),
    'the pathway supplies its own bridge, not another copy of the definitions');
  const steps=await all(p,'.es-chainstep');
  console.log('   ',JSON.stringify(steps));
  ok(steps.length===4,'a chain of its own: '+steps.length);
  ok(/who is on shift/i.test(steps[steps.length-1]),'ending where this argument ends');
  const tryText=await text(p,'.es-lessonsec.try');
  ok(/depends on which branch/i.test(tryText),'and a check about this relationship, not about processes');

  console.log('4. a wrong answer here is repaired in this pathway’s own terms');
  await p.$$eval('[data-estry]',es=>es[1]&&es[1].click()); await p.waitForTimeout(440);
  const repair=await text(p,'.es-tryrepair');
  console.log('   ',repair.slice(0,120));
  ok(/advertising is promotion/i.test(repair),'aimed at the mistake that was made');
  await p.click('#estryagain'); await p.waitForTimeout(400);
  await p.$$eval('[data-estry]',es=>es[0]&&es[0].click()); await p.waitForTimeout(440);
  ok(/the inconsistency is in what staff were taught/i.test(await text(p,'.es-tryright')),'and success says why');
  await p.$$eval('[data-eslessonuse]',es=>es[es.length-1]&&es[es.length-1].click());
  await p.waitForTimeout(560);
  ok(!!(await p.$('#esline')),'then hands them back to the writing line');

  console.log('5. the concept is authored once and reached from both pathways');
  await open(p); await body(p,3);
  await p.$$eval('[data-espath]',es=>{const t=es.find(x=>/pr-convenience/.test(x.dataset.espath)); t&&t.click();});
  await p.waitForTimeout(460);
  await p.click('#eslessonopen'); await p.waitForTimeout(480);
  const pr=await all(p,'.es-concept');
  console.log('   ',JSON.stringify(pr));
  ok(pr.length===1&&pr[0].indexOf(store.processes.oneLine)>=0,'processes, from the same store: '+JSON.stringify(pr[0]));
  ok(!/staff are part of what a service customer is buying/i.test(await text(p,'.es-lesson')),
    'and the People concepts are not dragged along with it');

  console.log('6. a student who needs none of it is given none of it');
  await open(p); await body(p,2);
  await p.$$eval('[data-espath]',es=>{const t=es.find(x=>/pe-service/.test(x.dataset.espath)); t&&t.click();});
  await p.waitForTimeout(460);
  await p.click('#esstartwriting'); await p.waitForTimeout(500);
  ok(!(await p.$('.es-lesson')),'no lesson');
  ok((await all(p,'.es-concept')).length===0,'and no concept definitions in front of them');
  ok(!!(await p.$('#esline')),'straight to the line');

  ok(calls===0,'no model calls anywhere: '+calls);
  console.log('pageerrors:',errs.join(' | ')||'none');
  ok(errs.length===0,'no page errors');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
