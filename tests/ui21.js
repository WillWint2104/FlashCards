// The planning surface: one page, four states. Understand the answer, inspect
// and choose four relationships, then write a thesis that signposts them.
const { chromium, T, OUT } = require('./env');
let pass=0,fail=0; const ok=(c,m)=>{ if(c) pass++; else {fail++; console.log('  FAIL:',m);} };
(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1500,height:1050},deviceScaleFactor:2})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  let calls=0; await p.route(/workers\.dev/, r=>{calls++;r.abort();});
  await p.goto(T); await p.waitForTimeout(800);
  await p.$$eval('.navtab',es=>{const t=es.find(x=>/Essay practice/i.test(x.textContent));t&&t.click();});
  await p.waitForTimeout(400);
  await p.selectOption('#essubject','business_studies'); await p.waitForTimeout(200);
  await p.$$eval('.es-qchip',es=>{const t=es.find(x=>/target markets affect/i.test(x.textContent));t&&t.click();});
  await p.click('#esstart'); await p.waitForTimeout(600);

  console.log('1. one surface, not three stages');
  ok(!!(await p.$('.es-decrow')),'the question and its decoder are at the top');
  ok(!!(await p.$('.es-core')),'the core answer is right under it');
  ok((await p.$$eval('.es-plancard',es=>es.length))===4,'the four choices are on the same page');
  ok(!(await p.$('.es-thesis')),'and the thesis is not offered yet, with nothing to signpost');

  console.log('2. the core answer teaches, then gets out of the way');
  const rel=await p.$eval('.es-corerel',e=>e.textContent.trim());
  ok(/characteristics and expectations within its target market/i.test(rel),'it states the relationship: '+rel.slice(0,60));
  await p.click('#escoreexplain'); await p.waitForTimeout(250);
  const ex=await p.$eval('.es-corebody',e=>e.innerText);
  ok(ex.length>400,'Explain this is a real explanation: '+ex.length+' chars');
  ok(/downstream of that one|not everyone who might buy/i.test(ex),'and teaches what a target market actually is');
  await p.click('#escoreidea').catch(()=>{});
  await p.waitForTimeout(250);
  const idea=await p.$$eval('.es-corebody',es=>es.map(e=>e.innerText).join(' '));
  ok(/not a sentence to copy/i.test(idea),'a thesis IDEA is offered, labelled as not a sentence to copy');
  await p.click('#escoregot'); await p.waitForTimeout(300);
  ok(!!(await p.$('.es-core.done')),'saying you understand collapses it');
  const line=await p.$eval('.es-core.done',e=>e.innerText.replace(/\s+/g,' '));
  ok(line.split(' ').length<40,'to one quiet line: '+line.slice(0,70));
  ok(!!(await p.$('#escorereview')),'with a way back into it');

  console.log('3. it is not a gate');
  const fresh=await (await b.newContext({viewport:{width:1400,height:1000}})).newPage();
  await fresh.route(/workers\.dev/, r=>r.abort());
  await fresh.goto(T); await fresh.waitForTimeout(700);
  await fresh.evaluate(()=>localStorage.removeItem('marginal.essay.v1'));
  await fresh.goto(T); await fresh.waitForTimeout(700);
  await fresh.$$eval('.navtab',es=>{const t=es.find(x=>/Essay practice/i.test(x.textContent));t&&t.click();});
  await fresh.waitForTimeout(400);
  await fresh.selectOption('#essubject','business_studies'); await fresh.waitForTimeout(200);
  await fresh.$$eval('.es-qchip',es=>{const t=es.find(x=>/target markets affect/i.test(x.textContent));t&&t.click();});
  await fresh.click('#esstart'); await fresh.waitForTimeout(500);
  await fresh.$$eval('[data-esplanpick]',es=>es[0]&&es[0].click()); await fresh.waitForTimeout(300);
  ok((await fresh.$$eval('.es-plancard.done',es=>es.length))===1,'an argument can be chosen without touching the core answer');
  await fresh.close();

  console.log('4. only one decision is expanded at a time');
  const openCards=await p.$$eval('.es-plancard',es=>es.filter(e=>e.querySelector('[data-esplanpick]')).length);
  ok(openCards===1,'one card is open, the rest are collapsed: '+openCards);

  console.log('5. choosing an argument is an act of learning');
  const subs=await p.$$eval('.es-optwrap .es-picksub',es=>es.map(e=>e.textContent.trim()));
  console.log('   ',JSON.stringify(subs.map(x=>x.slice(0,58))));
  ok(subs.length>=3,'every option says what it means without being asked: '+subs.length);
  ok(new Set(subs).size===subs.length,'and each one distinguishes itself from its siblings');
  ok(subs.every(x=>x.split('. ').filter(Boolean).length===1),'one sentence each, not a mini-lesson');
  ok(subs.every(x=>x.length<170),'short enough to read at a glance: max '+Math.max(...subs.map(x=>x.length))+' chars');
  const whys=await p.$$eval('[data-eswhy]',es=>es.length);
  ok(whys>=3,'and every option still offers Why?: '+whys);
  await p.$$eval('[data-eswhy]',es=>{const t=es[0];t&&t.click();}); await p.waitForTimeout(250);
  const why=await p.$eval('.es-whybox',e=>e.innerText.replace(/\s+/g,' '));
  console.log('   ',why.slice(0,130));
  ok(!/what this means/i.test(why),'Why? no longer repeats what is already on the option');
  ok(/what you would need to show/i.test(why),'it holds what would have to be proved');
  ok(/common mistake/i.test(why),'and what students do instead');
  ok(/→/.test(why),'the chain is shown as a chain');
  ok((await p.$$eval('.es-whybox .es-btn',es=>es.length))===1,'and the choice is made from inside the explanation');
  await p.$eval('.es-whybox .es-btn',e=>e.click()); await p.waitForTimeout(350);
  ok(!(await p.$('.es-whybox')),'choosing closes the reasoning panel');
  ok((await p.$$eval('.es-plancard.done',es=>es.length))>=1,'and records the choice');
  await p.screenshot({path:OUT+'shot-plan-learning.png'});

  console.log('6. the thesis appears once the plan can signpost something');
  const rest=await p.$$eval('.es-plancard',es=>es.map((e,i)=>i));
  for (let n=0;n<4;n++){
    if (await p.$('.es-thesis')) break;
    const picked=await p.$$eval('[data-esplanpick]',es=>{const t=es[0]; if(t){t.click();return true;} return false;});
    if(!picked) break;
    await p.waitForTimeout(300);
  }
  ok(!!(await p.$('.es-thesis')),'with all four chosen, the thesis section appears');
  const plan=await p.$$eval('.es-thesisplan li',es=>es.map(e=>e.innerText.replace(/\s+/g,' ')));
  console.log('   ',JSON.stringify(plan.slice(0,2)));
  ok(plan.length===4,'it shows what the essay will argue, area by area: '+plan.length);

  console.log('7. Compare is instant, authored, and never inserted');
  await p.fill('#esthesis','Target markets change what a business does with its marketing.');
  await p.click('#esthesissave'); await p.waitForTimeout(350);
  await p.click('#escompare'); await p.waitForTimeout(300);
  const cmp=await p.$eval('.es-compare',e=>e.innerText.replace(/\s+/g,' '));
  ok(/yours/i.test(cmp)&&/one acceptable thesis/i.test(cmp),'both are shown side by side');
  ok(!/band 6/i.test(cmp),'it is not labelled as a band: calibration, not intimidation');
  ok(/makes the target market the cause/i.test(cmp),'with a checklist to judge their own against');
  ok(/nothing here is written into your answer/i.test(cmp),'and says plainly that it is not inserted');
  const still=await p.$eval('#esthesis',e=>e.value);
  ok(/change what a business does/.test(still),'their own thesis is untouched by comparing');
  ok(calls===0,'no model call in any of it: '+calls);
  await p.screenshot({path:OUT+'shot-plan-compare.png'});

  console.log('8. the thesis becomes the introduction’s planned point');
  const intro=await p.evaluate(()=>{try{const s=JSON.parse(localStorage.getItem('marginal.essay.v1'));const bag=Object.values(s)[0];const d=bag.drafts[bag.drafts.length-1];const bl=(d.paras[0].blocks||[]);return {thesis:d.thesis,point:d.paras[0].point,role:d.paras[0].role,first:bl[0]&&bl[0].text,fromThesis:bl[0]&&bl[0].fromThesis};}catch(e){return String(e);}});
  ok(intro.role==='Introduction'&&intro.point===intro.thesis,'it travels with the draft rather than becoming a second object');
  ok(intro.first===intro.thesis,'and it IS the introduction\u2019s opening sentence, not a sentence to write again');
  ok(intro.fromThesis===true,'marked as having come from the plan, so editing it later is still theirs');

  console.log('pageerrors:',errs.join(' | ')||'none');
  ok(errs.length===0,'no page errors');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
