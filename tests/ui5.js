const { chromium, T, OUT, BASE, fileUrl } = require('./env');

// Waits that name their condition. This app fetches nothing and renders
// synchronously, so the effect of a click is present on the next frame:
// settled() is that frame, not a shorter guess at a duration.
const settled = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const here = (p, sel) => p.waitForSelector(sel, { timeout: 8000 });
let pass=0,fail=0; const ok=(c,m)=>{ if(c) pass++; else {fail++; console.log('  FAIL:',m);} };
(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1280,height:1000}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,220)));
  await p.route(/workers\.dev/, r=>r.abort());
  await p.goto(T); await here(p, '.navtab');

  console.log('--- boots to the hub, every access point present ---');
  ok(!!(await p.$('.hi')),'the hub renders');
  const tabs = await p.$$eval('.navtab',es=>es.map(e=>e.textContent.trim()));
  console.log('    tabs:', tabs.join(' | '));
  ok(tabs.some(t=>/test mode/i.test(t)),'Test mode tab is present');
  ok(tabs.some(t=>/study/i.test(t)),'Study tab is present');

  console.log('--- Test mode has a paper to sit ---');
  await p.$$eval('.navtab',es=>{const t=es.find(x=>/Test mode/i.test(x.textContent)); t&&t.click();});
  await settled(p);
  const papers = await p.$$eval('.exam-row, .area, .examcard',es=>es.map(e=>e.textContent.trim().slice(0,60))).catch(()=>[]);
  console.log('    listed:', JSON.stringify(papers).slice(0,200));
  const body = await p.$eval('#app',e=>e.textContent);
  ok(/Business Studies/.test(body),'the preloaded paper is listed');
  ok(!/no practice exams|nothing here/i.test(body),'Test mode is not an empty list');

  console.log('--- essay practice reachable from the hub ---');
  await p.$$eval('.navtab',es=>{const t=es.find(x=>/Study/i.test(x.textContent)); t&&t.click();});
  await settled(p);
  const hasEssay = await p.$eval('#app',e=>/Essay practice/i.test(e.textContent)).catch(()=>false);
  ok(hasEssay,'Essay practice entry is on the hub');

  console.log('pageerrors:', errs.join(' | ')||'none');
  ok(errs.length===0,'no page errors');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
