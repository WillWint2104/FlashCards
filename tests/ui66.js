// THE OPTIONAL DEPTH, AND WHAT IS HONESTLY NOT THERE.
//
// Three windows sit beside the paragraph review, and the rule for all of them is
// the same: they are OPTIONAL, they are AUTHORED, and they never touch the
// student's prose or the page underneath.
//
//   More help          what this structural job is, and the other authored shapes
//                      it can take. No invented "common problems" list: nothing in
//                      this repository authors one.
//   Complete example   same subject, different question, whole paragraph, labelled
//                      by structural part. Business Studies ships two for a TEEEC
//                      body and NONE for an introduction or a conclusion, so the
//                      control is offered on one and withheld on the others. It is
//                      not filled with the Ancient History set, which is what the
//                      worked-example fallback is for and is a different promise.
//   Term card          what the term means, and what it means in this question,
//                      rendering whichever of those is authored. There are no
//                      displayable vocabulary records in this build, so today it
//                      opens with the question note alone rather than a definition
//                      written to fill the space above it.
//
// The last of those is the one worth stating: an empty vocabulary library does not
// mean the highlighted terms stop working. It means half the card is absent.
const { chromium, T, usePractice } = require("./env");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log("  FAIL:", m); } };
const rf = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

async function enter(p) {
  await p.goto(T); await p.waitForSelector(".navtab", { timeout: 8000 });
  await p.evaluate(() => localStorage.removeItem("marginal.essay.v1"));
  await p.goto(T); await p.waitForSelector(".navtab", { timeout: 8000 });
  await p.$$eval(".navtab", es => { const t = es.find(x => /Essay practice/i.test(x.textContent)); t && t.click(); });
  await p.waitForSelector("#essubject", { timeout: 8000 });
  await p.selectOption("#essubject", "business_studies");
  await usePractice(p);
}
async function startQuestion(p, re) {
  const got = await p.evaluate(r => {
    const t = [...document.querySelectorAll(".qp-row")].find(x => new RegExp(r, "i").test(x.textContent));
    if (t) { t.click(); return true; } return false; }, re);
  if (!got) return false;
  await p.waitForTimeout(300);
  await p.evaluate(() => { const b = document.querySelector('[data-espick="preview"]'); b && b.click(); });
  await p.waitForSelector("#esstart", { timeout: 8000 }).catch(() => {});
  await p.click("#esstart");
  await p.waitForFunction(() => !!document.querySelector("#esline, .es-startrow"), null, { timeout: 8000 });
  return true;
}
async function section(p, re) {
  await p.evaluate(r => { const t = [...document.querySelectorAll(".es-startrow")].find(x => new RegExp(r, "i").test(x.textContent)); t && t.click(); }, re);
  await rf(p); await p.waitForTimeout(300);
  const pth = await p.$("[data-espath]"); if (pth) { await pth.click(); await rf(p); }
  const go = await p.$("#esstartwriting"); if (go) { await go.click(); await rf(p); }
  await p.waitForTimeout(300);
  return !!(await p.$("#esline"));
}
async function stubAll(p) {
  await p.unroute(/workers\.dev/).catch(() => {});
  await p.route(/workers\.dev/, async route => {
    let body = {};
    try { body = JSON.parse(route.request().postData() || "{}"); } catch (e) { /* not json */ }
    const slots = body.slots || [];
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      note: "", nudges: [],
      slotFeedback: slots.map((s, i) => {
        const own = (body.blocks || []).find(x => x.slot === s.key);
        if (!own) return { slot: s.key, status: "missing", blockId: "", issue: "Nothing is doing this job yet." };
        return { slot: s.key, status: i === 0 ? "needs_work" : "ok", blockId: own.id,
          issue: i === 0 ? "You state the relationship but do not yet show what causes it." : "" };
      }),
    }) });
  });
}
async function writeAndCheck(p, lines) {
  for (const l of lines) {
    if (!(await p.$("#esline"))) break;
    await p.fill("#esline", l); await p.click("#esaccept"); await p.waitForTimeout(320);
  }
  for (const sel of ["#esrecheck", "#esask", "#esdonecheck"]) {
    const b = await p.$(sel);
    if (b && await b.isEnabled()) { await b.click(); await p.waitForTimeout(1200); return true; }
  }
  return false;
}

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1100 } })).newPage();
  await stubAll(p);

  // ---- 1. the introduction and conclusion render THEIR model --------------
  console.log("--- 1. intro and conclusion render the model they declare");
  const model = await (async () => {
    await enter(p);
    return p.evaluate(() => ({
      intro: window.ESSAY.slots.roleSets.introduction.map(x => x.key),
      concl: window.ESSAY.slots.roleSets.conclusion.map(x => x.key),
    }));
  })();
  console.log("    authored:", JSON.stringify(model));
  ok(await startQuestion(p, "target markets"), "the question opens");
  ok(await section(p, "Introduction"), "the introduction opens");
  await writeAndCheck(p, [
    "A target market is a specific group of customers with shared needs and characteristics.",
    "Target markets shape the marketing strategies a business develops.",
  ]);
  let tabs = await p.$$eval(".es-rtab", es => es.map(e => e.innerText.trim()));
  console.log("    introduction tabs:", JSON.stringify(tabs));
  ok(tabs.length === model.intro.length,
    "the introduction shows its authored " + model.intro.length + " parts, not the three a mockup drew: " + tabs.length);
  ok(/thesis/i.test(tabs.join(" ")), "one of which is the thesis");
  ok(!/context/i.test(tabs.join(" ")), "and no Context part was invented to match a picture");
  // The example control has nothing authored behind it for an introduction.
  ok(!(await p.$("#esrexample")), "no complete-introduction control is offered");
  const why = await p.$eval(".es-rhint", e => e.innerText).catch(() => "");
  ok(/no complete introduction/i.test(why), "and the absence is stated: " + JSON.stringify(why.slice(0, 70)));
  ok(/nothing from another subject/i.test(why), "with the promise that nothing is borrowed for it");

  console.log("--- 1b. the conclusion, the same way");
  await p.evaluate(() => { const t = document.querySelector('[data-esrestchange], .es-btn'); void t; });
  await p.$$eval("[data-esrespgo]", es => { const t = es[es.length - 1]; t && t.click(); }).catch(() => {});
  await p.waitForTimeout(400);
  const onConcl = await section(p, "Conclusion").catch(() => false);
  if (!onConcl) {
    await p.evaluate(() => { const o = document.querySelector("#esfootoutline"); o && o.click(); });
    await p.waitForTimeout(400);
    await p.$$eval("[data-esgo]", es => { const t = es.find(x => /Conclusion/i.test(x.textContent)); t && t.click(); });
    await p.waitForTimeout(500);
  }
  await writeAndCheck(p, [
    "Overall, target markets influence how businesses design their marketing strategies.",
    "Together these strategies allow the business to meet customer needs.",
  ]);
  tabs = await p.$$eval(".es-rtab", es => es.map(e => e.innerText.trim()));
  console.log("    conclusion tabs:", JSON.stringify(tabs));
  ok(tabs.length === model.concl.length,
    "the conclusion shows its authored " + model.concl.length + " parts, not three: " + tabs.length);
  ok(!(await p.$("#esrexample")), "and no complete-conclusion control is offered either");

  // ---- 2. the body DOES have one, and it is same-subject, different question
  console.log("--- 2. a body paragraph has a complete example, and it is honest");
  // A fresh attempt rather than a walk back through the outline: what is under
  // test is the body review, not the route to it, and ui57 owns the route.
  await enter(p);
  ok(await startQuestion(p, "target markets"), "a fresh attempt opens");
  ok(await section(p, "Body 1"), "a body paragraph opens");
  await writeAndCheck(p, [
    "Convenience-oriented customers value speed and low effort.",
    "Because these customers prefer quick service, the business can simplify its ordering process.",
  ]);
  const exBtn = await p.$("#esrexample");
  ok(!!exBtn, "the control is offered on a body paragraph");
  const exLabel = exBtn ? await exBtn.innerText() : "";
  ok(/TEEEC/i.test(exLabel), "and names the structure it is an example of: " + JSON.stringify(exLabel.trim()));
  const paraBefore = await p.$eval(".es-cols, .es-canvas", e => e.innerText).catch(() => "");
  if (exBtn) { await exBtn.click(); await p.waitForTimeout(400); }
  const modal = await p.$eval(".es-modal", e => e.innerText.replace(/\s+/g, " ")).catch(() => "");
  console.log("    example window:", JSON.stringify(modal.slice(0, 110)));
  ok(/different question/i.test(modal), "the window says it is a different question");
  ok(/not an answer to your question/i.test(modal), "and that it is not an answer to theirs");
  const rowsIn = await p.$$eval(".es-extable tr", es => es.map(e => e.innerText.replace(/\s+/g, " ")));
  ok(rowsIn.length >= 5, "every structural part of the example is labelled: " + rowsIn.length + " rows");
  ok(!/target market/i.test(modal), "and it is not about the student's own question: " + JSON.stringify(modal.slice(0, 60)));
  // A complete paragraph from ANOTHER SUBJECT would be the borrowing this refuses.
  const ahLeak = /sparta|egypt|pharaoh|spartan/i.test(modal);
  ok(!ahLeak, "no Ancient History example was borrowed to fill a Business Studies window");
  const paraAfter = await p.$eval(".es-cols, .es-canvas", e => e.innerText).catch(() => "");
  ok(paraBefore === paraAfter, "and opening it changed nothing in the writer");
  await p.keyboard.press("Escape"); await p.waitForTimeout(300);
  ok(!(await p.$(".es-modal")), "Escape closes it");

  // ---- 3. More help is authored, optional, and harmless ------------------
  console.log("--- 3. More help");
  const draftText = "A half-typed revision the student has not saved yet";
  await p.fill("[data-esrbox]", draftText);
  const hp = await p.$("#esrhelp");
  ok(!!hp, "the control is there");
  if (hp) { await hp.click(); await p.waitForTimeout(400); }
  const help = await p.$eval(".es-modal", e => e.innerText.replace(/\s+/g, " ")).catch(() => "");
  console.log("    more help:", JSON.stringify(help.slice(0, 100)));
  ok(/what this part does/i.test(help), "it says what the structural job is");
  ok(help.length < 900, "and stays short rather than becoming a second report: " + help.length + " chars");
  ok(!/common problems/i.test(help), "with no invented common-problems list");
  await p.$eval("#esmodalclose", e => e.click()); await p.waitForTimeout(300);
  ok(!(await p.$(".es-modal")), "Close puts it away");
  const kept = await p.$eval("[data-esrbox]", e => e.value).catch(() => "");
  ok(kept === draftText, "and the half-typed revision survived it: " + JSON.stringify(kept.slice(0, 30)));
  const paraNow = await p.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("marginal.essay.v1") || "{}");
    const d = Object.values(raw).flatMap(bk => (bk && bk.drafts) || [])[0];
    return (d.paras || []).map(x => x.text || "").join(" ");
  });
  ok(paraNow.indexOf(draftText) < 0, "nothing typed in the box reached the essay without Save");

  // ---- 4. the term card ---------------------------------------------------
  console.log("--- 4. a highlighted term, from whatever is authored");
  const vocab = await p.evaluate(() => Object.keys(((window.ESSAY || {}).vocab || {}).records || {}).length);
  console.log("    displayable vocabulary records in this build:", vocab);
  const beforeH = await p.evaluate(() => document.documentElement.scrollHeight);
  const opened = await p.evaluate(() => {
    const t = [...document.querySelectorAll("[data-esdecode]")].find(x => /physical evidence/i.test(x.textContent));
    if (!t) return false; t.click(); return true;
  });
  ok(opened, "the highlighted term is pressable");
  await p.waitForTimeout(350);
  const card = await p.$eval(".es-termcard", e => e.innerText.replace(/\s+/g, " ")).catch(() => "");
  console.log("    card:", JSON.stringify(card.slice(0, 130)));
  ok(!!card, "it opens a card");
  ok(/physical evidence/i.test(card), "naming the term");
  ok(/In this question/i.test(card), "with the authored question context");
  ok(/surroundings|layout|presentation/i.test(card), "which is the question's own words about it");
  ok((await p.evaluate(() => document.documentElement.scrollHeight)) === beforeH,
    "and the page underneath did not move");
  ok(!(await p.$(".es-termdef")) || vocab > 0,
    "no definition was invented to fill the half of the card the library cannot supply");
  ok((await p.$$eval(".es-termcard", es => es.length)) === 1, "exactly one card is open");
  await p.keyboard.press("Escape"); await p.waitForTimeout(300);
  ok(!(await p.$(".es-termcard")), "Escape closes it");
  await p.evaluate(() => {
    const t = [...document.querySelectorAll("[data-esdecode]")].find(x => /physical evidence/i.test(x.textContent));
    t && t.click();
  });
  await p.waitForTimeout(300);
  await p.$eval("[data-esmodalscrim]", e => {
    const r = e.getBoundingClientRect();
    e.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: r.left + 4, clientY: r.top + 4 }));
  });
  await p.waitForTimeout(300);
  ok(!(await p.$(".es-termcard")), "and pressing away from it closes it");
  const stillDraft = await p.$eval("[data-esrbox]", e => e.value).catch(() => "");
  ok(stillDraft === draftText, "the revision box was never remounted through any of that");

  console.log("--- 4b. at phone width the same content arrives as a sheet");
  await p.setViewportSize({ width: 390, height: 900 });
  await p.waitForFunction(() => document.documentElement.clientWidth === 390, null, { timeout: 4000 });
  await p.evaluate(() => {
    const t = [...document.querySelectorAll("[data-esdecode]")].find(x => /physical evidence/i.test(x.textContent));
    t && t.click();
  });
  await p.waitForTimeout(400);
  const sheet = await p.evaluate(() => {
    const c = document.querySelector(".es-termcard"); if (!c) return null;
    const r = c.getBoundingClientRect();
    return { bottom: Math.round(window.innerHeight - r.bottom), width: Math.round(r.width),
      vw: document.documentElement.clientWidth, out: r.right > window.innerWidth + 1 || r.left < -1 };
  });
  console.log("    sheet:", JSON.stringify(sheet));
  ok(sheet && sheet.bottom <= 2, "it sits against the bottom of the screen rather than floating");
  ok(sheet && !sheet.out, "and nothing runs off the side");
  await p.keyboard.press("Escape"); await p.waitForTimeout(250);
  await p.setViewportSize({ width: 1500, height: 1100 });

  // ---- 5. planning is optional and writing is one press away -------------
  console.log("--- 5. the way into writing");
  await enter(p);
  ok(await startQuestion(p, "target markets"), "a fresh attempt opens");
  const go = await p.evaluate(() => {
    const el = document.querySelector(".es-startgo");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const rows = document.querySelector(".es-startrows");
    return { text: el.innerText.replace(/\s+/g, " "), top: Math.round(r.top),
      rowsTop: rows ? Math.round(rows.getBoundingClientRect().top) : null,
      btn: !!document.querySelector("#esstartintro") };
  });
  ok(go && go.btn, "there is a Start writing action");
  ok(go && /start writing/i.test(go.text), "named plainly: " + JSON.stringify(String(go && go.text).slice(0, 40)));
  ok(go && /optional/i.test(go.text), "and planning is stated to be optional");
  ok(go && go.rowsTop != null && go.top < go.rowsTop, "and it sits above the plan, not under it");
  await p.click("#esstartintro"); await p.waitForTimeout(600);
  ok(!!(await p.$("#esline, [data-espath], #esstartwriting")),
    "pressing it goes straight to writing without completing a plan");

  console.log("");
  console.log(pass + " passed, " + fail + " failed");
  await b.close();
  process.exit(fail ? 1 : 0);
})();
