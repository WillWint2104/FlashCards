const { chromium, T, OUT, BASE, fileUrl, ownQuestion } = require('./env');

// Waits that name their condition. This app fetches nothing and renders
// synchronously, so the effect of a click is present on the next frame:
// settled() is that frame, not a shorter guess at a duration.
const settled = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const here = (p, sel) => p.waitForSelector(sel, { timeout: 8000 });
let pass=0,fail=0; const ok=(c,m)=>{ if(c) pass++; else {fail++; console.log('  FAIL:',m);} };
(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1280,height:1000},deviceScaleFactor:2})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,220)));
  await p.route(/workers\.dev/, r=>r.abort());
  await p.goto(T); await here(p, '.navtab');

  console.log('--- sit the paper ---');
  await p.$$eval('.navtab',es=>{const t=es.find(x=>/Test mode/i.test(x.textContent)); t&&t.click();});
  await settled(p);
  await p.$$eval('button, .area',es=>{const t=es.find(x=>/^Sit\b|Sit /i.test(x.textContent.trim())); t&&t.click();});
  await settled(p);
  let txt = await p.$eval('#app',e=>e.textContent.slice(0,300));
  console.log('    after Sit:', JSON.stringify(txt.replace(/\s+/g,' ').slice(0,150)));
  ok(/section|multiple choice|question/i.test(txt),'the paper opens into a section picker or the first section');
  await p.screenshot({path:OUT+'shot-test-mode.png'});

  // walk into whatever the first actionable control is
  const started = await p.evaluate(()=>{
    const b=[...document.querySelectorAll('button')].find(x=>/start|begin|sit|continue|next/i.test(x.textContent));
    if(b){ b.click(); return b.textContent.trim(); } return null;
  });
  await settled(p);
  console.log('    clicked:', started);
  txt = await p.$eval('#app',e=>e.textContent);
  ok(txt.length>200,'a question screen renders');
  await p.screenshot({path:OUT+'shot-test-question.png'});

  console.log('--- essay practice, guidance before writing ---');
  await p.goto(T); await here(p, '.navtab');
  await p.$$eval('.navtab',es=>{const t=es.find(x=>/Essay practice/i.test(x.textContent)); t&&t.click();});
  await settled(p);
  ok(!!(await p.$('#esq')),'essay setup opens from the tab');
  const subj = await p.$$eval('#essubject option',es=>es.map(e=>e.textContent.trim())).catch(()=>[]);
  console.log('    subjects offered:', subj.join(' | ')||'(single subject)');
  await ownQuestion(p, 'Explain how target markets affect e-marketing, people, processes and physical evidence.');
  await p.click('#esstart');
  await p.waitForFunction(() => !!document.querySelector('#esline, .es-startrow, [data-espath]'), null, { timeout: 8000 });
  ok(!!(await p.$('#esline')) && !!(await p.$('.es-guide')),'the composer opens with a guide on the active line');
  const job = await p.$eval('.es-guidejob',e=>e.textContent.trim());
  ok(job.length>10,'and it states the job for this sentence: '+job);
  ok(!!(await p.$('#eshintbtn, .es-hintbtn, [data-eshint]')) || /hints/i.test(await p.$eval('body',e=>e.textContent)),'the hints widget is present');

  console.log('pageerrors:', errs.join(' | ')||'none');
  ok(errs.length===0,'no page errors');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
