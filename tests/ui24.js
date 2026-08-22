// Progressive argument construction. The response is not designed before it is
// written: an anchor, then one decision at a time, and a working answer the
// system keeps that never touches the student's prose.
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
const wa = p => p.$eval('.es-watext',e=>e.textContent.trim()).catch(()=>'');
(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1500,height:1050},deviceScaleFactor:2})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  let calls=0; await p.route(/workers\.dev/, r=>{calls++;r.abort();});

  console.log('1. nothing has to be planned before writing');
  await open(p,/Evaluate the effectiveness/);
  ok(!(await p.$('.es-plancards')),'the four-card planner is not what opens');
  ok((await p.$$eval('.es-startrow',es=>es.length))===6,'the shape of the response is shown, all six sections');
  const idle=await p.$$eval('.es-startrow:not(.planned):not(.written)',es=>es.length);
  ok(idle===6,'all inert, none demanding completion: '+idle);
  const routes=await p.$$eval('.es-startbtns button',es=>es.map(e=>e.textContent.trim()));
  console.log('   ',JSON.stringify(routes));
  ok(routes.length===3,'three ways in: '+routes.length);
  ok(/introduction/i.test(routes[0])&&/body 1/i.test(routes[1])&&/plan all/i.test(routes[2]),'write, start a body, or plan everything');

  console.log('2. the working answer starts broad and says so');
  const w0=await wa(p);
  ok(/can improve business performance\.$/.test(w0),'a broad opening claim: '+JSON.stringify(w0));
  ok(/develops as you choose arguments/i.test(await p.$eval('.es-wa',e=>e.innerText)),'labelled as provisional');
  ok(/answer so far/i.test(await p.$eval('.es-wa',e=>e.innerText)),'and as so far, not final');
  ok(!!(await p.$('#esposdefer')),'a position can be taken now, or deferred');

  console.log('3. it develops as arguments are chosen, not before');
  await p.click('#esplanall'); await p.waitForTimeout(350);
  await p.$$eval('.es-plancard .es-areachip',es=>{const t=es.find(x=>x.textContent.trim().indexOf('training')===0); t&&t.click();});
  await p.waitForTimeout(300);
  await p.$$eval('[data-esplanpick]',es=>es[0]&&es[0].click()); await p.waitForTimeout(350);
  await p.click('#esplanless'); await p.waitForTimeout(350);
  const w1=await wa(p);
  console.log('   after one argument:',w1);
  ok(/raising productivity/.test(w1),'it names what that argument adds');
  ok(!/depends on how well/.test(w1),'and carries no qualifier yet, because nothing qualifies it');
  await p.click('#esplanall'); await p.waitForTimeout(300);
  await p.$$eval('.es-plancard .es-areachip',es=>{const t=es.find(x=>x.textContent.trim().indexOf('performance management')===0); t&&t.click();});
  await p.waitForTimeout(300);
  await p.$$eval('[data-esplanpick]',es=>{const t=es.find(x=>/pf-trust/.test(x.dataset.esplanpick)); t&&t.click();});
  await p.waitForTimeout(350);
  await p.click('#esplanless'); await p.waitForTimeout(350);
  const w2=await wa(p);
  console.log('   after a limitation:',w2);
  ok(/affecting trust as well as accountability/.test(w2),'the limitation is in the answer');
  ok(/depends on how well they are carried out/.test(w2),'and NOW the qualifier appears, because something qualifies it');
  ok(calls===0,'derived from authored phrases, with no model call: '+calls);
  await p.screenshot({path:OUT+'shot-working-answer.png'});

  console.log('4. it travels with the writing');
  await p.click('#esstartbody'); await p.waitForTimeout(500);
  ok(!!(await p.$('#esline'))||!!(await p.$('.es-setup')),'starting a body goes straight there');
  const mapWa=await p.$eval('.es-mapwa',e=>e.innerText.replace(/\s+/g,' ')).catch(()=>'');
  ok(/raising productivity/.test(mapWa),'the working answer is beside the writing: '+mapWa.slice(0,60));

  console.log('5. an unplanned paragraph asks just in time');
  await p.$$eval('[data-esgo]',es=>{const t=es.find(x=>/Body 3/.test(x.textContent));t&&t.click();});
  await p.waitForTimeout(450);
  ok(!!(await p.$('.es-setup')),'Body 3 asks what it will argue at the moment it is reached');
  const ask=await p.$eval('.es-setuph',e=>e.textContent.trim()).catch(()=>'');
  ok(/Which human resource strategy will Body 3 use/i.test(ask),'naming the decision: '+JSON.stringify(ask));
  ok((await p.$$eval('[data-espath]',es=>es.length))===0,'and not offering all eight relationships at once');
  await p.$$eval('[data-essetuparea]',es=>{const t=es.find(x=>x.textContent.trim().indexOf('rewards')===0); t&&t.click();});
  await p.waitForTimeout(350);
  ok((await p.$$eval('[data-espath]',es=>es.length))===2,'choosing the area narrows it to that area\u2019s two');
  ok((await p.$$eval('[data-espath] .es-picksub',es=>es.length))===2,'each saying what it means');

  console.log('6. the working answer never rewrites the student');
  await p.$$eval('[data-esgo]',es=>{const t=es.find(x=>/Introduction/.test(x.textContent));t&&t.click();});
  await p.waitForTimeout(400);
  await p.fill('#esline','Human resource strategies are highly effective at improving business performance.');
  await p.click('#esaccept'); await p.waitForTimeout(350);
  const prose=await p.$eval('.es-prose',e=>e.textContent);
  ok(/highly effective/.test(prose),'their sentence stands exactly as written');
  const w3=(await wa(p))||await p.$eval('.es-mapwa',e=>e.innerText.replace(/\s+/g,' ')).catch(()=>'');
  ok(!!w3&&!/highly effective/.test(w3)&&/raising productivity/.test(w3),
     'and the system keeps its own understanding separately: '+w3.slice(0,90));

  console.log('7. required coverage is checked at review, never at the start');
  await open(p,/target markets affect/);
  const cov=await p.$eval('.es-cover',e=>e.innerText.replace(/\s+/g,' ')).catch(()=>'');
  console.log('   ',cov.slice(0,120));
  ok(/required in your response/i.test(cov),'the four required parts are shown up front');
  ok(/start anywhere/i.test(cov),'as information, not a gate');
  ok((await p.$$eval('.es-startbtns button',es=>es.length))===3,'and the same three routes are offered');
  await p.click('#esstartintro'); await p.waitForTimeout(500);
  await p.fill('#esline','Target markets shape every marketing decision a business makes.');
  await p.click('#esaccept'); await p.waitForTimeout(300);
  await p.click('#esreview'); await p.waitForTimeout(500);
  const miss=await p.$eval('.es-cover.missing',e=>e.innerText.replace(/\s+/g,' ')).catch(()=>'');
  console.log('   ',miss.slice(0,140));
  ok(/not yet addressed/i.test(miss),'at review, what is missing is named');
  ok(/e-marketing/i.test(miss)&&/physical evidence/i.test(miss),'all of it');
  ok(/likely to limit your mark/i.test(miss),'with the consequence stated');
  ok(/submit anyway/i.test(miss),'and it does not block them');
  ok(!!(await p.$('#essubmit')),'submit is still there');
  await p.screenshot({path:OUT+'shot-coverage-review.png'});

  ok(calls===0,'no model calls anywhere: '+calls);
  console.log('pageerrors:',errs.join(' | ')||'none');
  ok(errs.length===0,'no page errors');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
