// STUDY RESOURCES.
//
// Learn used to open the Learning Centre. The Centre is out of the student route
// while it is rebuilt, and Learn now opens a floating window of reading the
// student's class actually has: links somebody authored, to material held
// somewhere the school already licenses.
//
// The failure this suite exists to catch is invention. A window that fills an
// empty section with something plausible, or relabels the question's reading as
// though it were about the argument the student chose, is worse than an empty
// window, because the student cannot tell the difference.
const { chromium, T, usePractice } = require('./env');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };
const rf = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const gone = (p, sel) => p.waitForFunction(s => !document.querySelector(s), sel, { timeout: 8000 });

// Fixture resources. Nothing is authored in the app yet and nothing may be
// invented there, so the populated states are driven from here.
const FIX = {
  'fix.q.one': { id: 'fix.q.one', label: 'Operations strategies', url: 'https://drive.google.com/file/d/FIXQ1/view', provider: 'Google Drive PDF' },
  'fix.q.two': { id: 'fix.q.two', label: 'Performance objectives', url: 'https://drive.google.com/file/d/FIXQ2/view', provider: 'Google Drive PDF' },
  'fix.a.one': { id: 'fix.a.one', label: 'Technology', url: 'https://drive.google.com/file/d/FIXA1/view', provider: 'Google Drive PDF' },
};

async function enter(p, opts) {
  await p.goto(T); await p.waitForSelector('.navtab', { timeout: 8000 });
  await p.evaluate(() => localStorage.removeItem('marginal.essay.v1'));
  await p.goto(T); await p.waitForSelector('.navtab', { timeout: 8000 });
  if (opts && opts.seed) await p.evaluate(opts.seed, opts.arg || null);
  await p.$$eval('.navtab', es => { const t = es.find(x => /Essay practice/i.test(x.textContent)); t && t.click(); });
  await p.waitForSelector('#essubject', { timeout: 8000 });
  await p.selectOption('#essubject', 'business_studies');
  await usePractice(p);
  await p.evaluate(() => { const t = [...document.querySelectorAll('.es-qrow')].find(x => /target markets/i.test(x.textContent)); t && t.click(); });
  await p.click('#esstart');
  await p.waitForFunction(() => !!document.querySelector('#esline, .es-startrow'), null, { timeout: 8000 });
  await p.evaluate(() => { const t = [...document.querySelectorAll('.es-startrow')].find(x => /Body 1/.test(x.textContent)); t && t.click(); });
  await rf(p);
}
const seedFn = fix => {
  window.ESSAY.resources = fix;
  const qs = [];
  Object.keys(window.ESSAY.subjects).forEach(k => (window.ESSAY.subjects[k].questions || []).forEach(q => qs.push(q)));
  const q = qs.find(x => x.id === 'mkt-01');
  q.studyRefs = ['fix.q.one', 'fix.q.two', 'fix.missing'];   // one ref that resolves to nothing
  q.pathways[0].studyRefs = ['fix.a.one'];
  q.pathways[1].studyRefs = [];                               // authored as having none
};

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));

  console.log('--- with nothing authored, it says nothing is authored ---');
  await enter(p);
  const learn = await p.$('[data-estool="understand"]');
  ok(!!learn, 'Learn is on the toolbelt');
  await learn.click(); await p.waitForSelector('.es-study', { timeout: 8000 }); await rf(p);
  const empty = await p.evaluate(() => ({
    rows: document.querySelectorAll('.es-stres').length,
    centre: document.querySelectorAll('.esl-panel').length,
    text: document.querySelector('.es-study').innerText.replace(/\s+/g, ' ').trim(),
  }));
  ok(empty.centre === 0, 'Learn does not open the Learning Centre: ' + empty.centre + ' panel(s)');
  ok(empty.rows === 0, 'no resource rows are shown: ' + empty.rows);
  ok(/no study resources have been added/i.test(empty.text), 'and it says so: ' + JSON.stringify(empty.text.slice(0, 70)));
  ok(!/for your argument/i.test(empty.text), 'with no argument section invented around nothing');

  console.log('--- with resources authored, before an argument is chosen ---');
  await enter(p, { seed: seedFn, arg: FIX });
  await p.evaluate(f => { window.ESSAY.resources = f; }, FIX);
  await (await p.$('[data-estool="understand"]')).click();
  await p.waitForSelector('.es-study', { timeout: 8000 }); await rf(p);
  const noArg = await p.evaluate(() => {
    const panel = document.querySelector('.es-study');
    return {
      rows: [...panel.querySelectorAll('.es-stres .es-stlabel')].map(e => e.textContent.trim()),
      text: panel.innerText.replace(/\s+/g, ' ').trim(),
      links: [...panel.querySelectorAll('.es-stopen')].map(a => ({ href: a.getAttribute('href'), t: a.getAttribute('target'), rel: a.getAttribute('rel') })),
    };
  });
  ok(noArg.rows.length === 2, 'exactly the two refs that resolve are shown: ' + noArg.rows.join(', '));
  // A ref pointing at nothing must not become a row. Showing it as a resource
  // the student cannot open is the invention this suite is about.
  ok(noArg.rows.indexOf('fix.missing') < 0, 'a reference that resolves to nothing is not shown as a resource');
  ok(/for this question/i.test(noArg.text), 'the question section is headed');
  ok(/choose an argument/i.test(noArg.text), 'and it says what would reveal reading for the argument');
  ok(!/for your argument/i.test(noArg.text), 'without heading a section it cannot fill');
  ok(noArg.links.length === 2 && noArg.links.every(l => l.t === '_blank' && /noopener/.test(l.rel || '') && /^https:/.test(l.href)),
    'every row opens its own link in a new tab: ' + JSON.stringify(noArg.links[0]));

  console.log('--- once an argument is chosen ---');
  await p.$$eval('.es-pick:not(.own)', es => es[0] && es[0].click()); await rf(p);
  const sw = await p.$('#esstartwriting'); if (sw) { await sw.click(); await p.waitForSelector('#esline', { timeout: 8000 }); }
  await rf(p);
  const withArg = await p.evaluate(() => {
    const panel = document.querySelector('.es-study');
    if (!panel) return null;
    const secs = [...panel.querySelectorAll('.es-stsec')].map(sec => ({
      head: (sec.querySelector('.es-sthd') || {}).textContent || '',
      rows: [...sec.querySelectorAll('.es-stlabel')].map(e => e.textContent.trim()),
    }));
    return { secs: secs, text: panel.innerText.replace(/\s+/g, ' ').trim() };
  });
  ok(!!withArg, 'the window survived choosing an argument, rather than closing');
  ok(withArg && withArg.secs.length === 2, 'it now has both sections: ' + (withArg && withArg.secs.length));
  ok(withArg && /for your argument/i.test(withArg.secs[1].head), 'the second names the argument: ' + JSON.stringify(withArg && withArg.secs[1].head));
  ok(withArg && withArg.secs[1].rows.length === 1 && withArg.secs[1].rows[0] === 'Technology',
    'and shows only what was authored against that pathway: ' + JSON.stringify(withArg && withArg.secs[1].rows));
  // The question's own reading must not be repeated under the argument heading.
  ok(withArg && withArg.secs[1].rows.indexOf('Operations strategies') < 0,
    'the question list is not borrowed to fill the argument section');

  console.log('--- an argument authored as having none says so ---');
  await p.evaluate(() => {
    const t = [...document.querySelectorAll('[data-esrestchange="argument"], .es-chip-more')].find(x => /change/i.test(x.textContent));
    if (t) t.click();
  });
  await rf(p);
  const second = await p.$$('.es-pick:not(.own)');
  if (second.length > 1) {
    await second[1].click(); await rf(p);
    const sw2 = await p.$('#esstartwriting'); if (sw2) { await sw2.click(); await p.waitForSelector('#esline', { timeout: 8000 }).catch(() => {}); }
    await rf(p);
    const none = await p.evaluate(() => {
      const panel = document.querySelector('.es-study'); if (!panel) return null;
      const secs = [...panel.querySelectorAll('.es-stsec')];
      const last = secs[secs.length - 1];
      return { head: (last.querySelector('.es-sthd') || {}).textContent || '', rows: last.querySelectorAll('.es-stres').length,
        text: last.innerText.replace(/\s+/g, ' ').trim() };
    });
    if (none && /for your argument/i.test(none.head)) {
      ok(none.rows === 0, 'an argument with nothing authored shows no rows: ' + none.rows);
      ok(/nothing has been added for this argument/i.test(none.text), 'and says so rather than borrowing: ' + JSON.stringify(none.text.slice(0, 80)));
    } else { console.log('    (the second argument did not take; skipping this pair)'); }
  }

  console.log('--- it is a floating peer, not part of the page ---');
  const geom = await p.evaluate(() => {
    const line = document.querySelector('#esline');
    return line ? Math.round(line.getBoundingClientRect().width) : null;
  });
  const nb = await p.$('[data-esnbtoggle]');
  if (nb) {
    await nb.click(); await p.waitForSelector('.es-nb', { timeout: 8000 }); await rf(p);
    const both = await p.evaluate(() => ({
      study: !!document.querySelector('.es-study'), nb: !!document.querySelector('.es-nb'),
      w: document.querySelector('#esline') ? Math.round(document.querySelector('#esline').getBoundingClientRect().width) : null,
    }));
    ok(both.study && both.nb, 'the notebook and the study window coexist');
    ok(both.w === geom, 'and the writing did not move: ' + both.w + ' against ' + geom);
    await p.click('[data-esnbclose]').catch(() => {});
  }
  await p.keyboard.press('Escape'); await gone(p, '.es-study').catch(() => {});
  ok(!(await p.$('.es-study')), 'Escape closes it');
  const after = await p.evaluate(() => document.querySelector('#esline') ? Math.round(document.querySelector('#esline').getBoundingClientRect().width) : null);
  ok(after === geom, 'and closing it did not move the writing either: ' + after);

  console.log('\npageerrors:', errs.length ? errs.join(' | ') : 'none');
  ok(errs.length === 0, 'no page errors');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail ? 1 : 0);
})();
