// Third architecture case: a judgement question. The student decides what to
// discuss AND what they think, each argument declares what it does for that
// judgement, and the conclusion can weigh them. Same fields, different mode.
const { chromium, T, OUT } = require('./env');
let pass=0,fail=0; const ok=(c,m)=>{ if(c) pass++; else {fail++; console.log('  FAIL:',m);} };
async function open(p, re){
  await p.goto(T); await p.waitForTimeout(650);
  await p.evaluate(()=>localStorage.removeItem('marginal.essay.v1'));
  await p.goto(T); await p.waitForTimeout(650);
  await p.$$eval('.navtab',es=>{const t=es.find(x=>/Essay practice/i.test(x.textContent));t&&t.click();});
  await p.waitForTimeout(400);
  await p.selectOption('#essubject','business_studies'); await p.waitForTimeout(200);
  await p.$$eval('.es-qchip',(es,r)=>{const t=es.find(x=>new RegExp(r,'i').test(x.textContent));t&&t.click();}, re.source);
  await p.click('#esstart'); await p.waitForTimeout(650);
}
(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1500,height:1050},deviceScaleFactor:2})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  let calls=0; await p.route(/workers\.dev/, r=>{calls++;r.abort();});

  console.log('1. the mode is data, not a special case');
  await open(p,/Evaluate the effectiveness/);
  const modes=await p.evaluate(()=>{
    const qs=window.ESSAY.subjects.business_studies.questions;
    const g=id=>{const q=qs.find(x=>x.id===id); return {mode:(q.coreAnswer||{}).mode, pos:((q.coreAnswer||{}).positions||[]).length, crit:((q.coreAnswer||{}).criteria||[]).length};};
    return {mkt:g('mkt-01'), fin:g('fin-01'), hr:g('hr-01')};
  });
  console.log('   ',JSON.stringify(modes));
  ok(modes.mkt.mode==='causal'&&modes.fin.mode==='causal','the two causal questions declare themselves causal');
  ok(modes.hr.mode==='judgement','and this one declares itself a judgement');
  ok(modes.hr.pos===4&&modes.hr.crit===3,'carrying its positions and criteria as data: '+modes.hr.pos+' / '+modes.hr.crit);
  ok(modes.mkt.pos===0,'which the causal questions simply do not have');

  console.log('2. the student decides what they think, before choosing what proves it');
  ok(!!(await p.$('.es-judge')),'a judgement card appears');
  const jh=await p.$eval('.es-judgeh',e=>e.textContent.trim());
  ok(/what do you think overall/i.test(jh),'asking the second question: '+JSON.stringify(jh));
  const posOpts=await p.$$eval('[data-espos]',es=>es.map(e=>e.textContent.trim()));
  ok(posOpts.length===4,'four defensible positions: '+posOpts.length);
  ok(/highly effective/i.test(posOpts.join(' '))&&/limited/i.test(posOpts.join(' ')),'spanning the range, not just degrees of yes');
  ok(!!(await p.$('[data-esposown]')),'and writing their own is first class');
  const judgeText=await p.$eval('.es-judge',e=>e.innerText.replace(/\s+/g,' '));
  ok(/one-sided judgement is still a judgement/i.test(judgeText),'no artificial balance is demanded: '+judgeText.slice(0,40));
  await p.click('#escrit'); await p.waitForTimeout(250);
  const crit=await p.$eval('.es-corebody',e=>e.innerText.replace(/\s+/g,' '));
  ok(/against a named measure/i.test(crit)&&/how much, not whether/i.test(crit),'the criteria are taught: '+crit.slice(0,60));
  ok(/do not invent a doubt/i.test(crit),'including that balance must not be manufactured');

  console.log('3. it is not a gate');
  ok((await p.$$eval('.es-plancard,.es-planrow',es=>es.length))>0,'the body plan is on the same page and reachable without taking a position');
  await p.$$eval('[data-espos]',es=>{const t=es.find(x=>/dependent on how they are carried out/i.test(x.textContent));t&&t.click();});
  await p.waitForTimeout(350);
  ok(!!(await p.$('.es-judge.done')),'taking a position collapses it to a line, with no extra confirmation');
  ok(!!(await p.$('#esposopen')),'with a way to change it');

  console.log('4. every argument says what it does FOR the judgement');
  await p.$$eval('.es-plancard .es-areachip',es=>{const t=es.find(x=>/performance management/i.test(x.textContent));t&&t.click();});
  await p.waitForTimeout(320);
  const roles=await p.$$eval('.es-optwrap .es-tprole',es=>es.map(e=>e.textContent.trim()));
  console.log('   ',JSON.stringify(roles));
  ok(roles.length===2,'each option carries a contribution: '+roles.length);
  ok(roles.some(r=>/pushes against/i.test(r)),'including one that pushes against the judgement');
  const all=await p.evaluate(()=>{
    const q=window.ESSAY.subjects.business_studies.questions.find(x=>x.id==='hr-01');
    const c={}; q.pathways.forEach(x=>{c[x.contribution.role]=(c[x.contribution.role]||0)+1;}); return c;
  });
  console.log('   across the question:',JSON.stringify(all));
  ok(all.support&&all.conditional&&all.limitation,'all three kinds exist to argue with');
  ok(!(all.support===all.limitation&&all.conditional===0),'and they are not a manufactured fifty-fifty');

  console.log('5. the thesis asks for a judgement, not a relationship');
  for (let n=0;n<4;n++){
    const did=await p.$$eval('.es-plancard .es-areachip',es=>{const t=es.find(x=>!/ on|on$/.test(x.className)); if(t){t.click();return true;} return false;});
    if(!did) break; await p.waitForTimeout(280);
    await p.$$eval('[data-esplanpick]',es=>{const t=es[0]; t&&t.click();}); await p.waitForTimeout(300);
  }
  ok(!!(await p.$('.es-thesis')),'the thesis section appears');
  const guide=await p.$eval('.es-thesisguide',e=>e.textContent.trim());
  ok(/how effective/i.test(guide)&&/main reason/i.test(guide),'asking for degree and reason: '+guide.slice(0,60));
  ok(/if your evidence calls for/i.test(guide)||/Do not add a limitation you cannot support/i.test(guide),'and qualification only where earned');
  ok(!!(await p.$('.es-thesispos')),'the position is shown while the thesis is written');
  const planRoles=await p.$$eval('.es-thesisplan .es-tprole',es=>es.map(e=>e.textContent.trim()));
  ok(planRoles.length>=3,'and each planned argument shows what it contributes: '+JSON.stringify(planRoles.slice(0,3)));
  await p.screenshot({path:OUT+'shot-hr01-plan.png'});

  console.log('6. THE ACCEPTANCE TEST: the conclusion can weigh what was argued');
  await p.fill('#esthesis','Human resource strategies are effective, though it depends on how they are carried out.');
  await p.click('#esthesissave'); await p.waitForTimeout(350);
  await p.click('#esplango'); await p.waitForTimeout(500);
  await p.$$eval('[data-esgo]',es=>{const t=es.find(x=>/Conclusion/.test(x.textContent));t&&t.click();});
  await p.waitForTimeout(450);
  const rail=await p.$eval('.es-rest',e=>e.innerText.replace(/\s+/g,' '));
  console.log('   ',rail.slice(0,220));
  ok(/your judgement/i.test(rail),'the conclusion is shown the judgement the student took');
  ok(/dependent on how they are carried out/i.test(rail),'the actual position, not a generic one');
  ok(/what your paragraphs established/i.test(rail),'and what the paragraphs established');
  const rolesHere=await p.$$eval('.es-rest .es-tprole',es=>es.map(e=>e.textContent.trim()));
  ok(rolesHere.length>=3,'each with its contribution: '+JSON.stringify(rolesHere));
  ok(/how the support and the limitations balance out/i.test(rail),'with guidance to weigh rather than repeat');
  ok(/change the judgement rather than the evidence/i.test(rail),'and the honest instruction if they do not add up');
  await p.screenshot({path:OUT+'shot-hr01-conclusion.png'});

  console.log('7. the causal questions are untouched');
  await open(p,/target markets affect/);
  ok(!(await p.$('.es-judge')),'mkt-01 is asked for no position');
  ok((await p.$$eval('.es-tprole',es=>es.length))===0,'and no argument carries a contribution it does not have');
  await open(p,/financial strategies affect/);
  ok(!(await p.$('.es-judge')),'nor is fin-01');
  const finGuide=await p.$eval('.es-corepat',e=>e.textContent.trim());
  ok(/financial strategy → what it changes/.test(finGuide),'and its own pattern still stands: '+finGuide);

  ok(calls===0,'no model calls anywhere: '+calls);
  console.log('pageerrors:',errs.join(' | ')||'none');
  ok(errs.length===0,'no page errors');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
