const { chromium, T, OUT, BASE, fileUrl } = require('./env');
let pass=0,fail=0; const ok=(c,m)=>{ if(c) pass++; else {fail++; console.log('  FAIL:',m);} };
(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1280,height:1100},deviceScaleFactor:2})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  await p.route(/workers\.dev/, r=>r.abort());
  await p.goto(T); await p.waitForTimeout(900);

  const sit = async name => {
    await p.goto(T); await p.waitForTimeout(800);
    await p.$$eval('.navtab',es=>{const t=es.find(x=>/Test mode/i.test(x.textContent)); t&&t.click();});
    await p.waitForTimeout(450);
    await p.$$eval('button, .area',es=>{const t=es.find(x=>/^Sit\b|Sit /i.test(x.textContent.trim())); t&&t.click();});
    await p.waitForTimeout(450);
    await p.click('#exampicknone'); await p.waitForTimeout(150);
    await p.$$eval('.exam-pick',(es,n)=>{
      const t=es.find(x=>new RegExp(n,'i').test(x.textContent));
      if(t){ const cb=t.querySelector('input'); if(cb && !cb.checked) cb.click(); }
    }, name);
    await p.waitForTimeout(200);
    await p.click('#exampickgo'); await p.waitForTimeout(500);
    const begin=await p.$('#exambegin'); if(begin){ await begin.click(); await p.waitForTimeout(450); }
    // an either/or section asks which question to attempt before it starts
    const choice=await p.$('[data-examchoose]'); if(choice){ await choice.click(); await p.waitForTimeout(450); }
  };

  console.log('--- EXTENDED RESPONSE inside a paper ---');
  await sit('Extended response');
  ok(!!(await p.$('#ans')),'the extended-response question is on screen');
  ok(!!(await p.$('.ansshape')),'the answer shape is on screen BEFORE anything is typed');
  let labels = await p.$$eval('.ansshape .es-skellabel',es=>es.map(e=>e.textContent.trim()));
  let jobs = await p.$$eval('.ansshape .es-skeljob',es=>es.map(e=>e.textContent.trim()));
  console.log('    rows:', labels.join(' | '));
  ok(labels.length===3 && /introduction/.test(labels[0]),'whole-response shape: '+labels.join(', '));
  ok(jobs.every(j=>j.length>20),'every row states a real job');
  let note = await p.$eval('.ansshape .es-skelnote',e=>e.textContent.trim());
  ok(/20 marks/.test(note),'the note reflects the mark value: '+note);
  ok(!/—/.test(await p.$eval('#app',e=>e.textContent)),'no em-dashes on this screen');
  const ph = await p.$eval('#ans',e=>e.placeholder);
  ok(!/—/.test(ph),'nor in the box placeholder: '+ph);
  await p.$eval('.ansshape',e=>e.scrollIntoView({block:'center'}));
  await p.screenshot({path:OUT+'shot-exam-extended.png'});

  console.log('--- SHORT ANSWER inside a paper: adapts to the verb ---');
  await sit('Short answer');
  ok(!!(await p.$('.ansshape')),'the answer shape is there too');
  const head = await p.$eval('.ansshape .es-skelh',e=>e.textContent.trim());
  labels = await p.$$eval('.ansshape .es-skellabel',es=>es.map(e=>e.textContent.trim()));
  note = await p.$eval('.ansshape .es-skelnote',e=>e.textContent.trim());
  console.log('    head:', head.slice(0,70));
  console.log('    rows:', labels.join(' | '));
  console.log('    note:', note);
  ok(/says outline/i.test(head),'the head names the directive verb: '+head.slice(0,50));
  ok(labels.length>=1 && labels.length<=4,'a short answer gets a SHORT shape, not five essay lines: '+labels.length);
  ok(/2 marks/.test(note) && /about 2/.test(note),'depth is set by the marks: '+note);
  await p.screenshot({path:OUT+'shot-exam-short.png'});

  console.log('--- the shape is different for a different verb ---');
  const first = labels.join('|');
  let differed=false;
  // walk to a later question with a different verb
  for (let i=0;i<4;i++){
    await p.fill('#ans','placeholder answer for walking forward');
    await p.click('#check'); await p.waitForTimeout(500);
    await p.click('#examnext'); await p.waitForTimeout(450);
    const bg=await p.$('#exambegin'); if(bg){ await bg.click(); await p.waitForTimeout(400); }
    if (!(await p.$('.ansshape'))) continue;
    const l=(await p.$$eval('.ansshape .es-skellabel',es=>es.map(e=>e.textContent.trim()))).join('|');
    const h=await p.$eval('.ansshape .es-skelh',e=>e.textContent.trim());
    if (l!==first) { console.log('    later question:', h.slice(0,60), '->', l); differed=true; break; }
  }
  // One verdict, outside the loop. Inside it, a final `continue` (no .ansshape at
  // all) skipped both branches and the section recorded nothing either way.
  ok(differed,'a different verb produces a different shape');

  console.log('pageerrors:', errs.join(' | ')||'none');
  ok(errs.length===0,'no page errors');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
