// The guidance chain: a chosen argument must never be answered with scaffold
// language written for no question in particular.
//     pathway.guides[slot]  ->  areas[area].guides[slot]  ->  slot.job
const { chromium, T, OUT } = require('./env');
const { planAll } = require('./env');
let pass=0,fail=0; const ok=(c,m)=>{ if(c) pass++; else {fail++; console.log('  FAIL:',m);} };
const GENERIC=/strategy affecting an objective/;
async function openWith(p, area, argRe){
  await p.goto(T); await p.waitForTimeout(650);
  await p.evaluate(()=>localStorage.removeItem('marginal.essay.v1'));
  await p.goto(T); await p.waitForTimeout(650);
  await p.$$eval('.navtab',es=>{const t=es.find(x=>/Essay practice/i.test(x.textContent));t&&t.click();});
  await p.waitForTimeout(400);
  await p.selectOption('#essubject','business_studies'); await p.waitForTimeout(200);
  await p.$$eval('.es-qchip',es=>{const t=es.find(x=>/target markets affect/i.test(x.textContent));t&&t.click();});
  await p.click('#esstart'); await p.waitForTimeout(550);
  await planAll(p);
  await p.$$eval('.es-plancard [data-esplanarea]',(es,a)=>{
    const card=es[0].closest('.es-plancard');
    const t=[...card.querySelectorAll('[data-esplanarea]')].find(x=>x.textContent.trim()===a); t&&t.click();
  }, area);
  await p.waitForTimeout(300);
  const got=await p.$$eval('.es-plancard [data-esplanpick]',(es,r)=>{
    const card=es[0].closest('.es-plancard');
    const t=[...card.querySelectorAll('[data-esplanpick]')].find(x=>new RegExp(r,'i').test(x.textContent));
    if(t){t.click(); return t.textContent.trim();} return null;
  }, argRe.source);
  await p.waitForTimeout(300);
  await p.click('#esplango'); await p.waitForTimeout(400);
  await p.$$eval('[data-esgo]',es=>{const t=es.find(x=>/Body 1/.test(x.textContent));t&&t.click();});
  await p.waitForTimeout(400);
  const guides=[];
  for(let i=0;i<6;i++){
    const head=await p.$eval('.es-guideh',e=>e.textContent.trim()).catch(()=>null); if(!head) break;
    guides.push({head, job: await p.$eval('.es-guidejob',e=>e.textContent.trim())});
    const ng=await p.$('#esnextguide'); if(!ng||await ng.evaluate(e=>e.disabled)) break;
    await ng.click(); await p.waitForTimeout(200);
  }
  const id=await p.evaluate(()=>{try{const s=JSON.parse(localStorage.getItem('marginal.essay.v1'));const bag=Object.values(s)[0];const d=bag.drafts[bag.drafts.length-1];return d.paras[d.pos].argumentId;}catch(e){return null;}});
  return {picked:got, id, guides};
}
(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  let calls=0; await p.route(/workers\.dev/, r=>{calls++;r.abort();});

  console.log('1. a fully authored pathway uses its OWN guidance');
  const a=await openWith(p,'processes',/Convenience-oriented customers lead to faster/);
  console.log('    id:',a.id);
  a.guides.forEach(g=>console.log('     ',g.head.padEnd(17),g.job.slice(0,66)));
  ok(a.id==='mkt01-pr-convenience','the processes pathway is the one selected: '+a.id);
  ok(a.guides.length===5,'five components: '+a.guides.length);
  ok(/what this target market will not spend/.test(a.guides[0].job),'the opening guide is the pathway’s own');
  ok(/Name processes as the element/.test(a.guides[0].job),'naming the element it argues about');
  ok(a.guides.every(g=>!GENERIC.test(g.job)),'and not one component falls back to scaffold language');

  console.log('2. a pathway with no guidance of its own falls to its AREA, not to scaffold');
  const c=await openWith(p,'e-marketing',/Convenience-oriented customers lead to marketing/);
  console.log('    id:',c.id);
  c.guides.forEach(g=>console.log('     ',g.head.padEnd(17),g.job.slice(0,66)));
  ok(c.id==='mkt01-em-convenience','the e-marketing pathway is the one selected: '+c.id);
  ok(c.guides.every(g=>!GENERIC.test(g.job)),'no component is answered with "a strategy affecting an objective"');
  ok(/digital marketing/i.test(c.guides[0].job),'the opening guide knows the area it is in: '+c.guides[0].job.slice(0,60));
  const authored=await p.evaluate(()=>{
    const q=window.ESSAY.subjects.business_studies.questions.find(x=>x.id==='mkt-01');
    const path=q.pathways.find(x=>x.id==='mkt01-em-convenience');
    return {own:Object.keys(path.guides||{}), area:Object.keys((q.areas||{})['e-marketing'].guides||{})};
  });
  console.log('    pathway authors:',JSON.stringify(authored.own),'| area authors:',JSON.stringify(authored.area));
  ok(authored.own.length<authored.area.length,'the pathway really is the thinner of the two, so the area is doing the work');

  console.log('3. a pathway guide still beats its area');
  const both=await p.evaluate(()=>{
    const q=window.ESSAY.subjects.business_studies.questions.find(x=>x.id==='mkt-01');
    const path=q.pathways.find(x=>x.id==='mkt01-pr-convenience');
    return {pathway:path.guides.topic, area:(q.areas||{})['processes'].guides.topic};
  });
  ok(both.pathway!==both.area,'they are genuinely different strings');
  ok(a.guides[0].job===both.pathway,'and the pathway one is what the student saw');

  ok(calls===0,'no model calls: '+calls);
  console.log('pageerrors:',errs.join(' | ')||'none');
  ok(errs.length===0,'no page errors');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
