// the plain build on purpose: this suite tests the shipped defaults
const { chromium, P: T, OUT } = require('./env');
let pass=0,fail=0; const ok=(c,m)=>{ if(c) pass++; else {fail++; console.log('  FAIL:',m);} };
(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:2})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,220)));
  let calls=0;
  await p.route(/workers\.dev/, r=>{ calls++; r.abort(); });
  await p.goto(T+'?essaydemo=1'); await p.waitForTimeout(700);
  await p.fill('#esq','Explain how target markets affect e-marketing, people, processes and physical evidence.');
  await p.click('#esstart'); await p.waitForTimeout(500);

  console.log('--- the composer, not a textarea + instruction card ---');
  ok(!!(await p.$('#esline')),'there is ONE active sentence input');
  ok(!(await p.$('#espara')),'the giant paragraph textarea is gone');
  ok(!!(await p.$('.es-guide')),'a guide sits with the active sentence');
  ok(!!(await p.$('.es-map')),'the response map is present');
  const guideHead = await p.$eval('.es-guideh',e=>e.textContent.trim());
  const guideJob = await p.$eval('.es-guidejob',e=>e.textContent.trim());
  console.log('    step 1:', guideHead, '|', guideJob);
  ok(guideJob.length>15,'the guide states the job for THIS sentence');

  console.log('--- write a sentence: it becomes prose, the guide moves on ---');
  await p.fill('#esline','Target markets are the specific groups a business directs its marketing towards.');
  await p.click('#esaccept'); await p.waitForTimeout(400);
  const prose = await p.$eval('.es-prose',e=>e.textContent.trim());
  ok(/Target markets are the specific groups/.test(prose),'the sentence is now prose: '+prose.slice(0,50));
  ok((await p.$eval('#esline',e=>e.value))==='','the input is empty and ready for the next one');
  const head2 = await p.$eval('.es-guideh',e=>e.textContent.trim());
  ok(head2!==guideHead,'the guide advanced to the next step: '+guideHead+' -> '+head2);
  const box = await p.$('.es-said');
  ok(!!box,'the accepted sentence is clickable prose, not an input');

  console.log('--- the guide sits BELOW the active line, not below the whole answer ---');
  const geo = await p.evaluate(()=>{
    const l=document.querySelector('#esline').getBoundingClientRect();
    const g=document.querySelector('.es-guide').getBoundingClientRect();
    const pr=document.querySelector('.es-prose').getBoundingClientRect();
    return {lineTop:l.top,guideTop:g.top,guideBottom:g.bottom,proseTop:pr.top,gap:g.top-l.bottom};
  });
  // The instruction leads the writing now. The intent this block always protected
  // is that the guide travels with the cursor rather than drifting to the bottom of
  // the answer; only the side of the box it sits on has changed.
  ok(geo.guideTop<geo.lineTop,'the instruction comes before the writing box');
  ok(geo.lineTop-geo.guideBottom<60,'and is bound to it, not floating: '+Math.round(geo.lineTop-geo.guideBottom)+'px');
  const oneJob = await p.$$eval('.es-guidejob',es=>es.length);
  ok(oneJob===1,'there is exactly one active instruction, not a copy underneath: '+oneJob);
  ok(geo.proseTop<geo.lineTop,'with the prose above the line');

  console.log('--- another sentence at this stage keeps the step ---');
  const before = await p.$eval('.es-guideh',e=>e.textContent.trim());
  ok(await p.$eval('#essamestep',e=>e.hidden),'staying at a stage is not offered until there is a sentence to add');
  await p.fill('#esline','This second sentence stays at the same stage.'); await p.waitForTimeout(200);
  ok(!(await p.$eval('#essamestep',e=>e.hidden)),'and it appears once there is');
  await p.click('#essamestep'); await p.waitForTimeout(200);
  ok((await p.$eval('#esline',e=>e.value)).length>0,'arming it does not throw away what they typed');
  ok((await p.$eval('.es-guideh',e=>e.textContent.trim()))===before,'the step held');
  await p.click('#esaccept'); await p.waitForTimeout(400);
  ok((await p.$eval('.es-guideh',e=>e.textContent.trim()))===before,'and it is still the same stage after adding');
  ok((await p.$$('.es-said')).length===2,'two sentences of prose now');

  console.log('--- a question with nothing authored offers no ladder, rather than filler ---');
  // This suite writes a question the student typed, so no pathway and no authored
  // ladder exist for it. The rule is the same as the toolbelt's: absent content
  // means the offer is withheld, never generated and never padded out.
  ok((await p.$$('.es-rung')).length===0,'nothing extra shows by default');
  ok(!(await p.$('#esmorehelp')),'and no help is offered where none has been written');
  ok(!(await p.$('.es-help')),'the help block is absent rather than empty');
  ok((await p.$eval('.es-guidejob',e=>e.textContent.trim())).length>10,'the component guide still does its job on its own');
  ok(calls===0,'ZERO model calls while writing: '+calls);

  console.log('--- reopen an accepted sentence ---');
  await p.click('.es-said'); await p.waitForTimeout(300);
  ok(!!(await p.$('[data-esedit="0"]')),'clicking prose reopens that sentence');
  await p.fill('[data-esedit="0"]','Target markets are the groups a business aims its marketing at.');
  await p.click('[data-essaveedit="0"]'); await p.waitForTimeout(400);
  ok(/aims its marketing at/.test(await p.$eval('.es-prose',e=>e.textContent)),'the edit stuck');
  ok((await p.$$('.es-said')).length===2,'and the other sentence survived');

  console.log('--- the single draft is intact: full attempt sees the same text ---');
  await p.click('#esmodeswitch'); await p.waitForTimeout(450);
  const full = await p.$eval('#esfull',e=>e.value);
  ok(/aims its marketing at/.test(full) && /stays at the same stage/.test(full),'both sentences round-tripped into the one draft');
  await p.click('#esmodeswitch'); await p.waitForTimeout(450);
  ok((await p.$$('.es-said')).length===2,'and back again with the blocks intact');

  await p.screenshot({path:OUT+'shot-composer.png'});
  console.log('pageerrors:', errs.join(' | ')||'none');
  ok(errs.length===0,'no page errors');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
