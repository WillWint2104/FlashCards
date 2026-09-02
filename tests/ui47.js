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
  await p.evaluate(() => { const t = [...document.querySelectorAll('.es-qrow')].find(x => /target markets/i.test(x.textContent)); t && t.click(); });
  await p.click('#esstart');
  await p.waitForFunction(() => !!document.querySelector('#esline, .es-startrow'), null, { timeout: 8000 });
  await p.evaluate(() => { const t = [...document.querySelectorAll('.es-startrow')].find(x => /Body 1/.test(x.textContent)); t && t.click(); });
  await rf(p);
  const path = await p.$('[data-espath]'); if (path) { await path.click(); await rf(p); }
  const go = await p.$('#esstartwriting'); if (go) { await go.click(); await rf(p); }
  return !!(await p.$('#esline'));
}
const beltVocab = p => p.$eval('[data-estool="vocabulary"]', e => ({ off: e.disabled }));
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
  console.log('1. with nothing defined, nothing is offered, and it says which empty this is');
  // ==========================================================================
  ok(await enter(p), 'the writing screen is reachable');
  const cold = await beltVocab(p);
  ok(cold.off, 'the vocabulary tool is disabled rather than filled: ' + JSON.stringify(cold));
  // the tab still exists in the tool window, so the tool is reachable to be told why
  const other = await p.$('[data-estool="structure"]:not([disabled])');
  if (other) {
    await other.click(); await rf(p);
    const tab = await p.$('.es-drawer-tab[data-estool="vocabulary"]');
    ok(!!tab, 'the vocabulary tab is still in the tool window');
    if (tab) {
      await tab.click(); await rf(p);
      const t = await drawer(p);
      console.log('    empty state:', JSON.stringify(t.slice(0, 120)));
      ok(/no vocabulary has been given a meaning/i.test(t),
        'and it says no meaning has been written yet, not that the question has no terminology');
      ok(!/\bpsychographic\b|\bpositioning\b|\bbrand loyalty\b/i.test(t),
        'no undefined term is listed as a consolation: ' + JSON.stringify(t.slice(0, 160)));
    }
    await p.keyboard.press('Escape'); await rf(p);
  }

  // ==========================================================================
  console.log('2. the 405 undefined terms are gone from the student route');
  // ==========================================================================
  {
    const strays = await p.evaluate(() => document.querySelectorAll('.es-term').length);
    ok(strays === 0, 'no bare term chip is rendered anywhere: ' + strays);
    const inContent = await p.evaluate(() => {
      let n = 0;
      Object.keys(window.BUSCONTENT.topics || {}).forEach(t =>
        (window.BUSCONTENT.topics[t].sections || []).forEach(s =>
          (s.points || []).forEach(x => { n += (x.terms || []).length; })));
      return n;
    });
    ok(inContent > 100, 'the term strings are still in the content, unused by this tool: ' + inContent);
  }

  // ==========================================================================
  console.log('3. a defined term appears, and only a complete one');
  // ==========================================================================
  ok(await enter(p, { seed: SEED }), 'reopened with fixture records');
  const warm = await beltVocab(p);
  ok(!warm.off, 'the tool wakes up once something has a meaning: ' + JSON.stringify(warm));
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

  console.log('pageerrors:', errs.length ? errs : 'none');
  ok(errs.length === 0, 'no page errors');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
