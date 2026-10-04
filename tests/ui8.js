const { chromium, T, OUT, BASE, fileUrl } = require('./env');

// FORMAT-AWARE HELP IN A SITTING (state 8, decision 5; Slice A).
//
// This suite used to assert the essay skeleton drawn under every exam question.
// The approved sitting replaces it: a short answer carries one collapsed row,
// "What this question expects", keyed to its own directive, its source and its
// marks, and built only from authored guidance; every other format carries none
// (state 12 draws an extended response with no help region at all). What it
// still proves is what it always did: the guidance follows the question's verb
// and its marks, and nothing on the screen carries an em dash.

const settled = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const here = (p, sel) => p.waitForSelector(sel, { timeout: 8000 });
let pass=0,fail=0; const ok=(c,m)=>{ if(c) pass++; else {fail++; console.log('  FAIL:',m);} };
(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1280,height:1100},deviceScaleFactor:2})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  p.on('dialog', d => d.accept());
  await p.route(/workers\.dev/, r=>r.abort());

  // A fresh browser each time, so no earlier attempt is in progress.
  const sit = async name => {
    await p.evaluate(() => localStorage.clear()).catch(() => {});
    await p.goto(T); await here(p, '.navtab');
    await p.$$eval('.navtab',es=>{const t=es.find(x=>/Test mode/i.test(x.textContent)); t&&t.click();});
    await settled(p);
    await p.click('[data-examsit]'); await settled(p);
    await p.click('#exampicknone'); await settled(p);
    await p.$$eval('.tm-row',(es,n)=>{
      const t=es.find(x=>new RegExp(n,'i').test(x.textContent));
      if(t){ const cb=t.querySelector('input'); if(cb && !cb.checked) cb.click(); }
    }, name);
    await settled(p);
    await p.click('#exampickgo'); await settled(p);
    // an either/or section asks which question to attempt
    const choice=await p.$('[data-examchoose]'); if(choice){ await choice.click(); await settled(p); }
  };

  console.log('--- EXTENDED RESPONSE inside a paper: no help region (state 12) ---');
  await sit('Extended response');
  ok(!!(await p.$('#ans')),'the extended-response question is on screen');
  ok(!(await p.$('.tm-help')) && !(await p.$('.ansshape')),'no help region and no essay skeleton');
  ok(!/—/.test(await p.$eval('#app',e=>e.textContent)),'no em-dashes on this screen');
  const ph = await p.$eval('#ans',e=>e.placeholder);
  ok(!/—/.test(ph) && /paragraphs/.test(ph),'the box placeholder speaks the format, without an em dash: '+ph);
  await p.screenshot({path:OUT+'shot-exam-extended.png'});

  console.log('--- SHORT ANSWER inside a paper: help keyed to the verb and the marks ---');
  await sit('Short answer');
  ok(!!(await p.$('.tm-help')),'a short answer carries the help region');
  ok(!(await p.$eval('.tm-help', e => e.open)),'collapsed until the student opens it');
  const rows = async () => p.$$eval('.tm-help .tm-hrow', es => es.map(e => e.querySelector('.k').textContent.trim() + ': ' + e.lastElementChild.textContent.replace(/\s+/g, ' ').trim()));
  let r = await rows();
  console.log('    rows:', r.join(' | '));
  ok(r.some(x => /^says outline: /.test(x)),'the first row names the directive: '+r[0]);
  ok(r.some(x => /^use the source: /.test(x)),'a question with a source says to use it');
  ok(r.some(x => /^2 marks: about 2 distinct creditworthy points/.test(x)),'depth is set by the marks');
  ok(!(await p.$('.ansshape')),'and no essay skeleton');
  await p.screenshot({path:OUT+'shot-exam-short.png'});

  console.log('--- the help is different for a different verb ---');
  const first = r.join('|');
  await p.click('#examnext'); await settled(p);
  r = await rows();
  console.log('    11(b):', r.join(' | '));
  ok(r.join('|') !== first && r.some(x => /^says explain: /.test(x)) && r.some(x => /^3 marks: /.test(x)),
     'Question 11(b) says explain, for 3 marks');

  console.log('--- and none on a calculation or a multiple choice question ---');
  await p.click('#examnext'); await settled(p);
  ok(/calculation/.test(await p.$eval('.exam-qhead', e => e.textContent)) && !(await p.$('.tm-help')),'11(c), a calculation, has none');

  console.log('pageerrors:', errs.join(' | ')||'none');
  ok(errs.length===0,'no page errors');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
