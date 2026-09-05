// GUIDANCE FOR A QUESTION NOBODY AUTHORED.
//
// A student who brings their own question used to get a generic structural
// rubric, because the question carried no metadata. But the question itself
// carries a good deal: its directive is its first word, and the syllabus terms it
// names are in the text. Reading those is not inference.
//
// The line this suite defends is between reading and guessing. A concept the
// question names may be required of the student. A concept it does not name may
// not be, however related it seems, because a rubric that invents a requirement
// marks someone against something nobody asked of them.
const { chromium, T, ownQuestion } = require('./env');

// Waits that name their condition. This app fetches nothing and renders
// synchronously, so the effect of a click is present on the next frame:
// settled() is that frame, not a shorter guess at a duration.
const settled = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const here = (p, sel) => p.waitForSelector(sel, { timeout: 8000 });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };

async function setup(p) {
  await p.goto(T); await here(p, '.navtab');
  await p.evaluate(() => localStorage.removeItem('marginal.essay.v1'));
  await p.goto(T); await here(p, '.navtab');
  await p.$$eval('.navtab', es => { const t = es.find(x => /Essay practice/i.test(x.textContent)); t && t.click(); });
  await settled(p);
  await p.selectOption('#essubject', 'business_studies').catch(() => {});
  await settled(p);
}
// The guidance as the student can actually see it: open the disclosure and read.
async function guidance(p, q) {
  const typed = await ownQuestion(p, q);
  if (!typed) return null;
  await settled(p);
  // The guidance sits behind "Review or edit", which is where a student who wants
  // to know what they will be marked against goes.
  await p.evaluate(() => { const b = document.querySelector('#esrubopen'); b && b.click(); });
  await settled(p);
  return p.evaluate(() => {
    const box = document.querySelector('.qp-rubpre');
    const status = document.querySelector('.qp-rub');
    return { text: box ? box.textContent.replace(/\s+/g, ' ').trim() : '',
      status: status ? status.textContent.replace(/\s+/g, ' ').trim() : '' };
  });
}

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.route(/workers\.dev/, r => r.abort());
  await setup(p);

  console.log('--- both routes in, and the practice bank leads ---');
  // THIS REVERSES AN EARLIER DECISION, and it is written down rather than
  // quietly changed. Setup used to open with the question box in front of you,
  // on the reasoning that a student with a question in their hand is the normal
  // case and this is essay practice that also supplies questions. The approved
  // design puts "Choose a practice question" first and primary, and makes the
  // box one press away. What must stay true either way: both routes are on the
  // first screen, neither is buried, and the typed route still works.
  const mode = await p.evaluate(() => {
    const routes = [...document.querySelectorAll('[data-espick]')].map(x => ({
      to: x.dataset.espick, label: x.textContent.trim(),
      primary: x.classList.contains('qp-go') }));
    return { routes: routes, box: !!document.querySelector('#esq') };
  });
  ok(mode.routes.length === 2, 'the first screen offers exactly two routes: ' +
    JSON.stringify(mode.routes.map(r => r.label)));
  ok(mode.routes[0].to === 'list' && mode.routes[0].primary,
    'the practice bank is first and primary: ' + JSON.stringify(mode.routes[0]));
  ok(mode.routes.some(r => r.to === 'own'), 'and the student\'s own question is the other');
  ok(!mode.box, 'the box is not on this screen, because choosing a route comes first');
  // One press, and it is there. A route that costs more than that is buried.
  await p.click('[data-espick="own"]');
  await p.waitForSelector('#esq', { timeout: 8000 });
  ok(!!(await p.$('#esq')), 'one press reaches the question box');
  await p.click('[data-espick="subject"]');
  await p.waitForSelector('[data-espick="list"]', { timeout: 8000 });

  console.log('--- a judgement directive gets judgement guidance ---');
  const g1 = await guidance(p, 'Assess the effectiveness of marketing strategies in achieving marketing objectives.');
  ok(!!g1 && g1.text.length > 0, 'guidance is generated for a question nobody authored');
  if (g1) {
    console.log('    ' + g1.text.slice(0, 150));
    ok(/directive is Assess/i.test(g1.text), 'the directive is read from the question: Assess');
    ok(/judgement is required|reach a position/i.test(g1.text), 'and it asks for a judgement, not an even description');
    ok(!/causal explanation is required/i.test(g1.text), 'without also asking for a causal explanation');
    ok(/marketing/i.test(g1.text), 'the topic is identified from the terms it names');
    ok(/generated/i.test(g1.status) || /generated/i.test(g1.text), 'and it says the guidance was generated: ' + JSON.stringify(g1.status));
  }

  console.log('--- a causal directive gets causal guidance ---');
  await setup(p);
  const g2 = await guidance(p, 'Explain how operations strategies contribute to the achievement of performance objectives.');
  ok(!!g2 && g2.text.length > 0, 'guidance is generated');
  if (g2) {
    console.log('    ' + g2.text.slice(0, 150));
    ok(/directive is Explain/i.test(g2.text), 'the directive is read: Explain');
    ok(/causal explanation is required|how one thing leads/i.test(g2.text), 'and it asks for cause, not judgement');
    ok(!/judgement is required/i.test(g2.text), 'without also demanding a position');
    ok(/operations/i.test(g2.text), 'the topic is identified: Operations');
    ok(/operations strategies|performance objectives/i.test(g2.text),
      'and the syllabus terms the question actually names are quoted back');
  }

  console.log('--- what the question does not name is not invented ---');
  if (g2) {
    // The Operations question above says nothing about these. A rubric that
    // attached them would be marking against a requirement nobody set.
    const invented = ['target market', 'liquidity', 'cash flow', 'recruitment', 'e-marketing', 'promotion'];
    const found = invented.filter(x => new RegExp(x, 'i').test(g2.text));
    ok(found.length === 0, 'no concept from another part of the course appears: ' + JSON.stringify(found));
  }

  console.log('--- and an unrecognisable question says so rather than guessing ---');
  await setup(p);
  const g3 = await guidance(p, 'Discuss whether the thing that happened was good for the people involved.');
  ok(!!g3 && g3.text.length > 0, 'guidance is still generated');
  if (g3) {
    console.log('    ' + g3.text.slice(0, 150));
    ok(/could not be identified|None were recognised/i.test(g3.text),
      'it says the topic or concepts could not be identified: ' + JSON.stringify(g3.text.slice(0, 90)));
    const guessed = ['operations', 'marketing', 'finance', 'human resource'];
    const claimed = guessed.filter(x => new RegExp('Topic[^.]*' + x, 'i').test(g3.text));
    ok(claimed.length === 0, 'and claims no topic it could not find: ' + JSON.stringify(claimed));
  }

  console.log('--- a topic with nothing behind it is not offered as a choice ---');
  await setup(p);
  await p.evaluate(() => { const t = document.querySelector('[data-espick="list"]'); t && t.click(); });
  await settled(p);
  const dir = await p.evaluate(() => {
    const d = [...document.querySelectorAll('[data-essetupdir]')].find(x => /Explain/i.test(x.textContent));
    if (d) { d.click(); return d.textContent.trim(); } return null;
  });
  ok(!!dir, 'a directive can be chosen: ' + JSON.stringify(dir));
  await settled(p);
  const pills = await p.evaluate(() => [...document.querySelectorAll('[data-essetuptopic]')].map(x => {
    const n = x.querySelector('.qp-n');
    return { label: x.textContent.replace(/\s+/g, ' ').trim(),
      zero: n ? n.textContent.trim() === '0' : false,
      disabled: x.disabled, faded: x.classList.contains('empty') };
  }));
  console.log('    topics:', JSON.stringify(pills.map(x => x.label)));
  const empties = pills.filter(x => x.zero);
  ok(pills.length > 0, 'topics are offered after a directive: ' + pills.length);
  ok(empties.length > 0, 'and at least one has nothing behind it, so this means something: ' + empties.length);
  ok(empties.every(x => x.disabled), 'every empty topic is disabled rather than leading nowhere');
  ok(empties.every(x => x.faded), 'and is visibly not a normal choice');
  ok(pills.filter(x => !x.zero).every(x => !x.disabled), 'while topics with questions stay clickable');

  console.log('\npageerrors:', errs.length ? errs.join(' | ') : 'none');
  ok(errs.length === 0, 'no page errors');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail ? 1 : 0);
})();
