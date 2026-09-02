// THE SHELL CONTRACT.
//
// Essay Practice was a modal over a dimmed flashcards page, with support surfaces
// that took grid columns. Opening anything moved the writing. Every layout defect
// of that period came from one decision, and this suite exists so nobody can make
// it again by accident.
//
// The surfaces and what each is allowed to do:
//
//   Essay          a page. Never moves.
//   Learning       one modal over it. Essay stays mounted underneath.
//   Notebook       an independent floating window.
//   Writing tools  one floating window, four tools switching inside it.
//   Section list   a popover. Never a column.
//
// Deliberately NOT a student journey. The bots do sequencing; this answers one
// question fast: did anyone reintroduce a shifting, remounting or orphaned shell?
//
// Geometry is asserted against a baseline captured at runtime, never against a
// pixel constant. The contract is that the writing does not move, not that a
// particular viewport produces a particular number.
const { chromium, T, usePractice, openMap, closeMap } = require('./env');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };
const TOL = 1;

// Waiting for the thing that has to be true, rather than for a number of
// milliseconds that was a guess about how long it might take. Every one of these
// replaces a fixed sleep: the sleeps were both slower than necessary when the app
// was quick and a race when it was not.
const gone = (p, sel) => p.waitForFunction(s => !document.querySelector(s), sel, { timeout: 8000 });
const here = (p, sel) => p.waitForSelector(sel, { timeout: 8000 });
const visible = (p, sel) => p.waitForFunction(s => { const e = document.querySelector(s); return !!e && !e.hasAttribute('hidden'); }, sel, { timeout: 8000 });
const notVisible = (p, sel) => p.waitForFunction(s => { const e = document.querySelector(s); return !e || e.hasAttribute('hidden'); }, sel, { timeout: 8000 });
// The app is one file with no network. Its render is synchronous, so the frame
// after a click is the settled state; this is a frame, not a duration.
const settled = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

// Width, left edge, and the node's own identity. A remount that happens to land
// in the same place is still a remount: it loses the caret and the undo stack.
const geom = p => p.evaluate(() => {
  const t = document.querySelector('#esline');
  if (!t) return null;
  const r = t.getBoundingClientRect();
  window.__shellRef = window.__shellRef || t;
  return { w: Math.round(r.width), left: Math.round(r.left), same: t === window.__shellRef };
});
async function stable(p, base, what) {
  const g = await geom(p);
  if (!g) { ok(false, what + ': the composer is on screen to be measured'); return null; }
  ok(Math.abs(g.w - base.w) <= TOL && Math.abs(g.left - base.left) <= TOL,
    what + ': the writing does not move: ' + g.w + '/' + g.left + ' against ' + base.w + '/' + base.left);
  ok(g.same, what + ': and it is the same textarea, not a fresh one');
  return g;
}

async function toWriting(p, qre) {
  await p.goto(T); await here(p, '.navtab');
  await p.evaluate(() => localStorage.removeItem('marginal.essay.v1'));
  await p.goto(T); await here(p, '.navtab');
  await p.$$eval('.navtab', es => { const t = es.find(x => /Essay practice/i.test(x.textContent)); t && t.click(); });
  await here(p, '#essubject');
  await p.selectOption('#essubject', 'business_studies').catch(() => {});
  await usePractice(p);
  const chip = await p.evaluate(r => {
    const t = [...document.querySelectorAll('.es-qrow')].find(x => new RegExp(r, 'i').test(x.textContent));
    if (t) { t.click(); return true; } return false;
  }, qre);
  if (!chip) return false;
  await p.click('#esstart');
  // Either the composer or the start surface: which one is the question's business.
  await p.waitForFunction(() => !!document.querySelector('#esline, .es-startrow'), null, { timeout: 8000 });
  // Some questions open on a start surface, some go straight to the composer.
  if ((await p.$$('.es-startrow')).length) {
    await p.evaluate(() => { const t = [...document.querySelectorAll('.es-startrow')].find(x => /Body 1/.test(x.textContent)); t && t.click(); });
    await p.waitForFunction(() => !!document.querySelector('[data-espath], #esline'), null, { timeout: 8000 });
    if ((await p.$$('[data-espath]')).length) {
      await p.$$eval('[data-espath]', es => es[0] && es[0].click());
      await p.waitForFunction(() => !!document.querySelector('#esstartwriting, #esline'), null, { timeout: 8000 });
      const sw = await p.$('#esstartwriting'); if (sw) { await sw.click(); await here(p, '#esline'); }
    }
  }
  return !!(await p.$('#esline'));
}

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.route(/workers\.dev/, r => r.abort());

  console.log('--- the page, and the baseline everything else is measured against ---');
  const reached = await toWriting(p, 'operations strategies');
  ok(reached, 'the writing screen is reachable');
  if (!reached) { console.log(`\n${pass} passed, ${++fail} failed`); await b.close(); process.exit(1); }
  const base = await geom(p);
  ok(!!base, 'a baseline can be taken');
  console.log('    baseline textarea:', base.w + 'px wide at ' + base.left);
  // The old shell dimmed a page behind a card. Nothing is behind this one.
  const page = await p.evaluate(() => {
    const s = document.querySelector('.es-scrim');
    return s ? { bg: getComputedStyle(s).backgroundColor, radius: getComputedStyle(document.querySelector('.es-wrap')).borderRadius } : null;
  });
  ok(page && !/rgba\(.*0\.\d+\)/.test(page.bg), 'the essay surface is opaque, not a scrim over something else: ' + (page && page.bg));

  console.log('--- Learn opens study resources, and the essay stays mounted under it ---');
  // This block used to assert the Learning Centre. The Centre is out of the
  // student route while it is rebuilt, so the route it tested no longer exists.
  // What it was really protecting survives unchanged and is asserted here
  // against the surface that replaced it: opening support does not move the
  // writing, and the essay is still there underneath.
  const learn = await p.$('[data-estool="understand"]');
  ok(!!learn, 'the Learn control is reachable');
  if (learn) {
    await learn.click(); await here(p, '.es-study');
    const c = await p.evaluate(() => ({
      panels: document.querySelectorAll('.es-study').length,
      centre: document.querySelectorAll('.esl-panel').length,
      essay: !!document.querySelector('.es-compose'),
      drawer: !!document.querySelector('.es-drawer'),
      outside: !!document.querySelector('#esstudyhost') && !document.querySelector('#eshost .es-study'),
    }));
    ok(c.panels === 1, 'exactly one study window: ' + c.panels);
    ok(c.centre === 0, 'and the Learning Centre is not on the student route: ' + c.centre);
    ok(c.essay, 'the essay is still mounted underneath it');
    ok(!c.drawer, 'and Learn did not open a writing tool drawer');
    ok(c.outside, 'it floats in its own host, so a render cannot destroy it');
    await stable(p, base, 'study resources open');

    console.log('--- it does not cover the writing where there is room beside it ---');
    const cover = await p.evaluate(() => {
      const d = document.querySelector('.es-study').getBoundingClientRect();
      const rights = ['.es-flow', '.es-parahead'].map(s2 => document.querySelector(s2))
        .filter(Boolean).map(e => e.getBoundingClientRect().right);
      const writing = rights.length ? Math.max.apply(null, rights) : 0;
      return { over: Math.round(Math.max(0, writing - d.left)), onScreen: Math.round(d.right) <= window.innerWidth };
    });
    ok(cover.over === 0, 'the study window opens beside the writing, not on top of it: ' + cover.over + 'px');
    ok(cover.onScreen, 'and is fully on screen');

    await p.click('[data-esstudyclose]'); await gone(p, '.es-study');
    ok(!(await p.$('.es-study')), 'it closes on its own control');
    await stable(p, base, 'study resources closed');
  }

  console.log('--- the notebook is its own window ---');
  const nbClick = async () => {
    const hit = await p.evaluate(() => { const t = document.querySelector('[data-esnbtoggle]'); if (t) { t.click(); return true; } return false; });
    await settled(p); return hit;
  };
  ok(await p.$('[data-esnbtoggle]') !== null, 'the notebook control is reachable');
  {
    ok(await nbClick(), 'the notebook control can be pressed');
    ok(!!(await p.$('.es-nb')), 'the notebook opens');
    await stable(p, base, 'notebook open');
    // Dragged, then closed and reopened. The teardown resize once recorded a 0x0
    // rect at 0,0 and the window "remembered" a geometry nobody chose.
    const head = await p.$('.es-nbhead'); const hb = head && await head.boundingBox();
    ok(!!hb, 'the notebook has a title bar to drag it by');
    if (hb) {
      await p.mouse.move(hb.x + 120, hb.y + 12); await p.mouse.down();
      await p.mouse.move(620, 380, { steps: 10 }); await p.mouse.up();
      // The drag is done when the panel has actually moved off its opening corner.
      await p.waitForFunction(() => { const n = document.querySelector('.es-nb'); return n && Math.round(n.getBoundingClientRect().left) < 600; }, null, { timeout: 8000 });
      const moved = await p.evaluate(() => { const n = document.querySelector('.es-nb'); const r = n.getBoundingClientRect();
        return { left: Math.round(r.left), top: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; });
      ok(moved.w > 0 && moved.h > 0 && moved.left >= 0 && moved.top >= 0, 'it moves to a real position: ' + JSON.stringify(moved));
      await stable(p, base, 'notebook dragged');
      await p.click('[data-esnbclose]'); await gone(p, '.es-nb');
      ok(!(await p.$('.es-nb')), 'it closes');
      await nbClick();
      const again = await p.evaluate(() => { const n = document.querySelector('.es-nb'); if (!n) return null; const r = n.getBoundingClientRect();
        return { left: Math.round(r.left), top: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; });
      ok(!!again && again.w > 0 && again.h > 0, 'and reopens with a real size, never a teardown 0x0: ' + JSON.stringify(again));
      ok(!!again && Math.abs(again.left - moved.left) <= 2 && Math.abs(again.top - moved.top) <= 2,
        'at the position the student chose: ' + JSON.stringify(again));
    }
  }

  console.log('--- the writing tools are one window, and the two windows coexist ---');
  const ev = await p.$('[data-estool="evidence"]');
  ok(!!ev, 'the Evidence control is reachable');
  if (ev) {
    await ev.click(); await here(p, '.es-drawer');
    const one = await p.evaluate(() => document.querySelectorAll('.es-drawer').length);
    ok(one === 1, 'exactly one writing tools window: ' + one);
    await stable(p, base, 'Evidence open');
    // The bug this protects: opening the notebook dismissed the tool sheet,
    // because its control counted as a click outside.
    ok(!!(await p.$('.es-nb')), 'opening a writing tool did not dismiss the notebook');
    const box = await p.evaluate(() => { const d = document.querySelector('.es-drawer'); const r = d.getBoundingClientRect();
      return { left: Math.round(r.left), top: Math.round(r.top) }; });
    // A tool with nothing behind it that would only say so is not shown at all, so
    // the tabs on screen are what this walks. What is being protected is that
    // switching between them does not move or rebuild the window, not which tools a
    // particular question happens to have.
    const tabs = await p.$$eval('.es-drawer-tab[data-estool]', es => es.map(e => e.dataset.estool));
    ok(tabs.length >= 3, 'the window offers at least three tools to switch between: ' + JSON.stringify(tabs));
    for (const t of tabs) {
      const tab = await p.$(`.es-drawer-tab[data-estool="${t}"]`);
      if (!tab) { ok(false, 'the ' + t + ' tab is present in the window'); continue; }
      await tab.click();
      // The window is done switching when its title says the tool that was asked for.
      await p.waitForFunction(want => {
        const t = document.querySelector('.es-drawer-title');
        return !!t && t.textContent.trim().toLowerCase().indexOf(want) === 0;
      }, t === 'ideas' ? 'arguments' : t, { timeout: 8000 });
      const st = await p.evaluate(() => { const d = document.querySelector('.es-drawer'); if (!d) return null;
        const r = d.getBoundingClientRect();
        return { n: document.querySelectorAll('.es-drawer').length, left: Math.round(r.left), top: Math.round(r.top),
          title: (document.querySelector('.es-drawer-title') || {}).textContent }; });
      ok(st && st.n === 1, t + ': still exactly one window, not a second panel: ' + (st && st.n));
      ok(st && Math.abs(st.left - box.left) <= 2 && Math.abs(st.top - box.top) <= 2, t + ': and it did not move');
      await stable(p, base, 'switched to ' + t);
    }
    // Learn must not be one of them: it is a different class of activity.
    ok(!(await p.$('.es-drawer-tab[data-estool="understand"]')), 'Learn is not a writing tool tab');
    await p.keyboard.press('Escape'); await gone(p, '.es-drawer');
    ok(!(await p.$('.es-drawer')), 'Escape closes the tool window');
    ok(!!(await p.$('.es-nb')), 'and closing it did not take the notebook with it');
    await p.click('[data-esnbclose]').catch(() => {}); await gone(p, '.es-nb').catch(() => {});
  }

  console.log('--- the section list is a popover, and stays closable across a render ---');
  const mp = await p.$('#esmappop');
  ok(!!mp, 'the section control is reachable');
  if (mp) {
    await mp.click(); await visible(p, '.es-map');
    const shown = await p.$eval('.es-map', e => !e.hasAttribute('hidden')).catch(() => false);
    ok(shown, 'the menu opens');
    const anchored = await p.evaluate(() => {
      const btn = document.querySelector('#esmappop'), m = document.querySelector('.es-map');
      if (!btn || !m) return null;
      const a = btn.getBoundingClientRect(), r = m.getBoundingClientRect();
      return { dx: Math.round(r.left - a.left), below: Math.round(r.top - a.bottom),
        outOfFlow: getComputedStyle(m).position === 'absolute' || getComputedStyle(m).position === 'fixed' };
    });
    ok(anchored && anchored.outOfFlow, 'it is out of flow, not a grid column');
    ok(anchored && Math.abs(anchored.dx) <= 2 && anchored.below >= 0 && anchored.below < 20,
      'anchored under its own control: ' + JSON.stringify(anchored));
    await stable(p, base, 'section menu open');
    // THE DETACHED-NODE BUG. A render while the menu is open replaces its node;
    // handlers holding the old one hid a detached element and the menu on screen
    // could never be closed again. Toggling the shape forces a render here.
    // A real re-render, not a synthetic event: stepping the guide rebuilds the
    // composer while the menu is open, which is exactly the sequence that used to
    // leave a detached node behind handlers that could never close it again.
    const stepped = await p.evaluate(() => {
      const n = document.querySelector('#esnextguide:not([disabled])');
      if (n) { n.click(); return true; } return false;
    });
    await settled(p);
    ok(stepped, 'a render can be forced while the menu is open');
    // Advancing a stage is a real state change and is ALLOWED to rebuild the
    // composer. The contract is that support surfaces do not, so the reference is
    // re-taken here rather than reporting an intended rebuild as a violation.
    await p.evaluate(() => { window.__shellRef = document.querySelector('#esline'); });
    const survived = await p.evaluate(() => {
      const m = document.querySelector('.es-map');
      return { present: !!m, open: m ? !m.hasAttribute('hidden') : null, connected: m ? m.isConnected : null };
    });
    ok(survived.present && survived.connected, 'the menu is still a live node after the render');
    await p.keyboard.press('Escape'); await notVisible(p, '.es-map');
    const stillOpen = await p.$eval('.es-map', e => !e.hasAttribute('hidden')).catch(() => false);
    ok(!stillOpen, 'and Escape closes the menu that is actually on screen, not a detached predecessor');
    await stable(p, base, 'section menu closed');
  }

  console.log('--- showing the sentence shape is a disclosure, not a render ---');
  await p.click('#esline').catch(() => {});
  await p.keyboard.type('Technology can lower cost.');
  await settled(p);
  const beforeShape = await p.evaluate(() => { const t = document.querySelector('#esline');
    t.setSelectionRange(10, 10); return { v: t.value, s: t.selectionStart }; });
  const sh2 = await p.$('#esshape');
  ok(!!sh2, 'the sentence shape control is reachable');
  if (sh2) {
    await sh2.click(); await visible(p, '#esshapes');
    const after = await p.evaluate(() => { const t = document.querySelector('#esline');
      return { v: t.value, s: t.selectionStart, same: t === window.__shellRef,
        shown: !!document.querySelector('#esshapes:not([hidden])') }; });
    ok(after.shown, 'the shape appears');
    ok(after.same, 'the same textarea node survives it');
    ok(after.v === beforeShape.v, 'with the text untouched');
    ok(after.s === beforeShape.s, 'and the caret where it was: ' + after.s);
    // Undo is the real proof the composer was never rebuilt.
    await p.click('#esline'); await p.keyboard.press('Control+z');
    await p.waitForFunction(v => { const t = document.querySelector('#esline'); return !!t && t.value !== v; }, beforeShape.v, { timeout: 8000 }).catch(() => {});
    const undone = await p.evaluate(() => document.querySelector('#esline').value);
    ok(undone !== beforeShape.v, 'and undo still reaches the typing: ' + JSON.stringify(undone.slice(0, 24)));
  }

  console.log('--- what Learn reaches is authored, never derived from the prose ---');
  // This block used to assert that the concept teaching a pathway names was
  // reachable through the Learning Centre. It is not any more: the Centre is off
  // the student route, and the authored syllabus explanations behind it are
  // unreachable in essay mode until it is rebuilt. That is a consequence of the
  // decision and is recorded in docs/study-resources.md, not hidden here.
  //
  // The principle the old block protected does survive: what a student is sent
  // to is authored against their argument and never inferred. It is asserted
  // against the surface that replaced it.
  const reached2 = await toWriting(p, 'target markets affect');
  ok(reached2, 'a question with authored arguments is reachable');
  if (reached2) {
    const l2 = await p.$('[data-estool="understand"]:not([disabled])');
    ok(!!l2, 'Learn is offered');
    if (l2) {
      await l2.click(); await here(p, '.es-study');
      const shown = await p.evaluate(() => {
        const panel = document.querySelector('.es-study');
        return { rows: panel.querySelectorAll('.es-stres').length,
          text: panel.innerText.replace(/\s+/g, ' ').trim() };
      });
      // No resource has been authored for any question yet, so the honest state
      // is the empty one. A window that invented a plausible row here would be
      // the exact failure this suite exists to catch.
      ok(shown.rows === 0, 'it shows no resources, because none are authored: ' + shown.rows);
      ok(/no study resources have been added/i.test(shown.text),
        'and says so plainly rather than showing a placeholder');
      await p.click('[data-esstudyclose]'); await gone(p, '.es-study');
    }
  }

  console.log('--- and no authoring state reaches the student ---');
  const ev2 = await p.$('[data-estool="evidence"]');
  ok(!!ev2, 'Evidence is reachable on this question');
  if (ev2) {
    await ev2.click(); await here(p, '.es-drawer');
    const t2 = await p.evaluate(() => { const d = document.querySelector('.es-drawer'); return d ? d.textContent : ''; });
    const leak = /\d+\s+items?\s+(is|are)\s+written|waiting on a checked source|withheld|unverified|candidate/i;
    ok(!leak.test(t2), 'no withholding counts or verification vocabulary: ' + JSON.stringify((t2.match(leak) || [''])[0]));
    ok(!/fits this argument/i.test(t2) || !/nothing has been linked/i.test(t2),
      'and it never claims a fit and denies one in the same panel');
  }

  console.log('--- the window opens beside the writing, and the small controls say what they are doing ---');
  // The shell rule is that opening a tool does not disturb the writing. It moves
  // nothing, which the geometry above proves, but a window that lands on top of
  // the sentence heading still covers the thing being written. At this viewport
  // there is room beside the writing, so it has to be used.
  await p.keyboard.press('Escape').catch(() => {});
  await gone(p, '.es-drawer').catch(() => {});
  const ev3 = await p.$('[data-estool="evidence"]');
  if (ev3) {
    await ev3.click(); await here(p, '.es-drawer'); await settled(p);
    const cover = await p.evaluate(() => {
      const d = document.querySelector('.es-drawer').getBoundingClientRect();
      const rights = ['.es-flow', '.es-parahead'].map(s => document.querySelector(s))
        .filter(Boolean).map(e => e.getBoundingClientRect().right);
      const writing = rights.length ? Math.max.apply(null, rights) : 0;
      return { over: Math.round(Math.max(0, writing - d.left)), onScreen: Math.round(d.right) <= window.innerWidth,
        w: Math.round(d.width) };
    });
    ok(cover.over === 0, 'the tool window does not cover the writing where there is room beside it: ' + cover.over + 'px');
    ok(cover.onScreen, 'and it is fully on screen: ' + cover.w + 'px wide');
    await p.keyboard.press('Escape'); await gone(p, '.es-drawer').catch(() => {});
  }

  // The notebook control looked identical whether pressing it would open the
  // notebook or close it. aria-expanded was already right; the styling ignored it.
  //
  // It used to sit in the paragraph head as well as the page header, which is one
  // control for one purpose rendered twice. The notebook belongs to the response,
  // not to the paragraph, so the header utility is the one that stayed; this
  // suite follows it there. What is asserted is unchanged: it exists, it reports
  // its state, and it looks different when the notebook is open.
  const NBSEL = '.es-topbtns [data-esnbtoggle]';
  const nb3 = await p.$(NBSEL);
  ok(!!nb3, 'the notebook control is in the page header');
  if (nb3) {
    const look = () => p.evaluate(sel => { const t = document.querySelector(sel);
      const c = getComputedStyle(t); return { expanded: t.getAttribute('aria-expanded'), bg: c.backgroundColor, shadow: c.boxShadow }; }, NBSEL);
    const shut = await look();
    await nb3.click(); await here(p, '.es-nb'); await settled(p);
    const open = await look();
    ok(open.expanded === 'true' && shut.expanded === 'false', 'it reports its state to assistive technology');
    ok(open.bg !== shut.bg || open.shadow !== shut.shadow, 'and it now looks different when the notebook is open: ' + open.bg);
    await p.click('[data-esnbclose]').catch(() => {}); await gone(p, '.es-nb').catch(() => {});
    const back = await look();
    ok(back.bg === shut.bg, 'and goes back to looking shut when it is');
  }

  // The word count sat below the fold of a popover that scrolled as one piece,
  // so it was cut by the popover's own edge. The sections scroll; the count does not.
  await openMap(p); await settled(p);
  const wc = await p.evaluate(() => {
    const a = document.querySelector('.es-map'); if (!a) return null;
    const c = a.querySelector('.es-wordcount'); if (!c) return null;
    const ar = a.getBoundingClientRect(), cr = c.getBoundingClientRect();
    return { inside: cr.bottom <= ar.bottom + 1 && cr.top >= ar.top - 1, text: c.innerText.replace(/\s+/g, ' ').trim() };
  });
  ok(wc && wc.inside, 'the section popover keeps its word count inside itself: ' + (wc && JSON.stringify(wc.text)));
  await closeMap(p);

  console.log('\npageerrors:', errs.length ? errs.join(' | ') : 'none');
  ok(errs.length === 0, 'no page errors across the whole shell');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail ? 1 : 0);
})();
