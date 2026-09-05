// Causal wrong-turn recovery, in the app. The bots showed that on a causal
// question a deliberate wrong turn produced exactly the journey ignorance
// produced. This is what changed that, and the thing it must not do is speak to
// a student who wrote a perfectly good argument nobody happened to author.
const { chromium, T, OUT, usePractice } = require('./env');

// Waits that name their condition. This app fetches nothing and renders
// synchronously, so the effect of a click is present on the next frame:
// settled() is that frame, not a shorter guess at a duration.
const settled = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const here = (p, sel) => p.waitForSelector(sel, { timeout: 8000 });
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
}
const text=(p,sel)=>p.$eval(sel,e=>e.innerText.replace(/\s+/g,' ').trim()).catch(()=>'');
// state a point as this paragraph's own argument, the way a student would
async function ownArgument(p, line){
  await p.click('[data-espathown]'); await settled(p);
  await p.fill('#esownarg', line);
  await p.click('#esownok'); await settled(p);
}
async function backToArgument(p){
  const b=await p.$('#esbackarg'); if (b) { await b.click(); await settled(p); }
}
(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1500,height:1050},deviceScaleFactor:2})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  let calls=0; await p.route(/workers\.dev/, r=>{calls++;r.abort();});

  console.log('1. an argument that runs backwards is questioned');
  await open(p,/financial strategies affect/);
  await p.click('#esstartbody'); await settled(p);
  await ownArgument(p,'Profitability determines which cost control a business chooses.');
  const dir=await text(p,'.es-drift.dir');
  console.log('   ',dir.slice(0,175));
  ok(!!dir,'the app says something about it');
  ok(/check the direction/i.test(dir),'and says what kind of problem it is');
  ok(/how a strategy affects an objective/i.test(dir),'restating what the question asks for');
  ok(/how the objective influences the choice of strategy/i.test(dir),'and what the point currently says instead');
  ok(!!(await p.$('[data-esdirfix]'))&&!!(await p.$('[data-esdirkeep]')),'with a way to revise and a way to keep it');
  ok(!!(await p.$('#esstartwriting')),'and it never stops them writing');
  await p.screenshot({path:OUT+'shot-direction-check.png'});

  console.log('2. keeping it is keyed to the claim, not to the press');
  await p.click('[data-esdirkeep]'); await settled(p);
  ok(!(await p.$('.es-drift.dir')),'keeping it puts the question away');
  await backToArgument(p);
  await ownArgument(p,'Liquidity decides the cash flow management a business uses.');
  ok(!!(await p.$('.es-drift.dir')),'a different claim is a new question, even though the last one was dismissed');
  await p.click('[data-esdirkeep]'); await settled(p);
  ok(!(await p.$('.es-drift.dir')),'and that one can be kept too');

  console.log('3. an argument nobody authored, running the right way, is left alone');
  for (const line of [
    'Leasing equipment instead of buying it keeps cash on hand and improves liquidity.',
    'Inventory control frees cash that was sitting in stock, which improves liquidity.',
    'Hedging protects profitability when the dollar moves.',
  ]) {
    await backToArgument(p);
    await ownArgument(p, line);
    const said=await text(p,'.es-drift.dir');
    ok(!said,'silent on: '+line.slice(0,58)+(said?('  SAID: '+said.slice(0,70)):''));
  }

  console.log('4. a student who does not know what to argue is not told they are wrong');
  for (const line of [
    'I am not really sure what this paragraph should be about yet.',
    'This paragraph will be about the business and the things it does.',
  ]) {
    await backToArgument(p);
    await ownArgument(p, line);
    const said=await text(p,'.es-drift.dir');
    ok(!/check the direction/i.test(said),'no direction claim on: '+line.slice(0,52));
  }
  await backToArgument(p);
  await ownArgument(p,'Cost controls matter a lot for this business.');
  const half=await text(p,'.es-drift.dir');
  console.log('   ',half.slice(0,130));
  ok(/only one end/i.test(half),'naming one end of the relationship is named as that, not as an error');
  ok(!/check the direction/i.test(half),'and never as a direction problem');

  console.log('5. the same check on the paragraph’s own note');
  await p.click('#esstartwriting').catch(()=>{}); await settled(p);
  const tog=await p.$('#espointtoggle'); if (tog) { await tog.click(); await settled(p); }
  // deliberately NOT one of the claims dismissed above: those stay dismissed,
  // which is the point of keying the acknowledgement to the claim
  await p.fill('#espoint','Profitability drives the expense minimisation a business applies.');
  await p.$eval('#espoint',e=>e.blur()); await settled(p);
  ok(!!(await p.$('.es-drift.dir')),'a note that runs backwards is questioned where it is written');
  await p.fill('#espoint','Liquidity decides the cash flow management a business uses.');
  await p.$eval('#espoint',e=>e.blur()); await settled(p);
  ok(!(await p.$('.es-drift.dir')),'and a claim already answered for stays answered, wherever it is retyped');
  await p.fill('#espoint','Cash flow management improves liquidity.');
  await p.$eval('#espoint',e=>e.blur()); await settled(p);
  ok(!(await p.$('.es-drift.dir')),'and the question goes when the note runs the right way');

  console.log('6. a judgement question asks how far, not whether');
  await open(p,/the effectiveness of human resource/);
  await p.click('#esposdefer').catch(()=>{}); await settled(p);
  await p.click('#esstartbody'); await settled(p);
  await p.$$eval('[data-essetuparea]',es=>es[0]&&es[0].click()); await settled(p);
  await ownArgument(p,'Training raises productivity at McDonald’s.');
  const deg=await text(p,'.es-drift.dir');
  console.log('   ',deg.slice(0,150));
  ok(/how far, not whether/i.test(deg),'a point that stops at helps is asked for a degree');
  ok(/evaluate asks how much/i.test(deg),'in the directive’s own terms');
  await backToArgument(p);
  await ownArgument(p,'Training raises productivity significantly at McDonald’s.');
  ok(!(await p.$('.es-drift.dir')),'and a point that reaches a degree is left alone');

  ok(calls===0,'no model calls anywhere, because none of this is generated: '+calls);
  console.log('pageerrors:',errs.join(' | ')||'none');
  ok(errs.length===0,'no page errors');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
