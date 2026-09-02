const { chromium, T, OUT, BASE, fileUrl, usePractice } = require('./env');

// Waits that name their condition. This app fetches nothing and renders
// synchronously, so the effect of a click is present on the next frame:
// settled() is that frame, not a shorter guess at a duration.
const settled = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const here = (p, sel) => p.waitForSelector(sel, { timeout: 8000 });
const { nextSection, prevSection } = require('./env');
let pass=0,fail=0; const ok=(c,m)=>{ if(c) pass++; else {fail++; console.log('  FAIL:',m);} };
const rungs = p => p.$$eval('.es-rung',es=>es.map(e=>({n:e.querySelector('.es-rungn').textContent.trim(),
  lbl:e.querySelector('.es-runglbl').textContent.trim(), txt:e.querySelector('.es-rungtext').textContent.trim(), kind:e.className})));
(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1500,height:1080},deviceScaleFactor:2})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,220)));
  let calls=0; await p.route(/workers\.dev/, r=>{ calls++; r.abort(); });
  await p.goto(T); await here(p, '.navtab');
  // TEST FIXTURE: unsourced evidence is withheld by design, so the suite supplies
  // sources of its own rather than weakening the rule under test.
  await p.evaluate(()=>{ Object.keys((window.BUSCONTENT||{}).evidence||{}).forEach(k=>
    window.BUSCONTENT.evidence[k].forEach(e=>{ e.source='test fixture source'; e.checked='2026-08-19'; })); });
  await p.$$eval('.navtab',es=>{const t=es.find(x=>/Essay practice/i.test(x.textContent));t&&t.click();});
  await settled(p);
  await p.selectOption('#essubject','business_studies').catch(()=>{}); await settled(p);
  await usePractice(p); await p.$$eval('.es-qrow',es=>{const t=es.find(x=>/target markets/i.test(x.textContent));t&&t.click();}); await settled(p);
  await p.click('#esstart');
  await p.waitForFunction(() => !!document.querySelector('#esline, .es-startrow, [data-espath]'), null, { timeout: 8000 });
  // this suite tests the per-paragraph route, which the start surface offers
  await p.click('#esstartintro'); await settled(p);
  await nextSection(p);
  await p.fill('#espoint','How the target market affects e-marketing.'); await settled(p);

  console.log('1-2. select argument A and evidence A');
  await p.$$eval('[data-espath]',es=>{const t=es.find(x=>/Digitally engaged/i.test(x.textContent));t&&t.click();}); await settled(p);
  const evA = await p.$$eval('[data-esev]',es=>{ const t=es.find(x=>/App, loyalty/.test(x.textContent))||es[0]; t.click(); return t.querySelector('.es-pickrel').textContent.trim(); });
  await settled(p);
  await p.click('#esstartwriting'); await settled(p);
  const argChip=await p.$eval('.es-chip-arg',e=>e.textContent.trim()).catch(()=>'');
  const evChip=await p.$eval('.es-chip-ev',e=>e.textContent.trim()).catch(()=>'');
  ok(/Digitally engaged/i.test(argChip)&&!(await p.$('.es-chip-ev.empty'))&&!!evChip,
     'argument and evidence A selected: '+evA+' | '+argChip+' / '+evChip);

  console.log('3-4. reach Explain, L0 only');
  await p.click('#esnextguide'); await settled(p);
  const step = await p.$eval('.es-guideh',e=>e.textContent.trim());
  ok(/EXPLANATION|EXPLAIN/i.test(step),'on the explain step: '+step);
  ok((await rungs(p)).length===0,'nothing but the guide shows by default');
  // The generic opener is gone. Help is reached through "I am stuck on this
  // sentence", a menu of routes anchored to the sentence, and #esmorehelp is the
  // escalation once the ladder is showing. What this block still checks is what
  // it always checked: nothing is given until it is asked for, and after that the
  // ladder is revealed a rung at a time, never all at once.
  ok(!!(await p.$('#esstuck')),'help is offered but not given');
  await p.click('#esstuck'); await settled(p);
  const jobRow = await p.$('[data-esstuck="job"]:not([disabled])');
  ok(!!jobRow,'the stuck menu offers the rung that says what this sentence has to do');
  await jobRow.click(); await here(p,'.es-rung'); await settled(p);
  const opened = (await rungs(p)).length;
  ok(opened>0 && opened<5,'it opens the ladder at that rung, not at the end of it: '+opened+' rung(s)');

  console.log('5. reveal the rest, one at a time');
  const seen=[];
  for (let i=opened;i<6;i++){
    const btn=await p.$('#esmorehelp'); if(!btn) break;
    const label=await btn.textContent();
    await btn.click(); await settled(p);
    const r=await rungs(p);
    seen.push({pressed:label.trim(), count:r.length});
    ok(r.length===i+1,'press '+(i+1-opened+1)+' shows exactly '+(i+1)+' rung(s), got '+r.length);
  }
  const all=await rungs(p);
  console.log('    ladder:', all.map(r=>r.n+' '+r.lbl.split(' ').slice(0,4).join(' ')).join(' | '));
  console.log('    buttons:', seen.map(s=>s.pressed).join(' -> '));
  ok(all.length>=4,'the ladder went at least four rungs deep: '+all.length);

  console.log('6. zero model calls');
  ok(calls===0,'no worker call for any rung: '+calls);

  console.log('7. L3 still requires meaningful student content');
  const frame=all.find(r=>/frame/.test(r.kind));
  ok(!!frame,'a scaffold frame is shown');
  const holes=await p.$$eval('.es-rung.frame .es-hole',es=>es.map(e=>e.textContent.trim()));
  ok(holes.length>=2,'it leaves at least two meaningful blanks: '+JSON.stringify(holes));
  ok(holes.some(h=>/target-market|strategy|effect|expects|process|result/i.test(h)),'and the blanks are the content, not the grammar');

  console.log('8-9. L5 is a different context and cannot be inserted');
  const ex=all.find(r=>/example/.test(r.kind));
  ok(!!ex,'a level 5 example is shown');
  ok(!/mcdonald/i.test(ex.txt),"it is NOT in the student's own context: "+ex.txt.slice(0,60));
  const ctx=await p.$eval('.es-rung.example .es-rungctx',e=>e.textContent.trim()).catch(()=>'');
  ok(ctx.length>0,'and it declares its context: '+ctx);
  const inserts=await p.$$eval('.es-rung.example button',es=>es.map(e=>e.textContent.trim()));
  ok(inserts.length===0,'there is no insert or apply control on it: '+JSON.stringify(inserts));

  console.log('10-11. help state belongs to the sentence');
  await p.fill('#esline','Because this group is online constantly, the business advertises there.');
  await p.click('#esaccept'); await settled(p);
  ok((await rungs(p)).length===0,'a fresh sentence starts with no help showing');
  await p.$$eval('.es-said',es=>es[es.length-1].click()); await settled(p);
  const reopened=await rungs(p);
  ok(reopened.length===all.length,'reopening the sentence restores the help level it was written at: '+reopened.length+' vs '+all.length);
  await p.click('[data-escanceledit]').catch(async()=>{ await p.$$eval('[data-escanceledit]',es=>es[0].click()); });
  await settled(p);

  console.log('12-15. change the argument');
  await p.$eval('[data-esrestchange="argument"]',e=>e.click()); await settled(p);
  await p.$$eval('[data-espath]',es=>{const t=es.find(x=>/Convenience-oriented/i.test(x.textContent));t&&t.click();}); await settled(p);
  await p.click('#esstartwriting'); await settled(p);
  const prose=await p.$eval('.es-prose',e=>e.textContent);
  ok(/online constantly/.test(prose),"the student's writing is untouched");
  ok((await p.$$('.es-said.flagged')).length===1,'the sentence is flagged for review');
  await p.$$eval('.es-said',es=>es[es.length-1].click()); await settled(p);
  ok((await rungs(p)).length===0,'stale help from the previous argument is NOT shown under it');
  await p.$$eval('[data-escanceledit]',es=>es[0].click()); await settled(p);

  console.log('16. changing evidence flags only what used it');
  await p.$eval('[data-esrestchange="argument"]',e=>e.click()); await settled(p);
  await p.$$eval('[data-espath]',es=>{const t=es.find(x=>/Digitally engaged/i.test(x.textContent));t&&t.click();}); await settled(p);
  await p.$$eval('[data-esev]',es=>{const t=es.find(x=>/App, loyalty/.test(x.textContent))||es[0]; t.click();}); await settled(p);
  await p.click('#esstartwriting'); await settled(p);
  await p.$$eval('[data-esok]',es=>es.forEach(e=>e.click())); await settled(p);
  // one sentence that names the evidence, one that does not
  await p.click('#esnextguide').catch(()=>{}); await settled(p);
  await p.fill('#esline','The business runs an app with loyalty rewards and mobile ordering for these customers.');
  await p.click('#esaccept'); await settled(p);
  await p.fill('#esline','This choice follows directly from what the target market expects.');
  await p.click('#esaccept'); await settled(p);
  ok((await p.$$('.es-said.flagged')).length===0,'nothing flagged before the evidence changes');
  await p.$eval('[data-esrestchange="evidence"]',e=>e.click()); await settled(p);
  // removing evidence is a labelled action now, not a second click on the chosen item
  await p.$$eval('[data-esevremove]',es=>{const t=es.find(x=>/./.test(x.textContent)); t&&t.click();}); await settled(p);
  await p.click('#esstartwriting'); await settled(p);
  const flaggedTexts=await p.$$eval('.es-said.flagged',es=>es.map(e=>e.textContent.trim()));
  console.log('    flagged:', JSON.stringify(flaggedTexts));
  ok(flaggedTexts.length===1,'exactly one sentence flagged: '+flaggedTexts.length);
  ok(/loyalty rewards/.test(flaggedTexts[0]||''),'and it is the one that used that evidence');
  const why=await p.$eval('.es-checkline',e=>e.textContent.trim());
  ok(/rested on evidence you removed/.test(why),'the reason names the EVIDENCE, not the argument: '+why.slice(0,50));
  const banner2=await p.$eval('.es-argchanged',e=>e.textContent);
  ok(/Evidence changed/.test(banner2) && !/Argument changed/.test(banner2),'and the banner says so too: '+banner2.slice(0,60));

  await p.screenshot({path:OUT+'shot-ladder.png'});
  ok(calls===0,'still zero model calls across the whole pathway: '+calls);
  console.log('pageerrors:', errs.join(' | ')||'none');
  ok(errs.length===0,'no page errors');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
