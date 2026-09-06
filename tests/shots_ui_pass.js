// THE SCREENSHOTS FOR THE UI CONSISTENCY PASS.
//
// Not a test. It renders the surfaces that were changed so they can be reviewed
// as pictures rather than as a description of pictures.
//
// The successful Coach Feedback shot is driven by a UI FIXTURE: a stubbed worker
// response, declared here in full, so the layout can be reviewed deterministically.
// It is not evidence that the deployed worker works, and nothing in it is a real
// model answer. Gate 1 is where a genuine deployed worker is confirmed.
const { chromium, T, planAll, chooseQuestion } = require("./env");
const fs = require("fs");
const D = __dirname + "/out/ui-pass/";
fs.mkdirSync(D, { recursive: true });
const shot = async (p, n, el) => {
  const t = el ? await p.$(el) : null;
  await (t || p).screenshot({ path: D + n + ".png" });
  console.log("  ->", n + (el ? "  [" + el + "]" : ""));
};

// A UI FIXTURE. Every string here was written for this screenshot, by us, to
// exercise each block of the panel. It is not a marking judgement and it is not
// a model's output.
const UI_FIXTURE = {
  note: "The relationship is stated and the element is named. What is missing is the reason one follows from the other, which is what Explain is asking for.",
  missing: ["explain"],
  nudges: [
    { text: "What is it about this market that makes the ordering step the one that matters?", category: "on_target" },
    { text: "Would the same argument hold for a market that is not price sensitive?", category: "on_target" },
    { text: "Could this sentence name the element earlier?", category: "signposting" },
  ],
  chips: [{ from: "a lot of", options: ["many", "a majority of"] }],
  check: "If you have stated a date or figure, check it against your own notes before you rely on it.",
};

const SENT = [
  "Convenience-oriented customers lead a business towards processes because effort is the cost they weigh.",
  "The business responds by ordering its steps so that fewer of them fall to the customer.",
  "Mobile ordering removes the queue, which is the step this market treats as the price of buying.",
  "Because the step is removed, the same customer returns more often than one who must queue.",
  "So the target market changes the processes element rather than only the promotion around it.",
  "That is why processes is the element this market decides.",
  "The ordering of the steps is therefore set by who is buying.",
];

async function toWriting(p) {
  await p.goto(T); await p.waitForTimeout(700);
  await p.evaluate(() => Object.keys((window.BUSCONTENT || {}).evidence || {}).forEach(k =>
    window.BUSCONTENT.evidence[k].forEach(e => { e.source = "test fixture source"; e.checked = "2026-08-19"; })));
  await p.$$eval(".navtab", es => { const t = es.find(x => /Essay practice/i.test(x.textContent)); t && t.click(); });
  await p.waitForTimeout(400);
  await p.selectOption("#essubject", "business_studies"); await p.waitForTimeout(300);
  return p;
}
async function intoBody1(p) {
  await chooseQuestion(p, /target markets/i); await p.waitForTimeout(250);
  await p.click("#esstart"); await p.waitForTimeout(500);
  await planAll(p);
  await p.$$eval(".es-plancard [data-esplanarea]", es => { const t = es.find(x => /processes/i.test(x.textContent)); t && t.click(); });
  await p.waitForTimeout(300);
  await p.$$eval("[data-esplanpick]", es => { const t = es.find(x => /Convenience-oriented/i.test(x.textContent)); t && t.click(); });
  await p.waitForTimeout(300);
  await p.$$eval(".es-plancard .es-evchip", es => es[0] && es[0].click()); await p.waitForTimeout(250);
  await p.click("#esplango"); await p.waitForTimeout(400);
  await p.$$eval("[data-esgo]", es => { const t = es.find(x => /Body 1/.test(x.textContent)); t && t.click(); });
  await p.waitForTimeout(500);
}
async function writeOut(p) {
  for (const t of SENT) {
    if (await p.$(".es-done")) break;
    if (!(await p.$("#esline"))) break;
    await p.fill("#esline", t);
    const a = await p.$("#esaccept"); if (!a || await a.isDisabled()) break;
    await a.click(); await p.waitForTimeout(400);
  }
}

(async () => {
  const b = await chromium.launch();
  const mk = async (w, h) => {
    const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 })).newPage();
    await p.route(/workers\.dev/, r => r.abort());
    return p;
  };

  console.log("desktop 1500x1180");
  let p = await mk(1500, 1180);
  await toWriting(p);
  await shot(p, "01-setup-home");
  await p.click('.qp-nav [data-esnav="essays"]'); await p.waitForTimeout(400);
  await shot(p, "02-my-essays-home");
  await p.click('.qp-nav [data-esnav="back"]'); await p.waitForTimeout(400);
  await intoBody1(p);
  await shot(p, "03-workspace-exit-essay");
  await shot(p, "04-workspace-header", ".es-top");
  await shot(p, "05-sentence-help-in-context", ".es-guide, .es-prompt, .es-promptwrap");
  await p.click("#esshape"); await p.waitForTimeout(400);
  await shot(p, "06-sentence-shape-open");
  await p.click("#esshape"); await p.waitForTimeout(300);
  await writeOut(p);
  await p.$eval(".es-done", e => e.scrollIntoView({ block: "center" })).catch(() => {});
  await p.waitForTimeout(250);
  await shot(p, "07-paragraph-complete", ".es-done");

  // B. the worker fails: the student is warned, and told the guidance is not theirs
  const ask = await p.$("#esask"); if (ask) { await ask.click(); await p.waitForTimeout(1400); }
  await p.$eval(".es-margin", e => e.scrollIntoView({ block: "center" })).catch(() => {});
  await p.waitForTimeout(250);
  await shot(p, "09-coach-feedback-B-worker-failed", ".es-margin");
  await p.$eval(".es-done", e => e.scrollIntoView({ block: "start" })).catch(() => {});
  await p.waitForTimeout(250);
  await shot(p, "10-full-page-complete-and-feedback");
  await p.context().close();

  // A. the worker answers: a UI FIXTURE, declared at the top of this file
  console.log("successful coach feedback (UI fixture)");
  p = await mk(1500, 1180);
  await p.unroute(/workers\.dev/).catch(() => {});
  await p.route(/workers\.dev/, r => r.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify(UI_FIXTURE) }));
  await toWriting(p);
  await intoBody1(p);
  await writeOut(p);
  const ask2 = await p.$("#esask"); if (ask2) { await ask2.click(); await p.waitForTimeout(1600); }
  const banner = await p.$(".es-demonote");
  console.log("  fixture answered live:", !banner ? "yes, no fallback banner" : "NO - still showing the fallback");
  await p.$eval(".es-margin", e => e.scrollIntoView({ block: "center" })).catch(() => {});
  await p.waitForTimeout(250);
  await shot(p, "08-coach-feedback-A-successful", ".es-margin");
  await p.context().close();

  // The narrow viewport, where a four-action row has to survive wrapping. The
  // picker is driven at desktop width because its question rows are laid out for
  // one, and the viewport is narrowed once the student is in the writing: the
  // state under review is the composer at 430px, not the route to it.
  console.log("narrow 430x900");
  p = await mk(1500, 1180);
  await toWriting(p);
  await intoBody1(p);
  await writeOut(p);
  await p.setViewportSize({ width: 430, height: 900 });
  await p.waitForTimeout(600);
  await p.$eval(".es-done", e => e.scrollIntoView({ block: "center" })).catch(() => {});
  await p.waitForTimeout(300);
  await shot(p, "11-narrow-paragraph-complete", ".es-done");
  await shot(p, "12-narrow-workspace");
  const wrap = await p.$$eval(".es-donebtns button", es => es.map(e => {
    const r = e.getBoundingClientRect(), c = getComputedStyle(e);
    return { id: e.id, top: Math.round(r.top), h: Math.round(r.height),
      bg: c.backgroundColor, border: c.borderColor, colour: c.color,
      overflow: r.right > document.documentElement.clientWidth };
  }));
  console.log("  narrow Paragraph complete actions:");
  wrap.forEach(x => console.log("   ", JSON.stringify(x)));
  console.log("  all four present:", wrap.length === 4, " none overflowing:", wrap.every(x => !x.overflow),
    " one height:", new Set(wrap.map(x => x.h)).size === 1);
  await shot(p, "13-narrow-workspace-header", ".es-top");
  await p.click("#esmenu"); await p.waitForTimeout(350);
  await shot(p, "14-narrow-menu-open");
  await p.keyboard.press("Escape"); await p.waitForTimeout(250);
  // the picker at the same width, since its bar is the same component
  await p.click("#esexit"); await p.waitForTimeout(400);
  await p.$$eval(".navtab", es => { const t = es.find(x => /Essay practice/i.test(x.textContent)); t && t.click(); });
  await p.waitForTimeout(500);
  await shot(p, "15-narrow-setup-header");
  await p.click("#esmenu"); await p.waitForTimeout(350);
  await shot(p, "16-narrow-setup-menu-open");
  await p.keyboard.press("Escape"); await p.waitForTimeout(250);
  // The subject shown in two places at once: the menu heading and the form. They
  // read one committed value, so the shot is of them agreeing.
  await p.$$eval('[data-espick="own"]', es => es[0] && es[0].click()); await p.waitForTimeout(400);
  await p.selectOption("#essubject", "business_studies").catch(() => {});
  await p.waitForTimeout(400);
  await p.click("#esmenu"); await p.waitForTimeout(350);
  await shot(p, "17-narrow-subject-context");
  const agree = await p.evaluate(() => {
    const sel = document.getElementById("essubject");
    const bar = document.querySelector(".qp-subj");
    return { form: sel && sel.options[sel.selectedIndex] && sel.options[sel.selectedIndex].text,
      menu: bar && bar.textContent.trim() };
  });
  console.log("  subject shown in the form:", JSON.stringify(agree.form), " in the menu:", JSON.stringify(agree.menu));
  await p.keyboard.press("Escape"); await p.waitForTimeout(200);
  await p.setViewportSize({ width: 1500, height: 1180 }); await p.waitForTimeout(400);

  await p.context().close();

  await b.close();
})();
