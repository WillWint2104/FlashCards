// Second architecture case. fin-01 names a cause and an effect but fixes NO
// areas, so choosing which strategies to argue is part of the answer. Nothing
// about it is special-cased: the same fields drive both questions.
const { chromium, T, OUT, usePractice } = require('./env');

// Waits that name their condition. This app fetches nothing and renders
// synchronously, so the effect of a click is present on the next frame:
// settled() is that frame, not a shorter guess at a duration.
const settled = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const here = (p, sel) => p.waitForSelector(sel, { timeout: 8000 });
const { planAll } = require('./env');
let pass=0,fail=0; const ok=(c,m)=>{ if(c) pass++; else {fail++; console.log('  FAIL:',m);} };
async function open(p, re){
  await p.goto(T); await here(p, '.navtab');
  await p.evaluate(()=>localStorage.removeItem('marginal.essay.v1'));
  await p.goto(T); await here(p, '.navtab');
  await p.$$eval('.navtab',es=>{const t=es.find(x=>/Essay practice/i.test(x.textContent));t&&t.click();});
  await settled(p);
  await p.selectOption('#essubject','business_studies'); await settled(p);
  await usePractice(p); await p.$$eval('.qp-row',(es,r)=>{const t=es.find(x=>new RegExp(r,'i').test(x.textContent));t&&t.click();}, re.source);
  await p.click('#esstart');
  await p.waitForFunction(() => !!document.querySelector('#esline, .es-startrow, [data-espath]'), null, { timeout: 8000 });
  await planAll(p);
}
(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1500,height:1050},deviceScaleFactor:2})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  let calls=0; await p.route(/workers\.dev/, r=>{calls++;r.abort();});

  console.log('1. the data says which kind of question this is');
  const shape=await (async()=>{ await open(p,/financial strategies affect/); return p.evaluate(()=>{
    const qs=window.ESSAY.subjects.business_studies.questions;
    const f=qs.find(x=>x.id==='fin-01'), m=qs.find(x=>x.id==='mkt-01');
    return { finRequired:((f.requirements||{}).requiredAreas||[]).length,
             mktRequired:((m.requirements||{}).requiredAreas||[]).length,
             finAreas:Object.keys(f.areas||{}).length, finPaths:(f.pathways||[]).length };
  }); })();
  ok(shape.mktRequired===4,'mkt-01 fixes its four areas');
  ok(shape.finRequired===0,'fin-01 fixes none, deliberately');
  ok(shape.finAreas===4&&shape.finPaths===8,'and offers four strategies with eight relationships');

  console.log('2. available areas are not turned into required paragraphs');
  ok(!(await p.$('#esplanstruct')),'no structure is suggested from the number of strategies');
  ok((await p.$$eval('[data-esplanpick]',es=>es.length))===0,'and no argument is offered before the student says which strategy');
  const ask=await p.$eval('.es-planask',e=>e.textContent.trim());
  ok(/which financial strategy area/i.test(ask),'the first decision is which strategy this paragraph is about: '+JSON.stringify(ask));
  const chips=await p.$$eval('.es-plancard .es-areachip',es=>es.map(e=>e.textContent.trim()));
  ok(chips.length===4,'all four are offered: '+chips.length);
  ok(!chips.some(c=>/in Body/.test(c)),'none is marked as used yet');

  console.log('3. choosing a strategy narrows to its relationships');
  await p.$$eval('.es-plancard .es-areachip',es=>{const t=es.find(x=>/profitability/i.test(x.textContent));t&&t.click();});
  await settled(p);
  const opts=await p.$$eval('.es-optwrap .es-pickrel',es=>es.map(e=>e.textContent.trim()));
  ok(opts.length===2,'two relationships for that strategy, not all eight: '+opts.length);
  ok(opts.every(o=>/profitability/i.test(o)),'and they are that strategy’s: '+JSON.stringify(opts.map(o=>o.slice(0,34))));
  const subs=await p.$$eval('.es-optwrap .es-picksub',es=>es.map(e=>e.textContent.trim()));
  ok(subs.length===2&&subs.every(x=>x.length>50),'each says what it means without being asked');
  await p.$$eval('[data-eswhy]',es=>es[0]&&es[0].click()); await settled(p);
  const why=await p.$eval('.es-whybox',e=>e.innerText.replace(/\s+/g,' '));
  ok(/what you would need to show/i.test(why)&&/common mistake/i.test(why),'and Why? holds the deeper material here too');

  console.log('4. a strategy already argued elsewhere is marked, not blocked');
  await p.$$eval('[data-esplanpick]',es=>es[0]&&es[0].click()); await settled(p);
  const used=await p.$$eval('.es-areaused',es=>es.map(e=>e.textContent.trim()));
  ok(used.length===1&&/Body 1/.test(used[0]),'the next paragraph says where it was already used: '+JSON.stringify(used));
  const dim=await p.$$eval('.es-areachip',es=>es.some(e=>e.disabled||parseFloat(getComputedStyle(e).opacity)<0.9));
  ok(!dim,'but it is not blocked: arguing one strategy twice is the student’s call');

  console.log('5. decoding adapts to a question that fixes nothing');
  const chip=await p.$$eval('.es-decchip',es=>es.map(e=>e.textContent.trim()));
  ok(chip.some(c=>/what does my answer have to do/i.test(c)),'it does not ask what must be covered: '+JSON.stringify(chip));
  await p.$eval('[data-esdecopen="cover"]',e=>e.click()); await settled(p);
  const cover=await p.$eval('[data-esdecpanel="cover"]',e=>e.innerText.replace(/\s+/g,' '));
  console.log('   ',cover.slice(0,150));
  ok(/which to write about is your choice/i.test(cover),'it says the choice is the student’s');
  ok(/financial strategy → what it changes/.test(cover),'and gives the chain the answer has to follow');
  ok(!/All four areas/i.test(cover),'with no invented list of required parts');
  const hl=await p.$$eval('.es-dec',es=>es.map(e=>e.textContent.trim()));
  ok(hl.length===3,'three parts of the stem are pressable: '+JSON.stringify(hl));
  await p.$$eval('.es-dec',es=>{const t=es.find(x=>/objectives of financial/i.test(x.textContent));t&&t.click();});
  await settled(p);
  const eff=await p.$$eval('.es-decpanel',es=>es.filter(e=>!e.hidden).map(e=>e.innerText.replace(/\s+/g,' '))[0]||'');
  ok(/what has to move/i.test(eff),'a new kind of highlight carries its own label: '+eff.slice(0,50));
  ok(/liquidity, profitability/i.test(eff),'and names the objectives');
  await p.screenshot({path:OUT+'shot-fin01-plan.png'});

  console.log('6. the rest of the stack works on it with no special casing');
  for (let n=0;n<4;n++){
    const did=await p.$$eval('.es-plancard .es-areachip',es=>{const t=es.find(x=>!x.classList.contains('on')); if(t){t.click();return true;} return false;});
    if(!did) break; await settled(p);
    await p.$$eval('[data-esplanpick]',es=>{const t=es[0]; t&&t.click();}); await settled(p);
  }
  ok(!!(await p.$('.es-thesis')),'the thesis appears once every paragraph has a relationship');
  const pat=await p.$eval('.es-corepat',e=>e.textContent.trim()).catch(()=>'');
  ok(/financial strategy → what it changes/.test(pat),'the pattern is this question’s, not the other one’s: '+JSON.stringify(pat));
  await p.click('#escoreexplain'); await settled(p);
  const core=await p.$eval('.es-corebody',e=>e.innerText.replace(/\s+/g,' ')).catch(()=>'');
  ok(/name a strategy, explain what it changes/i.test(core),'and the teaching runs the argument forwards');
  await p.click('#escoreexplain'); await settled(p);
  await p.fill('#esthesis','Financial strategies change how well a business meets its objectives.');
  await p.click('#esthesissave'); await settled(p);
  await p.click('#escompare'); await settled(p);
  const cmp=await p.$eval('.es-compare',e=>e.innerText.replace(/\s+/g,' '));
  ok(/one acceptable thesis/i.test(cmp)&&/trade-off/i.test(cmp),'Compare offers this question’s acceptable thesis');
  ok(/runs the argument forwards/i.test(cmp),'with its own checklist, in this question\u2019s terms');

  console.log('7. and the other question still behaves as it did');
  await open(p,/target markets affect/);
  ok(!!(await p.$('#esplanstruct'))||((await p.$$eval('.es-plancard,.es-planrow',es=>es.length))===4),'mkt-01 still maps its fixed areas onto paragraphs');
  const mktAsk=await p.$('.es-planask');
  ok(!mktAsk,'and does not ask which area, because the question already said');
  ok((await p.$$eval('[data-esplanpick]',es=>es.length))===3,'its options are offered straight away: '+(await p.$$eval('[data-esplanpick]',es=>es.length)));

  ok(calls===0,'no model calls anywhere: '+calls);
  console.log('pageerrors:',errs.join(' | ')||'none');
  ok(errs.length===0,'no page errors');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
