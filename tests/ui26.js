const { openMap, usePractice } = require('./env');
// Coverage recovery, at its edges. The review may name a required part the
// response has not addressed and offer a way back to it. The thing that must
// never happen is the coverage checker quietly taking over work the student has
// already done because it needed somewhere to send them.
const { chromium, T, OUT } = require('./env');
let pass=0,fail=0; const ok=(c,m)=>{ if(c) pass++; else {fail++; console.log('  FAIL:',m);} };
async function open(p, re, structure){
  await p.goto(T); await p.waitForTimeout(650);
  await p.evaluate(()=>localStorage.removeItem('marginal.essay.v1'));
  await p.goto(T); await p.waitForTimeout(650);
  await p.$$eval('.navtab',es=>{const t=es.find(x=>/Essay practice/i.test(x.textContent));t&&t.click();});
  await p.waitForTimeout(400);
  await p.selectOption('#essubject','business_studies'); await p.waitForTimeout(200);
  await usePractice(p); await p.$$eval('.es-qrow',(es,r)=>{const t=es.find(x=>new RegExp(r,'i').test(x.textContent));t&&t.click();}, re.source);
  if (structure) { await p.selectOption('#esstruct', structure); await p.waitForTimeout(150); }
  await p.click('#esstart'); await p.waitForTimeout(700);
}
const text = (p,sel) => p.$eval(sel,e=>e.innerText.replace(/\s+/g,' ').trim()).catch(()=>'');
// which required parts the app believes are claimed, and by which paragraph.
// Read off the start surface, which is the app's own statement of it.
const claimed = p => p.$$eval('.es-covitem.on',es=>es.map(e=>e.innerText.replace(/\s+/g,' ').trim()).sort());
const sections = p => p.$$eval('.es-startrow',es=>es.map(e=>e.innerText.replace(/\s+/g,' ').trim()));
const covBtns = p => p.$$eval('[data-escover]',es=>es.map(e=>({label:e.textContent.trim(),area:e.dataset.escover})));
const rvSecs = p => p.$$eval('.es-rvsec',es=>es.map(e=>e.innerText.replace(/\s+/g,' ').trim()));
async function toStart(p){ await openMap(p); const m=await p.$('.es-mapwa'); if (m) { await m.click(); await p.waitForTimeout(450); } }
// read all lives in the composer, so from the start surface step into a
// paragraph first rather than silently doing nothing
async function review(p){
  if (!(await p.$('#esreview'))) {
    await p.$$eval('.es-startrow',es=>es[0]&&es[0].click());
    await p.waitForTimeout(500);
  }
  const r=await p.$('#esreview'); if(r){ await r.click(); await p.waitForTimeout(550);} }
async function intro(p, line){
  await p.click('#esstartintro'); await p.waitForTimeout(500);
  await p.fill('#esline',line); await p.click('#esaccept'); await p.waitForTimeout(400);
}
// plan every body, opening each collapsed row first
async function planAllBodies(p, n){
  await p.click('#esplanall'); await p.waitForTimeout(400);
  for (let k=0;k<n;k++){
    if (!(await p.$('[data-esplanpick]'))) {
      await p.$$eval('.es-planrow',es=>es[0]&&es[0].click()); await p.waitForTimeout(300);
    }
    await p.$$eval('[data-esplanpick]',es=>es[0]&&es[0].click()); await p.waitForTimeout(320);
  }
  await p.click('#esplanless'); await p.waitForTimeout(350);
}
(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1500,height:1050},deviceScaleFactor:2})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  let calls=0; await p.route(/workers\.dev/, r=>{calls++;r.abort();});

  console.log('1. a genuinely unused body takes the area');
  await open(p,/target markets affect/);
  ok((await claimed(p)).length===0,'nothing is claimed before anything is chosen');
  await intro(p,'Target markets shape every marketing decision a business makes.');
  await review(p);
  let btns=await covBtns(p);
  ok(btns.length===4,'all four required parts offer a way back: '+btns.length);
  ok(btns.every(x=>/^Go to /.test(x.label)),'each says go, because there is room: '+JSON.stringify(btns.map(x=>x.label)));
  await p.$$eval('[data-escover]',es=>{const t=es.find(x=>/processes/i.test(x.dataset.escover)); t&&t.click();});
  await p.waitForTimeout(550);
  ok(/processes/i.test(await text(p,'.es-compose')),'it lands ready to argue processes');
  await toStart(p);
  let cl=await claimed(p);
  console.log('   ',JSON.stringify(cl));
  ok(cl.length===1&&/processes/i.test(cl[0]),'exactly one body took the label: '+JSON.stringify(cl));
  ok(/body 1/i.test(cl[0]),'the free one, not a busy one: '+cl[0]);

  console.log('2. every body already planned: nothing is taken over');
  await open(p,/target markets affect/);
  await planAllBodies(p,4);
  const before=await claimed(p);
  ok(before.length===4,'all four bodies are spoken for: '+JSON.stringify(before));
  await intro(p,'Target markets shape every marketing decision a business makes.');
  await review(p);
  const beforeSecs=await rvSecs(p);
  btns=await covBtns(p);
  ok(btns.length>0,'parts are still unaddressed, because nothing is written in them yet');
  ok(btns.every(x=>/^Go to /.test(x.label)),'and it offers to go, never to add: '+JSON.stringify(btns[0].label));
  await p.$$eval('[data-escover]',es=>es[0]&&es[0].click());
  await p.waitForTimeout(600);
  await toStart(p);
  const after=await claimed(p);
  ok(JSON.stringify(before)===JSON.stringify(after),'not one planned paragraph was repurposed\n      before '+JSON.stringify(before)+'\n      after  '+JSON.stringify(after));
  await review(p);
  ok(JSON.stringify(beforeSecs)===JSON.stringify(await rvSecs(p)),'and no paragraph changed what it argues');
  await p.screenshot({path:OUT+'shot-coverage-nofree.png'});

  console.log('3. writing with no declared area is not relabelled, and a paragraph is offered instead');
  await open(p,/target markets affect/,'four');
  ok((await sections(p)).length===4,'a two body structure was chosen');
  await p.click('#esstartbody'); await p.waitForTimeout(550);
  await p.click('[data-espathown]'); await p.waitForTimeout(250);
  await p.fill('#esownarg','Customers who order on their phone expect the whole thing to be quick.');
  await p.click('#esownok'); await p.waitForTimeout(450);
  const sw=await p.$('#esstartwriting'); if (sw) { await sw.click(); await p.waitForTimeout(450); }
  await p.fill('#esline','McDonald’s built its ordering around customers who want visible proof that it will be fast.');
  await p.click('#esaccept'); await p.waitForTimeout(450);
  ok(/visible proof/.test(await text(p,'.es-prose')),'their own sentence is in body 1');
  await toStart(p);
  ok((await claimed(p)).length===0,'writing their own argument claims no required part');
  await p.$$eval('.es-startrow',es=>{const t=es.find(x=>/Body 2/.test(x.textContent)); t&&t.click();});
  await p.waitForTimeout(500);
  await p.$$eval('[data-espath]',es=>es[0]&&es[0].click()); await p.waitForTimeout(400);
  const sw2=await p.$('#esstartwriting'); if (sw2) { await sw2.click(); await p.waitForTimeout(400); }
  await toStart(p);
  const two=await claimed(p);
  ok(two.length===1,'body 2 claims one part, body 1 still claims none: '+JSON.stringify(two));
  // which part body 2 covers is the question's business, not this test's
  // An empty `held` is worse than a throw here: '' makes the find below match
  // nothing and indexOf('')===0 true of every string, so three later assertions
  // would pass vacuously. Report and stop instead.
  const held=(two[0]||'').split('·')[0].trim().toLowerCase();
  if(!held){ ok(false,'body 2 claims a named part, so coverage can be checked against it'); console.log(`\n${pass} passed, ${fail} failed`); await b.close(); process.exit(1); }
  await review(p);
  btns=await covBtns(p);
  console.log('   ',JSON.stringify(btns.map(x=>x.label)));
  ok(btns.length>=3,'three parts are still unaddressed');
  const em=btns.find(x=>x.area.toLowerCase()===held);
  ok(!em||/^Go to /.test(em.label),'a part a paragraph already carries just says go: '+JSON.stringify(em&&em.label));
  const rest=btns.filter(x=>x.area.toLowerCase()!==held);
  ok(rest.length>=2&&rest.every(x=>/^Add a paragraph for/.test(x.label)),
    'the rest have nowhere free to go, so they offer to add one and say so in the button: '+JSON.stringify(rest.map(x=>x.label)));
  const pe=btns.find(x=>/physical evidence/i.test(x.area));
  ok(!!pe,'including physical evidence');
  await p.$$eval('[data-escover]',es=>{const t=es.find(x=>/physical evidence/i.test(x.dataset.escover)); t&&t.click();});
  await p.waitForTimeout(700);
  await toStart(p);
  const secs=await sections(p);
  console.log('   ',JSON.stringify(secs.map(s=>s.slice(0,46))));
  ok(secs.length===5,'a paragraph was added rather than one being taken: '+secs.length);
  const nowClaimed=await claimed(p);
  ok(nowClaimed.some(x=>/physical evidence/i.test(x)),'the new paragraph carries physical evidence: '+JSON.stringify(nowClaimed));
  ok(nowClaimed.some(x=>/body 3/i.test(x)),'and it is the new one, not body 1: '+JSON.stringify(nowClaimed));
  ok(nowClaimed.some(x=>x.toLowerCase().indexOf(held)===0&&/body 2/i.test(x)),
    'and growing the structure did not throw away what body 2 was already planned to argue ('+held+'): '+JSON.stringify(nowClaimed));

  console.log('4. prose about an area the planner cannot see is still theirs');
  await review(p);
  const secsAfter=await rvSecs(p);
  const body1=secsAfter[1]||'';
  ok(/visible proof/.test(body1),'their sentence is untouched: '+body1.slice(0,70));
  ok(!/physical evidence/i.test(body1.split('visible proof')[0]||''),'and body 1 was never labelled as covering it');
  const miss=await text(p,'.es-cover.missing');
  ok(/e-marketing|people/i.test(miss),'the checker still reports only what it can know: '+miss.slice(0,90));
  ok(!!(await p.$('#essubmit')),'and submitting stays available throughout');

  ok(calls===0,'no model calls anywhere: '+calls);
  console.log('pageerrors:',errs.join(' | ')||'none');
  ok(errs.length===0,'no page errors');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
