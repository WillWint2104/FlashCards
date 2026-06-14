// =============================================================================
// Marginal trial — app logic (single-file preview build)
// Adds to the repo build: safe storage wrapper (works in sandboxed previews),
// a Create tab to build your own flashcard sets, and JSON export / import.
// =============================================================================
(function () {
  "use strict";
  const C = window.CONTENT;
  const CONFIG = window.MARGINAL_CONFIG || {}; // teacher-set defaults (see index.html)
  const LS_KEY = "marginal.trial.v1";
  const BOX_DAYS = { 1: 0, 2: 1, 3: 3, 4: 7, 5: 14 };
  const SET_FORMAT = "marginal-set@1";

  // ---------- storage: localStorage where allowed, in-memory otherwise ----------
  const store = (() => {
    try { localStorage.setItem("__t", "1"); localStorage.removeItem("__t"); return localStorage; }
    catch { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } }; }
  })();
  const persistent = (() => { try { localStorage.setItem("__t","1"); localStorage.removeItem("__t"); return true; } catch { return false; } })();

  // ---------- state ----------
  const state = load();
  function load() {
    try { return JSON.parse(store.getItem(LS_KEY)) || blank(); } catch { return blank(); }
    function blank() { return { cards: {}, endpoint: "", code: "", log: [], customSets: [], lessons: {} }; }
  }
  state.customSets = state.customSets || [];
  state.lessons = state.lessons || {};
  if (!state.endpoint && CONFIG.endpoint) state.endpoint = CONFIG.endpoint;
  if (!state.code && CONFIG.code) state.code = CONFIG.code;
  function mergeCustomGlossaries() {
    state.customSets.forEach(s => { if (s.glossary) Object.keys(s.glossary).forEach(k => { C.glossary[k.toLowerCase()] = s.glossary[k]; }); });
  }
  mergeCustomGlossaries();
  function save() { store.setItem(LS_KEY, JSON.stringify(state)); }
  const BACKUP_FORMAT = "marginal-backup@1";
  function download(filename, text, mime) {
    const blob = new Blob([text], { type: mime || "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  function backupAll() {
    const payload = {
      format: BACKUP_FORMAT, exported: new Date().toISOString(),
      subject: C.subject || "",
      data: { cards: state.cards, lessons: state.lessons, log: state.log, customSets: state.customSets }
    };
    const stamp = new Date().toISOString().slice(0, 10);
    download("marginal-backup-" + stamp + ".json", JSON.stringify(payload, null, 2));
    toast("Backup downloaded — keep it safe.");
  }
  function restoreAll(text) {
    let obj;
    try { obj = JSON.parse(text); } catch { return { ok: false, msg: "That file isn't valid JSON." }; }
    if (!obj || obj.format !== BACKUP_FORMAT || !obj.data) return { ok: false, msg: "That doesn't look like a Marginal backup file." };
    const d = obj.data;
    // merge: keep the better progress per card, union custom sets by name
    state.cards = state.cards || {};
    Object.keys(d.cards || {}).forEach(id => {
      const cur = state.cards[id], inc = d.cards[id];
      if (!cur || (inc && (inc.box || 0) >= (cur.box || 0))) state.cards[id] = inc;
    });
    state.lessons = Object.assign({}, d.lessons || {}, state.lessons); // existing mastery wins
    Object.keys(d.lessons || {}).forEach(k => { if (!state.lessons[k]) state.lessons[k] = d.lessons[k]; });
    if (Array.isArray(d.customSets)) {
      const names = new Set(state.customSets.map(s => s.name));
      let added = 0;
      d.customSets.forEach(s => { if (!names.has(s.name)) { state.customSets.push(s); added++; } });
      mergeCustomGlossaries();
    }
    if (Array.isArray(d.log)) state.log = state.log.concat(d.log);
    save();
    return { ok: true, msg: "Backup restored — your sets and progress are merged in." };
  }
  function cardState(id) {
    return state.cards[id] || (state.cards[id] = { box: 1, due: 0, seen: 0, correct: 0, lastScore: null });
  }

  let currentTopic = null;
  function customAsArea(s) {
    return { id: s.id, name: s.name, icon: "🧩", custom: true,
      blurb: "Your set · " + s.cards.length + " card" + (s.cards.length === 1 ? "" : "s"),
      cards: s.cards };
  }
  function findArea(id) {
    for (const t of C.topics) { const a = (t.areas || []).find(x => x.id === id); if (a) return a; }
    const s = state.customSets.find(x => x.id === id);
    return s ? customAsArea(s) : null;
  }
  function getLesson(id) {
    for (const a of C.areas) { const l = (a.lessons || []).find(x => x.id === id); if (l) return l; }
    return null;
  }
  function lvObj(lessonId) {
    let v = state.lessons[lessonId];
    if (v === true) { // migrate legacy boolean: counts as all levels done
      const l = getLesson(lessonId);
      v = { lv: {} };
      (l && l.levels || []).forEach((_, i) => v.lv[i] = 1);
      state.lessons[lessonId] = v;
    }
    if (!v || typeof v !== "object") { v = { lv: {} }; state.lessons[lessonId] = v; }
    if (!v.lv) v.lv = {};
    return v;
  }
  function levelsDone(lesson) {
    if (!lesson.levels) return state.lessons[lesson.id] ? 1 : 0;
    const v = lvObj(lesson.id);
    return lesson.levels.reduce((n, _, i) => n + (v.lv[i] ? 1 : 0), 0);
  }
  function lessonMastered(lesson) {
    if (!lesson.levels) return !!state.lessons[lesson.id];
    return levelsDone(lesson) === lesson.levels.length;
  }

  // ---------- grading ----------
  const norm = s => (s || "").toLowerCase().replace(/[^a-z0-9.\-% ]/g, " ").replace(/\s+/g, " ").trim();

  function gradeMC(card, choiceIdx) {
    const ch = card.choices[choiceIdx];
    return { score: ch.ok ? card.marks : 0, max: card.marks, kind: "mc",
             correct: ch.ok, why: ch.why || "", answerText: card.choices.find(c => c.ok).t };
  }
  function gradeCalc(card, answer) {
    const got = parseFloat(String(answer).replace(/[^0-9.\-]/g, ""));
    const ok = Number.isFinite(got) && Math.abs(got - card.expected) <= card.tolerance;
    return { score: ok ? card.marks : 0, max: card.marks, kind: "calc",
             correct: ok, working: card.working || "", model: card.model };
  }
  function gradeLocal(card, answer) {
    const a = norm(answer);
    const need = card.vocab || [];
    const hit = need.filter(t => a.includes(norm(t)));
    const modelWords = new Set(norm(card.model).split(" ").filter(w => w.length > 3));
    const gotWords = new Set(a.split(" ").filter(w => w.length > 3));
    let overlap = 0;
    if (modelWords.size) { let n = 0; gotWords.forEach(w => { if (modelWords.has(w)) n++; }); overlap = n / modelWords.size; }
    const lengthOk = a.split(" ").length >= card.marks * 8;
    let ratio = (need.length ? 0.55 * (hit.length / need.length) : 0.3) + 0.35 * Math.min(overlap * 1.6, 1) + (lengthOk ? 0.1 : 0);
    ratio = Math.max(0, Math.min(1, ratio));
    return { score: Math.round(ratio * card.marks), max: card.marks, kind: "local",
             matched: hit, missing: need.filter(t => !hit.includes(t)), model: card.model };
  }
  async function gradeEssay(card, answer) {
    if (state.endpoint) {
      try {
        const res = await fetch(state.endpoint, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ prompt: card.prompt, marks: card.marks, model_answer: card.model, vocab: card.vocab, answer, code: state.code || undefined })
        });
        if (!res.ok) throw new Error("proxy " + res.status);
        const g = await res.json();
        return { score: Math.min(g.score ?? 0, card.marks), max: card.marks, kind: "llm", fb: g };
      } catch (e) {
        return demoEssay(card, answer, "Couldn't reach your grading endpoint (" + e.message + ") — showing a demo grade instead.");
      }
    }
    return demoEssay(card, answer, "Demo grade — connect a grading endpoint in Settings for real AI marking.");
  }
  function demoEssay(card, answer, note) {
    const a = norm(answer);
    const need = card.vocab || [];
    const hit = need.filter(t => a.includes(norm(t)));
    const paras = answer.split(/\n\s*\n/).filter(p => p.trim().length > 40);
    const words = a.split(" ").length;
    let ratio = 0.5 * (need.length ? hit.length / need.length : 0.4)
              + 0.3 * Math.min(words / (card.marks * 35), 1)
              + 0.2 * Math.min(paras.length / 4, 1);
    ratio = Math.max(0.05, Math.min(0.85, ratio));
    const fb = {
      overall: { summary: note + " Structure detected: " + paras.length + " paragraph(s), " + words + " words." },
      criteria: [
        { name: "Required metalanguage", status: need.length === 0 ? "met" : hit.length >= need.length * 0.7 ? "met" : hit.length ? "partial" : "missing",
          comment: need.length ? hit.length + " of " + need.length + " key terms used." : "No required terms set for this card." },
        { name: "Development (length & paragraphs)", status: words >= card.marks * 30 && paras.length >= 3 ? "met" : "partial",
          comment: "Aim for roughly " + (card.marks * 35) + "+ words across 4–5 paragraphs for " + card.marks + " marks." }
      ],
      missing_vocabulary: need.filter(t => !hit.includes(t)),
      next_steps: ["This is a structural check only — it cannot judge your reasoning. Compare your answer with the guide below, then connect an endpoint for real marking."]
    };
    return { score: Math.round(ratio * card.marks), max: card.marks, kind: "demo", fb };
  }

  // ---------- scheduling ----------
  function applyResult(card, score, max) {
    const cs = cardState(card.id);
    cs.seen++;
    const ratio = max ? score / max : 0;
    if (ratio >= 0.7) { cs.correct++; cs.box = Math.min(5, cs.box + 1); }
    else if (ratio < 0.4) cs.box = 1;
    cs.due = Date.now() + BOX_DAYS[cs.box] * 86400000;
    cs.lastScore = ratio;
    state.log.push({ t: Date.now(), id: card.id, r: ratio });
    save();
  }
  function areaStats(area) {
    let mastered = 0, attempted = 0;
    area.cards.forEach(c => {
      const cs = state.cards[c.id];
      if (cs && cs.seen) attempted++;
      if (cs && cs.box >= 4) mastered++;
    });
    return { total: area.cards.length, attempted, mastered, pct: area.cards.length ? Math.round(100 * mastered / area.cards.length) : 0 };
  }
  function dueCards(area) {
    const now = Date.now();
    return area.cards.filter(c => { const cs = state.cards[c.id]; return !cs || cs.due <= now; })
                     .sort((a, b) => (cardState(a.id).box - cardState(b.id).box));
  }

  // ---------- rendering ----------
  const $ = sel => document.querySelector(sel);
  const app = $("#app");
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

  function linkGlossary(text) {
    let html = esc(text);
    Object.keys(C.glossary).sort((a, b) => b.length - a.length).forEach(term => {
      const re = new RegExp("\\b(" + term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")\\b", "i");
      if (re.test(html) && !html.includes('class="term"')) {
        html = html.replace(re, '<span class="term" data-term="' + esc(term) + '">$1</span>');
      }
    });
    return html;
  }

  let session = null;
  let view = "study"; // 'study' | 'create'

  function nav() {
    return `<div class="nav">
      <button class="navtab ${view === "study" ? "on" : ""}" data-v="study">Study</button>
      <button class="navtab ${view === "create" ? "on" : ""}" data-v="create">Create</button>
    </div>`;
  }
  function wireNav() {
    app.querySelectorAll(".navtab").forEach(b => b.onclick = () => { view = b.dataset.v; view === "study" ? home() : builder(); });
  }

  // ===================== STUDY =====================
  function home() { session = null; currentTopic ? areaMap(currentTopic) : mainPage(); }

  function mainPage() {
    view = "study"; session = null; currentTopic = null;
    const sets = state.customSets;
    app.innerHTML = `
      ${nav()}
      <div class="hi">What are we studying?</div>
      <div class="hi-s">${C.subject} · pick a topic${persistent ? "" : " · preview mode: progress resets when this page closes"}</div>
      <div class="topics">
        ${C.topics.map(t => {
          const stats = (t.areas || []).map(areaStats);
          const total = stats.reduce((n, s) => n + s.total, 0);
          const mastered = stats.reduce((n, s) => n + s.mastered, 0);
          const lessonsDone = (t.areas || []).reduce((n, a) => n + (a.lessons || []).filter(lessonMastered).length, 0);
          const lessonsAll = (t.areas || []).reduce((n, a) => n + (a.lessons || []).length, 0);
          return `<button class="topiccard ${t.locked ? "locked" : ""}" data-topic="${t.id}" ${t.locked ? "disabled" : ""}>
            <span class="ticon">${t.icon}</span>
            <span class="ainfo">
              <span class="aname">${esc(t.name)}</span>
              <span class="ablurb">${esc(t.blurb)}</span>
              ${t.locked ? `<span class="ameta">Coming soon</span>`
                : `<span class="abar"><i style="width:${total ? Math.round(100 * mastered / total) : 0}%"></i></span>
                   <span class="ameta">${lessonsDone}/${lessonsAll} lessons · ${mastered}/${total} questions mastered</span>`}
            </span>
          </button>`;
        }).join("")}
      </div>
      ${sets.length ? `<div style="margin-top:24px;font-family:var(--disp);font-weight:600;font-size:16px">Your sets</div>
      <div class="areas" style="margin-top:10px">${sets.map(s => { const a = customAsArea(s); const st = areaStats(a);
        return `<button class="area" data-area="${a.id}"><span class="aicon">🧩</span>
          <span class="ainfo"><span class="aname">${esc(a.name)}</span><span class="ablurb">${esc(a.blurb)}</span>
          <span class="abar"><i style="width:${st.pct}%"></i></span>
          <span class="ameta">${st.mastered}/${st.total} mastered</span></span></button>`; }).join("")}</div>` : ""}
      <div class="settings">
        <details>
          <summary>Settings — AI essay grading</summary>
          <p>${state.endpoint ? "AI marking: connected ✓" : "Extended answers get an instant demo grade — real AI marking switches on once your teacher connects it."}</p>
          ${state.endpoint ? `<input id="classcode" type="text" placeholder="Class code (only if your teacher gave you one)" value="${esc(state.code || "")}" style="max-width:240px">
          <button class="btn sm" id="saveEndpoint">Save</button>` : ""}
          <button class="btn sm ghost" id="resetAll">Reset my progress</button>
        </details>
        <details>
          <summary>Backup &amp; restore — your sets and progress</summary>
          <p>${persistent ? "Your work is saved in this browser. Clearing browser data or switching device will lose it — so download a backup to keep your sets and progress safe and move them anywhere." : "Preview mode can't save to this browser, so download a backup if you want to keep anything."}</p>
          <button class="btn sm" id="backupAll">⬇ Download my backup</button>
          <label class="btn sm ghost" for="restoreFile" style="cursor:pointer">⬆ Restore from a backup…</label>
          <input id="restoreFile" type="file" accept="application/json,.json" hidden>
          <span class="hint" id="restoreMsg"></span>
        </details>
      </div>`;
    wireNav();
    app.querySelectorAll(".topiccard:not(.locked)").forEach(b => b.onclick = () => areaMap(b.dataset.topic));
    app.querySelectorAll(".area").forEach(b => b.onclick = () => modePicker(b.dataset.area));
    const saveBtn = $("#saveEndpoint");
    if (saveBtn) saveBtn.onclick = () => { state.code = $("#classcode").value.trim(); save(); toast("Saved"); };
    $("#resetAll").onclick = () => { if (confirm("Clear all progress on this device?")) { state.cards = {}; state.log = []; state.lessons = {}; save(); mainPage(); } };
    $("#backupAll").onclick = backupAll;
    $("#restoreFile").onchange = e => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => { const res = restoreAll(String(r.result)); $("#restoreMsg").textContent = res.msg; if (res.ok) setTimeout(mainPage, 700); };
      r.readAsText(f);
    };
  }

  function areaMap(topicId) {
    view = "study"; session = null; currentTopic = topicId;
    const topic = C.topics.find(t => t.id === topicId);
    if (!topic) return mainPage();
    const totalDue = topic.areas.reduce((n, a) => n + dueCards(a).length, 0);
    app.innerHTML = `
      ${nav()}
      <div class="sessionbar"><button class="x" id="quit" title="All topics">←</button>
        <span class="lbl">${esc(topic.name)}</span></div>
      <div class="hi">Pick an area to master</div>
      <div class="hi-s">${totalDue} question${totalDue === 1 ? "" : "s"} ready now · learn the material first, then practise</div>
      <div class="areas">
        ${topic.areas.map(a => {
          const s = areaStats(a);
          const due = dueCards(a).length;
          const lessons = a.lessons || [];
          const learned = lessons.filter(lessonMastered).length;
          return `<button class="area" data-area="${a.id}">
            <span class="aicon">${a.icon}</span>
            <span class="ainfo">
              <span class="aname">${esc(a.name)}</span>
              <span class="ablurb">${esc(a.blurb)}</span>
              <span class="abar"><i style="width:${s.pct}%"></i></span>
              <span class="ameta">${lessons.length ? (learned === lessons.length ? "📖 learned · " : "📖 " + learned + "/" + lessons.length + " · ") : ""}${s.mastered}/${s.total} mastered${due ? " · " + due + " due" : ""}</span>
            </span>
          </button>`;
        }).join("")}
      </div>`;
    wireNav();
    $("#quit").onclick = mainPage;
    app.querySelectorAll(".area").forEach(b => b.onclick = () => modePicker(b.dataset.area));
  }

  const MODES = {
    flash: { label: "Flashcards", desc: "Flip, reveal, rate yourself", match: () => true },
    mc:    { label: "Multiple choice", desc: "Pick the right option", match: c => c.type === "mc" },
    short: { label: "Short answer", desc: "Type definitions, explanations & calcs", match: c => ["define", "short", "calc"].includes(c.type) },
    long:  { label: "Long answer", desc: "Full extended responses, marked", match: c => c.type === "essay" },
    mix:   { label: "Mixed practice", desc: "Everything, exam-style", match: () => true }
  };
  function hintFor(card) {
    if (card.hint) return card.hint;
    if (card.type === "calc" && card.working) {
      const f = card.working.split("=")[0].trim();
      if (f) return "Start from: " + f;
    }
    if (card.type === "essay" && card.scaffold && card.scaffold.length) return card.scaffold[0];
    if (card.vocab && card.vocab.length) return "Try to work in: " + card.vocab.join(", ") + ".";
    if (card.type === "mc") return "Rule out the options that describe a related but different concept — two usually fall away fast.";
    return "Say it in full sentences, define the key term, then add the cause-and-effect link.";
  }

  function modePicker(areaId) {
    const area = findArea(areaId);
    if (!area || !area.cards.length) return toast("This set has no cards yet.");
    const lessons = area.lessons || [];
    app.innerHTML = `
      <div class="sessionbar"><button class="x" id="quit" title="Back">←</button>
        <span class="lbl">${esc(area.name)}</span></div>
      <div class="hi">Learn it, then practise it</div>
      <div class="hi-s">${esc(area.blurb)}</div>
      ${lessons.map(l => {
        const total = l.levels ? l.levels.length : 1;
        const done = levelsDone(l);
        const mastered = lessonMastered(l);
        return `<button class="lessonrow" data-lesson="${l.id}" data-area="${area.id}">
        <span class="lic">${mastered ? "🏅" : "📖"}</span>
        <span class="ainfo"><span class="aname">Lesson: ${esc(l.title)}</span>
        <span class="ablurb">${l.levels ? "Mastery ladder · " + done + "/" + total + " levels" + (mastered ? " — mastered" : "") : l.chunks.length + " chunks"}</span></span>
        <span class="lgo">${mastered ? "Review" : done ? "Continue" : "Start"}</span>
      </button>`; }).join("")}
      <div class="modes" style="margin-top:14px">
        ${Object.entries(MODES).map(([k, m]) => {
          const n = area.cards.filter(m.match).length;
          return `<button class="mode" data-mode="${k}" ${n ? "" : "disabled"}>
            <span class="mname">${m.label}</span>
            <span class="mdesc">${m.desc}</span>
            <span class="mcount">${n} card${n === 1 ? "" : "s"}</span>
          </button>`;
        }).join("")}
      </div>`;
    $("#quit").onclick = home;
    app.querySelectorAll(".mode").forEach(b => b.onclick = () => startSession(areaId, b.dataset.mode));
    app.querySelectorAll(".lessonrow").forEach(b => b.onclick = () => {
      const l = getLesson(b.dataset.lesson);
      l && l.levels ? lessonHome(b.dataset.area, b.dataset.lesson) : lessonPlayer(b.dataset.area, b.dataset.lesson);
    });
  }

  // ===================== INFOGRAPHICS (original charts of public ABS data) =====================
  const AX = '#AEBAB8', INK = '#3C4A4A', INK2 = '#7A8A88';
  function barRow(y, label, pct, max, color, w) {
    const bw = (pct / max) * w;
    return `<text x="0" y="${y + 13}" font-size="12.5" font-weight="700" fill="${INK}">${label}</text>
      <rect x="150" y="${y}" width="${bw}" height="19" rx="6" fill="${color}"/>
      <text x="${154 + bw}" y="${y + 14}" font-size="12.5" font-weight="800" fill="${INK2}">${pct}%</text>`;
  }
  const INFO = {
    lorenzFig() {
      // Faithful to Figure 11.1. Smooth convex curve via dense sampling of an
      // analytic Lorenz function (y = x^2.3), not segments between quintiles.
      const X = p => 96 + p * 4.84, Y = p => 300 - p * 2.36;
      const pts = [];
      for (let t = 0; t <= 100; t += 2) pts.push([t, 100 * Math.pow(t / 100, 2.3)]);
      const curve = pts.map((a, i) => (i ? "L" : "M") + X(a[0]).toFixed(1) + "," + Y(a[1]).toFixed(1)).join(" ");
      const areaA = curve + " L " + X(100).toFixed(1) + "," + Y(100).toFixed(1) + " L " + X(0).toFixed(1) + "," + Y(0).toFixed(1) + " Z";
      return `<svg viewBox="0 0 640 360" role="img" aria-label="The Lorenz curve as in Figure 11.1">
        <text x="0" y="20" font-size="15" font-weight="800" fill="${INK}">The Lorenz curve (as in Figure 11.1)</text>
        <path d="${areaA}" fill="var(--green-soft)"/>
        <line x1="96" y1="300" x2="592" y2="300" stroke="${AX}" stroke-width="1.5"/>
        <line x1="96" y1="300" x2="96" y2="58" stroke="${AX}" stroke-width="1.5"/>
        <line x1="96" y1="300" x2="${X(100)}" y2="${Y(100)}" stroke="${INK2}" stroke-width="2"/>
        <path d="${curve}" fill="none" stroke="var(--green)" stroke-width="3.5" stroke-linecap="round"/>
        <circle cx="${X(60)}" cy="${Y(60)}" r="5" fill="${INK}"/>
        <text x="${X(60) + 10}" y="${Y(60) - 8}" font-size="13" font-weight="800" fill="${INK}">C</text>
        <text x="${X(22)}" y="${Y(36)}" font-size="12.5" font-weight="800" fill="${INK2}" transform="rotate(-26 ${X(22)} ${Y(36)})">Line of Perfect Equality</text>
        <text x="${X(48)}" y="${Y(36)}" font-size="13" font-weight="800" fill="var(--green-dk)">Area A</text>
        <text x="${X(72)}" y="${Y(13)}" font-size="13" font-weight="800" fill="${INK2}">Area B</text>
        <text x="${X(78)}" y="${Y(40)}" font-size="12.5" font-weight="800" fill="var(--green-dk)" text-anchor="middle" transform="rotate(-38 ${X(78)} ${Y(40)})">Lorenz Curve (quintiles)</text>
        ${[0,20,40,60,80,100].map(t=>`<text x="${X(t)}" y="320" font-size="11" fill="${INK2}" text-anchor="middle">${t}</text>`).join("")}
        ${[20,40,60,80,100].map(t=>`<text x="86" y="${Y(t)+4}" font-size="11" fill="${INK2}" text-anchor="end">${t}</text>`).join("")}
        <text x="344" y="346" font-size="12" font-weight="700" fill="${INK2}" text-anchor="middle">Cumulative % of families or income units</text>
        <text x="34" y="180" font-size="12" font-weight="700" fill="${INK2}" text-anchor="middle" transform="rotate(-90 34 180)">Cumulative % of income or wealth</text>
      </svg>`;
    },
    incomePie() {
      const d = [["Wages and Salaries", 57.9, "var(--green)"], ["Profits", 17.7, "var(--blue)"], ["Rent, Interest and Dividends", 12.7, "var(--gold)"], ["Social Benefits", 7.7, "var(--coral)"], ["Other", 4.0, "#C9D4D2"]];
      const cx = 150, cy = 158, r = 100;
      let ang = -90, slices = "";
      d.forEach(s => {
        const a0 = ang * Math.PI / 180, a1 = (ang + s[1] * 3.6) * Math.PI / 180;
        const large = s[1] * 3.6 > 180 ? 1 : 0;
        slices += `<path d="M ${cx} ${cy} L ${(cx + r * Math.cos(a0)).toFixed(1)} ${(cy + r * Math.sin(a0)).toFixed(1)} A ${r} ${r} 0 ${large} 1 ${(cx + r * Math.cos(a1)).toFixed(1)} ${(cy + r * Math.sin(a1)).toFixed(1)} Z" fill="${s[2]}" stroke="#fff" stroke-width="2"/>`;
        ang += s[1] * 3.6;
      });
      return `<svg viewBox="0 0 640 300" role="img" aria-label="Sources of household income 2024-25 as in Figure 11.2">
        <text x="0" y="20" font-size="15" font-weight="800" fill="${INK}">Sources of Household Income 2024–25 (as in Figure 11.2)</text>
        ${slices}
        ${d.map((s, i) => `<rect x="320" y="${64 + i * 36}" width="16" height="16" rx="4" fill="${s[2]}"/>
          <text x="346" y="${77 + i * 36}" font-size="13.5" font-weight="700" fill="${INK}">${s[0]} ${s[1]}%</text>`).join("")}
        <text x="320" y="278" font-size="10.5" font-weight="700" fill="${INK2}">Source: ABS National Accounts, Cat. 5206.0</text>
      </svg>`;
    },
    incomeVsWealth() {
      const q = ["Lowest", "Second", "Third", "Fourth", "Highest"];
      const inc = [7.4, 12.6, 17.2, 23.0, 39.8], wel = [0.7, 4.8, 11.3, 20.5, 62.8];
      const x0 = 56, gw = 92, scale = 2.4, base = 232;
      return `<svg viewBox="0 0 560 286" role="img" aria-label="Income vs wealth share by quintile, as the page 255 graph">
        <text x="0" y="16" font-size="14" font-weight="800" fill="${INK}">Shares of income and wealth by quintile</text>
        <text x="0" y="33" font-size="11" font-weight="700" fill="${INK2}">form of the p. 255 graph · 2019–20 data from Table 11.4</text>
        <line x1="40" y1="${base}" x2="540" y2="${base}" stroke="${AX}" stroke-width="1.5"/>
        ${q.map((n, i) => {
          const x = x0 + i * gw;
          return `<rect x="${x}" y="${(base - inc[i] * scale).toFixed(1)}" width="26" height="${(inc[i] * scale).toFixed(1)}" rx="5" fill="var(--green)"/>
            <rect x="${x + 30}" y="${(base - wel[i] * scale).toFixed(1)}" width="26" height="${(wel[i] * scale).toFixed(1)}" rx="5" fill="var(--coral)"/>
            <text x="${x + 28}" y="${base + 16}" font-size="11.5" font-weight="700" fill="${INK2}" text-anchor="middle">${n}</text>
            <text x="${x + 13}" y="${(base - inc[i] * scale - 5).toFixed(1)}" font-size="10.5" font-weight="800" fill="var(--green-dk)" text-anchor="middle">${inc[i]}</text>
            <text x="${x + 43}" y="${(base - wel[i] * scale - 5).toFixed(1)}" font-size="10.5" font-weight="800" fill="var(--coral-dk)" text-anchor="middle">${wel[i]}</text>`;
        }).join("")}
        <rect x="56" y="260" width="13" height="13" rx="4" fill="var(--green)"/><text x="74" y="271" font-size="12" font-weight="700" fill="${INK}">income share % (equiv. disposable)</text>
        <rect x="330" y="260" width="13" height="13" rx="4" fill="var(--coral)"/><text x="348" y="271" font-size="12" font-weight="700" fill="${INK}">net worth share %</text>
      </svg>`;
    }
  };

  // ============ EXPLORABLES (interactive models of the source's figures/tables) ============
  const INTERACTIVES = {
    lorenzInteractive(el) {
      el.innerHTML = `
        <div class="exh">Interactive model of Figure 11.1 — drag the slider, watch the curve and the Gini move</div>
        <svg viewBox="0 0 560 300" role="img" aria-label="Interactive Lorenz curve">
          <path id="lzArea" fill="var(--green-soft)"/>
          <line x1="70" y1="258" x2="530" y2="258" stroke="#AEBAB8" stroke-width="1.5"/>
          <line x1="70" y1="258" x2="70" y2="30" stroke="#AEBAB8" stroke-width="1.5"/>
          <line x1="70" y1="258" x2="530" y2="30" stroke="#7A8A88" stroke-width="2"/>
          <path id="lzCurve" fill="none" stroke="var(--green)" stroke-width="3.5" stroke-linecap="round"/>
          <text x="180" y="290" font-size="11.5" font-weight="700" fill="#7A8A88">cumulative % of income units →</text>
          <text x="262" y="120" font-size="11.5" font-weight="700" fill="#7A8A88" transform="rotate(-26 262 120)">perfect equality</text>
        </svg>
        <div class="exrow">
          <input type="range" id="lzSlide" min="0" max="85" value="32" aria-label="inequality level">
          <div class="exgini">Gini <b id="lzG">0.32</b></div>
        </div>
        <div class="exrow expresets">
          <button class="btn sm ghost" data-g="0">Perfect equality</button>
          <button class="btn sm ghost" data-g="32">Australia: income 0.32</button>
          <button class="btn sm ghost" data-g="61">Australia: wealth 0.61</button>
        </div>`;
      const X = p => 70 + p * 4.6, Y = p => 258 - p * 2.28;
      const slide = el.querySelector("#lzSlide"), gOut = el.querySelector("#lzG");
      function draw() {
        const g = +slide.value / 100;
        const k = g >= 0.99 ? 199 : (1 + g) / (1 - g);
        let d = "";
        for (let t = 0; t <= 100; t += 2) d += (t ? " L " : "M ") + X(t).toFixed(1) + "," + Y(100 * Math.pow(t / 100, k)).toFixed(1);
        el.querySelector("#lzCurve").setAttribute("d", d);
        el.querySelector("#lzArea").setAttribute("d", d + " L " + X(0) + "," + Y(0) + " Z");
        gOut.textContent = ((k - 1) / (k + 1)).toFixed(2);
      }
      slide.addEventListener("input", draw);
      el.querySelectorAll("[data-g]").forEach(b => b.onclick = () => { slide.value = b.dataset.g; draw(); });
      draw();
    },
    wealthExplore(el) {
      const d = [
        ["Property", 6936, 56.2, "var(--green)", "Owner-occupied dwellings plus investment property — the dominant asset class, which is why dwelling prices drive movements in wealth inequality."],
        ["Superannuation", 2299, 18.6, "var(--blue)", "Compulsory and voluntary retirement savings — the second pillar of household wealth."],
        ["Bank deposits", 819, 6.6, "var(--gold)", "Accounts held with financial institutions."],
        ["Home contents", 752, 6.1, "#94A8A5", "Consumer durables inside the dwelling."],
        ["Own businesses", 643, 5.2, "var(--coral)", "Incorporated and unincorporated business equity."],
        ["Shares & bonds", 632, 5.1, "#5C8AC2", "Shares, trusts, debentures and bonds held directly."],
        ["Vehicles", 275, 2.2, "#C2A572", "Motor vehicles."]];
      el.innerHTML = `
        <div class="exh">Household assets, 2019–20 (Table 11.2) — tap a segment</div>
        <div class="segbar" role="group">${d.map((s, i) =>
          `<button class="seg" data-i="${i}" style="width:${s[2]}%;background:${s[3]}" aria-label="${s[0]} ${s[2]} percent"></button>`).join("")}</div>
        <div class="segdetail" id="segOut"><b>Property — $6,936b · 56.2%</b><p>${d[0][4]}</p></div>
        <div class="segtotal">Total household assets $12,356b · liabilities $2,038b · <b>net worth $10,318b ≈ 5× annual GDP</b></div>`;
      const out = el.querySelector("#segOut");
      el.querySelectorAll(".seg").forEach(b => b.onclick = () => {
        const s = d[+b.dataset.i];
        out.innerHTML = "<b>" + s[0] + " — $" + s[1].toLocaleString() + "b · " + s[2] + "%</b><p>" + s[4] + "</p>";
      });
    },
    quintileSplit(el) {
      const d = [["Lowest 20%", 7.4], ["Second", 12.6], ["Third", 17.2], ["Fourth", 23.0], ["Highest 20%", 39.8]];
      el.innerHTML = `
        <div class="exh">Split $100 of national income across the five quintiles (Table 11.3, 2019–20)</div>
        <div class="qsrow">${d.map((q, i) => `
          <div class="qcol" data-i="${i}">
            <div class="qbarwrap"><div class="qbar" style="background:${i === 4 ? "var(--coral)" : "var(--green)"}"></div></div>
            <div class="qamt" id="qa${i}">—</div>
            <div class="qlab">${q[0]}</div>
          </div>`).join("")}</div>
        <div class="exrow"><button class="btn sm" id="qNext">Reveal the lowest quintile</button><span class="qrun" id="qRun"></span></div>`;
      let i = 0;
      el.querySelector("#qNext").onclick = function () {
        if (i >= d.length) return;
        el.querySelectorAll(".qcol")[i].querySelector(".qbar").style.height = (d[i][1] / 39.8 * 100) + "%";
        el.querySelector("#qa" + i).textContent = "$" + d[i][1].toFixed(2);
        i++;
        const total = d.slice(0, i).reduce((n, q) => n + q[1], 0);
        el.querySelector("#qRun").textContent = "running total $" + total.toFixed(2) + " of $100";
        this.textContent = i >= d.length ? "Middle 60% took $52.80 — the top 20% took $39.80 alone" : "Reveal the " + ["", "second", "third", "fourth", "highest"][i] + " quintile";
        if (i >= d.length) this.disabled = true;
      };
    },
    taxCalc(el) {
      const br = [[0, 18200, 0], [18200, 45000, 16], [45000, 135000, 30], [135000, 190000, 37], [190000, Infinity, 45]];
      el.innerHTML = `
        <div class="exh">Progressive tax, live (2024–25 rates, Table 11.6) — change the income</div>
        <div class="exrow"><span class="calclbl">Taxable income $</span><input type="number" id="txIn" class="calcin" value="60000" min="0" step="1000" style="width:150px"></div>
        <div id="txRows"></div>
        <div class="segtotal" id="txTot"></div>`;
      const input = el.querySelector("#txIn");
      function calc() {
        const inc = Math.max(0, +input.value || 0);
        let total = 0, rows = "";
        br.forEach(b => {
          const slice = Math.max(0, Math.min(inc, b[1]) - b[0]);
          if (slice <= 0) return;
          const tax = slice * b[2] / 100;
          total += tax;
          rows += `<div class="txrow"><span>${b[2]}% on ${b[0] === 0 ? "the first $18,200" : "$" + b[0].toLocaleString() + "–" + (b[1] === Infinity ? "above" : "$" + b[1].toLocaleString())} <small>($${slice.toLocaleString()} slice)</small></span><b>$${tax.toLocaleString(undefined, { maximumFractionDigits: 0 })}</b></div>`;
        });
        el.querySelector("#txRows").innerHTML = rows;
        el.querySelector("#txTot").innerHTML = `Total tax <b>$${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</b> · average rate <b>${inc ? (100 * total / inc).toFixed(1) : "0.0"}%</b> — the average always sits below the top marginal rate paid.`;
      }
      input.addEventListener("input", calc);
      calc();
    }
  };

  const KIND = { intro: ["Principle", "k-intro"], evidence: ["Evidence", "k-evidence"], apply: ["Apply it", "k-apply"], synthesis: ["Synthesis", "k-synth"],
    foundations: ["Level 1 · Foundations", "k-intro"], evidence2: ["Level 2 · Evidence", "k-evidence"], skills: ["Level 3 · Skills — calculate it", "k-apply"], economist: ["Level 4 · Think like an economist", "k-synth"] };
  function blockHTML(b, bi) {
    if (b.t === "lead") return `<p class="lead">${linkGlossary(b.x)}</p>`;
    if (b.t === "p") return `<p class="chunkbody">${linkGlossary(b.x)}</p>`;
    if (b.t === "stats") return `<div class="stats">${b.items.map(s => `<div class="stat"><span class="statn">${esc(s.n)}</span><span class="statl">${esc(s.l)}</span></div>`).join("")}</div>`;
    if (b.t === "reveal") return `<div class="reveal" data-bi="${bi}"><div class="rsteps"></div>
      <button class="btn sm rnext" data-bi="${bi}">${esc(b.cta || "Build it step by step")} <span class="rcount">0/${b.steps.length}</span></button></div>`;
    if (b.t === "viz") return `<div class="viz">${INFO[b.key] ? INFO[b.key]() : ""}</div>`;
    if (b.t === "int") return `<div class="viz inter" data-int="${esc(b.key)}"></div>`;
    if (b.t === "ref") return `<div class="refblock" data-bi="${bi}"><button class="refbtn">📊 ${esc(b.label)} <span class="refcaret">▾</span></button><div class="refbody" hidden></div></div>`;
    if (b.t === "scenario") return `<div class="scen" data-bi="${bi}"><div class="scenlabel">Apply it</div>
      <div class="prompt" style="font-size:17px">${esc(b.q)}</div>
      <div class="choices">${b.opts.map((o, i) => `<button class="choice" data-i="${i}">${esc(o.t)}</button>`).join("")}</div>
      <div class="scenfb"></div></div>`;
    return "";
  }
  function wireBlocks(ch) {
    (ch.blocks || []).forEach((b, bi) => {
      if (b.t === "reveal") {
        const root = app.querySelector('.reveal[data-bi="' + bi + '"]');
        if (!root) return;
        const btn = root.querySelector(".rnext");
        let i = 0;
        btn.onclick = () => {
          if (i >= b.steps.length) return;
          const s = b.steps[i];
          const div = document.createElement("div");
          div.className = "rstep enter";
          div.innerHTML = `<span class="rnum">${i + 1}</span><div><b>${esc(s.label)}</b> ${linkGlossary(s.text)}</div>`;
          root.querySelector(".rsteps").appendChild(div);
          i++;
          btn.querySelector(".rcount").textContent = i + "/" + b.steps.length;
          btn.childNodes[0].textContent = i >= b.steps.length ? "All steps shown " : "Next step ";
          if (i >= b.steps.length) btn.disabled = true;
          wireGlossary();
        };
      }
      if (b.t === "int") {
        const root = app.querySelector('.inter[data-int="' + b.key + '"]');
        if (root && INTERACTIVES[b.key]) INTERACTIVES[b.key](root);
      }
      if (b.t === "ref") {
        const root = app.querySelector('.refblock[data-bi="' + bi + '"]');
        if (!root) return;
        const body = root.querySelector(".refbody"), btn = root.querySelector(".refbtn");
        btn.onclick = () => {
          if (!body.dataset.loaded) {
            if (b.kind === "int" && INTERACTIVES[b.key]) {
              const div = document.createElement("div"); div.className = "viz inter";
              body.appendChild(div); INTERACTIVES[b.key](div);
            } else if (INFO[b.key]) body.innerHTML = `<div class="viz">${INFO[b.key]()}</div>`;
            body.dataset.loaded = "1";
          }
          body.hidden = !body.hidden;
          btn.querySelector(".refcaret").textContent = body.hidden ? "▾" : "▴";
        };
      }
      if (b.t === "scenario") {
        const root = app.querySelector('.scen[data-bi="' + bi + '"]');
        if (!root) return;
        root.querySelectorAll(".choice").forEach(btn => btn.onclick = () => {
          const o = b.opts[+btn.dataset.i];
          root.querySelectorAll(".choice").forEach(x => x.onclick = null);
          btn.classList.add(o.ok ? "right" : "wrong");
          root.querySelector(".scenfb").innerHTML = `<div class="sheet ${o.ok ? "good" : "mid"}" style="margin-top:10px"><div class="bd"><p><b>${o.ok ? "Sound reasoning." : "Look again —"}</b> ${esc(o.why)}</p>${o.ok ? "" : `<p>Stronger answer: <b>${esc(b.opts.find(x => x.ok).t)}</b></p>`}</div></div>`;
        });
      }
    });
  }

  // ===================== LEARN (discrete chunks + quick checks) =====================
  function lessonPlayer(areaId, lessonId, idx = 0) {
    const area = findArea(areaId);
    const lesson = (area.lessons || []).find(l => l.id === lessonId);
    if (!lesson) return home();
    if (idx >= lesson.chunks.length) return lessonDone(area, lesson);
    const ch = lesson.chunks[idx];
    app.innerHTML = `
      <div class="sessionbar">
        <button class="x" id="quit" title="Back">←</button>
        <span class="lbl">${esc(lesson.title)} · ${idx + 1} of ${lesson.chunks.length}</span>
        <span class="sbar"><i style="width:${Math.round(100 * idx / lesson.chunks.length)}%"></i></span>
      </div>
      <div class="enter">
        <div class="chunk">
          ${ch.kind && KIND[ch.kind] ? `<span class="stagechip ${KIND[ch.kind][1]}">${KIND[ch.kind][0]}</span>` : ""}
          <h2 class="chunkh">${esc(ch.h)}</h2>
          ${ch.blocks ? ch.blocks.map(blockHTML).join("")
            : `<p class="chunkbody">${linkGlossary(ch.body || "")}</p>${ch.viz && INFO[ch.viz] ? `<div class="viz">${INFO[ch.viz]()}</div>` : ""}`}
        </div>
        <div class="check">
          <div class="checklabel">Quick check</div>
          <div class="prompt" style="font-size:18px">${esc(ch.check.q)}</div>
          <div class="choices">${ch.check.opts.map((o, i) => `<button class="choice" data-i="${i}"><kbd class="ckbd">${i + 1}</kbd>${esc(o.t)}</button>`).join("")}</div>
          <div id="checkfb"></div>
        </div>
        ${ch.src ? `
        <button class="srctab" id="srctab" aria-expanded="false" aria-controls="srcpanel">Source ◂</button>
        <aside class="srcpanel" id="srcpanel" aria-label="Source material reference">
          <div class="srchead"><h3>Source material</h3><button class="srcclose" id="srcclose" aria-label="Close">✕</button></div>
          <div class="srcref">${esc(ch.src.ref)}</div>
          <div class="srclbl">Data used in this chunk</div>
          ${ch.src.data.map(d => `<div class="srcitem">${esc(d)}</div>`).join("")}
          ${ch.src.fig ? `<div class="srclbl" style="margin-top:14px">Infographic provenance</div>
          <div class="srcfig">${esc(ch.src.fig)}</div>` : ""}
          <div class="srclbl" style="margin-top:14px">Your source extract <span class="srcpriv">this device only</span></div>
          <textarea class="srcpaste" id="srcpaste" rows="7" placeholder="Paste the matching passage from your copy of the chapter here to compare side-by-side. It's saved only in this browser — it is never added to the app's content, the repo, or set exports."></textarea>
          <div class="row" style="margin-top:8px"><button class="btn sm" id="srcsave">Save extract</button><span class="hint" id="srcmsg"></span></div>
          <p class="srcnote">The teaching text is original wording. Keep pasted source text local — don't commit it to the repo.</p>
        </aside>` : ""}
        <div class="lessonnav">
          <button class="lnbtn" id="lprev" ${idx === 0 ? "disabled" : ""}>← Back</button>
          <span class="ldots">${lesson.chunks.map((_, i) => `<button class="ldot ${i === idx ? "on" : ""}" data-j="${i}" aria-label="Chunk ${i + 1}"></button>`).join("")}</span>
          <button class="lnbtn" id="lskip">${idx + 1 === lesson.chunks.length ? "Skip to finish →" : "Skip →"}</button>
        </div>
      </div>`;
    $("#quit").onclick = () => modePicker(areaId);
    const stab = $("#srctab"), spanel = $("#srcpanel");
    if (stab) {
      const noteKey = lessonId + "#" + idx;
      state.srcNotes = state.srcNotes || {};
      const paste = $("#srcpaste");
      paste.value = state.srcNotes[noteKey] || "";
      $("#srcsave").onclick = () => { state.srcNotes[noteKey] = paste.value; save(); $("#srcmsg").textContent = "Saved on this device ✓"; };
      const setOpen = open => { spanel.classList.toggle("open", open); stab.classList.toggle("open", open);
        stab.setAttribute("aria-expanded", open); stab.textContent = open ? "Source ▸" : "Source ◂"; };
      stab.onclick = () => setOpen(!spanel.classList.contains("open"));
      $("#srcclose").onclick = () => setOpen(false);
    }
    $("#lskip").onclick = () => lessonPlayer(areaId, lessonId, idx + 1);
    $("#lprev").onclick = () => { if (idx > 0) lessonPlayer(areaId, lessonId, idx - 1); };
    app.querySelectorAll(".ldot").forEach(d => d.onclick = () => lessonPlayer(areaId, lessonId, +d.dataset.j));
    wireBlocks(ch);
    app.querySelectorAll(".check .choice").forEach(b => b.onclick = () => {
      const o = ch.check.opts[+b.dataset.i];
      app.querySelectorAll(".check .choice").forEach(x => x.onclick = null);
      b.classList.add(o.ok ? "right" : "wrong");
      $("#checkfb").innerHTML = `<div class="sheet ${o.ok ? "good" : "mid"}" style="margin-top:12px">
        <div class="bd"><p><b>${o.ok ? "Exactly." : "Not quite —"}</b> ${esc(o.why)}</p>
        ${o.ok ? "" : `<p>The answer: <b>${esc(ch.check.opts.find(x => x.ok).t)}</b></p>`}
        <div class="actions"><button class="btn" id="continue">${idx + 1 === lesson.chunks.length ? "Finish lesson" : "Next chunk"}</button></div></div></div>`;
      $("#continue").onclick = () => lessonPlayer(areaId, lessonId, idx + 1);
      $("#continue").focus();
      wireGlossary();
    });
    wireGlossary();
  }
  function lessonDone(area, lesson) {
    state.lessons[lesson.id] = true; save();
    app.innerHTML = `
      <div class="summary">
        <div class="bigscore">📖</div>
        <h2>${esc(lesson.title)} — done</h2>
        <p>You've covered the material. Lock it in with practice — flashcards first is a good rhythm, then typed answers.</p>
        <div class="row center">
          <button class="btn" id="practise">Practise this area</button>
          <button class="btn ghost" id="back">Back to areas</button>
        </div>
      </div>`;
    $("#practise").onclick = () => modePicker(area.id);
    $("#back").onclick = home;
  }

  // ============ MASTERY LADDER (levels of steps; one focus per screen) ============
  const vm = v => typeof v === "string" ? { t: v, d: v } : v;
  function taskHTML(task) {
    if (!task) return "";
    if (task.type === "check" || task.type === "scenario") {
      const label = task.type === "scenario" ? "Apply it" : "Quick check";
      return `<div class="check task"><div class="checklabel">${label}</div>
        <div class="prompt" style="font-size:17.5px">${esc(task.q)}</div>
        <div class="choices">${task.opts.map((o, i) => `<button class="choice" data-i="${i}"><kbd class="ckbd">${i + 1}</kbd>${esc(o.t)}</button>`).join("")}</div>
        <div class="taskfb"></div></div>`;
    }
    if (task.type === "calc") return `<div class="check task"><div class="checklabel">Calculate it</div>
      <div class="prompt" style="font-size:17.5px">${esc(task.q)}</div>
      <div class="row"><input id="taskIn" class="calcin" inputmode="decimal" placeholder="Your answer"><button class="btn" id="taskGo">Check</button><button class="btn sm ghost" id="taskReveal">Show the working</button></div>
      <div class="taskfb"></div></div>`;
    if (task.type === "short") return `<div class="check task"><div class="checklabel">Write it — short answer</div>
      <div class="prompt" style="font-size:17.5px">${esc(task.q)}</div>
      <textarea id="taskIn" rows="4" class="binput" placeholder="One or two full sentences…"></textarea>
      <div class="row" style="margin-top:8px"><button class="btn" id="taskGo">Check</button><button class="btn sm ghost" id="taskReveal">Show the model answer</button></div>
      <div class="taskfb"></div></div>`;
    return "";
  }
  function wireTask(task, onDone) {
    if (!task) return;
    const fb = app.querySelector(".task .taskfb");
    const contHTML = `<div class="actions"><button class="btn" id="continue">Continue</button></div>`;
    const finish = html => { fb.innerHTML = html; const c = fb.querySelector("#continue"); if (c) { c.onclick = onDone; c.focus(); } wireGlossary(); };

    if (task.type === "check" || task.type === "scenario") {
      let misses = 0;
      const reveal = () => {
        const k = task.opts.findIndex(o => o.ok);
        const btns = app.querySelectorAll(".task .choice");
        btns.forEach(x => { x.onclick = null; });
        btns[k].classList.add("right");
        finish(`<div class="sheet good" style="margin-top:12px"><div class="bd">
          <p><b>The answer: ${esc(task.opts[k].t)}.</b></p><p>${esc(task.opts[k].why)}</p>${contHTML}</div></div>`);
      };
      app.querySelectorAll(".task .choice").forEach(b => b.onclick = () => {
        const o = task.opts[+b.dataset.i];
        if (o.ok) {
          app.querySelectorAll(".task .choice").forEach(x => x.onclick = null);
          b.classList.add("right");
          finish(`<div class="sheet good" style="margin-top:12px"><div class="bd">
            <p><b>Exactly.</b> ${esc(o.why)}</p>${contHTML}</div></div>`);
        } else {
          misses++;
          b.classList.add("wrong"); b.onclick = null; b.disabled = true;
          fb.innerHTML = `<div class="sheet mid" style="margin-top:12px"><div class="bd">
            <p><b>Not that one —</b> ${esc(o.why)} <b>Try another.</b></p>
            ${misses >= 2 ? `<div class="actions"><button class="btn sm ghost" id="taskReveal">Show me the answer</button></div>` : ""}</div></div>`;
          const rv = fb.querySelector("#taskReveal"); if (rv) rv.onclick = reveal;
          wireGlossary();
        }
      });
    }

    if (task.type === "calc") {
      const inp = app.querySelector("#taskIn"), go = app.querySelector("#taskGo"), rb = app.querySelector("#taskReveal");
      const revealW = () => {
        go.disabled = true; inp.disabled = true;
        finish(`<div class="sheet good" style="margin-top:12px"><div class="bd">
          <p><b>Answer: ${task.expected}.</b></p><p><b>Working:</b> ${esc(task.working)}</p>${contHTML}</div></div>`);
      };
      if (rb) rb.onclick = revealW;
      const submit = () => {
        const v = parseFloat((inp.value || "").replace(/[$,%\s]/g, ""));
        if (isNaN(v)) return toast("Enter a number first.");
        if (Math.abs(v - task.expected) <= (task.tol == null ? 0.5 : task.tol)) {
          go.disabled = true; inp.disabled = true;
          finish(`<div class="sheet good" style="margin-top:12px"><div class="bd">
            <p><b>Correct.</b></p><p><b>Working:</b> ${esc(task.working)}</p>${contHTML}</div></div>`);
        } else {
          fb.innerHTML = `<div class="sheet mid" style="margin-top:12px"><div class="bd">
            <p><b>Not yet.</b> Check the method and try again — the working is one tap away whenever you want it.</p></div></div>`;
          inp.focus(); if (inp.select) inp.select();
        }
      };
      go.onclick = submit;
      inp.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); submit(); } };
    }

    if (task.type === "short") {
      const inp = app.querySelector("#taskIn"), go = app.querySelector("#taskGo"), rb = app.querySelector("#taskReveal");
      const terms = task.vocab.map(vm);
      const modelP = `<p><b>Model answer:</b> ${esc(task.model)}</p>`;
      const showModel = () => finish(`<div class="sheet good" style="margin-top:12px"><div class="bd">${modelP}${contHTML}</div></div>`);
      if (rb) rb.onclick = showModel;
      const submit = () => {
        const ans = (inp.value || "").trim();
        if (!ans) return toast("Write anything you can — then check.");
        const low = ans.toLowerCase();
        const hits = terms.filter(t => low.includes(t.t.toLowerCase()));
        const strong = hits.length >= Math.ceil(terms.length * 0.6);
        finish(`<div class="sheet ${strong ? "good" : "mid"}" style="margin-top:12px"><div class="bd">
          <p><b>${strong ? "Strong — the key ideas are there." : "Developing — see what's missing, revise your answer above, and re-check."}</b></p>
          <p class="vhits">key ideas: ${terms.map(t => `<span class="vchip ${hits.includes(t) ? "hit" : "miss"}">${esc(t.d)}</span>`).join("")}</p>
          ${strong ? modelP : ""}
          <div class="actions">
            ${strong ? "" : `<button class="btn sm" id="taskRe">Re-check my revision</button><button class="btn sm ghost" id="taskModel">Show the model</button>`}
            <button class="btn ${strong ? "" : "ghost"}" id="continue">Continue</button>
          </div></div></div>`);
        const re = fb.querySelector("#taskRe"); if (re) re.onclick = submit;
        const sm = fb.querySelector("#taskModel"); if (sm) sm.onclick = showModel;
      };
      go.onclick = submit;
      inp.onkeydown = e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.stopPropagation(); submit(); } };
    }
  }

  function lessonHome(areaId, lessonId) {
    const lesson = getLesson(lessonId);
    if (!lesson || !lesson.levels) return modePicker(areaId);
    const v = lvObj(lessonId);
    const all = lessonMastered(lesson);
    app.innerHTML = `
      <div class="sessionbar"><button class="x" id="quit" title="Back">←</button>
        <span class="lbl">${esc(lesson.title)}</span></div>
      <div class="hi">The mastery ladder</div>
      <div class="hi-s">Four levels, each building on the last — finish all four and you've mastered the material${all ? "" : ". Skills before opinions; calculation before interpretation"}.</div>
      ${all ? `<div class="masterban">🏅 Mastered — every level complete. Revisit any level, or lock it in with practice.</div>` : ""}
      <div class="lvlgrid">
        ${lesson.levels.map((L, i) => {
          const done = !!v.lv[i];
          const tasks = L.steps.filter(s => s.task).length;
          return `<button class="lvlcard ${done ? "done" : ""}" data-li="${i}">
            <span class="stagechip ${KIND[L.kind][1]}">${KIND[L.kind][0]}</span>
            <span class="aname">${esc(L.name)}</span>
            <span class="ablurb">${L.steps.length} step${L.steps.length === 1 ? "" : "s"} · ${tasks} task${tasks === 1 ? "" : "s"}</span>
            <span class="lgo">${done ? "✓ Review" : "Start"}</span>
          </button>`;
        }).join("")}
      </div>
      ${all ? `<div class="row center" style="margin-top:18px"><button class="btn" id="practise">Practise this area</button></div>` : ""}`;
    $("#quit").onclick = () => modePicker(areaId);
    app.querySelectorAll(".lvlcard").forEach(b => b.onclick = () => levelPlayer(areaId, lessonId, +b.dataset.li, 0));
    const pr = $("#practise"); if (pr) pr.onclick = () => modePicker(areaId);
  }

  function levelPlayer(areaId, lessonId, li, si) {
    const lesson = getLesson(lessonId);
    const level = lesson.levels[li];
    if (si >= level.steps.length) return levelDone(areaId, lessonId, li);
    const st = level.steps[si];
    app.innerHTML = `
      <div class="sessionbar">
        <button class="x" id="quit" title="Levels">←</button>
        <span class="lbl">${esc(level.name)} · ${si + 1} of ${level.steps.length}</span>
        <span class="sbar"><i style="width:${Math.round(100 * si / level.steps.length)}%"></i></span>
      </div>
      <div class="enter">
        <div class="${st.task ? "stepgrid" : ""}">
        <div class="stepmain"><div class="chunk">
          <span class="stagechip ${KIND[level.kind][1]}">${KIND[level.kind][0]}</span>
          <h2 class="chunkh">${esc(st.h)}</h2>
          ${st.concept ? `<div class="concept">${linkGlossary(st.concept)}</div>` : ""}
          ${(st.blocks || []).map(blockHTML).join("")}
        </div></div>
        ${st.task ? `<div class="steptask">${taskHTML(st.task)}</div>` : ""}
        </div>
        ${level.src ? `
        <button class="srctab" id="srctab" aria-expanded="false" aria-controls="srcpanel">Source ◂</button>
        <aside class="srcpanel" id="srcpanel" aria-label="Source material reference">
          <div class="srchead"><h3>Source material</h3><button class="srcclose" id="srcclose" aria-label="Close">✕</button></div>
          <div class="srcref">${esc(level.src.ref)}</div>
          ${CONFIG.textbookUrl && level.src.page ? `<a class="btn sm" style="display:inline-block;margin:0 0 12px" target="_blank" rel="noopener" href="${esc(String(CONFIG.textbookUrl).split("{page}").join(level.src.page))}">Open the textbook at p. ${level.src.page} →</a>`
            : `<p class="srcnote" style="margin:0 0 12px">Read the original at this reference in your copy of the text. (Teachers: set <code>textbookUrl</code> in TEACHER SETUP to deep-link your class's licensed copy straight to the page.)</p>`}
          <div class="srclbl">Data used at this level</div>
          ${level.src.data.map(d => `<div class="srcitem">${esc(d)}</div>`).join("")}
          ${level.src.fig ? `<div class="srclbl" style="margin-top:14px">Infographic provenance</div><div class="srcfig">${esc(level.src.fig)}</div>` : ""}
          <div class="srclbl" style="margin-top:14px">Your source extract <span class="srcpriv">this device only</span></div>
          <textarea class="srcpaste" id="srcpaste" rows="7" placeholder="Paste the matching passage from your copy of the chapter to compare side-by-side. Saved only in this browser — never added to the app, repo or exports."></textarea>
          <div class="row" style="margin-top:8px"><button class="btn sm" id="srcsave">Save extract</button><span class="hint" id="srcmsg"></span></div>
        </aside>` : ""}
        <div class="lessonnav">
          <button class="lnbtn" id="lprev" ${si === 0 ? "disabled" : ""}>← Back</button>
          <span class="ldots">${level.steps.map((_, i) => `<button class="ldot ${i === si ? "on" : ""}" data-j="${i}" aria-label="Step ${i + 1}"></button>`).join("")}</span>
          <button class="lnbtn" id="lskip">${si + 1 === level.steps.length ? "Skip to finish →" : "Skip →"}</button>
        </div>
      </div>`;
    $("#quit").onclick = () => lessonHome(areaId, lessonId);
    wireBlocks(st);
    wireTask(st.task, () => levelPlayer(areaId, lessonId, li, si + 1));
    $("#lskip").onclick = () => levelPlayer(areaId, lessonId, li, si + 1);
    $("#lprev").onclick = () => { if (si > 0) levelPlayer(areaId, lessonId, li, si - 1); };
    app.querySelectorAll(".ldot").forEach(d => d.onclick = () => levelPlayer(areaId, lessonId, li, +d.dataset.j));
    const stab = $("#srctab"), spanel = $("#srcpanel");
    if (stab) {
      const noteKey = lessonId + "#L" + li;
      state.srcNotes = state.srcNotes || {};
      const paste = $("#srcpaste");
      paste.value = state.srcNotes[noteKey] || "";
      $("#srcsave").onclick = () => { state.srcNotes[noteKey] = paste.value; save(); $("#srcmsg").textContent = "Saved on this device ✓"; };
      const setOpen = open => { spanel.classList.toggle("open", open); stab.classList.toggle("open", open);
        stab.setAttribute("aria-expanded", open); stab.textContent = open ? "Source ▸" : "Source ◂"; };
      stab.onclick = () => setOpen(!spanel.classList.contains("open"));
      $("#srcclose").onclick = () => setOpen(false);
    }
    wireGlossary();
  }

  function levelDone(areaId, lessonId, li) {
    const lesson = getLesson(lessonId);
    const v = lvObj(lessonId);
    v.lv[li] = 1; save();
    const all = lessonMastered(lesson);
    const next = lesson.levels[li + 1];
    app.innerHTML = `
      <div class="summary">
        <div class="bigscore">${all ? "🏅" : "✓"}</div>
        <h2>${esc(lesson.levels[li].name)} — complete</h2>
        <p>${all ? "That's every level: <b>mastered</b>. The skills are now in your practice rotation — keep them warm with the question bank." : next ? "Next on the ladder: <b>" + esc(next.name) + "</b>." : ""}</p>
        <div class="row center">
          ${next && !all ? `<button class="btn" id="nextlvl">Start ${esc(next.name)}</button>` : ""}
          ${all ? `<button class="btn" id="practise">Practise this area</button>` : ""}
          <button class="btn ghost" id="overview">All levels</button>
        </div>
      </div>`;
    const nx = $("#nextlvl"); if (nx) nx.onclick = () => levelPlayer(areaId, lessonId, li + 1, 0);
    const pr = $("#practise"); if (pr) pr.onclick = () => modePicker(areaId);
    $("#overview").onclick = () => lessonHome(areaId, lessonId);
  }

  function startSession(areaId, mode) {
    mode = mode || "mix";
    const area = findArea(areaId);
    if (!area || !area.cards.length) return toast("This set has no cards yet.");
    const pool = area.cards.filter(MODES[mode].match);
    if (!pool.length) return toast("No cards of that type in this area.");
    const sub = { cards: pool };
    let queue = dueCards(sub).slice(0, 6);
    if (!queue.length) queue = [...pool].sort((a, b) => cardState(a.id).box - cardState(b.id).box).slice(0, 6);
    session = { area, mode, queue, idx: 0, results: [] };
    renderCard();
  }

  function renderCard() {
    const { area, queue, idx } = session;
    if (idx >= queue.length) return summary();
    const card = queue[idx];
    const flash = session.mode === "flash";
    const tag = flash ? "Flashcard" : { mc: "Multiple choice", calc: "Calculate", define: "Define", short: "Short answer", essay: "Extended response" }[card.type];
    app.innerHTML = `
      <div class="sessionbar">
        <button class="x" id="quit" title="Back to areas">←</button>
        <span class="lbl">${esc(area.name)} · ${idx + 1} of ${queue.length}</span>
        <span class="sbar"><i style="width:${Math.round(100 * idx / queue.length)}%"></i></span>
      </div>
      <div class="tags"><span class="tag blue">${esc(area.custom ? "Custom set" : C.unit)}</span><span class="tag gold">${tag}</span><span class="tag gray">${card.marks} mark${card.marks > 1 ? "s" : ""}</span></div>
      ${card.stimulus ? `<div class="stimulus"><div class="stimlabel">Source</div><pre>${esc(card.stimulus)}</pre></div>` : ""}
      ${flash ? "" : `<div class="prompt">${linkGlossary(card.prompt)}</div>`}
      ${!flash && card.type === "essay" && card.scaffold && card.scaffold.length ? `<details class="scaffold"><summary>Need a scaffold?</summary><ol>${card.scaffold.map(s => "<li>" + esc(s) + "</li>").join("")}</ol></details>` : ""}
      <div class="enter">
      <div class="hintrow"><button class="hintbtn" id="hintbtn">💡 Need a hint?</button><div class="hintbox" id="hintbox" hidden>${esc(hintFor(card))}</div></div>
      <div id="answerzone">${flash ? flashUI(card) : answerUI(card)}</div>
      <div id="sheet"></div>
      </div>`;
    $("#quit").onclick = home;
    $("#hintbtn").onclick = () => { $("#hintbox").hidden = false; $("#hintbtn").hidden = true; };
    if (flash) wireFlash(card); else wireAnswer(card);
    wireGlossary();
  }

  function flashUI(card) {
    const ans = card.type === "mc" ? card.choices.find(c => c.ok).t : card.model;
    return `<div class="flipwrap"><div class="flipcard" id="flip">
      <div class="face front" id="flipfront" role="button" tabindex="0" aria-label="Flip card to see the answer">
        <div class="fprompt">${linkGlossary(card.prompt)}</div>
        <span class="fliphint">Think it through first — then… <kbd>Space</kbd> flips</span>
        <button class="btn blue flipcta" id="flipcta">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11A8 8 0 0 0 6 6L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14 5l2-2"/><path d="M20 20v-4h-4"/></svg>
          Flip card
        </button>
      </div>
      <div class="face back">
        <div class="backtop"><span class="blabel" style="margin:0">Answer</span><button class="flipback" id="flipback" title="Flip back to the question"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11A8 8 0 0 0 6 6L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14 5l2-2"/><path d="M20 20v-4h-4"/></svg> question</button></div>
        <p class="fans">${linkGlossary(ans)}</p>
        ${card.type === "calc" && card.working ? `<p class="working"><b>Working:</b> ${esc(card.working)}</p>` : ""}
        ${card.context ? `<details class="ctx"><summary>Why — the concept</summary><p>${linkGlossary(card.context)}</p></details>` : ""}
        <div class="blabel">How did you go?</div>
        <div class="raterow">
          <button class="btn rate low" data-r="0"><kbd>1</kbd> Not yet</button>
          <button class="btn rate mid" data-r="0.5"><kbd>2</kbd> Almost</button>
          <button class="btn rate high" data-r="1"><kbd>3</kbd> Got it</button>
        </div>
      </div>
    </div></div>`;
  }
  function wireFlash(card) {
    const flip = $("#flip");
    const wrap = flip.parentElement;
    const lift = () => { wrap.classList.remove("lifting"); void wrap.offsetWidth; wrap.classList.add("lifting"); };
    const spin = btn => { if (!btn) return; btn.classList.remove("spinning"); void btn.offsetWidth; btn.classList.add("spinning"); };
    const doFlip = () => { spin($("#flipcta")); lift(); flip.classList.add("flipped"); };
    $("#flipfront").onclick = doFlip;
    $("#flipcta").onclick = e => { e.stopPropagation(); doFlip(); };
    $("#flipfront").onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); doFlip(); } };
    $("#flipback").onclick = e => { e.stopPropagation(); spin($("#flipback")); lift(); flip.classList.remove("flipped"); };
    app.querySelectorAll(".rate").forEach(b => b.onclick = e => {
      e.stopPropagation();
      rateFlash(card, parseFloat(b.dataset.r));
    });
    // swipe: unflipped = flip · flipped = right "Got it", left "Not yet"
    let px = null;
    flip.addEventListener("pointerdown", e => { px = e.clientX; });
    flip.addEventListener("pointerup", e => {
      if (px == null) return;
      const dx = e.clientX - px; px = null;
      if (Math.abs(dx) < 60) return;
      if (!flip.classList.contains("flipped")) { doFlip(); return; }
      rateFlash(card, dx > 0 ? 1 : 0);
    });
    wireGlossary();
  }
  let advancing = false;
  function rateFlash(card, r) {
    if (advancing) return;
    advancing = true;
    applyResult(card, Math.round(r * card.marks), card.marks);
    session.results.push({ card, g: { score: Math.round(r * card.marks), max: card.marks, kind: "flash" } });
    const flip = $("#flip");
    const go = () => { advancing = false; session.idx++; renderCard(); };
    if (flip) { flip.classList.add(r >= 0.7 ? "flyright" : r <= 0.3 ? "flyleft" : "flydown"); setTimeout(go, 240); }
    else go();
  }

  function answerUI(card) {
    if (card.type === "mc")
      return `<div class="choices">${card.choices.map((c, i) => `<button class="choice" data-i="${i}"><kbd class="ckbd">${i + 1}</kbd>${esc(c.t)}</button>`).join("")}</div>`;
    if (card.type === "calc")
      return `<input class="calcin" id="ans" inputmode="decimal" placeholder="Your answer (number)" autocomplete="off">
              <div class="row"><button class="btn" id="check">Check answer</button></div>`;
    const big = card.type === "essay";
    return `<textarea id="ans" class="answerbox" rows="${big ? 14 : 5}" placeholder="${big ? "Write your full response here — use blank lines between paragraphs." : "Type your answer in full sentences."}"></textarea>
            <div class="row"><button class="btn" id="check">${big ? "Submit for marking" : "Check answer"}</button><span class="hint">${big ? "Marked against the criteria — takes a few seconds." : "Graded on key terms and content — write it properly."}</span></div>`;
  }

  function wireAnswer(card) {
    if (card.type === "mc") {
      app.querySelectorAll(".choice").forEach(b => b.onclick = () => {
        app.querySelectorAll(".choice").forEach(x => x.onclick = null);
        const g = gradeMC(card, +b.dataset.i);
        b.classList.add(g.correct ? "right" : "wrong");
        finishCard(card, g);
      });
    } else {
      const ansEl = $("#ans");
      ansEl.onkeydown = e => {
        if (card.type === "calc" && e.key === "Enter") { e.preventDefault(); e.stopPropagation(); $("#check").click(); }
        else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.stopPropagation(); $("#check").click(); }
      };
      $("#check").onclick = async () => {
        const ans = $("#ans").value.trim();
        if (!ans) return toast("Write an answer first — retrieval is the point!");
        $("#check").disabled = true; $("#check").textContent = "Marking…";
        let g;
        if (card.type === "calc") g = gradeCalc(card, ans);
        else if (card.type === "essay") g = await gradeEssay(card, ans);
        else g = gradeLocal(card, ans);
        finishCard(card, g);
      };
    }
  }

  function finishCard(card, g) {
    applyResult(card, g.score, g.max);
    session.results.push({ card, g });
    $("#sheet").innerHTML = sheetHTML(card, g);
    const cont = $("#continue");
    cont.onclick = () => { session.idx++; renderCard(); };
    cont.focus();
    const sh = $("#sheet");
    if (sh.scrollIntoView) sh.scrollIntoView({ behavior: "smooth", block: "nearest" });
    wireGlossary();
  }

  function sheetHTML(card, g) {
    const ratio = g.max ? g.score / g.max : 0;
    const mood = ratio >= 0.95 ? ["great", "Nailed it!"] : ratio >= 0.7 ? ["good", "Strong — nearly all of it"] : ratio >= 0.4 ? ["mid", "On the way — keep building"] : ["low", "Not yet — let's look at it"];
    let body = "";
    if (g.kind === "mc") body = `<p><b>${g.correct ? "Correct." : "Not this one."}</b> ${esc(g.why)}</p>${g.correct ? "" : `<p>Answer: <b>${esc(g.answerText)}</b></p>`}`;
    if (g.kind === "calc") body = `<p>${g.correct ? "Correct." : "Expected <b>" + esc(g.model) + "</b>."}</p>${g.working ? `<p class="working"><b>Working:</b> ${esc(g.working)}</p>` : ""}`;
    if (g.kind === "local") body = `
      ${(g.matched.length || g.missing.length) ? `<div class="chips">${g.matched.map(t => `<span class="chip">${esc(t)} ✓</span>`).join("")}${g.missing.map(t => `<span class="chip todo" data-term="${esc(t)}">${esc(t)}</span>`).join("")}</div>` : ""}
      <details ${ratio < 0.7 ? "open" : ""}><summary>Model answer</summary><p>${linkGlossary(g.model)}</p></details>`;
    if (g.kind === "llm" || g.kind === "demo") {
      const fb = g.fb || {};
      body = `
        ${fb.overall ? `<p>${esc(fb.overall.summary || "")}</p>` : ""}
        ${(fb.criteria || []).map(c => `<div class="crit ${c.status}"><span class="dot"></span><b>${esc(c.name)}:</b> ${esc(c.comment || c.status)}</div>`).join("")}
        ${(fb.missing_vocabulary || []).length ? `<div class="chips">${fb.missing_vocabulary.map(t => `<span class="chip todo">${esc(t)}</span>`).join("")}</div>` : ""}
        ${(fb.next_steps || []).map(s => `<p class="next">→ ${esc(s)}</p>`).join("")}
        <details><summary>What a top answer covers</summary><p>${linkGlossary(card.model)}</p></details>`;
    }
    const ctx = card.context ? `<details class="ctx"><summary>Why — the concept</summary><p>${linkGlossary(card.context)}</p></details>` : "";
    return `<div class="sheet ${mood[0]}">
      <div class="head"><div class="score">${g.score}<small>/${g.max}</small></div><h3>${mood[1]}</h3></div>
      <div class="bd">${body}${ctx}<div class="actions"><button class="btn" id="continue">Continue</button></div></div>
    </div>`;
  }

  function summary() {
    const { area, results } = session;
    const got = results.reduce((n, r) => n + r.g.score, 0);
    const max = results.reduce((n, r) => n + r.g.max, 0);
    const s = areaStats(area);
    app.innerHTML = `
      <div class="summary">
        <div class="bigscore">${got}<small>/${max}</small></div>
        <h2>${esc(area.name)}</h2>
        <p>${s.mastered} of ${s.total} questions in this area are now in your long-term boxes. ${dueCards(area).length ? "More are ready when you are." : "Everything here is scheduled — come back when it's due."}</p>
        <div class="row center">
          <button class="btn" id="again">Keep going</button>
          <button class="btn ghost" id="back">All areas</button>
        </div>
      </div>`;
    $("#again").onclick = () => startSession(area.id);
    $("#back").onclick = home;
  }

  // ===================== CREATE (set builder + JSON import/export) =====================
  let draft = null; // { name, cards: [] }

  function builder() {
    view = "create";
    if (!draft) draft = { name: "", cards: [] };
    app.innerHTML = `
      ${nav()}
      <div class="hi">Create a flashcard set</div>
      <div class="hi-s">Build cards, study them like any area, and export the set as JSON to share.</div>

      <div class="bcard">
        <label class="blabel">Set name</label>
        <input id="setname" class="binput" placeholder="e.g. Inequality — my weak spots" value="${esc(draft.name)}">
      </div>

      <div class="bcard">
        <div class="brow">
          <div style="flex:1;min-width:180px"><label class="blabel">Question type</label>
            <select id="ctype" class="binput">
              <option value="mc">Multiple choice</option>
              <option value="calc">Calculation</option>
              <option value="define">Define</option>
              <option value="short">Short answer</option>
              <option value="essay">Extended response</option>
            </select></div>
          <div style="width:110px"><label class="blabel">Marks</label>
            <input id="cmarks" class="binput" type="number" min="1" max="20" value="2"></div>
        </div>
        <label class="blabel">Stimulus / source material (optional — data, an extract or a table shown above the question)</label>
        <textarea id="cstim" class="binput mono" rows="2" placeholder="e.g. a small data table or quote the question refers to…"></textarea>
        <label class="blabel">Question</label>
        <textarea id="cprompt" class="binput" rows="2" placeholder="Write the question…"></textarea>
        <div id="typefields"></div>
        <div class="row"><button class="btn sm" id="addcard">Add card</button><span class="hint" id="addmsg"></span></div>
      </div>

      <div class="bcard">
        <div class="brow between">
          <h3 class="bh">Cards in this set (<span id="ccount">${draft.cards.length}</span>)</h3>
          <div class="brow">
            <button class="btn sm ghost" id="studyset" ${draft.cards.length ? "" : "disabled"}>Study this set</button>
            <button class="btn sm" id="exportset" ${draft.cards.length ? "" : "disabled"}>Export JSON</button>
          </div>
        </div>
        <div id="cardlist">${cardListHTML()}</div>
        <div id="exportzone"></div>
      </div>

      <div class="bcard">
        <h3 class="bh">Glossary terms for this set (optional)</h3>
        <p class="bhint">Terms you add become tap-to-define in your set's questions and answers, and travel with the JSON export.</p>
        <div class="brow"><input id="gterm" class="binput" placeholder="Term" style="flex:1"><input id="gdef" class="binput" placeholder="Definition" style="flex:2"><button class="btn sm" id="addterm">Add</button></div>
        <div id="glist">${glossListHTML()}</div>
      </div>

      <div class="bcard">
        <h3 class="bh">Import a set</h3>
        <p class="bhint">Paste a set's JSON below (or the contents of an exported file) and load it as a studyable area.</p>
        <textarea id="importjson" class="binput mono" rows="4" placeholder='{"format":"${SET_FORMAT}","name":"…","cards":[…]}'></textarea>
        <div class="row"><button class="btn sm" id="doimport">Import set</button><span class="hint" id="importmsg"></span></div>
        ${state.customSets.length ? `<div class="setlist">${state.customSets.map(s =>
          `<div class="setrow"><span>🧩 <b>${esc(s.name)}</b> · ${s.cards.length} cards</span>
           <span><button class="btn sm ghost" data-edit="${s.id}">Load into editor</button>
           <button class="btn sm ghost danger" data-del="${s.id}">Delete</button></span></div>`).join("")}</div>` : ""}
      </div>`;
    wireNav();
    renderTypeFields();
    $("#ctype").onchange = renderTypeFields;
    $("#setname").oninput = e => { draft.name = e.target.value; };
    $("#addcard").onclick = addCard;
    $("#studyset").onclick = () => {
      const id = saveDraftAsSet();
      if (id) { maybeNudgeBackup(); modePicker(id); }
    };
    $("#exportset").onclick = exportDraft;
    $("#doimport").onclick = importSet;
    $("#addterm").onclick = () => {
      const term = $("#gterm").value.trim(), def = $("#gdef").value.trim();
      if (!term || !def) return toast("Both term and definition, please.");
      draft.glossary = draft.glossary || {};
      draft.glossary[term.toLowerCase()] = def;
      $("#gterm").value = ""; $("#gdef").value = "";
      $("#glist").innerHTML = glossListHTML();
      wireGlossDelete();
    };
    wireGlossDelete();
    app.querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
      state.customSets = state.customSets.filter(s => s.id !== b.dataset.del); save(); builder(); });
    app.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => {
      const s = state.customSets.find(x => x.id === b.dataset.edit);
      if (s) { draft = { name: s.name, cards: JSON.parse(JSON.stringify(s.cards)), glossary: JSON.parse(JSON.stringify(s.glossary || {})) }; builder(); } });
    app.querySelectorAll("[data-rm]").forEach(wireRemove);
  }

  function glossListHTML() {
    const g = draft && draft.glossary || {};
    const keys = Object.keys(g);
    if (!keys.length) return "";
    return keys.map(k => `<div class="setrow"><span><b>${esc(k)}</b> — ${esc(g[k])}</span><button class="btn sm ghost danger" data-gdel="${esc(k)}">Remove</button></div>`).join("");
  }
  function wireGlossDelete() {
    app.querySelectorAll("[data-gdel]").forEach(b => b.onclick = () => {
      delete draft.glossary[b.dataset.gdel];
      $("#glist").innerHTML = glossListHTML();
      wireGlossDelete();
    });
  }

  function cardListHTML() {
    if (!draft.cards.length) return `<p class="bhint">No cards yet — add your first one above.</p>`;
    return draft.cards.map((c, i) =>
      `<div class="setrow"><span><span class="tag gold">${{ mc:"MC", calc:"Calc", define:"Define", short:"Short", essay:"Essay" }[c.type]}</span> ${esc(c.prompt.slice(0, 70))}${c.prompt.length > 70 ? "…" : ""} <small>(${c.marks}m)</small></span>
       <button class="btn sm ghost danger" data-rm="${i}">Remove</button></div>`).join("");
  }
  function wireRemove(b) {
    b.onclick = () => { draft.cards.splice(+b.dataset.rm, 1); builder(); };
  }

  function renderTypeFields() {
    const t = $("#ctype").value;
    const z = $("#typefields");
    if (t === "mc") {
      z.innerHTML = `<label class="blabel">Options — tick the correct one, and say why each is right/wrong</label>
        ${[0,1,2,3].map(i => `<div class="brow optrow">
          <input type="radio" name="okopt" value="${i}" ${i===0?"checked":""} aria-label="correct option ${i+1}">
          <input class="binput" id="opt${i}" placeholder="Option ${i+1} text" style="flex:2">
          <input class="binput" id="why${i}" placeholder="Why right/wrong (shown as feedback)" style="flex:3">
        </div>`).join("")}`;
    } else if (t === "calc") {
      z.innerHTML = `<div class="brow">
        <div style="flex:1"><label class="blabel">Expected answer (number)</label><input id="cexp" class="binput" type="number" step="any"></div>
        <div style="width:140px"><label class="blabel">Tolerance (±)</label><input id="ctol" class="binput" type="number" step="any" value="0"></div></div>
        <label class="blabel">Working (shown as feedback)</label><input id="cwork" class="binput" placeholder="e.g. 0.75 ÷ 12.5 × 100 = 6.0%">`;
    } else {
      z.innerHTML = `<label class="blabel">Model answer</label>
        <textarea id="cmodel" class="binput" rows="3" placeholder="What a full-mark answer says…"></textarea>
        <label class="blabel">Required key terms (comma separated)</label>
        <input id="cvocab" class="binput" placeholder="e.g. gini coefficient, lorenz, quintile">
        ${t === "essay" ? `<label class="blabel">Scaffold steps (one per line, optional)</label>
        <textarea id="cscaffold" class="binput" rows="3" placeholder="Define the concept…&#10;Develop two effects…&#10;Reach a judgement…"></textarea>` : ""}`;
    }
  }

  function addCard() {
    const t = $("#ctype").value;
    const marks = Math.max(1, Math.min(20, +$("#cmarks").value || 1));
    const prompt = $("#cprompt").value.trim();
    const msg = $("#addmsg");
    if (!prompt) return msg.textContent = "Write the question first.";
    const card = { id: "u" + Date.now() + Math.random().toString(36).slice(2, 6), type: t, marks, prompt };
    const stim = $("#cstim").value.trim();
    if (stim) card.stimulus = stim;
    if (t === "mc") {
      const okIdx = +(app.querySelector('input[name="okopt"]:checked') || {}).value;
      const choices = [0,1,2,3].map(i => ({ t: $("#opt"+i).value.trim(), ok: i === okIdx, why: $("#why"+i).value.trim() })).filter(c => c.t);
      if (choices.length < 2) return msg.textContent = "Give at least two options.";
      if (!choices.some(c => c.ok)) return msg.textContent = "Tick the correct option.";
      card.choices = choices;
      card.model = choices.find(c => c.ok).t;
    } else if (t === "calc") {
      const exp = parseFloat($("#cexp").value);
      if (!Number.isFinite(exp)) return msg.textContent = "Expected answer must be a number.";
      card.expected = exp;
      card.tolerance = Math.abs(parseFloat($("#ctol").value) || 0);
      card.working = $("#cwork").value.trim();
      card.model = String(exp);
    } else {
      const model = $("#cmodel").value.trim();
      if (!model) return msg.textContent = "Write the model answer — it powers the grading.";
      card.model = model;
      card.vocab = $("#cvocab").value.split(",").map(s => s.trim()).filter(Boolean);
      if (t === "essay") {
        const sc = ($("#cscaffold").value || "").split("\n").map(s => s.trim()).filter(Boolean);
        if (sc.length) card.scaffold = sc;
      }
    }
    draft.cards.push(card);
    msg.textContent = "Added ✓";
    $("#cprompt").value = "";
    renderTypeFields();
    $("#ccount").textContent = draft.cards.length;
    $("#cardlist").innerHTML = cardListHTML();
    app.querySelectorAll("[data-rm]").forEach(wireRemove);
    $("#studyset").disabled = $("#exportset").disabled = false;
  }

  let backupNudged = false;
  function maybeNudgeBackup() {
    if (backupNudged) return;
    if (!persistent) return; // preview mode already warns
    if (!state.customSets.length) return;
    backupNudged = true;
    toast("Set saved to this browser. Tip: Settings → Backup & restore to download a copy you can keep or move to another device.", 6000);
  }
  function saveDraftAsSet() {
    if (!draft.cards.length) { toast("Add some cards first."); return null; }
    const name = (draft.name || "My set").trim();
    let set = state.customSets.find(s => s.name === name);
    if (set) { set.cards = draft.cards; set.glossary = draft.glossary || {}; }
    else { set = { id: "custom-" + Date.now(), name, cards: draft.cards, glossary: draft.glossary || {} }; state.customSets.push(set); }
    mergeCustomGlossaries();
    save();
    return set.id;
  }

  function exportDraft() {
    const name = (draft.name || "My set").trim();
    const payload = JSON.stringify({ format: SET_FORMAT, name, exported: new Date().toISOString(), glossary: draft.glossary || {}, cards: draft.cards }, null, 2);
    saveDraftAsSet();
    const z = $("#exportzone");
    z.innerHTML = `<label class="blabel">Set JSON — download it, or copy and share</label>
      <textarea class="binput mono" id="exptext" rows="6" readonly></textarea>
      <div class="row"><button class="btn sm" id="dl">Download .json</button><button class="btn sm ghost" id="cp">Copy to clipboard</button><span class="hint" id="expmsg"></span></div>`;
    $("#exptext").value = payload;
    $("#dl").onclick = () => {
      try {
        const blob = new Blob([payload], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".json";
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      } catch { $("#expmsg").textContent = "Download blocked here — copy the JSON instead."; }
    };
    $("#cp").onclick = async () => {
      try { await navigator.clipboard.writeText(payload); $("#expmsg").textContent = "Copied ✓"; }
      catch { $("#exptext").select(); document.execCommand && document.execCommand("copy"); $("#expmsg").textContent = "Select-all + copy if needed."; }
    };
  }

  function importSet() {
    const msg = $("#importmsg");
    let data;
    try { data = JSON.parse($("#importjson").value); }
    catch { return msg.textContent = "That isn't valid JSON."; }
    const errs = validateSet(data);
    if (errs.length) return msg.textContent = errs[0];
    const set = { id: "custom-" + Date.now(), name: data.name || "Imported set", cards: data.cards, glossary: data.glossary || {} };
    // re-id cards to avoid clashing progress
    set.cards.forEach((c, i) => { c.id = set.id + "-" + i; });
    state.customSets.push(set);
    mergeCustomGlossaries();
    save();
    msg.textContent = "Imported ✓ — it's now on your Study map.";
    builder();
  }

  function validateSet(data) {
    const errs = [];
    if (!data || typeof data !== "object") return ["Not a set object."];
    if (!Array.isArray(data.cards) || !data.cards.length) return ["The set has no cards array."];
    data.cards.forEach((c, i) => {
      const at = "Card " + (i + 1) + ": ";
      if (!c.prompt) errs.push(at + "missing prompt.");
      if (!c.marks || c.marks < 1) errs.push(at + "missing marks.");
      if (!["mc", "calc", "define", "short", "essay"].includes(c.type)) errs.push(at + "unknown type '" + c.type + "'.");
      if (c.type === "mc") {
        if (!Array.isArray(c.choices) || c.choices.length < 2) errs.push(at + "MC needs 2+ choices.");
        else if (c.choices.filter(x => x.ok).length !== 1) errs.push(at + "MC needs exactly one correct choice.");
      }
      if (c.type === "calc" && typeof c.expected !== "number") errs.push(at + "calc needs a numeric 'expected'.");
      if (["define", "short", "essay"].includes(c.type) && !c.model) errs.push(at + "needs a model answer.");
    });
    return errs;
  }

  // ---------- glossary popover ----------
  function wireGlossary() {
    app.querySelectorAll(".term,[data-term]").forEach(el => {
      el.onclick = e => {
        const term = el.dataset.term || el.textContent;
        const def = C.glossary[term.toLowerCase()] || C.glossary[Object.keys(C.glossary).find(k => term.toLowerCase().includes(k))];
        if (def) showPop(e, term, def);
      };
    });
  }
  function showPop(e, term, def) {
    closePop();
    const p = document.createElement("div");
    p.className = "pop";
    p.innerHTML = `<b>${esc(term)}</b><p>${esc(def)}</p>`;
    document.body.appendChild(p);
    const r = e.target.getBoundingClientRect();
    p.style.left = Math.max(8, Math.min(r.left, innerWidth - p.offsetWidth - 16)) + "px";
    p.style.top = (r.bottom + 8 + scrollY) + "px";
    setTimeout(() => document.addEventListener("click", closePop, { once: true }), 0);
  }
  function closePop() { document.querySelectorAll(".pop").forEach(p => p.remove()); }

  function toast(msg, ms) {
    const t = document.createElement("div"); t.className = "toast"; t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), ms || 2200);
  }

  // Keyboard: Space flips · 1/2/3 rates (flash) · 1–4 picks MC · Enter continues
  document.addEventListener("keydown", e => {
    if (!session) return;
    const t = (e.target || {}).tagName;
    const typing = t === "TEXTAREA" || t === "INPUT";
    const cont = document.querySelector("#continue");
    if (cont && e.key === "Enter" && !typing) { e.preventDefault(); cont.click(); return; }
    if (session.mode === "flash") {
      if (typing) return;
      const flip = document.querySelector("#flip");
      if (!flip) return;
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        (flip.classList.contains("flipped") ? document.querySelector("#flipback") : document.querySelector("#flipcta")).click();
      }
      if (flip.classList.contains("flipped") && ["1", "2", "3"].includes(e.key)) {
        const map = { "1": "0", "2": "0.5", "3": "1" };
        const b = document.querySelector('.rate[data-r="' + map[e.key] + '"]');
        if (b) b.click();
      }
      return;
    }
    if (typing) return;
    const choices = [...document.querySelectorAll(".choice")];
    if (choices.length && !document.querySelector(".sheet .head") && ["1", "2", "3", "4"].includes(e.key)) {
      const b = choices[+e.key - 1];
      if (b && b.onclick) b.click();
    }
  });

  const brand = document.querySelector("header .brand");
  if (brand) { brand.style.cursor = "pointer"; brand.onclick = () => { view = "study"; mainPage(); }; }

  home();
})();
