// VOCABULARY v1 — THE CONTRACT.
//
// The tool used to render 405 term strings that live beside the subject's points,
// as chips, with no meaning attached to any of them. A student could not tell a
// term the app was teaching from a word somebody typed next to a heading, and
// neither could the app. Two rules replace it, and this suite is those rules:
//
//   nothing is found by scanning prose — a term appears because something NAMED it;
//   nothing without a meaning is displayed, and a partial record has no meaning.
//
// Nothing in the panel writes into a sentence. There is no control that could, and
// that is asserted rather than assumed.
const { chromium, T, usePractice } = require('./env');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };
const rf = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

// Fixtures. Nothing is authored in the app yet and nothing may be invented there,
// so every populated state is driven from here.
const SEED = () => {
  window.ESSAY.vocab.records = {
    'fix.good': { id: 'fix.good', term: 'market segmentation',
      plain: 'splitting a large group of people into smaller groups that are alike in some way',
      subject: 'dividing a total market into subgroups so that a business can choose which of them to serve',
      example: 'The business segments by age, then sells only to the youngest of those groups.' },
    'fix.second': { id: 'fix.second', term: 'positioning',
      plain: 'where something sits compared with the things around it',
      subject: 'the place a product holds in the mind of the target market, relative to competing products',
      example: 'Its higher price positions it above the supermarket brands rather than beside them.' },
    // deliberately incomplete: a term with no meaning is the thing this prevents
    'fix.partial': { id: 'fix.partial', term: 'psychographic', plain: '', subject: '', example: '' },
  };
  const qs = [];
  Object.keys(window.ESSAY.subjects).forEach(k =>
    (window.ESSAY.subjects[k].questions || []).forEach(q => qs.push(q)));
  const q = qs.find(x => x.id === 'mkt-01');
  q.vocabRefs = [{ id: 'fix.second', role: 'topic-context' },
                 { id: 'fix.partial', role: 'topic-context' },   // incomplete
                 { id: 'fix.absent', role: 'topic-context' }];   // no record at all
  q.pathways[0].vocabRefs = [{ id: 'fix.good', role: 'relationship-support' }];
  q.pathways[1].vocabRefs = [];                                   // authored as having none
};

async function enter(p, opts) {
  await p.goto(T); await p.waitForSelector('.navtab', { timeout: 8000 });
  await p.evaluate(() => localStorage.removeItem('marginal.essay.v1'));
  await p.goto(T); await p.waitForSelector('.navtab', { timeout: 8000 });
  if (opts && opts.seed) await p.evaluate(opts.seed);
  await p.$$eval('.navtab', es => { const t = es.find(x => /Essay practice/i.test(x.textContent)); t && t.click(); });
  await p.waitForSelector('#essubject', { timeout: 8000 });
  await p.selectOption('#essubject', 'business_studies');
  await usePractice(p);
  await p.evaluate(() => { const t = [...document.querySelectorAll('.qp-row')].find(x => /target markets/i.test(x.textContent)); t && t.click(); });
  await p.click('#esstart');
  await p.waitForFunction(() => !!document.querySelector('#esline, .es-startrow'), null, { timeout: 8000 });
  await p.evaluate(() => { const t = [...document.querySelectorAll('.es-startrow')].find(x => /Body 1/.test(x.textContent)); t && t.click(); });
  await rf(p);
  const path = await p.$('[data-espath]'); if (path) { await path.click(); await rf(p); }
  const go = await p.$('#esstartwriting'); if (go) { await go.click(); await rf(p); }
  return !!(await p.$('#esline'));
}
// Present on the belt at all, and if so whether it is live. A disabled control is
// still the app showing a student an unfinished piece of itself, so with nothing
// resolved the answer has to be "not there".
const beltVocab = p => p.evaluate(() => {
  const b = document.querySelector('.es-belt [data-estool="vocabulary"]');
  return { present: !!b, off: !!(b && b.disabled) };
});
async function openVocab(p) {
  const b = await p.$('[data-estool="vocabulary"]');
  if (!b || await b.evaluate(e => e.disabled)) return false;
  await b.click(); await rf(p); return true;
}
const drawer = p => p.$eval('.es-drawer-body', e => e.innerText.replace(/\s+/g, ' ').trim()).catch(() => '');

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1050 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));

  // ==========================================================================
  console.log('1. with nothing defined, the student is not shown the tool at all');
  // ==========================================================================
  // The application knows the gap. The student is not asked to read about our
  // authoring backlog, and cannot navigate into a panel whose only content is an
  // apology for itself.
  ok(await enter(p), 'the writing screen is reachable');
  const cold = await beltVocab(p);
  ok(!cold.present, 'the vocabulary control is absent from the belt, not disabled on it: ' + JSON.stringify(cold));
  const belt = await p.$$eval('.es-belt-b', es => es.map(e => e.textContent.trim()));
  console.log('    belt:', JSON.stringify(belt));
  ok(belt.length >= 3, 'the other tools are unaffected: ' + JSON.stringify(belt));

  // and every other way in is closed too, or the belt would be hiding a door that
  // is still open somewhere else
  const other = await p.$('[data-estool="structure"]:not([disabled])');
  if (other) {
    await other.click(); await rf(p);
    const tab = await p.$('.es-drawer-tab[data-estool="vocabulary"]');
    ok(!tab, 'the tool window offers no vocabulary tab either');
    await p.keyboard.press('Escape'); await rf(p);
  }
  {
    const st = await p.$('#esstuck');
    if (st) {
      await st.click(); await rf(p);
      const row = await p.$eval('[data-esstuck="words"]', e => ({
        off: e.disabled, sub: (e.querySelector('.es-stuck-rs') || {}).textContent.trim() })).catch(() => null);
      console.log('    stuck menu words row:', JSON.stringify(row));
      ok(row && row.off, 'the stuck helper cannot walk into it either: ' + JSON.stringify(row));
      ok(row && /no term here has a written meaning/i.test(row.sub),
        'and says why, in the one place a student asked for help: ' + JSON.stringify(row && row.sub));
      await p.keyboard.press('Escape'); await rf(p);
    }
  }

  // ==========================================================================
  console.log('2. the legacy term arrays stay in the data and reach no student');
  // ==========================================================================
  {
    // points[].terms is 477 strings sitting beside the syllabus content, none of
    // which has a meaning written anywhere. They are not deleted: topic matching
    // and the learning allowlist still read them, and deleting them would be a
    // content migration rather than the compatibility cleanup this is. What is
    // removed is their route to a student. Two surfaces used to have one, and both
    // are checked here, because Vocabulary v1 closed the first and left the second
    // open for a whole release.
    //
    // How the leak is detected matters. Not "the old class is absent" — nothing
    // emits it, so that assertion could not fail. And not "no term string appears
    // in the text" either: these strings are ordinary Business Studies words, so
    // "physical evidence" is in the question stem, "marketing" is a topic tag, and
    // several syllabus point headings ARE term strings. A scan like that reports
    // leaks that are not leaks. What a chip was, and what prose is not, is an
    // element whose ENTIRE text is the term and nothing else. So: for each point
    // on screen, take that point's own terms[], and require that no element inside
    // it renders one of them on its own.

    // --- the writing tool, where Vocabulary v1 already closed it ---
    const pairing = await p.evaluate(() => {
      let n = 0;
      Object.keys(window.BUSCONTENT.topics || {}).forEach(t =>
        (window.BUSCONTENT.topics[t].sections || []).forEach(s =>
          (s.points || []).forEach(x => { n += (x.terms || []).length; })));
      return { termsInContent: n,
               toolOffered: !!document.querySelector('.es-belt [data-estool="vocabulary"]'),
               rows: document.querySelectorAll('.es-vocab').length };
    });
    console.log('    pairing:', JSON.stringify(pairing));
    ok(pairing.termsInContent > 100, 'the content is still full of term strings: ' + pairing.termsInContent);
    ok(!pairing.toolOffered && pairing.rows === 0,
      'and not one of them reaches the student through the writing tool: ' + JSON.stringify(pairing));

    // --- the full attempt screen, where it stayed open ---
    // Same student, one control away. esHintHTML renders the syllabus points here
    // and used to end each one with its terms as chips.
    await p.click('#esmodeswitch');
    await p.waitForSelector('#esfull', { timeout: 8000 });
    ok(!!(await p.$('#esfull')), 'the full attempt screen is reachable from the composer');
    const fab = await p.$('#eshintfab');
    ok(!!fab, 'the study hints panel is on it');
    if (fab) {
      await fab.click(); await rf(p);
      // Collapsed <details> keep their content in the DOM but the panel is a
      // student-facing surface either way: opened, so the check is about what is
      // rendered rather than about what is currently scrolled into view.
      await p.evaluate(() => document.querySelectorAll('.es-hintsec').forEach(d => { d.open = true; }));
      await rf(p);
      const scan = await p.evaluate(() => {
        const norm = s => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
        const byPoint = {};
        Object.keys(window.BUSCONTENT.topics || {}).forEach(t =>
          (window.BUSCONTENT.topics[t].sections || []).forEach(s =>
            (s.points || []).forEach(x => { byPoint[norm(x.point)] = (x.terms || []).map(norm); })));
        const leaks = []; let pointsWithTerms = 0, termsOnThisScreen = 0;
        document.querySelectorAll('.es-hintpt').forEach(pt => {
          // The heading IS pt.point, and a few syllabus points are named the same
          // as one of their own terms ("promotion", "e-marketing"). A heading is
          // the authored name of a section of content, not a term presented to be
          // learned, so it is excluded by identity rather than by string.
          const head = norm((pt.querySelector('.es-hintpth') || {}).textContent);
          const terms = byPoint[head] || [];
          if (terms.length) { pointsWithTerms++; termsOnThisScreen += terms.length; }
          pt.querySelectorAll('*').forEach(el => {
            if (el.classList.contains('es-hintpth')) return;
            const t = norm(el.textContent);
            if (t && terms.indexOf(t) >= 0) leaks.push({ point: head, cls: el.className, text: t });
          });
        });
        return { points: document.querySelectorAll('.es-hintpt').length,
                 pointsWithTerms: pointsWithTerms, termsOnThisScreen: termsOnThisScreen,
                 leaks: leaks.slice(0, 12), leakCount: leaks.length,
                 oldChips: document.querySelectorAll('.es-hintterm').length };
      });
      console.log('    full attempt know panel:', JSON.stringify(scan));
      ok(scan.points > 0, 'the panel is rendering syllabus points: ' + scan.points);
      ok(scan.pointsWithTerms === scan.points,
        'every point on this screen still carries a legacy terms[] array: ' +
        scan.pointsWithTerms + ' of ' + scan.points);
      ok(scan.termsOnThisScreen > 50,
        'and there are plenty of them to leak: ' + scan.termsOnThisScreen);
      ok(scan.leakCount === 0,
        'not one is rendered as a term on its own: ' + JSON.stringify(scan.leaks));
      ok(scan.oldChips === 0, 'and the chip class emits nowhere: ' + scan.oldChips);
    }
  }

  // ==========================================================================
  console.log('2b. the same string DOES reach a student when something names it');
  // ==========================================================================
  {
    // The two halves of the rule need the same word or they are two rules. This
    // one is legacy content on the screen just checked, so section 3 below, which
    // seeds a complete record for it and refs it by id, is the "unless explicitly
    // referenced to a valid definition" clause rather than an unrelated fixture.
    const legacy = await p.evaluate(() => {
      const hits = [];
      Object.keys(window.BUSCONTENT.topics || {}).forEach(t =>
        (window.BUSCONTENT.topics[t].sections || []).forEach(s =>
          (s.points || []).forEach(x =>
            (x.terms || []).forEach(v => {
              if (String(v).trim().toLowerCase() === 'market segmentation') hits.push(t + '/' + x.point);
            }))));
      return hits;
    });
    console.log('    market segmentation as legacy content:', JSON.stringify(legacy));
    ok(legacy.length > 0,
      'the term section 3 defines is one of the legacy strings: ' + JSON.stringify(legacy));
    ok(!!legacy.find(h => /^marketing\//.test(h)),
      'and it is legacy content on the topic just scanned: ' + JSON.stringify(legacy));
  }

  // ==========================================================================
  console.log('3. a defined term appears, and only a complete one');
  // ==========================================================================
  ok(await enter(p, { seed: SEED }), 'reopened with fixture records');
  const warm = await beltVocab(p);
  ok(warm.present && !warm.off, 'the tool appears once something has a meaning: ' + JSON.stringify(warm));
  ok(await openVocab(p), 'and it opens');
  const shown = await p.$$eval('.es-vocab', es => es.map(e => ({
    term: (e.querySelector('.es-vocabterm') || {}).textContent.trim(),
    lines: e.querySelectorAll('.es-vocabline').length,
    example: !!e.querySelector('.es-vocabex'),
  })));
  console.log('    shown:', JSON.stringify(shown));
  const terms = shown.map(x => x.term);
  ok(terms.indexOf('market segmentation') >= 0, 'the pathway\'s term is there: ' + JSON.stringify(terms));
  ok(terms.indexOf('positioning') >= 0, 'the question\'s term is there: ' + JSON.stringify(terms));
  ok(terms.indexOf('psychographic') < 0, 'the INCOMPLETE record never becomes a row: ' + JSON.stringify(terms));
  ok(shown.length === 2, 'and the ref naming no record at all does not either: ' + shown.length);
  ok(shown.every(x => x.lines === 2 && x.example),
    'every term shown carries both meanings and an example: ' + JSON.stringify(shown));

  // ==========================================================================
  console.log('4. terms are grouped by what they are for');
  // ==========================================================================
  {
    const groups = await p.$$eval('.es-drawer-block', es => es.map(e => ({
      label: (e.querySelector('.es-drawer-sub') || {}).textContent.trim(),
      terms: [...e.querySelectorAll('.es-vocabterm')].map(x => x.textContent.trim()),
    })));
    console.log('    groups:', JSON.stringify(groups));
    ok(groups.length === 2, 'the two roles are separate blocks: ' + groups.length);
    const rel = groups.find(g => /relationship/i.test(g.label));
    ok(rel && rel.terms.indexOf('market segmentation') >= 0,
      'the argument\'s term sits under the relationship role: ' + JSON.stringify(rel));
    const roles = await p.evaluate(() => (window.ESSAY.vocab.roles || []).map(r => r.id));
    ok(JSON.stringify(roles) === JSON.stringify(['relationship-support', 'strategy-example', 'outcome-evidence', 'topic-context']),
      'the roles are the four agreed ones: ' + JSON.stringify(roles));
  }

  // ==========================================================================
  console.log('5. nothing here can be put into a sentence');
  // ==========================================================================
  {
    const before = await p.$eval('#esline', e => e.value).catch(() => null);
    const controls = await p.$$eval('.es-drawer-body button, .es-drawer-body [role="button"]',
      es => es.map(e => (e.textContent || '').replace(/\s+/g, ' ').trim()));
    console.log('    controls inside the panel:', JSON.stringify(controls));
    const inserty = controls.filter(t => /insert|add to|use this|paste|copy into|put in/i.test(t));
    ok(inserty.length === 0, 'no control offers to write a term into the sentence: ' + JSON.stringify(inserty));
    for (const sel of ['.es-vocab', '.es-vocabterm', '.es-vocabex']) {
      const el = await p.$(sel); if (el) { await el.click().catch(() => {}); await rf(p); }
    }
    const after = await p.$eval('#esline', e => e.value).catch(() => null);
    ok(after === before, 'and pressing the term itself writes nothing: ' + JSON.stringify([before, after]));
  }

  // ==========================================================================
  console.log('6. an argument authored as having none is honoured');
  // ==========================================================================
  {
    // pathways[1] carries an empty vocabRefs: that is an authored decision, and the
    // question's own refs still apply, so the tool is not empty, only narrower.
    await p.keyboard.press('Escape').catch(() => {});
    const changed = await p.evaluate(() => {
      const b = document.querySelector('[data-esrestchange="argument"]'); if (b) { b.click(); return true; } return false; });
    if (changed) {
      await rf(p);
      const picked = await p.$$eval('[data-espath]', es => { if (es[1]) { es[1].click(); return true; } return false; });
      await rf(p);
      const go = await p.$('#esstartwriting'); if (go) { await go.click(); await rf(p); }
      if (picked && await openVocab(p)) {
        const t2 = await p.$$eval('.es-vocabterm', es => es.map(e => e.textContent.trim()));
        console.log('    after switching argument:', JSON.stringify(t2));
        ok(t2.indexOf('market segmentation') < 0, 'the other argument\'s term is not carried over: ' + JSON.stringify(t2));
        ok(t2.indexOf('positioning') >= 0, 'and the question\'s own term still applies: ' + JSON.stringify(t2));
      } else { console.log('    (could not switch argument; skipped)'); }
    } else { console.log('    (no argument control on screen; skipped)'); }
  }

  // ==========================================================================
  console.log('6b. an unrecognised role loses neither the term nor the guarantee');
  // ==========================================================================
  // Two failures in one, both found by probing rather than by reading: the tool
  // appeared with an empty panel, and a record that WAS complete vanished because
  // its ref named a role that is not one of the four. A defined term the student
  // never sees is undefined vocabulary's mirror image.
  {
    ok(await enter(p, { seed: () => {
      window.ESSAY.vocab.records = { 'x.one': { id: 'x.one', term: 'market segmentation',
        plain: 'splitting a group into smaller alike groups', subject: 'dividing a market into subgroups',
        example: 'The business segments by age.' } };
      const qs = []; Object.keys(window.ESSAY.subjects).forEach(k =>
        (window.ESSAY.subjects[k].questions || []).forEach(q => qs.push(q)));
      const q = qs.find(x => x.id === 'mkt-01');
      q.vocabRefs = [{ id: 'x.one', role: 'not-a-real-role' }];
      q.pathways.forEach(pa => { pa.vocabRefs = []; });
    } }), 'reopened with a ref naming a role that does not exist');
    const b2 = await beltVocab(p);
    ok(b2.present && !b2.off, 'the tool is offered, because a complete record did resolve: ' + JSON.stringify(b2));
    ok(await openVocab(p), 'it opens');
    const rows = await p.$$eval('.es-vocabterm', es => es.map(e => e.textContent.trim()));
    ok(rows.length === 1, 'the record survives the bad role rather than being dropped: ' + JSON.stringify(rows));
    const grp = await p.$$eval('.es-drawer-sub', es => es.map(e => e.textContent.trim()));
    ok(grp.length === 1 && /background for this topic/i.test(grp[0]),
      'it falls back to the neutral bucket: ' + JSON.stringify(grp));
    await p.keyboard.press('Escape').catch(() => {}); await rf(p);
  }
  // the inverse: refs that resolve but produce no group must not offer the tool
  {
    ok(await enter(p, { seed: () => {
      window.ESSAY.vocab.records = { 'x.two': { id: 'x.two', term: 't', plain: 'p', subject: 's', example: 'e' } };
      window.ESSAY.vocab.roles = [];              // no bucket can match
      const qs = []; Object.keys(window.ESSAY.subjects).forEach(k =>
        (window.ESSAY.subjects[k].questions || []).forEach(q => qs.push(q)));
      const q = qs.find(x => x.id === 'mkt-01');
      q.vocabRefs = [{ id: 'x.two', role: 'topic-context' }];
      q.pathways.forEach(pa => { pa.vocabRefs = []; });
    } }), 'reopened with no bucket a term could land in');
    const b3 = await beltVocab(p);
    ok(!b3.present, 'a panel that would render nothing does not offer the tool: ' + JSON.stringify(b3));
  }

  // ==========================================================================
  console.log('7. the gap is visible to us, and only to us');
  // ==========================================================================
  {
    // Back to the cold page. enter() reloads, which resets window.ESSAY, so the
    // fixtures seeded above are gone and the store is empty again. That is the state
    // this section is about: with records defined the word SHOULD be on screen, and
    // asserting its absence then would be asserting a bug.
    ok(await enter(p), 'reopened with nothing defined');
    // Scoped to the essay page. The flashcards app underneath carries its own
    // "Coming soon" chips, and a whole-document scan was measuring those rather
    // than anything this change is responsible for.
    const seen = await p.$eval('.es-scrim', e => e.innerText).catch(() => '');
    ok(seen.length > 100, 'the essay page has text to scan: ' + seen.length);
    ok(!/vocab/i.test(seen), 'the word vocabulary is not on screen at all when none resolves: ' +
      JSON.stringify((seen.match(/.{0,40}vocab.{0,40}/i) || [''])[0]));
    ok(!/no vocabulary has been given a meaning|nothing has been written for this question/i.test(seen),
      'and no panel is telling the student the content is unfinished');
    // The drawer guard is the hunk no student route reaches, because the belt and
    // the tabs hide the tool before the window is ever asked to render it. What is
    // worth asserting is the absence it produces, not the presence of copy that is
    // now dead: the vocabulary empty state was removed with it.
    const other2 = await p.$('[data-estool="structure"]:not([disabled])');
    if (other2) {
      await other2.click(); await rf(p);
      const st2 = await p.evaluate(() => ({
        vocabTab: !!document.querySelector('.es-drawer-tab[data-estool="vocabulary"]'),
        drawers: document.querySelectorAll('.es-drawer').length }));
      console.log('    tool window:', JSON.stringify(st2));
      ok(!st2.vocabTab, 'the window offers no vocabulary tab to switch to');
      ok(st2.drawers === 1, 'and exactly one tool window is open: ' + st2.drawers);
      await p.keyboard.press('Escape').catch(() => {}); await rf(p);
    }
  }

  console.log('pageerrors:', errs.length ? errs : 'none');
  ok(errs.length === 0, 'no page errors');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
