// Learning pass over the reference area. Three support profiles through the same
// Processes paragraph. Changes nothing; counts and records what each one sees.
const { chromium, T, OUT, BASE, fileUrl, usePractice } = require('./env');
const { planAll } = require('./env');
const PROFILE=process.argv[2]||'moderate';
const PROFILES={ independent:{help:0,drawers:[]}, moderate:{help:2,drawers:['understand']},
                 high:{help:9,drawers:['understand','ideas','evidence']} };
const P=Object.prototype.hasOwnProperty.call(PROFILES,PROFILE)?PROFILES[PROFILE]:null;
if(!P){
  console.error('unknown profile "'+PROFILE+'". Use one of: '+Object.keys(PROFILES).join(', '));
  process.exit(1);
}
const LINES=[
 "A target market that will not spend time or effort on ordering pushes a business to rebuild how an order is placed.",
 "Processes are the systems a customer moves through to obtain a service, including ordering, payment and collection.",
 "Because this group treats effort as a cost of buying, a business chasing their repeat custom has to take steps out of ordering rather than simply work faster.",
 "The business lets an order be placed and paid for before the customer arrives, which removes the counter queue from the ordering step entirely.",
 "The result is that this target market spends less effort to buy and the business keeps them, although the work of ordering has been shifted onto the customer.",
 "This shows that identifying a convenience-driven target market is what led the business to change its processes."];
(async()=>{
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:1500,height:1000}});
  await ctx.addInitScript(()=>{window.__C=0;addEventListener('click',()=>window.__C++,true);});
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  let calls=0; await p.route(/workers\.dev/, r=>{calls++;r.abort();});
  const clicks=()=>p.evaluate(()=>window.__C);
  await p.goto(T); await p.waitForTimeout(700);
  // TEST FIXTURE: unsourced evidence is withheld by design, so the suite supplies
  // sources of its own rather than weakening the rule under test.
  await p.evaluate(()=>{ Object.keys((window.BUSCONTENT||{}).evidence||{}).forEach(k=>
    window.BUSCONTENT.evidence[k].forEach(e=>{ e.source='test fixture source'; e.checked='2026-08-19'; })); });
  await p.$$eval('.navtab',es=>{const t=es.find(x=>/Essay practice/i.test(x.textContent));t&&t.click();});
  await p.waitForTimeout(400);
  await p.selectOption('#essubject','business_studies'); await p.waitForTimeout(200);
  await usePractice(p); await p.$$eval('.es-qrow',es=>{const t=es.find(x=>/target markets/i.test(x.textContent));t&&t.click();});
  await p.waitForTimeout(200);
  await p.click('#esstart'); await p.waitForTimeout(500);
  await planAll(p);
  // plan Body 1 as the processes paragraph
  await p.$$eval('.es-plancard [data-esplanarea]',es=>{const t=es.find(x=>/processes/i.test(x.textContent));t&&t.click();});
  await p.waitForTimeout(300);
  await p.$$eval('[data-esplanpick]',es=>{const t=es.find(x=>/Convenience-oriented/i.test(x.textContent));t&&t.click();});
  await p.waitForTimeout(300);
  await p.$$eval('.es-plancard .es-evchip',es=>es[0]&&es[0].click()); await p.waitForTimeout(250);
  await p.click('#esplango'); await p.waitForTimeout(400);
  await p.$$eval('[data-esgo]',es=>{const t=es.find(x=>/Body 1/.test(x.textContent));t&&t.click();}); await p.waitForTimeout(400);

  const before=await clicks();
  const seen=[];
  const density=()=>p.evaluate(()=>{
    const w=t=>String(t||'').trim().split(/\s+/).filter(Boolean).length;
    const vis=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;};
    return { controls:[...document.querySelectorAll('.es-canvas button,.es-canvas input,.es-canvas textarea')].filter(vis).length,
             chrome:w(document.querySelector('.es-canvas').innerText),
             own:w(document.querySelector('.es-prose')?document.querySelector('.es-prose').innerText:'') };
  });
  const d0=await density();

  for (let i=0;i<5;i++){
    const c0=await clicks();
    const head=await p.$eval('.es-guideh',e=>e.textContent.trim()).catch(()=>null); if(!head) break;
    const job=await p.$eval('.es-guidejob',e=>e.textContent.trim());
    let shown=0, texts=[];
    for (let k=0;k<P.help;k++){ const btn=await p.$('#esmorehelp'); if(!btn) break; await btn.click(); await p.waitForTimeout(110); }
    if (P.help){ const r=await p.$$eval('.es-rung',es=>es.map(e=>({l:e.querySelector('.es-runglbl').textContent.trim(),
      t:e.querySelector('.es-rungtext').textContent.trim()}))); shown=r.length; texts=r; }
    for (const key of P.drawers){
      const t=await p.$('[data-estool="'+key+'"]'); if(!t) continue;
      if (await t.evaluate(e=>e.disabled)) { seen.push({step:head,tool:key,got:'DISABLED'}); continue; }
      await t.click(); await p.waitForTimeout(220);
      const got=await p.$eval('.es-drawer-body',e=>e.innerText.replace(/\s+/g,' ').trim());
      seen.push({step:head,tool:key,words:got.split(' ').length});
      await p.click('#esdrawerx'); await p.waitForTimeout(200);
    }
    await p.fill('#esline',LINES[i]); await p.click('#esaccept'); await p.waitForTimeout(250);
    console.log(' '+head.padEnd(17)+' help:'+shown+' rungs  clicks:'+((await clicks())-c0)+
      (texts.length?('\n     ladder: '+texts.map(x=>x.l).join(' -> ')):''));
  }
  const total=(await clicks())-before;
  const d1=await density();
  console.log('\n=== '+PROFILE.toUpperCase()+' through one processes paragraph ===');
  console.log('clicks for the whole paragraph:',total,'| model calls:',calls);
  console.log('interface words before any help requested:',d0.chrome,'| permanent controls:',d0.controls);
  console.log('after writing:',d1.own,'words of their own vs',d1.chrome-d1.own,'words of interface');
  if (seen.length) console.log('drawers opened:',JSON.stringify(seen.map(s=>s.tool+'@'+s.step+':'+(s.got||s.words+'w'))));
  console.log('page errors:',errs.join(' | ')||'none');
  await b.close();
})();
