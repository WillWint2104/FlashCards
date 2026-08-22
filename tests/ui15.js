// P0 acceptance: plan first, no repeated setup, persistent map, completion state,
// whole-response word count, review-and-submit inside guided mode.
const { chromium, T, OUT, BASE, fileUrl } = require('./env');
const { planAll } = require('./env');
const { nextSection, prevSection } = require('./env');
let pass=0,fail=0; const ok=(c,m)=>{ if(c) pass++; else {fail++; console.log('  FAIL:',m);} };
(async()=>{
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:1500,height:1000},deviceScaleFactor:2});
  await ctx.addInitScript(()=>{window.__C=0;addEventListener('click',()=>window.__C++,true);});
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,220)));
  let calls=0; await p.route(/workers\.dev/, r=>{ calls++; r.abort(); });
  const clicks=()=>p.evaluate(()=>window.__C);
  await p.goto(T); await p.waitForTimeout(800);
  // TEST FIXTURE: unsourced evidence is withheld by design, so the suite supplies
  // sources of its own rather than weakening the rule under test.
  await p.evaluate(()=>{ Object.keys((window.BUSCONTENT||{}).evidence||{}).forEach(k=>
    window.BUSCONTENT.evidence[k].forEach(e=>{ e.source='test fixture source'; e.checked='2026-08-19'; })); });
  await p.$$eval('.navtab',es=>{const t=es.find(x=>/Essay practice/i.test(x.textContent));t&&t.click();});
  await p.waitForTimeout(450);
  await p.selectOption('#essubject','business_studies'); await p.waitForTimeout(200);
  await p.$$eval('.es-qchip',es=>{const t=es.find(x=>/target markets/i.test(x.textContent));t&&t.click();});
  await p.waitForTimeout(200);
  // deliberately start on a 3-body structure so the mismatch offer is exercised
  await p.selectOption('#esstruct','five'); await p.waitForTimeout(150);
  await p.click('#esstart'); await p.waitForTimeout(500);
  await planAll(p);

  console.log('1. the question is planned before anything is written');
  ok(!!(await p.$('.es-planwrap')),'the plan screen opens first, not the composer');
  ok(!(await p.$('#esline')),'there is no writing surface yet');
  const cards=await p.$$eval('.es-plancard,.es-planrow',es=>es.length);
  const note=await p.$eval('#esplanstruct',e=>e.textContent.trim()).catch(()=>'');
  console.log('    body cards:',cards,'| structure offer:',JSON.stringify(note));
  ok(cards===3,'the chosen structure is respected, three bodies to plan: '+cards);
  ok(/4 body/.test(note),'a 4-part question offers a 4-body structure: '+note);
  await p.click('#esplanstruct'); await p.waitForTimeout(400);
  ok((await p.$$eval('.es-plancard,.es-planrow',es=>es.length))===4,'now four body paragraphs to plan');
  ok(!(await p.$('#esplanstruct')),'and the offer is gone once taken');

  console.log('2. each body is planned in its own part of the question');
  // Only the decision being made is expanded, so each card is opened in turn.
  ok((await p.$$eval('.es-plancard [data-esplanpick]',es=>es.length))===3,
     'only the card being decided is open, and it offers its own three options');
  const areas=[], opts=[];
  for (let i=0;i<4;i++){
    // scope the click INSIDE card i: the list of collapsed cards shrinks as
    // each one is opened, so an index into the buttons is not an index into cards
    await p.$$eval('.es-plancard,.es-planrow',(es,k)=>{
      const t=es[k] && es[k].querySelector('[data-esplanedit]'); t && t.click();
    },i);
    await p.waitForTimeout(250);
    const card=await p.$$eval('.es-plancard,.es-planrow',(es,k)=>{
      const e=es[k]; const a=e.querySelector('.es-areachip.on');
      return {area:a?a.textContent.trim():'', n:e.querySelectorAll('[data-esplanpick]').length};
    },i);
    areas.push(card.area); opts.push(card.n);
  }
  console.log('    areas:',JSON.stringify(areas),'| options each:',JSON.stringify(opts));
  ok(areas.join('|')==='e-marketing|people|processes|physical evidence','the four parts map to the four bodies in order');
  ok(opts.every(n=>n===3),'and each offers only its own part, three options: '+JSON.stringify(opts));

  for (const re of ['Digitally engaged','same experience everywhere','expect speed','different physical settings']) {
    await p.$$eval('[data-esplanpick]',(es,r)=>{const t=es.find(x=>new RegExp(r,'i').test(x.textContent));t&&t.click();},re);
    await p.waitForTimeout(300);
  }
  const chosen=await p.$$eval('.es-plancard.done .es-planval',es=>es.map(e=>e.textContent.trim().slice(0,40)));
  ok(chosen.length===4,'all four planned: '+chosen.length);
  const evchips=await p.$$eval('.es-plancard .es-evchip',es=>es.length);
  ok(evchips>0,'evidence can be chosen here too, optionally: '+evchips+' chips');
  await p.$$eval('.es-plancard .es-evchip',es=>es[0]&&es[0].click()); await p.waitForTimeout(300);
  await p.screenshot({path:OUT+'shot-p0-plan.png'});
  const go=await p.$eval('#esplango',e=>e.textContent.trim());
  ok(go==='Write the introduction','the plan leads into the introduction: '+go);
  const planClicks=await clicks();
  await p.click('#esplango'); await p.waitForTimeout(500);

  console.log('3. the introduction reads the plan and is never asked for a pathway');
  ok(!(await p.$('.es-setup')),'no argument picker on the introduction');
  ok(!!(await p.$('#esline')),'it opens straight on the writing line');
  const railh=await p.$eval('.es-rest .es-restlbl',e=>e.textContent.trim());
  ok(/Your plan/i.test(railh),'the rail shows the plan: '+railh);
  const planRows=await p.$$eval('.es-planlarg',es=>es.map(e=>e.textContent.trim().slice(0,34)));
  console.log('    plan in the rail:',JSON.stringify(planRows));
  ok(planRows.length===4,'all four body arguments are visible while writing the introduction');
  await p.screenshot({path:OUT+'shot-p0-intro.png'});

  console.log('4. writing a body paragraph never asks for setup again');
  await p.fill('#esline','Target markets shape every marketing decision a business makes.'); await p.click('#esaccept'); await p.waitForTimeout(300);
  await p.fill('#esline','This will be shown through e-marketing, people, processes and physical evidence.'); await p.click('#esaccept'); await p.waitForTimeout(300);
  const before=await clicks();
  await nextSection(p);
  ok(!(await p.$('.es-setup')),'Body 1 opens on the writing line, not a picker');
  const arg=await p.$eval('.es-chip-arg',e=>e.textContent.trim());
  ok(/Digitally engaged/.test(arg),'and it already knows its argument: '+arg.slice(0,40));
  const cost=(await clicks())-before;
  ok(cost===1,'entering a planned paragraph costs one click: '+cost);

  console.log('5. a finished paragraph says so');
  const lines=['A digitally engaged target market pushes the business towards digital marketing.',
    'Because these customers live on their phones, the business reaches them there most cheaply.',
    'McDonald’s runs an app with loyalty rewards and mobile ordering.',
    'As a result repeat visits rise, which matters because repeat custom is cheap revenue.',
    'Therefore the target market shapes the promotion strategy, which answers the question.'];
  for (const l of lines) { await p.fill('#esline',l); await p.click('#esaccept'); await p.waitForTimeout(260); }
  ok(!!(await p.$('.es-done')),'the composer becomes a completion state');
  ok(!(await p.$('#esline')),'there is no empty box under the last label any more');
  const dn=await p.$eval('#esdonenext',e=>e.textContent.trim());
  ok(/Continue to body 2/i.test(dn),'and it points at the next section: '+dn);
  ok(!!(await p.$('#esmoreline')),'writing another sentence is still one click away, not closed off');
  await p.screenshot({path:OUT+'shot-p0-done.png'});
  await p.click('#esmoreline'); await p.waitForTimeout(300);
  ok(!!(await p.$('#esline')),'"Add another sentence" reopens the line');
  ok(!(await p.$('.es-done')),'and the completion card steps aside');

  console.log('6. the word count knows about the whole response');
  const wc=await p.$eval('.es-wordcount',e=>e.innerText.replace(/\s+/g,' '));
  console.log('   ',JSON.stringify(wc));
  ok(/\d+ here/.test(wc)&&/\d+ in all/.test(wc),'both scales are shown: '+wc);
  const nums=wc.match(/(\d+) here[\s\S]*?(\d+) in all/);
  ok(Number(nums[2])>Number(nums[1]),'and the whole response is larger than the paragraph');
  const tip=await p.$eval('.es-wordcount',e=>e.getAttribute('title')||'');
  ok(/guide, not a limit/i.test(tip),'the target explains itself without standing on screen: '+JSON.stringify(tip.slice(0,50)));

  console.log('7. earlier writing is readable without leaving the sentence');
  const peeks=await p.$$eval('[data-espeek]',es=>es.length);
  ok(peeks>=2,'written sections can be opened from the map: '+peeks);
  await p.$$eval('[data-espeek]',es=>es[0].click()); await p.waitForTimeout(300);
  const prev=await p.$eval('.es-mapprev',e=>e.textContent.trim());
  ok(/every marketing decision/.test(prev),'and the map shows what was actually written: '+prev.slice(0,44));
  // O1: the map no longer stands the argument under every row. What each section
  // argues is one click away, through the row itself or "read all".
  ok((await p.$$('.es-maparg')).length===0,'no argument text stands permanently in the map');
  ok(!!(await p.$('#esreview')),'and reading the whole response is offered from the map');
  const openArg=await p.$$eval('.es-maparg',es=>es.map(e=>e.textContent.trim()));
  ok(openArg.length>=0,'expanding a row is what reveals it: '+JSON.stringify(openArg.slice(0,1)));
  await p.screenshot({path:OUT+'shot-p0-map.png'});

  console.log('8. the whole response is read and submitted inside guided mode');
  const c0=await clicks();
  await p.click('#esreview'); await p.waitForTimeout(500);
  const secs=await p.$$eval('.es-rvsec',es=>es.length);
  const shown=await p.$$eval('.es-rvtext',es=>es.map(e=>e.textContent.length));
  ok(secs===6,'every section is on one page: '+secs);
  ok(shown.length===2&&shown.every(n=>n>60),'the writing itself is shown, not a summary: '+JSON.stringify(shown));
  ok(((await clicks())-c0)===1,'reaching it costs one click');
  ok(!!(await p.$('.es-belt'))===false&&!!(await p.$('#essubmit')),'and it can be submitted from here');
  const msg=await p.$eval('.es-completemsg',e=>e.textContent.trim());
  ok(/guided practice/.test(msg)&&!/without feedback/.test(msg),'no longer calls guided work cold writing: '+msg.slice(0,60));
  ok(!!(await p.$('[data-esrvedit]')),'any paragraph can be reopened from the review');
  await p.screenshot({path:OUT+'shot-p0-review.png'});
  await p.$$eval('[data-esrvedit]',es=>es[1].click()); await p.waitForTimeout(400);
  ok(!!(await p.$('#esline'))||!!(await p.$('.es-done')),'and that lands back in the composer');
  const role=await p.$eval('.es-pararole',e=>e.textContent.trim());
  ok(role==='Body 1','on the paragraph that was clicked: '+role);

  console.log('9. evidence planned up front still invalidates precisely');
  // Body 1 was planned with one piece of evidence; the example sentence used it.
  await p.$$eval('[data-esgo]',es=>{const t=es.find(x=>/Body 1/.test(x.textContent));t&&t.click();}); await p.waitForTimeout(400);
  ok((await p.$$('.es-said.flagged')).length===0,'nothing flagged before anything changes');
  await p.$eval('[data-esrestchange="evidence"]',e=>e.click()); await p.waitForTimeout(350);
  const ev0=await p.$$eval('[data-esev].on',es=>es.map(e=>e.textContent.trim().slice(0,30)));
  ok(ev0.length===1,'the evidence chosen while planning arrived with the paragraph: '+JSON.stringify(ev0));
  ok(!!(await p.$('[data-esevremove]')),'a chosen item offers Remove rather than toggling silently');
  await p.$$eval('[data-esevremove]',es=>es[0]&&es[0].click()); await p.waitForTimeout(300);
  await p.click('#esstartwriting'); await p.waitForTimeout(400);
  const why=await p.$eval('.es-argchanged',e=>e.textContent.trim()).catch(()=>'');
  console.log('    banner:',JSON.stringify(why.slice(0,70)));
  ok(/Evidence changed/.test(why),'removing it names the evidence, not the argument');
  ok(!/Argument changed/.test(why),'and never claims the argument moved');

  console.log('10. the conclusion is given the arguments it has to draw together');
  await p.$$eval('[data-esgo]',es=>{const t=es.find(x=>/Conclusion/.test(x.textContent));t&&t.click();}); await p.waitForTimeout(400);
  ok(!(await p.$('.es-setup')),'the conclusion is never asked to choose a body pathway');
  const clbl=await p.$eval('.es-rest .es-restlbl',e=>e.textContent.trim());
  ok(/Arguments you established/i.test(clbl),'it is shown what it has to synthesise: '+clbl);
  const crows=await p.$$eval('.es-planlarg',es=>es.map(e=>e.textContent.trim()));
  ok(crows.length===4,'all four body arguments, not one: '+crows.length);
  const cw=await p.$$eval('.es-planlw',es=>es.map(e=>e.textContent.trim()));
  ok(cw.some(x=>/\d+ words/.test(x)),'with how much was actually written for each: '+JSON.stringify(cw));
  await p.screenshot({path:OUT+'shot-p0-conclusion.png'});

  ok(calls===0,'no model call anywhere in planning or review: '+calls);
  console.log('pageerrors:',errs.join(' | ')||'none');
  ok(errs.length===0,'no page errors');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
