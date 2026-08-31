const { chromium, T, OUT, BASE, fileUrl, ownQuestion } = require('./env');
const { nextSection, prevSection } = require('./env');
let pass=0,fail=0; const ok=(c,m)=>{ if(c) pass++; else {fail++; console.log('  FAIL:',m);} };
(async()=>{
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:1500,height:1050},deviceScaleFactor:2});
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,220)));
  let calls=0; await p.route(/workers\.dev/, r=>{ calls++; r.abort(); });
  await p.goto(T); await p.waitForTimeout(800);
  // TEST FIXTURE: unsourced evidence is withheld by design, so the suite supplies
  // sources of its own rather than weakening the rule under test.
  await p.evaluate(()=>{ Object.keys((window.BUSCONTENT||{}).evidence||{}).forEach(k=>
    window.BUSCONTENT.evidence[k].forEach(e=>{ e.source='test fixture source'; e.checked='2026-08-19'; })); });
  await p.$$eval('.navtab',es=>{const t=es.find(x=>/Essay practice/i.test(x.textContent));t&&t.click();});
  await p.waitForTimeout(500);
  await p.$$eval('#essubject option',()=>{});
  await p.selectOption('#essubject','business_studies').catch(()=>{});
  await p.waitForTimeout(300);
  // The BROADER practice stem on purpose. It is a separate question with no
  // authored pathways, so this suite exercises the fallback resolution the
  // toolbelt has to do when nothing is authored for the question.
  await ownQuestion(p, 'Explain how target markets influence the development of marketing strategies.');
  await p.click('#esstart'); await p.waitForTimeout(500);
  // move to a body paragraph and give it a point so context can resolve
  await nextSection(p);
  { const t = await p.$('#espointtoggle'); if (t && !(await p.$('#espoint'))) { await t.click(); await p.waitForTimeout(250); } }
  await p.fill('#espoint','Digitally engaged target markets push businesses towards e-marketing.');
  await p.waitForTimeout(200);

  console.log('--- the toolbelt is compact and does not dominate ---');
  ok(!!(await p.$('.es-belt')),'the toolbelt is present');
  const tools = await p.$$eval('.es-belt-b',es=>es.map(e=>({t:e.textContent.trim(),off:e.disabled})));
  console.log('    tools:', tools.map(t=>t.t+(t.off?' (off)':'')).join(' | '));
  ok(tools.length===5,'five tools, help is not one of them: '+tools.length);
  ok(!tools.some(t=>/help/i.test(t.t)),'help stays with the sentence, not in the toolbelt');
  const beltH = await p.$eval('.es-belt',e=>e.getBoundingClientRect().height);
  ok(beltH<60,'it is a strip, not a row of cards: '+Math.round(beltH)+'px');
  ok(!!(await p.$('.es-belt-b svg')),'icons are inline SVG, not emoji');
  const emoji = await p.$eval('.es-belt',e=>/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(e.textContent));
  ok(!emoji,'no emoji in the toolbelt');

  console.log('--- the tools wake up when the paragraph says what it argues ---');
  ok(tools.filter(t=>!t.off).length>=4,'most tools now have authored content behind them: '+tools.filter(t=>!t.off).length+'/5');
  const understand = tools.find(t=>/Learn/.test(t.t));
  ok(understand && !understand.off,'Learn resolved from the authored content layer');

  console.log('--- a subject with no authored content layer fails cleanly ---');
  {
    const p2 = await ctx.newPage();
    await p2.route(/workers\.dev/, r=>r.abort());
    await p2.goto(T); await p2.waitForTimeout(700);
    await p2.$$eval('.navtab',es=>{const t=es.find(x=>/Essay practice/i.test(x.textContent));t&&t.click();});
    await p2.waitForTimeout(400);
    await p2.selectOption('#essubject','ancient_history').catch(()=>{});
    await p2.waitForTimeout(250);
    await ownQuestion(p2, 'Explain how religious beliefs shaped everyday life in one ancient society you have studied.');
    await p2.click('#esstart'); await p2.waitForTimeout(400);
    const t2 = await p2.$$eval('.es-belt-b',es=>es.map(e=>({t:e.textContent.trim(),off:e.disabled})));
    console.log('    ancient history tools:', t2.map(x=>x.t+(x.off?' (off)':'')).join(' | '));
    const contentTools = t2.filter(x=>/Learn|Evidence|Vocabulary/.test(x.t));
    ok(contentTools.every(x=>x.off),'no authored content layer means those tools are disabled, not filled');
    ok((t2.find(x=>/Structure/.test(x.t))||{}).off===false,'Structure still works: it is derived, not authored');
    const body = await p2.$eval('#eshost',e=>e.textContent);
    ok(!/lorem|coming soon|not available yet/i.test(body),'and nothing shows filler text');
    await p2.close();
  }

  console.log('--- opening a drawer does NOT crush the composer ---');
  const w0 = await p.$eval('.es-compose',e=>Math.round(e.getBoundingClientRect().width));
  await p.click('[data-estool="structure"]'); await p.waitForTimeout(350);
  ok(!!(await p.$('.es-drawer')),'the drawer opened');
  const w1 = await p.$eval('.es-compose',e=>Math.round(e.getBoundingClientRect().width));
  console.log('    composer width:', w0, '->', w1);
  ok(w1>=650,'the composer keeps a usable width: '+w1+'px');
  ok(!(await p.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)),'no horizontal overflow');

  console.log('--- the drawer is contextual, not a static page ---');
  const struct = await p.$eval('.es-drawer-body',e=>e.textContent);
  ok(/Right now/.test(struct),'Structure says what job is being done now');
  ok(/Body 1|Introduction|Conclusion/i.test(await p.$eval('.es-drawer .es-drawer-h',e=>e.textContent)),'and names this paragraph');

  console.log('--- cursor returns to the EXACT character on close ---');
  await p.click('.es-drawer-x'); await p.waitForTimeout(300);
  await p.fill('#esline','Digitally engaged customers spend time on social platforms.');
  await p.$eval('#esline',e=>{ e.focus(); e.setSelectionRange(17,17); });   // mid-word, mid-sentence
  const before = await p.$eval('#esline',e=>({v:e.value,s:e.selectionStart,e:e.selectionEnd}));
  await p.click('[data-estool="structure"]'); await p.waitForTimeout(350);
  ok(!!(await p.$('.es-drawer')),'drawer reopened while mid-sentence');
  await p.keyboard.press('Escape'); await p.waitForTimeout(350);
  ok(!(await p.$('.es-drawer')),'Escape closes it');
  const after = await p.$eval('#esline',e=>({v:e.value,s:e.selectionStart,e:e.selectionEnd,focused:document.activeElement===e}));
  ok(after.v===before.v,'the half-written sentence is intact: '+JSON.stringify(after.v.slice(0,40)));
  ok(after.focused,'the composer has focus back');
  ok(after.s===before.s && after.e===before.e,'and the cursor is on the exact character: '+before.s+' -> '+after.s);
  await p.keyboard.type('X');
  const typed = await p.$eval('#esline',e=>e.value);
  const expect = before.v.slice(0,before.s) + 'X' + before.v.slice(before.s);
  ok(typed===expect,'typing continues from exactly there: '+JSON.stringify(typed.slice(0,30)));

  console.log('--- no model request anywhere in the toolbelt ---');
  // Learn opens the Learning Centre rather than a drawer, and the Centre is a
  // modal: leaving it open swallows the press on the next tool. Each surface is
  // closed before the next is opened, so the loop really does visit all five
  // rather than stopping at the first one that covers the others.
  for (const t of ['understand','ideas','evidence','structure','vocabulary']) {
    const btn = await p.$(`[data-estool="${t}"]:not([disabled])`);
    if (btn) {
      await btn.click(); await p.waitForTimeout(250);
      await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    }
  }
  ok(calls===0,'zero worker calls after opening every tool: '+calls);

  await p.click('[data-estool="understand"]').catch(()=>{});
  await p.waitForTimeout(350);
  await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  await p.$eval('#esline',e=>e.scrollIntoView({block:'center'})).catch(()=>{});
  await p.screenshot({path:OUT+'shot-toolbelt.png'});

  console.log('--- a student who needs nothing is not obstructed ---');
  await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  const geo = await p.evaluate(()=>{
    const l=document.querySelector('#esline').getBoundingClientRect();
    const g=document.querySelector('.es-guide').getBoundingClientRect();
    return {gap:Math.round(g.top-l.bottom)};
  });
  ok(geo.gap<40,'the guide is still immediately under the line: '+geo.gap+'px');

  console.log('pageerrors:', errs.join(' | ')||'none');
  ok(errs.length===0,'no page errors');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
