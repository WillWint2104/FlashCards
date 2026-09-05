// The verification gate: evidence without a recorded source is never offered to a
// student, and everything else about the paragraph keeps working without it.
const { chromium, T, OUT, BASE, fileUrl, usePractice, climbLadder, chooseQuestion } = require('./env');

// Waits that name their condition. This app fetches nothing and renders
// synchronously, so the effect of a click is present on the next frame:
// settled() is that frame, not a shorter guess at a duration.
const settled = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const here = (p, sel) => p.waitForSelector(sel, { timeout: 8000 });
const { planAll } = require('./env');
let pass=0,fail=0; const ok=(c,m)=>{ if(c) pass++; else {fail++; console.log('  FAIL:',m);} };
async function run(sourced){
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1500,height:1000},deviceScaleFactor:2})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  let calls=0; await p.route(/workers\.dev/, r=>{calls++;r.abort();});
  await p.goto(T); await here(p, '.navtab');
  if (sourced) await p.evaluate(()=>{ window.BUSCONTENT.evidence.marketing.forEach(e=>{e.source='test fixture source'; e.checked='2026-08-19';}); });
  await p.$$eval('.navtab',es=>{const t=es.find(x=>/Essay practice/i.test(x.textContent));t&&t.click();});
  await settled(p);
  await p.selectOption('#essubject','business_studies'); await settled(p);
  await chooseQuestion(p, /target markets/i);
  await settled(p);
  await p.click('#esstart');
  await p.waitForFunction(() => !!document.querySelector('#esline, .es-startrow, [data-espath]'), null, { timeout: 8000 });
  await planAll(p);
  await p.$$eval('.es-plancard [data-esplanarea]',es=>{const t=es.find(x=>/processes/i.test(x.textContent));t&&t.click();});
  await settled(p);
  await p.$$eval('[data-esplanpick]',es=>{const t=es.find(x=>/Convenience-oriented/i.test(x.textContent));t&&t.click();});
  await settled(p);
  const chips=await p.$$eval('.es-plancard .es-evchip',es=>es.length);
  const note=await p.$$eval('.es-planevnote',es=>es.map(e=>e.textContent.trim())).catch(()=>[]);
  await p.click('#esplango'); await settled(p);
  await p.$$eval('[data-esgo]',es=>{const t=es.find(x=>/Body 1/.test(x.textContent));t&&t.click();}); await settled(p);
  const evTool=await p.$eval('[data-estool="evidence"]',e=>e.disabled);
  let drawer='';
  if (!evTool) { await p.$eval('[data-estool="evidence"]',e=>e.click()); await settled(p);
    drawer=await p.$eval('.es-drawer-body',e=>e.innerText.replace(/\s+/g,' ').trim()); await p.click('#esdrawerx'); await settled(p); }
  const belt=await p.$$eval('.es-belt-b',es=>es.map(e=>({l:e.textContent.trim(),off:e.disabled})));
  // Climbed through the route that opens it: the first rung is behind "I am
  // stuck on this sentence" now, and #esmorehelp is the escalation after that.
  const rungs=await climbLadder(p);
  const guide=await p.$eval('.es-guidejob',e=>e.textContent.trim());
  const shot=OUT+'shot-evgate-'+(sourced?'sourced':'withheld')+'.png';
  await p.screenshot({path:shot});
  await b.close();
  return {chips, note, evTool, drawer, belt, rungs, guide, calls, errs};
}
(async()=>{
  console.log('--- with no sources recorded (the state of the bank today) ---');
  const a=await run(false);
  console.log('    plan chips:',a.chips,'| note:',JSON.stringify(a.note[0]||''));
  ok(a.chips===0,'nothing is offered in the plan: '+a.chips+' chips');
  ok(/no verified examples are available/i.test(a.note.join(' ')),'and it says why, in words a student would use');
  ok(/use your own/i.test(a.note.join(' ')),'their own evidence is still allowed');
  ok(!/checked source|withheld|unverified/i.test(a.note.join(' ')),'without exposing how the system thinks about it');
  console.log('    evidence drawer:',JSON.stringify(a.drawer.slice(0,150)));
  ok(/No verified evidence/i.test(a.drawer),'the drawer withholds rather than warns');
  // This used to assert the opposite: that the panel told the student how many
  // items were held back. That is authoring state. It names nothing the student
  // can act on and announces that the product is unfinished, which is not theirs
  // to carry, and it contradicted the assertion four lines above. The contract is
  // now the honesty rule itself, so removing the leak cannot silently regress.
  const leak = /\d+\s+items?\s+(is|are)\s+written|waiting on a checked source|withheld|unverified|candidate/i;
  ok(!leak.test(a.drawer),'no authoring state reaches the student: '+JSON.stringify((a.drawer.match(leak)||[""])[0]));
  ok(!leak.test(a.note.join(' ')),'nor anywhere in the plan copy');
  ok(!/McDonald/.test(a.drawer),'no unverified fact leaks into the drawer at all');
  console.log('    belt:',JSON.stringify(a.belt.map(x=>x.l+(x.off?'(off)':''))));
  ok(a.belt.filter(x=>/Learn|Arguments|Structure/.test(x.l)).every(x=>!x.off),'Learn, Arguments and Structure keep working');
  ok(a.rungs===5,'the help ladder is untouched: '+a.rungs+' rungs');
  ok(a.guide.length>20,'and so is the component guidance');

  console.log('--- once sources are recorded ---');
  const b=await run(true);
  console.log('    plan chips:',b.chips);
  ok(b.chips>0,'the same items become selectable: '+b.chips);
  ok(/For this argument/i.test(b.drawer),'and the drawer shows them with why they fit');
  ok(b.calls===0&&a.calls===0,'no model calls either way');
  ok(a.errs.length===0&&b.errs.length===0,'no page errors: '+[...a.errs,...b.errs].join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail?1:0);
})();
