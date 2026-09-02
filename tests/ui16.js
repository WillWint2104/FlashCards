// P1 reference area: Processes, end to end. Every component, every rung, every
// layer of support, and proof that the four help needs stay distinct.
const { chromium, T, OUT, BASE, fileUrl, usePractice, ladderOffered, climbLadder } = require('./env');

// Waits that name their condition. This app fetches nothing and renders
// synchronously, so the effect of a click is present on the next frame:
// settled() is that frame, not a shorter guess at a duration.
const settled = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const here = (p, sel) => p.waitForSelector(sel, { timeout: 8000 });
const { planAll } = require('./env');
let pass=0,fail=0; const ok=(c,m)=>{ if(c) pass++; else {fail++; console.log('  FAIL:',m);} };
const rungs = p => p.$$eval('.es-rung',es=>es.map(e=>({n:e.querySelector('.es-rungn').textContent.trim(),
  lbl:e.querySelector('.es-runglbl').textContent.trim(), txt:e.querySelector('.es-rungtext').textContent.trim(),
  kind:(e.className.match(/es-rung (\w+)/)||[])[1]||''})));
(async()=>{
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:1500,height:1000},deviceScaleFactor:2});
  await ctx.addInitScript(()=>{window.__C=0;addEventListener('click',()=>window.__C++,true);});
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,220)));
  let calls=0; await p.route(/workers\.dev/, r=>{ calls++; r.abort(); });
  await p.goto(T + '?eslegacy=1'); await here(p, '.navtab');
  // TEST FIXTURE: unsourced evidence is withheld by design, so the suite supplies
  // sources of its own rather than weakening the rule under test.
  await p.evaluate(()=>{ Object.keys((window.BUSCONTENT||{}).evidence||{}).forEach(k=>
    window.BUSCONTENT.evidence[k].forEach(e=>{ e.source='test fixture source'; e.checked='2026-08-19'; })); });
  await p.$$eval('.navtab',es=>{const t=es.find(x=>/Essay practice/i.test(x.textContent));t&&t.click();});
  await settled(p);
  await p.selectOption('#essubject','business_studies'); await settled(p);
  await usePractice(p); await p.$$eval('.es-qrow',es=>{const t=es.find(x=>/target markets/i.test(x.textContent));t&&t.click();});
  await settled(p);
  await p.click('#esstart');
  await p.waitForFunction(() => !!document.querySelector('#esline, .es-startrow, [data-espath]'), null, { timeout: 8000 });
  await planAll(p);

  console.log('1. three genuinely different processes pathways, each explained');
  await p.$$eval('.es-plancard [data-esplanarea]',es=>{const t=es.find(x=>/processes/i.test(x.textContent));t&&t.click();});
  await settled(p);
  const prOpts=await p.$$eval('.es-plancard [data-esplanpick]',es=>es.map(e=>e.textContent.trim()));
  console.log('    processes options:',prOpts.length);
  ok(prOpts.length>=3,'at least three defensible relationships: '+prOpts.length);
  // pick the convenience one for Body 1's processes slot
  await p.$$eval('[data-esplanpick]',es=>{const t=es.find(x=>/Convenience-oriented/i.test(x.textContent));t&&t.click();});
  await settled(p);
  await p.click('#esplango'); await settled(p);
  // go to the processes paragraph
  await p.$$eval('[data-esgo]',es=>{const t=es.find(x=>/Body 1/.test(x.textContent));t&&t.click();}); await settled(p);
  const arg=await p.$eval('.es-chip-arg',e=>e.textContent.trim());
  ok(/Convenience-oriented/.test(arg),'the processes argument travelled with the paragraph: '+arg.slice(0,34));

  console.log('2. every component has a pathway-specific guide AND a full ladder');
  const steps=[]; 
  for (let i=0;i<6;i++){
    const head=await p.$eval('.es-guideh',e=>e.textContent.trim()).catch(()=>null);
    if (!head) break;
    const job=await p.$eval('.es-guidejob',e=>e.textContent.trim());
    // The ladder opens from the stuck menu now; #esmorehelp is the escalation
    // once it is showing. Asked through the route, so this still measures
    // whether help is authored here and how deep it goes.
    const offered=await ladderOffered(p);
    let n=0;
    if (offered) { n=await climbLadder(p); }
    const kinds=(await rungs(p)).map(r=>r.kind).join(',');
    steps.push({head,job,offered,n,kinds});
    const hide=await p.$('#eshidehelp'); if (hide) { await hide.click(); await settled(p); }
    const ng=await p.$('#esnextguide'); if (!ng || await ng.evaluate(e=>e.disabled)) break;
    await ng.click(); await settled(p);
  }
  steps.forEach(s=>console.log('   ',s.head.padEnd(17),'help:'+(s.offered?'Y':'-'),'rungs:'+s.n,'|',s.kinds,'|',s.job.slice(0,54)));
  ok(steps.length===5,'the paragraph has five components: '+steps.length);
  ok(steps.every(s=>s.offered),'help is offered on every one of them');
  ok(steps.every(s=>s.n===5),'and every ladder goes the full five rungs: '+steps.map(s=>s.n).join(','));
  ok(steps.every(s=>/direction/.test(s.kinds)&&/starter/.test(s.kinds)&&/example/.test(s.kinds)),'each ladder carries a direction, a starter and a worked example');
  const jobs=steps.map(s=>s.job);
  ok(new Set(jobs).size===jobs.length,'no two components give the same guidance');
  await p.screenshot({path:OUT+'shot-p1-ladder.png'});

  console.log('3. the guidance actually changes when the argument changes');
  const before=steps.map(s=>s.job);
  await p.$eval('[data-esrestchange="argument"]',e=>e.click()); await settled(p);
  await p.$$eval('[data-espath]',es=>{const t=es.find(x=>/expect speed/i.test(x.textContent));t&&t.click();}); await settled(p);
  await p.click('#esstartwriting'); await settled(p);
  // switching the argument leaves the student where they were, so walk back to the
  // first component before comparing component for component
  for (let k=0;k<6;k++){ const bs=await p.$('#esbackstep'); if(!bs||await bs.evaluate(e=>e.disabled)) break; await bs.click(); await settled(p); }
  const after=[];
  for (let i=0;i<6;i++){
    const head=await p.$eval('.es-guideh',e=>e.textContent.trim()).catch(()=>null); if(!head) break;
    after.push(await p.$eval('.es-guidejob',e=>e.textContent.trim()));
    const ng=await p.$('#esnextguide'); if (!ng || await ng.evaluate(e=>e.disabled)) break;
    await ng.click(); await settled(p);
  }
  const changed=before.filter((x,i)=>after[i]&&after[i]!==x).length;
  console.log('    components whose guidance changed with the argument:',changed,'of',before.length);
  ok(changed===before.length,'all five components differ by pathway, not just explanation');
  // and so do the ladders
  await climbLadder(p);
  const speedLink=(await rungs(p)).map(r=>r.txt).join(' ');
  ok(/speed/i.test(speedLink),'the ladder itself is written for the chosen argument: '+speedLink.slice(0,60));

  console.log('4. the four help needs stay separate');
  const tools=await p.$$eval('.es-belt-b',es=>es.map(e=>({label:e.textContent.trim(),off:e.disabled})));
  console.log('    toolbelt:',JSON.stringify(tools.map(t=>t.label+(t.off?'(off)':''))));
  // Learn left the belt for the page header, where the global utilities live. The
  // need it answers is unchanged, so the assertion follows it there.
  const learnUtil=await p.$('[data-estool="understand"]');
  ok(!!learnUtil && !(await learnUtil.evaluate(e=>e.disabled)),'Learn is live: I do not understand the content');
  ok(tools.some(t=>/Arguments/.test(t.label)&&!t.off),'Arguments is live: I do not know what to argue');
  ok(tools.some(t=>/Evidence/.test(t.label)&&!t.off),'Evidence is live: I do not know what to use');
  // Not the button: by this point the ladder has been walked to its end, so
  // #esmorehelp is legitimately gone. Assert what the message claims instead.
  const helpPlace=await p.evaluate(()=>{
    const btns=document.querySelector('.es-help .es-helpbtns');
    if(!btns) return 'no per-line help block at all';
    const box=btns.closest('.es-help');
    if(box.closest('.es-drawer, .es-belt')) return 'help has moved into a drawer or the toolbelt';
    const wrap=box.parentElement;
    return (wrap && wrap.querySelector('.es-linerow')) ? '' : 'help is no longer beside the writing line';
  });
  ok(helpPlace==='','and help with this line stays under the line, not in the drawer: '+(helpPlace||'under the line'));
  const inDrawerHelp=await p.$$eval('.es-belt-b',es=>es.some(e=>/help/i.test(e.textContent)));
  ok(!inDrawerHelp,'help is deliberately not a tool');

  console.log('5. Learn teaches the concept at two depths, without leaving the line');
  await p.$eval('[data-estool="understand"]',e=>e.click()); await settled(p);
  const title=await p.$eval('.es-drawer-h',e=>e.textContent.trim());
  const quick=await p.$eval('.es-drawer-p',e=>e.textContent.trim());
  ok(/Processes/i.test(title),'it opens on the concept behind the paragraph: '+title);
  ok(quick.length>40&&quick.length<260,'it opens on one short explanation, not a chapter: '+quick.length+' chars');
  const surfaceRows=await p.$$eval('.es-gloss.surface dt',es=>es.length);
  ok(surfaceRows>=3,'and the parts of the concept are on the surface, not buried behind Read more: '+surfaceRows);
  ok(!!(await p.$('#esmoreread')),'and there is a deeper read behind it');
  await p.click('#esmoreread'); await settled(p);
  // Learn opens the Learning Centre now, so the deeper read is the Centre's own
  // disclosure rather than the drawer's. The contract below is unchanged: it is
  // still a real explanation, still names what students get wrong, still defines
  // terminology, and still refuses to write their case study for them.
  const deep=await p.$eval('[data-esllayerb="deeper"]',e=>e.innerText);
  ok(deep.length>1200,'read more is a real explanation: '+deep.length+' chars');
  ok(/easy to get wrong/i.test(deep),'including what students get wrong');
  ok(/a simple example/i.test(deep),'and a conceptual example');
  ok((await p.$$eval('.es-gloss dt',es=>es.length))>=5,'with terminology defined, not just listed');
  ok(!/mcdonald/i.test(deep),'and it teaches the concept without writing their case study for them');
  await p.screenshot({path:OUT+'shot-p1-learn.png'});
  await p.click('#eslx'); await settled(p);
  ok(!!(await p.$('#esline')),'closing puts them back on the sentence');

  console.log('6. Arguments explains what each option MEANS');
  await p.$eval('[data-estool="ideas"]',e=>e.click()); await settled(p);
  const ideas=await p.$$eval('.es-idea',es=>es.map(e=>({t:e.querySelector('b')?e.querySelector('b').textContent.trim():'',
    m:e.querySelector('span')?e.querySelector('span').textContent.trim():'', on:/on/.test(e.className)})));
  ok(ideas.length>=3,'the pathways for this part of the question: '+ideas.length);
  ok(ideas.every(i=>i.m.length>80),'each one says what the argument actually means');
  ok(ideas.some(i=>i.on),'and marks the one being argued');
  await p.screenshot({path:OUT+'shot-p1-arguments.png'});
  await p.click('#esdrawerx'); await settled(p);

  console.log('7. Evidence is filtered to the argument and honest about itself');
  await p.$eval('[data-estool="evidence"]',e=>e.click()); await settled(p);
  // only what is actually on screen: the browse-all block is collapsed
  const evs=await p.$$eval('.es-ev',es=>es.filter(e=>!e.closest('[hidden]')).map(e=>e.innerText));
  const hidden=await p.$$eval('.es-drawer-more[hidden] .es-ev',es=>es.length);
  console.log('    behind "browse all":',hidden);
  console.log('    evidence shown:',evs.length);
  ok(evs.length>0&&evs.length<=4,'the best few for this argument, not a generic list: '+evs.length);
  ok(evs.every(t=>/For this argument:/.test(t)),'each says why it fits THIS argument');
  // An item only reaches a student with both a source and a checked date, so
  // "no source recorded" can no longer appear on screen at all. What each item
  // carries now is exactly one status, never the old pair that said verified and
  // check-it-yourself in the same breath.
  const statuses=await p.$$eval('.es-ev',es=>es.map(e=>({
    ok:/Checked case study fact/.test(e.textContent),
    dated:/Check the current figure/.test(e.textContent)})));
  ok(statuses.every(x=>x.ok||x.dated),'every item shown carries a status');
  ok(statuses.every(x=>!(x.ok&&x.dated)),'and never both at once, which said two things to the student');
  ok(!/No source has been recorded/.test(evs.join(' ')),'nothing unsourced reaches the student to explain itself');
  ok(evs.some(t=>/does not/i.test(t)||/Say how/i.test(t)||/Use it for/i.test(t)),'with a limit on how far it can be pushed');
  ok(!!(await p.$('#esevall')),'browsing the whole bank is still possible');
  await p.screenshot({path:OUT+'shot-p1-evidence.png'});
  await p.click('#esdrawerx'); await settled(p);

  console.log('8. nothing is ever written for them');
  const inserts=await p.$$eval('.es-rung button',es=>es.map(e=>e.textContent.trim()));
  ok(inserts.length===0,'no rung carries an insert or apply control: '+JSON.stringify(inserts));
  const line=await p.$eval('#esline',e=>e.value);
  ok(line==='','the writing line is still empty after every layer of help was opened');
  ok(calls===0,'and none of it called a model: '+calls);

  console.log('9. an own argument keeps the support');
  await p.$eval('[data-esrestchange="argument"]',e=>e.click()); await settled(p);
  await p.click('[data-espathown]'); await settled(p);
  await p.fill('#esownarg','Customers who order in groups push the business to split how one order is paid for');
  await p.click('#esownok'); await settled(p);
  await p.click('#esstartwriting'); await settled(p);
  const ownArg=await p.$eval('.es-chip-arg',e=>e.textContent.trim());
  ok(/order in groups/.test(ownArg),'their own words are kept exactly: '+ownArg.slice(0,40));
  const ownTools=await p.$$eval('.es-belt-b',es=>es.map(e=>({l:e.textContent.trim(),off:e.disabled})));
  console.log('    tools on an own argument:',JSON.stringify(ownTools.map(t=>t.l+(t.off?'(off)':''))));
  ok(ownTools.filter(t=>!t.off).length>=3,'the support stack stays open on an own argument');
  const ownGuide=await p.$eval('.es-guidejob',e=>e.textContent.trim());
  ok(ownGuide.length>10,'component guidance still appears: '+ownGuide.slice(0,50));
  await p.$eval('[data-estool="evidence"]',e=>e.click()); await settled(p);
  const ownEv=await p.$$eval('.es-ev',es=>es.length);
  ok(ownEv>0,'and evidence is still offered, from the wider set: '+ownEv);
  await p.screenshot({path:OUT+'shot-p1-own.png'});
  await p.click('#esdrawerx'); await settled(p);

  console.log('10. how much permanent interface is on screen before asking for anything');
  const dens=await p.evaluate(()=>{
    const vis=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;};
    const all=[...document.querySelectorAll('.es-canvas button,.es-canvas input,.es-canvas textarea')].filter(vis);
    const words=t=>String(t||'').trim().split(/\s+/).filter(Boolean).length;
    return {controls:all.length, chrome:words(document.querySelector('.es-canvas').innerText)};
  });
  console.log('    permanent controls:',dens.controls,'| words of interface before any help is requested:',dens.chrome);

  console.log('pageerrors:',errs.join(' | ')||'none');
  ok(errs.length===0,'no page errors');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
