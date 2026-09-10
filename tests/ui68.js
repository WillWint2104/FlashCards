// GATE 3A IN THE BROWSER: WHAT A REFUSAL LOOKS LIKE ON SCREEN.
//
// The rules themselves are tested in tests/t28.mjs, in milliseconds, without a
// browser. This file only asserts the things a browser is actually needed for:
// that the totals a student reads never say NaN, that the control they pressed
// comes back, that the reason is on the page, and that a paper which resolves
// correctly still sends the right criteria.
//
// Every paper here is one question long on purpose. This is a seam check, not a
// journey: there is no writing loop, no review cycle and no second page.
//
// The behaviour it holds was MEASURED before it was fixed. From the Gate 3 audit,
// on 6bfb666, sitting a paper whose subject nothing registers:
//
//     sheet score element: "undefined/undefined"
//     check button:        "Checking…"
//     total:               "NaN/22"
//     state.cards[...]     {"box":1,"seen":1,"correct":0,"lastScore":0}
//
// Four separate faults in one screenshot, and no test in the harness could see
// any of them: ui5, ui7 and ui8 all abort the marker, and their fixture paper
// resolves cleanly, so none of them could ever reach this branch.
const { chromium, T } = require('./env');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('  FAIL:', m); } };
const settled = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

// One question, twenty marks, and whatever curriculum the case is about.
const SHORT_Q = { type: 'short', prompt: 'State one feature of a reed.', marks: 2,
  points: [{ text: 'reeds are flexible', need: ['flexible'] },
           { text: 'reeds are hollow', need: ['hollow'] }] };
const ESSAY_Q = { type: 'essay', prompt: 'Evaluate the effectiveness of two strategies.', marks: 20, model: 'a model answer' };
// There is no way to skip a question inside a paper, so a case that only needs the
// extended response gets a paper that only has one. Cheaper, and it keeps each
// section of this file to the one thing it is about.
const paper = (id, curriculum, extra) => Object.assign({
  id: id, name: 'Paper ' + id,
  curriculum: curriculum,
  sections: [{ name: 'Section I', questions: [SHORT_Q, ESSAY_Q] }],
}, extra || {});
const essayPaper = (id, curriculum) => ({ id: id, name: 'Paper ' + id, curriculum: curriculum,
  sections: [{ name: 'Section I', questions: [ESSAY_Q] }] });

const seed = state => `localStorage.setItem("marginal.trial.v1", ${JSON.stringify(JSON.stringify(state))})`;

// Open the app with this state already in place, capturing anything sent to the
// marker. The endpoint is whatever the build configures, so the route matches the
// host rather than a URL this file invents.
async function openWith(b, state) {
  const p = await b.newPage();
  const sent = [];
  await p.addInitScript(new Function(seed(state)));
  await p.route(/workers\.dev/, r => {
    try { sent.push(JSON.parse(r.request().postData() || 'null')); } catch (e) { sent.push('(unparseable)'); }
    r.abort();
  });
  await p.goto(T); await settled(p);
  return { p, sent };
}
const withPaper = pk => ({ cards: {}, endpoint: '', code: '12Ec126', log: [],
  customSets: [], lessons: {}, exams: [pk] });

// Test mode -> this paper -> past the pickers -> the question at `n`.
async function sit(p, id, n) {
  await p.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button,a')).find(e => /test mode/i.test(e.textContent));
    b && b.click();
  });
  await settled(p);
  await p.evaluate(x => { const b = document.querySelector('[data-examsit="' + x + '"]'); b && b.click(); }, id);
  await settled(p);
  const go = await p.$('#exampickgo'); if (go) { await go.click(); await settled(p); }
  const bg = await p.$('#exambegin'); if (bg) { await bg.click(); await settled(p); }
  for (let i = 1; i < (n || 1); i++) { const nx = await p.$('#examnext'); if (nx) { await nx.click(); await settled(p); } }
}
const sheet = p => p.evaluate(() => {
  const s = document.querySelector('#sheet');
  return {
    text: s ? s.textContent.replace(/\s+/g, ' ').trim() : '(no sheet)',
    score: (document.querySelector('.sheet .score') || {}).textContent || '(none)',
    unmarked: !!document.querySelector('.sheet.unmarked'),
    check: document.querySelector('#check') ? {
      label: document.querySelector('#check').textContent,
      disabled: document.querySelector('#check').disabled,
    } : null,
  };
});
const answer = async (p, text) => { await p.fill('#ans', text); await p.click('#check'); await p.waitForTimeout(650); };

(async () => {
  const b = await chromium.launch();
  const errs = [];

  // ==========================================================================
  console.log('1. a paper whose subject nothing registers refuses, and says so');
  // ==========================================================================
  {
    const { p } = await openWith(b, withPaper(paper('unknown-subject',
      { jurisdiction: 'NSW', klaKey: 'hsie', subjectKey: 'underwater_basket_weaving' })));
    p.on('pageerror', e => errs.push(String(e.message)));
    await sit(p, 'unknown-subject', 1);

    // The short answer first, so there is a real mark on the board before the
    // refusal lands beside it. This is the arithmetic that used to go to NaN.
    await answer(p, 'Reeds are flexible and hollow.');
    const first = await sheet(p);
    ok(/2\/2/.test(first.score), 'the short answer is marked normally: ' + JSON.stringify(first.score));
    await p.click('#examnext'); await settled(p);

    await answer(p, 'A response about weaving strategies. '.repeat(20));
    const s = await sheet(p);
    ok(s.unmarked, 'the extended response lands in the unmarked state');
    ok(!/undefined/.test(s.text), 'and the word undefined is nowhere on it: ' + JSON.stringify(s.text.slice(0, 90)));
    ok(/not marked/i.test(s.score), 'the score reads as a statement rather than a number: ' + JSON.stringify(s.score));
    ok(/underwater_basket_weaving/.test(s.text),
      'the reason names the subject that could not be resolved: ' + JSON.stringify(s.text.slice(0, 160)));
    ok(/no subject package named/i.test(s.text), 'and says what the problem with it is');
    ok(s.check && !s.check.disabled && !/Checking/.test(s.check.label),
      'the control the student pressed is usable again: ' + JSON.stringify(s.check));

    const bar = await p.$eval('.exam-progress', e => e.textContent.trim());
    ok(!/NaN/.test(bar), 'the progress bar is arithmetic: ' + JSON.stringify(bar));
    ok(/1\/2 answered/.test(bar), 'the refused question is not counted as answered: ' + JSON.stringify(bar));
    ok(/1 not marked/.test(bar), 'and is counted as what it is: ' + JSON.stringify(bar));

    await p.click('#examnext'); await settled(p);
    const res = await p.evaluate(() => ({
      big: (document.querySelector('.bigscore') || {}).textContent || '(none)',
      rows: Array.from(document.querySelectorAll('.exam-resq')).map(e => e.textContent.replace(/\s+/g, ' ').trim()),
      sec: Array.from(document.querySelectorAll('.exam-ressech')).map(e => e.textContent.replace(/\s+/g, ' ').trim()),
    }));
    ok(!/NaN|undefined/.test(JSON.stringify(res)),
      'and the whole results screen is free of NaN and undefined: ' + JSON.stringify(res));
    ok(/^2\s*\/\s*22$/.test(res.big.replace(/\s+/g, '')) || /2\/22/.test(res.big.replace(/\s+/g, '')),
      'the paper totals 2/22, the marks that were actually awarded out of the marks on offer: ' + JSON.stringify(res.big));
    ok(res.rows.some(r => /not marked/i.test(r)), 'the refused row says so: ' + JSON.stringify(res.rows));
    await p.close();
  }

  // ==========================================================================
  console.log('2. a paper that declares its subject by key is marked by that subject');
  // ==========================================================================
  {
    const { p, sent } = await openWith(b, withPaper(essayPaper('by-key',
      { jurisdiction: 'NSW', klaKey: 'hsie', subjectKey: 'business_studies', course: 'Business Studies' })));
    await sit(p, 'by-key', 1);
    await answer(p, 'A response about weaving strategies. '.repeat(20));

    ok(sent.length === 1, 'one request went to the marker: ' + sent.length);
    const req = sent[0] || {};
    ok(req.subject === 'Business Studies',
      'it names Business Studies, from the package rather than the paper: ' + JSON.stringify(req.subject));
    ok(Array.isArray(req.criteria) && req.criteria.length,
      'and carries criteria: ' + (Array.isArray(req.criteria) ? req.criteria.length : typeof req.criteria));
    // The measured fault, in the one place it can be seen from outside: this
    // exact paper used to send Economics.
    ok(!/economics/i.test(JSON.stringify(req.criteria || [])),
      'and not one of them is Economics: ' + JSON.stringify((req.criteria || []).map(c => c.name || c).slice(0, 4)));
    await p.close();
  }

  // ==========================================================================
  console.log('3. the KLA is not the authority');
  // ==========================================================================
  {
    // Same subject key, a KLA that says something else entirely. hsie classifies
    // Business Studies; it has never had an opinion about how to mark one.
    const { p, sent } = await openWith(b, withPaper(essayPaper('kla-noise',
      { jurisdiction: 'NSW', klaKey: 'science', subjectKey: 'business_studies' })));
    await sit(p, 'kla-noise', 1);
    await answer(p, 'A response about weaving strategies. '.repeat(20));
    ok((sent[0] || {}).subject === 'Business Studies',
      'a nonsense KLA does not move the marking: ' + JSON.stringify((sent[0] || {}).subject));
    await p.close();
  }

  // ==========================================================================
  console.log('4. a stored paper with no curriculum block fails closed');
  // ==========================================================================
  {
    // The legacy shape: a display label and nothing else. It used to be marked
    // against whichever flashcard package the picker was on, which was Economics.
    const legacy = { id: 'legacy', name: 'Legacy paper', subject: 'Business Studies',
      sections: essayPaper('x', {}).sections };
    const { p, sent } = await openWith(b, withPaper(legacy));
    const row = await p.evaluate(() => {
      const b2 = Array.from(document.querySelectorAll('button,a')).find(e => /test mode/i.test(e.textContent));
      b2 && b2.click();
      return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() =>
        r((document.querySelector('.exam-rowmeta') || {}).textContent || '(none)'))));
    });
    ok(/no subject key/i.test(row),
      'the list row says the paper has no subject key rather than hiding it: ' + JSON.stringify(row));

    await p.evaluate(() => { const x = document.querySelector('[data-examsit="legacy"]'); x && x.click(); });
    await settled(p);
    const go = await p.$('#exampickgo'); if (go) { await go.click(); await settled(p); }
    const bg = await p.$('#exambegin'); if (bg) { await bg.click(); await settled(p); }
    await answer(p, 'A response about weaving strategies. '.repeat(20));
    const s = await sheet(p);
    ok(s.unmarked, 'a legacy paper is not marked');
    ok(sent.length === 0, 'and nothing was sent to the marker: ' + JSON.stringify(sent));
    ok(/does not say which subject/i.test(s.text),
      'the reason is the missing declaration, not a connection problem: ' + JSON.stringify(s.text.slice(0, 140)));
    await p.close();
  }

  // ==========================================================================
  console.log('5. the import door asks who marks the paper');
  // ==========================================================================
  {
    const { p } = await openWith(b, { cards: {}, endpoint: '', code: '12Ec126', log: [],
      customSets: [], lessons: {}, exams: [paper('keep', { subjectKey: 'business_studies' })] });
    const importPaper = async json => {
      await p.evaluate(() => { const b2 = Array.from(document.querySelectorAll('button,a')).find(e => /^create$/i.test(e.textContent.trim())); b2 && b2.click(); });
      await settled(p);
      await p.fill('#importjson', JSON.stringify(json));
      await p.click('#doimport'); await settled(p);
      return p.$eval('#importmsg', e => e.textContent.trim()).catch(() => '(no message)');
    };
    const body = { format: 'marginal-exam@1', name: 'Imported', sections: paper('x', {}).sections };

    const noCurric = await importPaper(body);
    ok(/curriculum/i.test(noCurric) && !/imported/i.test(noCurric),
      'a paper with no curriculum block is refused at the door: ' + JSON.stringify(noCurric));

    const labelKey = await importPaper(Object.assign({}, body, { curriculum: { subjectKey: 'Business Studies' } }));
    ok(/subjectKey/i.test(labelKey) && !/imported/i.test(labelKey),
      'a display label in the key field is refused rather than matched: ' + JSON.stringify(labelKey));

    const crossed = JSON.parse(JSON.stringify(body));
    crossed.curriculum = { subjectKey: 'business_studies' };
    crossed.sections[0].questions[1].subjectKey = 'economics';
    const xmsg = await importPaper(crossed);
    ok(/subjectKey/i.test(xmsg) && !/imported/i.test(xmsg),
      'a question cross-wired to another subject is refused: ' + JSON.stringify(xmsg));

    const good = await importPaper(Object.assign({}, body, {
      curriculum: { jurisdiction: 'NSW', klaKey: 'hsie', subjectKey: 'business_studies', course: 'Business Studies' } }));
    // A successful import calls builder(), which rebuilds the screen the message
    // was just written to, so there is nothing left to read. That is pre-existing
    // and out of this slice; what matters here is the paper, so the paper is what
    // is asserted. Recorded in the Gate 3A report as an observation.
    ok(!/curriculum|subjectKey/i.test(good),
      'a paper that names its subject by key is not refused: ' + JSON.stringify(good));
    const kept = await p.evaluate(() => (JSON.parse(localStorage.getItem('marginal.trial.v1') || '{}').exams || [])
      .map(e => ({ name: e.name, key: (e.curriculum || {}).subjectKey || null })));
    ok(kept.some(x => x.name === 'Imported' && x.key === 'business_studies'),
      'it is stored, and the key it declared survived rather than being dropped: ' + JSON.stringify(kept));
    ok(kept.filter(x => x.name === 'Imported').length === 1,
      'and only the one that passed got in: ' + JSON.stringify(kept));
    await p.close();
  }

  // ==========================================================================
  console.log('6. a refusal on the study path records nothing at all');
  // ==========================================================================
  {
    // The other half of the reproduced defect. Here it did not become NaN; it
    // went through applyResult and was written down as a zero, and the card was
    // demoted to box 1 as though the student had failed it.
    const set = { id: 'custom-g3a', name: 'Gate 3A set', cards: [
      { id: 'g3a-essay', type: 'essay', marks: 20, subject: 'Underwater Basket Weaving',
        prompt: 'Evaluate the effectiveness of two strategies.', model: '', vocab: [] }] };
    const { p, sent } = await openWith(b, { cards: {}, endpoint: '', code: '12Ec126', log: [],
      customSets: [set], lessons: {}, exams: [paper('keep', { subjectKey: 'business_studies' })] });

    await p.evaluate(() => { const x = Array.from(document.querySelectorAll('button,a')).find(e => /^study$/i.test(e.textContent.trim())); x && x.click(); });
    await settled(p);
    await p.evaluate(() => { const x = document.querySelector('[data-open="custom-g3a"]'); x && x.click(); });
    await settled(p);
    await p.evaluate(() => { const x = Array.from(document.querySelectorAll('button,[data-mode]')).find(e => /long|extended|essay/i.test(e.textContent)); x && x.click(); });
    await p.waitForTimeout(400);
    ok(!!(await p.$('#ans')), 'the answer box is reachable');

    await answer(p, 'A response about weaving strategies. '.repeat(20));
    const s = await sheet(p);
    ok(s.unmarked, 'the study sheet lands in the unmarked state');
    ok(!/undefined/.test(s.text), 'with no undefined on it: ' + JSON.stringify(s.text.slice(0, 90)));
    ok(sent.length === 0, 'and nothing was sent to the marker: ' + JSON.stringify(sent));

    const after = await p.evaluate(() => {
      const st = JSON.parse(localStorage.getItem('marginal.trial.v1') || '{}');
      return { card: st.cards['g3a-essay'] || null, log: st.log || [] };
    });
    ok(after.card === null,
      'no progress was written for the card: ' + JSON.stringify(after.card));
    ok(after.log.length === 0,
      'and nothing was written to the log: ' + JSON.stringify(after.log));
    ok(!!(await p.$('#continue')), 'the student can still move on');
    await p.close();
  }

  // ==========================================================================
  console.log('7. leaving a paper leaves its subject behind with it');
  // ==========================================================================
  {
    // EXAM.paper is never cleared when a student quits Test mode, so it outlives
    // the sitting. Reading it unconditionally meant a flashcard studied afterwards
    // was marked under that paper's curriculum - the same cross-subject leak, in a
    // new place, introduced by the fix for the old one. A card is marked by a
    // paper only if it IS one of that paper's questions.
    const set = { id: 'custom-after', name: 'After the paper', cards: [
      { id: 'after-essay', type: 'essay', marks: 20,
        prompt: 'Explain one effect of an interest rate rise.', model: 'm', vocab: [] }] };
    const { p, sent } = await openWith(b, { cards: {}, endpoint: '', code: '12Ec126', log: [],
      customSets: [set], lessons: {},
      exams: [essayPaper('bus-paper', { subjectKey: 'business_studies', course: 'Business Studies' })] });

    await sit(p, 'bus-paper', 1);
    await p.evaluate(() => { const q = document.querySelector('#examquit'); if (q) { window.confirm = () => true; q.click(); } });
    await settled(p);

    await p.evaluate(() => { const x = Array.from(document.querySelectorAll('button,a')).find(e => /^study$/i.test(e.textContent.trim())); x && x.click(); });
    await settled(p);
    await p.evaluate(() => { const x = document.querySelector('[data-open="custom-after"]'); x && x.click(); });
    await settled(p);
    await p.evaluate(() => { const x = Array.from(document.querySelectorAll('button,[data-mode]')).find(e => /long|extended|essay/i.test(e.textContent)); x && x.click(); });
    await p.waitForTimeout(400);
    ok(!!(await p.$('#ans')), 'a flashcard is reachable after quitting the paper');

    await answer(p, 'An interest rate rise raises the cost of borrowing. '.repeat(12));
    ok(sent.length === 1, 'the flashcard was marked: ' + sent.length);
    const req = sent[0] || {};
    ok(req.subject !== 'Business Studies',
      'and NOT under the subject of the paper the student just left: ' + JSON.stringify(req.subject));
    ok(req.subject === 'Economics',
      'it is marked as the flashcard content it is: ' + JSON.stringify(req.subject));
    await p.close();
  }

  // ==========================================================================
  console.log('8. the ownership invariant holds across every lifecycle Test mode has');
  // ==========================================================================
  {
    // examOwns asks whether a card IS one of the sat paper's questions, by object
    // identity, and that is only sound while nothing on the path copies a question.
    // Today nothing does: examStart stores sec.questions[qi] by reference and every
    // later step passes the same object on. That is a constraint on the whole exam
    // path, and the JSON importer is the obvious thing that could break it later,
    // so it is walked rather than assumed. `identical` false anywhere below means a
    // clone has entered the path and the boundary must move to stable ids.
    const CURRIC = { jurisdiction: 'NSW', klaKey: 'hsie', subjectKey: 'business_studies', course: 'Business Studies' };
    const own = pg => pg.evaluate(() => window.__examOwnership());
    const holds = (o, where) => {
      ok(o.questions.length > 0, where + ': there are sequenced questions to check: ' + o.questions.length);
      ok(o.questions.every(q => q.identical), where + ': every sequenced question is still the paper\'s own object: ' +
        JSON.stringify(o.questions.filter(q => !q.identical)));
      ok(o.questions.every(q => q.owned), where + ': and every one of them resolves as owned: ' +
        JSON.stringify(o.questions.filter(q => !q.owned)));
      ok(o.subjectKey === 'business_studies', where + ': under the paper\'s own subject key: ' + JSON.stringify(o.subjectKey));
    };

    // -- imported this session, then sat straight away ------------------------
    {
      const { p, sent } = await openWith(b, { cards: {}, endpoint: '', code: '12Ec126', log: [],
        customSets: [], lessons: {}, exams: [] });
      await p.evaluate(() => { const x = Array.from(document.querySelectorAll('button,a')).find(e => /^create$/i.test(e.textContent.trim())); x && x.click(); });
      await settled(p);
      await p.fill('#importjson', JSON.stringify({ format: 'marginal-exam@1', name: 'Fresh import',
        curriculum: CURRIC, sections: essayPaper('x', {}).sections }));
      await p.click('#doimport'); await settled(p);
      const id = await p.evaluate(() => (JSON.parse(localStorage.getItem('marginal.trial.v1') || '{}').exams || [])
        .filter(e => e.name === 'Fresh import').map(e => e.id)[0]);
      ok(!!id, 'the imported paper is there to sit: ' + JSON.stringify(id));
      await sit(p, id, 1);
      holds(await own(p), 'imported then sat');
      await answer(p, 'A response about weaving strategies. '.repeat(20));
      ok((sent[0] || {}).subject === 'Business Studies',
        'and it marks under its own subject: ' + JSON.stringify((sent[0] || {}).subject));
      await p.close();
    }

    // -- written to storage, page reloaded, then sat --------------------------
    // The one step that genuinely rebuilds every object: JSON.stringify on save,
    // JSON.parse on load. Identity survives because state.exams IS the parsed tree
    // and examStart reads out of it, not out of anything older.
    {
      const { p, sent } = await openWith(b, withPaper(essayPaper('reloaded', CURRIC)));
      await sit(p, 'reloaded', 1);
      await p.reload(); await settled(p);
      await sit(p, 'reloaded', 1);
      holds(await own(p), 'after a full reload');
      await answer(p, 'A response about weaving strategies. '.repeat(20));
      ok((sent[0] || {}).subject === 'Business Studies',
        'a paper rebuilt from storage still marks under its own subject: ' + JSON.stringify((sent[0] || {}).subject));
      await p.close();
    }

    // -- answered, left, re-entered and sat again -----------------------------
    {
      const { p, sent } = await openWith(b, withPaper(paper('revisited', CURRIC)));
      await sit(p, 'revisited', 1);
      await answer(p, 'Reeds are flexible and hollow.');
      await p.evaluate(() => { const x = document.querySelector('#examquit'); x && x.click(); });
      await settled(p);
      await sit(p, 'revisited', 1);
      holds(await own(p), 'after leaving and coming back');
      await p.click('#examnext'); await settled(p);
      await answer(p, 'A response about weaving strategies. '.repeat(20));
      ok(sent.length === 1 && sent[0].subject === 'Business Studies',
        'and the second sitting marks under the same subject: ' + JSON.stringify(sent.map(x => x.subject)));
      await p.close();
    }

    // -- retaken from the results screen --------------------------------------
    {
      const { p } = await openWith(b, withPaper(essayPaper('retaken', CURRIC)));
      await sit(p, 'retaken', 1);
      await answer(p, 'A response about weaving strategies. '.repeat(20));
      await p.click('#examnext'); await settled(p);
      const rt = await p.$('#examretake');
      ok(!!rt, 'the results screen offers a retake');
      if (rt) { await rt.click(); await settled(p); }
      const bg = await p.$('#exambegin'); if (bg) { await bg.click(); await settled(p); }
      holds(await own(p), 'after a retake');
      await p.close();
    }

    // -- a subset of sections, chosen on the picker ---------------------------
    {
      const two = { id: 'subset', name: 'Paper subset', curriculum: CURRIC, sections: [
        { name: 'Section I', questions: [SHORT_Q] },
        { name: 'Section II', questions: [ESSAY_Q] }] };
      const { p, sent } = await openWith(b, withPaper(two));
      await p.evaluate(() => { const x = Array.from(document.querySelectorAll('button,a')).find(e => /test mode/i.test(e.textContent)); x && x.click(); });
      await settled(p);
      await p.evaluate(() => { const x = document.querySelector('[data-examsit="subset"]'); x && x.click(); });
      await settled(p);
      await p.$$eval('[data-exampick]', es => es.forEach((e, i) => { e.checked = i === 1; e.dispatchEvent(new Event('change')); }));
      await p.click('#exampickgo'); await settled(p);
      const bg = await p.$('#exambegin'); if (bg) { await bg.click(); await settled(p); }
      const o = await own(p);
      ok(o.questions.length === 1, 'only the chosen section is sequenced: ' + o.questions.length);
      holds(o, 'sitting one section of two');
      await answer(p, 'A response about weaving strategies. '.repeat(20));
      ok((sent[0] || {}).subject === 'Business Studies',
        'and it marks under the paper\'s subject: ' + JSON.stringify((sent[0] || {}).subject));
      await p.close();
    }

    // -- restored from a backup, then sat -------------------------------------
    {
      const { p } = await openWith(b, { cards: {}, endpoint: '', code: '12Ec126', log: [],
        customSets: [], lessons: {}, exams: [essayPaper('restored', CURRIC)] });
      // The restore path pushes papers parsed out of a backup file, which is the
      // other place a paper object is built from text rather than copied.
      await sit(p, 'restored', 1);
      holds(await own(p), 'restored from storage');
      await p.close();
    }
  }

  ok(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
  await b.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  FAIL: the suite threw: ' + e.message); console.log('\n' + pass + ' passed, ' + (fail + 1) + ' failed'); process.exit(1); });
