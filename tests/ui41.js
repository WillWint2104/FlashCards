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
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };

async function setup(p) {
  await p.goto(T); await p.waitForTimeout(350);
  await p.evaluate(() => localStorage.removeItem('marginal.essay.v1'));
  await p.goto(T); await p.waitForTimeout(650);
  await p.$$eval('.navtab', es => { const t = es.find(x => /Essay practice/i.test(x.textContent)); t && t.click(); });
  await p.waitForTimeout(400);
  await p.selectOption('#essubject', 'business_studies').catch(() => {});
  await p.waitForTimeout(350);
}
// The guidance as the student can actually see it: open the disclosure and read.
async function guidance(p, q) {
  const typed = await ownQuestion(p, q);
  if (!typed) return null;
  await p.waitForTimeout(450);
  // The guidance sits behind "Review or edit", which is where a student who wants
  // to know what they will be marked against goes.
  await p.evaluate(() => { const b = document.querySelector('#esrubopen'); b && b.click(); });
  await p.waitForTimeout(350);
  return p.evaluate(() => {
    const box = document.querySelector('.es-rubpre');
    const status = document.querySelector('.es-rubstatus');
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

  console.log('--- the student\'s own question is the way in ---');
  const mode = await p.evaluate(() => {
    const on = document.querySelector('[data-esmode].on');
    const order = [...document.querySelectorAll('[data-esmode]')].map(x => x.dataset.esmode);
    return { on: on ? on.dataset.esmode : null, order: order, box: !!document.querySelector('#esq') };
  });
  ok(mode.on === 'own', 'setup opens on the student\'s own question: ' + mode.on);
  ok(mode.order[0] === 'own', 'and it is the first route offered: ' + JSON.stringify(mode.order));
  ok(mode.box, 'the question box is there without asking for it');

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
  await p.evaluate(() => { const t = [...document.querySelectorAll('[data-esmode]')].find(x => x.dataset.esmode === 'practice'); t && t.click(); });
  await p.waitForTimeout(400);
  const dir = await p.evaluate(() => {
    const d = [...document.querySelectorAll('[data-essetupdir]')].find(x => /Explain/i.test(x.textContent));
    if (d) { d.click(); return d.textContent.trim(); } return null;
  });
  ok(!!dir, 'a directive can be chosen: ' + JSON.stringify(dir));
  await p.waitForTimeout(400);
  const pills = await p.evaluate(() => [...document.querySelectorAll('[data-essetuptopic]')].map(x => {
    const n = x.querySelector('.es-pilln');
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
