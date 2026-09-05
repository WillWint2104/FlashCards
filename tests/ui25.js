const { openMap, usePractice } = require('./env');

// Waits that name their condition. This app fetches nothing and renders
// synchronously, so the effect of a click is present on the next frame:
// settled() is that frame, not a shorter guess at a duration.
const settled = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const here = (p, sel) => p.waitForSelector(sel, { timeout: 8000 });
// The consolidation pass on progressive construction. Four things this proves:
// the working answer describes CHOICES and never claims the prose establishes
// them; a judgement is an orientation a student may defer; required coverage
// warns and routes rather than blocking; and a judgement that no longer fits its
// arguments is questioned, never overruled.
const { chromium, T, OUT } = require('./env');
let pass=0,fail=0; const ok=(c,m)=>{ if(c) pass++; else {fail++; console.log('  FAIL:',m);} };
async function open(p, re){
  await p.goto(T); await here(p, '.navtab');
  await p.evaluate(()=>localStorage.removeItem('marginal.essay.v1'));
  await p.goto(T); await here(p, '.navtab');
  await p.$$eval('.navtab',es=>{const t=es.find(x=>/Essay practice/i.test(x.textContent));t&&t.click();});
  await settled(p);
  await p.selectOption('#essubject','business_studies'); await settled(p);
  await usePractice(p); await p.$$eval('.qp-row',(es,r)=>{const t=es.find(x=>new RegExp(r,'i').test(x.textContent));t&&t.click();}, re.source);
  await p.click('#esstart');
  await p.waitForFunction(() => !!document.querySelector('#esline, .es-startrow, [data-espath]'), null, { timeout: 8000 });
}
const text = (p,sel) => p.$eval(sel,e=>e.innerText.replace(/\s+/g,' ').trim()).catch(()=>'');
// plan one argument by id, from the plan screen, and come back
async function plan(p, area, id){
  await p.click('#esplanall'); await settled(p);
  await p.$$eval('.es-plancard .es-areachip',(es,a)=>{const t=es.find(x=>x.textContent.trim().indexOf(a)===0); t&&t.click();}, area);
  await settled(p);
  await p.$$eval('[data-esplanpick]',(es,i)=>{const t=es.find(x=>x.dataset.esplanpick.indexOf(i)>=0); t&&t.click();}, id);
  await settled(p);
  await p.click('#esplanless'); await settled(p);
}
(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1500,height:1050},deviceScaleFactor:2})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  let calls=0; await p.route(/workers\.dev/, r=>{calls++;r.abort();});

  console.log('1. a judgement is an orientation, not an entry requirement');
  await open(p,/the effectiveness of human resource/);
  ok(!!(await p.$('.es-judge')),'the question is asked');
  ok(!!(await p.$('#esposdefer')),'and deciding later is one of the answers');
  ok(!!(await p.$('#esstartbody')),'writing is reachable with the question unanswered');
  const askText=await text(p,'.es-judge');
  ok(/decide once you have an argument in front of you/i.test(askText),'the panel says so in words: '+askText.slice(0,90));
  await p.click('#esposdefer'); await settled(p);
  ok(!!(await p.$('.es-judge.done')),'answering it closes it');
  ok(/deciding as you write/i.test(await text(p,'.es-judge')),'and records what was chosen');
  ok(!(await p.$('#esposdefer')),'it does not keep asking');
  ok(!!(await p.$('#esposopen')),'a position can still be taken at any point');
  await p.screenshot({path:OUT+'shot-decide-as-i-go.png'});

  console.log('2. a deferred judgement does not block the writing');
  await p.click('#esstartbody'); await settled(p);
  ok(!!(await p.$('#esline'))||!!(await p.$('.es-setup')),'body 1 opens with no position taken');
  await openMap(p); await p.click('.es-mapwa'); await settled(p);
  ok(!!(await p.$('.es-judge.done')),'and the deferral survives the trip');

  console.log('3. the working answer says where it comes from');
  const note0=await text(p,'.es-wa');
  ok(/develops as you choose arguments/i.test(note0),'before anything is chosen: '+note0.slice(0,80));
  await plan(p,'training and development','hr01-td-productivity');
  const note1=await text(p,'.es-wa');
  console.log('   ',note1.slice(0,150));
  ok(/from 1 argument you have chosen/i.test(note1),'it counts arguments chosen, not paragraphs written');
  ok(/none written yet/i.test(note1),'and says plainly that none is written');
  ok(!/paragraphs (now )?argue/i.test(note1),'it never claims the paragraphs argue anything');

  console.log('4. writing prose does not let it claim more');
  await p.$$eval('[data-esgo]',es=>{const t=es.find(x=>/Body 1/.test(x.textContent));t&&t.click();});
  await settled(p);
  await p.fill('#esline','Training raises productivity at McDonald’s.');
  await p.click('#esaccept'); await settled(p);
  await openMap(p); await p.click('.es-mapwa'); await settled(p);
  const note2=await text(p,'.es-wa');
  ok(/1 written/i.test(note2),'it now reports one written: '+note2.slice(0,120));
  ok(/from 1 argument you have chosen/i.test(note2),'still sourced from the choice');
  const wa2=await text(p,'.es-watext');
  ok(/raising productivity/.test(wa2),'and the answer itself is unchanged by the prose');

  console.log('5. drift is described as choices, not as achievement');
  await p.click('#esplanall'); await settled(p);
  await p.fill('#esthesis','Human resource strategies are highly effective.');
  await p.click('#esthesissave'); await settled(p);
  await p.click('#esplanless'); await settled(p);
  await plan(p,'performance management','hr01-pf-trust');
  await p.click('#esplanall'); await settled(p);
  const drift=await text(p,'.es-drift:not(.tension)');
  console.log('   ',drift.slice(0,170));
  ok(/argument choices have moved on/i.test(drift),'the heading names the choices');
  ok(/based on the arguments you have chosen/i.test(drift),'so does the label');
  ok(!/paragraphs (now )?argue/i.test(drift),'nothing claims the paragraphs argue it');
  ok(/not from reading your paragraphs/i.test(drift),'and it says outright what it is not');
  ok(/highly effective/i.test(drift),'their own sentence is quoted back unaltered');
  const th=await p.$eval('#esthesis',e=>e.value);
  ok(th==='Human resource strategies are highly effective.','and left exactly as they wrote it: '+JSON.stringify(th));
  await p.screenshot({path:OUT+'shot-drift-wording.png'});

  console.log('6. a judgement that stops fitting its arguments is questioned, not overruled');
  await p.click('#esposopen'); await settled(p);
  await p.$$eval('[data-espos]',es=>{const t=es.find(x=>/Highly effective/i.test(x.textContent)); t&&t.click();});
  await settled(p);
  ok(!(await p.$('.es-drift.tension')),'one limitation under a positive judgement is not worth a question');
  await p.click('#esplanless'); await settled(p);
  await plan(p,'rewards','hr01-rw-cost');
  const ten=await text(p,'.es-drift.tension');
  console.log('   ',ten.slice(0,190));
  ok(!!ten,'two limitations against highly effective raises one');
  ok(/does your judgement still fit/i.test(ten),'phrased as a question');
  ok(/Highly effective/.test(ten),'naming the judgement they took');
  ok(/not a count of paragraphs/i.test(ten),'and conceding it may be right anyway');
  ok(!/wrong|should be|downgrade/i.test(ten),'it never says the judgement is wrong');
  const shown=await text(p,'.es-judge.done, .es-wapos');
  ok(/Highly effective/.test(shown),'the judgement itself is untouched');
  await p.screenshot({path:OUT+'shot-judgement-tension.png'});
  await p.click('#esposkeep'); await settled(p);
  ok(!(await p.$('.es-drift.tension')),'saying it still fits puts the question away');
  await plan(p,'job design','hr01-jd-flexibility');
  ok(!!(await p.$('.es-drift.tension')),'and it comes back only when the shape moves again');

  console.log('7. required coverage warns and routes, and never blocks');
  await open(p,/target markets affect/);
  await p.click('#esstartintro'); await settled(p);
  await p.fill('#esline','Target markets shape every marketing decision a business makes.');
  await p.click('#esaccept'); await settled(p);
  await p.click('#esfootpreview'); await settled(p);
  const miss=await text(p,'.es-cover.missing');
  console.log('   ',miss.slice(0,190));
  ok(/does not yet address/i.test(miss),'it says what the response does not do');
  ok(/e-marketing, people, processes and physical evidence/i.test(miss),'listing them as a sentence, not four chips');
  ok(/which the question names/i.test(miss),'and why that matters');
  ok(/likely to limit your mark substantially/i.test(miss),'stating the cost plainly');
  ok(/You can submit anyway/i.test(miss),'while leaving the decision to them');
  const gos=await p.$$eval('[data-escover]',es=>es.map(e=>e.textContent.trim()));
  ok(gos.length===4,'a way back to each one: '+gos.length);
  ok(/go to physical evidence/i.test(gos.join(' ')),'named, not numbered: '+JSON.stringify(gos[3]));
  ok(!!(await p.$('#essubmit')),'and submit is still right there');
  await p.screenshot({path:OUT+'shot-coverage-routes.png'});
  await p.$$eval('[data-escover]',es=>{const t=es.find(x=>/physical evidence/i.test(x.textContent)); t&&t.click();});
  await settled(p);
  ok(!!(await p.$('#esline'))||!!(await p.$('.es-setup')),'it lands in a paragraph, ready to write');
  const head=await text(p,'.es-parahead');
  ok(/body/i.test(head),'a body paragraph: '+head);
  const para=await text(p,'.es-compose');
  ok(/physical evidence/i.test(para),'and that paragraph is now the one covering physical evidence');
  await p.click('#esfootpreview'); await settled(p);
  const miss2=await text(p,'.es-cover.missing');
  ok(/physical evidence/i.test(miss2),'still counted as unaddressed until something is written there');

  ok(calls===0,'no model calls anywhere: '+calls);
  console.log('pageerrors:',errs.join(' | ')||'none');
  ok(errs.length===0,'no page errors');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
