const { chromium, T, OUT, BASE, fileUrl } = require('./env');
const { planAll } = require('./env');
const { nextSection, prevSection } = require('./env');
let pass=0,fail=0; const ok=(c,m)=>{ if(c) pass++; else {fail++; console.log('  FAIL:',m);} };
(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1500,height:1080},deviceScaleFactor:2})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,220)));
  let calls=0; await p.route(/workers\.dev/, r=>{ calls++; r.abort(); });
  await p.goto(T); await p.waitForTimeout(800);
  // TEST FIXTURE: unsourced evidence is withheld by design, so the suite supplies
  // sources of its own rather than weakening the rule under test.
  await p.evaluate(()=>{ Object.keys((window.BUSCONTENT||{}).evidence||{}).forEach(k=>
    window.BUSCONTENT.evidence[k].forEach(e=>{ e.source='test fixture source'; e.checked='2026-08-19'; })); });
  await p.$$eval('.navtab',es=>{const t=es.find(x=>/Essay practice/i.test(x.textContent));t&&t.click();});
  await p.waitForTimeout(500);
  await p.selectOption('#essubject','business_studies').catch(()=>{});
  await p.waitForTimeout(250);
  await p.$$eval('.es-qrow',es=>{const t=es.find(x=>/target markets/i.test(x.textContent));t&&t.click();});
  await p.waitForTimeout(300);
  await p.click('#esstart'); await p.waitForTimeout(400);
  // this suite tests the per-paragraph route, which the start surface offers
  await p.click('#esstartintro'); await p.waitForTimeout(400);
  await nextSection(p);
  await p.fill('#espoint','How the target market affects e-marketing.'); await p.waitForTimeout(300);

  console.log('--- argument comes first ---');
  ok(!!(await p.$('.es-setup')),'the paragraph asks for an argument before writing');
  const opts = await p.$$eval('.es-pick',es=>es.map(e=>e.textContent.trim().slice(0,60)));
  console.log('    options:', opts.slice(0,4).join(' | '));
  const rel = opts.filter(o=>!/Write my own/i.test(o));
  ok(rel.length>=2,'several relationships offered besides writing your own: '+rel.length);
  ok(opts.some(o=>/Write my own/i.test(o)),'writing your own is offered');
  const sub = await p.$eval('.es-setupsub',e=>e.textContent);
  ok(/relationship to argue, not a sentence/i.test(sub),'it says a relationship, not a sentence');
  ok(!(await p.$('#esline')),'no writing surface until the argument is chosen');

  console.log('--- evidence is filtered by the argument ---');
  await p.$$eval('[data-espath]',es=>{const t=es.find(x=>/Digitally engaged/i.test(x.textContent));t&&t.click();});
  await p.waitForTimeout(400);
  const evs = await p.$$eval('[data-esev]',es=>es.map(e=>e.querySelector('.es-pickrel').textContent.trim()));
  console.log('    compatible evidence:', evs.join(' | '));
  ok(evs.length>0 && evs.length<=4,'only compatible items, not the whole bank: '+evs.length);
  ok(evs.some(e=>/App, loyalty/.test(e)),'and they are the right ones');
  const pickedEv = await p.$$eval('[data-esev]',es=>{
    if(!es[0]) return null;
    es[0].click(); const r=es[0].querySelector('.es-pickrel'); return r?r.textContent.trim():null;
  });
  await p.waitForTimeout(300);
  await p.click('#esstartwriting'); await p.waitForTimeout(400);

  console.log('--- selections are context, never text ---');
  ok(!!(await p.$('#esline')),'writing starts');
  const prose = await p.$eval('.es-prose',e=>e.textContent.trim());
  ok(!/Digitally engaged/.test(prose),'the argument was not written into the response: '+JSON.stringify(prose.slice(0,50)));
  ok((await p.$eval('#esline',e=>e.value))==='','and the input is empty');

  console.log('--- the resting rail shows the paragraph context ---');
  ok(!!(await p.$('.es-rest')),'the rail is the resting state, not coach prose');
  const rail = await p.$eval('.es-cols',e=>e.textContent);   // argument and evidence are chips now
  ok(/Digitally engaged/.test(rail),'it shows the chosen argument');
  ok(!!pickedEv&&rail.indexOf(pickedEv)>=0,'and the evidence they actually chose: '+JSON.stringify(pickedEv));
  // Where they are is now the compact stage line above the writing, not a heading
  // in the rail: "topic 1/5" rather than "This paragraph".
  // Stage progress is owned by the composer header, which carries the stepper.
  const stage = await p.$eval('.es-stepn', e => e.textContent.trim()).catch(() => '');
  ok(/\d+\s*\/\s*\d+/.test(stage), 'and where they are: ' + JSON.stringify(stage));
  await p.screenshot({path:OUT+'shot-phasec-rest.png'});

  console.log('--- the guide changed because of the choice ---');
  const guide = await p.$eval('.es-guidejob',e=>e.textContent.trim());
  console.log('    guide:', guide.slice(0,90));
  ok(/highly engaged with digital|digital channels|relationship/i.test(guide),'the guide is the authored pathway guide, not the generic job');

  console.log('--- opening a tool does not shift the page ---');
  // The shell now takes the whole column so nothing stands empty, and the card is
  // centred inside it, so opening a tool re-centres the card. What must not change
  // is its WIDTH: the student's text does not reflow to make room for a resource,
  // which is the promise this assertion was written to protect. The card is capped
  // at the width that still fits with a tool open, so it never rewraps.
  const w0 = await p.$eval('.es-flow',e=>Math.round(e.getBoundingClientRect().width));
  const t0 = await p.$eval('#esline',e=>Math.round(e.getBoundingClientRect().width));
  await p.click('[data-estool="evidence"]'); await p.waitForTimeout(350);
  const w1 = await p.$eval('.es-flow',e=>Math.round(e.getBoundingClientRect().width));
  const t1 = await p.$eval('#esline',e=>Math.round(e.getBoundingClientRect().width));
  ok(w0===w1,'the writing card keeps its width when a tool opens: '+w0+' -> '+w1);
  ok(t0===t1,'so the sentence being written never rewraps: '+t0+' -> '+t1);
  const drawer = await p.$eval('.es-drawer-body',e=>e.textContent);
  ok(/Your evidence/.test(drawer),'the Evidence drawer separates what is selected');
  await p.screenshot({path:OUT+'shot-phasec-drawer.png'});
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);

  console.log('--- Understand follows the authored concept, not the prose ---');
  await p.click('[data-estool="understand"]'); await p.waitForTimeout(350);
  const uh = await p.$eval('.es-drawer-h',e=>e.textContent.trim());
  console.log('    understand:', uh);
  ok(/e-marketing/i.test(uh),'it opened the concept the pathway names: '+uh);
  await p.keyboard.press('Escape'); await p.waitForTimeout(250);

  console.log('--- changing the argument flags each sentence, with no clear-all ---');
  await p.fill('#esline','Customers who are online a lot see more of the brand there.');
  await p.click('#esaccept'); await p.waitForTimeout(300);
  await p.fill('#esline','This shapes where the business advertises.');
  await p.click('#esaccept'); await p.waitForTimeout(300);
  await p.$eval('[data-esrestchange="argument"]',e=>e.click()); await p.waitForTimeout(350);
  await p.$$eval('[data-espath]',es=>{const t=es.find(x=>/Value-conscious/i.test(x.textContent));t&&t.click();});
  await p.waitForTimeout(350);
  await p.click('#esstartwriting'); await p.waitForTimeout(400);
  ok(!!(await p.$('.es-argchanged')),'a banner names the change');
  const banner = await p.$eval('.es-argchanged',e=>e.textContent);
  ok(/2 sentences/.test(banner) && /Argument changed/.test(banner),'and how many sentences it affects: '+banner.slice(0,70));
  const flagged = await p.$$('.es-said.flagged');
  ok(flagged.length===2,'both sentences are marked individually: '+flagged.length);
  const perSentence = await p.$$('[data-esok]');
  ok(perSentence.length===2,'each has its own confirm, there is no single clear-all: '+perSentence.length);
  await p.$$eval('[data-esok]',es=>es[0].click()); await p.waitForTimeout(350);
  ok((await p.$$('.es-said.flagged')).length===1,'confirming one leaves the other flagged');

  console.log('--- still no model calls ---');
  ok(calls===0,'zero worker calls through all of Phase C: '+calls);
  console.log('pageerrors:', errs.join(' | ')||'none');
  ok(errs.length===0,'no page errors');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
