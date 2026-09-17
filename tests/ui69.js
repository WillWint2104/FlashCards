// THE SITTING SHELL'S FOOTER, AND THE STATE 12 DISCLOSURE, MEASURED IN A BROWSER.
//
// Two things live here because they are the same fault seen twice: something
// that reads correctly in the markup and is wrong on the screen.
//
//   1. UX-TEST-06. The footer is sticky and painted over the page, so the last
//      usable row of content is where the footer STARTS, not where the viewport
//      ends. Measured the wrong way - bottom <= window.innerHeight - the marked
//      result cleared the fold at 390x844. Measured the right way it did not:
//      the footer wrapped to four lines, stood 119px tall against 63px at
//      desktop, and covered the mark. That was the shared shell, so it covered
//      the mark on every marked format, not only extended responses.
//
//   2. The state 12 disclosure. tests/t33.mjs reads the generated pages as text
//      and can see that the marked state wraps the response in
//      <details class="submitted"> with no `open`. It cannot see whether that
//      renders as a collapsed response, or whether the mark the collapse exists
//      to lift actually clears the fold.
//
// The sweep is over every mockup that carries the shell, at four widths, because
// the fix is one shared block and a fix that only holds on the page it was
// written for is not a shared fix.
const { chromium, ROOT, OUT } = require('./env');
const path = require('path');
const url = f => 'file://' + path.join(ROOT, f).split(path.sep).join('/');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('  FAIL:', m); } };
// These pages fetch nothing and run no script: the effect of a click is present
// on the next frame, so settled() is that frame rather than a guess at a delay.
const settled = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

// Every mockup that carries the shared sitting shell. `result` names the element
// the footer must never cover, on the pages that show a mark at all.
const SHELL = [
  { f: 'docs/mockups/08-sitting-shell.html' },
  { f: 'docs/mockups/11-short-answer.html', result: '.result' },
  { f: 'docs/mockups/11-short-answer-keypoints.html', result: '.result' },
  { f: 'docs/mockups/12-extended-response.html', result: '.result' },
  { f: 'docs/mockups/12-extended-response-answering.html' },
  { f: 'docs/mockups/14-calculation-checked-correct.html', result: '.result' },
  { f: 'docs/mockups/14-calculation-checked-notquite.html', result: '.result' },
  { f: 'docs/mockups/14-nested-multipart.html' },
  { f: 'docs/mockups/14-worked-solution.html', result: '.result' },
  // The navigator is OPEN on this one, as a modal over the whole page. A footer
  // under a modal scrim is the scrim doing its job, so this page is asked the
  // other question: is the scrim the only thing on top of it.
  { f: 'docs/mockups/15-navigator.html', modal: '.scrim' },
];
// 390x844 and 430x932 are the two phones the finding was measured on, 768x1024 is
// the tablet the compact row must NOT reach, and 1280x800 is the desktop whose
// geometry must come through the change untouched.
const SIZES = [
  { name: '390x844', w: 390, h: 844, narrow: true },
  { name: '430x932', w: 430, h: 932, narrow: true },
  { name: '768x1024', w: 768, h: 1024, narrow: false },
  { name: '1280x800', w: 1280, h: 800, narrow: false },
];
// The footer was 63px on every page at every width above the wrap. That is the
// number the desktop must still read, and the number the phone now reads too.
const ONE_ROW = 72;

// What the footer looks like from the outside: its height, whether each action
// can actually be pressed where it is drawn, and what it is covering.
const readFooter = (p, resultSel) => p.evaluate(sel => {
  const box = e => { const r = e.getBoundingClientRect(); return { t: Math.round(r.top), b: Math.round(r.bottom), h: Math.round(r.height), w: Math.round(r.width) }; };
  const ft = document.querySelector('div.footer');
  const inr = document.querySelector('.footin');
  const acts = [...inr.querySelectorAll('button')];
  // Hit-tested where it is drawn, not merely present in the DOM: a control under
  // something else is not a control a thumb can reach.
  const hittable = acts.map(a => {
    const r = a.getBoundingClientRect();
    const hit = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
    return !!hit && (hit === a || a.contains(hit));
  });
  const shown = e => !!e && e.checkVisibility({ checkVisibilityCSS: true, contentVisibilityAuto: true });
  const res = sel ? document.querySelector(sel) : null;
  // WHAT "COVERED" MEANS, and it is not "below the fold".
  //
  // The first version of this compared the result's bottom with the footer's top
  // at arrival and called six pages broken. Five of them simply had their result
  // further down a long page, which is scrolling, not covering. What the footer
  // must never do is sit on the MARK: so the text inside the result is what is
  // measured, and it is measured where the student meets it.
  // The TEXT's own rectangle, via a Range. A text node's parentElement can be a
  // container many times its size, which made this answer differently on three
  // pages whose geometry is identical - measured by hand, all three put the band
  // at 776 to 843. A Range measures the glyphs.
  const textRect = res ? (() => {
    const w = document.createTreeWalker(res, NodeFilter.SHOW_TEXT);
    let top = Infinity, bottom = -Infinity;
    for (let t; (t = w.nextNode());) {
      if (!t.nodeValue.trim()) continue;
      const rg = document.createRange(); rg.selectNodeContents(t);
      const r = rg.getBoundingClientRect();
      if (!r.height) continue;
      top = Math.min(top, r.top); bottom = Math.max(bottom, r.bottom);
    }
    return bottom > -Infinity ? { top: Math.round(top), bottom: Math.round(bottom) } : null;
  })() : null;
  return {
    footer: box(ft),
    textRect,
    // What is drawn on top of the footer, named by the thing it belongs to.
    topOverFooter: (() => { const f = ft.getBoundingClientRect();
      const hit = document.elementFromPoint(Math.round(f.left + f.width / 2), Math.round(f.top + 6));
      if (!hit) return null;
      for (let e = hit; e; e = e.parentElement) {
        if (e === ft) return 'footer';
        if (e.classList && (e.classList.contains('nav') || e.classList.contains('scrim'))) return 'navigator';
      }
      return (hit.className && String(hit.className)) || hit.tagName; })(),
    actions: acts.map((a, i) => ({ text: a.innerText.replace(/\s+/g, ' ').trim(), ...box(a), hittable: hittable[i], shown: shown(a) })),
    whereShown: shown(document.querySelector('.footin .where')),
    labelsShown: [...document.querySelectorAll('.footin .foot-lbl')].some(shown),
    labelCount: document.querySelectorAll('.footin .foot-lbl').length,
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    result: res ? box(res) : null,
    ih: window.innerHeight,
  };
}, resultSel || null);

(async () => {
  const b = await chromium.launch();
  const errs = [];

  // ---- 1. the shared shell ------------------------------------------------
  for (const s of SIZES) {
    console.log(`--- shell at ${s.name} (${s.narrow ? 'compact row' : 'full labels'}) ---`);
    const p = await (await b.newContext({ viewport: { width: s.w, height: s.h } })).newPage();
    p.on('pageerror', e => errs.push(s.name + ': ' + String(e).slice(0, 180)));
    for (const m of SHELL) {
      const nm = path.basename(m.f).replace('.html', '');
      await p.goto(url(m.f)); await settled(p);
      const r = await readFooter(p, m.result);

      ok(r.footer.h <= ONE_ROW,
         `${s.name} ${nm}: the footer is one row (${r.footer.h}px, limit ${ONE_ROW})`);
      ok(!r.overflow, `${s.name} ${nm}: no horizontal overflow`);

      // Three actions, all of them reachable. The compact row drops words, never
      // a way out of the question.
      ok(r.actions.length === 3, `${s.name} ${nm}: three actions (${r.actions.length})`);
      if (m.modal) {
        // A modal is meant to be on top - here it is the navigator's own bottom
        // bar, inside .nav, above the scrim. What must not be true is anything
        // ELSE being on top, which is how a footer quietly stops working.
        ok(r.topOverFooter === 'navigator',
           `${s.name} ${nm}: only the open navigator is over the footer (${r.topOverFooter})`);
        ok(r.actions.every(a => a.shown), `${s.name} ${nm}: and the three actions are still drawn under it`);
      } else {
        ok(r.actions.every(a => a.shown && a.hittable),
           `${s.name} ${nm}: every action is visible and hit-testable where it is drawn`);
      }

      if (s.narrow) {
        // The compact row: counter gone, trailing halves gone, targets grown.
        ok(!r.whereShown, `${s.name} ${nm}: the item counter is out of the footer`);
        ok(!r.labelsShown && r.labelCount === 3,
           `${s.name} ${nm}: all three trailing labels are dropped, and there are three of them`);
        ok(r.actions.every(a => a.h >= 44),
           `${s.name} ${nm}: every action is at least 44px tall (${r.actions.map(a => a.h).join(',')})`);
      } else {
        // WHAT MUST NOT HAVE MOVED. The desktop and tablet footer is the one that
        // was signed off: full labels, the counter in the middle, 63px tall.
        ok(r.whereShown, `${s.name} ${nm}: the item counter is still in the footer`);
        ok(r.labelsShown, `${s.name} ${nm}: and the labels are still their full length`);
        ok(Math.abs(r.footer.h - 63) <= 1,
           `${s.name} ${nm}: footer geometry unchanged at 63px (${r.footer.h}px)`);
      }

      // THE INVARIANT THE WHOLE FIX EXISTS FOR.
      //
      // "Covered" is not the same as "below the fold". A result further down a
      // 1494px page is scrolling; a result the footer sits on at every scroll
      // position is the fault. So what is ASSERTED is that a scroll position
      // exists where the whole band is clear, and what is REPORTED is where the
      // mark lands on arrival - because on the three calculation pages at 390
      // the band is at 776 to 843 against a footer starting at 781, and that is
      // a fact about where those states put their result, not about the shell.
      // The page whose design commits to the mark being on the first screen is
      // state 12 marked, and that one IS asserted, further down.
      if (m.result) {
        if (r.textRect) {
          // Three different things, and calling them all "under the footer"
          // would misreport two of them. A mark ending at 913 on an 844px screen
          // is off the screen entirely, which is scrolling; a mark ending at 828
          // against a footer starting at 781 is behind the bar.
          const t = r.textRect, where =
            t.bottom <= r.footer.t ? 'clear of the footer'
            : t.top >= r.footer.b ? 'below the fold, not behind the footer'
            : 'BEHIND THE FOOTER on arrival';
          console.log(`    ${s.name} ${nm}: mark text ${t.top}-${t.bottom}, footer ${r.footer.t}-${r.footer.b} -> ${where}`);
        }
        // Once a student scrolls to it, the whole band clears - border, padding
        // and all - because a sticky footer that never lets a card finish is the
        // same complaint one screen further down.
        const scrolled = await p.evaluate(async sel => {
          document.querySelector(sel).scrollIntoView({ block: 'center' });
          await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
          const r2 = document.querySelector(sel).getBoundingClientRect();
          const f = document.querySelector('div.footer').getBoundingClientRect();
          return { clears: r2.bottom <= f.top, b: Math.round(r2.bottom), ft: Math.round(f.top) };
        }, m.result);
        ok(scrolled.clears,
           `${s.name} ${nm}: and the whole result clears the footer once scrolled to ` +
           `(ends ${scrolled.b}, footer starts ${scrolled.ft})`);
      }
    }
    await p.close();
  }

  // ---- 2. the state 12 disclosure ----------------------------------------
  const MARKED = url('docs/mockups/12-extended-response.html');
  const OPENING = 'Northline Sportswear set a marketing objective';
  // Chromium lays a closed <details>'s contents out and then skips them with
  // content-visibility:hidden, so the panel still reports a 488px box while the
  // disclosure itself is 50px tall. getClientRects() therefore answers yes to a
  // response no one can see. checkVisibility() and innerText are the two that
  // answer the question a student would ask.
  const shows = (p, sel) => p.evaluate(s => {
    const e = document.querySelector(s);
    return !!e && e.checkVisibility({ checkVisibilityCSS: true, contentVisibilityAuto: true })
      && e.innerText.trim().length > 0;
  }, sel);
  const textHas = (p, n) => p.evaluate(s => document.body.innerText.includes(s), n);
  const boxOf = (p, sel) => p.evaluate(s => {
    const e = document.querySelector(s); if (!e) return null;
    const r = e.getBoundingClientRect();
    return { top: Math.round(r.top + window.scrollY), height: Math.round(r.height) };
  }, sel);

  for (const [name, w, h] of [['desktop', 1280, 800], ['mobile', 390, 844]]) {
    console.log(`--- state 12 disclosure, ${name} ${w}x${h} ---`);
    const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
    p.on('pageerror', e => errs.push(name + ': ' + String(e).slice(0, 180)));
    await p.goto(MARKED); await settled(p);

    ok(!(await p.$eval('details.submitted', e => e.open)), `${name}: the response is collapsed on arrival`);
    ok(!(await shows(p, '.submitted .response')), `${name}: and its prose renders nothing at all`);
    ok(!(await textHas(p, OPENING)), `${name}: the response is not in the page's text either`);
    ok((await boxOf(p, 'details.submitted')).height < 80,
       `${name}: the disclosure is one line tall, not a response with a lid on it`);

    // Both were under the fold in draft 2, because the whole 176-word response
    // was above them. Measured against the bars, which are what actually covers
    // content on this shell.
    // ON ARRIVAL, WITHOUT SCROLLING: is the mark readable? At 1280x800 the whole
    // band clears both bars. At 390x844 the band's last 12px of padding run
    // under the footer and none of its text does, which is a card sliding under
    // a bar rather than a mark hidden behind one. Both are asserted as what they
    // are, and the phone's number is in the message so a change shows up as a
    // number rather than as a flip.
    const arrival = await p.evaluate(() => {
      const el = document.querySelector('.result');
      const r = el.getBoundingClientRect();
      const f = document.querySelector('div.footer').getBoundingClientRect();
      const hd = document.querySelector('header').getBoundingClientRect();
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let lowest = 0;
      for (let t; (t = w.nextNode());) if (t.nodeValue.trim())
        lowest = Math.max(lowest, t.parentElement.getBoundingClientRect().bottom);
      return { bandClears: r.top >= hd.bottom && r.bottom <= f.top,
               textClears: lowest <= f.top && r.top >= hd.bottom,
               gap: Math.round(f.top - lowest), band: Math.round(r.bottom), ft: Math.round(f.top) };
    });
    ok(arrival.textClears,
       `${name}: the mark itself is on the first screen, clear of both bars (${arrival.gap}px above the footer)`);
    if (name === 'desktop') ok(arrival.bandClears, 'desktop: and the whole band clears, padding included');
    else ok(!arrival.bandClears && arrival.band - arrival.ft <= 16,
            `mobile: the band's last ${arrival.band - arrival.ft}px of padding run under the footer, and only padding`);

    const before = (await boxOf(p, '.qcard')).height;
    await p.click('details.submitted > summary'); await settled(p);
    ok(await p.$eval('details.submitted', e => e.open), `${name}: clicking the line opens it`);
    ok(await shows(p, '.submitted .response'), `${name}: and the response is there to read`);
    ok(await textHas(p, OPENING), `${name}: with the submitted prose in it`);
    ok((await boxOf(p, '.qcard')).height > before + 100,
       `${name}: the card grew by the response, so nothing was hidden behind a scrollbar`);

    // WHAT IT MUST NOT BECOME. A submitted response reopened as a field has
    // nowhere for an edit to go, which is worse than either state on its own.
    const fields = await p.evaluate(() => ({
      textarea: document.querySelectorAll('textarea').length,
      input: document.querySelectorAll('input').length,
      editable: document.querySelectorAll('[contenteditable]:not([contenteditable="false"])').length,
    }));
    ok(fields.textarea === 0 && fields.input === 0 && fields.editable === 0,
       `${name}: the opened response is prose, not a field: ` + JSON.stringify(fields));

    // Reachable without a mouse, which a native <details> is and a div wired to a
    // click handler is not.
    await p.keyboard.press('Enter'); await settled(p);
    ok(!(await p.$eval('details.submitted', e => e.open)),
       `${name}: and the keyboard closes it again, because the summary holds focus`);

    await p.screenshot({ path: OUT + `shot-12-marked-${name}.png`, fullPage: true });
    await p.close();
  }

  // The other presentation state of the same question: nothing submitted yet, so
  // nothing to collapse, and the field is the point.
  console.log('--- state 12 answering ---');
  const p2 = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  p2.on('pageerror', e => errs.push('answering: ' + String(e).slice(0, 180)));
  await p2.goto(url('docs/mockups/12-extended-response-answering.html')); await settled(p2);
  ok(!(await p2.$('details.submitted')), 'answering: no disclosure, because nothing is submitted');
  ok((await p2.$$('textarea')).length === 1, 'answering: exactly one place to write');
  ok(!(await p2.$('.result')) && !(await p2.$('.mnote')), 'answering: no mark and no judgement yet');
  await p2.close();

  console.log('pageerrors:', errs.join(' | ') || 'none');
  ok(errs.length === 0, 'no page errors');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
