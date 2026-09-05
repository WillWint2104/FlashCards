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
  const pick = async re => { await p.$$eval('[data-espath]', (es, r) => { const x = es.find(e => new RegExp(r, 'i').test(e.textContent)); x && x.click(); }, re); await p.waitForTimeout(250); };
  const start = async () => { const g = await p.$('#esstartwriting'); if (g) { await g.click(); await p.waitForTimeout(300); } };
  const say = async t => { await p.fill('#esline', t); await p.click('#esaccept'); await p.waitForTimeout(250); };
  await pick('Digitally engaged'); await start();
  await say('Target markets shape every marketing decision a business makes.');
  await say('This will be shown through promotion, people, processes and physical evidence.');
  await p.click('#esnext'); await p.waitForTimeout(350);
  await pick('Digitally engaged'); await start();
  await say('A digitally engaged target market pushes the business towards digital marketing.');
  await say('Because these customers live on their phones, the business reaches them there most cheaply.');
  await say('McDonald’s runs an app with loyalty rewards and mobile ordering.');

  const before = await p.$$eval('.es-said', es => es.map(e => e.textContent.trim()));
  console.log('A. before the round trip, Body 1 holds', before.length, 'sentences');

  // ---- full attempt view: what is there, and can it be marked?
  await p.click('#esmodeswitch'); await p.waitForTimeout(600);
  const full = await p.evaluate(() => ({
    allButtons: [...document.querySelectorAll('.es-canvas button, .es-wrap button')].map(e => ((e.id ? e.id + ':' : '') + e.textContent.trim()).slice(0, 40)),
    textareaChars: document.querySelector('textarea') ? document.querySelector('textarea').value.length : 0,
    paragraphs: document.querySelector('textarea') ? document.querySelector('textarea').value.split(/\n\s*\n/).filter(x => x.trim()).length : 0,
    scrollNeeded: (() => { const s = document.querySelector('.es-scrim'); return s ? s.scrollHeight - s.clientHeight : 0; })()
  }));
  console.log('B. full-attempt mode buttons:', JSON.stringify(full.allButtons));
  console.log('   the whole response is', full.textareaChars, 'chars in', full.paragraphs, 'paragraphs');
  await p.screenshot({ path: OUT + 'shot-12-full-attempt-with-writing.png' });

  // edit it there, the way a student rereading would
  await p.evaluate(() => { const t = document.querySelector('textarea'); t.value = t.value.replace('most cheaply', 'far more cheaply than through television'); t.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.waitForTimeout(400);
  await p.click('#esmodeswitch'); await p.waitForTimeout(600);
  const after = await p.$$eval('.es-said', es => es.map(e => e.textContent.trim()));
  const flagged = await p.$$eval('.es-said.flagged', es => es.length);
  console.log('C. after editing in full mode and returning, Body 1 holds', after.length, 'sentences,', flagged, 'flagged');
  console.log('   sentence 2 now reads:', JSON.stringify((after[1] || '').slice(0, 95)));
  console.log('   ids preserved (text identical except the edit):', JSON.stringify(before.map((x, i) => x === after[i])));

  // ---- what does "Check this paragraph" send, and is there any whole-response check?
  const ask = await p.$eval('#esask', e => ({ label: e.textContent.trim(), disabled: e.disabled })).catch(() => null);
  console.log('D. guided-mode marking control:', JSON.stringify(ask));

  // ---- the word counter, paragraph by paragraph
  const wc = [];
  for (let i = 0; i < 6; i++) {
    await p.$$eval('[data-esgo]', (es, i) => es[i] && es[i].click(), i); await p.waitForTimeout(250);
    wc.push(await p.$eval('.es-wordcount', e => e.innerText.replace(/\s+/g, ' ')).catch(() => '-'));
  }
  console.log('E. word counter as you move through the response:', JSON.stringify(wc));

  // ---- keyboard: can a sentence be added without the mouse?
  await p.$$eval('[data-esgo]', es => es[1] && es[1].click()); await p.waitForTimeout(300);
  await p.focus('#esline');
  await p.keyboard.type('A keyboard-only sentence to see whether the mouse is required.');
  await p.keyboard.press('Control+Enter'); await p.waitForTimeout(350);
  const kb = await p.$$eval('.es-said', es => es.length);
  console.log('F. Ctrl+Enter adds a sentence:', kb === after.length + 1, '(', after.length, '->', kb, ')');
  // and can the next guide / help be reached from the keyboard?
  const tabOrder = await p.evaluate(() => {
    const f = [...document.querySelectorAll('.es-canvas [tabindex], .es-canvas button, .es-canvas input, .es-canvas textarea')]
      .filter(e => !e.disabled && e.offsetParent !== null);
    const i = f.findIndex(e => e.id === 'esline');
    return f.slice(i, i + 6).map(e => (e.id || e.textContent.trim() || e.tagName).slice(0, 24));
  });
  console.log('G. tab order from the writing line:', JSON.stringify(tabOrder));
  console.log('errors:', errs.join(' | ') || 'none');
  await b.close();
})();
