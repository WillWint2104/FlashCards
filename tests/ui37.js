// The context carry contract, both directions.
//
// Some controls take the student off the writing screen entirely, so the sentence
// in progress is captured and handed back when the composer returns. Some controls
// leave the composer standing, and there the capture must not survive: left set, it
// is restored into the next empty input, and an accepted sentence comes back ready
// to be added a second time.
//
// Both halves are one contract and neither can be tested without the other: clearing
// the capture too eagerly loses the student's words, and clearing it too late
// duplicates them. 47 suites, the role-by-mode matrix and a six area walkthrough all
// missed the duplication, because it only appears after ACCEPTING at the same stage.
const { chromium, T, OUT, usePractice, chooseQuestion } = require('./env');

// Waits that name their condition. This app fetches nothing and renders
// synchronously, so the effect of a click is present on the next frame:
// settled() is that frame, not a shorter guess at a duration.
const settled = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const here = (p, sel) => p.waitForSelector(sel, { timeout: 8000 });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };
const val = p => p.$eval('#esline', e => e.value).catch(() => null);
const prose = p => p.$eval('.es-prose', e => e.textContent).catch(() => '');
const countIn = (hay, needle) => hay.split(needle).length - 1;

async function toWriting(p) {
  await p.goto(T); await here(p, '.navtab');
  await p.evaluate(() => localStorage.removeItem('marginal.essay.v1'));
  await p.goto(T); await here(p, '.navtab');
  await p.$$eval('.navtab', es => { const t = es.find(x => /Essay practice/i.test(x.textContent)); t && t.click(); });
  await settled(p);
  await p.selectOption('#essubject', 'business_studies').catch(() => {});
  await chooseQuestion(p, /target markets affect/i);
  await p.click('#esstart');
  await p.waitForFunction(() => !!document.querySelector('#esline, .es-startrow, [data-espath]'), null, { timeout: 8000 });
  if (await p.$('.es-startrow')) await p.$$eval('.es-startrow', es => { const t = es.filter(x => /Body/.test(x.textContent))[0]; t && t.click(); });
  await settled(p);
  await p.$$eval('[data-espath]', es => es[0] && es[0].click()); await settled(p);
  const sw = await p.$('#esstartwriting'); if (sw) { await sw.click(); await settled(p); }
}

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1050 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.route(/workers\.dev/, r => r.abort());

  const SENT = 'Digitally engaged customers spend their attention on social platforms.';

  console.log('1. a control that leaves the composer standing must not outlive itself');
  await toWriting(p);
  await p.click('#esline'); await p.keyboard.type(SENT);
  // Opening a tool captures. Closing it swaps the side back in place, which is the
  // path on which the capture is not needed and must be dropped.
  await p.click('[data-estool="structure"]'); await settled(p);
  ok((await val(p)) === SENT, 'the sentence survives a tool opening');
  await p.keyboard.press('Escape'); await settled(p);
  ok((await val(p)) === SENT, 'and survives it closing');

  // Stay at this stage, so accepting does not advance the slot. This is the exact
  // sequence the duplication needed: same paragraph, same slot, empty input.
  const same = await p.$('#essamestep');
  ok(!!same, 'the same stage control is reachable, without it this is not a same stage test');
  if (same) { await same.click(); await settled(p); }
  await p.click('#esaccept'); await settled(p);
  const after = await val(p);
  ok(after === '', 'accepting at the same stage leaves the input empty: ' + JSON.stringify((after || '').slice(0, 40)));
  const text = await prose(p);
  ok(countIn(text, SENT) === 1, 'and the sentence is in the paragraph exactly once: ' + countIn(text, SENT));

  console.log('2. a control that replaces the composer must hand the sentence back');
  await toWriting(p);
  const PART = 'Customers who are online a lot see more of the brand';
  await p.click('#esline'); await p.keyboard.type(PART);
  const chip = await p.$('[data-esrestchange]');
  if (!chip) { ok(false, 'the argument chip is reachable'); }
  else {
    await chip.click(); await settled(p);
    ok((await val(p)) === null, 'the composer really does leave the screen on this path');
    await p.$$eval('[data-espath]', es => es[0] && es[0].click()); await settled(p);
    const sw = await p.$('#esstartwriting'); if (sw) { await sw.click(); await settled(p); }
    ok((await val(p)) === PART, 'the unfinished sentence comes back: ' + JSON.stringify((await val(p) || '').slice(0, 40)));
  }

  console.log('3. and it comes back once, not on every later render');
  // Clear it by hand. If the capture were still held, the next render would put it
  // back, which is the same defect wearing different clothes.
  await p.$eval('#esline', e => { e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); });
  const chip2 = await p.$('[data-esrestchange]');
  if (!chip2) { ok(false, 'the argument chip is reachable for the second round trip'); }
  else {
    await chip2.click(); await settled(p);
    await p.$$eval('[data-espath]', es => es[0] && es[0].click()); await settled(p);
    const sw2 = await p.$('#esstartwriting'); if (sw2) { await sw2.click(); await settled(p); }
    const again = await val(p);
    ok(again === '', 'a consumed capture is not restored a second time: ' + JSON.stringify((again || '').slice(0, 40)));
  }

  console.log('4. the last stage has nowhere to advance to, and still must not duplicate');
  await toWriting(p);
  // Walk to the final step first. Advancing a step clears the composer, so a sentence
  // typed before the walk is gone by the time it arrives, and the scenario would be
  // measuring an empty box rather than the stage it names.
  for (let i = 0; i < 8; i++) {
    const next = await p.$('#esnextguide:not([disabled])');
    if (!next) break;
    await next.click(); await settled(p);
  }
  const atEnd = await p.$('#esnextguide:not([disabled])');
  ok(!atEnd, 'the walk reaches a stage with nothing left to advance to');
  await p.click('#esline'); await p.keyboard.type(SENT);
  await p.click('[data-estool="structure"]'); await settled(p);
  await p.keyboard.press('Escape'); await settled(p);
  const line = await val(p);
  // An empty composer here is one of the defects this suite exists to catch, so it
  // has to be a failure and not a reason to skip the rest of the scenario.
  ok(line === SENT, 'the sentence is still in the composer at the final stage: ' + JSON.stringify((line || '').slice(0, 40)));
  await p.click('#esaccept'); await settled(p);
  const last = await val(p);
  ok(last === '', 'accepting at the final stage leaves the input empty: ' + JSON.stringify((last || '').slice(0, 40)));
  const t2 = await prose(p);
  // Not "no more than once": losing the sentence altogether is a failure too.
  ok(countIn(t2, SENT) === 1, 'and the sentence is in the paragraph exactly once: ' + countIn(t2, SENT));

  console.log('\npageerrors:', errs.length ? errs.join(' | ') : 'none');
  ok(errs.length === 0, 'no page errors');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail ? 1 : 0);
})();
