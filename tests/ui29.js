const { openMap } = require('./env');
// Decision histories, not final states.
//
// Students do not arrive at a set of choices, they arrive at a sequence of them,
// and stateful bugs live in the sequence. Every case here is a round trip: choose
// something, change it, change it back, or go away and come back, and check that
// what the student made is still theirs and still attached to the right section.
const { chromium, T, OUT } = require('./env');
let pass=0,fail=0; const ok=(c,m)=>{ if(c) pass++; else {fail++; console.log('  FAIL:',m);} };
async function open(p, re, structure){
  await p.goto(T); await p.waitForTimeout(650);
  await p.evaluate(()=>localStorage.removeItem('marginal.essay.v1'));
  await p.goto(T); await p.waitForTimeout(650);
  await p.$$eval('.navtab',es=>{const t=es.find(x=>/Essay practice/i.test(x.textContent));t&&t.click();});
  await p.waitForTimeout(400);
  await p.selectOption('#essubject','business_studies'); await p.waitForTimeout(200);
  await p.$$eval('.es-qrow',(es,r)=>{const t=es.find(x=>new RegExp(r,'i').test(x.textContent));t&&t.click();}, re.source);
  if (structure) { await p.selectOption('#esstruct', structure); await p.waitForTimeout(150); }
  await p.click('#esstart'); await p.waitForTimeout(700);
}
const text=(p,sel)=>p.$eval(sel,e=>e.innerText.replace(/\s+/g,' ').trim()).catch(()=>'');
const wa=p=>p.$eval('.es-mapwatext',e=>e.textContent.trim()).catch(()=>p.$eval('.es-watext',e=>e.textContent.trim()).catch(()=>''));
// every section as the app itself reports it: role, what it argues, its words.
// The start surface is where the app states all three together.
const map=p=>p.$$eval('.es-mapitem',es=>es.map(e=>e.innerText.replace(/\s+/g,' ').trim())).catch(()=>[]);
async function sections(p){
  if (!(await p.$('.es-startrow'))) { await openMap(p); await p.click('.es-mapwa').catch(()=>{}); await p.waitForTimeout(520); }
  const rows = await p.$$eval('.es-startrow',es=>es.map(e=>e.innerText.replace(/\s+/g,' ').trim())).catch(()=>[]);
  return rows;
}
async function go(p, role){
  if (await p.$('.es-startrow')) await p.$$eval('.es-startrow',(es,r)=>{const t=es.find(x=>new RegExp(r,'i').test(x.textContent));t&&t.click();}, role);
  else await p.$$eval('.es-mapitem',(es,r)=>{const t=es.find(x=>new RegExp(r,'i').test(x.textContent));t&&t.click();}, role);
  await p.waitForTimeout(620);
}
async function pickArea(p, i){ const a=await p.$$('[data-essetuparea]'); if (a[i]) { await a[i].click(); await p.waitForTimeout(340); } }
async function pickPath(p, id){
  await p.$$eval('[data-espath]',(es,x)=>{const t=x?es.find(e=>e.dataset.espath===x):es[0]; t&&t.click();}, id||null);
  await p.waitForTimeout(430);
}
async function startWriting(p){ const b=await p.$('#esstartwriting'); if (b) { await b.click(); await p.waitForTimeout(430); } }
async function backToArgument(p){ const b=await p.$('#esbackarg'); if (b) { await b.click(); await p.waitForTimeout(430); } }
async function changeArgument(p){
  // whichever route this paragraph is on, get back to the argument choice
  if (await p.$('#esbackarg')) return backToArgument(p);
  const chip=await p.$('[data-eschangearg]') || await p.$('.es-chip-arg');
  if (chip) { await chip.click(); await p.waitForTimeout(430); }
}
async function write(p, line){ if (await p.$('#esline')) { await p.fill('#esline',line); await p.click('#esaccept'); await p.waitForTimeout(400); } }

(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1500,height:1050},deviceScaleFactor:2})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  let calls=0; await p.route(/workers\.dev/, r=>{calls++;r.abort();});

  console.log('1. A then B then A, on one paragraph');
  await open(p,/the effectiveness of human resource/);
  await p.click('#esposdefer').catch(()=>{}); await p.waitForTimeout(350);
  await go(p,'Body 1');
  await pickArea(p,0);
  const ids=await p.$$eval('[data-espath]',es=>es.map(e=>e.dataset.espath));
  ok(ids.length>=2,'the area offers at least two arguments to switch between: '+ids.length);
  const A=ids[0], B=ids[1];
  await pickPath(p,A); await startWriting(p);
  await write(p,'Training raises productivity at McDonald’s.');
  const proseA=await text(p,'.es-prose');
  ok(/raises productivity/.test(proseA),'a sentence exists under argument A');
  await changeArgument(p); await pickPath(p,B); await startWriting(p);
  ok(/raises productivity/.test(await text(p,'.es-prose')),'switching to B keeps the sentence they wrote');
  const waB=await wa(p);
  await changeArgument(p); await pickPath(p,A); await startWriting(p);
  const waA=await wa(p);
  console.log('   ',waA.slice(0,110));
  ok(/raises productivity/.test(await text(p,'.es-prose')),'and switching back keeps it too');
  ok(waA!==waB,'the working answer followed the change and followed it back');
  ok(!/, and by/.test(waA),'one paragraph contributes one clause, not one per argument it ever held: '+waA.slice(0,90));

  console.log('2. own argument, authored argument, own again');
  await go(p,'Body 2');
  await pickArea(p,1);
  await p.click('[data-espathown]'); await p.waitForTimeout(260);
  await p.fill('#esownarg','Rewards lift output significantly where output can be measured.');
  await p.click('#esownok'); await p.waitForTimeout(460);
  await startWriting(p);
  await write(p,'Rewards at McDonald’s are tied to what a crew member can be seen to do.');
  const own1=await text(p,'.es-prose');
  ok(/tied to what a crew member/.test(own1),'their sentence is written under their own argument');
  await changeArgument(p); await pickPath(p); await startWriting(p);
  ok(/tied to what a crew member/.test(await text(p,'.es-prose')),'moving to an authored argument keeps their sentence');
  await changeArgument(p);
  await p.click('[data-espathown]'); await p.waitForTimeout(260);
  await p.fill('#esownarg','Rewards lift output significantly where output can be measured.');
  await p.click('#esownok'); await p.waitForTimeout(460);
  ok(!(await p.$('.es-drift.dir')),'and returning to their own argument does not re-ask a question they answered');
  await startWriting(p);
  ok(/tied to what a crew member/.test(await text(p,'.es-prose')),'the sentence survived all three moves');

  console.log('3. support, limitation, support again');
  await open(p,/the effectiveness of human resource/);
  await p.$$eval('[data-espos]',es=>{const t=es.find(x=>/Highly effective/i.test(x.textContent)); t&&t.click();});
  await p.waitForTimeout(400);
  await go(p,'Body 1'); await pickArea(p,0); await pickPath(p); await startWriting(p);
  const sup=await wa(p);
  ok(!/depends on how well/.test(sup),'a supporting argument carries no qualifier');
  await changeArgument(p);
  await pickArea(p,2);
  await p.$$eval('[data-espath]',es=>{const t=es.find(x=>/pf-trust/.test(x.dataset.espath)); t&&t.click();});
  await p.waitForTimeout(450); await startWriting(p);
  ok(/depends on how well/.test(await wa(p)),'adding a limitation brings the qualifier in');
  await changeArgument(p);
  await pickArea(p,0);
  await pickPath(p); await startWriting(p);
  const back=await wa(p);
  console.log('   ',back.slice(0,110));
  ok(!/depends on how well/.test(back),'and taking the limitation away takes the qualifier away with it');

  console.log('4. plan a later paragraph, go back and revise an earlier one, return');
  await open(p,/target markets affect/);
  await go(p,'Body 3'); await pickPath(p); await startWriting(p);
  await write(p,'Customers who want speed change how ordering is organised.');
  const b3=await text(p,'.es-prose');
  await go(p,'Body 1'); await pickPath(p); await startWriting(p);
  await write(p,'A younger target market pushes the business towards digital channels.');
  await go(p,'Body 3');
  ok((await text(p,'.es-prose'))===b3,'Body 3 is exactly as it was left');
  const rows=await sections(p);
  console.log('   ',JSON.stringify(rows.map(r=>r.slice(0,40))));
  ok(rows.filter(r=>/\d+\s*words?/.test(r)).length===2,'and only the two written sections report words: '+JSON.stringify(rows.filter(r=>/\d+\s*words?/.test(r))));

  console.log('5. the response grows a paragraph after prose already exists');
  await open(p,/target markets affect/,'four');
  await go(p,'Introduction');
  await write(p,'Target markets shape every marketing decision a business makes.');
  await go(p,'Body 1'); await pickPath(p); await startWriting(p);
  await write(p,'A younger target market pushes the business towards digital channels.');
  await go(p,'Conclusion');
  await write(p,'Across all four elements the target market is what decides the shape.');
  await go(p,'Body 2'); await pickPath(p); await startWriting(p);
  const before=await sections(p);
  console.log('   before',JSON.stringify(before.map(r=>r.slice(0,44))));
  await p.click('#esplanall'); await p.waitForTimeout(420);
  const grow=await p.$('#esplanstruct');
  ok(!!grow,'the plan offers to match the structure to the four parts the question names');
  await grow.click(); await p.waitForTimeout(600);
  await p.click('#esplanless').catch(()=>{}); await p.waitForTimeout(400);
  const after=await sections(p);
  console.log('   after ',JSON.stringify(after.map(r=>r.slice(0,44))));
  ok(after.length===before.length+2,'two body paragraphs were added: '+before.length+' to '+after.length);
  await go(p,'Introduction');
  ok(/Target markets shape every marketing decision/.test(await text(p,'.es-prose')),'the introduction still holds the introduction');
  await go(p,'Conclusion');
  ok(/Across all four elements/.test(await text(p,'.es-prose')),'and the conclusion still holds the conclusion, not a body');
  await go(p,'Body 1');
  ok(/younger target market/.test(await text(p,'.es-prose')),'Body 1 still holds what was written in it');
  const argRow=after.find(r=>/^Body 1/.test(r));
  ok(argRow&&!/not planned yet/i.test(argRow)&&/\d+\s*words?/.test(argRow),
    'and still says both what it argues and that it holds prose: '+String(argRow).slice(0,70));
  await go(p,'Body 2');
  ok(!!(await p.$('#esline'))||!!(await p.$('.es-setup')),'Body 2 kept its plan and is ready to write');
  await go(p,'Body 4');
  ok(!!(await p.$('.es-setup')),'and the new Body 4 is empty and unplanned, as it should be');
  await p.screenshot({path:OUT+'shot-structure-grow.png'});

  ok(calls===0,'no model calls anywhere: '+calls);
  console.log('pageerrors:',errs.join(' | ')||'none');
  ok(errs.length===0,'no page errors');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
