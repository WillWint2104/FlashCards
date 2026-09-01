// GUIDED-READY, FOR THREE DIRECTIVES.
//
// mkt-01 (Explain), fin-01 (How can) and hr-01 (Evaluate) were already guided.
// ops-02 (Assess), hr-02 (Analyse) and mkt-03 (To what extent) are the pilot that
// asks whether the pathway architecture carries every major reasoning pattern
// without inference, duplication or distortion. This suite is the answer.
//
// What it will not accept:
//   - a question that offers fewer arguments than were authored for it
//   - an argument whose meaning is hidden until after it is chosen
//   - a concept route that points at a syllabus point which does not exist
//   - Assess or To what extent reasoning as though they were Explain
//   - Analyse reasoning as though it were Evaluate
//   - a guided question that has closed the door on writing your own argument
//
// Counts are asserted exactly. A pathway silently dropped by an area filter is
// the failure this suite exists to catch, so "at least one" would defeat it.
const { chromium, T, usePractice, openMap } = require('./env');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };
const rf = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

// The three pilot questions and what was authored for each.
const PILOT = [
  { id: 'ops-02', qre: 'globalisation on operations', directive: 'Assess', mode: 'judgement', paths: 7,
    roles: { support: 4, conditional: 1, limitation: 2 } },
  { id: 'hr-02', qre: 'key influences affect human', directive: 'Analyse', mode: 'causal', paths: 6, roles: null },
  { id: 'mkt-03', qre: 'influences on marketing determine', directive: 'To what extent', mode: 'judgement', paths: 8,
    roles: { support: 4, conditional: 3, limitation: 1 } },
];

// Judgement vocabulary, for the one question that must not use any of it. These
// are the words that turn "how does this work" into "how well does this work".
const JUDGEMENT_WORDS = /\b(effective|effectiveness|ineffective|evaluate|assess|assessing|how well|worth it|outweigh|most important|best strategy|significant|significantly)\b/i;

async function enter(p, qre) {
  await p.goto(T); await p.waitForSelector('.navtab', { timeout: 8000 });
  await p.evaluate(() => localStorage.removeItem('marginal.essay.v1'));
  await p.goto(T); await p.waitForSelector('.navtab', { timeout: 8000 });
  await p.$$eval('.navtab', es => { const t = es.find(x => /Essay practice/i.test(x.textContent)); t && t.click(); });
  await p.waitForSelector('#essubject', { timeout: 8000 });
  await p.selectOption('#essubject', 'business_studies');
  await usePractice(p);
  const got = await p.evaluate(r => {
    const t = [...document.querySelectorAll('.es-qrow')].find(x => new RegExp(r, 'i').test(x.textContent));
    if (t) { t.click(); return true; } return false;
  }, qre);
  if (!got) return false;
  await p.click('#esstart');
  await p.waitForFunction(() => !!document.querySelector('#esline, .es-startrow'), null, { timeout: 8000 });
  return true;
}
async function toBody1(p) {
  if ((await p.$$('.es-startrow')).length) {
    await p.evaluate(() => { const t = [...document.querySelectorAll('.es-startrow')].find(x => /Body 1/.test(x.textContent)); t && t.click(); });
  } else {
    await openMap(p);
    await p.evaluate(() => { const t = [...document.querySelectorAll('.es-mapitem')].find(x => /Body 1/.test(x.textContent)); t && t.click(); });
    await p.keyboard.press('Escape');
  }
  await rf(p);
}
async function toSection(p, name) {
  if ((await p.$$('.es-startrow')).length) {
    await p.evaluate(s => { const t = [...document.querySelectorAll('.es-startrow')].find(x => x.textContent.indexOf(s) >= 0); t && t.click(); }, name);
  } else {
    await openMap(p);
    await p.evaluate(s => { const t = [...document.querySelectorAll('.es-mapitem')].find(x => x.textContent.indexOf(s) >= 0); t && t.click(); }, name);
    await p.keyboard.press('Escape');
  }
  await rf(p);
}
// The frames offered for the sentence being written, whichever slot it is.
async function shapes(p) {
  const b = await p.$('#esshape'); if (!b) return [];
  await b.click(); await rf(p);
  const out = await p.$$eval('.es-shape', es => es.map(e => e.innerText.replace(/\s+/g, ' ').trim()));
  await b.click().catch(() => {});
  return out;
}

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.route(/workers\.dev/, r => r.abort());

  // ---------------------------------------------------------------------------
  console.log('--- every authored concept route resolves to a syllabus point that exists ---');
  // The content layers are page globals, so this can be checked for all 21
  // pathways at once rather than sampled. A route that misses does not throw: it
  // silently gives the student no teaching, which is the failure to catch.
  await enter(p, 'globalisation on operations');
  const routes = await p.evaluate(() => {
    const E = window.ESSAY, B = window.BUSCONTENT;
    const found = [];
    JSON.stringify(E, (k, v) => { if (v && Array.isArray(v.pathways)) found.push(v); return v; });
    const out = [];
    found.forEach(q => (q.pathways || []).forEach(pw => {
      const c = pw.concept || {};
      const t = B.topics[c.topic];
      const sec = t && (t.sections || []).find(s => s.name === c.section);
      // The app resolves a named point by PREFIX, so a pathway may name
      // "training and development" for the point "training and development \u2013
      // current or future skills". Matching exactly here would report nine
      // working routes as broken, so this uses the rule the app itself uses.
      const want = String(c.point || '').toLowerCase();
      const pt = sec && (sec.points || []).find(x => String(x.point || '').toLowerCase().indexOf(want) === 0);
      out.push({ q: q.id, id: pw.id, hit: !!pt, taught: !!(pt && String(pt.what || '').length > 80) });
    }));
    return out;
  });
  const pilotIds = PILOT.map(x => x.id);
  const mine = routes.filter(r => pilotIds.indexOf(r.q) >= 0);
  ok(mine.length === 21, 'the pilot authored 21 pathways in total: ' + mine.length);
  ok(mine.every(r => r.hit), 'every pilot pathway routes to a syllabus point that exists: '
    + (mine.filter(r => !r.hit).map(r => r.id).join(', ') || 'all of them do'));
  ok(mine.every(r => r.taught), 'and every one of those points carries real teaching to route to: '
    + (mine.filter(r => !r.taught).map(r => r.id).join(', ') || 'all of them do'));
  ok(routes.every(r => r.hit), 'no question in the bank has a broken concept route: '
    + (routes.filter(r => !r.hit).map(r => r.q + '/' + r.id).join(', ') || 'none broken'));

  // ---------------------------------------------------------------------------
  console.log('--- nothing student-facing was invented beyond the approved matrices ---');
  const authored = await p.evaluate(ids => {
    const E = window.ESSAY;
    const found = [];
    JSON.stringify(E, (k, v) => { if (v && Array.isArray(v.pathways)) found.push(v); return v; });
    const out = {};
    found.filter(q => ids.indexOf(q.id) >= 0).forEach(q => {
      out[q.id] = {
        mode: (q.coreAnswer || {}).mode || 'causal',
        criteria: ((q.coreAnswer || {}).criteria || []).length,
        positions: ((q.coreAnswer || {}).positions || []).map(x => x.lean),
        paths: (q.pathways || []).map(pw => ({
          id: pw.id, role: (pw.contribution || {}).role || null,
          words: [pw.short, pw.adds, pw.relationship, pw.meaning, pw.whatToProve, pw.commonMistake].join(' '),
          complete: !!(pw.short && pw.adds && pw.relationship && pw.meaning && pw.whatToProve && pw.commonMistake && pw.guides),
          evidence: (pw.evidence || []).length,
        })),
      };
    });
    return out;
  }, pilotIds);

  PILOT.forEach(q => {
    const a = authored[q.id];
    if (!a) { ok(false, q.id + ' is in the question bank'); return; }
    ok(a.paths.length === q.paths, q.id + ' authored exactly the approved number of pathways: ' + a.paths.length + ' of ' + q.paths);
    ok(a.mode === q.mode, q.id + ' reasons in the ' + q.mode + ' mode: ' + a.mode);
    ok(a.paths.every(x => x.complete), q.id + ': every pathway carries the whole authored layer: '
      + (a.paths.filter(x => !x.complete).map(x => x.id).join(', ') || 'all complete'));
    // Evidence is honestly empty until a source is verified. An invented case
    // study fact would make these questions look finished and be a lie.
    ok(a.paths.every(x => x.evidence === 0), q.id + ': no evidence was invented to fill the gap');
    if (q.roles) {
      const got = {};
      a.paths.forEach(x => { got[x.role] = (got[x.role] || 0) + 1; });
      ok(JSON.stringify(got) === JSON.stringify(q.roles),
        q.id + ': the judgement roles are as approved: ' + JSON.stringify(got));
      // A judgement question with no limitation has nothing to weigh, whatever
      // it says in its conclusion.
      ok((got.limitation || 0) >= 1, q.id + ': at least one argument pushes against the position');
      ok(a.criteria >= 3, q.id + ': the judgement has criteria to be made against: ' + a.criteria);
      ok(a.positions.indexOf('qualified') >= 0, q.id + ': a qualified position is available, so degree can be partial');
    } else {
      ok(a.paths.every(x => x.role === null), q.id + ': carries no judgement roles, because it is not a judgement question');
      ok(a.criteria === 0 && a.positions.length === 0, q.id + ': and no judgement criteria or positions');
    }
  });

  // The Analyse question specifically. Its neighbour hr-01 is an Evaluate, and
  // the cost of copying that question's shape is that students learn to judge
  // when they were asked to explain how something works.
  const hr02 = authored['hr-02'];
  if (hr02) {
    const leaks = hr02.paths.filter(x => JUDGEMENT_WORDS.test(x.words));
    ok(leaks.length === 0, 'hr-02 uses no judgement vocabulary in any argument: '
      + (leaks.map(x => x.id).join(', ') || 'none'));
  }

  // ---------------------------------------------------------------------------
  for (const q of PILOT) {
    console.log('--- ' + q.id + ' (' + q.directive + ') as a student meets it ---');
    const reached = await enter(p, q.qre);
    ok(reached, q.id + ' is reachable from the practice bank');
    if (!reached) continue;

    // The directive has to be decoded in its own words, not in Explain's.
    const chips = await p.$$eval('.es-qbar button', es => es.map(e => e.innerText.trim()).join(' | ')).catch(() => '');
    ok(new RegExp(q.directive, 'i').test(chips), q.id + ': the question offers to explain its own directive: '
      + JSON.stringify(chips.slice(0, 90)));

    await toBody1(p);
    const picks = await p.$$eval('.es-pick:not(.own)', es => es.map(e => ({
      short: (e.querySelector('.es-pickshort') || {}).innerText || '',
      rel: (e.querySelector('.es-pickrel') || {}).innerText || '',
      sub: (e.querySelector('.es-picksub') || {}).innerText || '',
      role: (e.querySelector('.es-tprole') || {}).innerText || '',
    })));
    ok(picks.length === q.paths, q.id + ': every authored argument is offered, none filtered away: '
      + picks.length + ' of ' + q.paths);

    // Zero knowledge. A student who knows nothing must be able to tell what a
    // choice means BEFORE taking it, or the choice is a guess.
    ok(picks.every(x => x.sub.trim().length > 20), q.id + ': every choice explains itself before it is chosen: '
      + picks.filter(x => x.sub.trim().length <= 20).length + ' without a meaning');
    ok(picks.every(x => x.rel.trim().length > 20), q.id + ': and states the relationship it would argue');

    // The role is part of the choice on a judgement question, and is not a thing
    // that exists at all on a causal one.
    if (q.mode === 'judgement') {
      ok(picks.every(x => x.role.trim().length > 0), q.id + ': each choice says what it does to the position');
      ok(picks.some(x => /pushes against/i.test(x.role)), q.id + ': and at least one says it pushes against it');
    } else {
      ok(picks.every(x => x.role.trim().length === 0), q.id + ': no argument is labelled as supporting or opposing a position');
    }

    // The bypass. Support was added; a gate was not.
    const own = await p.$('.es-pick.own');
    ok(!!own, q.id + ': writing your own argument is still offered');

    // What was chosen has to be visible while writing, or the student is left
    // holding a decision the screen has forgotten.
    await p.$$eval('.es-pick:not(.own)', es => es[0] && es[0].click());
    await p.waitForFunction(() => !!document.querySelector('#esstartwriting, #esline'), null, { timeout: 8000 }).catch(() => {});
    const sw = await p.$('#esstartwriting'); if (sw) { await sw.click(); await p.waitForSelector('#esline', { timeout: 8000 }); }
    const ev = await p.$('[data-estool="evidence"]');
    if (ev) {
      await ev.click(); await p.waitForSelector('.es-drawer', { timeout: 8000 }); await rf(p);
      const ctx = await p.$eval('.es-drawer-ctx', e => e.innerText.trim()).catch(() => '');
      const first = picks[0].short.replace(/\s+/g, ' ').trim().toLowerCase();
      ok(ctx.toLowerCase().indexOf(first.split('→')[0].trim()) >= 0,
        q.id + ': the chosen argument names itself in the tool context: ' + JSON.stringify(ctx.slice(0, 70)));
      // Evidence stays honest on a question whose bank has nothing verified.
      const body = await p.$eval('.es-drawer', e => e.innerText).catch(() => '');
      ok(!/fits this argument/i.test(body) || !/no verified/i.test(body),
        q.id + ': evidence does not claim a fit and deny one at once');
      await p.keyboard.press('Escape'); await rf(p);
    }

    // The teaching the argument depends on is reachable from where it is needed.
    const learn = await p.$('[data-estool="understand"]:not([disabled])');
    ok(!!learn, q.id + ': the teaching this argument needs is reachable');
    if (learn) {
      await learn.click(); await p.waitForSelector('.esl-panel', { timeout: 8000 }); await rf(p);
      // The centre has two teaching layouts, one per route, and they use
      // different paragraph classes. What has to be true is that a student who
      // opens it finds the concept named and then explained, not which class
      // the explanation arrived in.
      const taught = await p.evaluate(() => {
        const panel = document.querySelector('.esl-panel');
        const ps = [...panel.querySelectorAll('.esl-p, .es-drawer-p')].map(e => e.textContent.trim()).filter(Boolean);
        return { title: ((panel.querySelector('.es-drawer-h, .esl-l1') || {}).textContent || '').trim(), body: ps.join(' ') };
      });
      ok(taught.title.length > 0, q.id + ': it opens on a named concept: ' + JSON.stringify(taught.title.slice(0, 40)));
      ok(taught.body.length > 40, q.id + ': with an explanation rather than a heading: ' + taught.body.length + ' chars');
      await p.keyboard.press('Escape');
      await p.waitForFunction(() => !document.querySelector('.esl-panel'), null, { timeout: 8000 }).catch(() => {});
    }

    // The sentence family follows the directive, in the one slot where the two
    // families genuinely differ.
    await toSection(p, 'Introduction');
    const th = (await shapes(p)).join(' ').toLowerCase();
    const judgeFrames = /(weighing|ultimately|on balance|your judgement|your position)/.test(th);
    const causalFrames = /(contribute to|affects|shapes)/.test(th);
    if (q.mode === 'judgement') {
      ok(judgeFrames, q.id + ': the thesis is offered in judgement shapes: ' + JSON.stringify(th.slice(0, 80)));
      ok(!causalFrames, q.id + ': and not in causal ones as well');
    } else {
      ok(causalFrames, q.id + ': the thesis is offered in causal shapes: ' + JSON.stringify(th.slice(0, 80)));
      ok(!judgeFrames, q.id + ': and carries none of the judgement frames its neighbour question uses');
    }
  }

  // ---------------------------------------------------------------------------
  console.log('--- the bypass reaches prose without choosing anything authored ---');
  await enter(p, 'key influences affect human');
  await toBody1(p);
  const ownBtn = await p.$('.es-pick.own');
  ok(!!ownBtn, 'a guided question still lets a student decide as they go');
  if (ownBtn) {
    await ownBtn.click(); await rf(p);
    const box = await p.$('#esownarg');
    ok(!!box, 'and asks for the relationship in their own words');
    if (box) {
      await p.fill('#esownarg', 'Union pressure changes how rosters are set');
      await p.click('#esownok');
      await p.waitForFunction(() => !!document.querySelector('#esstartwriting, #esline'), null, { timeout: 8000 }).catch(() => {});
      const sw2 = await p.$('#esstartwriting'); if (sw2) { await sw2.click(); await p.waitForSelector('#esline', { timeout: 8000 }).catch(() => {}); }
      ok(!!(await p.$('#esline')), 'and the student reaches the composer without taking an authored argument');
      const kept = await p.evaluate(() => document.body.innerText);
      ok(/Union pressure changes how rosters are set/.test(kept), 'their own words are kept exactly as written');
    }
  }

  console.log('\npageerrors:', errs.length ? errs.join(' | ') : 'none');
  ok(errs.length === 0, 'no page errors across the three questions');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail ? 1 : 0);
})();
