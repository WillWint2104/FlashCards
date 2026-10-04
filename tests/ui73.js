// SLICE A ACCEPTANCE: THE TWO DESKTOP JOURNEYS, END TO END, IN THE REAL APP.
//
// Decision 22 closed Slice A's design and named what implementation has to prove
// before it is reported back:
//
//   1. Test mode -> Short answer -> choose questions -> start -> answer -> mark ->
//      flag and navigate -> leave -> resume, with the paper attempt on the same
//      paper untouched by any of it.
//   2. Library -> import -> validate -> add -> overview -> choose sections ->
//      start -> answer several formats -> flag -> navigate -> leave -> resume,
//      with no source-code edit anywhere: the paper arrives as a file chosen in
//      the browser, exactly as a student would bring one.
//
// And around them, the locked rules: scope is fixed once an attempt starts; an
// attempt in progress offers Resume and a confirmed Start again; a completed one
// offers "Start new attempt"; a newer version of a paper replaces it in the
// library while the attempt already on the old one keeps sitting the old one.
//
// "Leave" here is a reload of the page, not a return to the library: everything
// the student sees on resume is read back out of storage. The marker is faked at
// the network, on the question's own scale, as the real worker replies.
//
// Desktop only (1440 and 1280 class). Full tier only: it is browser-heavy.
const fs = require('fs');
const path = require('path');
const { chromium, T, OUT } = require('./env');
const FIXTURE = require('./fixtures/bus-practice-paper.json');

const settled = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };

const REVIEW = (score, max) => ({ summary: 'The marker read this answer.', score, total: score, max,
  paragraphs: [{ name: 'Answer', score, max, reasons: [], sentences: [] }], rubric: [], overall: { summary: 'The marker read this answer.' },
  criteria: [], next_steps: [], missing_vocabulary: [], checks: {} });

async function open(b, width) {
  const ctx = await b.newContext({ viewport: { width, height: 900 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  const dialogs = []; p.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
  const sent = [];
  // Every short answer is given full marks less one, on its own scale.
  await p.route(/workers\.dev/, async r => {
    const s = JSON.parse(r.request().postData() || '{}');
    if (s.action === 'coach') return r.fulfill({ status: 200, contentType: 'application/json', body: '{"nudges":[]}' });
    sent.push(s);
    const max = Number(s.marks || s.max || (s.question && s.question.marks) || 0);
    if (!max) return r.abort();
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(REVIEW(max - 1, max)) });
  });
  await p.goto(T + '?review=1'); await settled(p);
  return { p, ctx, errs, dialogs, sent };
}
const store = p => p.evaluate(() => JSON.parse(localStorage.getItem('marginal.trial.v1') || '{}'));
const toTest = async p => { await p.$$eval('.navtab', es => { const t = es.find(x => /Test mode/i.test(x.textContent)); t && t.click(); }); await settled(p); };
const text = (p, sel) => p.$eval(sel, e => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
const bar = p => text(p, '.exam-progress');
const qhead = p => text(p, '.exam-qhead');
const has = (p, sel) => p.$(sel).then(Boolean);
const leaveAndReload = async p => { await p.click('#examquit'); await settled(p); await p.reload(); await settled(p); };
async function submit(p, answer) {
  if (answer != null) await p.fill('#ans', answer);
  await p.click('#check');
  await p.waitForFunction(() => !!document.querySelector('#sheet .tm-result') && !/Checking/.test((document.querySelector('#check') || {}).textContent || ''),
    null, { timeout: 15000 }).catch(() => {});
  await settled(p);
}
// A chip by its authored number: "1" is a leaf chip Q1; "11(a)" is part (a) in
// the Question 11 block. Never by position.
async function navTo(p, label) {
  await p.click('#examnav'); await settled(p);
  const hit = await p.evaluate(l => {
    const m = /^(\d+)\(([a-z]+)\)$/.exec(l);
    const chips = [...document.querySelectorAll('[data-tmnav]')];
    const name = c => c.textContent.replace(/[✓⚑]/g, '').replace(/[()\s]/g, '');
    const t = m ? chips.find(c => name(c) === m[2] && new RegExp('Question ' + m[1] + '\\b').test(c.closest('.tm-pblock') ? c.closest('.tm-pblock').querySelector('.pbh b').textContent : ''))
                : chips.find(c => name(c) === 'Q' + l);
    if (t) { t.click(); return true; } return false;
  }, label);
  await settled(p);
  if (!hit) { console.log('    chips:', await p.$$eval('[data-tmnav]', es => es.map(e => e.textContent)).catch(() => '(none)')); await p.keyboard.press('Escape'); await settled(p); }
  return hit;
}
const shot = (p, n) => p.screenshot({ path: OUT + 'shot-sliceA-' + n + '.png' });

(async () => {
  const b = await chromium.launch();

  // ===== JOURNEY 1: a short-answer practice session, beside a paper attempt ===
  console.log('--- journey 1: Test mode -> Short answer -> choose -> answer -> mark -> flag -> navigate -> leave -> resume');
  {
    const { p, ctx, errs, dialogs, sent } = await open(b, 1440);
    const PKEY = 'paper:' + FIXTURE.exam.id.split('-')[0];   // located properly below

    // A paper attempt already in progress on the same paper, with work in it.
    await toTest(p);
    await p.click('[data-examsit]'); await settled(p);
    await p.click('#exampicknone'); await settled(p);
    await p.$$eval('.tm-row', es => es.find(x => /Short answer/.test(x.textContent)).click()); await settled(p);
    await p.click('#exampickgo'); await settled(p);
    await p.fill('#ans', 'The paper attempt draft for 11(a).'); await settled(p);
    await p.click('#examflag'); await settled(p);
    await p.click('#examquit'); await settled(p);
    const before = await store(p);
    const paperKey = Object.keys(before.attempts || {}).find(k => k.startsWith('paper:'));
    const paperBefore = JSON.stringify(before.attempts[paperKey]);
    ok(!!paperKey && /paper attempt draft/.test(paperBefore), 'a paper attempt is in progress with a draft in 11(a): ' + paperKey);
    void PKEY;

    // Page 1: the type row counts only questions that can be marked on this path.
    const row = await p.evaluate(() => { const b = document.querySelector('[data-tmtype="short_answer"]'); return b ? b.closest('li, .tm-type, article, div').textContent.replace(/\s+/g, ' ').trim() : ''; });
    ok(/Short answer/.test(row), 'the library offers Short answer practice: ' + row);
    await p.click('[data-tmtype="short_answer"]'); await settled(p);
    await shot(p, 'type-setup-1440');
    const bank = await p.$$eval('.tm-qrow .tm-qn', es => es.map(e => e.textContent.trim()));
    ok(bank.length >= 2 && bank.every(x => /^Question \d+\([a-z]\)$/.test(x)), 'the bank lists short answer questions by their authored numbers: ' + JSON.stringify(bank));
    ok(!(await p.$$eval('input[name=tmmode]', es => es.map(e => e.value))).some(v => !['all', 'choose'].includes(v)),
       'the only modes are All questions and Choose questions (no number, no random)');

    // Choose questions: 11(a) (also in the paper attempt) and the last one.
    await p.click('input[name=tmmode][value=choose]'); await settled(p);
    await p.click('#tmqnone'); await settled(p);
    ok(await p.$eval('#tmtypego', e => e.disabled), 'with nothing chosen, Start practice is unavailable');
    const qa = bank.indexOf('Question 11(a)'), qz = bank.length - 1;
    await p.click(`[data-tmq="${qa}"]`); await p.click(`[data-tmq="${qz}"]`); await settled(p);
    ok(/^2 of \d+ questions/.test(await text(p, '#tmqsum')), 'the summary says what is chosen: ' + await text(p, '#tmqsum'));
    await p.click('#tmtypego'); await settled(p);
    await shot(p, 'type-sitting-1440');

    ok(/11\(a\)/.test(await qhead(p)), 'the session opens on 11(a): ' + await qhead(p));
    ok((await p.$eval('#ans', e => e.value)) === '', 'and the paper attempt\'s draft for 11(a) is not in this session\'s box');
    ok(/^0 of 2 answered/.test(await bar(p)), 'two questions in scope, none answered: ' + await bar(p));

    // Answer and mark.
    await submit(p, 'Speed. Customers wait too long at the vans during the morning peak, so the objective is not met.');
    ok(sent.length === 1 && await has(p, '#sheet .tm-result:not(.nm)'), 'the answer is marked by the marker: ' + await text(p, '#sheet .tm-result'));
    const marked = await bar(p);
    ok(/^1 of 2 answered · 1\/\d+ marks$/.test(marked), 'the bar counts it, and only it: ' + marked);

    // Flag, move on, write a draft, navigate back by the navigator.
    await p.click('#examflag'); await settled(p);
    ok(await p.$eval('#examflag', e => e.getAttribute('aria-pressed') === 'true'), '11(a) is flagged');
    await p.click('#examnext'); await settled(p);
    const second = await qhead(p);
    ok(!/11\(a\)/.test(second), 'Next moves to the second chosen question: ' + second);
    await p.fill('#ans', 'A draft I have not submitted yet.'); await settled(p);
    await p.waitForTimeout(700);   // drafts save as they are typed, on a short debounce
    await p.click('#examnav'); await settled(p);
    const blocks = await p.$$eval('.tm-pblock .pbh span', es => es.map(e => e.textContent));
    const secline = await text(p, '.tm-navsec .nsh span');
    const sum = blocks.reduce((n, t) => n + Number((/^(\d+) marks?/.exec(t) || [0, 0])[1]), 0);
    ok(new RegExp('/' + sum + ' marks').test(secline), 'parent blocks state only the parts in the session, adding up to the section: ' + blocks.join(' | ') + ' vs ' + secline);
    await p.click('#tmnavx'); await settled(p);
    ok(await navTo(p, '11(a)'), 'the navigator offers 11(a)');
    ok(/11\(a\)/.test(await qhead(p)) && await has(p, '#sheet .tm-result:not(.nm)'), 'back on 11(a), its mark is still there');
    await navTo(p, second.match(/\d+\([a-z]+\)/)[0]);   // leave from the second question

    // Leave, reload, resume.
    await leaveAndReload(p);
    await toTest(p);
    const resumeBtn = await p.$('[data-tmtype="short_answer"]');
    ok(resumeBtn && /Resume practice/.test(await resumeBtn.textContent()), 'after a reload, the library offers Resume practice');
    await resumeBtn.click(); await settled(p);
    ok(await has(p, '#tmresume') && await has(p, '#tmstartagain'), 'the overview offers Resume and Start again');
    ok(!(await has(p, 'input[name=tmmode]')), 'and no way to change the questions in an attempt in progress');
    await p.click('#tmresume'); await settled(p);
    ok((await qhead(p)) === second, 'resume opens where the student left: ' + await qhead(p));
    ok((await p.$eval('#ans', e => e.value)) === 'A draft I have not submitted yet.', 'with the unsubmitted draft restored');
    ok((await bar(p)) === marked, 'and the same count: ' + await bar(p));
    await p.click('#examprev'); await settled(p);
    ok(await has(p, '#sheet .tm-result:not(.nm)') && await p.$eval('#examflag', e => e.getAttribute('aria-pressed') === 'true'),
       '11(a) keeps its mark and its flag');
    await shot(p, 'type-resumed-1440');

    const after = await store(p);
    ok(JSON.stringify(after.attempts[paperKey]) === paperBefore, 'the paper attempt is byte for byte what it was before the session');
    ok(!errs.length, 'no page errors ' + JSON.stringify(errs));
    ok(!dialogs.length, 'no confirmations were needed: ' + JSON.stringify(dialogs));
    await ctx.close();
  }

  // ===== JOURNEY 2: a paper brought in as a file, sat in part, left, resumed ==
  console.log('--- journey 2: Library -> import -> validate -> add -> overview -> sections -> sit -> flag -> navigate -> leave -> resume');
  {
    const { p, ctx, errs, dialogs, sent } = await open(b, 1280);
    const ID = 'acceptance-bus-practice', TITLE = 'Acceptance practice paper';
    const v1 = JSON.parse(JSON.stringify(FIXTURE));
    v1.exam = Object.assign({}, v1.exam, { id: ID, title: TITLE, version: '1' }); v1.name = TITLE;
    const file1 = path.join(OUT, 'acceptance-paper-v1.json');
    fs.writeFileSync(file1, JSON.stringify(v1));
    const sources = ['app.js', 'index.html', 'marginal-preview.html', 'business-content.js', 'content.js'].map(f => path.join(__dirname, '..', f));
    ok(sources.every(f => !fs.readFileSync(f, 'utf8').includes(TITLE)), 'the paper is in no source file: it can only arrive by import');

    await toTest(p);
    const cardsBefore = await p.$$eval('.tm-paper', es => es.length);
    await p.click('#tmimport'); await settled(p);
    await p.setInputFiles('#tmfile', file1);
    await p.waitForSelector('#tmrt', { timeout: 8000 }); await settled(p);
    const verdict = await text(p, '#tmrt');
    ok(/ready/i.test(verdict) && await has(p, '#tmadd'), 'the file is validated and can be added: ' + verdict);
    ok(/acceptance-paper-v1\.json/.test(await text(p, '.tm-fn')), 'the verdict names the file it read');
    await shot(p, 'import-verdict-1280');
    await p.click('#tmadd'); await settled(p);
    ok((await p.$$eval('.tm-paper', es => es.length)) === cardsBefore + 1, 'it is in the library');
    const card = await p.evaluate(t => { const c = [...document.querySelectorAll('.tm-paper')].find(x => x.textContent.includes(t)); return c ? c.textContent.replace(/\s+/g, ' ') : ''; }, TITLE);
    ok(/\b20 questions · 4 sections · 90 marks\b/.test(card), 'the card states questions and marks: ' + card.slice(0, 160));

    // Overview: choose two sections, see "For this practice" above the original instructions.
    await p.evaluate(t => [...document.querySelectorAll('.tm-paper')].find(x => x.textContent.includes(t)).querySelector('[data-tmopen]').click(), TITLE);
    await settled(p);
    ok(/Business Studies/.test(await text(p, 'header, .tm-unit, #app')), 'the overview speaks the paper\'s own subject');
    ok(!/Economics/.test(await text(p, '#app')), 'and nothing on it says Economics');
    ok(!(await has(p, '#tmforthis .tm-forthis')), 'a whole paper has no "For this practice" note');
    await p.click('#exampicknone'); await settled(p);
    await p.$$eval('.tm-row', es => es.filter(x => /Multiple choice|Short answer/.test(x.textContent)).forEach(x => x.click())); await settled(p);
    const forThis = await text(p, '#tmforthis');
    ok(/For this practice/.test(forThis) && /Original paper instructions/.test(await text(p, '#app')),
       '"For this practice" sits above the original instructions, kept verbatim: ' + forThis);
    ok((await text(p, '#app')).includes(v1.instructions), 'the authored instructions are there word for word');
    await shot(p, 'paper-setup-1280');
    await p.click('#exampickgo'); await settled(p);

    // Multiple choice, marked locally; flagged.
    ok(/^Question 1\b/.test(await qhead(p)) || /1/.test(await qhead(p)), 'the attempt opens on Question 1: ' + await qhead(p));
    await p.click('.choice'); await settled(p);
    await p.click('#check'); await settled(p);
    ok(await has(p, '#sheet .tm-result:not(.nm)'), 'a multiple choice answer is marked from its key');
    await p.click('#examflag'); await settled(p);
    // A short answer, marked by the marker.
    ok(await navTo(p, '11(a)'), 'the navigator reaches Section II');
    await submit(p, 'Speed. The morning queue at the vans is too long, which the case study links to waiting times.');
    ok(await has(p, '#sheet .tm-result:not(.nm)') && sent.length === 1, 'the short answer is marked');
    // A calculation, marked locally from its expected value.
    await p.click('#examnext'); await settled(p);
    await p.click('#examnext'); await settled(p);
    ok(/calculation/.test(await qhead(p)), 'the calculation 11(c): ' + await qhead(p));
    await submit(p, '1.5');
    ok(await has(p, '#sheet .tm-result:not(.nm)') && sent.length === 1, 'the calculation is marked without the marker');
    // A draft, not submitted, on the next question.
    await p.click('#examnext'); await settled(p);
    const draftAt = await qhead(p);
    await p.fill('#ans', 'A justification I will finish later.'); await p.waitForTimeout(700);
    const progress = await bar(p);
    ok(/^3 of \d+ answered · \d+\/\d+ marks$/.test(progress), 'three answered across three formats: ' + progress);
    await shot(p, 'paper-sitting-1280');

    // Leave, reload, resume.
    await leaveAndReload(p);
    await toTest(p);
    const resumeCard = await p.evaluate(t => { const c = [...document.querySelectorAll('.tm-paper')].find(x => x.textContent.includes(t)); const r = c && c.querySelector('[data-examresume]'); return r ? r.textContent.trim() : ''; }, TITLE);
    ok(/Resume paper/.test(resumeCard), 'the card offers Resume paper');
    await p.evaluate(t => [...document.querySelectorAll('.tm-paper')].find(x => x.textContent.includes(t)).querySelector('[data-examresume]').click(), TITLE);
    await settled(p);
    if (await has(p, '#tmresume')) { await p.click('#tmresume'); await settled(p); }
    ok((await qhead(p)) === draftAt, 'resume opens where the student left: ' + await qhead(p));
    ok((await p.$eval('#ans', e => e.value)) === 'A justification I will finish later.', 'with the draft restored');
    ok((await bar(p)) === progress, 'and the same scope and count: ' + await bar(p));
    await navTo(p, '1');
    ok(await has(p, '#sheet .tm-result:not(.nm)') && await p.$eval('#examflag', e => e.getAttribute('aria-pressed') === 'true'), 'Question 1 keeps its mark and flag');
    const navLabels = await (async () => { await p.click('#examnav'); await settled(p); const l = await p.$$eval('[data-tmnav]', es => es.map(e => e.textContent.trim())); await p.keyboard.press('Escape'); await settled(p); return l; })();
    ok(!navLabels.some(l => /^1[45]$|^14\b/.test(l.replace(/[✓⚑\s]/g, ''))), 'the attempt holds only the two chosen sections: ' + navLabels.join(' '));
    await p.click('#examquit'); await settled(p);

    // A newer version replaces the paper in the library; this attempt stays on version 1.
    const v2 = JSON.parse(JSON.stringify(v1)); v2.exam.version = '2';
    v2.sections[0].questions[0].prompt = 'Version two: ' + v2.sections[0].questions[0].prompt;
    const file2 = path.join(OUT, 'acceptance-paper-v2.json'); fs.writeFileSync(file2, JSON.stringify(v2));
    await p.click('#tmimport'); await settled(p);
    await p.setInputFiles('#tmfile', file2);
    await p.waitForSelector('#tmrt', { timeout: 8000 }); await settled(p);
    ok(/newer version will replace/i.test(await text(p, '#tmimportbody')) && /Replace with this version/.test(await text(p, '#tmadd')),
       'version 2 is recognised as a newer version of the same paper');
    await p.click('#tmadd'); await settled(p);
    const lib = await p.$$eval('.tm-paper', es => es.map(e => e.textContent.replace(/\s+/g, ' ')));
    ok(lib.filter(t => t.includes(TITLE)).length === 1, 'the library shows the paper once');
    await p.evaluate(t => [...document.querySelectorAll('.tm-paper')].find(x => x.textContent.includes(t)).querySelector('[data-tmopen]').click(), TITLE);
    await settled(p);
    ok(/on version 1/.test(await text(p, '.tm-pin')) && /version 2/.test(await text(p, '.tm-pin')), 'the overview says the attempt is pinned to version 1: ' + await text(p, '.tm-pin'));
    await shot(p, 'paper-pinned-1280');
    await p.click('#tmresume'); await settled(p);
    await navTo(p, '1');
    ok(!/Version two/.test(await text(p, '#app')), 'the attempt in progress still sits version 1');
    await p.click('#examquit'); await settled(p);

    // Start again: confirmed, discards, returns to setup; the next attempt sits version 2.
    await p.evaluate(t => [...document.querySelectorAll('.tm-paper')].find(x => x.textContent.includes(t)).querySelector('[data-tmopen]').click(), TITLE);
    await settled(p);
    const nd = dialogs.length;
    await p.click('#tmstartagain'); await settled(p);
    ok(dialogs.length === nd + 1 && /discards the attempt in progress/.test(dialogs[nd]), 'Start again asks first: ' + JSON.stringify(dialogs[nd]));
    ok(await has(p, '#exampickgo') && /Start paper/.test(await text(p, '#exampickgo')), 'and returns to setup, with nothing completed yet');
    await p.click('#exampicknone'); await settled(p);
    await p.$$eval('.tm-row', es => es.find(x => /Multiple choice/.test(x.textContent)).click()); await settled(p);
    await p.click('#exampickgo'); await settled(p);
    ok(/Version two/.test(await text(p, '#app')), 'the new attempt sits version 2');
    const s2 = await store(p);
    ok((s2.exams || []).filter(e => e.exam && e.exam.id === ID).length === 1, 'with nothing pinned to it, version 1 is gone from storage');

    // Completing it: the next action on the overview is "Start new attempt".
    await p.click('.choice'); await settled(p); await p.click('#check'); await settled(p);
    while (!(await has(p, '#examfinish'))) { await p.click('#examnext'); await settled(p); }
    await p.click('#examfinish'); await settled(p);
    await p.click('#exambackhome').catch(() => {}); await settled(p);
    await toTest(p);
    await p.evaluate(t => [...document.querySelectorAll('.tm-paper')].find(x => x.textContent.includes(t)).querySelector('[data-tmopen]').click(), TITLE);
    await settled(p);
    ok(/Start new attempt/.test(await text(p, '#exampickgo')), 'a completed attempt leads to "Start new attempt": ' + await text(p, '#exampickgo'));
    ok(!/—/.test(await text(p, '#app')), 'no em dash on the overview');

    ok(!errs.length, 'no page errors ' + JSON.stringify(errs));
    await ctx.close();
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail ? 1 : 0);
})();
