// Question Decode: the stem is readable, pressable, and derives what it can.
const { chromium, T, OUT, ownQuestion } = require('./env');
const { planAll } = require('./env');
let pass=0,fail=0; const ok=(c,m)=>{ if(c) pass++; else {fail++; console.log('  FAIL:',m);} };
(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1500,height:1050},deviceScaleFactor:2})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  let calls=0; await p.route(/workers\.dev/, r=>{calls++;r.abort();});
  await p.goto(T); await p.waitForTimeout(800);
  await p.evaluate(()=>{ Object.keys((window.BUSCONTENT||{}).evidence||{}).forEach(k=>
    window.BUSCONTENT.evidence[k].forEach(e=>{ e.source='test fixture source'; e.checked='2026-08-19'; })); });
  await p.$$eval('.navtab',es=>{const t=es.find(x=>/Essay practice/i.test(x.textContent));t&&t.click();});
  await p.waitForTimeout(400);
  await p.selectOption('#essubject','business_studies'); await p.waitForTimeout(200);
  await p.$$eval('.es-qrow',es=>{const t=es.find(x=>/target markets affect/i.test(x.textContent));t&&t.click();});
  await p.click('#esstart'); await p.waitForTimeout(600);
  await planAll(p);

  console.log('1. the stem itself is the decoder');
  const stem=await p.$eval('.es-qbar-q',e=>e.textContent.trim());
  ok(/affect e-marketing, people, processes and physical evidence/.test(stem),'the canonical stem is shown: '+stem.slice(0,60));
  const hl=await p.$$eval('.es-dec',es=>es.map(e=>({t:e.textContent.trim(),k:e.className.replace('es-dec','').trim()})));
  console.log('   ',JSON.stringify(hl.map(h=>h.t+'['+h.k+']')));
  ok(hl.length===6,'six pressable parts: '+hl.length);
  ok(!!hl[0]&&hl[0].t==='Explain'&&hl[0].k==='directive','the directive first: '+JSON.stringify(hl[0]||null));
  ok(hl.filter(h=>h.k==='requiredArea').length===4,'and the four required areas');
  const order=stem.match(/Explain|target markets|e-marketing|people|processes|physical evidence/g)||[];
  ok(order.length>0&&hl.map(h=>h.t).join('|')===order.join('|'),'in the order they appear in the question');

  console.log('2. nothing stands open');
  ok(await p.$eval('[data-esdecbox]',e=>e.hidden),'the panel is closed until asked for');
  const chips=await p.$$eval('.es-decchip',es=>es.map(e=>e.textContent.trim()));
  console.log('   ',JSON.stringify(chips));
  ok(chips.length===3,'three ways in: '+chips.length);
  ok(/what does explain mean/i.test(chips.join(' ')),'and the directive one names the actual verb');

  console.log('3. pressing a word explains that word');
  await p.$$eval('.es-dec',es=>{const t=es.find(x=>/^processes$/.test(x.textContent.trim()));t&&t.click();});
  await p.waitForTimeout(250);
  ok(!(await p.$eval('[data-esdecbox]',e=>e.hidden)),'the panel opens');
  const shown=await p.$$eval('.es-decpanel',es=>es.filter(e=>!e.hidden).map(e=>e.innerText.replace(/\s+/g,' ')));
  ok(shown.length===1,'exactly one panel at a time: '+shown.length);
  ok(/must cover/i.test(shown[0]),'it is labelled in words written for this question: '+shown[0].slice(0,60));
  ok(/ordering, service or collection/i.test(shown[0]),'and teaches that specific word');

  console.log('4. it closes back, and never touches the writing');
  await p.$$eval('.es-dec',es=>{const t=es.find(x=>/^processes$/.test(x.textContent.trim()));t&&t.click();});
  await p.waitForTimeout(250);
  ok(await p.$eval('[data-esdecbox]',e=>e.hidden),'pressing the same word closes it again');

  console.log('5. what must I cover is derived, not restated');
  await p.$eval('[data-esdecopen="cover"]',e=>e.click()); await p.waitForTimeout(250);
  const cover=await p.$eval('[data-esdecpanel="cover"]',e=>e.innerText.replace(/\s+/g,' '));
  console.log('   ',cover.slice(0,140));
  ok(/All four areas/i.test(cover),'it names all four areas');
  ok(/e-marketing · people · processes · physical evidence/.test(cover),'from requirements.requiredAreas');
  ok(/characteristic → strategy change → case-study evidence/.test(cover),'and gives one chain to follow, not a checklist');
  ok(cover.split(' ').length < 60,'it is a synthesis, not the marking metadata: '+cover.split(' ').length+' words');
  ok(!/covers all four named elements/.test(cover),'the marker\u2019s wording is not shown to the student');
  const auth=await p.evaluate(()=>{
    const q=window.ESSAY.subjects.business_studies.questions.find(x=>x.id==='mkt-01');
    return { areas:(q.requirements.requiredAreas||[]).map(a=>a.id),
             refs:(q.decode.highlights||[]).filter(h=>h.kind==='requiredArea').map(h=>h.ref),
             inDecode:JSON.stringify(q.decode).toLowerCase(), acc:(q.requirements.accomplish||[])[0] };
  });
  ok(auth.areas.length===4,'requirements holds the required areas: '+JSON.stringify(auth.areas));
  ok(auth.refs.every(r=>auth.areas.indexOf(r)>=0),'and every highlight points at one rather than creating it');
  ok(auth.inDecode.indexOf(auth.acc.toLowerCase().slice(0,30))<0,'decode carries no second copy of the requirements');
  await p.screenshot({path:OUT+'shot-decode-cover.png'});

  console.log('6. it is support, not a gate');
  await p.$eval('[data-esdecopen="cover"]',e=>e.click()); await p.waitForTimeout(200);
  ok(!!(await p.$('.es-planwrap')),'planning was reachable without opening the decoder at all');
  // and it follows the student into writing
  await p.$$eval('[data-esplanpick]',es=>{const t=es.find(x=>/Digitally engaged/i.test(x.textContent));t&&t.click();});
  await p.waitForTimeout(300);
  await p.click('#esplango'); await p.waitForTimeout(450);
  ok((await p.$$('.es-dec')).length===6,'the decoder is still on the question while writing');
  await p.fill('#esline','A part-written sentence that must survive the decoder opening.');
  await p.$eval('[data-esdecopen="plain"]',e=>e.click()); await p.waitForTimeout(300);
  const plain=await p.$eval('[data-esdecpanel="plain"]',e=>e.innerText.replace(/\s+/g,' '));
  ok(/knowing who the customers are/i.test(plain),'plain English reads as plain English: '+plain.slice(0,70));
  ok((await p.$eval('#esline',e=>e.value)).length>0,'and opening it did not throw away the half-written sentence');
  await p.screenshot({path:OUT+'shot-decode-writing.png'});

  console.log('7. a question with nothing authored is left alone');
  await p.goto(T); await p.waitForTimeout(700);
  await p.$$eval('.navtab',es=>{const t=es.find(x=>/Essay practice/i.test(x.textContent));t&&t.click();});
  await p.waitForTimeout(400);
  await p.selectOption('#essubject','business_studies'); await p.waitForTimeout(200);
  await ownQuestion(p, 'Explain how target markets influence the development of marketing strategies.');
  await p.click('#esstart'); await p.waitForTimeout(500);
  await planAll(p);
  ok((await p.$$('.es-dec')).length===0,'no invented highlights on a question with no decode');
  ok(!(await p.$('.es-decrow')),'and no chips promising an explanation that does not exist');

  ok(calls===0,'no model call anywhere in decoding: '+calls);
  console.log('pageerrors:',errs.join(' | ')||'none');
  ok(errs.length===0,'no page errors');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
