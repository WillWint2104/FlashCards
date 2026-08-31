const { chromium, T, OUT, BASE, fileUrl, usePractice } = require('./env');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.route(/workers\.dev/, r => r.abort());
  await p.goto(T); await p.waitForTimeout(700);
  await p.$$eval('.navtab', es => { const t = es.find(x => /Essay practice/i.test(x.textContent)); t && t.click(); });
  await p.waitForTimeout(400);
  await p.selectOption('#essubject', 'business_studies'); await p.waitForTimeout(200);
  await usePractice(p); await p.$$eval('.es-qrow', es => { const t = es.find(x => /target markets/i.test(x.textContent)); t && t.click(); });
  await p.selectOption('#esstruct', 'six'); await p.waitForTimeout(150);
  await p.click('#esstart'); await p.waitForTimeout(400);
  const pick = async re => { await p.$$eval('[data-espath]', (es, r) => { const x = es.find(e => new RegExp(r, 'i').test(e.textContent)); x && x.click(); }, r => r, r => r).catch(() => {}); };
  const pick2 = async re => { await p.$$eval('[data-espath]', (es, r) => { const x = es.find(e => new RegExp(r, 'i').test(e.textContent)); x && x.click(); }, re); await p.waitForTimeout(250); };
  const start = async () => { const g = await p.$('#esstartwriting'); if (g) { await g.click(); await p.waitForTimeout(300); } };
  const say = async t => { await p.fill('#esline', t); await p.click('#esaccept'); await p.waitForTimeout(250); };

  // ---- 1. the introduction's signpost, written before any body exists
  await pick2('Digitally engaged'); await start();
  const introSlots = await p.$$eval('.es-prog', es => es.map(e => e.textContent.trim()));
  await say('Target markets shape every marketing decision a business makes.');
  const approach = await p.evaluate(() => ({
    guide: document.querySelector('.es-guideh').textContent.trim(),
    job: document.querySelector('.es-guidejob').textContent.trim(),
    // is anything on screen that tells the student what the four bodies will argue?
    bodiesChosen: 0
  }));
  console.log('1. Introduction slots:', JSON.stringify(introSlots));
  console.log('   at the signposting sentence the guide says:', JSON.stringify(approach.guide + ' / ' + approach.job));
  console.log('   body arguments chosen at this point: 0 of 4 (they are chosen later, one paragraph at a time)');
  await say('This will be shown through promotion, people, processes and physical evidence.');

  // ---- 2. does anything object to a sentence that does not do the slot job?
  await p.click('#esnext'); await p.waitForTimeout(350);
  await pick2('Digitally engaged'); await start();
  await p.fill('#esline', 'Banana.'); await p.waitForTimeout(150);
  const acceptEnabled = await p.$eval('#esaccept', e => !e.disabled);
  await p.click('#esaccept'); await p.waitForTimeout(300);
  const after = await p.evaluate(() => ({
    said: [...document.querySelectorAll('.es-said')].map(e => e.textContent.trim()),
    step: document.querySelector('.es-guideh').textContent.trim(),
    warnings: [...document.querySelectorAll('.es-checkline, .es-argchanged, .toast')].map(e => e.textContent.trim())
  }));
  console.log('2. a one-word sentence at the TOPIC slot: accepted =', acceptEnabled, '| step advanced to', JSON.stringify(after.step), '| objections:', JSON.stringify(after.warnings));

  // ---- 3. what happens at the end of a paragraph: is completion signalled?
  await p.$$eval('.es-said', es => es[0] && es[0].click()); await p.waitForTimeout(300);
  await p.click('[data-esdelblock="0"]'); await p.waitForTimeout(300);
  for (const t of ['A digitally engaged target market pushes the business towards digital marketing.',
                   'Because these customers live on their phones, the business reaches them there most cheaply.',
                   'McDonald’s runs an app with loyalty rewards and mobile ordering.',
                   'As a result repeat visits rise, which matters because repeat custom is cheap revenue.',
                   'Therefore the target market shapes the promotion strategy, which answers the question.']) await say(t);
  const done = await p.evaluate(() => ({
    step: document.querySelector('.es-guideh').textContent.trim(),
    placeholder: document.querySelector('#esline').placeholder,
    prog: [...document.querySelectorAll('.es-prog')].map(e => e.className.replace('es-prog', '').trim() + ':' + e.textContent.trim()),
    nextGuideDisabled: document.querySelector('#esnextguide').disabled,
    anyDoneSignal: [...document.querySelectorAll('.es-canvas')].map(e => e.innerText).join(' ').match(/complete|finished|done|all five/i),
    mapClasses: [...document.querySelectorAll('.es-mapitem')].map(e => e.className.replace('es-mapitem', '').trim() + ':' + e.textContent.trim())
  }));
  console.log('3. after the fifth sentence of a body paragraph:');
  console.log('   still showing step', JSON.stringify(done.step), '| line placeholder', JSON.stringify(done.placeholder));
  console.log('   progress row:', JSON.stringify(done.prog));
  console.log('   "Next guide" disabled:', done.nextGuideDisabled, '| any completion wording on screen:', done.anyDoneSignal ? done.anyDoneSignal[0] : 'none');
  console.log('   response map:', JSON.stringify(done.mapClasses));
  await p.screenshot({ path: OUT + 'shot-13-paragraph-finished.png' });

  // ---- 4. the cost of writing a sixth sentence in a paragraph
  const beforeC = await p.evaluate(() => ({ n: document.querySelectorAll('.es-said').length }));
  await say('This also matters because the business can measure which offers actually work.');
  const sixth = await p.evaluate(() => ({ n: document.querySelectorAll('.es-said').length, slot: document.querySelector('.es-guideh').textContent.trim() }));
  console.log('4. a sixth sentence beyond the scaffold:', beforeC.n, '->', sixth.n, 'and the guide still says', JSON.stringify(sixth.slot));

  console.log('errors:', errs.join(' | ') || 'none');
  await b.close();
})();
