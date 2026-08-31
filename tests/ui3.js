// the plain build on purpose: this suite tests the shipped defaults
const { chromium, P: T, OUT, ownQuestion } = require('./env');

// Waits that name their condition. This app fetches nothing and renders
// synchronously, so the effect of a click is present on the next frame:
// settled() is that frame, not a shorter guess at a duration.
const settled = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const here = (p, sel) => p.waitForSelector(sel, { timeout: 8000 });
let pass=0,fail=0; const ok=(c,m)=>{ if(c) pass++; else {fail++; console.log('  FAIL:',m);} };
(async()=>{
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:1280,height:960}});
  const errs=[];

  // ---- 1. review demo: the focus strip works with no writing surface behind it
  let p=await ctx.newPage(); p.on('pageerror',e=>errs.push('reviewdemo: '+e));
  await p.goto(T+'?reviewdemo=1'); await settled(p);
  ok(!!(await p.$('.rv-focus')),'focus strip renders in the review demo');
  const label=await p.$eval('#rvfocusgo',e=>e.textContent);
  ok(/take me to/i.test(label),'without a writing surface the action opens the paragraph instead: '+label);
  ok(!(await p.$('.rv-credited')),'no credited note when nothing was credited');
  const active=await p.$eval('.rv-pmark.active',e=>e.getAttribute('data-rvpara'));
  ok(active==='1','the review opens on the focus paragraph: '+active);
  await p.click('#rvfocusgo'); await settled(p);
  ok(!!(await p.$('.rv-issuecard')),'and it lands inside the issue walkthrough');
  ok(!(await p.$('.rv-focus')),'the focus strip steps aside once the student is working');
  await p.close();

  // ---- 2. essay marking OFF: submit saves, and says so, without calling anything
  p=await ctx.newPage(); p.on('pageerror',e=>errs.push('flagoff: '+e));
  let called=false;
  await p.route(/workers\.dev/, r=>{ called=true; r.fulfill({status:200,contentType:'application/json',body:'{}'}); });
  await p.goto(T+'?essay=1'); await settled(p);
  ok(!!(await p.$('#esq')),'essay mode opens on ?essay=1');
  await ownQuestion(p, 'Explain something for practice.');
  await p.click('#esstart');
  await p.waitForFunction(() => !!document.querySelector('#esline, .es-startrow, [data-espath]'), null, { timeout: 8000 });
  await p.click('#esmodeswitch'); await settled(p);
  await p.fill('#esfull','A paragraph written for the flag-off check.'); await settled(p);
  await p.click('#essubmit'); await settled(p);
  ok(!!(await p.$('.es-submitted')),'submit saves the draft');
  ok(!(await p.$('.es-marked')),'and does not mark while the switch is off');
  ok(called===false,'no marking request is made');
  await p.close();

  // ---- 3. a study essay card still grades and still reaches the review
  p=await ctx.newPage(); p.on('pageerror',e=>errs.push('studycard: '+e));
  await p.route(/workers\.dev/, r=>r.abort());   // no endpoint reachable -> demo grade
  await p.goto(T+'?review=1'); await settled(p);
  await p.$$eval('.topiccard',e=>{const t=e.find(x=>/Distribution/.test(x.textContent)); t&&t.click();});
  await settled(p);
  await p.$$eval('.area',e=>e[0]&&e[0].click()); await settled(p);
  await p.$$eval('.mode',e=>{const m=e.find(x=>/Long answer/.test(x.textContent)); m&&m.click();});
  await settled(p);
  ok(!!(await p.$('#ans')),'a long-answer card opens');
  await p.fill('#ans','The Lorenz curve plots cumulative income against cumulative population. Progressive tax and transfers move the disposable curve toward equality.');
  await p.click('#check'); await settled(p);
  const score=await p.$eval('.sheet .score',e=>e.textContent.trim()).catch(()=>'none');
  ok(score!=='none' && !/NaN/.test(score),'the card still grades: '+score);
  await p.close();

  console.log('pageerrors:', errs.join(' | ')||'none');
  ok(errs.length===0,'no page errors');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
