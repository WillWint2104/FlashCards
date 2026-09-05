// THE EVIDENCE PUBLICATION CONTRACT, at the student's screen.
//
// t15.mjs proves the rule. This proves the student is on the right side of it,
// and it does so with all six states linked to ONE pathway, so the screen itself
// has to choose between them:
//
//   A nothing, B url-only, D source-never-checked,
//   E check-with-no-source, F both blank                   -> never offered
//   C source AND checked                                   -> offered
//
// D is the one worth watching. It names a plausible source and nobody opened it,
// so it looks exactly like C on the screen if the gate ever weakens.
//
// THIS TEST IS HALF OF THE CONTRACT. t15 reads the real rule out of app.js and
// trips when the implementation drifts. This half knows nothing about the
// implementation and asks only what reaches the student, which is the half that
// can still fail when the code is self-consistently wrong.
//
// Driven from a fixture the test owns, so the real bank can be sourced, resourced
// or rewritten without touching it.
const { chromium, P, usePractice, chooseQuestion } = require('./env');

// Waits that name their condition. This app fetches nothing and renders
// synchronously, so the effect of a click is present on the next frame:
// settled() is that frame, not a shorter guess at a duration.
const settled = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const here = (p, sel) => p.waitForSelector(sel, { timeout: 8000 });
const { EVIDENCE_FIXTURE } = require('./fixtures/evidence-publication.js');
let pass=0,fail=0; const ok=(c,m)=>{ if(c) pass++; else {fail++; console.log('  FAIL:',m);} };

const F = EVIDENCE_FIXTURE;
const LABEL = { A:"A draft claim", B:"B candidate with a url", C:"C confirmed and publishable",
                D:"D located but never checked", E:"E checked with nothing to check",
                F:"F both fields blank" };

async function openFixture(p){
  await p.goto(P); await here(p, '.navtab');
  await p.evaluate(()=>localStorage.removeItem('marginal.essay.v1'));
  await p.goto(P); await here(p, '.navtab');
  await p.evaluate(f=>{
    window.ESSAY.subjects[f.subject.key]=f.subject;
    // The bank the fixture question resolves to. Replaced wholesale for this run
    // so the four states are the only records in play.
    window.BUSCONTENT.evidence.marketing = f.records;
  }, F);
  await p.$$eval('.navtab',es=>{const t=es.find(x=>/Essay practice/i.test(x.textContent));t&&t.click();});
  await settled(p);
  await p.selectOption('#essubject','evidence_contract');
  await settled(p);
  await chooseQuestion(p, /fixture marketing question/i);
  await settled(p);
  await p.click('#esstart');
  await p.waitForFunction(() => !!document.querySelector('#esline, .es-startrow, [data-espath]'), null, { timeout: 8000 });
  if (await p.$('.es-startrow')) await p.$$eval('.es-startrow',es=>{const t=es.filter(x=>/Body/.test(x.textContent))[0];t&&t.click();});
  else await p.$$eval('.es-mapitem',es=>{const t=es.filter(x=>/Body/.test(x.textContent))[0];t&&t.click();});
  await settled(p);
}
const offered = p => p.$$eval('[data-esev]',es=>es.map(e=>e.dataset.esev));
const setupText = p => p.$eval('.es-setup',e=>e.innerText.replace(/\s+/g,' ').trim()).catch(()=>'');
async function choose(p,id){
  // Standard harness rule: prove the thing exists, then test its behaviour. An
  // empty selection would otherwise report every hidden-evidence assertion below
  // as a pass while nothing was on screen at all.
  if (!(await p.$('[data-espath]'))) { await p.click('#esbackarg').catch(()=>{}); await settled(p); }
  const seen = await p.$$eval('[data-espath]',es=>es.map(e=>e.dataset.espath));
  if (seen.indexOf(id) < 0) throw new Error('pathway '+id+' was not offered; saw '+JSON.stringify(seen));
  await p.$$eval('[data-espath]',(es,want)=>{const t=es.find(x=>x.dataset.espath===want);t&&t.click();},id);
  await settled(p);
}

(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1500,height:1080}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  await p.route(/workers\.dev/, r=>r.abort());

  await openFixture(p);
  console.log('--- the fixture reached the screen ---');
  const paths = await p.$$eval('[data-espath]',es=>es.map(e=>e.dataset.espath));
  console.log('    pathways offered:', JSON.stringify(paths));
  ok(paths.indexOf('ev-all')>=0 && paths.indexOf('ev-incomplete')>=0,
    'both fixture pathways are selectable: '+JSON.stringify(paths));

  console.log('--- one screen, six states, one of them publishable ---');
  await choose(p,'ev-all');
  const shown = await offered(p);
  console.log('    evidence offered:', JSON.stringify(shown));
  // Proved to exist before anything is asserted about what is missing.
  ok(shown.length>0, 'the picker offered something at all, so the assertions below mean something');
  ok(shown.indexOf(LABEL.C)>=0, 'C, sourced and checked, is offered');
  ok(shown.indexOf(LABEL.A)<0, 'A, with nothing recorded, is not');
  ok(shown.indexOf(LABEL.B)<0, 'B, with only a located URL, is not');
  ok(shown.indexOf(LABEL.D)<0, 'D, a named source nobody opened, is not');
  ok(shown.indexOf(LABEL.E)<0, 'E, a date with no source, is not');
  ok(shown.indexOf(LABEL.F)<0, 'F, blank in both fields, is not');
  ok(shown.length===1, 'and nothing else came with it: '+JSON.stringify(shown));

  console.log('--- the withheld ones are withheld, not flagged ---');
  const said = await setupText(p);
  // setupText() yields '' for a missing element, and no label is found in ''.
  // Prove the surface is there before asking what it does not contain.
  ok(said.length>0,'the setup surface rendered, so the assertions below mean something');
  ok([LABEL.A,LABEL.B,LABEL.D,LABEL.E,LABEL.F].every(l=>said.indexOf(l)<0),
    'no withheld label appears anywhere on the screen');
  ok(!/unverified claim|not checked|unconfirmed source/i.test(said),
    'and no warning puts an unchecked claim in front of the student');

  console.log('--- a pathway with nothing publishable offers nothing ---');
  await choose(p,'ev-incomplete');
  const none = await offered(p);
  ok(none.length===0, 'no evidence is offered: '+JSON.stringify(none));
  const saidNone = await setupText(p);
  ok(/still use your own/i.test(saidNone), 'the student is told their own evidence still works: '+saidNone.slice(0,90));
  ok(!/unfinished|incomplete|not written|coming soon/i.test(saidNone),
    'and is never told the content is unfinished: '+saidNone.slice(0,90));
  ok(!!(await p.$('#esstartwriting')), 'writing is unaffected');

  console.log('--- and it holds in both directions ---');
  // Stale state is the obvious way a gate like this fails: the picker keeps what
  // the previous pathway put there. Switched twice so a leftover render cannot
  // pass for gating.
  await choose(p,'ev-all');
  ok((await offered(p)).join('|')===LABEL.C, 'back to the complete pathway, C returns alone');
  await choose(p,'ev-incomplete');
  ok((await offered(p)).length===0, 'and away again, nothing is left behind');

  console.log('pageerrors:', errs.length?errs.slice(0,3):'none');
  ok(errs.length===0,'no page errors');
  console.log(pass+' passed, '+fail+' failed');
  await b.close();
  process.exit(fail?1:0);
})();
