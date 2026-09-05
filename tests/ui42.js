// THE APP DOES NOT DEPEND ON THE NETWORK.
//
// Every browser suite now blocks external requests, because the page asks for web
// fonts and a CDN that a sandbox cannot reach, and waiting for them cost 12.7
// seconds on every single page load. That is a large speedup resting on an
// assumption: that what is blocked is decoration.
//
// If someone later puts required behaviour behind a CDN, the assumption stops
// holding and the harness would hide the problem rather than report it, because
// every suite would be testing an app quietly missing a piece of itself.
//
// So this suite states the assumption and fails when it stops being true.
// Fonts may vanish. Function may not.
const { chromium, T, usePractice } = require('./env');

// Waits that name their condition. This app fetches nothing and renders
// synchronously, so the effect of a click is present on the next frame:
// settled() is that frame, not a shorter guess at a duration.
const settled = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const here = (p, sel) => p.waitForSelector(sel, { timeout: 8000 });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1400, height: 950 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));

  // env.js already aborts external requests for every page. Watch what that
  // actually removes, so the contract is about observed traffic rather than about
  // what anyone assumes the page asks for.
  const blocked = [];
  p.on('requestfailed', r => {
    const u = r.url();
    if (/^https?:\/\//.test(u)) blocked.push({ url: u.slice(0, 90), type: r.resourceType() });
  });

  await p.goto(T);
  await p.waitForSelector('.navtab', { timeout: 8000 });

  console.log('--- what the page asks the network for, and does not get ---');
  const kinds = {};
  blocked.forEach(x => { kinds[x.type] = (kinds[x.type] || 0) + 1; });
  console.log('    blocked:', JSON.stringify(kinds));
  blocked.slice(0, 4).forEach(x => console.log('      ' + x.type + '  ' + x.url));

  // The line is not "no scripts". It is "no script this app needs".
  //
  // supabase-js is loaded from a CDN and IS blocked. It is allowed here because
  // the app is explicitly built to run without it: Cloud "stays fully dormant
  // unless CONFIG.supabaseUrl + supabaseAnonKey are set AND the supabase-js CDN
  // loaded", and it touches only auth and custom sets, never the essay engine.
  // The allowance is named, so a NEW external script fails this suite instead of
  // being quietly absorbed by a rule that said scripts do not matter.
  //
  // What it costs is worth stating: with it blocked, no suite in this harness
  // exercises a signed-in cloud path. That was already true of the sandbox, which
  // cannot reach the CDN either. It is now recorded rather than incidental.
  const OPTIONAL = [
    { match: /cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js/, why: 'Cloud is dormant without it by design; essay mode never calls it' }
  ];
  const functional = blocked.filter(x => x.type === 'script' || x.type === 'xhr' || x.type === 'fetch');
  const unexplained = functional.filter(x => !OPTIONAL.some(o => o.match.test(x.url)));
  functional.forEach(x => {
    const o = OPTIONAL.find(oo => oo.match.test(x.url));
    if (o) console.log('    allowed: ' + x.url.slice(0, 46) + '  (' + o.why + ')');
  });
  ok(unexplained.length === 0,
    'no unexplained functional resource is blocked, so the speedup hides no dependency: ' + JSON.stringify(unexplained.slice(0, 3)));

  console.log('--- and the app is fully usable without any of it ---');
  // Not "the page rendered". A student has to be able to get to writing, which is
  // the whole product, so the assertion walks there.
  const tabs = await p.$$eval('.navtab', es => es.map(x => x.textContent.trim()).filter(Boolean));
  ok(tabs.length >= 2, 'the app renders its navigation: ' + JSON.stringify(tabs.slice(0, 4)));
  ok(errs.length === 0, 'and throws nothing while loading: ' + JSON.stringify(errs.slice(0, 2)));

  await p.evaluate(() => { const t = [...document.querySelectorAll('.navtab')].find(x => /Essay practice/i.test(x.textContent)); t && t.click(); });
  await p.waitForSelector('#essubject', { timeout: 8000 });
  await p.selectOption('#essubject', 'business_studies').catch(() => {});
  await usePractice(p);
  await p.waitForSelector('.qp-row', { timeout: 8000 });
  const rows = await p.$$eval('.qp-row', es => es.length);
  ok(rows > 0, 'the question bank loads from the file itself: ' + rows + ' questions');

  await p.evaluate(() => { const r = document.querySelector('.qp-row'); r && r.click(); });
  await p.evaluate(() => { const s = document.querySelector('#esstart'); s && s.click(); });
  await p.waitForFunction(() => !!document.querySelector('#esline, .es-startrow'), null, { timeout: 8000 });
  const reached = await p.evaluate(() => ({
    composer: !!document.querySelector('#esline'),
    start: document.querySelectorAll('.es-startrow').length,
    fonts: getComputedStyle(document.body).fontFamily
  }));
  ok(reached.composer || reached.start > 0, 'and a student reaches a writing state with the network dark');
  // Worth stating: the app is styled by a fallback stack, which is exactly the
  // degradation this contract permits.
  console.log('    body font resolved to:', reached.fonts.slice(0, 60));

  console.log('--- a required script behind a CDN would be caught ---');
  // Prove the detector works rather than trusting that it would. A page that does
  // need a blocked script must be reported, or the contract above is decorative.
  const p2 = await (await b.newContext()).newPage();
  const seen = [];
  p2.on('requestfailed', r => { if (/^https?:\/\//.test(r.url())) seen.push(r.resourceType()); });
  await p2.setContent('<html><body><script src="https://cdn.example.com/needed.js"></script>ok</body></html>',
    { waitUntil: 'domcontentloaded' }).catch(() => {});
  await settled(p2);
  ok(seen.indexOf('script') >= 0, 'a blocked script is visible to the same detector: ' + JSON.stringify(seen));
  await p2.close();

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await b.close(); process.exit(fail ? 1 : 0);
})();
