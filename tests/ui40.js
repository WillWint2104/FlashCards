// EVERY QUESTION REACHES THE SAME SHELL.
//
// ui39 proves the shell behaves once you are inside it. It does not prove you get
// there, and a manual walkthrough that opened two questions and saw the old modal
// is exactly the report this suite exists to answer with evidence rather than
// with one happy question.
//
// The invariant: content availability changes what appears INSIDE the page. It
// never changes which page. A question with no authored pathways is a page with a
// simpler inside, never a different shell.
const { chromium, T, usePractice , allRows, pageTo } = require('./env');

// Waits that name their condition. This app fetches nothing and renders
// synchronously, so the effect of a click is present on the next frame:
// settled() is that frame, not a shorter guess at a duration.
const settled = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const here = (p, sel) => p.waitForSelector(sel, { timeout: 8000 });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };

// The old shell was a translucent scrim behind a rounded, shadowed, animated card.
// Any of those three is enough to say the legacy modal is back.
const shellOf = p => p.evaluate(() => {
  const scrim = document.querySelector('.es-scrim'), wrap = document.querySelector('.es-wrap');
  if (!scrim || !wrap) return { present: false };
  const cs = getComputedStyle(scrim), cw = getComputedStyle(wrap);
  return {
    present: true,
    translucent: /rgba\([^)]*0?\.\d+\)/.test(cs.backgroundColor),
    radius: Math.round(parseFloat(cw.borderRadius) || 0),
    shadow: cw.boxShadow !== 'none',
    centred: cs.display === 'flex' && /center/.test(cs.justifyContent || ''),
    question: (document.querySelector('.es-qtext, .es-stem, .es-qhead') || {}).textContent || '',
    composer: !!document.querySelector('#esline'),
    startrows: document.querySelectorAll('.es-startrow').length,
    head: !!document.querySelector('.es-top')
  };
});

async function toPicker(p, subject) {
  await p.goto(T); await p.waitForSelector('.navtab', { timeout: 8000 });
  await p.evaluate(() => localStorage.removeItem('marginal.essay.v1'));
  await p.goto(T); await p.waitForSelector('.navtab', { timeout: 8000 });
  const tab = await p.evaluate(() => {
    const t = [...document.querySelectorAll('.navtab')].find(x => /Essay practice/i.test(x.textContent));
    if (t) { t.click(); return true; } return false;
  });
  if (!tab) return false;
  await p.waitForSelector('#essubject', { timeout: 8000 });
  await p.selectOption('#essubject', subject).catch(() => {});
  // The picker is ready when it has offered something, whichever mode it opens in.
  // Stage one offers the two routes; the list offers rows. Either means the
  // picker is ready.
  await p.waitForFunction(() => !!document.querySelector('.qp-row, [data-espick], [data-esmode]'), null, { timeout: 8000 });
  return true;
}

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.route(/workers\.dev/, r => r.abort());

  await p.goto(T); await p.waitForSelector('.navtab', { timeout: 8000 });
  const bank = await p.evaluate(() => {
    const s = (window.ESSAY && window.ESSAY.subjects) || {};
    const bs = (s.business_studies && s.business_studies.questions) || [];
    return bs.map(q => ({ id: q.id, text: String(q.text || '').slice(0, 40), paths: (q.pathways || []).length }));
  });
  // Fail closed: an empty bank would let every loop below pass by never running.
  ok(bank.length > 0, 'the Business Studies bank has questions in it: ' + bank.length);
  console.log('    active Business Studies questions:', bank.length,
    '| with authored pathways:', bank.filter(q => q.paths > 0).length);

  console.log('--- every active question enters the dedicated page ---');
  let opened = 0;
  for (const q of bank) {
    const ready = await toPicker(p, 'business_studies');
    if (!ready) { ok(false, q.id + ': the essay picker is reachable'); continue; }
    // Rows drop the directive they were filtered by, so their text is not the
    // question text. The id is on the element and is exact.
    await usePractice(p);
    // The list paginates at ten, so the question may be on a later page.
    await pageTo(p, '.qp-row[data-esq="' + q.id + '"]');
    const picked = await p.evaluate(id => {
      const c = [...document.querySelectorAll('.qp-row')].find(x => x.dataset.esq === id);
      if (c) { c.click(); return true; } return false;
    }, q.id);
    ok(picked, q.id + ': is offered in the picker');
    if (!picked) continue;
    const started = await p.evaluate(() => { const s = document.querySelector('#esstart'); if (s) { s.click(); return true; } return false; });
    ok(started, q.id + ': can be started');
    if (!started) continue;
    // The essay surface is up when one of its two valid opening states exists.
    await p.waitForFunction(() => !!document.querySelector('#esline, .es-startrow'), null, { timeout: 8000 }).catch(() => {});
    const sh = await shellOf(p);
    ok(sh.present, q.id + ': the essay surface mounted');
    if (!sh.present) continue;
    opened++;
    ok(!sh.translucent, q.id + ': not a dimmed scrim over another page');
    ok(sh.radius <= 4, q.id + ': not a rounded floating card: radius ' + sh.radius);
    ok(!sh.shadow, q.id + ': no drop shadow, which the old modal had');
    ok(!sh.centred, q.id + ': not centred as a dialog');
    ok(sh.head, q.id + ': the page header is present');
    // Pathways may change what is inside. They may not change which shell, and
    // they may not decide whether the question opens at all.
    ok(sh.composer || sh.startrows > 0,
      q.id + ': a valid initial state renders (' + (sh.composer ? 'composer' : sh.startrows + ' start rows') + ')');
  }
  ok(opened === bank.length, 'every question in the bank opened: ' + opened + ' of ' + bank.length);

  console.log('--- and a question with no authored pathways is not an exception ---');
  const bare = bank.filter(q => q.paths === 0), rich = bank.filter(q => q.paths > 0);
  ok(bare.length > 0, 'the bank contains questions with no pathways, so this means something: ' + bare.length);
  ok(rich.length > 0, 'and questions with them: ' + rich.length);
  // Both kinds were opened in the loop above and both were asserted against the
  // same shell. Stated here so the contract is legible rather than implied.
  ok(opened === bank.length, 'both kinds reached the same page shell');

  console.log('--- a chosen practice question carries its own topic ---');
  // The topic field the student used to type into is gone, so the question has to
  // supply it. This is the contract that replaced it.
  await toPicker(p, 'business_studies');
  await usePractice(p);
  await p.evaluate(() => { const row = document.querySelector('.qp-row'); row && row.click(); });
  await p.waitForFunction(() => !!document.querySelector('.qp-row.on'), null, { timeout: 8000 }).catch(() => {});
  // The requirement is that the whole question is stated back once, and it now
  // lives on the ROW rather than in a separate restatement below the list: the
  // rows carry the complete authored wording, so repeating it underneath said
  // the same thing twice. Same property, checked where it is.
  // Choosing a row now opens the question rather than starting it, so the
  // question is stated back on the preview. Same requirement, one screen along.
  const carried = await p.evaluate(() => {
    const q = document.querySelector('.qp-prevq');
    return { stated: q ? q.textContent.trim().length : 0, text: q ? q.textContent.trim() : '',
      hasStart: !!document.querySelector('#esstart'), typedField: !!document.querySelector('#estopic') };
  });
  ok(carried.stated > 20, 'the preview states the whole question: ' + carried.stated + ' chars');
  ok(/^[A-Z].*[.?]$/.test(carried.text),
    'as a complete question rather than a fragment: ' + JSON.stringify(carried.text.slice(0, 60)));
  ok(carried.hasStart, 'and offers one control that starts it');
  // ES lives inside the IIFE and cannot be read from a test, so the topic actually
  // reaching marking is asserted in ui2, where the payload is captured.
  ok(!carried.typedField, 'and nobody is asked to type a topic any more');

  console.log('--- Ancient History is legacy and stays out of the Business Studies picker ---');
  await toPicker(p, 'business_studies');
  await usePractice(p);
  // Across every page: the list paginates at ten and the bank is thirteen.
  const offered = (await allRows(p)).map(r => r.id + ' ' + r.q + ' ' + r.meta);
  ok(offered.length === bank.length, 'the picker offers exactly the Business Studies bank: ' + offered.length + ' against ' + bank.length);
  const leaked = offered.filter(t => /egypt|old kingdom|pharaoh|akhenaten|hatshepsut|rome|pompeii|spartan/i.test(t));
  ok(leaked.length === 0, 'no Ancient History question appears among them: ' + JSON.stringify(leaked.slice(0, 2)));

  console.log('\npageerrors:', errs.length ? errs.join(' | ') : 'none');
  ok(errs.length === 0, 'no page errors while opening every question');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail ? 1 : 0);
})();
