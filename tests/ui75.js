// RESULTS AND REVIEW, AND THE FINAL DESKTOP JOURNEY (Slice B, states 2 and 3;
// decisions 25 and 26).
//
// Results and Review are frozen (docs/mockups/05-results*.html, 06-review*.html)
// and built as one feature. What this proves, in the real app:
//
//   1. the whole desktop journey: Library, Start, sit and mark, leave and
//      Resume, Review & submit, Submit paper, Results, a marked question, a
//      not-marked one, a changed-after-marking one, back to Results, Start new
//      attempt;
//   2. the routes: a Results cell opens that exact item, Review each question
//      opens the first answerable, Previous and Next follow the attempt, the
//      navigator opens any item, Results returns to the same attempt;
//   3. a completed attempt is immutable: nothing in Results or Review writes,
//      and Review has no edit, flag, Try again, Try marking again or second
//      opinion; the answer is read only, not a disabled field;
//   4. the historical states: the marked version and the later edit kept
//      apart, the cause of a missing mark without the advice, a draft never
//      submitted never called an answer, an either/or never chosen;
//   5. Nothing marked where an attempt holds no valid mark, and a real 0 where
//      it does (library card, Page 3, Submit and Results);
//   6. an extended response's submission collapsed, its mark and feedback high;
//   7. a finished practice session stays reachable from its question type.
//
// Full tier only (decision 26: Fast is at capacity; no new browser coverage on
// Fast or Checkpoint).
const { chromium, T } = require('./env');
const paper = require('./fixtures/bus-practice-paper.json');

const settled = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };
const REVIEW = (score, max) => ({ summary: 'The marker read this answer.', score, total: score, max,
  paragraphs: [{ name: 'Answer', score, max, reasons: [], sentences: [] }], rubric: [], overall: { summary: 'The marker read this answer.' },
  criteria: [], next_steps: [], missing_vocabulary: [], checks: {} });

async function open(b, seed) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(sd => { if (sd && !localStorage.getItem('marginal.trial.v1')) localStorage.setItem('marginal.trial.v1', JSON.stringify(sd)); }, seed || null);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  const dialogs = []; p.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
  const mode = { reply: () => 'abort', sent: [] };
  await p.route(/workers\.dev/, async r => {
    const s = JSON.parse(r.request().postData() || '{}');
    if (s.action === 'coach') return r.fulfill({ status: 200, contentType: 'application/json', body: '{"nudges":[]}' });
    mode.sent.push(s);
    const out = mode.reply(s);
    if (out === 'abort') return r.abort();
    if (out && out.delay) await new Promise(res => setTimeout(res, out.delay));
    if (out && out.status) return r.fulfill({ status: out.status, contentType: 'application/json', body: JSON.stringify(out.body || {}) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
  });
  await p.goto(T + '?review=1'); await settled(p);
  return { p, ctx, mode, errs, dialogs };
}
const has = (p, sel) => p.$(sel).then(Boolean);
const text = (p, sel) => p.$eval(sel, e => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
const qhead = p => text(p, '.exam-qhead');
const stored = p => p.evaluate(() => JSON.parse(localStorage.getItem('marginal.trial.v1') || '{}').attempts || {});
const current = async p => { const at = await stored(p); const k = Object.keys(at).find(x => at[x] && at[x].current); return k ? { key: k, a: at[k].current, rec: at[k] } : null; };
async function toTest(p) { await p.$$eval('.navtab', es => es.find(x => /Test mode/i.test(x.textContent)).click()); await settled(p); }
async function sit(p, name, sections) {
  await toTest(p);
  await p.evaluate(n => { const c = [...document.querySelectorAll('.tm-paper')].find(x => !n || x.textContent.includes(n)) || document.querySelector('.tm-paper'); c.querySelector('[data-tmopen]').click(); }, name || '');
  await settled(p);
  if (await has(p, '#tmstartagain')) { await p.click('#tmstartagain'); await settled(p); }
  if (sections) { await p.click('#exampicknone'); await settled(p); await p.$$eval('.tm-row', (es, ss) => es.filter(x => ss.some(s => x.textContent.includes(s))).forEach(x => x.click()), sections); await settled(p); }
  await p.click('#exampickgo'); await settled(p);
}
async function navTo(p, label) {
  await p.click('#examnav'); await settled(p);
  await p.evaluate(l => {
    const m = /^(\d+)\(([a-z]+)\)$/.exec(l);
    const name = c => c.textContent.replace(/[✓⚑()\s]/g, '');
    const t = [...document.querySelectorAll('[data-tmnav]')].find(c => m ? name(c) === m[2] && new RegExp('Question ' + m[1] + '\\b').test((c.closest('.tm-pblock') || { querySelector: () => ({ textContent: '' }) }).querySelector('.pbh b').textContent) : name(c) === 'Q' + l);
    t && t.click();
  }, label);
  await settled(p);
}
async function submit(p, answer) {
  if (answer != null) await p.fill('#ans', answer);
  await p.click('#check');
  await p.waitForFunction(() => !!document.querySelector('#sheet .tm-result') && !/Checking/.test((document.querySelector('#check') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {});
  await settled(p);
}
const review = async p => { await p.click('#examnav'); await settled(p); await p.click('#tmnavreview'); await settled(p); };
const rows = p => p.$$eval('.tm-tally tbody tr, .tm-tally tfoot tr', es => es.map(e => [...e.children].map(c => c.textContent.replace(/\s+/g, ' ').trim())));

const ER = (score, max) => ({ summary: 'The response reaches a judgement but rests on assertion.', score, total: score, max,
  paragraphs: [{ name: 'Body', score, max, reasons: [], sentences: [] }],
  rubric: [{ name: 'knowledge and understanding of course content', descriptor: '' }, { name: 'sustained, logical and cohesive response', descriptor: '' }],
  overall: { summary: 'The response reaches a judgement but rests on assertion.' }, criteria: [], next_steps: [], missing_vocabulary: [], checks: {} });
const PAPERKEY = 'paper:' + paper.exam.id;
const last = async (p, key) => (await stored(p))[key || PAPERKEY].last;
const resultsOf = (p, key) => p.evaluate(k => { const st = JSON.parse(localStorage.getItem('marginal.trial.v1')); const r = window.MarginalAttempts.results(st.attempts[k].last, st.exams);
  return { got: r.got, max: r.max, marked: r.rows.marked.count, total: r.total, items: r.items.map(x => ({ key: x.key, status: x.status, cause: x.cause })),
           seq: window.MarginalAttempts.sequence(st.attempts[k].last, st.exams).map(e => e.key) }; }, key || PAPERKEY);
const raw = p => p.evaluate(() => localStorage.getItem('marginal.trial.v1'));
const cell = async (p, k) => { await p.click(`.tm-rs-cell[data-tmrv="${k}"]`); await settled(p); };
// What Review must never offer, on any item of a completed attempt.
async function readOnly(p, where) {
  const t = await text(p, '#app');
  const bad = await p.evaluate(() => ({
    fields: document.querySelectorAll('#app textarea, #app input').length,
    disabledAnswer: !!document.querySelector('.tm-answerbox[disabled], .tm-answerbox:disabled'),
    actions: ['#examretry', '#examremark', '#examreview', '#examflag', '#check', '#tmswitch', '#examfinish', '[data-examchoose]'].filter(s => document.querySelector(s)),
  }));
  ok(!bad.fields && !bad.disabledAnswer && !bad.actions.length && !/Try again|Try marking|second opinion|make this stronger|Submit for marking|\byet\b/i.test(t),
     where + ': read only, with nothing that edits, flags or marks: ' + JSON.stringify(bad) + ' ' + (t.match(/Try again|Try marking|second opinion|make this stronger|Submit for marking|\byet\b/i) || [''])[0]);
}

(async () => {
  const b = await chromium.launch();

  console.log('--- 1. the final desktop journey, Library to Start new attempt');
  {
    const { p, ctx, mode, errs, dialogs } = await open(b);
    mode.reply = s => /gross profit/i.test(JSON.stringify(s)) ? { status: 503, body: {} } : REVIEW(2, 2);
    await toTest(p);
    ok(/Not started/.test(await text(p, '.tm-paper')), 'Library: the paper is not started');
    await p.click('.tm-paper [data-examsit]'); await settled(p);
    ok((await text(p, '#exampickgo')) === 'Start paper', 'Start paper goes to setup first');
    await p.click('#exampickgo'); await settled(p);
    await p.click('.choice'); await p.click('#check'); await settled(p);              // Q1: choice A, a real 0 / 1
    await p.click('#examnext'); await settled(p); await p.click('#examflag'); await settled(p);   // Q2 flagged, unanswered
    await p.click('#examquit'); await settled(p);
    ok(/In progress/.test(await text(p, '.tm-paper')), 'leaving keeps the attempt in progress');
    await p.click('[data-examresume]'); await settled(p);
    ok(/Question 2\b/.test(await qhead(p)), 'Resume goes straight back to the saved question: ' + await qhead(p));
    await navTo(p, '11(a)');
    const graded = 'Speed. Customers wait too long at the vans in the morning.';
    await submit(p, graded);
    ok(/2 of 2/.test(await text(p, '#sheet .tm-result')), '11(a) is marked 2 of 2');
    await p.click('#examretry'); await settled(p);
    const later = 'Speed. A later edit that was never submitted.';
    await p.fill('#ans', later);
    await navTo(p, '11(d)');
    const unsent = 'A staffing strategy I drafted and never sent.';
    await p.fill('#ans', unsent);
    await navTo(p, '12(a)');
    await submit(p, 'The gross profit ratio fell from 40% to 37%.');
    ok(/Not marked/.test(await text(p, '#sheet .tm-result')), '12(a) is submitted and not marked');
    await review(p);
    ok((await text(p, '#tmreview h1')) === 'Submit paper', 'Review & submit opens Submit paper');
    await p.click('#tmsubmitpaper'); await settled(p);
    const rec = (await stored(p))[PAPERKEY];
    ok(!rec.current && rec.last && rec.last.completedAt, 'Submit paper closes the attempt');
    const R = await resultsOf(p);

    // Results: the map, read from ATT.results.
    ok((await text(p, '.tm-top h1')) === 'Results' && (await text(p, '#tmrsscore')).replace(/\s+/g, ' ') === `${R.got} / ${R.max} marks`,
       'Results shows the attempt\'s mark: ' + await text(p, '#tmrsscore') + ' vs ' + R.got + '/' + R.max);
    const cells = await p.$$eval('.tm-rs-cell', es => es.map(e => ({ k: e.dataset.tmrv, c: e.className, v: e.querySelector('.v').textContent })));
    ok(cells.length === R.items.length && cells.every((c, i) => c.k === R.items[i].key), 'one cell per answerable, in the attempt\'s order');
    ok(cells.every(c => { const x = R.items.find(y => y.key === c.k);
      return x.status === 'marked' ? / m$/.test(c.c) && /^\d+ \/ \d+$/.test(c.v) : x.status === 'not_marked' ? / nm$/.test(c.c) && c.v === 'Not marked' : / na$/.test(c.c) && c.v === 'Not answered'; }),
       'every cell holds its mark, or the words for why it has none, never a number');
    ok((await p.$eval('.tm-rs-cell[data-tmrv="0-0"] .v', e => e.textContent)) === '0 / 1', 'a marked 0 is a mark: Q1 reads 0 / 1');
    ok(/Reason at the time: The marker ran into a problem before it finished\./.test(await text(p, '#tmrg-nm')) && !/\bagain\b/i.test(await text(p, '#tmrg-nm')),
       'the not-marked list gives the cause, without the advice that was true while the attempt was open');
    ok(/Neither question was chosen\. It counted as one question\./.test(await text(p, '.tm-rs-map')), 'the either/or is once, never chosen');
    ok(/Question 11/.test(await text(p, '.tm-rs-pg')) && await p.$$eval('.tm-rs-pg', es => es.length) === 2, 'parent questions stay groups with their parts');
    const before = await raw(p);

    // Review each question opens the first answerable.
    await p.click('#tmrsreview'); await settled(p);
    ok(/^Question 1\b/.test(await qhead(p)) && await p.$eval('#tmrvprev', e => e.disabled), 'Review each question opens the first answerable, with nothing before it');
    ok(/Completed .* · read only/.test(await text(p, '.tm-rvclosed')), 'the shell says the attempt is closed and read only');
    await readOnly(p, 'Q1');
    await p.click('#tmrvback'); await settled(p);
    ok((await text(p, '.tm-top h1')) === 'Results', '← Results returns to Results');

    // A marked question (and the version that was marked).
    await cell(p, '1-0-0');
    ok(/^Question 11\(a\)/.test(await qhead(p)), 'the 11(a) cell opens exactly 11(a)');
    const box = await p.$eval('#tmrvans', e => ({ t: e.textContent, role: e.getAttribute('role'), ro: e.getAttribute('aria-readonly'), tag: e.tagName, label: document.getElementById(e.getAttribute('aria-labelledby')).textContent }));
    ok(box.t === graded && box.role === 'textbox' && box.ro === 'true' && box.tag === 'DIV', 'the box holds exactly the version that was marked, read only, not a form field: ' + JSON.stringify(box));
    ok(box.label === 'The version that was marked' && /2 of 2/.test(await text(p, '#sheet .tm-result')), 'labelled as the version that was marked, with its 2 of 2');
    const order = await p.evaluate(() => { const r = document.querySelector('#sheet .tm-result'), l = document.querySelector('#tmrvlater');
      return !!(r && l && (r.compareDocumentPosition(l) & Node.DOCUMENT_POSITION_FOLLOWING)); });
    ok(order && (await text(p, '#tmrvlater .tm-rvtext')) === later && /The change was never marked\. The mark above is for the version that was marked, not for this text\./.test(await text(p, '#tmrvlater')),
       'the later edit is apart, after the mark, and says the mark is not for it');
    ok(!(await text(p, '#tmrvans')).includes('later edit'), 'and never shares the box with the version that was marked');
    await readOnly(p, '11(a)');
    const seqi = R.seq.indexOf('1-0-0');
    ok((await p.$eval('#tmrvprev', e => e.dataset.tmrv)) === R.seq[seqi - 1] && (await p.$eval('#tmrvnext', e => e.dataset.tmrv)) === R.seq[seqi + 1], 'Previous and Next are its neighbours in the attempt');
    await p.click('#tmrvnext'); await settled(p);
    ok(/^Question 11\(b\)/.test(await qhead(p)) && /Not answered/.test(await text(p, '.tm-rvst')), 'Next is 11(b), not answered');
    await p.click('#tmrvback'); await settled(p);
    ok((await p.evaluate(() => document.activeElement && document.activeElement.dataset.tmrv)) === '1-0-1', 'and ← Results comes back to the cell for the item last reviewed');

    // A not-marked question.
    await cell(p, '1-1-0');
    ok(/^Question 12\(a\)/.test(await qhead(p)) && (await text(p, '#tmrvans')) === 'The gross profit ratio fell from 40% to 37%.', 'the 12(a) cell opens 12(a), its response visible');
    const nm = await text(p, '#sheet');
    ok(/Not marked/.test(nm) && /Reason at the time\s*The marker ran into a problem before it finished\./.test(nm) && /stays not marked/.test(nm) && !/\bagain\b|Wait a minute/.test(nm),
       'Not marked, the cause at the time, and no retry: ' + nm.slice(0, 160));
    await readOnly(p, '12(a)');

    // Not answered, with a draft that was never submitted.
    await p.click('#tmrvnav'); await settled(p);
    ok(/Back to Results/.test(await text(p, '#tmnavresults')) && /✓ marked/.test(await text(p, '.tm-legend')) && !/Review & submit/.test(await text(p, '.tm-navsheet')), 'the navigator is the closed attempt\'s');
    await p.$$eval('[data-tmrvnav]', es => es.find(e => e.dataset.tmrvnav === '1-0-3').click()); await settled(p);
    ok(/^Question 11\(d\)/.test(await qhead(p)) && !(await has(p, '#tmrvans')) && !(await has(p, '.tm-submitted')), 'the navigator opens 11(d): not answered, no answer shown as submitted');
    ok(!(await p.$eval('.tm-rvunsent', e => e.open)) && (await text(p, '.tm-rvunsent .tm-rvtext')) === unsent && /did not submit it/.test(await text(p, '.tm-rvunsent')),
       'the unsent draft is behind Show what you wrote, and says it was never submitted');
    ok(!/Marked against/.test(await text(p, '#sheet')), 'with no feedback');

    // The either/or never chosen, the last item.
    await p.click('#tmrvnav'); await settled(p);
    await p.$$eval('[data-tmrvnav]', es => es.filter(e => e.dataset.tmrvnav === '3-0')[0].click()); await settled(p);
    ok(/Neither Question 15 nor Question 16 was chosen\./.test(await text(p, '#sheet')) && await p.$$eval('.tm-rvopts li', es => es.length) === 2 && !(await has(p, '.tm-rvopts button')),
       'the either/or: neither was chosen, and both questions are plain text, not choices');
    ok(await has(p, '#tmrvdone') && !(await has(p, '#tmrvnext')), 'the last item offers Back to Results instead of Next');
    await readOnly(p, 'Q15 or Q16');
    ok((await raw(p)) === before, 'nothing in Results or Review wrote to storage');
    await p.click('#tmrvdone'); await settled(p);

    // Start new attempt.
    ok((await text(p, '#tmrsagain')) === 'Start new attempt', 'Results offers Start new attempt');
    await p.click('#tmrsagain'); await settled(p);
    ok((await text(p, '#exampickgo')) === 'Start new attempt' && /0 \/ 90|\d+ \/ 90/.test(await text(p, '.tm-lastline')), 'it opens setup, with the last attempt kept beside it');
    await p.click('#exampickgo'); await settled(p);
    const after = (await stored(p))[PAPERKEY];
    ok(after.current && after.last && after.last.completedAt === rec.last.completedAt, 'a new attempt starts; the completed one is kept unchanged');
    ok(!errs.length && !dialogs.length, 'no page errors and no dialogs ' + JSON.stringify(errs.concat(dialogs)));
    await ctx.close();
  }

  console.log('--- 2. Nothing marked, and a real 0; an extended response in Review');
  {
    const { p, ctx, mode, errs } = await open(b);
    mode.reply = () => ({ status: 503, body: {} });
    await sit(p, '', null);
    await navTo(p, '12(a)');
    await submit(p, 'The gross profit ratio fell.');
    await review(p); await p.click('#tmsubmitpaper'); await settled(p);
    ok((await text(p, '#tmrsscore')) === 'Nothing marked' && /Nothing in this attempt was marked, so it has no mark\. It was out of 90 marks\./.test(await text(p, '.tm-rs-sum')),
       'Results: nothing marked, never 0 / 90');
    ok(/Nothing marked/.test(await text(p, '.tm-tally tfoot')) && /Nothing marked/.test(await text(p, '.tm-rs-map')), 'and the total row and the section say so too');
    await p.click('#tmrsreview'); await settled(p);
    ok(/Nothing marked/.test(await text(p, '.tm-rv .tm-prog')), 'Review\'s bar says Nothing marked');
    await p.click('#tmrvback'); await settled(p);
    await p.click('#tmback'); await settled(p);
    ok((await text(p, '.tm-paper .tm-score')) === 'Nothing marked', 'the library card: Nothing marked');
    await p.click('.tm-paper [data-tmopen].tm-btn'); await settled(p);
    ok(/^Nothing marked/.test(await text(p, '.tm-lastline')), 'Page 3\'s last attempt: Nothing marked');
    await p.click('#exampickgo'); await settled(p);
    mode.reply = () => ER(14, 20);
    await p.click('.choice'); await p.click('#check'); await settled(p);             // Q1 wrong: a real 0
    await navTo(p, '15');
    if (await has(p, '[data-examchoose="0"]')) { await p.click('[data-examchoose="0"]'); await settled(p); }
    const essay = 'Northline set out to grow its share among younger buyers.\n\nIts short video campaign reached them at a lower cost per view, and the share rose.';
    await submit(p, essay);
    await review(p);
    ok(/^Nothing marked/.test(await text(p, '.tm-rlast .tm-lastline')), 'Submit\'s last-result strip: Nothing marked');
    await p.click('#tmsubmitpaper'); await settled(p);
    const R = await resultsOf(p);
    ok(R.marked === 2 && R.got === 14 && (await p.$eval('.tm-rs-cell[data-tmrv="0-0"] .v', e => e.textContent)) === '0 / 1', 'a real 0 is shown as 0 / 1 beside the other mark');
    await cell(p, '3-0');
    ok(/^Question 15/.test(await qhead(p)) && !(await p.$eval('details.tm-submitted', e => e.open)), 'the extended response opens with its submitted response collapsed');
    const top = await p.evaluate(() => ({ r: document.querySelector('#sheet .tm-result').getBoundingClientRect().bottom, m: (document.querySelector('#sheet .tm-mnote') || { getBoundingClientRect: () => ({ bottom: 9999 }) }).getBoundingClientRect().bottom }));
    ok(top.r < 900 && top.m < 900 && /14 of 20/.test(await text(p, '#sheet .tm-result')) && /How this was marked/.test(await text(p, '#sheet')), 'its mark and feedback are above the fold at 1280×900: ' + JSON.stringify(top));
    await p.click('details.tm-submitted summary'); await settled(p);
    ok((await p.$$eval('details.tm-submitted .response p', es => es.map(e => e.textContent).join('\n\n'))) === essay, 'opened, it shows exactly the submitted text');
    await readOnly(p, 'Q15');
    await p.click('#tmrvback'); await settled(p); await p.click('#tmback'); await settled(p);
    ok((await text(p, '.tm-paper .tm-score')).replace(/\s+/g, ' ') === '14 / 90', 'and the library card shows the real total: ' + await text(p, '.tm-paper .tm-score'));
    ok(!errs.length, 'no page errors ' + JSON.stringify(errs));
    await ctx.close();
  }

  console.log('--- 3. a finished practice session stays reachable from its question type');
  {
    const { p, ctx, mode, errs } = await open(b);
    mode.reply = () => REVIEW(2, 2);
    await toTest(p);
    await p.click('[data-tmtype="short_answer"]'); await settled(p);
    await p.click('#tmtypego'); await settled(p);
    await submit(p, 'Speed. Customers wait too long at the vans.');
    await review(p); await p.click('#tmsubmitpaper'); await settled(p);
    const TK = 'type:short_answer', R = await resultsOf(p, TK);
    ok((await text(p, '.tm-top .tm-kicker')) === 'Short answer practice' && (await text(p, '#tmrsscore')).startsWith(R.got + ' / ' + R.max), 'Finish practice opens the session\'s Results');
    ok((await text(p, '#tmrsagain')) === 'Start practice', 'with Start practice');
    await p.click('#tmback'); await settled(p);
    const tile = () => p.evaluate(() => { const b = document.querySelector('[data-tmtype="short_answer"]'); return b.closest('.tm-tile').textContent.replace(/\s+/g, ' ').trim(); });
    ok(new RegExp('Last completed · ' + R.got + ' / ' + R.max + ' · View results').test(await tile()), 'the tile says Last completed with its mark: ' + await tile());
    await p.click('[data-tmtyperesults="short_answer"]'); await settled(p);
    ok((await text(p, '.tm-top .tm-kicker')) === 'Short answer practice' && (await text(p, '.tm-top h1')) === 'Results', 'View results opens it');
    await p.click('#tmrsagain'); await settled(p);
    ok(/Last completed/.test(await text(p, '.tm-last')) && (await text(p, '#tmtypego')) === 'Start practice', 'the overview keeps the last result beside Start practice');
    await p.click('#tmtypego'); await settled(p);
    await p.click('#examquit'); await settled(p);
    ok(/Resume practice/.test(await text(p, '[data-tmtype="short_answer"]')) && /Last completed · /.test(await tile()), 'with a new session in progress, Resume practice is the action and the last result stays');
    await p.click('[data-tmtypeopen="short_answer"]'); await settled(p);
    ok((await text(p, '#tmresume')) === 'Resume practice' && /Finishing the session in progress replaces this result/.test(await text(p, '.tm-last')), 'the overview: Resume practice, and the last result kept apart');
    await p.click('#tmlastresults'); await settled(p);
    const stored2 = (await stored(p))[TK];
    ok((await text(p, '#tmrsscore')).startsWith(R.got + ' / ' + R.max) && stored2.current && stored2.last && (await text(p, '#tmrsresume')) === 'Resume practice' && !(await has(p, '#tmrsagain')),
       'its Results are the completed session, not the one in progress, which it offers to resume');
    ok(!errs.length, 'no page errors ' + JSON.stringify(errs));
    await ctx.close();
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail ? 1 : 0);
})();
