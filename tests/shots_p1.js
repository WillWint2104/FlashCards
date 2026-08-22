const { chromium, T, OUT, BASE, fileUrl } = require('./env');
const { planAll } = require('./env');
(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1500,height:1180},deviceScaleFactor:2})).newPage();
  await p.route(/workers\.dev/, r=>r.abort());
  await p.goto(T); await p.waitForTimeout(700);
  // TEST FIXTURE: unsourced evidence is withheld by design, so the suite supplies
  // sources of its own rather than weakening the rule under test.
  await p.evaluate(()=>{ Object.keys((window.BUSCONTENT||{}).evidence||{}).forEach(k=>
    window.BUSCONTENT.evidence[k].forEach(e=>{ e.source='test fixture source'; e.checked='2026-08-19'; })); });
  await p.$$eval('.navtab',es=>{const t=es.find(x=>/Essay practice/i.test(x.textContent));t&&t.click();});
  await p.waitForTimeout(400);
  await p.selectOption('#essubject','business_studies'); await p.waitForTimeout(200);
  await p.$$eval('.es-qchip',es=>{const t=es.find(x=>/target markets/i.test(x.textContent));t&&t.click();});
  await p.waitForTimeout(200);
  await p.click('#esstart'); await p.waitForTimeout(500);
  await planAll(p);
  await p.$$eval('.es-plancard [data-esplanarea]',es=>{const t=es.find(x=>/processes/i.test(x.textContent));t&&t.click();});
  await p.waitForTimeout(300);
  await p.$$eval('[data-esplanpick]',es=>{const t=es.find(x=>/Convenience-oriented/i.test(x.textContent));t&&t.click();});
  await p.waitForTimeout(300);
  await p.$$eval('.es-plancard .es-evchip',es=>es[0]&&es[0].click()); await p.waitForTimeout(250);
  await p.click('#esplango'); await p.waitForTimeout(400);
  await p.$$eval('[data-esgo]',es=>{const t=es.find(x=>/Body 1/.test(x.textContent));t&&t.click();}); await p.waitForTimeout(400);
  // move to EXPLAIN and open the whole ladder
  await p.click('#esnextguide'); await p.waitForTimeout(250);
  for (let i=0;i<5;i++){ const btn=await p.$('#esmorehelp'); if(!btn) break; await btn.click(); await p.waitForTimeout(150); }
  await p.screenshot({path:BASE+'shot-p1-ladder.png'});
  const end=await p.$eval('.es-helpend',e=>e.textContent.trim()).catch(()=>'(still more)');
  console.log('bottom of the ladder says:',JSON.stringify(end));
  await b.close();
})();
