// FRICTION PASS: a full 20-mark response, written the way a student would.
// Nothing in the app is changed. This only drives it and counts.
const { chromium, T, OUT, BASE, fileUrl } = require('./env');
const fs = require('fs');

const PROFILE = process.argv[2] || 'moderate';
const SHOTS = process.argv[3] === 'shots';

// ---------------------------------------------------------------- the writing
const INTRO = [
  "Target markets shape nearly every marketing decision a business makes, because the customers a business chooses to serve set the standard for what it has to offer them.",
  "This will be shown through digital marketing, the staff who deliver the service, the processes customers move through and the physical setting they judge the business by."
];
const BODIES = [
  { area: "e-marketing", point: "How the target market shapes e-marketing.",
    arg: /Digitally engaged/, ev: /App, loyalty/,
    lines: [
      "A digitally engaged target market pushes a business towards digital marketing rather than traditional advertising.",
      "Because these customers spend most of their time on phones and social platforms, the business reaches them more cheaply and more often through those channels than through print or television.",
      "McDonald's runs an app with loyalty rewards and mobile ordering, which puts its promotions on the same device its customers already use every day.",
      "As a result the business builds repeat visits and learns what each customer buys, which matters because it can then target offers instead of guessing at them.",
      "Therefore the target market directly shapes the promotion strategy the business develops, which is what the question is asking about."
    ] },
  { area: "people", point: "How the target market shapes the people element.",
    arg: /same experience everywhere/, ev: /Standardisation with local/,
    lines: [
      "A target market that expects the same experience in every store pushes the business into standardised service training.",
      "Because customers judge the business on the visit in front of them, inconsistent service in one store damages the brand everywhere, so training has to be the same across the network.",
      "McDonald's standardises its service while allowing some local customisation, so a customer gets the same core experience wherever they go.",
      "As a result the business protects its brand and keeps customers returning, which matters because repeat custom is cheaper than winning new customers.",
      "Therefore the expectations of the target market decide how much the business invests in its people, which addresses the question."
    ] },
  { area: "processes", point: "How the target market shapes processes.",
    arg: /expect speed/, ev: /App, loyalty/,
    lines: [
      "A target market that expects speed pushes the business to streamline the process from ordering to collection.",
      "Because these customers are buying convenience as much as food, a slow process removes the main reason they chose the business at all.",
      "McDonald's uses mobile ordering and separate collection points so that an order can be placed before the customer arrives.",
      "As a result waiting times fall and more customers are served in the same peak hour, which matters because peak trade is where most of the revenue is earned.",
      "Therefore what the target market expects determines how the business designs its processes, which answers the question."
    ] },
  { area: "physical evidence", point: "How the target market shapes physical evidence.",
    arg: /different physical settings/, ev: /Happy Meal/,
    lines: [
      "Serving more than one segment pushes the business to create different physical settings inside the same store.",
      "Because a family with young children wants something different from an adult buying coffee, one uniform setting would serve neither group well.",
      "McDonald's separates a play area and Happy Meal offering from the McCafe seating, so each segment gets a setting that suits it.",
      "As a result each segment feels catered for and stays longer, which matters because time in store raises the average spend.",
      "Therefore the segments in the target market shape the physical evidence the business builds, which is what the question requires."
    ] }
];
const CONCL = [
  "Across promotion, people, processes and physical evidence, the same pattern holds: the business studies who it is selling to and then builds the strategy around them.",
  "Target markets are therefore not one input among many but the starting point that the rest of the marketing strategy is built to serve."
];

// ---------------------------------------------------------------- profiles
const P = {
  independent: { helpPresses: 0, drawers: [], fillPointFirst: false, ownArgAt: 3 },
  moderate:    { helpPresses: 1, drawers: ['understand'], fillPointFirst: true, ownArgAt: -1 },
  high:        { helpPresses: 9, drawers: ['understand','vocabulary','evidence'], fillPointFirst: true, ownArgAt: -1 }
}[PROFILE];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => {
    window.__M = { clicks: 0, keys: 0, renders: 0, marks: [] };
    addEventListener('click', () => { window.__M.clicks++; }, true);
    addEventListener('keydown', () => { window.__M.keys++; }, true);
  });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  let calls = 0; await p.route(/workers\.dev/, r => { calls++; r.abort(); });

  const m = () => p.evaluate(() => ({ c: window.__M.clicks, k: window.__M.keys }));
  let last = { c: 0, k: 0 };
  const since = async () => { const n = await m(); const d = { c: n.c - last.c, k: n.k - last.k }; last = n; return d; };
  const shot = async n => { if (SHOTS) await p.screenshot({ path: OUT + 'shot-' + n + '.png' }); };

  const REC = { profile: PROFILE, sentences: [], sections: [], events: [], modelCalls: 0 };
  const note = (kind, detail) => REC.events.push({ kind, detail });

  // what is on screen right now, measured not guessed
  const density = () => p.evaluate(() => {
    const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
    const all = [...document.querySelectorAll('.es-canvas button, .es-canvas input, .es-canvas textarea, .es-canvas select')].filter(vis);
    const scrim = document.querySelector('.es-scrim');
    const prose = document.querySelector('.es-prose');
    const words = t => String(t || '').trim().split(/\s+/).filter(Boolean).length;
    return {
      controls: all.length,
      controlLabels: all.map(e => (e.id || e.textContent || e.placeholder || e.tagName).trim().slice(0, 26)),
      chromeWords: words(document.querySelector('.es-canvas') ? document.querySelector('.es-canvas').innerText : ''),
      ownWords: words(prose ? prose.innerText : ''),
      scrollable: scrim ? scrim.scrollHeight > scrim.clientHeight + 4 : false,
      overflowPx: scrim ? scrim.scrollHeight - scrim.clientHeight : 0
    };
  });
  // how much of the student's OWN earlier writing is reachable without leaving
  const visibleOwnWriting = () => p.evaluate(() => {
    const t = document.querySelector('.es-canvas') ? document.querySelector('.es-canvas').innerText : '';
    // every accepted sentence currently rendered as prose
    const said = [...document.querySelectorAll('.es-said')].map(e => e.textContent.trim());
    return { sentencesOnScreen: said.length, canvasChars: t.length };
  });

  await p.goto(T); await p.waitForTimeout(700);
  // TEST FIXTURE: unsourced evidence is withheld by design, so the suite supplies
  // sources of its own rather than weakening the rule under test.
  await p.evaluate(()=>{ Object.keys((window.BUSCONTENT||{}).evidence||{}).forEach(k=>
    window.BUSCONTENT.evidence[k].forEach(e=>{ e.source='test fixture source'; e.checked='2026-08-19'; })); });
  await p.$$eval('.navtab', es => { const t = es.find(x => /Essay practice/i.test(x.textContent)); t && t.click(); });
  await p.waitForTimeout(400);
  await p.selectOption('#essubject', 'business_studies').catch(() => {}); await p.waitForTimeout(200);
  await p.$$eval('.es-qchip', es => { const t = es.find(x => /target markets/i.test(x.textContent)); t && t.click(); });
  await p.waitForTimeout(200);
  await p.selectOption('#esstruct', 'six').catch(e => note('setup', 'could not choose a 4-body structure'));
  await p.waitForTimeout(150);
  await p.click('#esstart'); await p.waitForTimeout(500);
  last = await m();
  REC.setupClicks = last.c;

  // ---------------------------------------------------------------- the plan
  {
    const t0 = await since();
    const argRes = ['Digitally engaged', 'same experience everywhere', 'expect speed', 'different physical settings'];
    for (const re of argRes) {
      await p.$$eval('[data-esplanpick]', (es, r) => { const t = es.find(x => new RegExp(r, 'i').test(x.textContent)); t && t.click(); }, re);
      await p.waitForTimeout(260);
    }
    await p.$$eval('.es-plancard .es-evchip', es => { es[0] && es[0].click(); }); await p.waitForTimeout(250);
    await shot('p0-01-plan');
    const rows = await p.$$eval('.es-plancard.done .es-planval', es => es.map(e => e.textContent.trim()));
    await p.click('#esplango'); await p.waitForTimeout(450);
    const d = await since();
    REC.plan = { clicks: d.c + t0.c, rows: rows.length };
    note('plan', 'planning the whole response cost ' + (d.c + t0.c) + ' clicks and set ' + rows.length + ' body arguments');
  }

  // ---------------------------------------------------------------- helpers
  const inSetup = () => p.$('.es-setup').then(Boolean);
  const argOptions = () => p.$$eval('[data-espath]', es => es.map(e => e.textContent.trim()));
  const guideHead = () => p.$eval('.es-guideh', e => e.textContent.trim()).catch(() => '');
  const hasHelp = () => p.$('#esmorehelp').then(Boolean);
  const rungCount = () => p.$$eval('.es-rung', es => es.length).catch(() => 0);

  async function doSetup(sec, argRe, evRe, useOwn) {
    if (!(await inSetup())) {
      REC.sections.push({ section: sec, phase: 'setup', argOptionCount: 0, argOptions: [], evidencePicked: null, clicks: 0, keys: 0 });
      note('setup', sec + ': planned already, opened straight on the writing line');
      return;
    }
    const opts = await argOptions();
    const step0 = await since();
    if (useOwn) {
      await p.click('[data-espathown]'); await p.waitForTimeout(200);
      await p.type('#esownarg', 'Customers who compare prices push the business to compete on value', { delay: 0 });
      await p.click('#esownok'); await p.waitForTimeout(300);
    } else {
      const hit = await p.$$eval('[data-espath]', (es, re) => {
        const r = new RegExp(re, 'i'); const t = es.find(x => r.test(x.textContent));
        if (t) { t.click(); return t.textContent.trim(); } return null;
      }, argRe.source);
      if (!hit) note('setup', sec + ': no argument matched ' + argRe);
      await p.waitForTimeout(300);
    }
    let evPicked = null;
    if (evRe) {
      evPicked = await p.$$eval('[data-esev]', (es, re) => {
        const r = new RegExp(re, 'i'); const t = es.find(x => r.test(x.textContent));
        if (t) { t.click(); return t.querySelector('.es-pickrel').textContent.trim(); } return null;
      }, evRe.source).catch(() => null);
      if (!evPicked) note('setup', sec + ': no evidence matched ' + evRe + ' (offered: ' +
        JSON.stringify(await p.$$eval('[data-esev]', es => es.map(e => e.textContent.trim().slice(0, 40)))) + ')');
      await p.waitForTimeout(250);
    }
    const go = await p.$('#esstartwriting');
    if (go) { await go.click(); await p.waitForTimeout(350); }
    const d = await since();
    REC.sections.push({ section: sec, phase: 'setup', argOptionCount: opts.length,
      argOptions: opts.slice(0, 14), evidencePicked: evPicked, clicks: d.c + step0.c, keys: d.k + step0.k });
  }

  async function writeSentence(sec, text, opts) {
    opts = opts || {};
    const before = await since();
    const head = await guideHead();
    const helpOffered = await hasHelp();
    let pressed = 0, reached = 0;
    if (helpOffered && P.helpPresses) {
      for (let i = 0; i < P.helpPresses; i++) {
        const btn = await p.$('#esmorehelp'); if (!btn) break;
        await btn.click(); await p.waitForTimeout(150); pressed++;
      }
      reached = await rungCount();
    }
    for (const key of (opts.drawers || [])) {
      const t = await p.$('[data-estool="' + key + '"]');
      if (!t) continue;
      const disabled = await t.evaluate(e => e.disabled);
      if (disabled) { note('tool', sec + ': "' + key + '" is disabled here'); continue; }
      await t.click(); await p.waitForTimeout(250);
      const got = await p.$eval('.es-drawer-body', e => e.innerText.trim().slice(0, 90)).catch(() => '');
      note('tool', sec + ': opened ' + key + ' -> ' + JSON.stringify(got.replace(/\s+/g, ' ')));
      await p.click('#esdrawerx'); await p.waitForTimeout(250);
    }
    if (!(await p.$('#esline'))) { const more = await p.$('#esmoreline'); if (more) { await more.click(); await p.waitForTimeout(280); } }
    await p.type('#esline', text, { delay: 0 });
    await p.click('#esaccept'); await p.waitForTimeout(280);
    const d = await since();
    REC.sentences.push({ section: sec, guide: head, helpOffered, helpPresses: pressed, rungsReached: reached,
      chars: text.length, clicks: before.c + d.c, keys: before.k + d.k });
  }

  async function nextSection() {
    const done = await p.$('#esdonenext');
    if (done) { await done.click(); await p.waitForTimeout(420); return; }
    await nextSection(p);
  }

  // ================================================================ INTRODUCTION
  await shot('01-intro-setup');
  {
    const opts = await argOptions();
    note('intro', 'the introduction opens on an argument picker with ' + opts.length + ' options');
    const skip = await p.$$eval('.es-setup button', es => es.map(e => e.textContent.trim()));
    note('intro', 'ways out of the setup card: ' + JSON.stringify(skip.filter(x => !/^Customers|^Serving|^Digitally|^Convenience|^Value/.test(x))));
  }
  await doSetup('Introduction', /Digitally engaged/, null, false);
  await shot('02-intro-writing');
  REC.introDensity = await density();
  for (const s of INTRO) await writeSentence('Introduction', s, {});
  REC.sections.push({ section: 'Introduction', phase: 'written', density: await density(), own: await visibleOwnWriting() });
  await nextSection();

  // ================================================================ BODIES
  for (let i = 0; i < BODIES.length; i++) {
    const B = BODIES[i], sec = 'Body ' + (i + 1);
    // does the student have to name the area before the picker is relevant?
    const beforePoint = await argOptions();
    if (P.fillPointFirst) { await p.fill('#espoint', B.point); await p.waitForTimeout(300); }
    const afterPoint = await argOptions();
    note(sec, 'argument options before point typed: ' + beforePoint.length + ', after: ' + afterPoint.length);
    await doSetup(sec, B.arg, B.ev, P.ownArgAt === i + 1);
    if (i === 1) await shot('03-body2-writing');
    if (i === 2) {
      const own = await visibleOwnWriting();
      const peeks = await p.$$eval('[data-espeek]', es => es.length);
      const args = await p.$$eval('.es-maparg', es => es.map(e => e.textContent.trim()).filter(Boolean).length);
      note(sec, 'starting Body 3: ' + own.sentencesOnScreen + ' sentences rendered inline, ' +
        peeks + ' earlier section(s) readable from the map in one click, ' + args + ' section arguments visible with no click at all');
      REC.body3Start = { own, density: await density() };
      await shot('04-body3-start-no-earlier-writing');
    }
    for (let k = 0; k < B.lines.length; k++) {
      await writeSentence(sec, B.lines[k], { drawers: (k === 1 ? P.drawers : []) });
      // ---- the evidence change, after the evidence has been used (Body 2)
      if (i === 1 && k === 2) {
        const t0 = await since();
        await p.$eval('[data-esrestchange="evidence"]', e => e.click()); await p.waitForTimeout(300);
        await p.$$eval('[data-esev]', es => { const t = es.find(x => /Standardisation with local/i.test(x.textContent)); t && t.click(); });
        await p.waitForTimeout(300);
        await p.click('#esstartwriting'); await p.waitForTimeout(350);
        const flagged = await p.$$eval('.es-said.flagged', es => es.map(e => e.textContent.trim().slice(0, 60)));
        const why = await p.$eval('.es-argchanged', e => e.textContent.trim()).catch(() => '(no banner)');
        const d = await since();
        note(sec, 'changed evidence after using it: ' + (d.c + t0.c) + ' clicks; flagged ' + flagged.length + '; banner: ' + JSON.stringify(why.slice(0, 110)));
        REC.evidenceChange = { clicks: d.c + t0.c, flagged, banner: why };
        await shot('05-evidence-changed');
        // the student decides it still works
        const ok = await p.$$('[data-esok]');
        for (const o of ok) { await o.click(); await p.waitForTimeout(200); }
      }
    }
    // ---- the mid-run revision: go back and fix an earlier sentence (during Body 3)
    if (i === 2) {
      const t0 = await since();
      await p.$$eval('[data-esgo]', es => { const t = es.find(x => /Body 1/.test(x.textContent)); t && t.click(); });
      await p.waitForTimeout(400);
      await shot('06-revisit-body1');
      const sentences = await p.$$eval('.es-said', es => es.map(e => e.textContent.trim()));
      await p.$$eval('.es-said', es => es[1] && es[1].click()); await p.waitForTimeout(350);
      const ta = await p.$('[data-esedit="1"]');
      if (ta) {
        await ta.fill("Because these customers spend most of their day on phones and social platforms, the business reaches them far more cheaply through those channels than through print or television.");
        await p.click('[data-essaveedit="1"]'); await p.waitForTimeout(350);
      } else note('revision', 'could not reopen the second sentence of Body 1');
      // and back to where I was
      await p.$$eval('[data-esgo]', es => { const t = es.find(x => /Body 3/.test(x.textContent)); t && t.click(); });
      await p.waitForTimeout(400);
      const back = await p.$eval('.es-guideh', e => e.textContent.trim()).catch(() => '');
      const blocksNow = await p.$$eval('.es-said', es => es.length);
      const d = await since();
      note('revision', 'revise one earlier sentence and return: ' + (d.c + t0.c) + ' clicks; landed back on step "' + back + '" with ' + blocksNow + ' sentences kept');
      REC.revision = { clicks: d.c + t0.c, returnedTo: back, sentencesKept: blocksNow, body1Sentences: sentences.length };
      await shot('07-back-in-body3');
    }
    REC.sections.push({ section: sec, phase: 'written', density: await density(), own: await visibleOwnWriting() });
    if (i < BODIES.length - 1 || true) await nextSection();
  }

  // ================================================================ CONCLUSION
  await doSetup('Conclusion', /Digitally engaged/, null, false);
  for (const s of CONCL) await writeSentence('Conclusion', s, {});
  REC.sections.push({ section: 'Conclusion', phase: 'written', density: await density(), own: await visibleOwnWriting() });
  await shot('08-conclusion');

  // ================================================================ READ IT BACK
  {
    const t0 = await since();
    const rvBtn = await p.$('#esreview');
    if (rvBtn) {
      await rvBtn.click(); await p.waitForTimeout(500);
      const secs = await p.$$eval('.es-rvsec', es => es.length);
      const chars = await p.$$eval('.es-rvtext', es => es.reduce((n, e) => n + e.textContent.length, 0));
      const msg = await p.$eval('.es-completemsg', e => e.textContent.trim()).catch(() => '');
      const d0 = await since();
      REC.guidedReview = { clicks: d0.c + t0.c, sections: secs, chars: chars, message: msg };
      note('read-back', 'reading the whole response inside guided mode: ' + (d0.c + t0.c) + ' click(s), ' + secs + ' sections, ' + chars + ' characters of the students own writing on one page');
      note('read-back', 'submit message: ' + JSON.stringify(msg.slice(0, 130)));
      await shot('p0-02-review');
      await p.$$eval('[data-esrvedit]', es => es[0] && es[0].click()); await p.waitForTimeout(400);
    }
    const mapItems = await p.$$eval('[data-esgo]', es => es.length);
    let seen = 0;
    for (let i = 0; i < mapItems; i++) {
      await p.$$eval('[data-esgo]', (es, i) => es[i] && es[i].click(), i);
      await p.waitForTimeout(250);
      seen += await p.$$eval('.es-said', es => es.length);
    }
    const d1 = await since();
    note('read-back', 'reading the whole response section by section: ' + (d1.c + t0.c) + ' clicks for ' + mapItems + ' sections, ' + seen + ' sentences, never more than one section at a time');
    REC.readBackByMap = { clicks: d1.c + t0.c, sections: mapItems, sentences: seen };
    // the only whole-response view there is
    await p.click('#esmodeswitch'); await p.waitForTimeout(500);
    const whole = await p.$eval('#esfull, .es-fullbox, textarea', e => e.value || e.textContent).catch(() => '');
    const d2 = await since();
    REC.wholeView = { clicks: d2.c, chars: (whole || '').length,
      paragraphs: (whole || '').split(/\n\s*\n/).filter(x => x.trim()).length,
      guidancePresent: await p.$('.es-guide').then(Boolean), beltPresent: await p.$('.es-belt').then(Boolean) };
    note('read-back', 'the whole response is only visible by leaving guided mode ("Write a full attempt instead"): ' +
      REC.wholeView.paragraphs + ' paragraphs, ' + REC.wholeView.chars + ' characters, guidance gone: ' + !REC.wholeView.guidancePresent);
    await shot('09-whole-response-full-mode');
  }

  REC.modelCalls = calls;
  REC.pageErrors = errs;
  const tot = await m();
  REC.total = { clicks: tot.c, keys: tot.k };
  fs.writeFileSync(OUT + 'metrics-p0-' + PROFILE + '.json', JSON.stringify(REC, null, 1));

  // ---------------------------------------------------------------- summary
  const S = REC.sentences;
  const avg = a => a.length ? (a.reduce((x, y) => x + y, 0) / a.length) : 0;
  console.log('\n=== ' + PROFILE.toUpperCase() + ' ===');
  console.log('sentences written:', S.length, '| total clicks:', tot.c, '| total keystrokes:', tot.k);
  console.log('clicks per sentence: avg', avg(S.map(x => x.clicks)).toFixed(2),
    '| min', Math.min(...S.map(x => x.clicks)), '| max', Math.max(...S.map(x => x.clicks)));
  console.log('help offered on', S.filter(x => x.helpOffered).length, 'of', S.length, 'sentences');
  const bySec = {};
  REC.sections.filter(x => x.phase === 'setup').forEach(x => bySec[x.section] = x.clicks);
  console.log('setup clicks per section:', JSON.stringify(bySec));
  S.forEach(x => { bySec[x.section + '~w'] = (bySec[x.section + '~w'] || 0) + x.clicks; });
  console.log('writing clicks per section:', JSON.stringify(Object.fromEntries(Object.entries(bySec).filter(([k]) => /~w$/.test(k)))));
  console.log('model calls:', calls, '| page errors:', errs.length ? errs.join(' | ') : 'none');
  REC.events.forEach(e => console.log('  ·', e.kind + ':', e.detail));
  await b.close();
})();
