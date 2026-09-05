// The reference area works on BOTH paragraph models, so choosing TDECC does not
// drop the student onto generic guidance.
const { chromium, T, OUT, BASE, fileUrl, usePractice, ladderOffered, climbLadder } = require('./env');

// Waits that name their condition. This app fetches nothing and renders
// synchronously, so the effect of a click is present on the next frame:
// settled() is that frame, not a shorter guess at a duration.
const settled = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const here = (p, sel) => p.waitForSelector(sel, { timeout: 8000 });
const { planAll } = require('./env');
let pass=0,fail=0; const ok=(c,m)=>{ if(c) pass++; else {fail++; console.log('  FAIL:',m);} };
(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  let calls=0; await p.route(/workers\.dev/, r=>{calls++;r.abort();});
  await p.goto(T); await here(p, '.navtab');
  // TEST FIXTURE: unsourced evidence is withheld by design, so the suite supplies
  // sources of its own rather than weakening the rule under test.
  await p.evaluate(()=>{ Object.keys((window.BUSCONTENT||{}).evidence||{}).forEach(k=>
    window.BUSCONTENT.evidence[k].forEach(e=>{ e.source='test fixture source'; e.checked='2026-08-19'; })); });
  await p.$$eval('.navtab',es=>{const t=es.find(x=>/Essay practice/i.test(x.textContent));t&&t.click();});
  await settled(p);
  await p.selectOption('#essubject','business_studies'); await settled(p);
  await usePractice(p); await p.$$eval('.qp-row',es=>{const t=es.find(x=>/target markets/i.test(x.textContent));t&&t.click();});
  await settled(p);
  const models=await p.$$eval('#esmodel option',es=>es.map(e=>e.textContent.trim())).catch(()=>[]);
  console.log('   paragraph models offered:',JSON.stringify(models));
  // selectOption waits the full 30 second default before rejecting when the
  // select is absent, and the catch below then hid that as a fallback path. The
  // suite spent 30 of its 34 seconds inside a timeout nobody could see.
  const hasModel = await p.$('#esmodel');
  await (hasModel ? p.selectOption('#esmodel','tdecc') : Promise.reject(new Error('no #esmodel'))).catch(async()=>{
    await p.$$eval('select',es=>{const s=es.find(x=>[...x.options].some(o=>o.value==='tdecc')); if(s){s.value='tdecc';s.dispatchEvent(new Event('change',{bubbles:true}));}});
  });
  await settled(p);
  await p.click('#esstart');
  await p.waitForFunction(() => !!document.querySelector('#esline, .es-startrow, [data-espath]'), null, { timeout: 8000 });
  await planAll(p);
  await p.$$eval('.es-plancard [data-esplanarea]',es=>{const t=es.find(x=>/processes/i.test(x.textContent));t&&t.click();});
  await settled(p);
  await p.$$eval('[data-esplanpick]',es=>{const t=es.find(x=>/Convenience-oriented/i.test(x.textContent));t&&t.click();});
  await settled(p);
  await p.click('#esplango'); await settled(p);
  await p.$$eval('[data-esgo]',es=>{const t=es.find(x=>/Body 1/.test(x.textContent));t&&t.click();}); await settled(p);
  const steps=[];
  for (let i=0;i<7;i++){
    const head=await p.$eval('.es-guideh',e=>e.textContent.trim()).catch(()=>null); if(!head) break;
    const job=await p.$eval('.es-guidejob',e=>e.textContent.trim());
    // The ladder opens from the stuck menu now, not from a generic control under
    // the guide. Asked through the route, so this still measures whether help is
    // authored here and how deep it goes.
    const offered=await ladderOffered(p);
    let n=0; if(offered){ n=await climbLadder(p); }
    steps.push({head,job,offered,n});
    const hide=await p.$('#eshidehelp'); if(hide){await hide.click(); await settled(p);}
    const ng=await p.$('#esnextguide'); if(!ng||await ng.evaluate(e=>e.disabled)) break;
    await ng.click(); await settled(p);
  }
  steps.forEach(s=>console.log('   ',s.head.padEnd(24),'help:'+(s.offered?'Y':'-'),'rungs:'+s.n,'|',s.job.slice(0,48)));
  ok(steps.length===5,'TDECC gives five components: '+steps.length);
  ok(steps.some(s=>/DEMONSTRATE KNOWLEDGE/i.test(s.head)),'including demonstrate knowledge: '+steps.map(s=>s.head).join(', '));
  ok(steps.some(s=>/CASE STUDY/i.test(s.head)),'and case study rather than a bare example');
  ok(steps.some(s=>/CONNECT/i.test(s.head)),'and connect rather than concluding link');
  ok(steps.every(s=>s.offered),'help is offered on every TDECC component too');
  ok(steps.every(s=>s.n===5),'all five rungs deep on each: '+steps.map(s=>s.n).join(','));
  ok(new Set(steps.map(s=>s.job)).size===5,'and each component has its own guidance');
  ok(calls===0,'no model calls: '+calls);
  console.log('pageerrors:',errs.join(' | ')||'none');
  ok(errs.length===0,'no page errors');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
