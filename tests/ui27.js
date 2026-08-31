// What the simulated students walked into. The writing route is now the default,
// and it had none of the things the planning surface had: it offered every
// relationship in the question at once, it never said which required part the
// paragraph was answering, and it repeated an argument without a word.
const { openMap } = require('./env');
const { chromium, T, OUT } = require('./env');
let pass=0,fail=0; const ok=(c,m)=>{ if(c) pass++; else {fail++; console.log('  FAIL:',m);} };
async function open(p, re){
  await p.goto(T); await p.waitForTimeout(650);
  await p.evaluate(()=>localStorage.removeItem('marginal.essay.v1'));
  await p.goto(T); await p.waitForTimeout(650);
  await p.$$eval('.navtab',es=>{const t=es.find(x=>/Essay practice/i.test(x.textContent));t&&t.click();});
  await p.waitForTimeout(400);
  await p.selectOption('#essubject','business_studies'); await p.waitForTimeout(200);
  await p.$$eval('.es-qrow',(es,r)=>{const t=es.find(x=>new RegExp(r,'i').test(x.textContent));t&&t.click();}, re.source);
  await p.click('#esstart'); await p.waitForTimeout(700);
}
const text=(p,sel)=>p.$eval(sel,e=>e.innerText.replace(/\s+/g,' ').trim()).catch(()=>'');
const count=(p,sel)=>p.$$eval(sel,es=>es.length).catch(()=>0);
// the response map is the way between paragraphs while writing; the start
// surface only exists before the first one
async function body(p, n){
  if (await p.$('.es-startrow')) {
    await p.$$eval('.es-startrow',(es,i)=>{const t=es.filter(x=>/Body/.test(x.textContent))[i-1]; t&&t.click();}, n);
  } else {
    await p.$$eval('.es-mapitem',(es,i)=>{const t=es.filter(x=>/Body/.test(x.textContent))[i-1]; t&&t.click();}, n);
  }
  await p.waitForTimeout(650);
}
async function writeThrough(p, lines){
  for (const l of lines){ if (!(await p.$('#esline'))) break; await p.fill('#esline',l); await p.click('#esaccept'); await p.waitForTimeout(360); }
}
(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1500,height:1050},deviceScaleFactor:2})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  let calls=0; await p.route(/workers\.dev/, r=>{calls++;r.abort();});

  console.log('1. a question that fixes its parts names the part, and offers only its arguments');
  await open(p,/target markets affect/);
  await body(p,1);
  ok(!!(await p.$('.es-setup')),'body 1 asks what it will argue');
  const n1=await count(p,'[data-espath]');
  ok(n1>0&&n1<=4,'and offers that part’s arguments, not all twelve: '+n1);
  const head=await text(p,'.es-setuph');
  ok(/e-marketing/i.test(head),'naming the required part it is answering: '+JSON.stringify(head));
  const fixed=await p.$$eval('.es-areachip.fixed',es=>es.map(e=>e.innerText.replace(/\s+/g,' ').trim())).catch(()=>[]);
  console.log('   ',JSON.stringify(fixed));
  ok(fixed.length===4,'all four required parts are shown, so the student can see the shape: '+fixed.length);
  ok(await p.$$eval('.es-areachip.fixed.on',es=>es.length)===1,'with this one marked');
  ok(await count(p,'.es-areachip.fixed[data-essetuparea]')===0,'and none of them offered as a choice, because the question chose them');
  await p.screenshot({path:OUT+'shot-setup-required.png'});

  console.log('2. a part answered elsewhere says so');
  await p.$$eval('[data-espath]',es=>es[0]&&es[0].click()); await p.waitForTimeout(400);
  let sw=await p.$('#esstartwriting'); if (sw){ await sw.click(); await p.waitForTimeout(400); }
  await writeThrough(p,['Target markets shape which digital channels a business uses.','It reaches them where they already are.']);
  await body(p,2);
  const fixed2=await p.$$eval('.es-areachip.fixed',es=>es.map(e=>e.innerText.replace(/\s+/g,' ').trim())).catch(()=>[]);
  console.log('   ',JSON.stringify(fixed2));
  ok(fixed2.some(x=>/done in body 1/i.test(x)),'the part body 1 answered is marked done: '+JSON.stringify(fixed2.find(x=>/done in/i.test(x))));
  ok(/people/i.test(await text(p,'.es-setuph')),'and this paragraph is named for its own part');

  console.log('3. the writing route now names a repeated argument');
  await open(p,/the effectiveness of human resource/);
  await p.click('#esposdefer').catch(()=>{}); await p.waitForTimeout(350);
  await body(p,1);
  await p.$$eval('[data-essetuparea]',es=>es[0]&&es[0].click()); await p.waitForTimeout(320);
  const first=await p.$$eval('[data-espath]',es=>es[0]?es[0].dataset.espath:'');
  await p.$$eval('[data-espath]',es=>es[0]&&es[0].click()); await p.waitForTimeout(420);
  ok(!(await p.$('.es-twin')),'the first use of an argument is not a repeat');
  sw=await p.$('#esstartwriting'); if (sw) { await sw.click(); await p.waitForTimeout(400); }
  await writeThrough(p,['Training raises productivity at McDonald’s.']);
  await body(p,2);
  await p.$$eval('[data-essetuparea]',es=>es[0]&&es[0].click()); await p.waitForTimeout(320);
  await p.$$eval('[data-espath]',(es,id)=>{const t=es.find(x=>x.dataset.espath===id); t&&t.click();}, first);
  await p.waitForTimeout(450);
  const twin=await text(p,'.es-twin');
  console.log('   ',twin.slice(0,120));
  ok(!!twin,'choosing it again in body 2 says so, on the route most students take');
  ok(/same argument as body 1/i.test(twin),'naming which paragraph it repeats');
  ok(/you can argue the same strategy twice/i.test(twin),'without asserting that reuse is never legitimate');
  ok(!!(await p.$('#esstartwriting'))||!!(await p.$('[data-esev]')),'and it does not block the paragraph');
  await p.screenshot({path:OUT+'shot-twin-writing-route.png'});

  console.log('4. keeping one repeat does not silence the next');
  await p.click('[data-estwinok]'); await p.waitForTimeout(420);
  ok(!(await p.$('.es-twin')),'keeping it puts the warning away');
  await p.click('#esbackarg').catch(()=>{}); await p.waitForTimeout(420);
  const others=await p.$$eval('[data-espath]',es=>es.map(e=>e.dataset.espath));
  const second=others.find(x=>x!==first);
  await p.$$eval('[data-espath]',(es,id)=>{const t=es.find(x=>x.dataset.espath===id); t&&t.click();}, second);
  await p.waitForTimeout(430);
  ok(!(await p.$('.es-twin')),'a different argument is not a repeat');
  await p.click('#esbackarg').catch(()=>{}); await p.waitForTimeout(420);
  await p.$$eval('[data-espath]',(es,id)=>{const t=es.find(x=>x.dataset.espath===id); t&&t.click();}, first);
  await p.waitForTimeout(450);
  ok(!(await p.$('.es-twin')),'and returning to the one they kept does not ask them again about the same argument');
  // the bug this replaced: the dismissal was keyed to the paragraph, so one
  // "Keep it" silenced every later repeat anywhere in the response
  sw=await p.$('#esstartwriting'); if (sw) { await sw.click(); await p.waitForTimeout(400); }
  await body(p,3);
  await p.$$eval('[data-essetuparea]',es=>es[0]&&es[0].click()); await p.waitForTimeout(320);
  await p.$$eval('[data-espath]',(es,id)=>{const t=es.find(x=>x.dataset.espath===id); t&&t.click();}, first);
  await p.waitForTimeout(450);
  const t3=await text(p,'.es-twin');
  ok(!!t3,'a third paragraph repeating it is a new question, and is asked: '+t3.slice(0,60));

  console.log('5. an argument in the student’s own words is counted, not ignored');
  await open(p,/the effectiveness of human resource/);
  await p.click('#esposdefer').catch(()=>{}); await p.waitForTimeout(350);
  await body(p,1);
  await p.$$eval('[data-essetuparea]',es=>es[0]&&es[0].click()); await p.waitForTimeout(320);
  await p.click('[data-espathown]'); await p.waitForTimeout(250);
  await p.fill('#esownarg','Training pays for itself within a year at a high turnover site.');
  await p.click('#esownok'); await p.waitForTimeout(450);
  await openMap(p);
  await p.click('.es-mapwa').catch(()=>{}); await p.waitForTimeout(500);
  const note=await text(p,'.es-wa');
  console.log('   ',note.slice(0,150));
  ok(!/develops as you choose arguments/i.test(note),'it no longer says nothing has been chosen');
  ok(/in your own words/i.test(note),'it says why the line has not moved: '+JSON.stringify(note.slice(0,110)));

  console.log('6. authored labels reach the student as written');
  const labels=await p.$$eval('.es-startrow',es=>es.map(e=>e.innerText)).catch(()=>[]);
  const all=labels.join(' ');
  ok(!/\\u[0-9a-f]{4}/i.test(all),'no escape sequence is rendered as text: '+JSON.stringify(all.slice(0,80)));

  ok(calls===0,'no model calls anywhere: '+calls);
  console.log('pageerrors:',errs.join(' | ')||'none');
  ok(errs.length===0,'no page errors');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
