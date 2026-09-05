// Probe pass: the questions the click counts cannot answer. Changes nothing.
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
  await usePractice(p); await p.$$eval('.qp-row', es => { const t = es.find(x => /target markets/i.test(x.textContent)); t && t.click(); });
  await p.selectOption('#esstruct', 'six'); await p.waitForTimeout(150);
  await p.click('#esstart'); await p.waitForTimeout(400);

  // ---- 1. does the point field ever narrow the argument list?
  const n0 = await p.$$eval('[data-espath]', es => es.length);
  await p.fill('#espoint', 'How the target market shapes e-marketing.'); await p.waitForTimeout(400);
  const n1 = await p.$$eval('[data-espath]', es => es.length);
  await p.click('[data-esrestchange="argument"]'); await p.waitForTimeout(400);   // force a re-render
  const n2 = await p.$$eval('[data-espath]', es => es.length);
  console.log('1. argument options: on arrival', n0, '| after typing the point', n1, '| after a re-render', n2);

  // ---- 2. how similar are the four body pathways' guides?
  const guides = await p.evaluate(() => {
    const q = window.ESSAY.subjects.business_studies.questions.find(x => x.id === 'mkt-01');
    const slots = window.ESSAY.subjects.business_studies.scaffolds.teeec.body.map(s => s.key);
    return q.pathways.map(pa => ({ id: pa.id, area: pa.area,
      guides: slots.map(k => (pa.guides && pa.guides[k]) ? 'authored' : 'slot default'),
      helpSlots: Object.keys(pa.help || {}) }));
  });
  const bySlot = {};
  guides.forEach(g => g.guides.forEach((v, i) => { bySlot[i] = (bySlot[i] || 0) + (v === 'authored' ? 1 : 0); }));
  console.log('2. pathways with an authored guide per slot (of 12):', JSON.stringify(bySlot));
  console.log('   pathways with any help ladder:', guides.filter(g => g.helpSlots.length).map(g => g.id + '[' + g.helpSlots + ']').join(', ') || 'none');
  console.log('   total authored ladder rungs available across the whole question:',
    await p.evaluate(() => {
      const q = window.ESSAY.subjects.business_studies.questions.find(x => x.id === 'mkt-01');
      return q.pathways.reduce((n, pa) => n + Object.keys(pa.help || {}).length, 0);
    }), 'slot ladders out of', 12 * 5, 'pathway/slot combinations');

  // ---- 3. write a whole response quickly through state, then look at the conclusion
  await p.evaluate(() => {
    const roles = ['Introduction', 'Body 1', 'Body 2', 'Body 3', 'Body 4', 'Conclusion'];
    // drive through the same public path the UI uses: nothing is patched
  });
  // do it for real but fast: intro + 4 bodies, one sentence each, then stand in the conclusion
  const pick = async re => { await p.$$eval('[data-espath]', (es, r) => { const x = es.find(e => new RegExp(r, 'i').test(e.textContent)); x && x.click(); }, re); await p.waitForTimeout(250); };
  const start = async () => { const g = await p.$('#esstartwriting'); if (g) { await g.click(); await p.waitForTimeout(300); } };
  const say = async t => { await p.fill('#esline', t); await p.click('#esaccept'); await p.waitForTimeout(250); };
  await pick('Digitally engaged'); await start();
  await say('Target markets shape every marketing decision a business makes.');
  await say('This will be shown through promotion, people, processes and physical evidence.');
  await p.click('#esnext'); await p.waitForTimeout(350);
  const areas = [['Digitally engaged', 'digital marketing'], ['same experience everywhere', 'standardised training'],
                 ['expect speed', 'faster processes'], ['different physical settings', 'segmented settings']];
  for (const [re, word] of areas) {
    await pick(re); await start();
    await say('This paragraph argues that the target market drives ' + word + ' in the business.');
    await p.click('#esnext'); await p.waitForTimeout(350);
  }
  // now standing in the Conclusion, about to write the restatement
  await pick('Digitally engaged'); await start();
  const atConclusion = await p.evaluate(() => {
    const txt = document.querySelector('.es-canvas').innerText;
    const map = [...document.querySelectorAll('.es-mapitem')].map(e => e.innerText.trim());
    const rail = document.querySelector('.es-rest') ? document.querySelector('.es-rest').innerText.trim() : '';
    const said = [...document.querySelectorAll('.es-said')].map(e => e.textContent.trim());
    // is ANY word of the four body arguments on screen?
    const probes = ['digital marketing', 'standardised training', 'faster processes', 'segmented settings'];
    return { mapLabels: map, railText: rail, ownSentencesOnScreen: said.length,
      bodyArgumentsFindable: probes.filter(w => txt.toLowerCase().includes(w)),
      guide: document.querySelector('.es-guideh') ? document.querySelector('.es-guideh').innerText.trim() : '',
      job: document.querySelector('.es-guidejob') ? document.querySelector('.es-guidejob').innerText.trim() : '',
      wordcount: document.querySelector('.es-wordcount') ? document.querySelector('.es-wordcount').innerText.replace(/\s+/g, ' ') : '' };
  });
  console.log('3. standing in the Conclusion, at the RESTATEMENT step:');
  console.log('   guide:', JSON.stringify(atConclusion.guide), atConclusion.job);
  console.log('   own sentences on screen:', atConclusion.ownSentencesOnScreen);
  console.log('   how many of the four body arguments are recoverable on screen:', atConclusion.bodyArgumentsFindable.length, 'of 4');
  console.log('   the response map says:', JSON.stringify(atConclusion.mapLabels));
  console.log('   the right rail says:', JSON.stringify(atConclusion.railText.replace(/\s+/g, ' ')));
  console.log('   the word counter says:', JSON.stringify(atConclusion.wordcount));
  await p.screenshot({ path: OUT + 'shot-10-conclusion-blind.png' });

  // ---- 4. what marking is reachable from guided mode?
  const marking = await p.evaluate(() => {
    const btns = [...document.querySelectorAll('.es-canvas button')].map(e => (e.id || '') + ':' + e.textContent.trim());
    return btns.filter(x => /check|mark|feedback|submit/i.test(x));
  });
  console.log('4. marking controls reachable in guided mode:', JSON.stringify(marking));
  await p.click('#esmodeswitch'); await p.waitForTimeout(500);
  const full = await p.evaluate(() => ({
    btns: [...document.querySelectorAll('.es-canvas button')].map(e => (e.id || '') + ':' + e.textContent.trim()).filter(x => /check|mark|feedback|submit|guided/i.test(x)),
    chars: (document.querySelector('textarea') || {}).value ? document.querySelector('textarea').value.length : 0,
    hasBelt: !!document.querySelector('.es-belt'), hasGuide: !!document.querySelector('.es-guide'),
    hasMap: !!document.querySelector('.es-map'), hasRail: !!document.querySelector('.es-rest')
  }));
  console.log('4b. in full-attempt mode:', JSON.stringify(full));
  await p.screenshot({ path: OUT + 'shot-11-full-attempt-view.png' });

  // ---- 5. going back to guided: is anything lost?
  await p.click('#esmodeswitch'); await p.waitForTimeout(500);
  const back = await p.evaluate(() => ({
    screen: document.querySelector('.es-belt') ? 'guided' : 'full',
    said: [...document.querySelectorAll('.es-said')].map(e => e.textContent.trim()).length,
    role: document.querySelector('.es-pararole') ? document.querySelector('.es-pararole').textContent : '',
    rail: document.querySelector('.es-rest') ? document.querySelector('.es-rest').innerText.replace(/\s+/g, ' ') : ''
  }));
  console.log('5. after a round trip to full-attempt and back:', JSON.stringify(back));
  console.log('errors:', errs.join(' | ') || 'none');
  await b.close();
})();
