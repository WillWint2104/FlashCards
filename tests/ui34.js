// INTERACTION STABILITY. Opening a support tool must cost the student nothing.
//
// This existed as a bug with two faces and one cause. esRenderKeepingPlace rebuilt
// the entire workspace with innerHTML and then wrote the student's sentence back
// with `.value =`. That:
//
//   * destroyed the browser undo stack, because assigning .value is not an edit,
//     so opening Vocabulary mid-sentence silently ended their ability to undo;
//   * replayed the card's entry animation, leaving the composer at opacity 0 for
//     a moment with the page showing through it, which reads as the app
//     navigating away and coming back;
//   * evicted the column that owns the question decoder, leaving six lit stem
//     buttons under the printed instruction "or press any highlighted words
//     above" with no handler bound to any of them.
//
// The assertions are on NODE IDENTITY, not on values surviving. Values survived
// before the fix too, because they were restored afterwards; that is what made
// the defect hard to see and what makes value-survival the wrong test.
const { chromium, T, usePractice } = require('./env');

// Waits that name their condition. This app fetches nothing and renders
// synchronously, so the effect of a click is present on the next frame:
// settled() is that frame, not a shorter guess at a duration.
const settled = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const here = (p, sel) => p.waitForSelector(sel, { timeout: 8000 });
let pass=0,fail=0; const ok=(c,m)=>{ if(c) pass++; else {fail++; console.log('  FAIL:',m);} };

async function toComposer(p){
  await p.goto(T); await here(p, '.navtab');
  await p.evaluate(()=>localStorage.removeItem('marginal.essay.v1'));
  await p.goto(T); await here(p, '.navtab');
  await p.$$eval('.navtab',es=>{const t=es.find(x=>/Essay practice/i.test(x.textContent));t&&t.click();});
  await settled(p);
  await p.selectOption('#essubject','business_studies').catch(()=>{});
  await usePractice(p); await p.$$eval('.qp-row',es=>{const t=es.find(x=>/target markets affect/i.test(x.textContent));t&&t.click();});
  await p.click('#esstart');
  await p.waitForFunction(() => !!document.querySelector('#esline, .es-startrow, [data-espath]'), null, { timeout: 8000 });
  if (await p.$('.es-startrow')) await p.$$eval('.es-startrow',es=>{const t=es.filter(x=>/Body/.test(x.textContent))[0];t&&t.click();});
  await settled(p);
  await p.$$eval('[data-espath]',es=>es[0]&&es[0].click()); await settled(p);
  const sw=await p.$('#esstartwriting'); if(sw){await sw.click(); await settled(p);}
}

(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  await p.route(/workers\.dev/, r=>r.abort());
  await toComposer(p);

  // Prove the thing under test is on screen before asserting anything about it.
  ok(!!(await p.$('#esline')),'the composer is on screen');
  const tools = await p.$$eval('[data-estool]',es=>es.filter(e=>!e.disabled).map(e=>e.dataset.estool));
  console.log('    tools available:', JSON.stringify(tools));
  ok(tools.length>=3,'at least three tools are available to switch between: '+tools.length);

  await p.evaluate(()=>{ window.__ref={};
    ['.es-scrim','.es-shell','.es-wrap','.es-belt','.es-map','.es-compose','#esline']
      .forEach(s=>window.__ref[s]=document.querySelector(s)); });
  await p.click('#esline');
  await p.type('#esline','First edit. ',{delay:10});
  await p.type('#esline','Second edit.',{delay:10});
  const before = await p.evaluate(()=>({v:document.querySelector('#esline').value,
    sel:document.querySelector('#esline').selectionStart}));

  console.log('--- switching tools rebuilds nothing ---');
  // Learn opens the study resources window now, which is a modal rather than a tool the
  // belt swaps in place, so it is exercised separately below. The cycle here is
  // the four writing tools, which do switch inside one window.
  const cycle = ['evidence','structure','vocabulary','evidence'].filter(t=>tools.includes(t));
  ok(cycle.length>=3,'the cycle exercises at least three tools');
  for (const t of cycle){
    await p.$$eval(`[data-estool="${t}"]`,es=>es[0].click()); await settled(p);
    const st = await p.evaluate(()=>({
      recreated:['.es-scrim','.es-shell','.es-wrap','.es-belt','.es-map','.es-compose','#esline']
        .filter(s=>document.querySelector(s)!==window.__ref[s]),
      anims:(document.querySelector('.es-wrap')?.getAnimations()||[]).length,
      setup:!!document.querySelector('#esstart, .qp-row, #essubject'),
      v:document.querySelector('#esline')?.value,
      sel:document.querySelector('#esline')?.selectionStart }));
    ok(st.recreated.length===0, t+': no workspace node was rebuilt, kept '+JSON.stringify(st.recreated));
    ok(st.anims===0,          t+': the card did not replay its entry animation');
    ok(st.setup===false,      t+': the setup screen was never exposed');
    ok(st.v===before.v,       t+': the sentence survived');
    ok(st.sel===before.sel,   t+': the caret survived at '+st.sel);
  }

  console.log('--- and opening the Learning Centre rebuilds nothing either ---');
  // The surface changed from a drawer to a modal, so the same guarantee has to be
  // proven again on the new one: the workspace underneath is not remounted.
  if (tools.includes('understand')) {
    await p.$$eval('[data-estool="understand"]', es => es[0].click()); await settled(p);
    const cst = await p.evaluate(()=>({
      centre: !!document.querySelector('.es-study'),
      recreated:['.es-scrim','.es-shell','.es-wrap','.es-belt','.es-compose','#esline']
        .filter(s=>document.querySelector(s)!==window.__ref[s]),
      v: document.querySelector('#esline')?.value }));
    ok(cst.centre,'Learn opens the study resources window');
    ok(cst.recreated.length===0,'and the workspace under it is the same DOM: '+JSON.stringify(cst.recreated));
    ok(cst.v===before.v,'with the sentence untouched: '+JSON.stringify((cst.v||'').slice(0,30)));
    await p.keyboard.press('Escape'); await settled(p);
  } else ok(false,'the Learn control is reachable');

  console.log('--- and the student can still undo ---');
  // The point of the whole fix. Before it, this returned the text unchanged
  // because .value assignment never entered the undo stack.
  await p.click('#esline');
  await p.keyboard.press('Control+z'); await settled(p);
  const undone = await p.evaluate(()=>document.querySelector('#esline').value);
  ok(undone!==before.v,'Ctrl+Z undid the student’s typing: '+JSON.stringify(undone));

  console.log('--- the question decoder stays alive behind an open drawer ---');
  // Open a tool that is NOT already open: clicking the lit one toggles it shut,
  // and the cycle above finishes with one lit.
  // Skip Learn: it opens the Centre, not a drawer, and this checks the decoder
  // survives behind a writing tool.
  await p.$$eval('[data-estool]',es=>{
    const t=es.find(x=>!x.disabled && !x.classList.contains('on') && x.dataset.estool!=='understand');
    t&&t.click(); });
  await settled(p);
  ok(!!(await p.$('.es-drawer')),'a drawer is open');
  const dec = await p.$$eval('[data-esdecode]',es=>es.map(e=>e.textContent.trim()));
  ok(dec.length>0,'the stem still offers decode controls with a drawer open: '+dec.length);
  ok((await p.$$('[data-esdecbox]')).length===1,'and the panel container they need is present');
  if (dec.length){
    await p.$$eval('[data-esdecode]',es=>es[0].click()); await settled(p);
    const shown = await p.evaluate(()=>({
      panels:[...document.querySelectorAll('[data-esdecpanel]')].filter(x=>!x.hidden).length,
      boxHidden:document.querySelector('[data-esdecbox]')?.hidden }));
    ok(shown.panels===1,'pressing a highlighted word opens exactly one panel');
    ok(shown.boxHidden===false,'and the decoder box is visible rather than a dead control');
  }

  console.log('pageerrors:', errs.length?errs.slice(0,3):'none');
  ok(errs.length===0,'no page errors');
  console.log(pass+' passed, '+fail+' failed');
  await b.close();
  process.exit(fail?1:0);
})();
