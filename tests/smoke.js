// Functional smoke pass: walk every access point the way a person would, on the
// real walkthrough build, and report anything broken or dead-ended. Asserts
// nothing about design; it is looking for things that do not work.
const { chromium, T, OUT, usePractice } = require('./env');
const { planAll } = require('./env');
const { nextSection, prevSection } = require('./env');
const problems = [], notes = [];
const bad = m => { problems.push(m); console.log('  BROKEN:', m); };
const note = m => { notes.push(m); console.log('  note:', m); };
const okline = m => console.log('  ok:', m);
(async()=>{
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport:{width:1500,height:1000} });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0,200)));
  const cerr = []; p.on('console', m => { if (m.type()==='error') cerr.push(m.text().slice(0,160)); });
  let calls = 0; await p.route(/workers\.dev/, r => { calls++; r.abort(); });

  console.log('\n=== 1. the hub ===');
  await p.goto(T); await p.waitForTimeout(900);
  const tabs = await p.$$eval('.navtab', es => es.map(e => e.textContent.trim()));
  console.log('  tabs:', JSON.stringify(tabs));
  if (!tabs.length) bad('no navigation tabs rendered at all');
  const hub = await p.evaluate(() => document.body.innerText.length);
  if (hub < 200) bad('the hub rendered almost nothing: ' + hub + ' chars');
  else okline('hub renders, ' + hub + ' chars');

  const goTab = async re => {
    const hit = await p.$$eval('.navtab', (es, r) => { const t = es.find(x => new RegExp(r,'i').test(x.textContent)); if (t) { t.click(); return t.textContent.trim(); } return null; }, re);
    await p.waitForTimeout(500); return hit;
  };

  console.log('\n=== 2. every tab opens ===');
  for (const t of tabs) {
    const hit = await goTab(t.replace(/[^\w\s]/g,'').trim().split(/\s+/)[0]);
    const txt = await p.evaluate(() => document.body.innerText.trim().length);
    if (!hit) { bad('tab "' + t + '" could not be clicked'); continue; }
    if (txt < 120) bad('tab "' + t + '" opens a near-empty screen (' + txt + ' chars)');
    else okline('"' + t + '" opens (' + txt + ' chars)');
    // Essay practice mounts a modal over the hub. A real click cannot reach the
    // tabs behind it, so leave the way a student does before opening the next tab.
    if (await p.$('#eshost')) {
      const out = await p.$('#eshost .es-x');
      if (!out) bad('essay practice has no way back to the hub');
      else { await out.click(); await p.waitForTimeout(400);
        if (await p.$('#eshost')) bad('the essay overlay would not close from its own control');
        else okline('and closes back to the hub');
      }
    }
  }

  console.log('\n=== 3. test mode: a preloaded paper ===');
  await goTab('Test');
  const papers = await p.$$eval('button, .exrow, [data-exam]', es => es.map(e=>e.textContent.trim()).filter(t=>/2025|paper|business/i.test(t))).catch(()=>[]);
  console.log('  paper-ish controls:', JSON.stringify(papers.slice(0,4)));
  if (!papers.length) bad('Test mode shows no preloaded paper');
  else {
    await p.$$eval('button', es => { const t = es.find(x=>/Sit this paper/i.test(x.textContent)); t && t.click(); });
    await p.waitForTimeout(800);
    if (!(await p.$('[data-exampick]'))) bad('the paper does not offer a section picker');
    else {
      // short answer only, so the walk reaches a written question quickly
      await p.evaluate(() => { document.querySelectorAll('[data-exampick]').forEach((b,i)=>{ b.checked = (i===1); b.dispatchEvent(new Event('change',{bubbles:true})); }); });
      await p.waitForTimeout(200);
      await p.click('#exampickgo'); await p.waitForTimeout(800);
      const begun = await p.evaluate(() => { const b=[...document.querySelectorAll('button')].find(x=>/^Begin/i.test(x.textContent.trim())); if(b){b.click();return true;} return false; });
      if (!begun) bad('the section intro has no way to begin');
      await p.waitForTimeout(800);
      if (!(await p.$('textarea'))) bad('the first short-answer question has no answer box');
      else okline('a written question opens with an answer box');
      const shape = await p.$eval('.ansshape', e=>e.innerText.replace(/\s+/g,' ')).catch(()=>'');
      if (!shape) bad('no answer-shape guidance on a written paper question');
      else okline('answer guidance renders: ' + JSON.stringify(shape.slice(0,70)));
      await p.fill('textarea','A short answer written to check the flow works end to end, with a reason and an example.');
      await p.waitForTimeout(200);
      const checked = await p.evaluate(() => { const b=[...document.querySelectorAll('button')].find(x=>/^Check answer/i.test(x.textContent.trim())); if(b&&!b.disabled){b.click();return true;} return false; });
      if (!checked) bad('no way to check a short answer');
      else { await p.waitForTimeout(900);
        const after = await p.$$eval('button', es=>es.map(x=>x.textContent.trim()).filter(Boolean));
        if (!after.some(x=>/Continue|Mark this properly/i.test(x))) bad('checking an answer leads nowhere: ' + JSON.stringify(after.slice(0,6)));
        else okline('checking offers: ' + JSON.stringify(after.filter(x=>/Continue|Mark this|Try again/i.test(x))));
      }
    }
  }

  console.log('\n=== 4. essay practice, end to end ===');
  await p.goto(T); await p.waitForTimeout(700);
  await goTab('Essay');
  const subj = await p.$('#essubject');
  if (!subj) { bad('essay practice did not open its setup screen'); }
  else {
    await p.selectOption('#essubject','business_studies'); await p.waitForTimeout(250);
    const chips = await usePractice(p); await p.$$eval('.qp-row', es => es.length);
    if (!chips) bad('no authored questions offered for Business Studies');
    else okline(chips + ' authored questions offered');
    await usePractice(p); await p.$$eval('.qp-row', es => { const t = es.find(x=>/target markets/i.test(x.textContent)); t && t.click(); });
    await p.waitForTimeout(250);
    await p.click('#esstart'); await p.waitForTimeout(600);
  await planAll(p);

    // --- plan
    if (!(await p.$('.es-planwrap'))) bad('the planning screen did not open');
    else {
      // unplanned bodies are compact rows, not cards, so count both
      const cards = await p.$$eval('.es-plancard,.es-planrow', es => es.length);
      okline('planning opens with ' + cards + ' bodies to plan');
      // only the body being decided is expanded, so each is opened in turn
      for (const re of ['Digitally engaged','same experience everywhere','expect speed','different physical settings']) {
        const hit = await p.$$eval('[data-esplanpick]', (es,r)=>{ const t=es.find(x=>new RegExp(r,'i').test(x.textContent)); if(t){t.click();return true;} return false; }, re);
        if (!hit) note('plan: no option matched ' + re + ' in the open card');
        await p.waitForTimeout(280);
      }
      const done = await p.$$eval('.es-plancard.done', es => es.length);
      if (done !== cards) bad('planned ' + done + ' of ' + cards + ' body paragraphs');
      else okline('all ' + done + ' bodies planned');
      const chipsEv = await p.$$eval('.es-plancard .es-evchip', es => es.length);
      if (!chipsEv) note('EVIDENCE IS DARK: no selectable evidence in the plan (nothing is sourced yet)');
      await p.click('#esplango'); await p.waitForTimeout(500);
    }

    // --- write every section
    if (!(await p.$('#esline'))) bad('after planning there is no writing line');
    else {
      let written = 0, sections = 0;
      for (let s = 0; s < 6; s++) {
        sections++;
        const role = await p.$eval('.es-pararole', e => e.textContent.trim()).catch(()=>'?');
        if (await p.$('.es-setup')) bad(role + ' still asks for setup after planning');
        for (let i = 0; i < 6; i++) {
          if (!(await p.$('#esline'))) break;
          const head = await p.$eval('.es-guideh', e=>e.textContent.trim()).catch(()=>'');
          await p.fill('#esline', 'A sentence written for the ' + (head||'next') + ' part of ' + role + ', long enough to read as prose.');
          await p.click('#esaccept'); await p.waitForTimeout(200); written++;
        }
        const doneCard = await p.$('.es-done');
        if (!doneCard) note(role + ': no completion card after filling every component');
        const nxt = await p.$('#esdonenext') || await p.$('#esnext');
        if (!nxt || await nxt.evaluate(e=>e.disabled)) break;
        await nxt.click(); await p.waitForTimeout(400);
        if (await p.$('.es-rvwrap')) break;   // landed on review
      }
      okline(written + ' sentences across ' + sections + ' sections');
    }

    // --- review and submit
    if (!(await p.$('.es-rvwrap'))) { const r = await p.$('#esfootpreview'); if (r) { await r.click(); await p.waitForTimeout(500); } }
    if (!(await p.$('.es-rvwrap'))) bad('could not reach the whole-response review');
    else {
      const secs = await p.$$eval('.es-rvsec', es=>es.length);
      const texts = await p.$$eval('.es-rvtext', es=>es.length);
      okline('review shows ' + texts + ' written sections of ' + secs);
      if (!(await p.$('#essubmit'))) bad('no submit control on the review screen');
      else {
        await p.click('#essubmit'); await p.waitForTimeout(1200);
        const after = await p.$eval('.es-completion', e=>e.innerText.replace(/\s+/g,' ').trim()).catch(()=>'');
        // the worker is blocked by this harness on purpose, so a graceful failure
        // here IS the pass: the request went out and the student was told plainly
        if (/marked on what you wrote|Marking your response|Saved/i.test(after)) okline('submit reaches the marker and degrades honestly when it cannot: ' + JSON.stringify(after.slice(0,80)));
        else bad('submit did nothing visible: ' + JSON.stringify(after.slice(0,90)));
        if (!calls) bad('submit made no request to the worker (marking would never happen)');
        else okline('submit issued ' + calls + ' marking request(s)');
      }
    }
    await p.screenshot({ path: OUT + 'shot-smoke-review.png', fullPage: false });
  }

  console.log('\n=== 5. the support layers ===');
  await p.goto(T); await p.waitForTimeout(700);
  await goTab('Essay');
  await p.selectOption('#essubject','business_studies'); await p.waitForTimeout(200);
  await usePractice(p); await p.$$eval('.qp-row', es => { const t=es.find(x=>/target markets/i.test(x.textContent)); t&&t.click(); });
  await p.click('#esstart'); await p.waitForTimeout(500);
  await planAll(p);
  await p.$$eval('.es-plancard [data-esplanarea]', es => { const t=es.find(x=>/processes/i.test(x.textContent)); t&&t.click(); });
  await p.waitForTimeout(300);
  await p.$$eval('[data-esplanpick]', es => { const t=es.find(x=>/Convenience-oriented/i.test(x.textContent)); t&&t.click(); });
  await p.waitForTimeout(300);
  await p.click('#esplango'); await p.waitForTimeout(400);
  await p.$$eval('[data-esgo]', es => { const t=es.find(x=>/Body 1/.test(x.textContent)); t&&t.click(); });
  await p.waitForTimeout(400);
  const belt = await p.$$eval('.es-belt-b', es => es.map(e=>({l:e.textContent.trim(), off:e.disabled})));
  console.log('  toolbelt:', JSON.stringify(belt.map(x=>x.l+(x.off?' (off)':''))));
  for (const t of belt.filter(x=>!x.off)) {
    const key = await p.$$eval('.es-belt-b', (es,l)=>{ const x=es.find(e=>e.textContent.trim()===l); return x?x.dataset.estool:null; }, t.l);
    await p.$eval('[data-estool="'+key+'"]', e=>e.click()); await p.waitForTimeout(300);
    const body = await p.$eval('.es-drawer-body', e=>e.innerText.replace(/\s+/g,' ').trim()).catch(()=>'');
    if (!body || body.length < 40) bad('the ' + t.l + ' drawer opens nearly empty');
    else okline(t.l + ' drawer: ' + body.length + ' chars');
    await p.click('#esdrawerx'); await p.waitForTimeout(200);
    if (!(await p.$('#esline'))) bad('closing the ' + t.l + ' drawer lost the writing line');
  }
  let rungs = 0;
  for (let k=0;k<6;k++){ const btn = await p.$('#esmorehelp'); if(!btn) break; await btn.click(); await p.waitForTimeout(120); rungs++; }
  if (rungs < 5) bad('the help ladder only went ' + rungs + ' rungs on the reference area');
  else okline('help ladder goes ' + rungs + ' rungs');
  await p.screenshot({ path: OUT + 'shot-smoke-support.png' });

  console.log('\n=== 6. errors ===');
  if (errs.length) errs.forEach(e => bad('page error: ' + e)); else okline('no uncaught page errors');
  if (cerr.length) cerr.slice(0,5).forEach(e => note('console error: ' + e));

  console.log('\n---------------------------------------------');
  console.log(problems.length ? problems.length + ' thing(s) broken' : 'nothing broken');
  problems.forEach(x => console.log('  ! ' + x));
  if (notes.length) { console.log(notes.length + ' thing(s) worth knowing'); notes.forEach(x => console.log('  - ' + x)); }
  await b.close();
  process.exit(problems.length ? 1 : 0);
})();
