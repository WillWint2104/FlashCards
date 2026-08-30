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

  // Student-selectable card text size. Single source of truth: the --card-scale
  // CSS custom property (only .fprompt + .fans read it, so app chrome is unscaled).
  // Default = Medium = a comfortable, slightly enlarged size. Device-local.
  const CARD_SCALE_KEY = "marginal:cardFontScale";
  const CARD_SCALES = { s: 1, m: 1.15, l: 1.4, xl: 1.7 };
  function cardScaleStep() { try { const v = localStorage.getItem(CARD_SCALE_KEY); return CARD_SCALES[v] ? v : "m"; } catch (e) { return "m"; } }
  function applyCardScale(step) { try { document.documentElement.style.setProperty("--card-scale", CARD_SCALES[step] || CARD_SCALES.m); } catch (e) { /* ignore */ } }
  applyCardScale(cardScaleStep()); // apply BEFORE any render so there's no flash of the wrong size

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
    function blank() { return { cards: {}, endpoint: "", code: "", log: [], customSets: [], lessons: {}, exams: [] }; }
  }
  state.customSets = state.customSets || [];
  state.lessons = state.lessons || {};
  state.exams = state.exams || [];  // imported practice-exam papers (marginal-exam@1)
  // Teacher's TEACHER SETUP config is the source of truth for the endpoint —
  // students have no field to edit it, so always sync from CONFIG (this also
  // clears any endpoint a returning user has stale in localStorage).
  state.endpoint = (CONFIG.endpoint || "").trim();
  if (!state.code && CONFIG.code) state.code = CONFIG.code;
  function mergeCustomGlossaries() {
    state.customSets.forEach(s => { if (s.glossary) Object.keys(s.glossary).forEach(k => { C.glossary[k.toLowerCase()] = s.glossary[k]; }); });
  }
  mergeCustomGlossaries();
  function save() { store.setItem(LS_KEY, JSON.stringify(state)); }

  // =====================================================================
  // Cloud (Supabase) — OPTIONAL backend for student logins + durable custom
  // sets. Stays fully dormant unless CONFIG.supabaseUrl + supabaseAnonKey are
  // set AND the supabase-js CDN loaded. Touches ONLY auth + custom sets —
  // never grades, SRS, lessons, or built-in modules (those stay local).
  // =====================================================================
  const Cloud = (function () {
    let client = null, sess = null, prof = null, sets = [];

    // MUST match the Edge Function's emailFor() exactly.
    function emailFor(classCode, num) {
      const cls = String(classCode || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const n = String(num || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      return (cls && n) ? `s${n}@${cls}.marginal.local` : null;
    }

    function init() {
      if (!CONFIG.supabaseUrl || !CONFIG.supabaseAnonKey) return false;
      if (!window.supabase || !window.supabase.createClient) return false;
      try { client = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey); return true; }
      catch (e) { client = null; return false; }
    }

    async function loadProfile() {
      if (!client || !sess) { prof = null; return; }
      try {
        const { data } = await client.from("profiles").select("class_code, student_number").eq("user_id", sess.user.id).maybeSingle();
        prof = data || null;
      } catch (e) { prof = null; }
    }
    async function loadSets() {
      if (!client || !sess) { sets = []; return sets; }
      try {
        const { data, error } = await client.from("sets").select("*").order("created_at", { ascending: true });
        if (error) throw error;
        sets = data || [];
      } catch (e) { sets = []; }
      return sets;
    }
    async function restore() {
      if (!client) return;
      try {
        const { data } = await client.auth.getSession();
        sess = (data && data.session) || null;
        if (sess) { await loadProfile(); await loadSets(); }
      } catch (e) { sess = null; }
    }

    async function signIn(classCode, num, password) {
      if (!client) return { ok: false, error: "Sign-in isn't configured." };
      const email = emailFor(classCode, num);
      if (!email) return { ok: false, error: "Enter your class code and student number." };
      if (!password) return { ok: false, error: "Enter your password." };
      // 1) try a normal sign-in
      let r = await client.auth.signInWithPassword({ email, password });
      if (!r.error) { sess = r.data.session; await loadProfile(); await loadSets(); return { ok: true }; }
      // 2) maybe the password isn't set yet (first login, or after a teacher reset)
      let res;
      try { res = await client.functions.invoke("marginal-admin", { body: { action: "set-password", class_code: classCode, student_number: num, password } }); }
      catch (e) { return { ok: false, error: "Couldn't reach the server. Try again." }; }
      const out = res && res.data;
      if (!out) return { ok: false, error: "Couldn't reach the server. Try again." };
      if (out.status === "created" || out.status === "set") {
        r = await client.auth.signInWithPassword({ email, password });
        if (!r.error) { sess = r.data.session; await loadProfile(); await loadSets(); return { ok: true, firstSet: true }; }
        return { ok: false, error: "Password set, but sign-in failed — try again." };
      }
      if (out.status === "already_set") return { ok: false, error: "Wrong password. Forgotten it? Request a reset below." };
      return { ok: false, error: out.error || "Sign-in failed." };
    }
    async function signOut() {
      try { if (client) await client.auth.signOut(); } catch (e) { /* ignore */ }
      sess = null; prof = null; sets = [];
    }
    async function requestReset(classCode, num) {
      if (!client) return { ok: false, error: "Not configured." };
      if (!classCode || !num) return { ok: false, error: "Enter your class code and student number." };
      try {
        const { error } = await client.from("pending_resets").insert({ class_code: String(classCode), student_number: String(num) });
        if (error) {
          if (/duplicate|unique/i.test(error.message || "")) return { ok: true, already: true };
          return { ok: false, error: error.message };
        }
        return { ok: true };
      } catch (e) { return { ok: false, error: "Couldn't send the request." }; }
    }

    async function createSet(name, cards, tags) {
      if (!client || !sess) return null;
      const { data, error } = await client.from("sets")
        .insert({ owner: sess.user.id, name: name || "Untitled set", cards: cards || [], tags: tags || [] })
        .select().single();
      if (error) throw error;
      sets.push(data); return data;
    }
    async function renameSet(id, name) {
      if (!client) return;
      const { data, error } = await client.from("sets").update({ name, updated_at: new Date().toISOString() }).eq("id", id).select().single();
      if (error) throw error;
      const i = sets.findIndex(s => s.id === id); if (i >= 0) sets[i] = data;
    }
    async function setTags(id, tags) {
      if (!client) return;
      const { data, error } = await client.from("sets").update({ tags, updated_at: new Date().toISOString() }).eq("id", id).select().single();
      if (error) throw error;
      const i = sets.findIndex(s => s.id === id); if (i >= 0) sets[i] = data;
    }
    async function deleteSet(id) {
      if (!client) return;
      const { error } = await client.from("sets").delete().eq("id", id);
      if (error) throw error;
      sets = sets.filter(s => s.id !== id);
    }
    async function touchStudied(id) {
      if (!client) return;
      try {
        const { data } = await client.from("sets").update({ last_studied_at: new Date().toISOString() }).eq("id", id).select().single();
        const i = sets.findIndex(s => s.id === id); if (i >= 0 && data) sets[i] = data;
      } catch (e) { /* best effort */ }
    }

    return {
      init, restore, signIn, signOut, requestReset,
      createSet, renameSet, setTags, deleteSet, touchStudied,
      enabled: () => !!client, session: () => sess, who: () => prof, sets: () => sets,
    };
  })();

  // When logged into the cloud, custom sets come from the account; otherwise
  // they come from this browser's localStorage (today's behaviour, untouched).
  function cloudActive() { return Cloud.enabled() && !!Cloud.session(); }
  // HARD GATE: when cloud auth is configured, the student must be signed in to
  // reach ANY part of the app. (When Supabase is unconfigured there is no auth
  // to gate on, so the app behaves normally — preserves forks/offline.)
  // Gate on CONFIG presence, not Cloud.enabled(): if the supabase-js CDN fails
  // to load while keys are set, Cloud.enabled() would be false and silently
  // bypass the gate — so fail CLOSED (show the gate) whenever auth is configured.
  function cloudConfigured() { return !!(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey); }
  function gated() { return cloudConfigured() && !Cloud.session(); }
  function getCustomSets() { return cloudActive() ? Cloud.sets() : state.customSets; }
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
      data: { cards: state.cards, lessons: state.lessons, log: state.log, customSets: state.customSets, exams: state.exams }
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
    if (Array.isArray(d.exams)) {
      const ids = new Set((state.exams || []).map(x => x.id));
      d.exams.forEach(p => { if (!ids.has(p.id)) state.exams.push(p); });
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
  // Remove an imported/custom set cleanly: drop the set AND purge the per-card
  // SRS state and history for its cards, so nothing is left orphaned in storage.
  // Built-in modules use different card ids, so they are never touched.
  function removeCustomSet(id) {
    const set = state.customSets.find(s => s.id === id);
    if (!set) return false;
    const ids = new Set((set.cards || []).map(c => c.id));
    ids.forEach(cid => { delete state.cards[cid]; });
    state.log = (state.log || []).filter(e => !ids.has(e.id));
    state.customSets = state.customSets.filter(s => s.id !== id);
    save();
    return true;
  }
  function findArea(id) {
    for (const t of C.topics) { const a = (t.areas || []).find(x => x.id === id); if (a) return a; }
    const s = getCustomSets().find(x => x.id === id);
    return s ? customAsArea(s) : null;
  }
  function getLesson(id) {
    // Search every topic's areas first (topic-scoped areas, e.g. the Trial HSC
    // Revision topic, are not in C.areas), then fall back to C.areas. Mirrors
    // findArea so a lesson in any topic is reachable and its mastery persists.
    for (const t of (C.topics || [])) { for (const a of (t.areas || [])) { const l = (a.lessons || []).find(x => x.id === id); if (l) return l; } }
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
  // The subject namespace whose label matches this one, or null. Subject content is
  // the source of truth for criteria and band expectations, so adding a subject
  // stays content-only.
  function essaySubjectByLabel(label) {
    const subs = (window.ESSAY && window.ESSAY.subjects) || {};
    const hit = Object.keys(subs).find(k => String(subs[k].label || "").toLowerCase() === String(label || "").toLowerCase());
    return hit ? subs[hit] : null;
  }
  // What THIS question requires: the concepts to address, the relationships to
  // demonstrate, and what a strong response accomplishes. An authored
  // `requirements` block wins. Otherwise we DERIVE from what the card already
  // carries (its required metalanguage and its scaffold) rather than inventing
  // requirements nobody wrote. Returns undefined when there is nothing real to send.
  function markingRequirements(card) {
    const r = (card && card.requirements) || null;
    const out = {
      concepts: (r && r.concepts) || (card && card.vocab) || [],
      relationships: (r && r.relationships) || [],
      accomplish: (r && r.accomplish) || (card && card.scaffold) || [],
      syllabus: (r && r.syllabus) || "",
    };
    const any = out.concepts.length || out.relationships.length || out.accomplish.length || out.syllabus;
    return any ? out : undefined;
  }
  // Which subject is being marked, the criteria IT is marked against, the band
  // expectations to judge against, and what this question requires. Marking used to
  // be hardcoded to Economics; the subject namespace is now the source of truth,
  // and a card or an imported paper can override.
  function markingContext(card) {
    // Test mode (a whole imported paper) may carry its own subject/criteria; it is
    // defined only when that mode is present, so reach for it defensively.
    const paper = (typeof EXAM !== "undefined" && EXAM && EXAM.paper) ? EXAM.paper : null;
    const label = (card && card.subject) || (paper && paper.subject) || C.subject || "";
    const sub = essaySubjectByLabel(label);
    let criteria = (card && card.markingCriteria) || (paper && paper.markingCriteria) || null;
    if (!criteria) criteria = (sub && sub.markingCriteria) || C.markingCriteria || null;
    // Band expectations. A question may ship its own; criteria.bands === null means
    // "use the general ones", which is the normal case while no official set is
    // authored. The general set is written originally and is subject-agnostic.
    const qc = (card && card.criteria) || null;
    const gen = (window.ESSAY && window.ESSAY.bandExpectations) || null;
    const bands = (qc && qc.bands) || (sub && sub.bandExpectations && sub.bandExpectations.bands) || (gen && gen.bands) || null;
    const src = (qc && qc.source) || (sub && sub.bandExpectations && sub.bandExpectations.source) || (gen && gen.source) || "";
    return {
      subject: label || undefined,
      criteria: criteria || undefined,
      bands: bands || undefined,
      bandsSource: src || undefined,
      topic: (card && card.topic) || undefined,
      requirements: markingRequirements(card),
    };
  }
  // THE marking path for every written response, short answer or extended, wherever
  // it is answered: a study card, a paper in Test mode, or a full essay attempt. The
  // response type travels with the request so the marker judges a three-mark short
  // answer as a short answer and not as a miniature essay.
  //
  // opts.plan is the student's own plan and opts.validContent our authored argument
  // pathways. Both are sent, and the worker routes them to the DIAGNOSIS pass only:
  // they are context for reading the response, never a checklist that awards marks.
  function responseTypeOf(card, opts) {
    if (opts && opts.responseType) return opts.responseType;
    return (card && card.type === "essay") ? "extended" : "short";
  }
  async function gradeWritten(card, answer, opts) {
    opts = opts || {};
    if (state.endpoint) {
      try {
        const mc = markingContext(card);
        const res = await fetch(state.endpoint, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({
            prompt: card.prompt, marks: card.marks, model_answer: card.model, vocab: card.vocab, answer,
            scaffold: card.scaffold, faults: card.faults,
            command: card.command || commandOf(card.prompt) || undefined,
            subject: mc.subject, criteria: mc.criteria,
            bands: mc.bands, bandsSource: mc.bandsSource, topic: mc.topic, requirements: mc.requirements,
            responseType: responseTypeOf(card, opts), stimulus: !!card.stimulus,
            rubric: card.rubric || undefined,
            plan: opts.plan, validContent: opts.validContent, blocks: opts.blocks,
            code: state.code || undefined
          })
        });
        if (!res.ok) throw new Error("proxy " + res.status);
        const g = await res.json();
        // Carry the question context onto the review for the modal header / overlays.
        if (g && Array.isArray(g.paragraphs)) g.question = { stem: card.prompt, command: card.command, marks: card.marks, stimulus: card.stimulus };
        // How much of the marking is verifiably drawn from this student's page. A low
        // figure means the feedback drifted generic, which is the fault this rebuild
        // exists to kill, so it is surfaced rather than swallowed (BUILD-CHECKS).
        if (g && g.checks && g.checks.sentences && g.checks.grounded < 0.6) {
          console.warn("[marking] only", Math.round(g.checks.grounded * 100) + "% of the marked sentences match the student's text");
        }
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
      <button class="navtab ${view === "test" ? "on" : ""}" data-v="test">Test mode</button>
      ${essayEnabled() ? `<button class="navtab" data-v="essay">Essay practice</button>` : ""}
    </div>`;
  }
  function wireNav() {
    app.querySelectorAll(".navtab").forEach(b => b.onclick = () => {
      const v = b.dataset.v;
      // Essay practice is a full-screen overlay (not a study/create view), and it runs
      // on the student's own question, so it is available to any login while the flag
      // is on. It never changes the underlying Study/Create view.
      if (v === "essay") { esOpen({}); return; }
      // Test mode is a real view (full screen), not an overlay: it lists the
      // practice exams a teacher has imported and is where a paper is sat.
      if (v === "test") { view = "test"; examHome(); return; }
      view = v; view === "study" ? home() : builder();
    });
  }

  // ===================== STUDY =====================
  function home() { if (gated()) return authScreen(); session = null; currentTopic ? areaMap(currentTopic) : mainPage(); }

  function mainPage() {
    if (gated()) return authScreen();
    view = "study"; session = null; currentTopic = null;
    app.innerHTML = `
      ${nav()}
      ${cloudBarHTML()}
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
      ${examList().length ? `<p class="exam-hint">You have ${examList().length} practice exam${examList().length === 1 ? "" : "s"} ready. Open <b>Test mode</b> to sit one.</p>` : ""}
      <div id="setsmgrwrap">${setsManagerHTML()}</div>
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
    wireCloudBar();
    wireSetsManager();
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

  // ---------- cloud sign-in bar (only when Supabase is configured) ----------
  function cloudBarHTML() {
    // The app is only reachable when signed in (hard gate), so this bar always
    // shows the signed-in identity + sign-out. (Empty when Supabase is off.)
    if (!cloudActive()) return "";
    const w = Cloud.who();
    const label = w ? `${esc(w.class_code)} · #${esc(w.student_number)}` : "Signed in";
    return `<div class="whoami" style="justify-content:flex-end;margin:-4px 0 8px">Signed in: <b>${label}</b> <button class="btn sm ghost" id="signout">Sign out</button></div>`;
  }
  function wireCloudBar() {
    const so = $("#signout"); if (so) so.onclick = async () => { await Cloud.signOut(); toast("Signed out."); authScreen(); };
  }

  // ---------- auth screen (class code + student number + password) ----------
  function authScreen() {
    view = "study"; session = null; currentTopic = null;
    // The hard gate — the entry point when not signed in. No nav, no way past
    // it until sign-in succeeds.
    app.innerHTML = `
      <div class="authgate">
      <div class="authcard">
        <div class="authbrand">Marginal</div>
        <h2>Sign in to start studying</h2>
        <p class="bhint">Enter your class code and student number, then your password. <b>First time? Pick a password you'll remember</b> — you'll use it to sign in from any device.</p>
        <div class="authfield"><label for="acode">Class code</label><input id="acode" value="${esc(CONFIG.code || "")}" autocomplete="off"></div>
        <div class="authfield"><label for="anum">Student number</label><input id="anum" inputmode="numeric" autocomplete="off"></div>
        <div class="authfield"><label for="apass">Password</label><input id="apass" type="password" autocomplete="current-password" placeholder="First time? Choose one you'll remember"></div>
        <button class="btn" id="ado" style="width:100%">Sign in</button>
        <div class="authmsg" id="amsg"></div>
        <div style="margin-top:12px;text-align:center"><button class="authlink" id="aforgot">Forgotten your password? Request a reset</button></div>
      </div>
      </div>`;
    const msg = $("#amsg");
    const setMsg = (t, cls) => { msg.textContent = t; msg.className = "authmsg" + (cls ? " " + cls : ""); };
    $("#ado").onclick = async () => {
      const code = $("#acode").value.trim(), num = $("#anum").value.trim(), pass = $("#apass").value;
      setMsg("Signing in…");
      const r = await Cloud.signIn(code, num, pass);
      if (r.ok) { toast(r.firstSet ? "Password set — you're signed in." : "Signed in."); mainPage(); }
      else setMsg(r.error || "Sign-in failed.", "err");
    };
    $("#apass").onkeydown = e => { if (e.key === "Enter") $("#ado").click(); };
    $("#aforgot").onclick = async () => {
      const code = $("#acode").value.trim(), num = $("#anum").value.trim();
      if (!code || !num) return setMsg("Enter your class code and student number first.", "err");
      setMsg("Sending request…");
      const r = await Cloud.requestReset(code, num);
      if (r.ok) setMsg(r.already ? "A reset request is already pending — ask your teacher to approve it." : "Reset requested. Once your teacher approves it, sign in and enter a new password.", "ok");
      else setMsg(r.error || "Couldn't send the request.", "err");
    };
    $("#acode").focus();
  }

  // ---------- sets manager (compact list: search / sort / tags / scroll) ----------
  const smState = { q: "", sort: "recent", tag: null };
  function localTs(id) { const m = /custom-(\d+)/.exec(id || ""); return m ? +m[1] : 0; }
  function fmtWhen(ts) {
    if (!ts) return "never";
    const diff = Date.now() - ts, day = 86400000;
    if (diff < day) return "today";
    if (diff < 2 * day) return "yesterday";
    if (diff < 7 * day) return Math.floor(diff / day) + " days ago";
    return new Date(ts).toLocaleDateString();
  }
  function setRows() {
    const cloud = cloudActive();
    return getCustomSets().map(s => ({
      id: s.id,
      name: s.name || "Untitled set",
      count: (s.cards || []).length,
      tags: Array.isArray(s.tags) ? s.tags : [],
      created: cloud ? (Date.parse(s.created_at || "") || 0) : localTs(s.id),
      studied: cloud ? (s.last_studied_at ? Date.parse(s.last_studied_at) : 0) : (s.last_studied || 0),
    }));
  }
  function smFiltered() {
    let rows = setRows();
    const q = smState.q.trim().toLowerCase();
    if (q) rows = rows.filter(r => r.name.toLowerCase().includes(q));
    if (smState.tag) rows = rows.filter(r => r.tags.includes(smState.tag));
    const by = smState.sort;
    rows.sort((a, b) => by === "name" ? a.name.localeCompare(b.name) : by === "created" ? b.created - a.created : b.studied - a.studied);
    return rows;
  }
  function setsManagerHTML() {
    const rows = setRows();
    const cloud = cloudActive();
    const head = `<div class="setshead">Your sets${rows.length ? ` <small>(${rows.length})</small>` : ""}</div>`;
    if (!rows.length) {
      const why = Cloud.enabled() && !cloud
        ? "Sign in to load your saved sets, or build/import one in the Create tab."
        : "Build or import a set in the Create tab — it'll show up here.";
      return `<div class="setsmgr">${head}<div class="smscroll"><div class="smempty">${why}</div></div></div>`;
    }
    const tags = [...new Set(rows.flatMap(r => r.tags))].sort();
    const shown = smFiltered();
    return `<div class="setsmgr">${head}
      <div class="smbar">
        <input class="sminput" id="smsearch" type="search" placeholder="Search sets by name…" value="${esc(smState.q)}">
        <select class="smsort" id="smsort">
          <option value="recent"${smState.sort === "recent" ? " selected" : ""}>Recently studied</option>
          <option value="created"${smState.sort === "created" ? " selected" : ""}>Date created</option>
          <option value="name"${smState.sort === "name" ? " selected" : ""}>Name (A–Z)</option>
        </select>
      </div>
      ${tags.length ? `<div class="smtags"><button class="tagchip ${!smState.tag ? "on" : ""}" data-tag="">All</button>${tags.map(t => `<button class="tagchip ${smState.tag === t ? "on" : ""}" data-tag="${esc(t)}">${esc(t)}</button>`).join("")}</div>` : ""}
      <div class="smscroll">${shown.length ? shown.map(r => `
        <div class="smrow">
          <div style="min-width:0">
            <div class="smname" data-open="${esc(r.id)}" title="Study this set">${esc(r.name)}</div>
            <div class="smmeta">last studied ${fmtWhen(r.studied)}</div>
            ${r.tags.length ? `<div class="smsettags">${r.tags.map(t => `<span class="smsettag">${esc(t)}</span>`).join("")}</div>` : ""}
          </div>
          <div class="smcount">${r.count} card${r.count === 1 ? "" : "s"}</div>
          <div class="smacts">
            <button class="btn sm ghost" data-tagedit="${esc(r.id)}" title="Edit tags">Tags</button>
            <button class="btn sm ghost" data-rename="${esc(r.id)}">Rename</button>
            <button class="btn sm ghost danger" data-del2="${esc(r.id)}">Delete</button>
          </div>
        </div>`).join("") : `<div class="smempty">No sets match your search.</div>`}</div>
    </div>`;
  }
  function rerenderSets() {
    const wrap = $("#setsmgrwrap"); if (!wrap) return;
    const hadFocus = document.activeElement && document.activeElement.id === "smsearch";
    wrap.innerHTML = setsManagerHTML();
    wireSetsManager();
    if (hadFocus) { const s = $("#smsearch"); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }
  }
  function wireSetsManager() {
    const ss = $("#smsearch"); if (ss) ss.oninput = e => { smState.q = e.target.value; rerenderSets(); };
    const so = $("#smsort"); if (so) so.onchange = e => { smState.sort = e.target.value; rerenderSets(); };
    app.querySelectorAll("[data-tag]").forEach(b => b.onclick = () => { smState.tag = b.dataset.tag || null; rerenderSets(); });
    app.querySelectorAll("[data-open]").forEach(b => b.onclick = () => modePicker(b.dataset.open));
    app.querySelectorAll("[data-rename]").forEach(b => b.onclick = () => renameSetUI(b.dataset.rename));
    app.querySelectorAll("[data-del2]").forEach(b => b.onclick = () => deleteSetUI(b.dataset.del2));
    app.querySelectorAll("[data-tagedit]").forEach(b => b.onclick = () => tagEditUI(b.dataset.tagedit));
  }
  async function renameSetUI(id) {
    const cur = setRows().find(r => r.id === id);
    const name = prompt("Rename set:", cur ? cur.name : "");
    if (name == null) return;
    const nm = name.trim(); if (!nm) return;
    if (cloudActive()) { try { await Cloud.renameSet(id, nm); } catch (e) { return toast("Couldn't rename: " + e.message); } }
    else { const s = state.customSets.find(x => x.id === id); if (s) { s.name = nm; save(); } }
    rerenderSets();
  }
  async function deleteSetUI(id) {
    const cur = setRows().find(r => r.id === id);
    if (!confirm(`Delete "${cur ? cur.name : "this set"}"? This removes the set${cloudActive() ? " from your account" : " from this device"}. Built-in topics are not affected.`)) return;
    if (cloudActive()) { try { await Cloud.deleteSet(id); } catch (e) { return toast("Couldn't delete: " + e.message); } }
    else { removeCustomSet(id); }
    toast("Set deleted.");
    rerenderSets();
  }
  async function tagEditUI(id) {
    const cur = setRows().find(r => r.id === id);
    const input = prompt("Tags (comma-separated):", cur ? cur.tags.join(", ") : "");
    if (input == null) return;
    const tags = input.split(",").map(t => t.trim()).filter(Boolean).filter((t, i, a) => a.indexOf(t) === i);
    if (cloudActive()) { try { await Cloud.setTags(id, tags); } catch (e) { return toast("Couldn't save tags: " + e.message); } }
    else { const s = state.customSets.find(x => x.id === id); if (s) { s.tags = tags; save(); } }
    rerenderSets();
  }

  function areaMap(topicId) {
    if (gated()) return authScreen();
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

  // Fisher-Yates in place — used to shuffle a whole-set flashcard run.
  function shuffleArr(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  function startSession(areaId, mode, opts) {
    mode = mode || "mix";
    opts = opts || {};
    const area = findArea(areaId);
    if (!area || !area.cards.length) return toast("This set has no cards yet.");
    const pool = area.cards.filter(MODES[mode].match);
    if (!pool.length) return toast("No cards of that type in this area.");
    const sub = { cards: pool };
    // Whole-set study (no SRS rationing) for two cases:
    //  • Long answer — extended-response essays are deliberate exam practice.
    //  • Imported "Your sets" — a custom set is studied as a whole set, not as
    //    an SRS-scheduled recall batch, so every card shows every session.
    // Built-in module recall modes keep SRS scheduling (the else branch).
    // Ratings are still recorded via applyResult; they never drop a card here.
    const wholeSet = mode === "long" || area.custom;
    let queue;
    if (wholeSet) {
      queue = pool.slice();
    } else {
      queue = dueCards(sub).slice(0, 6);
      if (!queue.length) queue = [...pool].sort((a, b) => cardState(a.id).box - cardState(b.id).box).slice(0, 6);
    }
    const shuffle = !!opts.shuffle;
    if (shuffle) shuffleArr(queue);
    session = { area, mode, queue, idx: 0, results: [], pool: pool.slice(), shuffle, correct: 0 };
    // Record "last studied" for custom sets (cloud row or local object).
    if (area.custom) {
      if (cloudActive()) Cloud.touchStudied(area.id);
      else { const s = state.customSets.find(x => x.id === area.id); if (s) { s.last_studied = Date.now(); save(); } }
    }
    renderCard();
  }

  function renderCard() {
    const { area, queue, idx } = session;
    if (idx >= queue.length) return summary();
    const card = queue[idx];
    const flash = session.mode === "flash";
    const tag = flash ? "Flashcard" : { mc: "Multiple choice", calc: "Calculate", define: "Define", short: "Short answer", essay: "Extended response" }[card.type];
    if (flash) {
      // Imported sets get an order toggle: study in import order or shuffled
      // (shuffle re-randomises the whole set and restarts the run).
      const orderCtl = area.custom ? `<button class="ordtoggle" id="ordtoggle" title="Switch between import order and shuffle">${session.shuffle ? "🔀 Shuffle" : "↕ In order"}</button>` : "";
      const cs = cardScaleStep();
      const csBtn = (s, label) => `<button class="csbtn ${cs === s ? "on" : ""}" data-scale="${s}" aria-pressed="${cs === s}">${label}</button>`;
      app.innerHTML = `
        <div class="sessionbar"><button class="x" id="quit" title="Back to areas">←</button><span class="lbl">${esc(area.name)} · ${idx + 1} of ${queue.length}</span>${orderCtl}<span class="sbar" title="Cards you've marked “Got it”"><i style="width:${Math.round(100 * (session.correct || 0) / queue.length)}%"></i></span></div>
        <div class="cardsize" role="group" aria-label="Card text size"><span class="cslabel">Text size</span>${csBtn("s", "Small")}${csBtn("m", "Medium")}${csBtn("l", "Large")}${csBtn("xl", "Extra Large")}</div>
        ${stimulusHTML(card.stimulus)}
        <div class="enter">
        <div class="hintrow"><button class="hintbtn" id="hintbtn">💡 Need a hint?</button><div class="hintbox" id="hintbox" hidden>${esc(hintFor(card))}</div></div>
        <div id="answerzone">${flashUI(card)}</div><div id="sheet"></div></div>`;
      $("#quit").onclick = home;
      const hb = $("#hintbtn"); if (hb) hb.onclick = () => { $("#hintbox").hidden = false; hb.hidden = true; };
      const ot = $("#ordtoggle");
      if (ot) ot.onclick = () => {
        session.shuffle = !session.shuffle;
        session.queue = session.shuffle ? shuffleArr(session.pool.slice()) : session.pool.slice();
        session.idx = 0;
        renderCard();
      };
      app.querySelectorAll(".csbtn").forEach(b => b.onclick = () => {
        const step = b.dataset.scale;
        applyCardScale(step);                                   // live: updates --card-scale, no re-render (keeps flip state)
        try { localStorage.setItem(CARD_SCALE_KEY, step); } catch (e) { /* ignore */ }
        app.querySelectorAll(".csbtn").forEach(x => { const on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-pressed", on); });
      });
      wireFlash(card); wireStimulus(card.stimulus); wireGlossary();
      return;
    }
    // Long-answer / question page: question is the hero; source and help behind toggles.
    const scaf = (card.type === "essay" && card.scaffold && card.scaffold.length) ? card.scaffold : null;
    const ph = card.hint || (card.vocab && card.vocab.length ? "Try to work in: " + card.vocab.join(", ") + "." : hintFor(card));
    const hasHelp = !!(scaf || ph);
    app.innerHTML = `
      <div class="sessionbar"><button class="x" id="quit" title="Back to areas">←</button><span class="lbl">${esc(area.name)} · ${idx + 1} of ${queue.length}</span><span class="sbar"><i style="width:${Math.round(100 * idx / queue.length)}%"></i></span></div>
      <div class="qmeta">${esc(area.custom ? "Custom set" : C.unit)} · ${tag} · ${card.marks} mark${card.marks > 1 ? "s" : ""}</div>
      <div class="qcard"><div class="qprompt">${linkGlossary(card.prompt)}</div></div>
      <div class="qtoggles">
        ${card.stimulus ? `<button class="qtoggle" id="viewsource"><span class="ti">▦</span> Show source</button>` : ""}
        ${hasHelp ? `<button class="qtoggle" id="needhelp"><span class="ti">?</span> Need help?</button>` : ""}
      </div>
      ${hasHelp ? `<div class="helppanel" id="helppanel" hidden>${scaf ? `<div class="helpsec"><div class="helph">How to structure it</div><ol class="helpol">${scaf.map(s => "<li>" + esc(s) + "</li>").join("")}</ol></div>` : ""}${ph ? `<div class="helpsec"><div class="helph">Hint</div><button class="btn ghost sm" id="showhint">Show a hint</button><div class="hintbox" id="hintbox" hidden style="margin-top:8px">${esc(ph)}</div></div>` : ""}</div>` : ""}
      <div class="enter">
        <div class="qwork" id="qwork">
          <div class="qmain"><div id="answerzone">${answerInput(card)}</div>${answerShapeBlock(card)}</div>
          ${card.stimulus ? `<aside class="sourcepanel" id="sourcepanel" hidden><div class="sphead">Source</div><div class="spbody">${stimulusInnerHTML(card.stimulus)}</div></aside>` : ""}
        </div>
        ${submitRow(card)}
        <div id="sheet"></div>
      </div>`;
    $("#quit").onclick = home;
    wireAnswer(card);
    const vs = $("#viewsource");
    if (vs) {
      const panel = $("#sourcepanel"), qw = $("#qwork");
      vs.onclick = () => { const show = panel.hidden; panel.hidden = !show; qw.classList.toggle("with-source", show); vs.classList.toggle("on-source", show); vs.innerHTML = `<span class="ti">▦</span> ${show ? "Hide source" : "Show source"}`; };
    }
    const nh = $("#needhelp");
    if (nh) {
      const hp = $("#helppanel");
      nh.onclick = () => { const show = hp.hidden; hp.hidden = !show; nh.classList.toggle("on-help", show); };
      const sh = $("#showhint"); if (sh) sh.onclick = () => { $("#hintbox").hidden = false; sh.hidden = true; };
    }
    wireStimulus(card.stimulus);
    wireGlossary();
  }

  // Render a card's stimulus on ANY screen: a chart object renders via the
  // charting module; a string renders as text (short-answer cards). Keeps the
  // question page and the review overlay on the same render path.
  function stimulusHTML(stim) {
    if (!stim) return "";
    if (typeof stim === "object" && Array.isArray(stim.charts)) {
      return `<div class="stimulus"><div class="stimlabel">Source</div>${stim.caption ? `<p class="lzcap">${esc(stim.caption)}</p>` : ""}${stim.charts.map((c, i) => rvChartHTML(c, i)).join("")}</div>`;
    }
    return `<div class="stimulus"><div class="stimlabel">Source</div><pre>${esc(stim)}</pre></div>`;
  }
  // The source content for the side panel (no outer Source frame; the panel adds it).
  function stimulusInnerHTML(stim) {
    if (!stim) return "";
    if (typeof stim === "object" && Array.isArray(stim.charts)) {
      return `${stim.caption ? `<p class="lzcap">${esc(stim.caption)}</p>` : ""}${stim.charts.map((c, i) => rvChartHTML(c, i)).join("")}`;
    }
    return `<pre class="srcpre">${esc(stim)}</pre>`;
  }
  function wireStimulus(stim) {
    if (!stim || typeof stim !== "object" || !Array.isArray(stim.charts)) return;
    stim.charts.forEach((c, i) => { if (c.type === "lorenz") rvWireLorenz("lzmount-" + i, c); });
    app.querySelectorAll("[data-rvexpand]").forEach(b => b.onclick = () => rvExpandLorenz(stim.charts[Number(b.dataset.rvexpand)]));
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
  const GOTIT_CHEERS = ["Got it! 🎉", "Nice — locked in ✓", "Yes! 🎯", "Nailed it 🌟"];
  let advancing = false, gotitTick = 0;
  function rateFlash(card, r) {
    if (advancing) return;
    advancing = true;
    // Drive SRS off the raw self-rating r (not Math.round(r*marks)/marks): on a
    // 1-mark card "Almost" (0.5) would round up to a full mark and falsely count
    // as mastered. Passing r*marks makes applyResult's ratio === r, so SRS and
    // the "Got it"-only progress bar use one consistent correctness threshold.
    const gotit = r >= 0.7;
    applyResult(card, r * card.marks, card.marks);
    session.results.push({ card, g: { score: Math.round(r * card.marks), max: card.marks, kind: "flash" } });
    // The progress bar tracks "Got it" cards only — it advances on a correct
    // self-rating, not on "Almost" or "Not yet".
    if (gotit) { session.correct = (session.correct || 0) + 1; toast(GOTIT_CHEERS[gotitTick++ % GOTIT_CHEERS.length], 1100); }
    const flip = $("#flip");
    const go = () => { advancing = false; session.idx++; renderCard(); };
    if (flip) { flip.classList.add(gotit ? "flyright" : r <= 0.3 ? "flyleft" : "flydown"); setTimeout(go, 240); }
    else go();
  }

  // The answer input only (no submit). The submit lives in its own full-width row.
  function answerInput(card) {
    if (card.type === "mc")
      return `<div class="choices">${card.choices.map((c, i) => `<button class="choice" data-i="${i}"><kbd class="ckbd">${i + 1}</kbd>${esc(c.t)}</button>`).join("")}</div>`;
    if (card.type === "calc")
      return `<input class="calcin" id="ans" inputmode="decimal" placeholder="Your answer (number)" autocomplete="off">`;
    const big = card.type === "essay";
    return `<textarea id="ans" class="answerbox" rows="${big ? 14 : 5}" placeholder="${big ? "Write your full response here, using blank lines between paragraphs." : "Type your answer in full sentences."}"></textarea>`;
  }
  // The submit row, full width below both columns. Multiple choice grades on click.
  // ---- what this answer has to do, shown BEFORE it is written -----------------
  // The same guidance essay practice gives per paragraph, generalised to every
  // written question: a study card, a question inside a paper, an extended response.
  // It adapts to the directive verb, the mark value and whether a stimulus is
  // attached, because a two-mark Identify and a fifteen-mark Evaluate are not the
  // same task. It states each job and never performs it, and nothing here is ever
  // written into the student's answer.
  function answerShapeFor(card) {
    const shapes = (window.ESSAY && window.ESSAY.answerShapes) || null;
    if (!shapes) return null;
    const marks = Math.max(1, Math.round(Number(card.marks) || 1));
    const extended = card.type === "essay";
    const verb = String(card.command || commandOf(card.prompt) || "").toLowerCase();
    let rows = extended ? shapes.extended : ((shapes.commands || {})[verb] || shapes.fallback || []);
    if (!rows.length) return null;
    if (!extended && card.stimulus && shapes.stimulus) rows = [shapes.stimulus].concat(rows);
    const note = extended
      ? "Worth " + marks + " marks, so the marker is reading for a sustained argument, not a list of points."
      : "Worth " + marks + " mark" + (marks === 1 ? "" : "s") + ", so the marker is looking for about " + marks + " distinct creditworthy point" + (marks === 1 ? "" : "s") + ". Depth is set by the marks, not by how much could be said.";
    return { rows: rows, note: note, verb: verb, extended: extended };
  }
  function answerShapeBlock(card) {
    const sh = answerShapeFor(card);
    if (!sh) return "";
    const head = sh.verb
      ? "This question says " + esc(sh.verb) + ", so here is what your answer has to do."
      : "What your answer has to do.";
    const rows = sh.rows.map(r =>
      `<div class="es-skelrow gap"><div class="es-skeltop"><span class="es-skellabel">${esc(r.label)}</span></div><div class="es-skeljob">${esc(r.job)}</div></div>`).join("");
    return `<div class="es-skel plain ansshape"><div class="es-skelh">${head} You write every word of it. Nothing here is written into your answer.</div>${rows}<div class="es-skelnote">${esc(sh.note)}</div></div>`;
  }

  function submitRow(card) {
    if (card.type === "mc") return "";
    if (card.type === "calc")
      return `<div class="submitrow"><button class="btn" id="check">Check answer</button><span class="hint">Numeric answer, checked with a small tolerance.</span></div>`;
    const big = card.type === "essay";
    return `<div class="submitrow"><button class="btn" id="check">${big ? "Submit for marking" : "Check answer"}</button><span class="hint">${big ? "Marked against the criteria. It takes a few seconds." : "Graded on key terms and content, so write it properly."}</span></div>`;
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
        session.lastAnswer = ans;   // kept so a written answer can be marked properly on request
        let g;
        if (card.type === "calc") g = gradeCalc(card, ans);
        else if (card.type === "essay") g = await gradeWritten(card, ans);
        else g = gradeLocal(card, ans);
        finishCard(card, g);
      };
    }
  }

  // A graded essay can offer guided review when enabled and the worker returned
  // a structured (paragraphs) review. Review is OFFERED on the grade screen via a
  // button — never auto-launched — so the student keeps agency to just take the grade.
  // A review exists whenever marking came back with paragraphs, whatever the
  // question type. Short answers get one too: the guidance is the point, and it is
  // the same guidance an extended response gets, scaled to the marks.
  function canReview(card, g) {
    return reviewEnabled() && !!g.fb && Array.isArray(g.fb.paragraphs) && g.fb.paragraphs.length > 0;
  }

  function finishCard(card, g) {
    applyResult(card, g.score, g.max);
    session.results.push({ card, g });
    $("#sheet").innerHTML = sheetHTML(card, g);
    const rb = $("#reviewbtn");
    if (rb) rb.onclick = () => openReview(g.fb, () => { session.idx++; renderCard(); });
    const ab = $("#askreview");
    if (ab) ab.onclick = async () => {
      ab.disabled = true; ab.textContent = "Marking…";
      const deep = await gradeWritten(card, session.lastAnswer || "", { responseType: "short" });
      if (deep.fb && Array.isArray(deep.fb.paragraphs) && deep.fb.paragraphs.length) {
        g.fb = deep.fb; openReview(deep.fb, () => { session.idx++; renderCard(); });
      } else { ab.disabled = false; ab.textContent = "Mark this properly →"; toast("Marking could not be reached just now."); }
    };
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
    const n = canReview(card, g) ? rvIssueCount(g.fb) : 0;
    // A locally graded written answer has a mark but no guidance. Offer the same
    // review the marker gives an essay, on request, so help is reachable from every
    // written question rather than only from an extended response.
    const askable = !n && reviewEnabled() && !!state.endpoint && g.kind === "local" && ["short", "define"].indexOf(card.type) >= 0;
    const reviewBtn = n ? `<button class="btn" id="reviewbtn">Work through the issues (${n}) →</button>`
      : askable ? `<button class="btn ghost" id="askreview">Mark this properly →</button>` : "";
    const contCls = n ? "btn ghost" : "btn";
    return `<div class="sheet ${mood[0]}">
      <div class="head"><div class="score">${g.score}<small>/${g.max}</small></div><h3>${mood[1]}</h3></div>
      <div class="bd">${body}${ctx}<div class="actions">${reviewBtn}<button class="${contCls}" id="continue">Continue</button></div></div>
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
    $("#again").onclick = () => startSession(area.id, session.mode, { shuffle: session.shuffle });
    $("#back").onclick = home;
  }

  // ============================ PRACTICE EXAM (past paper) ============================
  // A whole paper imported as marginal-exam@1: ordered SECTIONS of mixed-type
  // questions (multiple choice, calculation, short/interpret-the-source, extended
  // response). The student sits it end to end in GUIDED mode: each question is
  // graded on submit, with feedback and a "try again" before continuing. Reuses the
  // existing graders (gradeMC/gradeCalc/gradeLocal/gradeWritten), answer inputs and the
  // essay review overlay. Short answers get line-by-line marking-POINTS feedback
  // (which of the mark-worthy points were addressed), plus an optional deeper AI
  // sentence review when marking is connected.
  const EXAM_FORMAT = "marginal-exam@1";
  const EXAM = { paper: null, sit: null, seq: [], pos: 0, results: {}, answers: {}, choice: {} };
  // A section with `choose: 1` is an either/or (e.g. HSC Section IV: attempt
  // Question 26 OR Question 27). The student picks at the section intro; only the
  // chosen question is sequenced, counted in the totals and shown in the results.
  function examChooseCount(sec) { const n = Number(sec && sec.choose) || 0; return n > 0 ? n : 0; }
  function examIsActive(si, qi) {
    const sec = EXAM.paper.sections[si];
    if (!examChooseCount(sec)) return true;
    const c = EXAM.choice[si];
    return c === undefined ? false : c === qi;
  }

  function examList() { return state.exams || []; }
  function examCounts(p) {
    // An either/or section contributes only the questions a student will actually
    // attempt, so the listed totals match the paper's real marks.
    let qs = 0, mk = 0;
    (p.sections || []).forEach(s => {
      const list = s.questions || [];
      const pick = Number(s.choose) || 0;
      const counted = pick > 0 ? list.slice(0, pick) : list;
      qs += counted.length;
      mk += counted.reduce((m, q) => m + (q.marks || 0), 0);
    });
    return { qs, mk };
  }
  // Test mode: the front-page entry to practice exams. Lists every imported paper
  // and is where a paper is sat. Empty until a paper is imported, with a clear
  // pointer to the Create tab (papers are teacher-imported, not built in).
  function examHome() {
    if (gated()) return authScreen();
    view = "test"; session = null; currentTopic = null;
    const papers = examList();
    app.innerHTML = `
      ${nav()}
      ${cloudBarHTML()}
      <div class="hi">Test mode</div>
      <div class="hi-s">Sit a full practice exam, guided. You get feedback after every question and a mark breakdown at the end.</div>
      ${papers.length ? `<div class="exam-list">
        ${papers.map(p => {
          const c = examCounts(p);
          return `<div class="exam-row">
            <div class="exam-rowmain"><span class="exam-rowname">📝 ${esc(p.name)}</span>
              <span class="exam-rowmeta">${esc(p.subject || "")}${p.subject ? " · " : ""}${c.qs} question${c.qs === 1 ? "" : "s"} · ${c.mk} mark${c.mk === 1 ? "" : "s"}${p.time ? " · " + esc(p.time) : ""}</span></div>
            <div class="exam-rowacts"><button class="btn sm" data-examsit="${esc(p.id)}">Sit this paper</button>
              <button class="btn sm ghost danger" data-examdel="${esc(p.id)}">Delete</button></div>
          </div>`;
        }).join("")}
      </div>` : `<div class="exam-empty">
        <p class="exam-emptyh">No practice exams yet</p>
        <p>Practice exams are imported, not built in. Paste a paper's JSON in the Create tab and it will appear here, ready to sit.</p>
        <button class="btn sm" id="examgocreate">Go to Create to import one</button>
      </div>`}`;
    wireNav();
    wireCloudBar();
    app.querySelectorAll("[data-examsit]").forEach(b => b.onclick = () => examStartById(b.dataset.examsit));
    app.querySelectorAll("[data-examdel]").forEach(b => b.onclick = () => {
      if (!confirm("Delete this practice exam?")) return;
      state.exams = (state.exams || []).filter(x => x.id !== b.dataset.examdel); save(); examHome();
    });
    const gc = $("#examgocreate"); if (gc) gc.onclick = () => { view = "create"; builder(); };
  }

  function validateExam(d) {
    const e = [];
    if (!d || typeof d !== "object") return ["Not an exam object."];
    if (!Array.isArray(d.sections) || !d.sections.length) return ["The exam has no sections array."];
    let qn = 0;
    d.sections.forEach((s, si) => {
      if (!Array.isArray(s.questions) || !s.questions.length) { e.push("Section " + (si + 1) + " has no questions."); return; }
      s.questions.forEach((q, qi) => {
        const at = "S" + (si + 1) + "Q" + (qi + 1) + ": "; qn++;
        if (!q.prompt) e.push(at + "missing prompt.");
        if (!q.marks || q.marks < 1) e.push(at + "missing marks.");
        if (!["mc", "calc", "short", "define", "essay"].includes(q.type)) e.push(at + "unknown type '" + q.type + "'.");
        if (q.type === "mc") {
          if (!Array.isArray(q.choices) || q.choices.length < 2) e.push(at + "MC needs 2+ choices.");
          else if (q.choices.filter(c => c.ok).length !== 1) e.push(at + "MC needs exactly one correct choice.");
        }
        if (q.type === "calc" && typeof q.expected !== "number") e.push(at + "calc needs a numeric 'expected'.");
        if (["short", "define", "essay"].includes(q.type) && !q.model && !(Array.isArray(q.points) && q.points.length))
          e.push(at + "needs a model answer or a points rubric.");
      });
    });
    if (!qn) e.push("The exam has no questions.");
    return e;
  }
  function importExamFromBox(data, msg) {
    const errs = validateExam(data);
    if (errs.length) return msg.textContent = errs[0];
    const paper = { id: "exam-" + Date.now(), name: data.name || "Practice exam", subject: data.subject || "",
      time: data.time || "", instructions: data.instructions || "", sections: data.sections };
    state.exams.push(paper); save();
    msg.textContent = "Imported ✓ — open Test mode to sit it.";
    builder();
  }
  function examStartById(id) { const p = examList().find(x => x.id === id); if (p) examPick(p); }
  // Sit the whole paper, or just the sections chosen on the picker. `picks` is an
  // array of section indexes; omitting it sits everything.
  function examStart(paper, picks) {
    const all = (paper.sections || []).map((_, i) => i);
    const sit = (Array.isArray(picks) && picks.length) ? all.filter(i => picks.indexOf(i) >= 0) : all;
    const seq = [];
    (paper.sections || []).forEach((sec, si) => {
      if (sit.indexOf(si) < 0) return;                 // not sitting this section
      seq.push({ kind: "section", si, sec });
      (sec.questions || []).forEach((q, qi) => seq.push({ kind: "q", si, qi, sec, q }));
    });
    seq.push({ kind: "end" });
    EXAM.paper = paper; EXAM.sit = sit; EXAM.seq = seq; EXAM.pos = 0; EXAM.results = {}; EXAM.answers = {}; EXAM.choice = {};
    examRender();
  }
  // The picker: sit the whole paper or any combination of its sections, so a student
  // can drill just multiple choice, just short answer, or just the extended response.
  function examPick(paper) {
    const secs = paper.sections || [];
    const counts = secs.map(sec => {
      const pick = examChooseCount(sec), list = sec.questions || [];
      const counted = pick > 0 ? list.slice(0, pick) : list;
      return { qs: counted.length, mk: counted.reduce((n, q) => n + (q.marks || 0), 0) };
    });
    const tot = counts.reduce((a, c) => ({ qs: a.qs + c.qs, mk: a.mk + c.mk }), { qs: 0, mk: 0 });
    app.innerHTML = `
      <div class="exam-bar"><button class="x" id="exampickquit" title="Back">←</button>
        <span class="lbl">${esc(paper.name)}</span></div>
      <div class="exam-wrap"><div class="exam-sectionintro" style="text-align:left">
        <div class="exam-sec">What do you want to sit?</div>
        <p class="exam-instr">Sit the whole paper, or tick just the sections you want to practise.</p>
        <div class="exam-picks">
          ${secs.map((sec, i) => `<label class="exam-pick"><input type="checkbox" data-exampick="${i}" checked>
            <span class="exam-pickmain"><span class="exam-pickname">${esc(sec.name || ("Section " + (i + 1)))}</span>
            <span class="exam-pickmeta">${counts[i].qs} question${counts[i].qs === 1 ? "" : "s"} · ${counts[i].mk} mark${counts[i].mk === 1 ? "" : "s"}</span></span></label>`).join("")}
        </div>
        <div class="exam-pickrow">
          <span class="es-help" id="exampicksum">${tot.qs} questions · ${tot.mk} marks</span>
          <span class="exam-pickbtns">
            <button class="btn ghost sm" id="exampickall">Select all</button>
            <button class="btn ghost sm" id="exampicknone">Clear</button>
            <button class="btn" id="exampickgo">Start</button>
          </span>
        </div>
      </div></div>`;
    const boxes = () => Array.from(app.querySelectorAll("[data-exampick]"));
    const chosen = () => boxes().filter(b => b.checked).map(b => Number(b.dataset.exampick));
    const sync = () => {
      const c = chosen();
      const qs = c.reduce((n, i) => n + counts[i].qs, 0), mk = c.reduce((n, i) => n + counts[i].mk, 0);
      $("#exampicksum").textContent = c.length ? `${qs} question${qs === 1 ? "" : "s"} · ${mk} mark${mk === 1 ? "" : "s"}` : "nothing selected";
      $("#exampickgo").disabled = !c.length;
    };
    boxes().forEach(b => b.onchange = sync);
    $("#exampickall").onclick = () => { boxes().forEach(b => b.checked = true); sync(); };
    $("#exampicknone").onclick = () => { boxes().forEach(b => b.checked = false); sync(); };
    $("#exampickquit").onclick = examHome;
    $("#exampickgo").onclick = () => examStart(paper, chosen());
    sync();
  }
  function examTotals() {
    // Count only ACTIVE questions. In an either/or section that is the chosen
    // question; before the choice is made, count the first option as representative
    // so the paper's mark total is right from the start.
    const qs = EXAM.seq.filter(x => {
      if (x.kind !== "q") return false;
      const sec = EXAM.paper.sections[x.si];
      if (!examChooseCount(sec)) return true;
      const c = EXAM.choice[x.si];
      return c === undefined ? x.qi < examChooseCount(sec) : c === x.qi;
    });
    const total = qs.length;
    const maxMarks = qs.reduce((n, x) => n + (x.q.marks || 0), 0);
    const done = Object.keys(EXAM.results).length;
    const got = Object.values(EXAM.results).reduce((n, g) => n + g.score, 0);
    return { total, maxMarks, done, got };
  }
  function examBar() {
    const t = examTotals();
    return `<div class="exam-bar"><button class="x" id="examquit" title="Leave this paper">←</button>
      <span class="lbl">${esc(EXAM.paper.name)}</span>
      <span class="exam-progress">${t.done}/${t.total} answered · ${t.got}/${t.maxMarks} marks</span></div>`;
  }
  function examQuit() { if (confirm("Leave this paper? Your progress on this attempt is not saved.")) examHome(); }
  // Render a source/stimulus block (shared section source or per-question stimulus).
  // Accepts a plain string, or an object with caption/text/img/charts.
  function examSourceHTML(src, label) {
    if (!src) return "";
    let inner = "";
    if (typeof src === "string") inner = `<p>${esc(src)}</p>`;
    else {
      if (src.caption) inner += `<p class="exam-srccap">${esc(src.caption)}</p>`;
      if (src.text) inner += `<p>${esc(src.text)}</p>`;
      if (src.img) inner += `<img class="exam-srcimg" src="${esc(src.img)}" alt="${esc(src.caption || "source")}" title="Tap to enlarge">`;
      if (Array.isArray(src.charts)) inner += src.charts.map((c, i) => rvChartHTML(c, i)).join("");
    }
    return `<div class="exam-source"><div class="exam-srclbl">${esc(label)}</div><div class="exam-srcbody">${inner}</div></div>`;
  }
  // Data displays (graphs, tables, Gantt charts) are rendered as images and scale to
  // the column, which can make small print hard to read. Tapping one opens it full
  // screen so a student can actually read the figures they are answering on.
  function examWireLightbox() {
    app.querySelectorAll(".exam-srcimg").forEach(img => img.onclick = () => {
      const box = document.createElement("div");
      box.className = "exam-lightbox";
      box.innerHTML = `<img src="${img.getAttribute("src")}" alt="${esc(img.getAttribute("alt") || "source")}"><button class="exam-lbclose" aria-label="Close">close</button>`;
      const shut = () => box.remove();
      box.onclick = shut;
      document.body.appendChild(box);
      document.addEventListener("keydown", function esc2(e) { if (e.key === "Escape") { shut(); document.removeEventListener("keydown", esc2); } });
    });
  }
  function examRender() {
    const item = EXAM.seq[EXAM.pos];
    if (!item || item.kind === "end") return examResults();
    // Skip the questions a student did not choose in an either/or section.
    if (item.kind === "q" && !examIsActive(item.si, item.qi)) { EXAM.pos++; return examRender(); }
    if (item.kind === "section") return examRenderSection(item);
    return examRenderQuestion(item);
  }
  function examRenderSection(item) {
    const sec = item.sec;
    const pick = examChooseCount(sec);
    const qs = sec.questions || [];
    const qn = qs.length;
    const mk = pick ? (qs[0] ? qs[0].marks || 0 : 0) : qs.reduce((n, q) => n + (q.marks || 0), 0);
    // Either/or: the student picks which question to attempt before starting.
    const body = pick
      ? `<p class="exam-meta">${mk} mark${mk === 1 ? "" : "s"} · choose ${pick} of ${qn}</p>
         ${sec.source ? examSourceHTML(sec.source, "Source material") : ""}
         <div class="exam-choices">${qs.map((q, qi) =>
           `<button class="exam-choice" data-examchoose="${qi}"><span class="exam-choicelbl">${esc(q.label || ("Question " + (qi + 1)))}</span><span class="exam-choicetext">${esc(q.prompt)}</span></button>`).join("")}</div>`
      : `<p class="exam-meta">${qn} question${qn === 1 ? "" : "s"} · ${mk} mark${mk === 1 ? "" : "s"}</p>
         ${sec.source ? examSourceHTML(sec.source, "Source material") : ""}
         <button class="btn" id="exambegin">Begin ${esc(sec.name || "section")}</button>`;
    app.innerHTML = `${examBar()}
      <div class="exam-wrap"><div class="exam-sectionintro">
        <div class="exam-sec">${esc(sec.name || "Section")}</div>
        ${sec.instructions ? `<p class="exam-instr">${esc(sec.instructions)}</p>` : ""}
        ${body}
      </div></div>`;
    $("#examquit").onclick = examQuit;
    const bg = $("#exambegin"); if (bg) bg.onclick = () => { EXAM.pos++; examRender(); };
    app.querySelectorAll("[data-examchoose]").forEach(b => b.onclick = () => {
      EXAM.choice[item.si] = Number(b.dataset.examchoose); EXAM.pos++; examRender();
    });
    wireStimulus(sec.source); wireGlossary(); examWireLightbox();
  }
  function examRenderQuestion(item) {
    const { q, sec, si, qi } = item;
    const key = si + "-" + qi;
    const t = examTotals();
    const num = EXAM.seq.slice(0, EXAM.pos + 1).filter(x => x.kind === "q").length;
    app.innerHTML = `${examBar()}
      <div class="exam-wrap"><div class="exam-q">
        <div class="exam-sec small">${esc(sec.name || "")}</div>
        ${sec.source ? examSourceHTML(sec.source, "Source material") : ""}
        <div class="exam-qhead">Question ${num} of ${t.total} · ${q.marks} mark${q.marks === 1 ? "" : "s"}</div>
        ${q.stimulus ? examSourceHTML(q.stimulus, "Source") : ""}
        <div class="exam-prompt">${linkGlossary(q.prompt)}</div>
        <div id="answerzone">${answerInput(q)}</div>
        ${answerShapeBlock(q)}
        ${submitRow(q)}
        <div id="sheet"></div>
      </div></div>`;
    const prev = EXAM.answers[key];
    if (prev && $("#ans")) $("#ans").value = prev;
    $("#examquit").onclick = examQuit;
    examWireAnswer(item, key);
    wireStimulus(sec.source); wireStimulus(q.stimulus); wireGlossary(); examWireLightbox();
  }
  function examWireAnswer(item, key) {
    const q = item.q;
    if (q.type === "mc") {
      app.querySelectorAll(".choice").forEach(b => b.onclick = () => {
        app.querySelectorAll(".choice").forEach(x => x.onclick = null);
        const g = gradeMC(q, +b.dataset.i);
        b.classList.add(g.correct ? "right" : "wrong");
        EXAM.answers[key] = q.choices[+b.dataset.i].t; EXAM.results[key] = g;
        examSheet(item, key, g);
      });
      return;
    }
    const ch = $("#check");
    if (ch) ch.onclick = async () => {
      const ans = ($("#ans") && $("#ans").value || "").trim();
      if (!ans) { toast("Write your answer first."); return; }
      EXAM.answers[key] = ans; ch.disabled = true; ch.textContent = "Checking…";
      let g;
      if (q.type === "calc") g = gradeCalc(q, ans);
      else if (q.type === "essay") g = await gradeWritten(q, ans);
      else g = (Array.isArray(q.points) && q.points.length) ? gradePoints(q, ans) : gradeLocal(q, ans);
      EXAM.results[key] = g;
      examSheet(item, key, g);
    };
  }
  // Marking-POINTS grading for short answers: one mark per point addressed. A point
  // is "hit" when the answer contains any of its accepted phrasings (need[]), else
  // the point's own text. Deterministic, offline, and shows exactly what was missed.
  function gradePoints(q, answer) {
    const a = norm(answer);
    const pts = (q.points || []).map(pt => {
      const need = (Array.isArray(pt.need) && pt.need.length) ? pt.need : [pt.text];
      const hit = need.some(al => a.includes(norm(al)));
      return { text: pt.text, hit, hint: pt.hint || "", marks: pt.marks || 1 };
    });
    const raw = pts.filter(p => p.hit).reduce((n, p) => n + p.marks, 0);
    return { score: Math.min(raw, q.marks), max: q.marks, kind: "points", points: pts, model: q.model || "" };
  }
  function examSheetHTML(q, g) {
    const ratio = g.max ? g.score / g.max : 0;
    const mood = ratio >= 0.95 ? ["great", "Full marks"] : ratio >= 0.6 ? ["good", "Most of it"] : ratio >= 0.3 ? ["mid", "Partly there"] : ["low", "Not yet"];
    let body = "";
    if (g.kind === "mc") body = `<p><b>${g.correct ? "Correct." : "Not this one."}</b> ${esc(g.why)}</p>${g.correct ? "" : `<p>Answer: <b>${esc(g.answerText)}</b></p>`}`;
    else if (g.kind === "calc") body = `<p>${g.correct ? "Correct." : "Expected <b>" + esc(g.model) + "</b>."}</p>${g.working ? `<p class="working"><b>Working:</b> ${esc(g.working)}</p>` : ""}`;
    else if (g.kind === "points") body = `<div class="exam-points">${g.points.map(pt =>
        `<div class="exam-pt ${pt.hit ? "hit" : "miss"}"><span class="exam-ptmark">${pt.hit ? "✓" : "✗"}</span><span class="exam-ptbody">${esc(pt.text)}${(!pt.hit && pt.hint) ? `<span class="exam-pthint">${esc(pt.hint)}</span>` : ""}</span></div>`).join("")}</div>${g.model ? `<details ${ratio < 0.7 ? "open" : ""}><summary>Model answer</summary><p>${linkGlossary(g.model)}</p></details>` : ""}`;
    else if (g.kind === "local") body = `${(g.matched.length || g.missing.length) ? `<div class="chips">${g.matched.map(t => `<span class="chip">${esc(t)} ✓</span>`).join("")}${g.missing.map(t => `<span class="chip todo" data-term="${esc(t)}">${esc(t)}</span>`).join("")}</div>` : ""}<details ${ratio < 0.7 ? "open" : ""}><summary>Model answer</summary><p>${linkGlossary(g.model)}</p></details>`;
    else { const fb = g.fb || {}; body = `${fb.overall ? `<p>${esc(fb.overall.summary || "")}</p>` : ""}${(fb.criteria || []).map(c => `<div class="crit ${c.status}"><span class="dot"></span><b>${esc(c.name)}:</b> ${esc(c.comment || c.status)}</div>`).join("")}${(fb.missing_vocabulary || []).length ? `<div class="chips">${fb.missing_vocabulary.map(t => `<span class="chip todo">${esc(t)}</span>`).join("")}</div>` : ""}${q.model ? `<details><summary>What a top answer covers</summary><p>${linkGlossary(q.model)}</p></details>` : ""}`; }
    return `<div class="sheet ${mood[0]}"><div class="head"><div class="score">${g.score}<small>/${g.max}</small></div><h3>${mood[1]}</h3></div><div class="bd">${body}</div></div>`;
  }
  function examSheet(item, key, g) {
    const last = !EXAM.seq.slice(EXAM.pos + 1).some(x => x.kind === "q");
    const hasReview = g.fb && Array.isArray(g.fb.paragraphs) && g.fb.paragraphs.length > 0;
    // The marking-points checklist keeps the mark, because one point is one mark and
    // that is how the paper is actually marked. What the checklist cannot do is say
    // WHY a point was missed or hand the student back to the sentence, so the same
    // review an extended response gets is offered here too, on request.
    const askable = !hasReview && ["points", "local"].includes(g.kind) && !!state.endpoint;
    const reviewBtn = hasReview ? `<button class="btn" id="examreview">Work through the issues (${rvIssueCount(g.fb)}) →</button>`
      : askable ? `<button class="btn ghost" id="examreview">Mark this properly →</button>` : "";
    $("#sheet").innerHTML = examSheetHTML(item.q, g) +
      `<div class="exam-acts"><button class="btn ghost" id="examretry">Try again</button>${reviewBtn}<button class="btn" id="examnext">${last ? "Finish paper" : "Continue"}</button></div>`;
    $("#examretry").onclick = () => examRender();
    $("#examnext").onclick = () => { EXAM.pos++; examRender(); };
    const rb = $("#examreview");
    if (rb) rb.onclick = () => { if (hasReview) examOpenReview(item, key, g.fb); else examDeepReview(item, key); };
    const sh = $("#sheet"); if (sh && sh.scrollIntoView) sh.scrollIntoView({ behavior: "smooth", block: "nearest" });
    wireGlossary();
  }
  async function examDeepReview(item, key) {
    const ans = EXAM.answers[key] || "";
    const btn = $("#examreview"); if (btn) { btn.disabled = true; btn.textContent = "Marking…"; }
    const g = await gradeWritten(item.q, ans, { responseType: item.q.type === "essay" ? "extended" : "short" });
    if (g.fb && Array.isArray(g.fb.paragraphs) && g.fb.paragraphs.length) {
      EXAM.results[key] = Object.assign({}, EXAM.results[key], { fb: g.fb });
      examOpenReview(item, key, g.fb);
    } else {
      if (btn) { btn.disabled = false; btn.textContent = "Mark this properly →"; }
      toast("Marking could not be reached just now.");
    }
  }
  // Inside a paper the answer box is one Try again away, so the revise action can
  // actually close the loop: it reopens the question with the answer restored and
  // the marker's line selected, ready to be rewritten.
  function examOpenReview(item, key, fb) {
    openReview(fb, () => examRender(), { onRevise: (idx, quote) => examRevise(quote) });
  }
  function examRevise(quote) {
    examRender();
    const ta = document.getElementById("ans"); if (!ta) return;
    ta.focus();
    const at = esLocateQuote(ta.value, quote);
    if (at) { try { ta.setSelectionRange(at.start, at.end); } catch (e) { /* older browsers */ } }
    if (ta.scrollIntoView) ta.scrollIntoView({ behavior: "smooth", block: "center" });
    toast("Rewrite this part, then submit it again.");
  }
  function examResults() {
    let got = 0, max = 0;
    const sit = EXAM.sit || (EXAM.paper.sections || []).map((_, i) => i);
    const rows = (EXAM.paper.sections || []).map((sec, si) => {
      if (sit.indexOf(si) < 0) return "";               // not sat this time
      let sg = 0, sm = 0;
      const qs = (sec.questions || []).map((q, qi) => {
        if (!examIsActive(si, qi)) return "";           // not chosen in an either/or section
        const g = EXAM.results[si + "-" + qi]; const s = g ? g.score : 0; sg += s; sm += q.marks || 0;
        return `<div class="exam-resq"><span>${esc(q.prompt.slice(0, 70))}${q.prompt.length > 70 ? "…" : ""}</span><span class="exam-resm">${s}/${q.marks || 0}</span></div>`;
      }).join("");
      got += sg; max += sm;
      return `<div class="exam-ressec"><div class="exam-ressech">${esc(sec.name || "Section")} <span class="exam-resm">${sg}/${sm}</span></div>${qs}</div>`;
    }).join("");
    app.innerHTML = `${examBar()}<div class="exam-wrap"><div class="summary">
      <div class="bigscore">${got}<small>/${max}</small></div>
      <h2>${esc(EXAM.paper.name)}</h2>
      <p>Paper complete. Your marks by section are below.</p>
      <div class="exam-results">${rows}</div>
      <div class="row center"><button class="btn" id="examretake">Retake paper</button><button class="btn ghost" id="exambackhome">Back to Test mode</button></div>
    </div></div>`;
    $("#examquit").onclick = examHome;
    $("#examretake").onclick = () => examStart(EXAM.paper, EXAM.sit);
    $("#exambackhome").onclick = examHome;
  }

  // ===================== CREATE (set builder + JSON import/export) =====================
  let draft = null; // { name, cards: [] }

  function builder() {
    if (gated()) return authScreen();
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
        <h3 class="bh">Import a set or a practice exam</h3>
        <p class="bhint">Paste a set's JSON to load it as a studyable area, or a whole practice exam (<code>marginal-exam@1</code>) to sit as a guided past paper on your Study map.</p>
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
    $("#studyset").onclick = async () => {
      const id = await saveDraftAsSet();
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
      const set = state.customSets.find(s => s.id === b.dataset.del);
      if (set && !confirm(`Delete "${set.name}"? This removes the set and its progress from this device.`)) return;
      removeCustomSet(b.dataset.del); builder(); });
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
  async function saveDraftAsSet() {
    if (!draft.cards.length) { toast("Add some cards first."); return null; }
    const name = (draft.name || "My set").trim();
    if (cloudActive()) {
      try { const row = await Cloud.createSet(name, draft.cards, []); return row ? row.id : null; }
      catch (e) { toast("Couldn't save to your account: " + e.message); return null; }
    }
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
    if (!cloudActive()) saveDraftAsSet();  // local convenience save; cloud users save explicitly via "Study this set"
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

  // Accept the simple flashcard shapes people actually paste and map them onto the
  // app's card model before validation. Tolerated input:
  //   • a bare array of cards:            [ {front, back}, ... ]
  //   • a wrapped set:                    { name, cards: [ ... ] }
  // and per card, these front/back aliases (first non-empty wins):
  //   front  ← front | q | question | term | prompt
  //   back   ← back  | a | answer   | def  | definition | model
  // A plain front/back card becomes a {type:"define", marks:1} card, which is what
  // Flashcards mode flips (prompt on the front, model on the back). Explicit fields
  // already in the app's shape (type, marks, choices, vocab, …) are left untouched.
  function pickField(c, names) { for (const n of names) { const v = c[n]; if (v != null && String(v).trim() !== "") return v; } return undefined; }
  function normalizeCard(c) {
    if (!c || typeof c !== "object") return c;
    const out = Object.assign({}, c);
    const front = pickField(out, ["prompt", "front", "q", "question", "term"]);
    const back = pickField(out, ["model", "back", "a", "answer", "def", "definition"]);
    if (out.prompt == null && front != null) out.prompt = front;
    if (out.model == null && back != null) out.model = back;
    if (!out.type) out.type = "define";
    if (!out.marks || out.marks < 1) out.marks = 1;
    ["front", "q", "question", "term", "back", "a", "answer", "def", "definition"].forEach(k => { if (k !== "prompt" && k !== "model") delete out[k]; });
    return out;
  }
  function normalizeImport(data) {
    if (Array.isArray(data)) data = { cards: data };
    if (data && typeof data === "object" && Array.isArray(data.cards)) data.cards = data.cards.map(normalizeCard);
    return data;
  }

  function importSet() {
    const msg = $("#importmsg");
    let data;
    try { data = JSON.parse($("#importjson").value); }
    catch { return msg.textContent = "That isn't valid JSON."; }
    if (data && data.format === EXAM_FORMAT) return importExamFromBox(data, msg); // a whole paper, not a flat set
    data = normalizeImport(data);
    const errs = validateSet(data);
    if (errs.length) return msg.textContent = errs[0];
    const name = data.name || "Imported set";
    if (cloudActive()) {
      // Saved to the student's account; appears in the Study sets manager.
      data.cards.forEach((c, i) => { c.id = "c" + i; });
      msg.textContent = "Importing…";
      Cloud.createSet(name, data.cards, data.tags || [])
        .then(() => { msg.textContent = "Imported ✓ — saved to your account."; builder(); })
        .catch(e => { msg.textContent = "Import failed: " + (e.message || e); });
      return;
    }
    const set = { id: "custom-" + Date.now(), name, cards: data.cards, glossary: data.glossary || {}, tags: data.tags || [] };
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

  // ===========================================================================
  // Long-response review mode (see review-model.md). Step 2: focus-mode shell —
  // modal, header (score ring, stem, tabs, context buttons), slim paragraph rail,
  // rubric pane, question/stimulus overlays. Renders a review object (the worker
  // response, or CONTENT.reviewSample for the demo entry). Student entry is gated
  // (off by default); the dev entry is ?reviewdemo=1.
  // ===========================================================================
  // Review mode is the promotion switch CONFIG.reviewMode (teacher sets it true to
  // give every student the guided review). ?review=1 (or localStorage) turns it on
  // for one person to try the real flow without enabling it for everyone.
  function reviewEnabled() {
    if (CONFIG.reviewMode === true) return true;
    if (/[?&]review=1/.test(location.search)) return true;
    try { if (localStorage.getItem("marginal.review") === "1") return true; } catch (e) { /* sandboxed */ }
    return false;
  }
  const RVS = { review: null, active: 0, tab: "paragraphs", view: "paragraph", qpos: 0, resolved: {}, skipped: {}, chosen: null, stage: "ladder", rep: 0, rebuiltOpen: false };
  function rvResetIssue() { RVS.chosen = null; RVS.stage = "ladder"; RVS.rep = 0; }
  function rvDotClass(p) { const r = p.max ? p.score / p.max : 1; return r >= 0.8 ? "g" : r >= 0.6 ? "m" : "w"; }
  // word-overlap soft check for practice (never blocks; just nudges)
  function rvOverlap(a, b) {
    const wa = new Set(norm(a).split(/\s+/).filter(w => w.length > 2));
    const wb = norm(b).split(/\s+/).filter(w => w.length > 2);
    if (!wb.length) return 1;
    let hit = 0; wb.forEach(w => { if (wa.has(w)) hit++; });
    return hit / wb.length;
  }
  // Derive three fading practice starters from a rung's sentence (see
  // review-model.md). Blanks content words (key terms, data, meaningful verbs),
  // never filler; the fade grows rep 1 -> rep 3. Single source for starters.
  const RV_STOP = new Set("the a an of to and or but in on at for with as by from into onto that this these those it its is are was were be been being has have had do does did will would can could should may might which who whom whose than then so such more most less once each both between because since however yet not no nor their them they he she we you i his her our your my me if when while where what how why also very just only up out over under after before about per there here".split(" "));
  function rvWordOf(t) { return t.replace(/[^A-Za-z0-9'’.\-]/g, ""); }
  function rvIsContent(t) { const w = rvWordOf(t).toLowerCase().replace(/^[.\-']+|[.\-']+$/g, ""); return w.length > 0 && !RV_STOP.has(w); }
  function rvScoreTok(t) { const w = rvWordOf(t); let s = 0; if (/\d/.test(t)) s += 3; if (/^[A-Z]/.test(w)) s += 2; if (w.length >= 8) s += 2; else if (w.length >= 5) s += 1; return s; }
  function deriveStarters(text) {
    text = String(text || "");
    const toks = text.split(/\s+/).filter(Boolean);
    const cIdx = toks.map((t, i) => (rvIsContent(t) ? i : -1)).filter(i => i >= 0);
    const n = cIdx.length;
    const ranked = cIdx.slice().sort((a, b) => (rvScoreTok(toks[b]) - rvScoreTok(toks[a])) || (b - a));
    const blankTok = t => { const m = t.match(/^(.*?)([.,;:!?)]*)$/); return "<b>____________</b>" + (m ? esc(m[2]) : ""); };
    const rep = k => { if (k >= n) return "____________"; const set = new Set(ranked.slice(0, k)); return toks.map((t, i) => (set.has(i) ? blankTok(t) : esc(t))).join(" "); };
    return [rep(n >= 1 ? 1 : 0), rep(Math.max(2, Math.ceil(n * 0.5))), "____________"];
  }
  // Strip {{term|def|page}} markup to the bare term. Step 6 replaces this with an
  // interactive popover; until then the term reads as plain text (no raw braces).
  function rvStripTerms(s) { return String(s == null ? "" : s).replace(/\{\{([^|]+)\|[^|]*\|[^}]*\}\}/g, "$1"); }
  function rvSevRank(s) { return s === "critical" ? 0 : s === "should" ? 1 : 2; }
  function rvKey(pi, si, ii) { return pi + "-" + si + "-" + ii; }
  function rvAddressed(k) { return (k in RVS.resolved) || (k in RVS.skipped); }
  // Issue queue for a paragraph: flatten its sentences' issues, critical-first,
  // stable within a tier (CHECK 4: targeted jumps index into this, so order is fixed).
  function rvQueue(p) {
    const q = [];
    (p.sentences || []).forEach((s, si) => (s.issues || []).forEach((iss, ii) => q.push({ si, ii, sev: iss.severity, iss })));
    q.sort((a, b) => (rvSevRank(a.sev) - rvSevRank(b.sev)) || (a.si - b.si) || (a.ii - b.ii));
    return q;
  }
  // Total outstanding issues across every paragraph — the N on the "Work through the issues" button.
  function rvIssueCount(review) {
    if (!review || !Array.isArray(review.paragraphs)) return 0;
    return review.paragraphs.reduce((n, p) => n + rvQueue(p).length, 0);
  }
  function rvWorstOpen(p, pi, si) {
    let worst = null;
    (p.sentences[si].issues || []).forEach((iss, ii) => { if (!(rvKey(pi, si, ii) in RVS.resolved)) { if (worst == null || rvSevRank(iss.severity) < rvSevRank(worst)) worst = iss.severity; } });
    return worst;
  }
  function rvCheckMarks(rv) {
    // CHECK 5 (BUILD-CHECKS): total must equal the sum of paragraph marks, and the rubric must sum to the total.
    const ps = (rv.paragraphs || []).reduce((a, p) => a + (Number(p.score) || 0), 0);
    if (ps !== rv.total) console.warn("[review] mark inconsistency: paragraph sum", ps, "!= total", rv.total);
    const rs = (rv.rubric || []).reduce((a, c) => a + (Number(c.score) || 0), 0);
    if ((rv.rubric || []).length && rs !== rv.total) console.warn("[review] rubric sum", rs, "!= total", rv.total);
  }
  // opts.onRevise(paragraphIndex, quote) hands the student back to the WRITING
  // surface at that exact paragraph. Supplied by essay mode, absent for a study
  // card (which has no paragraph editor), so the focus button degrades to opening
  // that paragraph inside the review instead.
  // The rebuilt worker returns `focus`. An older worker (before the marking rebuild
  // is re-pasted) does not, so derive it here from the worst open issue. Either way
  // the student is given one place to go back and rewrite.
  function rvEnsureFocus(rv) {
    if (rv.focus && rv.focus.area && Number.isFinite(rv.focus.index)) return;
    let best = null;
    (rv.paragraphs || []).forEach((p, pi) => (p.sentences || []).forEach(sn => (sn.issues || []).forEach(iss => {
      const rank = rvSevRank(iss.severity);
      if (!best || rank < best.rank) best = { rank, pi, iss, text: sn.text };
    })));
    if (!best) { rv.focus = null; return; }
    rv.focus = {
      area: best.iss.head || "Where to start", paragraph: best.pi + 1, index: best.pi, sentence: null,
      why: rvStripTerms(best.iss.why || ""), quote: typeof best.text === "string" ? best.text : "", derived: true,
    };
  }
  function openReview(review, onClose, opts) {
    if (!review || !Array.isArray(review.paragraphs) || !review.paragraphs.length) return;
    rvEnsureFocus(review);
    RVS.review = review; RVS.active = 0; RVS.tab = "paragraphs"; RVS.view = "paragraph"; RVS.qpos = 0; RVS.resolved = {}; RVS.skipped = {}; RVS.rebuiltOpen = false; RVS.onClose = onClose || null; rvResetIssue();
    RVS.onRevise = (opts && opts.onRevise) || null;
    // Land on the paragraph the marker says to fix first, so the first thing the
    // student sees is the one thing to do next.
    if (review.focus && Number.isFinite(review.focus.index) && review.focus.index >= 0 && review.focus.index < review.paragraphs.length) RVS.active = review.focus.index;
    rvCheckMarks(review);
    if (!document.getElementById("rvhost")) { const h = document.createElement("div"); h.id = "rvhost"; document.body.appendChild(h); }
    app.classList.add("rv-blur");
    rvRender();
  }
  function closeReview() {
    const h = document.getElementById("rvhost"); if (h) h.remove();
    const c = document.getElementById("rvctxhost"); if (c) c.remove();
    app.classList.remove("rv-blur");
    RVS.onRevise = null;
    const cb = RVS.onClose; RVS.onClose = null; if (cb) cb();
  }
  function rvRender() {
    const rv = RVS.review, host = document.getElementById("rvhost"); if (!rv || !host) return;
    const ratio = rv.max ? rv.total / rv.max : 1;
    const ringCls = ratio >= 0.8 ? "" : ratio >= 0.6 ? "mid" : "low";
    const q = (rv.question && rv.question.stem) || "";
    // A short answer carries no band rubric, so the tab and the tap-the-score hint
    // that lead to one do not appear. Nothing offers a student an empty pane.
    const hasRubric = Array.isArray(rv.rubric) && rv.rubric.length > 0;
    if (!hasRubric && RVS.tab === "rubric") RVS.tab = "paragraphs";
    const hasStim = !!(rv.question && (rv.question.stimulus || (rv.question.graphs && rv.question.graphs.length)));
    host.innerHTML = `
    <div class="rv-scrim" id="rvscrim">
      <div class="rv-modal" role="dialog" aria-modal="true" aria-label="Answer review">
        <div class="rv-mhead">
          <div class="rv-scorewrap">
            <button class="rv-ring ${ringCls}" id="rvring"${hasRubric ? ' title="See how this was marked"' : ""}>${rv.total}</button>
            <div>
              <h2 class="rv-h2">${rv.total} / ${rv.max}</h2>
              <div class="rv-q">${esc(q)}</div>
              ${hasRubric ? `<div class="rv-scorehint">tap the score to see the marking rubric</div>` : ""}
            </div>
          </div>
          <button class="rv-x" id="rvclose" aria-label="Close review">✕</button>
        </div>
        <div class="rv-stages">
          <button class="rv-stage ${RVS.tab === "paragraphs" ? "on" : ""}" id="rvtab-paragraphs">${hasRubric ? "1 · Paragraphs" : "Your answer"}</button>
          ${hasRubric ? `<button class="rv-stage ${RVS.tab === "rubric" ? "on" : ""}" id="rvtab-rubric">Rubric</button>` : ""}
          <span class="rv-spacer"></span>
          <button class="rv-ctxbtn" id="rvctx-question">▢ The question</button>
          ${hasStim ? `<button class="rv-ctxbtn" id="rvctx-stimulus">▦ Stimulus</button>` : ""}
        </div>
        ${(RVS.tab === "rubric" && hasRubric) ? rvRubricPane(rv) : rvParagraphsPane(rv)}
        <div class="rv-mfoot"><span class="rv-spacer"></span><button class="rv-btn primary" id="rvdone">Done</button></div>
      </div>
    </div>`;
    $("#rvclose").onclick = closeReview;
    $("#rvdone").onclick = closeReview;
    if (hasRubric) $("#rvring").onclick = () => { RVS.tab = "rubric"; rvRender(); };
    $("#rvtab-paragraphs").onclick = () => { RVS.tab = "paragraphs"; rvRender(); };
    const rubTab = $("#rvtab-rubric"); if (rubTab) rubTab.onclick = () => { RVS.tab = "rubric"; rvRender(); };
    $("#rvctx-question").onclick = () => rvOpenContext("question");
    const sb = $("#rvctx-stimulus"); if (sb) sb.onclick = () => rvOpenContext("stimulus");
    host.querySelectorAll("[data-rvpara]").forEach(b => b.onclick = () => { RVS.active = Number(b.dataset.rvpara); RVS.tab = "paragraphs"; RVS.view = "paragraph"; rvRender(); });
    host.querySelectorAll("[data-rvcrit]").forEach(b => b.onclick = () => { const el = $("#rvbands-" + b.dataset.rvcrit); if (el) el.classList.toggle("show"); });
    // targeted jumps: a span / missing chip / status row opens THAT specific issue (CHECK 4)
    host.querySelectorAll("[data-rvgoto]").forEach(b => b.onclick = () => { RVS.qpos = Number(b.dataset.rvgoto); RVS.view = "walk"; rvResetIssue(); rvRender(); });
    // "Revise this paragraph" hands the student back to the writing surface at that
    // paragraph, with the marker's line selected. Without a writing surface (a study
    // card), it opens that paragraph's worst issue inside the review instead.
    const fg = $("#rvfocusgo");
    if (fg) fg.onclick = () => {
      const f = RVS.review.focus || {};
      const idx = Math.max(0, Math.min(Number(f.index) || 0, RVS.review.paragraphs.length - 1));
      if (RVS.onRevise) { const cb = RVS.onRevise; closeReview(); cb(idx, f.quote || ""); return; }
      RVS.active = idx; RVS.view = "walk"; RVS.qpos = 0; rvResetIssue(); rvRender();
    };
    const fr2 = $("#rvfocusread");
    if (fr2) fr2.onclick = () => {
      const f = RVS.review.focus || {};
      RVS.active = Math.max(0, Math.min(Number(f.index) || 0, RVS.review.paragraphs.length - 1));
      RVS.view = "walk"; RVS.qpos = 0; rvResetIssue(); rvRender();
    };
    const wb = $("#rvwalk"); if (wb) wb.onclick = () => { const q = rvQueue(RVS.review.paragraphs[RVS.active]); const firstOpen = q.findIndex(x => !rvAddressed(rvKey(RVS.active, x.si, x.ii))); RVS.qpos = firstOpen >= 0 ? firstOpen : 0; RVS.view = "walk"; rvResetIssue(); rvRender(); };
    // walkthrough navigation
    const back = $("#rvback"); if (back) back.onclick = () => { RVS.view = "paragraph"; rvRender(); };
    host.querySelectorAll("[data-rvchip]").forEach(b => b.onclick = () => { RVS.qpos = Number(b.dataset.rvchip); rvResetIssue(); rvRender(); });
    const skip = $("#rvskip"); if (skip) skip.onclick = () => { const q = rvQueue(RVS.review.paragraphs[RVS.active]); const x = q[RVS.qpos]; RVS.skipped[rvKey(RVS.active, x.si, x.ii)] = true; rvAdvance(); };
    const next = $("#rvnext"); if (next) next.onclick = () => rvAdvance();
    const prev = $("#rvprev"); if (prev) prev.onclick = () => { if (RVS.qpos > 0) { RVS.qpos--; rvResetIssue(); rvRender(); } };
    // ladder + practice + fresh write
    const p0 = RVS.review.paragraphs[RVS.active], q0 = rvQueue(p0), cur0 = q0[RVS.qpos];
    const curIss = cur0 && cur0.iss, curKey = cur0 && rvKey(RVS.active, cur0.si, cur0.ii);
    const curRung = curIss && RVS.chosen != null && curIss.ladder ? curIss.ladder[RVS.chosen] : null;
    host.querySelectorAll("[data-rvrung]").forEach(b => b.onclick = () => { RVS.chosen = Number(b.dataset.rvrung); RVS.stage = "practice"; RVS.rep = 0; rvRender(); });
    const po = $("#rvpickother"); if (po) po.onclick = () => { rvResetIssue(); rvRender(); };
    const rt = $("#rvreptick"); if (rt) rt.onclick = () => { if (RVS.rep < 2) RVS.rep++; else RVS.stage = "fresh"; rvRender(); };
    const sr = $("#rvskiprw"); if (sr) sr.onclick = () => { RVS.stage = "fresh"; rvRender(); };
    const pr = $("#rvpractice"); if (pr && curRung) { const soft = $("#rvpracticesoft"); pr.oninput = () => { const v = pr.value.trim(); if (!v) { soft.textContent = ""; soft.className = "rv-soft"; } else if (rvOverlap(v, curRung.text) >= 0.5) { soft.textContent = "looks good"; soft.className = "rv-soft ok"; } else { soft.textContent = "close, try to match the sentence above more closely"; soft.className = "rv-soft warn"; } }; }
    const fr = $("#rvfresh"); if (fr) { const add = $("#rvaddline"); const upd = () => { add.disabled = fr.value.trim().split(/\s+/).filter(Boolean).length < 4; }; upd(); fr.oninput = upd; }
    const al = $("#rvaddline"); if (al && curKey) al.onclick = () => { const v = $("#rvfresh").value.trim(); if (v.split(/\s+/).filter(Boolean).length < 4) return; RVS.resolved[curKey] = v; delete RVS.skipped[curKey]; rvResetIssue(); rvAdvance(); };
    const rbt = $("#rvrebuilttoggle"); if (rbt) rbt.onclick = () => { RVS.rebuiltOpen = !RVS.rebuiltOpen; rvRender(); };
    const rg = $("#rvregrade"); if (rg) rg.onclick = () => { toast("Every issue addressed. Copy your rebuilt paragraph back into your answer and resubmit for a fresh grade."); };
    $("#rvscrim").onclick = e => { if (e.target.id === "rvscrim") closeReview(); };
  }
  function rvAdvance() {
    const q = rvQueue(RVS.review.paragraphs[RVS.active]);
    rvResetIssue();
    if (RVS.qpos < q.length - 1) { RVS.qpos++; rvRender(); }
    else { RVS.view = "paragraph"; rvRender(); }
  }
  function rvParaResolved(p, pi) { const q = rvQueue(p); return q.length > 0 && q.every(x => rvKey(pi, x.si, x.ii) in RVS.resolved); }
  // WHERE TO START. The marker names one improvement area, quotes the student's own
  // words for it, and offers one action: go back and rewrite that paragraph. This is
  // the whole point of the cycle, so it sits above everything else and there is only
  // ever one of them.
  function rvFocusStrip(rv) {
    const f = rv.focus;
    if (!f || !f.area) return "";
    const p = (rv.paragraphs || [])[f.index] || null;
    const where = (p && p.name) ? p.name : "paragraph " + ((Number(f.index) || 0) + 1);
    const label = RVS.onRevise ? "Revise " + where.toLowerCase() : "Take me to " + where.toLowerCase();
    const credited = (rv.credited || []).filter(c => c && c.argument);
    const cred = credited.length
      ? `<p class="rv-credited"><b>Credited:</b> you argued ${credited.map(c => esc(c.argument.replace(/\.$/, ""))).join(", and ")}. That was not one of the paths we suggested, and it counted.</p>`
      : "";
    return `<div class="rv-focus">
      <div class="rv-focushead"><span class="rv-focustag">start here</span><span class="rv-focusarea">${esc(f.area)}</span></div>
      ${f.why ? `<p class="rv-focuswhy">${esc(f.why)}</p>` : ""}
      ${f.quote ? `<p class="rv-focusquote">${esc(f.quote)}</p>` : ""}
      <div class="rv-focusrow"><button class="rv-btn blue" id="rvfocusgo">${esc(label)}</button>${RVS.onRevise ? `<button class="rv-btn" id="rvfocusread">See the issues first</button>` : ""}</div>
      ${cred}
    </div>`;
  }
  function rvParagraphsPane(rv) {
    const rail = rv.paragraphs.map((p, i) => {
      const tick = rvParaResolved(p, i) ? `<span class="rv-ptick">✓</span>` : "";
      return `<button class="rv-pmark ${i === RVS.active ? "active" : ""}" data-rvpara="${i}" title="¶${i + 1} · ${esc(p.name || "")} · ${p.score}/${p.max}">${tick}<span class="rv-pn"><span class="rv-pp">¶</span>${i + 1}</span><span class="rv-pdot ${rvDotClass(p)}"></span></button>`;
    }).join("");
    const p = rv.paragraphs[RVS.active] || {};
    const main = RVS.view === "walk" ? rvWalkPane(p, RVS.active) : rvDefaultPane(p, RVS.active);
    // "your paragraph now" stays present in both views (collapsed by default,
    // auto-opens when every issue is addressed so Re-grade is reachable).
    const right = main + rvRebuildPanel(p, RVS.active);
    // The focus strip shows on the calm default view only: once the student is
    // inside the issue walkthrough they are already doing the work it points at.
    const focus = RVS.view === "walk" ? "" : rvFocusStrip(rv);
    return `<div class="rv-pane show">${focus}<div class="rv-cols"><div class="rv-left"><p class="rv-railhint">paragraphs</p>${rail}</div><div class="rv-right">${right}</div></div></div>`;
  }
  // The calm, score-open default view: the paragraph with severity-coloured issue
  // markers, then the score + a tappable issue status list, then "work through".
  function rvDefaultPane(p, pi) {
    const q = rvQueue(p);
    let txt = "";
    (p.sentences || []).forEach(s => {
      const si = (p.sentences || []).indexOf(s);
      if (s.text === null || s.link) {
        const k = rvKey(pi, si, 0);
        if (k in RVS.resolved) return;
        const sev = (s.issues && s.issues[0] && s.issues[0].severity) || "should";
        const qi = q.findIndex(x => x.si === si);
        txt += ` <button class="rv-misschip ${sev === "critical" ? "crit" : ""}" data-rvgoto="${qi}"><span class="rv-missx">!</span> missing: ${esc(s.missing_label || "a sentence")}</button>`;
        return;
      }
      if (!s.issues || !s.issues.length) { txt += " " + esc(s.text); return; }
      const keys = s.issues.map((iss, ii) => rvKey(pi, si, ii));
      const allResolved = keys.every(k => k in RVS.resolved);
      const trulyOpen = keys.filter(k => !rvAddressed(k));
      const anySkipped = keys.some(k => k in RVS.skipped);
      let cls, dotted = "";
      if (allResolved) cls = "good";
      else { const worst = rvWorstOpen(p, pi, si) || "optional"; cls = worst === "critical" ? "crit" : worst === "optional" ? "opt" : "weak"; if (!trulyOpen.length && anySkipped) dotted = " skipped"; }
      const qi = q.findIndex(x => x.si === si);
      txt += ` <span class="rv-span ${cls}${dotted}" data-rvgoto="${qi}">${esc(s.text)}</span>`;
    });
    const open = q.filter(x => !rvAddressed(rvKey(pi, x.si, x.ii))).length;
    const rows = q.map((x, k) => {
      const key = rvKey(pi, x.si, x.ii), st = (key in RVS.resolved) ? "done" : (key in RVS.skipped) ? "skip" : "open";
      const badge = st === "done" ? `<span class="rv-stbadge done">✓ fixed</span>` : st === "skip" ? `<span class="rv-stbadge skip">skipped</span>` : `<span class="rv-stbadge open ${x.sev}">${x.sev === "critical" ? "critical" : x.sev === "should" ? "should-fix" : "optional"}</span>`;
      return `<button class="rv-statusrow ${st}" data-rvgoto="${k}"><span class="rv-strdot ${x.sev}"></span><span class="rv-strtext">${esc(x.iss.head)}</span>${badge}</button>`;
    }).join("");
    const btn = q.length ? `<button class="rv-btn blue" id="rvwalk" style="width:100%;margin-top:12px">${open === 0 ? "Review the issues again" : "Work through the issues (" + open + ") →"}</button>` : "";
    const reasons = rows || `<p class="rv-critdesc" style="margin:0">No issues flagged in this paragraph.</p>`;
    return `<p class="rv-ptext">${txt.trim() || esc(p.name || "")}</p>`
      + `<div class="rv-scorecard"><div class="rv-pscore"><span class="rv-scbig ${rvDotClass(p)}">${p.score} / ${p.max}</span><span class="rv-scwhat">this paragraph</span></div><div class="rv-screasons">${reasons}</div>${btn}</div>`;
  }
  // The guided issue walkthrough. Step 3 builds the navigation skeleton (focused
  // screen, chip-row navigator, skip-anywhere, multi-issue sub-stepping). The
  // rewrite ladder + practice + live rebuild are added in step 5.
  function rvWalkPane(p, pi) {
    const q = rvQueue(p);
    if (!q.length) { RVS.view = "paragraph"; return rvDefaultPane(p, pi); }
    if (RVS.qpos >= q.length) RVS.qpos = 0;
    const cur = q[RVS.qpos], iss = cur.iss, key = rvKey(pi, cur.si, cur.ii);
    const s = p.sentences[cur.si];
    // sub-step label when the sentence has multiple issues
    const sentenceIssues = q.filter(x => x.si === cur.si);
    const subIdx = sentenceIssues.findIndex(x => x.ii === cur.ii);
    const subprog = sentenceIssues.length > 1 ? `<span class="rv-subprog">issue ${subIdx + 1} of ${sentenceIssues.length} in this sentence</span>` : "";
    const chips = q.map((x, k) => {
      const kk = rvKey(pi, x.si, x.ii), state = (kk in RVS.resolved) ? "done" : (kk in RVS.skipped) ? "skip" : "";
      const label = (kk in RVS.resolved) ? "✓" : (kk in RVS.skipped) ? "↷" : (k + 1);
      return `<button class="rv-ichip ${x.sev} ${state} ${k === RVS.qpos ? "cur" : ""}" data-rvchip="${k}">${label}</button>`;
    }).join("");
    const orig = (s.text === null || s.link)
      ? `<div class="rv-origtag">where a sentence is missing</div><div class="rv-origline" style="color:var(--ink-2);font-style:italic">${esc(s.missing_label || "a sentence belongs here")}</div>`
      : `<div class="rv-origtag">your line</div><div class="rv-origline">${esc(s.text)}</div>`;
    const addressed = q.filter(x => !rvAddressed(rvKey(pi, x.si, x.ii))).length === 0;
    return `<div class="rv-focusbar"><button class="rv-backbtn" id="rvback">← all issues</button><span class="rv-focusprog">Issue ${RVS.qpos + 1} of ${q.length}</span></div>`
      + `<div class="rv-chiprow">${chips}</div>`
      + `<div class="rv-issuecard sev-${iss.severity}">`
      + `<div class="rv-issuehead"><span class="rv-sevtag ${iss.severity}">${iss.severity === "critical" ? "critical" : iss.severity === "should" ? "should fix" : "optional"}</span>${subprog}</div>`
      + orig
      + `<div class="rv-issuetitle">${esc(iss.head)}</div>`
      + `<div class="rv-issuewhy">${esc(rvStripTerms(iss.why))}</div>`
      + rvLadderSection(iss, key)
      + `<div class="rv-issuebtns"><button class="rv-btn" id="rvprev" ${RVS.qpos === 0 ? "disabled" : ""}>← previous</button><button class="rv-btn rv-skipbtn" id="rvskip">Skip for now →</button><button class="rv-btn blue" id="rvnext">${RVS.qpos === q.length - 1 ? (addressed ? "Done" : "Next →") : "Next →"}</button></div>`
      + `</div>`;
  }
  // The rewrite ladder + practice + fresh write for the current issue.
  function rvLadderSection(iss, key) {
    const ladder = iss.ladder || [], LVL = ["a", "b", "c"];
    if (RVS.chosen == null) {
      const rungs = ladder.map((rg, i) => `<button class="rv-rung" data-rvrung="${i}"><span class="rv-rlvl ${LVL[i]}">${esc(rg.level)}</span><span class="rv-rt">${esc(rg.text)}</span></button>`).join("");
      return `<div class="rv-ladder">${rungs}</div><p class="rv-laddertip">Pick the level you want to aim for. Every level earns marks: the climb is pass, then strong, then exceptional.</p>`;
    }
    const rg = ladder[RVS.chosen] || ladder[0];
    const pinned = `<div class="rv-ladder"><button class="rv-rung chosen"><span class="rv-rlvl ${LVL[RVS.chosen]}">${esc(rg.level)}</span><span class="rv-rt">${esc(rg.text)}</span></button></div><button class="rv-pickother" id="rvpickother">← pick a different level</button>`;
    if (RVS.stage === "fresh") {
      const existing = (key in RVS.resolved) ? RVS.resolved[key] : "";
      return pinned
        + `<p class="rv-freshlabel">Now write it in your own words</p>`
        + `<textarea class="rv-pinput" id="rvfresh" placeholder="Write your version of this line...">${esc(existing)}</textarea>`
        + `<div class="rv-prow"><button class="rv-btn blue" id="rvaddline" disabled>Add this line to my rewrite</button></div>`;
    }
    const starters = deriveStarters(rg.text), rep = Math.min(RVS.rep, 2);
    const dots = [0, 1, 2].map(i => `<span class="rv-repdot ${i <= rep ? "on" : ""}"></span>`).join("");
    return pinned
      + `<div class="rv-practice"><div class="rv-repdots">${dots}</div>`
      + `<p class="rv-starter">Rep ${rep + 1} of 3: ${starters[rep]}</p>`
      + `<textarea class="rv-pinput" id="rvpractice" placeholder="Type the ${esc(rg.level)} version above..."></textarea>`
      + `<div class="rv-soft" id="rvpracticesoft"></div>`
      + `<div class="rv-prow"><button class="rv-btn blue" id="rvreptick">${rep < 2 ? "Next rep →" : "Write it fresh →"}</button><button class="rv-btn rv-skipbtn" id="rvskiprw">Skip to my rewrite →</button></div></div>`;
  }
  // The live-assembling "your paragraph now" panel: kept lines verbatim, resolved
  // lines in the student's words (green), pending lines in readable ink-2.
  function rvRebuildPanel(p, pi) {
    const q = rvQueue(p);
    const addressed = q.filter(x => !rvAddressed(rvKey(pi, x.si, x.ii))).length === 0;
    const open = RVS.rebuiltOpen || addressed;
    const lines = (p.sentences || []).map((s, si) => {
      if (s.text === null || s.link) { const k = rvKey(pi, si, 0); return (k in RVS.resolved) ? `<span class="rv-ln fixed">${esc(RVS.resolved[k])}</span>` : ""; }
      if (!s.issues || !s.issues.length) return `<span class="rv-ln kept">${esc(s.text)}</span>`;
      const keys = s.issues.map((iss, ii) => rvKey(pi, si, ii));
      if (keys.some(k => !(k in RVS.resolved))) return `<span class="rv-ln pending">${esc(s.text)}</span>`;
      let t = s.text, fixKey = null;
      s.issues.forEach((iss, ii) => { if (iss.kind === "fix") fixKey = rvKey(pi, si, ii); });
      if (fixKey && RVS.resolved[fixKey]) t = RVS.resolved[fixKey];
      s.issues.forEach((iss, ii) => { const k = rvKey(pi, si, ii); if (iss.kind === "term" && RVS.resolved[k]) t += " " + RVS.resolved[k]; });
      return `<span class="rv-ln fixed">${esc(t)}</span>`;
    }).filter(Boolean).join("");
    const regrade = addressed ? `<button class="rv-btn primary" id="rvregrade" style="margin-top:12px;width:100%">Re-grade this paragraph</button>` : "";
    return `<div class="rv-rebuilt"><button class="rv-rebuilttoggle" id="rvrebuilttoggle"><span>your paragraph now</span><span class="rv-rbchev">${open ? "▾" : "▸"}</span></button>${open ? `<div class="rv-rwout">${lines || '<span class="rv-rwempty">your rewrite assembles here as you fix each issue</span>'}</div>${regrade}` : ""}</div>`;
  }
  function rvRubricPane(rv) {
    const crits = (rv.rubric || []).map((c, i) => {
      const r = c.max ? c.score / c.max : 1, cls = r >= 0.8 ? "g" : r >= 0.6 ? "m" : "w";
      const bands = (c.bands || []).map(b => `<div class="rv-band ${b.here ? "here" : ""}"><span class="rv-bandno">${esc(b.range || "")}</span><span class="rv-bt">${esc(b.text || "")}${b.here ? " ← you" : ""}</span></div>`).join("");
      return `<div class="rv-crit" data-rvcrit="${i}"><div class="rv-crithead"><span class="rv-critname">${esc(c.name || "")}</span><span class="rv-pill ${cls}">${c.score}/${c.max}</span></div><div class="rv-critdesc">${esc(c.descriptor || "")}</div><div class="rv-bands" id="rvbands-${i}">${bands}</div></div>`;
    }).join("");
    return `<div class="rv-pane show"><p class="rv-tag">How this response was marked · ${rv.total} / ${rv.max}</p><p class="rv-psub">Four criteria. Tap any one to see the band descriptors and where your response sat.</p>${crits}</div>`;
  }
  // ===== Charting module (Lorenz), reused from the verified prototype renderer =====
  // Monotone cubic interpolation (Fritsch-Carlson): smooth AND guaranteed not to
  // overshoot, so the Lorenz curve passes through the true quintile points without
  // going angular or dipping past them.
  function rvMonoTangents(xs, ys) {
    const n = xs.length, dx = [], slope = [], t = new Array(n);
    for (let i = 0; i < n - 1; i++) { dx[i] = xs[i + 1] - xs[i]; slope[i] = (ys[i + 1] - ys[i]) / dx[i]; }
    t[0] = slope[0]; t[n - 1] = slope[n - 2];
    for (let i = 1; i < n - 1; i++) t[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (slope[i] === 0) { t[i] = 0; t[i + 1] = 0; }
      else { const a = t[i] / slope[i], b = t[i + 1] / slope[i], s = a * a + b * b; if (s > 9) { const tau = 3 / Math.sqrt(s); t[i] = tau * a * slope[i]; t[i + 1] = tau * b * slope[i]; } }
    }
    return { dx, t };
  }
  function rvSampleCurve(xs, ys) {
    const { dx, t } = rvMonoTangents(xs, ys), out = [];
    for (let x = 0; x <= 100.0001; x += 2) {
      let i = xs.length - 2; for (let k = 0; k < xs.length - 1; k++) { if (x <= xs[k + 1]) { i = k; break; } }
      const h = dx[i], s = (x - xs[i]) / h;
      const h00 = 2 * s ** 3 - 3 * s ** 2 + 1, h10 = s ** 3 - 2 * s ** 2 + s, h01 = -2 * s ** 3 + 3 * s ** 2, h11 = s ** 3 - s ** 2;
      out.push([x, h00 * ys[i] + h10 * h * t[i] + h01 * ys[i + 1] + h11 * h * t[i + 1]]);
    }
    return out;
  }
  // Points of interest GUIDE READING (what a feature represents) but never state
  // the conclusion the question marks. See marginal-stimulus-data-appendix.md.
  const RV_POI = {
    beforeAfter: [
      { px: 20, key: "q1", title: "The poorest 20 percent", body: "This point is the cumulative income share held by the lowest 20 percent of people. Read it on each curve to compare their share before and after tax and transfers." },
      { px: 80, key: "gap", title: "The gap between the curves", body: "Where the two curves are furthest apart, the distance between them is the redistributive effect of tax and transfers: income taxed from higher earners and directed to lower earners." },
      { px: 60, key: "eq", title: "Line of perfect equality", body: "The straight diagonal is perfect equality, where each share of people holds the same share of income. The closer a curve sits to it, the more equal that distribution." }
    ],
    incomeWealth: [
      { px: 20, key: "q1", title: "The poorest 20 percent", body: "This is the cumulative share held by the lowest 20 percent on each curve: disposable income and net worth. Read both to compare them." },
      { px: 80, key: "gap", title: "The gap between the curves", body: "The distance between the income curve and the wealth curve shows how differently the two are spread across the population." },
      { px: 60, key: "eq", title: "Line of perfect equality", body: "The diagonal is perfect equality. The further a curve bows away from it, the more concentrated that distribution." }
    ]
  };
  function rvLorenzSVG(spec, big, gShade) {
    const L = (C.charts && C.charts.lorenz) || { pop: [], series: {} };
    const keys = (spec.series || []).filter(k => L.series[k]);
    const W = big ? 620 : 460, H = big ? 500 : 380, padL = big ? 68 : 58, padB = big ? 60 : 50;
    const x0 = padL, x1 = W - 20, y0 = H - padB, y1 = big ? 54 : 22;
    const X = p => x0 + (p / 100) * (x1 - x0), Y = v => y0 - (v / 100) * (y0 - y1);
    const samples = {}; keys.forEach(k => { samples[k] = rvSampleCurve(L.pop, L.series[k].points); });
    const toPath = arr => arr.map((pt, i) => (i ? "L" : "M") + X(pt[0]).toFixed(1) + " " + Y(pt[1]).toFixed(1)).join(" ");
    let grid = "", axn = "";
    for (let g = 0; g <= 100; g += 20) {
      if (g > 0) grid += `<line x1="${X(g)}" y1="${y1}" x2="${X(g)}" y2="${y0}" class="lzgrid"/><line x1="${x0}" y1="${Y(g)}" x2="${x1}" y2="${Y(g)}" class="lzgrid"/>`;
      axn += `<text x="${X(g)}" y="${y0 + 16}" class="lzaxnum" text-anchor="middle">${g}</text><text x="${x0 - 8}" y="${Y(g) + 4}" class="lzaxnum" text-anchor="end">${g}</text>`;
    }
    let svg = `<svg viewBox="0 0 ${W} ${H}" class="lzsvg${big ? " lzsvg-big" : ""}" role="img" aria-label="Lorenz curve stimulus">`;
    svg += grid + axn;
    svg += `<g id="${big ? "ginishadeBig" : "ginishade"}"></g>`;
    // Gini "how it's built" shading takes over the chart: one curve, shade A then B.
    if (gShade) {
      const cu = samples[gShade.curve] || samples[keys[0]];
      const fwd = toPath(cu);
      if (gShade.step >= 1) { // Area A: between the equality line and the curve
        const eqBack = cu.slice().reverse().map(pt => "L" + X(pt[0]).toFixed(1) + " " + Y(pt[0]).toFixed(1)).join(" ");
        svg += `<path d="${fwd} ${eqBack} Z" class="giniA"/><text x="${X(38)}" y="${Y(58)}" class="ginilbl ginilblA">A</text>`;
      }
      if (gShade.step >= 2) { // Area B: under the curve
        svg += `<path d="${fwd} L${X(100).toFixed(1)} ${Y(0).toFixed(1)} L${X(0).toFixed(1)} ${Y(0).toFixed(1)} Z" class="giniB"/><text x="${X(72)}" y="${Y(22)}" class="ginilbl ginilblB">B</text>`;
      }
      svg += `<line x1="${X(0)}" y1="${Y(0)}" x2="${X(100)}" y2="${Y(100)}" class="lzeq"/>`;
      svg += `<path d="${fwd}" class="${L.series[gShade.curve] ? L.series[gShade.curve].cls : "lzgross"}"/>`;
    } else {
      // gap fill between the first two curves
      if (spec.gap && keys.length >= 2) {
        const back = samples[keys[1]].slice().reverse().map(pt => "L" + X(pt[0]).toFixed(1) + " " + Y(pt[1]).toFixed(1)).join(" ");
        svg += `<path d="${toPath(samples[keys[0]])} ${back} Z" class="lzgap"/>`;
      }
      svg += `<line x1="${X(0)}" y1="${Y(0)}" x2="${X(100)}" y2="${Y(100)}" class="lzeq"/>`;
      keys.forEach(k => { svg += `<path d="${toPath(samples[k])}" class="${L.series[k].cls}"/>`; });
    }
    svg += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y0}" class="lzaxis"/><line x1="${x0}" y1="${y0}" x2="${x0}" y2="${y1}" class="lzaxis"/>`;
    svg += `<text x="${(x0 + x1) / 2}" y="${H - (big ? 16 : 12)}" class="lzaxlab" text-anchor="middle">cumulative % of people</text>`;
    svg += `<text transform="translate(${big ? 18 : 14},${(y0 + y1) / 2}) rotate(-90)" class="lzaxlab" text-anchor="middle">cumulative % of income or wealth</text>`;
    // points of interest (hidden while the Gini shading is active)
    const poi = gShade ? [] : (RV_POI[spec.poi] || []);
    poi.forEach(p => {
      let cy; if (p.key === "eq") cy = Y(p.px); else { const idx = L.pop.indexOf(p.px); cy = Y(L.series[keys[0]].points[idx]); }
      svg += `<g class="lzpoi" data-rvpoi="${p.key}"><circle cx="${X(p.px)}" cy="${cy}" r="${big ? 9 : 7}" class="lzpoidot"/><circle cx="${X(p.px)}" cy="${cy}" r="${big ? 9 : 7}" class="lzpoiring"/></g>`;
    });
    // legend: equality + each shown series (in Gini mode only the active curve)
    const legendKeys = gShade ? [gShade.curve] : keys;
    const lx = x0 + 14; let ly = y1 + (big ? 6 : 8);
    svg += `<g><line x1="${lx}" y1="${ly}" x2="${lx + 22}" y2="${ly}" class="lzeq"/><text x="${lx + 28}" y="${ly + 4}" class="lzleglab">perfect equality (Gini 0)</text>`;
    legendKeys.forEach(k => { ly += 19; svg += `<line x1="${lx}" y1="${ly}" x2="${lx + 22}" y2="${ly}" class="${L.series[k].cls}"/><text x="${lx + 28}" y="${ly + 4}" class="lzleglab">${esc(L.series[k].label)}</text>`; });
    svg += `</g></svg>`;
    return svg;
  }
  function rvWireLorenz(mountId, spec) {
    const m = document.getElementById(mountId); if (!m) return;
    m.querySelectorAll("[data-rvpoi]").forEach(g => g.onclick = () => {
      const p = (RV_POI[spec.poi] || []).find(x => x.key === g.dataset.rvpoi); if (!p) return;
      const side = document.getElementById(mountId + "-explain");
      if (side) side.innerHTML = `<div class="lzexp-t">${esc(p.title)}</div><div class="lzexp-b">${esc(p.body)}</div>`;
    });
  }
  // Income-source horizontal bar (Table 11.1). Bar length is the actual share.
  function rvIncomeSourceHTML() {
    const src = (C.charts && C.charts.incomeSource) || { items: [] };
    const rows = (src.items || []).map(i => `<div class="srcrow"><span class="srclab">${esc(i.label)}</span><span class="srctrack"><span class="srcfill" style="width:${(Number(i.pct) || 0).toFixed(1)}%"></span></span><span class="srcpct">${i.pct}%</span></div>`).join("");
    return `<div class="lzwrap"><div class="srcbar" role="img" aria-label="Household income by source">${rows}</div></div>`;
  }
  function rvChartHTML(spec, idx) {
    if (spec.type === "lorenz") {
      // chart, then a bottom row: guide-not-conclude note (left, doubles as the
      // POI explainer) and the expand button (right) — not in the corner.
      return `<div class="lzwrap"><div id="lzmount-${idx}">${rvLorenzSVG(spec, false)}</div>`
        + `<div class="lzfoot"><span class="lzexplain" id="lzmount-${idx}-explain"><span class="lzhint">Tap a point to see what it represents. The conclusion is yours to write.</span></span><button class="btn ghost sm" data-rvexpand="${idx}">expand</button></div></div>`;
    }
    if (spec.type === "incomeSource") return rvIncomeSourceHTML();
    return "";
  }
  function rvOpenContext(which) {
    const rv = RVS.review; if (!rv) return;
    if (!document.getElementById("rvctxhost")) { const h = document.createElement("div"); h.id = "rvctxhost"; document.body.appendChild(h); }
    const host = document.getElementById("rvctxhost"), q = rv.question || {};
    let body;
    if (which === "stimulus") {
      const s = q.stimulus;
      if (s && typeof s === "object" && Array.isArray(s.charts)) {
        body = `<p class="rv-ctxtag">Stimulus</p>${s.caption ? `<p class="lzcap">${esc(s.caption)}</p>` : ""}${s.charts.map((c, i) => rvChartHTML(c, i)).join("")}`;
      } else {
        body = `<p class="rv-ctxtag">Stimulus</p><div class="rv-ctxnote">${esc(s || "No stimulus for this question.")}</div>`;
      }
    } else {
      body = `<p class="rv-ctxtag">The question</p><div class="rv-ctxstem">${esc(q.stem || "")}</div><div class="rv-ctxmeta">${q.command ? `<span class="rv-ctxpill">${esc(q.command)}</span>` : ""}${q.marks ? `<span class="rv-ctxpill">${q.marks} marks</span>` : ""}</div>`;
    }
    host.innerHTML = `<div class="rv-ctxscrim show" id="rvctxscrim"><div class="rv-ctxcard"><button class="rv-ctxx" id="rvctxx" aria-label="Close">✕</button>${body}</div></div>`;
    const close = () => host.remove();
    $("#rvctxx").onclick = close;
    $("#rvctxscrim").onclick = e => { if (e.target.id === "rvctxscrim") close(); };
    // wire charts (POIs + expand) after insertion
    if (which === "stimulus" && q.stimulus && typeof q.stimulus === "object" && Array.isArray(q.stimulus.charts)) {
      q.stimulus.charts.forEach((c, i) => { if (c.type === "lorenz") rvWireLorenz("lzmount-" + i, c); });
      host.querySelectorAll("[data-rvexpand]").forEach(b => b.onclick = () => rvExpandLorenz(q.stimulus.charts[Number(b.dataset.rvexpand)]));
    }
  }
  // "How the Gini is built": framed as understanding, not calculation. Uses the
  // SOURCE Gini values (see appendix), so the number shown is the real one;
  // A = gini/2 and B = 0.5 - A keep the parts consistent with it.
  const RVG = { active: false, curve: "gross", step: 0 };
  function rvGiniNums(curve) { const g = ((C.charts.lorenz.series[curve]) || {}).gini || 0; return { gini: g, A: g / 2, B: 0.5 - g / 2 }; }
  function rvRenderBig(spec) {
    const mount = document.getElementById("lzmountBig"), side = document.getElementById("lzmountBig-explain");
    if (!mount || !side) return;
    mount.innerHTML = rvLorenzSVG(spec, true, RVG.active ? { curve: RVG.curve, step: RVG.step } : null);
    if (RVG.active) {
      const n = rvGiniNums(RVG.curve), which = RVG.curve === "gross" ? "before tax and transfers" : "after tax and transfers";
      let h = `<div class="ginihead">How the Gini is built</div>`;
      h += `<p class="giniframe">The HSC asks you to <b>interpret</b> Lorenz curves, not calculate the Gini. This shows how the number is built, so the interpretation makes sense.</p>`;
      h += `<div class="ginicurvesel"><button class="${RVG.curve === "gross" ? "on" : ""}" data-rvgcurve="gross">before</button><button class="${RVG.curve === "disposable" ? "on" : ""}" data-rvgcurve="disposable">after</button></div>`;
      h += `<p class="ginistepnote">Building it for the <b>${which}</b> curve.</p>`;
      h += `<div class="ginistep ${RVG.step >= 1 ? "on" : ""}"><span class="gn">1</span> Area A, between the equality line and the curve${RVG.step >= 1 ? ` <span class="ginival">= ${n.A.toFixed(3)}</span>` : ""}</div>`;
      h += `<div class="ginistep ${RVG.step >= 2 ? "on" : ""}"><span class="gn">2</span> Area B, under the curve${RVG.step >= 2 ? ` <span class="ginival">= ${n.B.toFixed(3)}</span>` : ""}</div>`;
      h += `<div class="ginistep ${RVG.step >= 3 ? "on" : ""}"><span class="gn">3</span> Gini = A / (A + B)${RVG.step >= 3 ? ` <span class="ginival big">= ${n.gini.toFixed(3)}</span>` : ""}</div>`;
      if (RVG.step < 3) h += `<button class="rv-btn blue" style="width:100%;margin-top:8px" id="rvgininext">${RVG.step === 0 ? "Show Area A" : RVG.step === 1 ? "Show Area B" : "Compute the Gini"}</button>`;
      else h += `<p class="ginidone">A Gini of ${n.gini.toFixed(3)}. The closer to 0, the more equal. Switch curves to compare before and after.</p>`;
      h += `<button class="rv-btn" style="width:100%;margin-top:8px" id="rvginistop">← back to points of interest</button>`;
      side.innerHTML = h;
      side.querySelectorAll("[data-rvgcurve]").forEach(b => b.onclick = () => { RVG.curve = b.dataset.rvgcurve; RVG.step = 0; rvRenderBig(spec); });
      const nx = document.getElementById("rvgininext"); if (nx) nx.onclick = () => { if (RVG.step < 3) { RVG.step++; rvRenderBig(spec); } };
      document.getElementById("rvginistop").onclick = () => { RVG.active = false; rvRenderBig(spec); };
    } else {
      let h = `<div class="lzexp-t">Reading the chart</div><div class="lzexp-b">Tap a blue point on the curve to see what each feature represents. The interpretation is yours to write.</div>`;
      if (spec.gini) h += `<button class="rv-btn blue" style="width:100%;margin-top:12px" id="rvginistart">How the Gini is built</button>`;
      side.innerHTML = h;
      rvWireLorenz("lzmountBig", spec);
      const st = document.getElementById("rvginistart"); if (st) st.onclick = () => { RVG.active = true; RVG.step = 0; RVG.curve = "gross"; rvRenderBig(spec); };
    }
  }
  function rvExpandLorenz(spec) {
    if (!spec || spec.type !== "lorenz") return;
    RVG.active = false; RVG.step = 0; RVG.curve = "gross";
    let d = document.getElementById("lzbig");
    if (!d) { d = document.createElement("div"); d.id = "lzbig"; d.className = "lzbigscrim"; document.body.appendChild(d); }
    d.className = "lzbigscrim show";
    d.innerHTML = `<div class="lzbigcard"><button class="rv-ctxx" id="lzbigx" aria-label="Close">✕</button><div class="lzbiggrid"><div id="lzmountBig"></div><div class="lzbigside" id="lzmountBig-explain"></div></div></div>`;
    rvRenderBig(spec);
    const close = () => d.classList.remove("show");
    $("#lzbigx").onclick = close;
    d.onclick = e => { if (e.target === d) close(); };
  }

  // Dev entry for building and eyeballing the review without a live grade.
  // ?reviewdemo=1 opens CONTENT.reviewSample; ?reviewdemo=card:<id> opens a
  // preview built from that question's marking-scheme faults (to eyeball the
  // ladders and derived starters). Student entry (after a real grade) is gated
  // behind CONFIG.reviewMode, off by default, so this does not change the live UI.
  function rvFindCard(id) { let found = null; (C.areas || []).forEach(a => (a.cards || []).forEach(c => { if (c.id === id) found = c; })); return found; }
  function rvPreviewFromCard(card) {
    const faults = card.faults || [];
    return {
      question: { stem: card.prompt, command: card.command, marks: card.marks, stimulus: card.stimulus },
      total: 0, max: card.marks,
      summary: "Preview of this question's marking scheme. Real grades come from the worker against the student's own answer.",
      paragraphs: [{ name: "Anticipated faults", score: 0, max: card.marks, reasons: [], sentences: faults.map(f => ({ text: "(an example line that triggers this fault)", issues: [f] })) }],
      rubric: []
    };
  }
  // The ?reviewdemo entry must respect the gate — only open it once we know the
  // student is allowed in (signed in, or cloud unconfigured).
  function maybeOpenReviewDemo() {
    if (gated()) return;
    try {
      const m = /[?&]reviewdemo=([^&]+)/.exec(location.search);
      if (m) {
        const v = decodeURIComponent(m[1]);
        if (v === "1" && C.reviewSample) openReview(C.reviewSample);
        else if (v.indexOf("card:") === 0) { const card = rvFindCard(v.slice(5)); if (card) openReview(rvPreviewFromCard(card)); }
      }
    } catch (e) { /* demo entry is best-effort */ }
  }

  // ===========================================================================
  // Essay practice mode — coached writing + full attempt (HSC Ancient History).
  // Whole feature is behind CONFIG.essayMode (promotion switch) with ?essay=1 /
  // localStorage one-person overrides and a ?essaydemo=1 dev entry, mirroring the
  // reviewMode / ?reviewdemo convention exactly. Live students see nothing until
  // the flag flips. Three screens (setup, coached practice, full attempt) share a
  // SINGLE draft: there is never a second draft to reconcile. The draft persists
  // in localStorage for now; an essay_drafts table with owner = auth.uid() RLS is
  // the later go-live step. Reuses the worker-call shape and the labelled demo
  // fallback pattern (see gradeWritten / demoEssay), never the substitution ladder.
  // ===========================================================================
  function essayEnabled() {
    if (CONFIG.essayMode === true) return true;
    if (/[?&]essay=1/.test(location.search)) return true;
    try { if (localStorage.getItem("marginal.essay") === "1") return true; } catch (e) { /* sandboxed */ }
    return false;
  }
  // Client-side subject routing. The essay CORE is subject-agnostic (it runs on the
  // student's OWN question), so the subject here only chooses the optional add-ons:
  // pre-written suggested questions and worked examples. An unmatched code resolves
  // to null, which is fine: the student types their own question and the add-ons hide
  // or fall back. 12Ec* stays Economics, untouched.
  const SUBJECT_RULES = [
    { re: /^11Anc/i, subject: "ancient_history" },
    { re: /^12Ec/i, subject: "economics" },
  ];
  function subjectForCode(code) {
    const c = String(code || "").trim();
    for (let i = 0; i < SUBJECT_RULES.length; i++) if (SUBJECT_RULES[i].re.test(c)) return SUBJECT_RULES[i].subject;
    return null; // unknown -> no subject-specific add-ons; the core still works
  }
  function currentClassCode() {
    try { const w = Cloud.who && Cloud.who(); if (w && w.class_code) return w.class_code; } catch (e) { /* ignore */ }
    return state.code || CONFIG.code || "";
  }
  function esSubjectContent(subject) {
    return (window.ESSAY && window.ESSAY.subjects && window.ESSAY.subjects[subject]) || null;
  }
  // The worked-example fallback set (window.ESSAY.slots.examples) is authored for this
  // subject. Any OTHER subject borrows it as a clearly-labelled placeholder until its
  // own examples are authored; same subject sees it as its own (no placeholder note).
  const ESSAY_FALLBACK_EXAMPLE_SUBJECT = "ancient_history";
  // A subject's display label. Falls back to a humanised key (e.g. "economics" ->
  // "Economics") when the subject has no content yet, and to "" for an unknown code.
  function esSubjectLabel() {
    const sc = esSubjectContent(ES.subject);
    if (sc && sc.label) return sc.label;
    if (ES.subject) return String(ES.subject).replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    return "";
  }
  // The normalised view the screens render from. Always non-null: the core works for
  // every login. Only `questions` (suggested-question chips) is subject-specific, and
  // it is empty unless THIS subject ships its own pre-written set.
  function esView() {
    const sc = esSubjectContent(ES.subject);
    const questions = (sc && Array.isArray(sc.questions)) ? sc.questions : [];
    const models = (sc && sc.scaffolds) ? (sc.paraModels || Object.keys(sc.scaffolds)) : [];
    return {
      label: esSubjectLabel(), stage: (sc && sc.stage) || "",
      questions, hasQuestions: questions.length > 0,
      paraModels: models, hasParaModels: models.length > 0,
      defaultStructure: (sc && sc.defaultStructure) || (window.ESSAY && window.ESSAY.defaultStructure) || "five"
    };
  }
  // Subjects a student can pick in setup: any that ship their own questions or a
  // paragraph scaffold. Lets any login load a subject's bank without a class-code
  // rule (the routed subject is just the default selection).
  function esSubjectsList() {
    const subs = (window.ESSAY && window.ESSAY.subjects) || {};
    return Object.keys(subs)
      .filter(k => { const s = subs[k]; return s && ((Array.isArray(s.questions) && s.questions.length) || s.scaffolds); })
      .map(k => ({ key: k, label: subs[k].label || k }));
  }
  // A model's short label (e.g. "teeec" -> "TEEEC") from the subject's scaffolds.
  function esParaModelLabel(model) {
    const sc = esSubjectContent(ES.subject);
    const m = sc && sc.scaffolds && sc.scaffolds[model];
    return (m && m.label) || String(model || "").toUpperCase();
  }
  // The worked-example set for the current subject, with the fallback flagged as a
  // placeholder. Examples are ALWAYS fixed and pre-written (never generated), whether
  // a subject's own or the borrowed fallback.
  function esWorkedExampleSet() {
    const sc = esSubjectContent(ES.subject);
    if (sc && Array.isArray(sc.examples) && sc.examples.length) return { list: sc.examples, placeholder: false };
    const g = (window.ESSAY && window.ESSAY.slots && window.ESSAY.slots.examples) || [];
    return { list: g, placeholder: ES.subject !== ESSAY_FALLBACK_EXAMPLE_SUBJECT };
  }
  function esStructureDef(key) {
    const S = (window.ESSAY && window.ESSAY.structures) || [];
    return S.find(s => s.key === key) || S.find(s => s.key === (window.ESSAY && window.ESSAY.defaultStructure)) || S[0] || { key: "five", label: "5 paragraphs", roles: ["Introduction", "Body 1", "Body 2", "Body 3", "Conclusion"] };
  }
  function esStructureLabel(key) { return esStructureDef(key).label; }

  const ES = { subject: null, code: "", demo: false, screen: "setup", draft: null, list: [], form: null, pending: false,
    ui: { polishOpen: false, miss: {}, frame: {}, frameOpen: {}, editBlock: null, rung: 0, stayStep: false, tool: null, readMore: false, evAll: false, ctx: null, moreLine: false, pointOpen: false, mapOpen: {}, planOpen: {}, twinOk: {}, planAll: false, coreExplain: false, coreIdea: false, why: null, compare: false, posOpen: false, critOpen: false, tryPick: null, lessonMore: false, lessonJump: null },  // transient guided-view state, reset on paragraph change
    hint: { open: false, tab: "know" },          // study hints: persists across paragraphs on purpose
    quiz: { revealed: false, peeked: false, attempt: "", result: null } };
  const ES_KEY = "marginal.essay.v1";
  function esResetCoachUI() { ES.ui = { polishOpen: false, miss: {}, frame: {}, frameOpen: {}, editBlock: null, rung: 0, stayStep: false, tool: null, readMore: false, evAll: false, ctx: null, moreLine: false, pointOpen: false, mapOpen: {}, planOpen: {}, twinOk: {}, planAll: false, coreExplain: false, coreIdea: false, why: null, compare: false, posOpen: false, critOpen: false, tryPick: null, lessonMore: false, lessonJump: null }; }
  // peeked persists for the whole attempt: revealing once disqualifies mastery even
  // if the answer is hidden again before checking. Cleared only on a new attempt.
  function esResetQuiz() { ES.quiz = { revealed: false, peeked: false, attempt: "", result: null }; }
  // The active per-subject paragraph scaffold (e.g. Business Studies TEEEC/TDECC),
  // chosen from the draft (or the setup form before a draft exists). Returns null
  // when the subject ships no scaffolds, so the shared slot model is used instead.
  function esActiveScaffold() {
    const sc = esSubjectContent(ES.subject);
    const models = sc && sc.scaffolds;
    if (!models) return null;
    const chosen = (ES.draft && ES.draft.paraModel) || (ES.form && ES.form.paraModel) ||
                   (Array.isArray(sc.paraModels) && sc.paraModels[0]) || Object.keys(models)[0];
    return (chosen && models[chosen]) || null;
  }
  // Map a paragraph's role to its slot set. Intro/Conclusion use the shared light
  // sets; the BODY set is the subject scaffold's when present (TEEEC/TDECC),
  // otherwise the shared body slots (window.ESSAY.slots).
  function slotsForRole(role) {
    const sets = (window.ESSAY && window.ESSAY.slots && window.ESSAY.slots.roleSets) || {};
    const r = String(role || "").toLowerCase();
    if (r.indexOf("introduction") === 0 || r === "intro") return sets.introduction || [];
    if (r.indexOf("conclusion") === 0) return sets.conclusion || [];
    const scaf = esActiveScaffold();
    return (scaf && scaf.body) || sets.body || [];
  }
  function slotDef(role, key) { return slotsForRole(role).find(s => s.key === key) || null; }
  // Frame templates for a slot: the active scaffold's when it defines the key,
  // otherwise the shared templates.
  function slotTemplates(key) {
    const scaf = esActiveScaffold();
    if (scaf && scaf.templates && scaf.templates[key]) return scaf.templates[key];
    return (window.ESSAY && window.ESSAY.slots && window.ESSAY.slots.templates && window.ESSAY.slots.templates[key]) || null;
  }
  // Which family of sentence the question's directive calls for. Falls back to
  // causal, which is the larger family and the safer default: a causal frame on a
  // judgement question is merely unhelpful, while a judgement frame on a How
  // question teaches a student to weigh something the question never asked about.
  function esDirectiveFamily() {
    const q = esQuestionDef();
    const cmd = String((q && q.command) || "").trim().toLowerCase();
    const fams = ((window.ESSAY && window.ESSAY.slots && window.ESSAY.slots.templates) || {}).directiveFamilies || {};
    for (const name of Object.keys(fams)) {
      if ((fams[name] || []).some(x => cmd === x || cmd.indexOf(x) === 0)) return name;
    }
    return "causal";
  }
  // The frames for a slot, after the directive has chosen the family.
  function esShapesFor(key) {
    const t = slotTemplates(key) || {};
    const fam = t.byFamily && t.byFamily[esDirectiveFamily()];
    const use = fam || t;
    return [use.tier1].concat((use.tier2 || []).map(x => x.frame)).filter(Boolean);
  }
  function esBagKey() { return ES.subject + "|" + ES.code; }
  const ES_DRAFT_CAP = 24; // keep a manageable set of saved essays; drop the oldest beyond this
  function esReadStore() { try { return JSON.parse(store.getItem(ES_KEY) || "{}") || {}; } catch (e) { return {}; } }
  function esRecent(list) { return (list || []).slice().sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""))); }
  function esLoadList() {
    const all = esReadStore(); const bag = all[esBagKey()];
    ES.list = esRecent(bag && Array.isArray(bag.drafts) ? bag.drafts : []);
  }
  // ---- THE NOTEBOOK -------------------------------------------------------
  // A separate cognitive space between being taught something and writing an
  // assessed answer. It is deliberately not part of the page geometry: it floats
  // over whatever is underneath, so opening it never moves the writing, and it
  // stays reachable while the Learning Centre is open because that is exactly
  // when a student wants to write something down.
  //
  // Pages, not a feed. A growing list of snippets is a log; a notebook with a
  // handful of named pages is somewhere to think. The attempt's own notebook
  // autosaves with the draft. Saving under a name is a separate, explicit act.
  const ES_NB_KEY = "marginal.notebooks.v1";
  const ES_NB_SIZE = "marginal.notebook.size";
  const ES_NB_POS = "marginal.notebook.pos";
  function esNb() {
    if (!ES.draft) return { pages: [], active: 0 };
    if (!ES.draft.notebook || !Array.isArray(ES.draft.notebook.pages) || !ES.draft.notebook.pages.length) {
      ES.draft.notebook = { pages: [{ id: "p1", name: "Page 1", body: "" }], active: 0 };
    }
    const n = ES.draft.notebook;
    if (n.active >= n.pages.length) n.active = n.pages.length - 1;
    if (n.active < 0) n.active = 0;
    return n;
  }
  function esNbPage() { const n = esNb(); return n.pages[n.active] || null; }
  function esNbAddPage() {
    const n = esNb();
    n.pages.push({ id: "p" + Date.now().toString(36), name: "Page " + (n.pages.length + 1), body: "" });
    n.active = n.pages.length - 1; esSaveDraft();
  }
  function esNbDeletePage() {
    const n = esNb();
    if (n.pages.length <= 1) { n.pages[0].body = ""; n.pages[0].name = "Page 1"; esSaveDraft(); return; }
    n.pages.splice(n.active, 1);
    if (n.active >= n.pages.length) n.active = n.pages.length - 1;
    esSaveDraft();
  }
  function esNbGo(d) { const n = esNb(); n.active = Math.max(0, Math.min(n.pages.length - 1, n.active + d)); esSaveDraft(); }
  function esNbLibrary() {
    try { return JSON.parse(localStorage.getItem(ES_NB_KEY) || "[]") || []; } catch (e) { return []; }
  }
  function esNbSaveNamed(name) {
    const list = esNbLibrary();
    const nm = String(name || "").trim(); if (!nm) return;
    const copy = JSON.parse(JSON.stringify(esNb()));
    const i2 = list.findIndex(x => x.name.toLowerCase() === nm.toLowerCase());
    const rec = { name: nm, at: new Date().toISOString(), notebook: copy };
    if (i2 >= 0) list[i2] = rec; else list.push(rec);
    try { localStorage.setItem(ES_NB_KEY, JSON.stringify(list)); } catch (e) { /* quota */ }
  }
  // Opening a saved notebook must never quietly replace what the student has
  // written for this attempt, so the copy is an explicit second step.
  function esNbUseCopy(name) {
    const rec = esNbLibrary().find(x => x.name === name); if (!rec || !ES.draft) return;
    ES.draft.notebook = JSON.parse(JSON.stringify(rec.notebook)); esSaveDraft();
  }
  function esNbSize() {
    try { const v = JSON.parse(sessionStorage.getItem(ES_NB_SIZE) || "null"); if (v && v.w && v.h) return v; } catch (e) { /* private mode */ }
    return { w: 420, h: 520 };
  }
  function esNbPos() {
    if (ES.ui.nbPos) return ES.ui.nbPos;
    try { const v = JSON.parse(sessionStorage.getItem(ES_NB_POS) || "null"); if (v && typeof v.left === "number") return v; } catch (e) { /* private mode */ }
    return null;
  }
  function esNbHTML() {
    const n = esNb(), pg = esNbPage(), lib = esNbLibrary(), sz = esNbSize();
    const mode = ES.ui.nbMode || "";
    const pos = esNbPos();
    const place = pos ? `left:${pos.left}px;top:${pos.top}px;right:auto;bottom:auto` : "";
    return `<div class="es-nb" style="width:${sz.w}px;height:${sz.h}px;${place}" role="dialog" aria-label="Notebook">
      <div class="es-nbhead">
        <span class="es-nbtitle">Notebook</span>
        <button type="button" class="es-nbact" data-esnbhome title="Put the notebook back in its default corner">reset position</button>
        <button type="button" class="es-nbact" data-esnbmode="${mode === "save" ? "" : "save"}">save notebook</button>
        <button type="button" class="es-nbact" data-esnbmode="${mode === "open" ? "" : "open"}">open</button>
        <button type="button" class="es-nbx" data-esnbclose aria-label="Close notebook">${esIcon("close")}</button>
      </div>
      ${mode === "save" ? `<div class="es-nbbar">
        <input class="es-nbname" data-esnbname placeholder="Name this notebook" value="${esc(ES.ui.nbName || "")}">
        <button type="button" class="es-btn sm primary" data-esnbsave>Save to this device</button>
        <button type="button" class="es-btn sm" disabled title="Sign-in exists, but notebooks are not stored on the account yet. Nothing here is sent anywhere.">My account</button>
      </div>
      <p class="es-nbnote">Saved on this device only. Account storage is not wired up yet, so that option stays off rather than pretending.</p>` : ""}
      ${mode === "open" ? `<div class="es-nblib">
        ${lib.length ? lib.map(x => `<div class="es-nbrow">
          <span class="es-nbrown">${esc(x.name)}</span>
          <button type="button" class="es-noteact" data-esnbcopy="${esc(x.name)}">use a copy for this essay</button>
        </div>`).join("") : `<p class="es-nbnote">No saved notebooks yet.</p>`}
      </div>` : ""}
      <textarea class="es-nbpaper" data-esnbbody placeholder="Write what you want to remember, in your own words.">${esc(pg ? pg.body : "")}</textarea>
      <div class="es-nbfoot">
        <button type="button" class="es-nbstep" data-esnbgo="-1" ${n.active === 0 ? "disabled" : ""} aria-label="Previous page">\u2039</button>
        <input class="es-nbpagename" data-esnbrename value="${esc(pg ? pg.name : "")}" aria-label="Page name">
        <span class="es-nbcount">${n.active + 1} of ${n.pages.length}</span>
        <button type="button" class="es-nbstep" data-esnbgo="1" ${n.active >= n.pages.length - 1 ? "disabled" : ""} aria-label="Next page">\u203a</button>
        <button type="button" class="es-nbact" data-esnbadd>+ new page</button>
        <button type="button" class="es-nbact" data-esnbdel>delete page</button>
      </div>
    </div>`;
  }
  function esNbMount() {
    let host = document.getElementById("esnbhost");
    if (!host) { host = document.createElement("div"); host.id = "esnbhost"; document.body.appendChild(host); }
    host.innerHTML = esNbHTML();
    esNbBind(host);
  }
  function esNbUnmount() {
    const host = document.getElementById("esnbhost"); if (host) host.remove();
    ES.ui.nbOpen = false; ES.ui.nbMode = "";
    document.querySelectorAll("[data-esnbtoggle]").forEach(b => b.setAttribute("aria-expanded", "false"));
  }
  function esNbToggle() {
    ES.ui.nbOpen = !ES.ui.nbOpen;
    if (ES.ui.nbOpen) { esNbMount(); document.querySelectorAll("[data-esnbtoggle]").forEach(b => b.setAttribute("aria-expanded", "true")); }
    else esNbUnmount();
  }
  function esNbBind(host) {
    const panel = host.querySelector(".es-nb"); if (!panel) return;
    const body = panel.querySelector("[data-esnbbody]");
    // Autosave while typing. No save button for the attempt's own notebook,
    // because a notebook you can lose by navigating away is not a notebook.
    if (body) body.oninput = () => { const pg = esNbPage(); if (pg) { pg.body = body.value; esSaveDraft(); } };
    const rn = panel.querySelector("[data-esnbrename]");
    if (rn) rn.oninput = () => { const pg = esNbPage(); if (pg) { pg.name = rn.value; esSaveDraft(); } };
    panel.querySelectorAll("[data-esnbgo]").forEach(b => b.onclick = () => { esNbGo(Number(b.dataset.esnbgo)); esNbMount(); });
    const add = panel.querySelector("[data-esnbadd]"); if (add) add.onclick = () => { esNbAddPage(); esNbMount(); };
    const del = panel.querySelector("[data-esnbdel]");
    if (del) del.onclick = () => { if (window.confirm("Delete this page? What is written on it will be lost.")) { esNbDeletePage(); esNbMount(); } };
    panel.querySelectorAll("[data-esnbmode]").forEach(b => b.onclick = () => { ES.ui.nbMode = b.dataset.esnbmode; esNbMount(); });
    const nm = panel.querySelector("[data-esnbname]"); if (nm) nm.oninput = () => { ES.ui.nbName = nm.value; };
    const sv = panel.querySelector("[data-esnbsave]");
    if (sv) sv.onclick = () => { esNbSaveNamed(ES.ui.nbName); ES.ui.nbMode = ""; esNbMount(); };
    panel.querySelectorAll("[data-esnbcopy]").forEach(b => b.onclick = () => {
      if (window.confirm("Replace this essay's notebook with a copy of \"" + b.dataset.esnbcopy + "\"? The current notebook will be lost unless you saved it.")) {
        esNbUseCopy(b.dataset.esnbcopy); ES.ui.nbMode = ""; esNbMount();
      }
    });
    const home = panel.querySelector("[data-esnbhome]");
    if (home) home.onclick = () => { ES.ui.nbPos = null; try { sessionStorage.removeItem(ES_NB_POS); } catch (e) { /* private mode */ } esNbMount(); };
    const x = panel.querySelector("[data-esnbclose]"); if (x) x.onclick = () => esNbUnmount();
    // Draggable from its title bar. Collisions between a floating notebook and a
    // tool sheet are the student's to resolve by moving it, which is how every
    // desktop notebook works, rather than a placement algorithm that guesses.
    const head = panel.querySelector(".es-nbhead");
    if (head) head.onmousedown = e => {
      if (e.target.closest("button") || e.target.closest("input")) return;
      e.preventDefault();
      const r = panel.getBoundingClientRect();
      const dx = e.clientX - r.left, dy = e.clientY - r.top;
      const move = ev => {
        // Bounded, so it can never be dragged somewhere it cannot be dragged back from.
        const w = panel.offsetWidth, h = panel.offsetHeight;
        const left = Math.max(6, Math.min(window.innerWidth - w - 6, ev.clientX - dx));
        const top = Math.max(6, Math.min(window.innerHeight - h - 6, ev.clientY - dy));
        panel.style.left = left + "px"; panel.style.top = top + "px";
        panel.style.right = "auto"; panel.style.bottom = "auto";
        ES.ui.nbPos = { left: left, top: top };
        try { sessionStorage.setItem(ES_NB_POS, JSON.stringify(ES.ui.nbPos)); } catch (e2) { /* private mode */ }
      };
      const up = () => { document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); };
      document.addEventListener("mousemove", move); document.addEventListener("mouseup", up);
    };
    // The student's own size, remembered for the session.
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => {
        // Same guard as the tool window: a teardown resize is not a size the
        // student picked, and storing it loses the one they did.
        if (!panel.isConnected || !panel.offsetWidth || !panel.offsetHeight) return;
        try { sessionStorage.setItem(ES_NB_SIZE, JSON.stringify({ w: Math.round(panel.offsetWidth), h: Math.round(panel.offsetHeight) })); } catch (e) { /* private mode */ }
      });
      ro.observe(panel);
    }
  }

  function esSaveDraft() {
    if (!ES.draft) return;
    ES.draft.updatedAt = new Date().toISOString(); // most-recent-first ordering
    const all = esReadStore();
    const bag = all[esBagKey()] || { drafts: [] };
    const i = bag.drafts.findIndex(d => d.id === ES.draft.id);
    if (i >= 0) bag.drafts[i] = ES.draft; else bag.drafts.push(ES.draft);
    bag.drafts = esRecent(bag.drafts).slice(0, ES_DRAFT_CAP); // cap; oldest fall off
    all[esBagKey()] = bag; ES.list = bag.drafts;
    try { store.setItem(ES_KEY, JSON.stringify(all)); } catch (e) { /* in-memory fallback */ }
  }
  // Remove one saved essay from localStorage and the in-memory list. The caller
  // removes just that row from the DOM, so the list updates with no rebuild/flash.
  function esDeleteDraft(id) {
    const all = esReadStore();
    const bag = all[esBagKey()] || { drafts: [] };
    bag.drafts = (bag.drafts || []).filter(d => d.id !== id);
    all[esBagKey()] = bag; ES.list = esRecent(bag.drafts);
    try { store.setItem(ES_KEY, JSON.stringify(all)); } catch (e) { /* in-memory fallback */ }
  }
  // Build the paragraph slots for a structure, preserving any text/point/feedback
  // from a previous structure by index (so changing the structure later never
  // silently drops a student's writing).
  // Changing the structure re-shapes the response around what is already in it.
  // Two things it must not do. It must not match positionally: growing a five part
  // response into a six part one shifts every index after the last body, so index
  // matching would carry the conclusion's prose into a body paragraph. And it must
  // not drop what a paragraph was planned to argue or the evidence chosen for it,
  // because adding a paragraph is not a decision to throw the others away.
  function esBuildParas(structureKey, prev) {
    const st = esStructureDef(structureKey);
    const old = prev || [];
    const bodies = old.filter(x => !esIsIntro(x) && !esIsConcl(x));
    const intro = old.find(esIsIntro) || null;
    const concl = old.find(esIsConcl) || null;
    let b = 0;
    return st.roles.map(role => {
      const stub = { role: role };
      const o = esIsIntro(stub) ? intro : esIsConcl(stub) ? concl : bodies[b++];
      return { role: role,
        point: o ? o.point || "" : "", text: o ? o.text || "" : "",
        feedback: o ? o.feedback || null : null, gradedText: o ? o.gradedText || null : null,
        mastered: o ? !!o.mastered : false,
        area: o ? o.area || "" : "", argumentId: o ? o.argumentId || null : null,
        ownArgument: o ? o.ownArgument || "" : "",
        evidenceIds: o ? (o.evidenceIds || []).slice() : [],
        setupDone: o ? !!o.setupDone : false,
        contextVersion: o ? Number(o.contextVersion) || 0 : 0,
        blocks: null, blocksFrom: null, step: 0 };
    });
  }
  function esId() { return "e" + (ES.list.length + 1) + "-" + (ES.draft ? "" : "") + Math.abs((esBagKey() + ES.list.length).split("").reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 7)).toString(36); }

  // ---- the suggest-never-substitute guard, enforced in code, not just prompt ----
  // Applied to EVERY text field, not only chips: nudges must read as questions and
  // stay short, and note/check are dropped if long enough to be a paste-ready
  // sentence or paragraph. Chips are WORD-LEVEL only. So the coach can never return
  // a substitution through any channel, however the model misbehaves.
  function esShortPhrase(s, maxWords) { return String(s || "").trim().split(/\s+/).filter(Boolean).length <= maxWords; }
  // A frame is connective tissue: blanks joined by structural words only. Keep this
  // list in sync with FRAME_WORDS in proxy/worker.js.
  const ES_FRAME_WORDS = new Set(("a an and as at because been be but by can could for from had has have how however " +
    "if in into is it its led leads mean means more most of on one only or over shows show shown since so such than " +
    "that the their then there therefore these this those through to was were what when which while who why will with " +
    "addresses affect affects allowed allows applies argues assess balance change changed compare demonstrates effect " +
    "evidence example explains front further gives helps illustrates impact improves increases indicates influence " +
    "instead judgement key later link linked makes matters method overall point produces reason reduces reveals " +
    "result results significant significance shows source suggests supported supports term therefore thus way ways " +
    "whereas whether although despite consider considered addressing meaning matter compared contrast").split(/\s+/));
  function esIsFrame(fix) {
    const w = String(fix || "").replace(/_{2,}/g, " ").toLowerCase().replace(/[^a-z ]/g, " ").split(/\s+/).filter(Boolean);
    return w.every(x => ES_FRAME_WORDS.has(x));
  }
  const ES_CATS = ["on_target", "signposting", "expression"];
  function esNormalizeCoach(raw, demoNote, role) {
    raw = raw || {};
    // missing: ABSENT slot keys only, validated against THIS paragraph's slot set,
    // deduped. The model returns keys; the app supplies all card text and frames,
    // so no content can leak through a missing-element card.
    const valid = new Set(slotsForRole(role).map(s => s.key));
    const seen = new Set();
    const missing = (Array.isArray(raw.missing) ? raw.missing : [])
      .map(m => String((m && m.slot) || m || "").trim())
      .filter(k => valid.has(k) && !seen.has(k) && seen.add(k))
      .slice(0, 6);
    // nudges are {text, category}; keep only short questions, default category on_target.
    const nudges = (Array.isArray(raw.nudges) ? raw.nudges : [])
      .map(n => (typeof n === "string" ? { text: n, category: "on_target" } : { text: String((n && n.text) || "").trim(), category: String((n && n.category) || "").trim() }))
      .filter(n => n.text && /\?\s*$/.test(n.text) && esShortPhrase(n.text, 40)) // must END as a question: no trailing answer
      .map(n => ({ text: n.text, category: ES_CATS.includes(n.category) ? n.category : "on_target" }))
      .slice(0, 4);
    const chips = (Array.isArray(raw.chips) ? raw.chips : [])
      .map(c => ({
        from: String((c && c.from) || "").trim(),
        options: (Array.isArray(c && c.options) ? c.options : []).map(o => String(o || "").trim()).filter(Boolean).slice(0, 4)
      }))
      .filter(c => c.from && esShortPhrase(c.from, 4) && c.options.length && c.options.every(o => esShortPhrase(o, 6)))
      .slice(0, 6);
    // lines: DIRECT per-sentence diagnosis + a CONTENT-FREE frame. Enforced client
    // side as well as in the worker, so an older or misbehaving worker can never put
    // a paste-ready sentence in front of the student. A frame must carry blanks and
    // its non-blank words must all be structural, never subject content.
    const lines = (Array.isArray(raw.lines) ? raw.lines : [])
      .map(l => ({
        quote: String((l && l.quote) || "").trim(),
        issue: String((l && l.issue) || "").trim(),
        fix: String((l && l.fix) || "").trim(),
        severity: String((l && l.severity) || "should").trim()
      }))
      .filter(l => l.issue && l.fix)                       // quote is only a locator hint
      .filter(l => esShortPhrase(l.quote, 14) && esShortPhrase(l.issue, 34) && esShortPhrase(l.fix, 26))
      .filter(l => /_{2,}/.test(l.fix) && esIsFrame(l.fix))
      .map(l => ({ ...l, severity: ["critical", "should", "optional"].includes(l.severity) ? l.severity : "should" }))
      .slice(0, 5);
    const note = String(raw.note || "").trim();
    const check = String(raw.check || "").trim();
    return {
      note: esShortPhrase(note, 60) ? note : "",       // a band comment, never a rewrite
      missing, nudges, chips, lines,
      check: (check && esShortPhrase(check, 30)) ? check : "",
      demoNote: demoNote || ""
    };
  }
  // The labelled demo fallback, made subject/model-aware: the "missing" slots are
  // derived from THIS paragraph's actual slot set (two middle slots) so the ordered
  // skeleton demo works for any scaffold, including Business Studies TEEEC/TDECC.
  // Note and chips come from the shared demo sample (generic, clearly labelled).
  function esDemoRaw(role) {
    const base = (window.ESSAY && window.ESSAY.coachSample) || {};
    const slots = slotsForRole(role);
    const mid = slots.slice(1, 3).map(s => ({ slot: s.key }));
    return Object.assign({}, base, { missing: mid.length ? mid : (base.missing || []) });
  }

  function esOpen(opts) {
    opts = opts || {};
    ES.demo = !!opts.demo;
    ES.subject = opts.subject || subjectForCode(currentClassCode());
    ES.code = opts.code || currentClassCode() || (ES.demo ? "11Anc1" : "");
    ES.form = null; ES.draft = null; ES.screen = "setup"; ES.pending = false;
    esLoadList();
    if (!document.getElementById("eshost")) { const h = document.createElement("div"); h.id = "eshost"; document.body.appendChild(h); }
    document.body.classList.add("es-lock");
    esRender();
  }
  function esClose() {
    const h = document.getElementById("eshost"); if (h) h.remove();
    document.body.classList.remove("es-lock");
  }

  function esRender() {
    const host = document.getElementById("eshost"); if (!host) return;
    // Preserve scroll across a full re-render so nothing flashes/jumps to the top.
    // (Frequent toggles use targeted updates instead and never reach here.)
    const prevScrim = host.querySelector(".es-scrim");
    const sy = prevScrim ? prevScrim.scrollTop : 0;
    const sc = esView(); // always available: the core runs on the student's own question
    if (!window.ESSAY || !window.ESSAY.slots) esRenderUnavailable(host);
    else if (ES.screen === "plan" && ES.draft) esRenderPlan(host, sc);
    else if (ES.screen === "review" && ES.draft) esRenderReview(host, sc);
    else if (ES.screen === "coached" && ES.draft) esRenderCoached(host, sc);
    else if (ES.screen === "quiz" && ES.draft) esRenderQuiz(host, sc);
    else if (ES.screen === "full" && ES.draft) esRenderFull(host, sc);
    else esRenderSetup(host, sc);
    const nowScrim = host.querySelector(".es-scrim"); if (nowScrim && sy) nowScrim.scrollTop = sy;
    // Defensive: no essay button should ever act as a form submit.
    host.querySelectorAll("button:not([type])").forEach(b => b.type = "button");
  }
  // Defensive only: the essay content file failed to load, so there is no slot model
  // or fallback content to run on. The core is otherwise subject-agnostic and always
  // available, so this is not a subject gate.
  function esRenderUnavailable(host) {
    host.innerHTML = `
    <div class="es-scrim"><div class="es-shell"><div class="es-wrap">
      <div class="es-top"><div class="es-brand">Marginal · essay practice</div><button class="es-x" id="esx" aria-label="Close">close</button></div>
      <div class="es-empty"><h2 class="es-h1">Not available right now</h2><p class="es-lead">Essay practice could not load. Please refresh, or check back shortly.</p></div>
    </div></div></div>`;
    const x = $("#esx"); if (x) x.onclick = esClose;
  }

  // The question text already opens with its command verb, so show the command as
  // a styled chip label and strip it from the body to avoid "Assess Assess ...".
  function esQuestionPreview(q) {
    const command = String((q && q.command) || "").trim();
    const text = String((q && q.text) || "").trim();
    return command && text.toLowerCase().startsWith(command.toLowerCase())
      ? text.slice(command.length).replace(/^[:\s-]+/, "")
      : text;
  }
  // ---------------------------------- SETUP ----------------------------------
  function esRenderSetup(host, sc) {
    if (!ES.form) ES.form = { question: "", topic: "", rubric: "", marks: 20, structure: sc.defaultStructure, paraModel: (sc.paraModels[0] || null), rubricOpen: false };
    const f = ES.form;
    // Optional subject picker: any login can load a subject's question bank and
    // paragraph scaffold, defaulting to the subject routed from their class code.
    const subjectList = esSubjectsList();
    const subjectPicker = subjectList.length > 1 ? `
      <div class="es-field">
        <label class="es-label" for="essubject">Subject</label>
        <select id="essubject" class="es-input es-select">${subjectList.map(s =>
          `<option value="${esc(s.key)}" ${s.key === ES.subject ? "selected" : ""}>${esc(s.label)}</option>`).join("")}</select>
      </div>` : "";
    // Paragraph-structure picker (e.g. Business Studies TEEEC vs TDECC), only when
    // the subject ships selectable scaffolds.
    const scObj = esSubjectContent(ES.subject);
    const modelPicker = sc.hasParaModels ? `
      <div class="es-field">
        <label class="es-label" for="esparamodel">Paragraph structure</label>
        <select id="esparamodel" class="es-input es-select">${sc.paraModels.map(m =>
          `<option value="${esc(m)}" ${m === f.paraModel ? "selected" : ""}>${esc(esParaModelLabel(m))}${(scObj.scaffolds[m] && scObj.scaffolds[m].expansion) ? " — " + esc(scObj.scaffolds[m].expansion) : ""}</option>`).join("")}</select>
        <p class="es-help">Each body paragraph will be scaffolded to this structure.</p>
      </div>` : "";
    // Suggested questions are subject-specific: show them ONLY when THIS subject ships
    // its own set. Otherwise hide the block cleanly (the student types their own).
    const qChips = sc.hasQuestions ? sc.questions.map(q =>
      `<button class="es-qchip" data-esq="${esc(q.id)}"><span class="es-qcmd">${esc(q.command)}</span> ${esc(esQuestionPreview(q))}</button>`).join("") : "";
    // Discrete, most-recent-first list (not one combined pill); each row deletes.
    const saved = esRecent(ES.list).slice(0, 12);
    const resume = saved.length ? `
      <div class="es-resume" data-resume>
        <p class="es-label">Your saved essays</p>
        <div class="es-reslist">${saved.map(d => {
          const mastered = (d.paras || []).filter(x => x.mastered).length, np = (d.paras || []).length;
          const q = (d.question || "").trim();
          return `<div class="es-resitem" data-resrow="${esc(d.id)}">
             <div class="es-resmain">
               ${d.topic ? `<span class="es-restoplabel">${esc(d.topic)}</span>` : ""}
               <span class="es-resq">${esc(q.slice(0, 110))}${q.length > 110 ? "…" : ""}</span>
               <span class="es-resmeta">${np ? mastered + "/" + np + " mastered" : "draft"}</span>
             </div>
             <div class="es-resactions">
               <button class="es-misstier" data-esresume="${esc(d.id)}">Resume</button>
               <button class="es-misstier ghost" data-estemplate="${esc(d.id)}">Use as template</button>
               <button class="es-resdel" data-esdelete="${esc(d.id)}" aria-label="Delete this saved essay" title="Delete this saved essay">remove</button>
             </div>
           </div>`;
        }).join("")}</div>
      </div>` : "";
    const structOpts = (window.ESSAY.structures || []).map(s =>
      `<option value="${esc(s.key)}" ${s.key === f.structure ? "selected" : ""}>${esc(s.label)}</option>`).join("");
    const bandsRef = (window.ESSAY.bands || []).map(b =>
      `<div class="es-band"><span class="es-bandr">${esc(b.range)}</span><span class="es-bandt">${esc(b.text)}</span></div>`).join("");
    host.innerHTML = `
    <div class="es-scrim"><div class="es-shell"><div class="es-wrap">
      <div class="es-top">
        <div class="es-brand">Marginal · essay practice ${sc.label ? `<span class="es-subj">${esc(sc.label)}${sc.stage ? " · " + esc(sc.stage) : ""}</span>` : ""}${ES.demo ? `<span class="es-demobadge">demo</span>` : ""}</div>
        <button class="es-x" id="esx" aria-label="Close">close</button>
      </div>
      <h1 class="es-h1">Set up your essay</h1>
      <p class="es-lead">Only the question is needed. Everything else is optional and you can change all of it later.</p>
      ${subjectPicker}
      ${resume}
      <div class="es-field">
        <label class="es-label" for="esq">Essay question <span class="es-req">needed</span></label>
        <textarea id="esq" class="es-input es-ta" rows="3" placeholder="Paste or type the question you are practising.">${esc(f.question)}</textarea>
        ${sc.hasQuestions ? `<p class="es-help">Or start from one of these practice questions:</p>
        <div class="es-qchips">${qChips}</div>` : ""}
      </div>
      <div class="es-field">
        <label class="es-label" for="estopic">Chosen topic or option <span class="es-opt">optional</span></label>
        <input id="estopic" class="es-input" value="${esc(f.topic)}" placeholder="e.g. Old Kingdom Egypt. This just tags the draft so you can tell your essays apart.">
      </div>
      <div class="es-field">
        <label class="es-label" for="esrubric">Marking rubric <span class="es-opt">optional</span></label>
        <p class="es-help">Paste a rubric or marking guide and the coach will aim its feedback at it. Skip it and the coach uses general HSC band expectations. Skipping costs you nothing.</p>
        <textarea id="esrubric" class="es-input es-ta" rows="3" placeholder="Paste your rubric or marking bands here, or leave blank.">${esc(f.rubric)}</textarea>
        <button class="es-linkbtn" id="esbandsref">${f.rubricOpen ? "Hide" : "Show"} the general band expectations the coach falls back to</button>
        <div class="es-bands" data-bands${f.rubricOpen ? "" : " hidden"}>${bandsRef}</div>
      </div>
      <div class="es-field">
        <label class="es-label" for="esmarks">Marks this question is worth</label>
        <p class="es-help">Used only when you submit a full attempt for marking, so the mark you get back means something.</p>
        <input id="esmarks" class="es-input es-marks" type="number" min="1" max="60" step="1" value="${esc(String(f.marks))}">
      </div>
      <div class="es-field">
        <label class="es-label" for="esstruct">Structure</label>
        <select id="esstruct" class="es-input es-select">${structOpts}</select>
      </div>
      ${modelPicker}
      <div class="es-actions">
        <button class="es-btn primary" id="esstart">Start practising</button>
        <span class="es-foothint">You will write one paragraph at a time with a coach, or you can switch to a full timed attempt.</span>
      </div>
    </div></div></div>`;
    $("#esx").onclick = esClose;
    const q = $("#esq"); q.oninput = () => {
      f.question = q.value;
      const picked = f.questionId && sc.questions.find(x => x.id === f.questionId);
      if (picked && picked.text.trim() !== q.value.trim()) f.questionId = null;
    };
    const tp = $("#estopic"); tp.oninput = () => { f.topic = tp.value; };
    const rb = $("#esrubric"); rb.oninput = () => { f.rubric = rb.value; };
    const mk = $("#esmarks"); if (mk) mk.oninput = () => { const n = Math.round(Number(mk.value)); f.marks = (n >= 1 && n <= 60) ? n : 20; };
    const stt = $("#esstruct"); stt.onchange = () => { f.structure = stt.value; };
    const subjSel = $("#essubject");
    if (subjSel) subjSel.onchange = () => {
      ES.subject = subjSel.value;
      const nv = esView();                       // new subject defaults
      f.structure = nv.defaultStructure;
      f.paraModel = nv.paraModels[0] || null;
      esLoadList();                              // saved essays are per subject
      esRender();
    };
    const pmSel = $("#esparamodel");
    if (pmSel) pmSel.onchange = () => { f.paraModel = pmSel.value; };
    $("#esbandsref").onclick = () => {
      f.rubricOpen = !f.rubricOpen;
      const bands = document.querySelector("[data-bands]"); if (bands) bands.hidden = !f.rubricOpen;
      $("#esbandsref").textContent = (f.rubricOpen ? "Hide" : "Show") + " the general band expectations the coach falls back to";
    };
    host.querySelectorAll("[data-esq]").forEach(b => b.onclick = () => {
      const qq = sc.questions.find(x => x.id === b.dataset.esq);
      // Remember the id: it carries this question's requirements, band expectations
      // and mark value into marking. Typing over the text clears it, because the
      // definition no longer describes the question being answered.
      if (qq) { f.question = qq.text; f.questionId = qq.id; if (!f.topic) f.topic = qq.topic || ""; if (qq.marks) f.marks = qq.marks; esRender(); $("#esq").focus(); }
    });
    host.querySelectorAll("[data-esresume]").forEach(b => b.onclick = () => {
      const d = ES.list.find(x => x.id === b.dataset.esresume);
      if (d) { ES.draft = d; ES.screen = d.mode === "full" ? "full" : "coached"; esResetCoachUI(); esResetQuiz(); esRender(); }
    });
    // Use as template: copy the question, structure and rubric into a NEW essay
    // (not the written text), prefilling setup so Start practising makes a fresh draft.
    host.querySelectorAll("[data-estemplate]").forEach(b => b.onclick = () => {
      const d = ES.list.find(x => x.id === b.dataset.estemplate);
      if (d) { ES.form = { question: d.question || "", topic: d.topic || "", rubric: d.rubric || "", structure: d.structure || sc.defaultStructure, paraModel: d.paraModel || (sc.paraModels[0] || null), rubricOpen: false }; esRender(); const el = $("#esq"); if (el) el.focus(); }
    });
    // Delete a saved essay: remove from localStorage + list, then drop just this
    // row from the DOM (no full re-render, no flash). Section goes if it empties.
    host.querySelectorAll("[data-esdelete]").forEach(b => b.onclick = () => {
      const id = b.dataset.esdelete;
      esDeleteDraft(id);
      const row = host.querySelector('[data-resrow="' + id + '"]'); if (row) row.remove();
      if (!ES.list.length) { const sec = host.querySelector("[data-resume]"); if (sec) sec.remove(); }
    });
    $("#esstart").onclick = () => {
      const question = (f.question || "").trim();
      if (!question) { toast("Add your essay question to start."); const el = $("#esq"); if (el) el.focus(); return; }
      ES.draft = {
        id: esId(), subject: ES.subject, code: ES.code,
        question, topic: (f.topic || "").trim(), rubric: (f.rubric || "").trim(),
        marks: (f.marks >= 1 && f.marks <= 60) ? f.marks : 20,
        questionId: f.questionId || null,
        command: commandOf(question),
        structure: f.structure, paraModel: f.paraModel || undefined,
        paras: esBuildParas(f.structure, null),
        mode: "coached", pos: 0, createdAt: new Date().toISOString()
      };
      esSaveDraft();
      // A question that ships authored pathways is planned as a whole before the
      // introduction is written. Anything else goes straight to the writing.
      ES.screen = esQuestionAreas().length ? "plan" : "coached";
      ES.form = null; esRender();
    };
  }

  // ---- decoding the question -------------------------------------------------
  function esDecodeOf(q) { return (q && q.decode && (q.decode.highlights || []).length) ? q.decode : null; }
  // The stem with its authored anchors made pressable. Anchors are matched as
  // strings and laid down in the order they appear, so a reworded stem cannot
  // silently shift a highlight onto the wrong words. Overlaps are dropped rather
  // than nested; the build already refuses an ambiguous anchor.
  function esDecodeStem(stem, hl) {
    const spans = [];
    hl.forEach((h, i) => {
      const at = String(stem).indexOf(h.anchor);
      if (at < 0) return;
      if (spans.some(sp => at < sp.end && at + h.anchor.length > sp.at)) return;
      spans.push({ at: at, end: at + h.anchor.length, i: i, kind: h.kind || "" });
    });
    spans.sort((a, b) => a.at - b.at);
    let out = "", cur = 0;
    spans.forEach(sp => {
      out += esc(stem.slice(cur, sp.at));
      out += `<button type="button" class="es-dec ${esc(sp.kind)}" data-esdecode="${sp.i}">${esc(stem.slice(sp.at, sp.end))}</button>`;
      cur = sp.end;
    });
    return out + esc(stem.slice(cur));
  }
  // What the response has to cover, read off `requirements`. Nothing here is a
  // second copy of the marking metadata: change the requirements and this moves.
  // What the question fixes is read off `requirements`, which is the authority.
  // Highlights only point at those areas; forgetting to highlight one would not
  // make it optional. What is SHOWN is a synthesis a student can act on, not the
  // marker's checklist rendered verbatim.
  function esRequiredAreas(q) {
    const r = (q && q.requirements) || {};
    if ((r.requiredAreas || []).length) return r.requiredAreas.map(a => a.label || a.id);
    return ((q.decode && q.decode.highlights) || []).filter(h => h.kind === "requiredArea").map(h => h.anchor);
  }
  function esDecodeCoverage(q) {
    const r = (q && q.requirements) || {};
    const dec = (q && q.decode) || {};
    const areas = esRequiredAreas(q);
    const cover = dec.cover || {};
    const chain = cover.forEach || (r.relationships || [])[0] || "";
    if (!areas.length && !chain) return "";
    const n = areas.length, word = ["", "one", "two", "three", "four", "five", "six"][n] || String(n);
    const offered = esQuestionAreas();
    if (!n) return `
      ${chain ? `<p class="es-decp"><b>For each thing you argue, show:</b><br>${esc(chain)}</p>` : ""}
      ${offered.length ? `<p class="es-decp"><b>Which to write about is your choice.</b> This question does not name its parts, so pick the ones you can argue best: ${offered.map(esc).join(" · ")}</p>` : ""}
      ${cover.consistency ? `<p class="es-decp">${esc(cover.consistency)}</p>` : ""}`;
    return `
      ${n ? `<p class="es-decp"><b>All ${word} areas:</b> ${areas.map(esc).join(" · ")}</p>` : ""}
      ${chain ? `<p class="es-decp"><b>For each one, show:</b><br>${esc(chain)}</p>` : ""}
      ${cover.consistency ? `<p class="es-decp">${esc(cover.consistency)}</p>` : ""}`;
  }
  // Every panel is rendered once and revealed by flipping `hidden`, so opening
  // the decoder never rebuilds the writing surface or takes the cursor.
  function esDecodeChips(q) {
    const dec = esDecodeOf(q); if (!dec) return "";
    const verb = (q.command || "the directive").trim();
    return `
      <div class="es-decrow">
        <button type="button" class="es-decchip" data-esdecopen="plain">Plain English</button>
        <button type="button" class="es-decchip" data-esdecopen="verb">What does ${esc(verb.toLowerCase())} mean?</button>
        <button type="button" class="es-decchip" data-esdecopen="cover">${esRequiredAreas(q).length ? "What must I cover?" : "What does my answer have to do?"}</button>
        <span class="es-dechint">or press any highlighted words above</span>
      </div>`;
  }
  // The panel is the part with height, so where it renders decides whether the
  // sentence being written moves. While writing it goes into the right rail,
  // which is otherwise nearly empty, and the composer never shifts. Everywhere
  // else it expands under the question, where there is nothing to displace.
  // The canonical decoder host. The chips live on the question stem and this is the
  // panel they open, so it must exist wherever the chips do, independently of which
  // support surface happens to be on screen. The writing screen renders it as a
  // stable child of the columns; every other screen renders it under the stem. One
  // host per screen, chosen by the screen, never by whatever container exists.
  function esDecodeHost(q) {
    const box = esDecodeBox(q);
    return `<div class="es-dechost${box ? "" : " empty"}" data-esdechost>${box}</div>`;
  }
  function esDecodeBox(q) {
    const dec = esDecodeOf(q); if (!dec) return "";
    const verb = (q.command || "the directive").trim();
    const panels = dec.highlights.map((h, i) => `
      <div class="es-decpanel" data-esdecpanel="${i}" hidden>
        <div class="es-dech">${esc(h.anchor)}<span class="es-deckind">${esc(h.label || (h.kind === "requiredArea" ? "must cover" : h.kind === "cause" ? "the cause in the question" : "what you need to do"))}</span></div>
        <p class="es-decp">${esc(h.note || "")}</p>
      </div>`).join("") + `
      <div class="es-decpanel" data-esdecpanel="plain" hidden>
        <div class="es-dech">In plain English</div>
        <p class="es-decp">${esc(dec.plainEnglish || "")}</p>
      </div>
      <div class="es-decpanel" data-esdecpanel="verb" hidden>
        <div class="es-dech">What ${esc(verb)} means</div>
        <p class="es-decp">${esc(dec.verbMeaning || "")}</p>
      </div>
      <div class="es-decpanel" data-esdecpanel="cover" hidden>
        <div class="es-dech">${esAreasRequired(q) ? "What you must cover" : "What your answer has to do"}</div>
        ${esDecodeCoverage(q)}
      </div>`;
    return `
      <div class="es-decbox" data-esdecbox hidden>
        ${panels}
        <button type="button" class="es-decx" data-esdecclose aria-label="Close">${esIcon("close")}</button>
      </div>`;
  }
  function esBindDecode() {
    const host = document.getElementById("eshost"); if (!host) return;
    const box = host.querySelector("[data-esdecbox]"); if (!box) return;
    const panels = Array.from(host.querySelectorAll("[data-esdecpanel]"));
    let openKey = null;
    const show = key => {
      // Pressing the same thing again closes it, so the decoder never becomes
      // something the student has to dismiss before they can carry on writing.
      const same = openKey === key;
      openKey = same ? null : key;
      panels.forEach(p => { p.hidden = same || String(p.dataset.esdecpanel) !== String(key); });
      box.hidden = same;
      const prog = host.querySelector("[data-esrestprogress]");
      if (prog) prog.hidden = !box.hidden;
      host.querySelectorAll("[data-esdecopen],[data-esdecode]").forEach(b => {
        const k = b.dataset.esdecopen != null ? b.dataset.esdecopen : b.dataset.esdecode;
        b.classList.toggle("on", !same && String(k) === String(key));
      });
    };
    host.querySelectorAll("[data-esdecopen]").forEach(b => b.onclick = () => show(b.dataset.esdecopen));
    host.querySelectorAll("[data-esdecode]").forEach(b => b.onclick = () => show(b.dataset.esdecode));
    const x = host.querySelector("[data-esdecclose]"); if (x) x.onclick = () => show(openKey);
  }

  // ---- shared header for the two writing screens (question + topic + switch) ----
  function esWritingHead(sc, modeLabel, switchLabel, switchTo, boxElsewhere) {
    // The question is the one thing on screen at every stage, so the decoder
    // lives on it rather than being a stage the student passes through once.
    const qdef = esQuestionDef();
    const qdec = esDecodeOf(qdef);
    return `
      <div class="es-top">
        <div class="es-brand">Marginal · essay practice ${sc.label ? `<span class="es-subj">${esc(sc.label)}</span>` : ""}${ES.demo ? `<span class="es-demobadge">demo</span>` : ""}</div>
        <div class="es-topbtns">
          <button class="es-linkbtn" id="esmodeswitch">${esc(switchLabel)}</button>
          <button class="es-x" id="esx" aria-label="Back to setup">setup</button>
        </div>
      </div>
      <div class="es-qbar">
        <div class="es-qbar-main">
          <div class="es-qbar-mode">${esc(modeLabel)}</div>
          <div class="es-qbar-q">${qdec ? esDecodeStem(ES.draft.question, qdec.highlights) : esc(ES.draft.question)}</div>
          ${qdec ? esDecodeChips(qdef) + (boxElsewhere ? "" : esDecodeHost(qdef)) : ""}
        </div>
        ${ES.draft.topic ? `<span class="es-restag">${esc(ES.draft.topic)}</span>` : ""}
      </div>`;
  }

  // ===========================================================================
  // THE SENTENCE COMPOSER (guided mode)
  //
  // The scaffold travels down the page with the cursor. One sentence is editable
  // at a time, its guide sits immediately beneath it, and an accepted sentence
  // becomes ordinary prose above. So the screen fills with the student's writing
  // rather than with controls, and the guidance is never somewhere else.
  //
  // NO MODEL CALL HAPPENS WHILE WRITING. Every rung of guidance is either the slot
  // job the subject already ships or an exemplar authored in the content JSON. The
  // one model call is the evaluation of the finished paragraph or response.
  //
  // paras[i].text stays the source of truth, so full attempt, marking and the
  // saved draft are untouched by any of this. blocks[] is the guided view of the
  // same text, rebuilt whenever the text changed somewhere else (no fork).
  // ===========================================================================

  // A BLOCK IS DURABLE FIRST-CLASS STATE, not a view of the text.
  //
  // A guided sentence is no longer just text. It carries the job it does, how far
  // the student escalated for help on it, which argument and evidence it rests on,
  // and the id marking points at when it says "rewrite this one". Rebuilding blocks
  // from the paragraph text on every change would throw all of that away the first
  // time somebody fixed a comma.
  //
  // So: blocks own the semantics, paras[i].text is DERIVED from them for marking,
  // export and the full-attempt view. The one hard case is a student editing the
  // text somewhere else, and that is reconciled rather than rebuilt: a sentence
  // whose words did not change keeps its identity.
  // Splitting on every full stop broke on decimals, initials and abbreviations,
  // which then handed the wrong text to a block and, through it, to marking.
  const ES_ABBR = /\b(?:mr|mrs|ms|dr|prof|st|no|vs|etc|eg|ie|approx|est|fig|inc|ltd|co|pty|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)$/i;
  function esSplitBlocks(text) {
    const t = String(text || "");
    const out = [];
    let start = 0;
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (c !== "." && c !== "!" && c !== "?") continue;
      if (c === ".") {
        if (/\d/.test(t[i - 1] || "") && /\d/.test(t[i + 1] || "")) continue;            // 3.5, 1,200.50
        if (/[A-Z]/.test(t[i - 1] || "") && !/[A-Za-z]/.test(t[i - 2] || "")) continue;   // J. Smith, U.S.
        const word = (t.slice(start, i).trim().split(/\s+/).pop() || "").replace(/\./g, "");
        if (ES_ABBR.test(word)) continue;                                                 // e.g. etc. Dr.
      }
      let j = i + 1;
      while (j < t.length && /[.!?"'\u201d\u2019)\]]/.test(t[j])) j++;
      const after = t.slice(j);
      if (after && !/^\s/.test(after)) continue;   // no break: still inside the sentence
      const chunk = t.slice(start, j).trim();
      if (chunk) out.push(chunk);
      start = j;
      i = j - 1;
    }
    const tail = t.slice(start).trim();
    if (tail) out.push(tail);
    return out;
  }
  // Ids are minted per draft and never reused, so marking can point at one for the
  // life of the essay even after sentences are moved, edited or deleted around it.
  function esNewBlock(d, text, slot, status) {
    d.seq = (Number(d.seq) || 0) + 1;
    return {
      id: "b" + d.seq,
      slot: slot || null,
      text: String(text || ""),
      status: status || "written",
      helpLevel: 0,
      argumentId: null,   // set in paragraph setup
      evidenceIds: [],    // set in paragraph setup
      sourceRefs: [],     // which stimulus material this line draws on
      contextVersion: (d && Number(d.contextVersion)) || 0,
      needsReview: false, // set when the paragraph's argument or evidence changed under it
    };
  }
  const esNormLine = t => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  // Align the blocks we hold against the sentences the text now contains, keeping
  // every block whose words are unchanged. Longest common subsequence, so an edit
  // in the middle does not renumber everything after it.
  function esReconcileBlocks(d, p) {
    const want = esSplitBlocks(p.text || "");
    const have = Array.isArray(p.blocks) ? p.blocks : [];
    const A = have.map(b => esNormLine(b.text)), B = want.map(esNormLine);
    const n = A.length, m = B.length;
    const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    const out = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (A[i] === B[j]) { have[i].text = want[j]; out.push(have[i]); i++; j++; }      // survives, identity kept
      else if (dp[i + 1][j] >= dp[i][j + 1]) i++;                                      // deleted elsewhere
      else { out.push(esNewBlock(d, want[j], null, "derived")); j++; }                 // typed elsewhere
    }
    while (j < m) { out.push(esNewBlock(d, want[j], null, "derived")); j++; }
    // AMBIGUITY IS RESOLVED BY LOSING METADATA, NEVER BY GUESSING. When the same
    // sentence appears more than once and the count changed, there is no way to know
    // which one survived, so the semantics are cleared from that group and only the
    // words are kept. A wrong slot or a wrong evidence id on a sentence is worse than
    // no slot at all, because marking would then point the student at the wrong line.
    const before = {}, after = {};
    A.forEach(k => { before[k] = (before[k] || 0) + 1; });
    out.forEach(b => { const k = esNormLine(b.text); after[k] = (after[k] || 0) + 1; });
    out.forEach(b => {
      const k = esNormLine(b.text);
      if (before[k] > 1 && before[k] !== after[k]) {
        b.slot = null; b.argumentId = null; b.evidenceIds = []; b.status = "derived"; b.ambiguous = true;
      }
    });
    return out;
  }
  function esBlocks(p) {
    const d = ES.draft;
    const text = String(p.text || "");
    if (!Array.isArray(p.blocks)) { p.blocks = esSplitBlocks(text).map(t => esNewBlock(d, t, null, "derived")); p.blocksFrom = text; esSaveDraft(); }
    else if (p.blocksFrom !== text) {
      // Reconciling is a real state change, not a rendering detail: the ids it keeps
      // are what marking will point at later, so it is written down straight away.
      p.blocks = esReconcileBlocks(d, p); p.blocksFrom = text; esSaveDraft();
    }
    return p.blocks;
  }
  // The blocks are the source; the text is what everything else reads.
  function esCommitBlocks(p) {
    p.text = p.blocks.map(b => String(b.text || "").trim()).filter(Boolean).join(" ");
    p.blocksFrom = p.text;
    if (p.feedback && (p.gradedText || "") !== p.text) { p.feedback = null; p.gradedText = null; }
  }
  // Changing the argument or the evidence does NOT silently relabel sentences that
  // were written to argue something else. Their provenance stays, they are flagged
  // for the student to look at again, and the student decides. Reconsidering the
  // paragraph is the correct consequence of changing its argument.
  // Does this sentence actually rest on that piece of evidence? Either it was
  // written at the evidence step while that item was selected, or it names it.
  function esBlockUsesEvidence(b, label) {
    if ((b.evidenceIds || []).indexOf(label) >= 0) return true;
    const words = String(label || "").toLowerCase().split(/[^a-z0-9']+/).filter(w => w.length > 4);
    if (!words.length) return false;
    const t = String(b.text || "").toLowerCase();
    return words.some(w => t.indexOf(w) >= 0);
  }
  // What a context change actually invalidates:
  //   a new ARGUMENT calls every written sentence into question, because they were
  //     all written to argue something else;
  //   REMOVING a piece of evidence questions only the sentences that rested on it;
  //   ADDING evidence, or choosing it for the first time, invalidates nothing.
  // Flagging more than that trains the student to ignore the flag.
  function esSetParagraphContext(p, argumentId, evidenceIds) {
    const beforeArg = p.argumentId || null;
    const beforeEv = (p.evidenceIds || []).slice();
    const sameArg = beforeArg === (argumentId || null);
    const sameEv = JSON.stringify(beforeEv) === JSON.stringify(evidenceIds || []);
    if (sameArg && sameEv) return 0;
    p.contextVersion = (Number(p.contextVersion) || 0) + 1;
    p.argumentId = argumentId || null;
    p.evidenceIds = evidenceIds || [];
    const written = esBlocks(p).filter(b => String(b.text || "").trim());
    let flagged = 0;
    const flag = (b, why) => { if (!b.needsReview) { b.needsReview = true; b.reviewReason = why; flagged++; } };
    if (!sameArg && beforeArg) written.forEach(b => flag(b, "argument"));   // a different argument
    if (!sameEv && beforeEv.length) {
      const removed = beforeEv.filter(l => (evidenceIds || []).indexOf(l) < 0);
      removed.forEach(l => written.forEach(b => { if (esBlockUsesEvidence(b, l)) flag(b, "evidence"); }));
    }
    esSaveDraft();
    return flagged;
  }
  function esClearReview(p, k) { const b = esBlocks(p)[k]; if (b) { b.needsReview = false; b.contextVersion = p.contextVersion || 0; esSaveDraft(); } }

  // Every block in the draft, flattened, for the marking payload.
  function esAllBlocks(d) {
    const out = [];
    d.paras.forEach((p, pi) => esBlocks(p).forEach(b => out.push({
      id: b.id, slot: b.slot || undefined, paragraph: pi + 1, role: p.role, text: b.text,
    })));
    return out;
  }
  // Which structural step the student is on. Held on the paragraph so moving away
  // and back returns them to the same place.
  function esStepIndex(p) {
    const steps = slotsForRole(p.role);
    let i = Number(p.step);
    if (!Number.isFinite(i) || i < 0) {
      // returning to a part-written paragraph: stand at the step after the last one written
      const done = esBlocks(p).length;
      i = Math.min(done, Math.max(0, steps.length - 1));
    }
    return Math.max(0, Math.min(i, Math.max(0, steps.length - 1)));
  }
  function esStepDef(p) { return slotsForRole(p.role)[esStepIndex(p)] || null; }

  // The guide for the active sentence. Composed from the step's job and whatever
  // the student has actually chosen, so it reads specifically without any of it
  // being authored per question.
  function esGuideFor(p, step) {
    if (!step) return { head: "Your sentence", job: "" };
    const bits = [];
    if (p.point) bits.push("your point is " + p.point.replace(/\.$/, ""));
    return { head: String(step.label || "").toUpperCase(), job: esSlotGuide(p, step), context: bits.join(", ") };
  }

  // ---- THE HELP LADDER (Phase D) ---------------------------------------------
  // Answers one question only: "I know what I want to say, but I cannot construct
  // this line." Not knowing the content is Understand, not knowing what to argue is
  // Ideas, not knowing what to use is Evidence. Keeping those apart is the point.
  //
  // Every rung is authored. Nothing here calls a model, and a rung that has not been
  // written simply does not appear rather than being filled with something generic.
  //
  //   L1 hint      prompt the thinking
  //   L2 needs     name the relationship that has to be established
  //   L3 frame     grammar supplied, the meaningful content left blank
  //   L4 starter   an opening the student finishes
  //   L5 example   a fully written sentence IN A DIFFERENT CONTEXT, with its pattern
  //
  // L3 and L5 are validated in code against their declared type, so safety is a
  // property of the data rather than a guess about its wording.
  const ES_PLACEHOLDER = /\[[^\]]+\]|_{3,}/g;
  // A scaffold frame supplies grammar and withholds meaning. The test is not whether
  // every word is "structural" (which wrongly rejected "uses"), it is whether the
  // question's own content has been left for the student to write.
  function esValidFrame(frame, p) {
    if (!frame || frame.type !== "scaffoldFrame") return null;
    const text = String(frame.text || "");
    const holes = text.match(ES_PLACEHOLDER) || [];
    if (holes.length < 2) return null;                       // one blank is a sentence with a gap
    const bare = text.replace(ES_PLACEHOLDER, " ").toLowerCase();
    const q = esQuestionDef();
    const loaded = ((q && q.requirements && q.requirements.concepts) || [])
      .concat((p.evidenceIds || []))
      .concat([esSubjectCaseStudy()].filter(Boolean));
    // the supplied words must not already carry the answer's subject matter
    const leaked = loaded.filter(term => {
      const t = String(term || "").toLowerCase().split(/[^a-z0-9']+/).filter(w => w.length > 4);
      return t.length && t.every(w => bare.indexOf(w) >= 0);
    });
    return leaked.length ? null : text;
  }
  function esSubjectCaseStudy() { const sc = esSubjectContent(ES.subject); return (sc && sc.caseStudy) || ""; }
  // A level 5 example is a fully written sentence, so the only thing that makes it
  // safe is that it is set somewhere else. It must declare its context, and it must
  // not mention the case study the student is writing about.
  function esValidExample(ex) {
    if (!ex || ex.type !== "differentContextExample") return null;
    if (!String(ex.context || "").trim()) return null;
    const cs = esSubjectCaseStudy();
    if (cs && String(ex.text || "").toLowerCase().indexOf(cs.toLowerCase()) >= 0) return null;
    return ex;
  }
  // A direction names the reasoning to make. It is the rung between "what this
  // part is for" and "here are some words", so it must talk TO the writer and
  // must never be a sentence that could be pasted in as the answer.
  const ES_IMPERATIVE = /^(say|show|name|explain|define|describe|start|make|point|establish|set|move|work|turn|give|trace|follow|decide|choose|avoid|do not|don't|keep|use|take|put|open|finish|land|connect|apply|state|treat|write|read|check)\b/i;
  function esValidDirection(dir) {
    if (!dir || dir.type !== "reasoningDirection") return null;
    const text = String(dir.text || "").trim();
    if (!text || text.length > 320) return null;
    if (!/\b(you|your)\b/i.test(text) && !ES_IMPERATIVE.test(text)) return null;   // it must address the writer
    const cs = esSubjectCaseStudy();
    if (cs && text.toLowerCase().indexOf(cs.toLowerCase()) >= 0) return null;        // never writes their own case for them
    return text;
  }
  function esAuthoredHelp(p, step) {
    const path = esPathway(p);
    const h = path && path.help && step && path.help[step.key];
    return h || null;
  }
  function esRungs(p, step) {
    if (!step) return [];
    const h = esAuthoredHelp(p, step) || {};
    const rungs = [];
    if (h.hint) rungs.push({ label: "Hint", text: h.hint, cta: "Still stuck" });
    if (h.needs) rungs.push({ label: "What this part has to do", text: h.needs, cta: "Point me in a direction" });
    // Rung three is the reasoning direction where one is authored, and a blank
    // structure where it is not. Both leave the thinking and the wording with the
    // student; the direction leaves more of it.
    const dir = esValidDirection(h.direction);
    const frame = esValidFrame(h.frame, p);
    if (dir) rungs.push({ label: "The direction to take", text: dir, kind: "direction", cta: "Give me a start" });
    else if (frame) rungs.push({ label: "A structure to fill in", text: frame, kind: "frame", cta: "Give me a start" });
    if (h.starter && h.starter.type === "sentenceStarter" && h.starter.text) {
      rungs.push({ label: "A start you finish", text: String(h.starter.text).replace(/\s*$/, "") + "…", kind: "starter", cta: "Show a worked example" });
    }
    const ex = esValidExample(h.example);
    if (ex) rungs.push({ label: "The same reasoning, somewhere else", text: ex.text, kind: "example", context: ex.context, pattern: ex.pattern || "" });
    // levels are the rungs that actually exist, so pressing help three times always
    // shows three rungs numbered one to three
    rungs.forEach((r, i) => { r.level = i + 1; });
    return rungs;
  }

  // Say what actually changed. Telling a student their argument changed when they
  // swapped a piece of evidence is a small lie that costs trust.
  function esReviewWhy(b) {
    if (b.needsReview && b.reviewReason === "evidence") return "rested on evidence you removed.";
    if (b.needsReview) return "written for your previous argument.";
    return "this sentence changed a lot.";
  }
  function esReviewBannerHTML(blocks) {
    const arg = blocks.filter(b => b.needsReview && b.reviewReason !== "evidence").length;
    const ev = blocks.filter(b => b.needsReview && b.reviewReason === "evidence").length;
    if (!arg && !ev) return "";
    const parts = [];
    if (arg) parts.push(`<b>Argument changed.</b> ${arg} sentence${arg === 1 ? " was" : "s were"} written for your previous argument.`);
    if (ev) parts.push(`<b>Evidence changed.</b> ${ev} sentence${ev === 1 ? "" : "s"} rested on evidence you removed.`);
    return `<div class="es-argchanged">${parts.join(" ")} Check each one, or say it still works.</div>`;
  }

  // The guide and ladder for a sentence being REOPENED. Same content, same rungs,
  // same rule: the help a sentence was written with is still there when the student
  // comes back to it, unless the paragraph's argument moved on underneath it.
  function esEditGuideHTML(p, b) {
    const step = slotsForRole(p.role).find(x => x.key === b.slot) || null;
    if (!step) return "";
    const g = esGuideFor(p, step);
    return `<div class="es-guide"><div class="es-guideh">${esc(g.head)}</div><div class="es-guidejob">${esc(g.job)}</div></div>`;
  }

  // ---- help level belongs to the BLOCK, and is reset when its context moves ----
  function esHelpKey(p, step) { return "h:" + ((step && step.key) || "-"); }
  function esHelpLevel(p, blockIdx) {
    const cv = Number(p.contextVersion) || 0;
    if (blockIdx != null) {
      const b = esBlocks(p)[blockIdx];
      if (!b) return 0;
      // help authored for the previous argument must not sit under a sentence that
      // now belongs to a different one
      if ((Number(b.helpContextVersion) || 0) !== cv) return 0;
      return Number(b.helpLevel) || 0;
    }
    p.help = p.help || {};
    const rec = p.help[esHelpKey(p, esStepDef(p))];
    if (!rec || (Number(rec.cv) || 0) !== cv) return 0;
    return Number(rec.n) || 0;
  }
  function esSetHelpLevel(p, blockIdx, n) {
    const cv = Number(p.contextVersion) || 0;
    if (blockIdx != null) {
      const b = esBlocks(p)[blockIdx];
      if (b) { b.helpLevel = n; b.helpContextVersion = cv; }
    } else {
      p.help = p.help || {};
      p.help[esHelpKey(p, esStepDef(p))] = { n: n, cv: cv };
    }
    esSaveDraft();
  }

  // Authored exemplars for a slot, from the subject's scaffold. Absent is fine.
  function esExemplarFor(key) {
    const scaf = esActiveScaffold();
    const ex = scaf && scaf.exemplars && scaf.exemplars[key];
    if (ex) return ex;
    const shared = window.ESSAY && window.ESSAY.slots && window.ESSAY.slots.exemplars;
    return (shared && shared[key]) || null;
  }

  // ===========================================================================
  // THE TOOLBELT (Phase B)
  //
  // Brings information to where the student is writing. It must never make them
  // leave, lose, shrink or relocate their writing, so: the composer keeps a
  // minimum usable width and the drawer overlays rather than squeezing it, and
  // closing returns the cursor to the exact character it was on.
  //
  // NO MODEL REQUEST HAPPENS HERE, EVER. Everything a tool shows comes from the
  // authored question JSON, the authored content layer and the verified evidence
  // bank. A tool with nothing authored behind it is disabled rather than filled.
  //
  // Help is deliberately NOT a tool. The toolbelt answers "I do not know the
  // content / what to argue / what to use / where I am / how to say it". The line
  // under the composer answers "I cannot write THIS sentence". Keeping those apart
  // is the whole mental model.
  // ===========================================================================
  const ES_TOOLS = [
    { key: "understand", label: "Learn",      icon: "book" },
    { key: "ideas",      label: "Arguments", icon: "bulb" },
    { key: "evidence",   label: "Evidence",   icon: "search" },
    { key: "structure",  label: "Structure",  icon: "blocks" },
    { key: "vocabulary", label: "Vocabulary", icon: "type" },
  ];
  // One inline SVG set, defined once. No icon font and no CDN: the app ships as a
  // single self-contained file.
  const ES_ICONS = {
    book: '<path d="M3 4.5A1.5 1.5 0 0 1 4.5 3H9a3 3 0 0 1 3 3v9a2.5 2.5 0 0 0-2.5-2.5H3z"/><path d="M21 4.5A1.5 1.5 0 0 0 19.5 3H15a3 3 0 0 0-3 3v9a2.5 2.5 0 0 1 2.5-2.5H21z"/>',
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.4.3.6.7.6 1.1V16h5.8v-1c0-.4.2-.8.6-1.1A6 6 0 0 0 12 3z"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.4-4.4"/>',
    blocks: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    type: '<path d="M4 7V5h16v2M12 5v14M9 19h6"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
  };
  function esIcon(name) {
    return '<svg class="es-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ES_ICONS[name] || "") + '</svg>';
  }

  // ---- resolving what each tool has to show, from authored content only -------
  // Which syllabus section this paragraph is about. The locked plan pick for this
  // paragraph first, then the paragraph's own point, then the role.
  // Everything the app knows about what this paragraph is about: the point the
  // student wrote, their locked plan picks, and the question itself.
  function esContextHay(p) {
    const d = ES.draft;
    return ((p.point || "") + " " + (p.role || "") + " " + ((esPlan().picks || []).join(" ")) + " " + ((d && d.question) || "")).toLowerCase();
  }
  // Resolution priority, highest first:
  //   1. the concept named by the chosen pathway
  //   2. the paragraph's own point and the question, scored against the dot points
  //   3. nothing, and the tool is disabled
  // Student prose is the FALLBACK, never the primary resolver, so a sentence that
  // happens to echo another syllabus concept cannot pull the drawer off target.
  function esSectionFor(p) {
    const b = busContent(); const key = busTopicKey();
    const topic = b && key && b.topics[key]; if (!topic) return null;
    const path = esPathway(p);
    if (path && path.concept) {
      const c = path.concept;
      const sec = (topic.sections || []).find(x => x.name === c.section);
      if (sec) return { topic: topic, section: sec, point: (sec.points || []).find(pt => String(pt.point || "").toLowerCase().indexOf(String(c.point || "").toLowerCase()) === 0) || null, authored: true };
    }
    const hay = esContextHay(p);
    // Score a section on its own name AND on its syllabus dot points, because what a
    // student writes ("e-marketing") matches the dot point far more often than the
    // section heading. No fallback to an arbitrary section: an unresolved section
    // means the tool is disabled, never filled with something that does not fit.
    const secs = topic.sections || [];
    let best = null, bestScore = 0;
    secs.forEach(sec => {
      const src = String(sec.name || "") + " " + (sec.points || []).map(x => x.point || "").join(" ");
      const words = src.toLowerCase().replace(/[^a-z\s-]/g, " ").split(/\s+/).filter(w => w.length > 4);
      const seen = {};
      let score = 0;
      words.forEach(w => { if (!seen[w] && hay.indexOf(w) >= 0) { seen[w] = 1; score++; } });
      const nameWords = String(sec.name || "").toLowerCase().split(/\s+/).filter(w => w.length > 3);
      score += 2 * nameWords.filter(w => hay.indexOf(w) >= 0).length;   // the heading counts double
      if (score > bestScore) { best = sec; bestScore = score; }
    });
    return best && bestScore > 0 ? { topic: topic, section: best } : null;
  }
  // Resolve to the DOT POINT the student is actually writing about, not merely to
  // the section it lives in. Showing the first point of a loosely matched section is
  // how a contextual tool turns back into a chapter: an e-marketing sentence must
  // not open on situational analysis. No matching point means the tool is disabled.
  function esBestPoint(p, hit) {
    if (hit.authored && hit.point) return hit.point;   // the pathway named it
    const hay = esContextHay(p);
    let best = null, bestScore = 0;
    (hit.section.points || []).forEach(pt => {
      if (!pt.what) return;
      const words = String(pt.point || "").toLowerCase().replace(/[^a-z\s-]/g, " ").split(/\s+/).filter(w => w.length > 4);
      const seen = {};
      let score = 0;
      words.forEach(w => { if (!seen[w] && hay.indexOf(w) >= 0) { seen[w] = 1; score++; } });
      if (score > bestScore) { best = pt; bestScore = score; }
    });
    return bestScore > 0 ? best : null;
  }
  // An authored concept resource, attached to the pathway the student chose. This
  // is the "I do not understand the content" layer: written for the concept rather
  // than scraped from the paragraph, and reachable without leaving the sentence.
  function esConceptFor(p) {
    const sc = esSubjectContent(ES.subject);
    const bank = (sc && sc.concepts) || null; if (!bank) return null;
    const path = esPathway(p);
    const key = path && path.concept && path.concept.key;
    return (key && bank[key]) || null;
  }
  // ===========================================================================
  // THE LEARNING CENTRE
  //
  // The drawer answers "remind me what this means while I am writing". It is
  // 330px beside the composer and it should stay that way. This answers the
  // other question, "I do not know this, teach me enough that I can continue",
  // and it needs room the drawer does not have.
  //
  // It mounts in its own host at the end of <body>, NOT inside #eshost. That is
  // not a stylistic choice: esSwapSide replaces a direct child of .es-cols on
  // every tool press, so anything of ours living in there would be destroyed
  // and rebound constantly. Outside #eshost the composer underneath cannot be
  // touched by us at all, which is what makes the D1 and D2 guarantees hold by
  // construction rather than by care.
  // ===========================================================================

  // The six objectives the Operations question is about, as the syllabus names
  // them. Used only to read authored plan lines, never to assert anything.
  const ES_OBJECTIVES = ["quality", "speed", "dependability", "flexibility", "customisation", "cost"];
  // The six performance objectives are the Operations vocabulary. A question whose
  // plan pairs a strategy with something else entirely, as the Marketing questions
  // do with the four service elements, authors its own list rather than having the
  // renderer guess what counts as an objective. Absent, Operations behaves as before.
  function esObjectiveWords(q) {
    const own = q && q.objectiveWords;
    return Array.isArray(own) && own.length ? own.map(x => String(x).toLowerCase()) : ES_OBJECTIVES;
  }

  // The other syllabus points in the same section: on the Operations question
  // that is exactly the list of strategy families, already authored.
  function eslSiblings(p) {
    const hit = esSectionFor(p); if (!hit) return [];
    const here = esBestPoint(p, hit);
    return (hit.section.points || []).filter(pt => pt !== here).map(pt => {
      const shape = esLearnShape(pt);
      return { point: pt, title: shape.title, lede: shape.lede || shape.floor, named: shape.named, parts: shape.parts };
    });
  }

  // An authored plan line reads "Technology to speed and cost". It names a
  // pairing the author is prepared to stand behind, so the pairing itself is
  // authored. What is NOT authored is the mechanism between the two, and that
  // is where a renderer starts inventing if it is allowed to.
  //
  // So this returns the pairing and, separately, whatever the strategy's own
  // text actually says about that objective, quoted whole and never summarised.
  // The inventory line is the case that proves why: the authored sentence
  // mentioning dependability says JIT DEPENDS ON a dependable supply chain, the
  // opposite direction to the one a keyword match would imply. Quoting the
  // sentence lets the student read the real direction. Paraphrasing it, or
  // drawing an arrow from it, would teach the reverse of what the author wrote.
  function eslLinks(p) {
    const q = esQuestionDef(); if (!q || !(q.plan || []).length) return [];
    const sibs = eslSiblings(p);
    const hit = esSectionFor(p);
    const all = hit ? (hit.section.points || []) : [];
    const chosen = esPathway(p);
    return q.plan.map(line => {
      const m = String(line).split(/\s+to\s+/i);
      if (m.length < 2) return null;
      const strategy = m[0].trim();
      const objectives = m[1].split(/\s*(?:,|and)\s*/).map(x => x.trim().toLowerCase())
        .filter(x => esObjectiveWords(q).indexOf(x) >= 0);
      if (!objectives.length) return null;
      const key = strategy.toLowerCase();
      const pt = all.find(x => String(x.point || "").toLowerCase().indexOf(key) === 0);
      const sib = sibs.find(x => x.title.toLowerCase() === key);
      const says = [], seen = [];
      if (pt) {
        const sentences = esLearnSentences(pt.what).concat(esLearnSentences(pt.why));
        objectives.forEach(o => {
          const stem = o === "customisation" ? "customis" : o === "dependability" ? "dependab" : o;
          const hitS = sentences.find(x => {
            const low = x.toLowerCase();
            if (low.indexOf(stem) < 0) return false;
            // A sentence saying the strategy DEPENDS ON the objective is evidence of
            // the opposite direction to the one the argument runs in. The inventory
            // line is the case in point: "JIT depends on reliable suppliers and a
            // dependable supply chain" would otherwise be quoted as though holding
            // stock produced dependability, teaching the relationship backwards.
            if (/\b(depends? on|relies on|relying on|requires)\b/.test(low)) return false;
            return seen.indexOf(x) < 0;
          });
          if (hitS) { seen.push(hitS); says.push({ objective: o, text: hitS }); }
        });
      }
      // The middle step is printed only when an author wrote one, and only on the
      // line the student's own argument runs along: three arguments share the line
      // "Target market to people" and each has a different mechanism, so showing one
      // against a line the student did not choose would attach it to the wrong claim.
      // Nothing is derived here. An unreviewed or none-required mechanism prints
      // nothing at all, and the chain stays the two-step pairing the plan authored.
      const isChosen = !!(chosen && objectives.indexOf(String(chosen.area || "").toLowerCase()) >= 0);
      const mech = (isChosen && chosen.mechanism && chosen.mechanism.state === "authored")
        ? String(chosen.mechanism.text || "").trim() : "";
      // "Target market" is the category, not the cause. The cause is a characteristic
      // OF that market, and on the line the student's own argument runs along the
      // authored characteristic is what they are actually learning. Authored per
      // pathway and never derived: no splitting of `short`, no phrase taken out of
      // `relationship`. Absent, the generic category label stands, which is still
      // true, just less use to someone who does not know the topic yet.
      const from = (isChosen && chosen.fromLabel) ? String(chosen.fromLabel).trim() : strategy;
      return { line: String(line), strategy: strategy, from: from, objectives: objectives,
        mechanism: mech, lede: sib ? sib.lede : "", says: says, point: pt || null };
    }).filter(Boolean);
  }

  // The objective rows, authored, from the point the question is about.
  function eslObjectives(p) {
    const hit = esSectionFor(p); if (!hit) return null;
    const pt = esBestPoint(p, hit); if (!pt) return null;
    const shape = esLearnShape(pt);
    return { title: shape.title, lede: shape.lede, parts: shape.parts, why: pt.why || "" };
  }

  function eslOpen() { return !!(ES.centre && ES.centre.open); }

  // The two sides of the question, named. An authored question says so itself; a
  // typed one is named from the syllabus section and the point it resolved to,
  // which is authored text either way. Never a placeholder: "the first idea" tells
  // a student nothing about what is behind the tab.
  function eslSides(p) {
    const q = esQuestionDef();
    const hit = esSectionFor(p);
    const pt = hit ? esBestPoint(p, hit) : null;
    const cap = t => { t = String(t || "").trim(); return t ? t.charAt(0).toUpperCase() + t.slice(1) : ""; };
    // An authored question names its own two sides. A typed one does not, and the
    // nearest syllabus section is NOT the other half of the student's question:
    // offering it as one turns "here is what your question means" into "here is
    // some nearby content", which is the thing this surface exists to stop doing.
    if (q && (q.term1 || q.term2)) return { first: q.term1 || "", second: q.term2 || "", known: true };
    return { first: "", second: cap(pt ? esLearnShape(pt).title : ""), known: false };
  }

  // What the directive asks for. Authored on three questions; where it is not, the
  // route does not exist rather than being filled with a general gloss of the verb.
  function eslDirective() {
    const q = esQuestionDef(); if (!q) return null;
    const dec = q.decode && q.decode.verbMeaning ? q.decode.verbMeaning : "";
    if (!dec) return null;
    return { command: String(q.command || "").trim(), meaning: dec };
  }

  // ---- Learn: render the shape the author already wrote --------------------
  //
  // Almost every Learn target is a syllabus point, not one of the six authored
  // concepts: only three pathways carry a concept key and all three name the same
  // one. So the fallback is the surface nearly every student meets, and it arrives
  // as a single block of prose, median 93 words and up to 320.
  //
  // The prose is not undifferentiated, though. Where an author wrote a set of named
  // parts they wrote them as "Quality is fitness for purpose...", one sentence per
  // part, and the point's own title often names the parts after a dash. That is a
  // structure the renderer can show rather than a structure it has to invent.
  //
  // The rule that keeps this honest: nothing is written here, nothing is paraphrased,
  // and no bare term is ever paired with generated prose. A sentence becomes a row
  // only when its opening words are a name the author themselves used, and the row
  // body is the rest of that sentence verbatim. When the prose does not carry a
  // shape, no shape is shown.

  // The forms an author uses to define something. Frozen deliberately: a looser test
  // starts turning ordinary sentences into rows and claiming they are definitions.
  const ES_DEFVERB = /^(?:is|are|means|refers to|covers|includes|involves|comes from|converts?|decides|measures|ensures|records|communicates|divides|accepts?|removes?|protects?|shows|attracts|builds|widens|manages|puts|sets|requires|both)\b/i;
  // Openings that are a back-reference rather than a name, so they can never be a label.
  const ES_ANAPHOR = /^(?:Second|First|Third|Then|Much|Most|In|On|At|By|Its|It|They|These|This|Both|Each|Some|Many)\b/;
  // Syllabus phrasing wrapped around the concept itself, stripped only for matching.
  const ES_ROLEPREFIX = /^(?:strategic role of|types of|objectives of|factors influencing|influence of|limitations of|ethical issues related to|overcoming|identifying|establishing|developing|interdependence with|role of)\s+/i;
  const ES_STOPWORD = /^(?:the|a|an|of|and|or|in|to|for|with|its|it|this|these|other|key)$/;

  function esLearnStem(w) {
    return String(w).toLowerCase().replace(/[^a-z]/g, "")
      .replace(/ies$/, "y").replace(/(ing|es|s)$/, "");
  }
  function esLearnKey(phrase) {
    return String(phrase).replace(ES_ROLEPREFIX, "").split(/\s+/)
      .map(w => w.replace(/[^A-Za-z]/g, "")).filter(w => w && !ES_STOPWORD.test(w.toLowerCase()))
      .map(esLearnStem).filter(Boolean);
  }
  function esLearnSentences(text) {
    return String(text || "").replace(/\s+/g, " ").trim()
      .split(/(?<=[.?!])\s+(?=[A-Z(])/).filter(Boolean);
  }
  // A sentence yields a candidate row when it opens on a short noun phrase followed
  // by one of the defining verbs. The label is the author's words; so is the body.
  function esLearnCandidate(sentence, maxTokens) {
    const words = sentence.split(" ");
    for (let k = 1; k <= Math.min(maxTokens, words.length - 1); k++) {
      const rest = words.slice(k).join(" ");
      if (!ES_DEFVERB.test(rest)) continue;
      let label = words.slice(0, k).join(" ");
      if (/[,;].*[^,;]$/.test(label)) return null;
      if (ES_ANAPHOR.test(label)) return null;
      label = label.replace(/^(?:The|A|An)\s+/, "").replace(/[,;]$/, "");
      if (!label) return null;
      return { label: label, meaning: rest, words: sentence.split(" ").length };
    }
    return null;
  }
  function esLearnWords(t) { return String(t || "").trim().split(/\s+/).filter(Boolean).length; }

  // Read a syllabus point's own prose for the shape its author gave it.
  function esLearnShape(pt) {
    const raw = String(pt.point || "");
    const split = raw.split(/\s+[-\u2013\u2014]\s+/);
    const head = (split[0] || "").trim();
    // The part of the title after the dash names the constituents. Today it is
    // deleted; it is the author's own enumeration and it is what stops a partial
    // set of rows from reading as the complete list.
    const named = split.slice(1).join(" - ").trim();
    const namedItems = named ? (named.indexOf(",") >= 0 ? named.split(/,\s*/) : [named])
      .map(x => x.trim()).filter(Boolean) : [];
    const sentences = esLearnSentences(pt.what);
    const headKey = esLearnKey(head).join(" ");
    const headItems = namedItems.length >= 2;

    // The opening line. It carries no heading anywhere it is rendered, because an
    // extracted sentence is not an authored definition and must not claim to be.
    let lede = "", used = -1;
    if (sentences.length) {
      const c0 = esLearnCandidate(sentences[0], 10);
      if (c0) {
        const lk = esLearnKey(c0.label), hk = esLearnKey(head);
        const sub = lk.length && lk.every(w => hk.indexOf(w) >= 0);
        const sup = hk.length && hk.every(w => lk.indexOf(w) >= 0);
        // When the title itself enumerates, a sentence that defines only one of the
        // items is that item's row, not the meaning of the whole point.
        const onlyOne = headItems && namedItems.some(it =>
          esLearnKey(it).join(" ") === lk.join(" "));
        if ((sub || sup) && !onlyOne && lk.length) { lede = sentences[0]; used = 0; }
      }
    }

    // The rows. A candidate is admitted only when its label is a name the author
    // used: an item from the title, one of the point's terms, or the point itself.
    const allowed = namedItems.concat(pt.terms || []).concat([head])
      .map(x => esLearnKey(x).join(" ")).filter(Boolean);
    const rows = [], rest = [];
    sentences.forEach((sent, i) => {
      if (i === used) return;
      const cand = esLearnCandidate(sent, 6);
      const key = cand ? esLearnKey(cand.label).join(" ") : "";
      const ok = key && allowed.some(a => a === key || a.endsWith(" " + key) || key.endsWith(" " + a));
      if (ok) rows.push(cand); else rest.push(sent);
    });
    // One row is not a decomposition. Put it back rather than show a list of one.
    if (rows.length < 2) {
      const back = rows.splice(0, rows.length).map(r => sentences.find(x => x.indexOf(r.label) === 0) || "");
      back.filter(Boolean).forEach(x => rest.push(x));
    }

    // Budget. The authored enumeration is never cut in half, so a title that names
    // six parts gets room for six; anything else stops at a readable handful.
    const suffixSet = headItems && rows.length >= 2 &&
      rows.every(r => namedItems.some(it => esLearnKey(it).join(" ") === esLearnKey(r.label).join(" ")));
    const maxRows = suffixSet ? 8 : 6, maxWords = suffixSet ? 130 : 90;
    const parts = []; let spent = 0;
    for (const r of rows) {
      if (parts.length >= maxRows) { rest.push(r.label + " " + r.meaning); continue; }
      if (parts.length >= 2 && spent + r.words > maxWords) { rest.push(r.label + " " + r.meaning); continue; }
      parts.push({ label: r.label, meaning: r.meaning }); spent += r.words;
    }

    // Nothing was found. Rather than leave a title and a link, open with the prose
    // itself and put the remainder behind the same control.
    let floor = "";
    if (!lede && !parts.length) {
      floor = sentences.slice(0, 2).join(" ");
      rest.length = 0; sentences.slice(2).forEach(x => rest.push(x));
    }
    const showNamed = namedItems.length >= 2 &&
      !namedItems.every(it => parts.some(pp => esLearnKey(pp.label).join(" ") === esLearnKey(it).join(" ")));
    // The opening sentence sometimes counts the parts ("there are four elements").
    // If the rows cannot show that many and the title carries no list to correct it,
    // a partial set would read as the whole set, so it goes behind the control.
    const claim = (lede.match(/\b(two|three|four|five|six|seven|eight)\b/i) || [])[1];
    const claimed = claim ? { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 }[claim.toLowerCase()] : 0;
    if (claimed && parts.length && parts.length !== claimed && !showNamed) {
      parts.splice(0, parts.length).forEach(pp => rest.push(pp.label + " " + pp.meaning));
    }
    return {
      title: head || String(pt.point || "").trim(),
      named: showNamed ? named : "",
      lede: lede, parts: parts, floor: floor, rest: rest,
    };
  }

  // The one thing in the data that genuinely ties a concept to the student's own
  // argument. Absent until an argument is chosen, and absent entirely on questions
  // with no authored pathways, where nothing generic stands in for it.
  function esLearnChain(p) {
    const path = esPathway(p);
    const w = path && path.whatToProve;
    return w ? String(w).split(/\s*\u2192\s*/).map(x => x.trim()).filter(Boolean) : [];
  }

  function esToolUnderstand(p) {
    const path = esPathway(p);
    const watch = [];
    if (path && path.commonMistake) watch.push({ label: "common mistake", text: path.commonMistake });
    const c = esConceptFor(p);
    if (c) {
      (c.confusions || []).forEach(x => watch.push({ label: "easy to get wrong", text: x }));
      return {
        kind: "concept", title: c.title, topic: c.syllabus || "", named: "",
        lede: c.oneLine || "", floor: "",
        // The defined terms are the parts of the concept, so they belong on the
        // surface rather than 381 words down inside Read more.
        parts: (c.terms || []).filter(t => t && t.meaning).map(t => ({ label: t.term, meaning: t.meaning })),
        chain: esLearnChain(p), watch: watch,
        rest: c.quick ? [c.quick] : [],
        readMore: c.readMore || [], example: c.example || "", related: c.related || [],
        why: "", exam: "",
      };
    }
    const hit = esSectionFor(p); if (!hit) return null;
    const pt = esBestPoint(p, hit); if (!pt) return null;
    const shape = esLearnShape(pt);
    return {
      kind: "point", title: shape.title,
      topic: hit.topic.label + " \u00b7 " + hit.section.name,
      named: shape.named, lede: shape.lede, floor: shape.floor, parts: shape.parts,
      chain: esLearnChain(p), watch: watch, rest: shape.rest,
      // The point's terms are bare strings with no authored meaning, so they are not
      // rendered here. Vocabulary already offers the same list, one click away.
      readMore: [], example: "", related: [], why: pt.why || "", exam: pt.exam || "",
    };
  }
  // Terms for the point being written, then the rest of the section behind them, so
  // the closest vocabulary comes first rather than an alphabetical glossary.
  function esToolVocabulary(p) {
    const hit = esSectionFor(p); if (!hit) return null;
    const pt = esBestPoint(p, hit);
    const terms = [];
    const add = t => { if (t && terms.indexOf(t) < 0) terms.push(t); };
    (pt ? (pt.terms || []) : []).forEach(add);
    (hit.section.points || []).forEach(x => (x.terms || []).forEach(add));
    return terms.length ? { title: pt ? String(pt.point).replace(/\s+[-\u2013\u2014]\s+.*$/, "").trim() : hit.section.name, terms: terms.slice(0, 16) } : null;
  }
  // "I do not know what I could argue". The pathways written for THIS part of the
  // question, each with what the argument actually means, plus whatever the student
  // has already chosen. Reading it never changes anything: choosing is a separate,
  // deliberate act through Change.
  function esToolIdeas(p) {
    if (esIsIntro(p) || esIsConcl(p)) {
      const rows = esPlanRows(ES.draft).filter(r => r.argument);
      return rows.length ? { kind: "plan", rows: rows } : null;
    }
    const opts = esPathwaysFor(p);
    if (opts.length) return { kind: "pathways", options: opts, chosenId: p.argumentId || "", own: p.ownArgument || "" };
    const legacy = esPlanOptions();
    if (legacy && legacy.length) return { kind: "legacy", options: legacy, chosen: (esPlan().picks || []), locked: !!esPlan().locked };
    return null;
  }
  function esToolEvidence(p) {
    const store = esEvidenceBank();
    const all = store.usable;
    if (!store.all.length) return null;
    if (!all.length) return { empty: true, withheld: store.withheld, selected: [], compatible: [], wider: [] };
    const path = esPathway(p);
    const notes = esPathEvidence(path);                       // label -> why it suits THIS argument
    const linked = notes.map(n => n.label);
    const hit = esSectionFor(p);
    // The pathway's own evidence first, then the rest of the section, then the bank.
    // The best few for this exact argument, not a generic list.
    const bySection = hit ? all.filter(e => e.section === hit.section.name) : [];
    const chosen = p.evidenceIds || [];
    const rank = e => (linked.indexOf(e.label) >= 0 ? 0 : bySection.indexOf(e) >= 0 ? 1 : 2);
    const rest = all.filter(e => chosen.indexOf(e.label) < 0).slice().sort((x, y) => rank(x) - rank(y));
    const best = rest.filter(e => rank(e) === 0);
    return {
      selected: all.filter(e => chosen.indexOf(e.label) >= 0).map(e => esEvidenceWith(e, notes)),
      compatible: (best.length ? best : rest.filter(e => rank(e) < 2)).map(e => esEvidenceWith(e, notes)),
      wider: rest.filter(e => rank(e) === 2).map(e => esEvidenceWith(e, notes)),
      narrowed: !!(best.length || bySection.length),
      forArgument: !!best.length,
      withheld: store.withheld,
    };
  }
  function esToolStructure(p) {
    const steps = slotsForRole(p.role), si = esStepIndex(p);
    return { role: p.role, steps: steps, at: si, current: steps[si] || null };
  }
  function esToolData(key, p) {
    if (key === "understand") return esToolUnderstand(p);
    if (key === "vocabulary") return esToolVocabulary(p);
    if (key === "ideas") return esToolIdeas(p);
    if (key === "evidence") return esToolEvidence(p);
    if (key === "structure") return esToolStructure(p);
    return null;
  }

  // ---- the drawer ------------------------------------------------------------
  function esToolbeltHTML(p) {
    return `<div class="es-belt" role="toolbar" aria-label="Writing support">` + ES_TOOLS.map(t => {
      const has = !!esToolData(t.key, p);
      const on = ES.ui.tool === t.key;
      // Nothing authored behind it means the tool is disabled, not filled with filler.
      return `<button type="button" class="es-belt-b ${on ? "on" : ""}" data-estool="${t.key}" ${has ? "" : "disabled title=\"Nothing has been written for this question yet\""}>${esIcon(t.icon)}<span>${esc(t.label)}</span></button>`;
    }).join("") + `</div>`;
  }
  const ES_TOOL_BOX = "marginal.tools.box";
  // Opens near the top right of the writing workspace, not flush to the viewport,
  // so it reads as belonging to the page rather than to the browser.
  function esToolBox() {
    if (ES.ui.toolBox) return ES.ui.toolBox;
    try { const v = JSON.parse(sessionStorage.getItem(ES_TOOL_BOX) || "null"); if (v && v.w) return v; } catch (e) { /* private mode */ }
    // No default height. An empty tool should be the size of "nothing here yet",
    // not a 700px column containing one sentence, so the window is content sized
    // until the student resizes it and it starts remembering their choice.
    const w = 470, h = null;
    const cols = document.querySelector(".es-cols");
    const r = cols ? cols.getBoundingClientRect() : null;
    const left = r ? Math.max(12, Math.min(window.innerWidth - w - 24, r.right - w + 40)) : Math.max(12, window.innerWidth - w - 60);
    // Below the paragraph head, not level with it. Opening level covered the row
    // holding View plan, notebook and read all, so the window swallowed clicks on
    // the page's own controls the moment it appeared.
    const top = r ? Math.max(12, r.top + 46) : 120;
    return { left: Math.round(left), top: Math.round(top), w: w, h: h };
  }
  function esDrawerHTML(p) {
    const key = ES.ui.tool; if (!key) return "";
    const tool = ES_TOOLS.find(t => t.key === key); if (!tool) return "";
    const d = esToolData(key, p);
    let body = "";
    if (!d) body = `<p class="es-drawer-none">Nothing has been written for this part of the question yet.</p>`;
    else if (key === "understand") {
      const para = x => `<p class="es-drawer-p">${esc(x)}</p>`;
      const block = (label, inner) => `<div class="es-drawer-block"><div class="es-drawer-sub">${esc(label)}</div>${inner}</div>`;
      // What a student cannot use before they know the concept: a warning about a
      // mistake they have not made yet, and the long prose. Both sit one press away.
      const watch = (d.watch || []).map(w => block(w.label, para(w.text))).join("");
      const overflow = (d.rest || []).map(para).join("");
      const more = (d.readMore || []).map(para).join("");
      const why = d.why ? para(d.why) : "";
      const exam = d.exam ? block("in the exam", para(d.exam)) : "";
      const conex = d.example ? block("a simple example", para(d.example)) : "";
      const rel = (d.related && d.related.length)
        ? `<p class="es-drawer-note">Sits next to: ${d.related.map(esc).join(", ")}.</p>` : "";
      const deep = watch + overflow + more + why + exam + conex + rel;
      body = `${d.topic ? `<div class="es-drawer-sub">${esc(d.topic)}</div>` : ""}
        <h4 class="es-drawer-h">${esc(d.title)}</h4>
        ${d.named ? `<p class="es-drawer-note">${esc(d.named)}</p>` : ""}
        ${d.lede ? `<p class="es-drawer-p es-learn-lede">${esc(d.lede)}</p>` : ""}
        ${d.floor ? para(d.floor) : ""}
        ${(d.parts && d.parts.length) ? `<dl class="es-gloss surface">${d.parts.map(x =>
          `<dt>${esc(x.label)}</dt><dd>${esc(x.meaning)}</dd>`).join("")}</dl>` : ""}
        ${(d.chain && d.chain.length) ? block("what you would need to show",
          `<ol class="es-chain">${d.chain.map((x, i) =>
            `<li class="es-chainstep" style="animation-delay:${i * 130}ms">${esc(x)}</li>`).join("")}</ol>`) : ""}
        ${deep ? `<button type="button" class="es-linkbtn" id="esmoreread">${ES.ui.readMore ? "Show less" : "Read more"}</button>
          <div class="es-drawer-more"${ES.ui.readMore ? "" : " hidden"}>${deep}</div>` : ""}`;
    } else if (key === "vocabulary") {
      body = `<h4 class="es-drawer-h">${esc(d.title)}</h4><p class="es-drawer-note">Terms that fit what you are writing now. You still choose which to use.</p>
        <div class="es-terms">${d.terms.map(t => `<span class="es-term">${esc(t)}</span>`).join("")}</div>`;
    } else if (key === "ideas") {
      if (d.kind === "plan") {
        body = `<h4 class="es-drawer-h">What your response argues</h4>
          <p class="es-drawer-note">The arguments you planned, in order. This section draws on them rather than adding a new one.</p>
          <button type="button" class="es-linkbtn" id="esrestplan">Open the plan</button>
          ${d.rows.map(r => `<div class="es-idea on"><b>${esc(r.role)}</b><span>${esc(r.argument)}</span></div>`).join("")}`;
      } else if (d.kind === "pathways") {
        body = `<h4 class="es-drawer-h">What you could argue here</h4>
          <p class="es-drawer-note">Different defensible relationships, not a list to work through. Your own is just as valid, and reading this changes nothing.</p>
          ${d.own ? `<div class="es-idea on"><b>your own argument</b><span>${esc(d.own)}</span></div>` : ""}
          ${d.options.map(o => `<div class="es-idea ${d.chosenId === o.id ? "on" : ""}">
            <b>${esc(o.relationship)}</b>${o.meaning ? `<span>${esc(o.meaning)}</span>` : ""}
            ${d.chosenId === o.id ? `<span class="es-ideatag">this is the one you chose</span>` : ""}</div>`).join("")}
          <p class="es-drawer-note">To argue a different one, close this and use Change beside your argument.</p>`;
      } else {
        body = `<h4 class="es-drawer-h">What you could argue</h4>
          <p class="es-drawer-note">Options, not a list to work through. Your own is just as valid.</p>
          ${d.options.map(o => `<div class="es-idea ${d.chosen.indexOf(o) >= 0 ? "on" : ""}">${esc(o)}</div>`).join("")}`;
      }
    } else if (key === "evidence") {
      // The card gives the fact and, behind a press, what it could be used for.
      // It led with the use before, which read as instructions for assembling the
      // sentence rather than material to think with. Guided composition means the
      // student still decides what the fact proves.
      //
      // One status line, never two. An item only reaches a student with both a
      // source and a checked date, so everything here is published; `verify` means
      // the NUMBER may have moved since. Saying "verified" and "check it yourself"
      // in the same breath told the student two different things at once.
      const row = e => `<div class="es-ev">
        <div class="es-evh">${esc(e.label)}</div>
        <p class="es-drawer-p">${esc(e.fact)}</p>
        ${(e.supports && e.supports.length) ? `<p class="es-evsupports">Could support: ${e.supports.map(x => `<span class="es-evtag">${esc(x)}</span>`).join(" ")}</p>` : ""}
        ${e.why ? `<p class="es-evwhy"><b>For this argument:</b> ${esc(e.why)}</p>` : ""}
        ${e.use ? `<details class="es-evwhy2"><summary>Why could this matter?</summary><p class="es-drawer-note">${esc(e.use)}</p></details>` : ""}
        ${e.limits ? `<p class="es-evlimit">${esc(e.limits)}</p>` : ""}
        <p class="es-evsrc">${e.verify
          ? `<span class="es-evstatus dated">Check the current figure before you use it</span>`
          : `<span class="es-evstatus ok">Checked case study fact</span>`}
          ${e.source ? `<span class="es-evsrct">${esc(e.source)}</span>` : ""}</p>
      </div>`;
      // What the tool says depends on where the student is, because "no evidence
      // here" and "evidence does not belong here" are different facts and only one
      // of them is a gap. Our own essay model puts evidence in the body.
      if (esIsIntro(p) || esIsConcl(p)) {
        const intro = esIsIntro(p);
        body = `<p class="es-drawer-p">${intro
          ? "Evidence is usually not needed in your introduction. Its job is to state the line of argument and signpost the paragraphs that follow."
          : "New evidence normally should not appear in your conclusion. It weighs what your body paragraphs already established."}</p>
          <p class="es-drawer-note">${intro
            ? "Use evidence in your body paragraphs, where each argument needs support."
            : "If a fact matters enough to introduce here, it belongs in the paragraph that argues for it."}</p>
          <button type="button" class="es-linkbtn" id="esevall">${ES.ui.evAll ? "Hide the topic evidence" : "Browse evidence anyway"}</button>
          <div class="es-drawer-more"${ES.ui.evAll ? "" : " hidden"}>${
            (d.wider && d.wider.length) ? d.wider.map(row).join("")
              : (d.compatible && d.compatible.length) ? d.compatible.map(row).join("")
              : `<p class="es-drawer-none">No verified evidence is available for this topic yet.</p>`}</div>`;
      } else if (!esPathway(p)) {
        // A body paragraph with no argument chosen. Saying "evidence that fits this
        // argument" here names a relationship to something that does not exist yet,
        // and saying "nothing has been linked to this argument" in the same panel
        // contradicts it. Both were true of the old copy at once.
        //
        // Two different reasons the argument can be absent, and only one is the
        // student's to act on: this question may have no authored arguments at all,
        // in which case telling them to choose one sends them looking for a control
        // that is not there.
        const q2 = esQuestionDef();
        const choosable = !!((q2 && q2.pathways) || []).length;
        const pool = (d.wider && d.wider.length) ? d.wider : (d.compatible || []);
        body = `<p class="es-drawer-p">${choosable
          ? "Choose what this paragraph argues first. Once you choose an argument, Evidence can show material that may support it."
          : "This paragraph does not have an argument recorded yet. Evidence below is everything the topic holds, in no particular order."}</p>
          ${pool.length ? `<button type="button" class="es-linkbtn" id="esevall">${ES.ui.evAll ? "Hide topic evidence" : "Browse topic evidence anyway"}</button>
          <div class="es-drawer-more"${ES.ui.evAll ? "" : " hidden"}>
            <p class="es-drawer-sub">Topic evidence, not matched to your argument yet</p>
            ${pool.map(row).join("")}</div>`
          : `<p class="es-drawer-none">No verified evidence is available for this topic yet.</p>`}`;
      } else if (d.empty) {
        // How many records are waiting on a checked source is authoring state. It
        // tells the student nothing they can act on and says the product is
        // unfinished, which is not their problem to carry. Absence is absence.
        body = `<p class="es-drawer-none">No verified evidence is available for this argument yet.</p>
          <p class="es-drawer-note">You can keep writing and use evidence you already know.</p>`;
      } else
      // "Fits this argument" is a claim about the content, so it is only made where
      // the content makes it. Where nothing is linked, the heading says what these
      // items actually are: evidence from the topic, offered without a match.
      body = `${d.selected.length ? `<h4 class="es-drawer-h">Your evidence</h4>${d.selected.map(row).join("")}` : ""}
        <h4 class="es-drawer-h">${d.forArgument
          ? (d.selected.length ? "Other evidence linked to this argument" : "Evidence linked to this argument")
          : "Topic evidence, not matched to your argument"}</h4>
        ${d.compatible.length ? d.compatible.map(row).join("") : `<p class="es-drawer-none">No further evidence has been authored for this argument.</p>`}
        ${d.forArgument ? "" : `<p class="es-drawer-note">Nothing has been linked to this argument yet, so these are simply what the topic holds.</p>`}
        ${(d.wider && d.wider.length) ? `<button type="button" class="es-linkbtn" id="esevall">${ES.ui.evAll ? "Show less" : "Browse all evidence for this topic"}</button>
          <div class="es-drawer-more"${ES.ui.evAll ? "" : " hidden"}>${d.wider.map(row).join("")}</div>` : ""}
        <p class="es-drawer-note">Evidence is supplied. What it proves is still yours to explain.</p>`;
    } else if (key === "structure") {
      body = `<h4 class="es-drawer-h">${esc(d.role)}</h4>
        <button type="button" class="es-linkbtn" id="esrestplan">Open the plan</button>
        ${d.current ? `<p class="es-drawer-p"><b>Right now:</b> ${esc(d.current.job)}</p>` : ""}
        <ol class="es-struct">${d.steps.map((st, i) => `<li class="${i < d.at ? "done" : i === d.at ? "now" : ""}"><b>${esc(st.label)}</b><span>${esc(st.job)}</span></li>`).join("")}</ol>`;
    }
    // One sheet, four tools. Switching swaps what is inside it rather than opening
    // a second panel, and the context line says which paragraph and argument the
    // contents are answering for, since "evidence" alone does not say for what.
    const path = esPathway(p);
    const ctx = [p.role, path && path.short ? path.short : (p.point || "")].filter(Boolean).join(" \u00b7 ");
    const box = esToolBox();
    // A floating window, opened near the work rather than clamped to the edge of
    // the browser. Draggable, resizable, bounded, and remembered for the session,
    // like the notebook, because the two are peers and behave alike.
    return `<aside class="es-drawer" role="dialog" aria-label="Writing tools"
      style="left:${box.left}px;top:${box.top}px;width:${box.w}px${box.h ? `;height:${box.h}px` : ""}">
      <div class="es-drawer-top">${esIcon(tool.icon)}<span class="es-drawer-title">${esc(tool.label)}</span>
        <button type="button" class="es-nbact" data-estoolhome title="Put the window back where it opens">reset position</button>
        <button type="button" class="es-drawer-x" id="esdrawerx" aria-label="Close and return to your sentence">${esIcon("close")}</button></div>
      ${ctx ? `<div class="es-drawer-ctx">${esc(ctx)}</div>` : ""}
      <div class="es-drawer-tabs">${ES_TOOLS.filter(t => t.key !== "understand").map(t => `<button type="button" class="es-drawer-tab ${t.key === key ? "on" : ""}" data-estool="${esc(t.key)}">${esc(t.label)}</button>`).join("")}</div>
      ${key === "understand" && d ? `<div class="es-drawer-open"><button type="button" class="es-linkbtn" id="eslopen">Open learning centre ↗</button></div>` : ""}
      <div class="es-drawer-body">${body}</div>
      <div class="es-drawer-foot">Close to go straight back to the word you were on. <kbd>Esc</kbd></div>
    </aside>`;
  }
  // Opening a tool CAPTURES where the student was; closing puts them back exactly
  // there, cursor included. Returning to the sentence is good; returning to the
  // character is what lets them keep typing without thinking about it.
  function esCaptureContext(p) {
    const line = document.getElementById("esline");
    const scrim = document.querySelector(".es-scrim");
    ES.ui.ctx = {
      paragraph: ES.draft ? ES.draft.pos : 0,
      blockId: null,
      slot: (esStepDef(p) || {}).key || null,
      argumentId: p.argumentId || null,
      evidenceIds: (p.evidenceIds || []).slice(),
      text: line ? line.value : "",
      selStart: line ? line.selectionStart : 0,
      selEnd: line ? line.selectionEnd : 0,
      scroll: scrim ? scrim.scrollTop : 0,
    };
  }
  function esRestoreContext() {
    const c = ES.ui.ctx; if (!c) return;
    const line = document.getElementById("esline");
    if (line) {
      if (typeof c.text === "string" && line.value !== c.text) line.value = c.text;
      line.focus();
      try { line.setSelectionRange(c.selStart, c.selEnd); } catch (e) { /* older browsers */ }
    }
    const scrim = document.querySelector(".es-scrim");
    if (scrim && c.scroll) scrim.scrollTop = c.scroll;
  }
  function esBindToolbelt(p) {
    const host = document.getElementById("eshost"); if (!host) return;
    host.querySelectorAll("[data-estool]").forEach(b => b.onclick = () => {
      const key = b.dataset.estool;
      // Learn opens the Learning Centre. It is teaching, not a writing tool, and
      // giving it a tab in the tool window put two different classes of activity
      // behind one control set.
      if (key === "understand") {
        ES.centre = ES.centre || { route: "choose", dock: "right" };
        ES.centre.open = true;
        ES.ui.tool = null; ES.ui.contextView = null; esRenderKeepingPlace(p);
        eslMount(p); return;
      }
      if (ES.ui.tool === key) { ES.ui.tool = null; esRenderKeepingPlace(p); esFocusComposer(); return; }
      esCaptureContext(p);
      ES.ui.tool = key; ES.ui.readMore = false; ES.ui.contextView = null;
      ES.ui.toolFrom = b.id || null;
      esRenderKeepingPlace(p);
    });
    const x = host.querySelector("#esdrawerx");
    if (x) x.onclick = () => { ES.ui.tool = null; esRenderKeepingPlace(p); esFocusComposer(); };
    // A temporary surface closes the ways every temporary surface closes. Bound
    // while open and dropped on close, so nothing accumulates across renders.
    const sheet = host.querySelector(".es-drawer");
    if (sheet) {
      const head = sheet.querySelector(".es-drawer-top");
      if (head) head.onmousedown = e => {
        if (e.target.closest("button")) return;
        e.preventDefault();
        const r = sheet.getBoundingClientRect();
        const dx = e.clientX - r.left, dy = e.clientY - r.top;
        const move = ev => {
          const w = sheet.offsetWidth, h = sheet.offsetHeight;
          const left = Math.max(6, Math.min(window.innerWidth - w - 6, ev.clientX - dx));
          const top = Math.max(6, Math.min(window.innerHeight - h - 6, ev.clientY - dy));
          sheet.style.left = left + "px"; sheet.style.top = top + "px";
          ES.ui.toolBox = { left: left, top: top, w: w, h: h };
          try { sessionStorage.setItem(ES_TOOL_BOX, JSON.stringify(ES.ui.toolBox)); } catch (e2) { /* private mode */ }
        };
        const up = () => { document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); };
        document.addEventListener("mousemove", move); document.addEventListener("mouseup", up);
      };
      if (window.ResizeObserver) {
        const ro = new ResizeObserver(() => {
          // Fires while the window is being torn down too, where the rect is 0x0 at
          // 0,0. Recording that put the window in the top left corner at its
          // minimum size the next time it was opened, having "remembered" a
          // geometry the student never chose.
          if (!sheet.isConnected) return;
          const r2 = sheet.getBoundingClientRect();
          if (!r2.width || !r2.height) return;
          ES.ui.toolBox = { left: Math.round(r2.left), top: Math.round(r2.top), w: Math.round(sheet.offsetWidth), h: Math.round(sheet.offsetHeight) };
          try { sessionStorage.setItem(ES_TOOL_BOX, JSON.stringify(ES.ui.toolBox)); } catch (e2) { /* private mode */ }
        });
        ro.observe(sheet);
      }
      const home = sheet.querySelector("[data-estoolhome]");
      if (home) home.onclick = () => {
        ES.ui.toolBox = null; try { sessionStorage.removeItem(ES_TOOL_BOX); } catch (e2) { /* private mode */ }
        esRenderKeepingPlace(p);
      };
      const shut = () => {
        document.removeEventListener("mousedown", away, true);
        document.removeEventListener("keydown", key2, true);
        ES.ui.tool = null; esRenderKeepingPlace(p); esFocusComposer();
      };
      const away = e => {
        if (sheet.contains(e.target)) return;
        // The toolbelt owns opening, so a press there is a switch, not an outside
        // click, and the notebook floats over everything without dismissing it.
        // Peers, not outsides. The toolbelt owns opening this sheet, so a press
        // there is a switch. The notebook is a floating surface of its own and is
        // meant to be usable beside a tool, so neither it nor the control that
        // opens it dismisses this one.
        if (e.target.closest && (e.target.closest("[data-estool]") || e.target.closest("#esnbhost")
          || e.target.closest("[data-esnbtoggle]"))) return;
        shut();
      };
      const key2 = e => { if (e.key === "Escape") { e.preventDefault(); shut(); } };
      document.addEventListener("mousedown", away, true);
      document.addEventListener("keydown", key2, true);
    }
    const ea = host.querySelector("#esevall");
    if (ea) ea.onclick = () => { ES.ui.evAll = !ES.ui.evAll; esRenderKeepingPlace(p); };
    const mr = host.querySelector("#esmoreread");
    if (mr) mr.onclick = () => { ES.ui.readMore = !ES.ui.readMore; esRenderKeepingPlace(p); };
  }
  // Refresh only the toolbelt, in place. Used when the paragraph's context changes
  // under it, so nothing else on screen moves and no focus is stolen.
  function esRefreshBelt(p) {
    const host = document.getElementById("eshost"); if (!host) return;
    const belt = host.querySelector(".es-belt"); if (!belt) return;
    const fresh = document.createElement("div");
    fresh.innerHTML = esToolbeltHTML(p);
    const next = fresh.firstElementChild; if (!next) return;
    belt.replaceWith(next);
    next.querySelectorAll("button:not([type])").forEach(b => b.type = "button");
    esBindToolbelt(p);
  }
  // Everything a tool toggle actually changes lives in ONE column: the drawer
  // replaces the rest panel and the belt marks which tool is lit. Rebuilding the
  // whole workspace to express that cost the student more than it looked like.
  // The textarea was destroyed and its value written back with `.value =`, which
  // never enters the undo stack, so opening a tool mid-sentence silently ended
  // the student's ability to undo. The card also re-ran its entry animation, so
  // the composer sat at opacity 0 for a moment and the page showed through it.
  //
  // Bound handlers read ES.ui at click time, so the belt only needs its lit class
  // updating, not replacing. Nothing outside this column is touched, which is why
  // no capture-and-restore is needed on this path: the caret was never disturbed.
  // The drawer opens below the question and the toolbelt, so a viewport-relative
  // ceiling alone can still push its footer and close control off a short screen,
  // leaving the student to scroll the whole page to reach them. Cap it at the room
  // it actually has instead. Only a ceiling is set, so a short entry keeps its own
  // height and gains no empty space and no scrollbar.
  function esFitDrawer() {
    const d = document.querySelector(".es-drawer"); if (!d) return;
    // Below the three-column width the drawer is a fixed overlay already bounded
    // by top and bottom, so it needs no measured cap.
    if (getComputedStyle(d).position === "fixed") { d.style.removeProperty("max-height"); return; }
    const top = d.getBoundingClientRect().top;
    const room = window.innerHeight - top - 16;
    d.style.maxHeight = Math.round(Math.max(220, room)) + "px";
  }
  // ---- the centre's own surface ---------------------------------------------
  function eslCardHTML(id, title, body, on) {
    return `<button type="button" class="esl-card ${on ? "on" : ""}" data-eslroute="${esc(id)}">
      <span class="esl-cardt">${esc(title)}</span>
      ${body ? `<span class="esl-cardb">${esc(body)}</span>` : ""}</button>`;
  }
  function eslBodyHTML(p) {
    const q = esQuestionDef() || {};
    const route = (ES.centre && ES.centre.route) || "choose";
    const sides = eslSides(p), t1 = sides.first, t2 = sides.second;
    if (route === "strategies") {
      const sibs = eslSiblings(p);
      if (!sibs.length) return `<p class="esl-none">Nothing has been written for the other parts of this topic yet.</p>`;
      return `<p class="esl-lede">${esc(t1)} are the things a business can actually change. These are the ones this topic covers.</p>
        <div class="esl-grid">${sibs.map(x => {
          // A tile with a lesson behind it is a way in. One without is still a
          // definition, and says nothing about being unfinished.
          const L = esLesson(x.title);
          const inner = `<div class="esl-tilet">${esc(x.title)}</div>
            ${L ? `<p class="esl-tileb">${esc(L.glance)}</p><span class="esl-tilego">Learn this \u2192</span>`
                : `${x.lede ? `<p class="esl-tileb">${esc(x.lede)}</p>` : ""}
                   ${x.named ? `<p class="esl-tilen">${esc(x.named)}</p>` : ""}`}`;
          return L ? `<button type="button" class="esl-tile can" data-esllesson="${esc(x.title)}">${inner}</button>`
                   : `<div class="esl-tile">${inner}</div>`;
        }).join("")}</div>`;
    }
    if (route === "objectives") {
      const o = eslObjectives(p);
      if (!o) return `<p class="esl-none">Nothing has been written for this part of the question yet.</p>`;
      return `${o.lede ? `<p class="esl-lede">${esc(o.lede)}</p>` : ""}
        <div class="esl-grid six">${o.parts.map(x => `<div class="esl-tile">
          <div class="esl-tilet">${esc(x.label)}</div>
          <p class="esl-tileb">${esc(x.meaning)}</p></div>`).join("")}</div>
        ${o.why ? `<div class="esl-sec"><div class="esl-sech">They pull against each other</div>
          <p class="esl-p">${esc(o.why)}</p></div>` : ""}`;
    }
    if (route === "directive") {
      const d = eslDirective();
      if (!d) return "";
      return `<p class="esl-lede">What ${esc(d.command.toLowerCase())} asks you to do</p>
        <p class="esl-p">${esc(d.meaning)}</p>`;
    }
    if (route === "connect") {
      const links = eslLinks(p);
      if (!links.length) return "";
      // The sentence below describes a strategy raising a performance objective.
      // That is the Operations relationship, and it is false of any other: a target
      // market is not an action a business takes, and a marketing strategy is not
      // what a business is trying to improve. So a question that declares its own
      // relationship vocabulary does not inherit this copy. It authors its own
      // sentence or the card carries none, because a wrong explanation of what the
      // two ends ARE is worse than no explanation at all.
      const ownIntro = String(q.connectIntro || "").trim();
      const customPair = Array.isArray(q.objectiveWords) && q.objectiveWords.length > 0;
      const intro = ownIntro || (customPair ? "" : `${t1} are actions a business takes. ${t2} are what it is trying to improve. Each argument below joins one to the other.`);
      return `${intro ? `<p class="esl-lede">${esc(intro)}</p>` : ""}
        ${links.map(L => `<div class="esl-link">
          <div class="esl-chain">
            <span class="esl-node">${esc(L.from || L.strategy)}</span>
            ${L.mechanism ? `<span class="esl-arrow">↓</span><span class="esl-mid">${esc(L.mechanism)}</span>` : ""}
            <span class="esl-arrow">↓</span>
            <span class="esl-node">${esc(L.objectives.join(" and "))}</span>
          </div>
          ${L.says.length ? `<details class="esl-more">
            <summary>See why</summary>
            ${L.says.map(x => `<div class="esl-sech">what the topic says about ${esc(x.objective)}</div>
              <p class="esl-quote">${esc(x.text)}</p>`).join("")}</details>` : ""}
        </div>`).join("")}`;
    }
    // A concept opens inside the Centre with a Back control. Not another modal
    // over this one, and not a replacement of the essay page underneath.
    if (route === "lesson") {
      const L = esLesson(ES.centre && ES.centre.lesson);
      if (!L) return "";
      const open = (ES.centre && ES.centre.layers) || {};
      return `<button type="button" class="esl-back" data-eslroute="strategies">\u2190 Back to operations strategies</button>
        <h3 class="esl-l1">${esc(L.title)}</h3>
        <div class="esl-glance">
          <p class="esl-p">${esc(L.glance)}</p>
          <ul class="esl-keys">${L.keys.map(k => `<li>${esc(k)}</li>`).join("")}</ul>
        </div>
        ${L.layers.map(y => `<div class="esl-layer">
          <button type="button" class="esl-layerh" data-esllayer="${esc(y.id)}" aria-expanded="${open[y.id] ? "true" : "false"}">
            <span>${esc(y.head)}</span><span>${open[y.id] ? "\u2212" : "+"}</span></button>
          <div class="esl-layerb" data-esllayerb="${esc(y.id)}"${open[y.id] ? "" : " hidden"}>
            ${y.flow ? `<div class="esl-flow">${y.flow.map((n, i) => `${i ? `<div class="esl-flowarrow">\u2193</div>` : ""}<div class="esl-flownode">${esc(n)}</div>`).join("")}</div>` : ""}
            ${y.body ? String(y.body).split("\n\n").map(par => `<p class="esl-p">${esc(par)}</p>`).join("") : ""}
          </div>
        </div>`).join("")}`;
    }
    const o = eslObjectives(p), sibs = eslSiblings(p);
    return `<p class="esl-lede">What do you want to learn?</p>
      <div class="esl-grid three">
        ${sides.first ? eslCardHTML("strategies", sides.first, sibs.length ? "Includes " + sibs.slice(0, 4).map(x => x.title).join(", ") + (sibs.length > 4 ? " and more" : "") : "", false) : ""}
        ${sides.second ? eslCardHTML("objectives", sides.second, o && o.lede ? o.lede : "", false) : ""}
        ${eslLinks(p).length ? eslCardHTML("connect", "How they connect", q.argument || "", false) : ""}
        ${eslDirective() ? eslCardHTML("directive", `What "${eslDirective().command.toLowerCase()}" means`, eslDirective().meaning, false) : ""}
      </div>`;
  }
  // ---- ONE DEEP LESSON, as a pattern rather than a library ----------------
  // Authored here to prove the shape a lesson needs before the same shape is
  // repeated across twenty concepts. Written from the authored Operations
  // content and asserting no relationship that content does not carry.
  const ES_LESSONS = {
    "inventory management": {
      title: "Inventory management",
      glance: "Deciding how much stock to hold, and when to order it, so the business can meet demand without paying to store more than it needs.",
      keys: [
        "Stock sits in three states: raw materials, work in progress, and finished goods.",
        "Holding stock costs money. Running out costs sales. The decision is the trade off between them.",
        "Just in time keeps stock as low as possible by having inputs arrive close to when they are used."
      ],
      layers: [
        { id: "understand", head: "Understand it",
          body: "Every item a business holds has been paid for and is not yet earning anything. It occupies space, it can be damaged, it can go out of date, and the money spent on it cannot be spent elsewhere. Holding less of it frees that money up.\n\nThe cost of holding too little is different in kind. If an input is not there when it is needed the process stops, and a customer who cannot be served may not come back. So the question is never simply how to hold less stock, it is how little can be held while still being able to serve demand." },
        { id: "terms", head: "Key terms",
          body: "Raw materials are inputs bought but not yet used. Work in progress is partly finished output. Finished goods are ready to sell.\n\nLead time is the gap between ordering an input and receiving it. The longer it is, the more stock has to be held to cover it.\n\nJust in time schedules inputs to arrive close to the moment they are used, so very little is stored. It depends on suppliers who deliver reliably: the stock that would have absorbed a late delivery is not there any more." },
        { id: "example", head: "Example",
          body: "A restaurant chain decides how much of each ingredient sits in a store room. Order weekly and the room is full, money is tied up, and fresh items are thrown away. Order daily and almost nothing is stored, but a supplier who arrives late leaves the kitchen unable to serve part of the menu at lunchtime.\n\nThe choice between those is the inventory decision, and it is made against how reliable the supply actually is." },
        { id: "visual", head: "How it works", flow: [
            "How much stock is held",
            "Money tied up, space used, waste risk",
            "Lower holding cost",
            "and a higher risk that a late delivery stops the process" ] },
        { id: "exam", head: "Where it matters in this question",
          body: "This question asks how an operations strategy contributes to a performance objective. Inventory management is one such strategy, and the objectives it bears on most directly are cost, because stock is money held still, and dependability, because stock is what absorbs a supply problem before a customer notices it.\n\nWhich of those you argue is your decision, and the sentence has to be yours." },
        { id: "mistake", head: "Common mistake",
          body: "Treating less stock as automatically better. Just in time lowers holding costs and raises exposure to supply disruption at the same time, so an answer naming only the saving has described half of the strategy." }
      ]
    }
  };
  function esLesson(key) { return ES_LESSONS[String(key || "").toLowerCase()] || null; }

  function eslHTML(p) {
    const q = esQuestionDef() || {};
    const route = (ES.centre && ES.centre.route) || "choose";
    const step = esStepDef(p), guide = step ? esGuideFor(p, step) : null, sides = eslSides(p);
    const tab = (id, label) => `<button type="button" class="esl-tab ${route === id ? "on" : ""}" data-eslroute="${id}">${esc(label)}</button>`;
    // Absence is absence. A question with no authored relationships simply has no
    // third route, rather than a line telling the student the app is unfinished.
    const hasLinks = eslLinks(p).length > 0, dir = eslDirective();
    return `<div class="esl-panel ${ES.centre && ES.centre.dock === "left" ? "left" : ""}" role="dialog" aria-label="Learning centre">
      <div class="esl-head">
        <h2 class="esl-title" id="esltitle" tabindex="-1">Learning centre</h2>
        <button type="button" class="esl-tab" data-esnbtoggle aria-expanded="${ES.ui.nbOpen ? "true" : "false"}">notebook</button>
        <button type="button" class="esl-dock" id="esldock" aria-label="Move to the other side">⇄</button>
        <button type="button" class="esl-x" id="eslx" aria-label="Close">${esIcon("close")}</button>
      </div>
      <p class="esl-q">${esc(q.text || (ES.draft && ES.draft.question) || "")}</p>
      <div class="esl-tabs">${tab("choose", "Start here")}${sides.first ? tab("strategies", sides.first) : ""}${sides.second ? tab("objectives", sides.second) : ""}${hasLinks ? tab("connect", "How they connect") : ""}${dir ? tab("directive", `What "${dir.command.toLowerCase()}" means`) : ""}</div>
      <div class="esl-body"><div class="esl-main">${eslBodyHTML(p)}</div></div>
      <div class="esl-foot">
        ${guide ? `<span class="esl-footg"><b>${esc(guide.head || "")}</b> ${esc(guide.job || "")}</span>` : ""}
        <button type="button" class="es-btn primary sm" id="eslback">Back to your sentence</button>
      </div>
    </div>`;
  }
  // Mount at the end of <body>, never inside #eshost. Nothing here can be seen
  // by esSwapSide, so the composer underneath keeps its node identity, its text,
  // its caret and its undo history whatever the centre does.
  function eslMount(p) {
    let host = document.getElementById("eslhost");
    if (!host) { host = document.createElement("div"); host.id = "eslhost"; document.body.appendChild(host); }
    // An overlay over the workspace, which is left exactly as it was: same grid,
    // same columns, same scroll position, same composer node. The host takes
    // pointer events only while open, so the backdrop can be clicked to leave.
    host.classList.add("on");
    document.body.classList.add("esl-open");
    document.body.classList.toggle("esl-left", (ES.centre && ES.centre.dock) === "left");
    host.innerHTML = eslHTML(p);
    // Temporary surfaces close the ways every other application closes them.
    host.onmousedown = e => { if (e.target === host) { eslUnmount(); esFocusComposer(); } };
    eslBind(p);
    const t = document.getElementById("esltitle"); if (t) t.focus();
  }
  function eslUnmount() {
    const host = document.getElementById("eslhost"); if (host) host.remove();
    document.body.classList.remove("esl-open", "esl-left");
    if (ES.centre) ES.centre.open = false;
  }
  function eslBind(p) {
    const host = document.getElementById("eslhost"); if (!host) return;
    host.querySelectorAll("[data-eslroute]").forEach(b => b.onclick = () => {
      ES.centre.route = b.dataset.eslroute;
      // Only the centre re-renders. esRender is never called from in here.
      eslMount(p);
    });
    host.querySelectorAll("[data-esnbtoggle]").forEach(b => b.onclick = () => esNbToggle());
    // Entering a lesson is internal navigation inside this overlay.
    host.querySelectorAll("[data-esllesson]").forEach(b => b.onclick = () => {
      ES.centre.lesson = b.dataset.esllesson; ES.centre.route = "lesson"; ES.centre.layers = {};
      eslMount(p);
    });
    // A layer opening is a disclosure inside one card. It reveals content that is
    // already rendered and touches nothing else, so the Centre does not redraw and
    // the reader does not lose their scroll position.
    host.querySelectorAll("[data-esllayer]").forEach(b => b.onclick = () => {
      const id = b.dataset.esllayer;
      ES.centre.layers = ES.centre.layers || {};
      ES.centre.layers[id] = !ES.centre.layers[id];
      const body = host.querySelector('[data-esllayerb="' + id + '"]');
      if (body) body.hidden = !ES.centre.layers[id];
      b.setAttribute("aria-expanded", ES.centre.layers[id] ? "true" : "false");
      const sign = b.lastElementChild; if (sign) sign.textContent = ES.centre.layers[id] ? "\u2212" : "+";
    });
    const x = host.querySelector("#eslx"); if (x) x.onclick = () => { eslUnmount(); esFocusComposer(); };
    const back = host.querySelector("#eslback"); if (back) back.onclick = () => { eslUnmount(); esFocusComposer(); };
    const dk = host.querySelector("#esldock");
    if (dk) dk.onclick = () => { ES.centre.dock = ES.centre.dock === "left" ? "right" : "left"; eslMount(p); };
    host.onkeydown = e => { if (e.key === "Escape") { e.preventDefault(); eslUnmount(); esFocusComposer(); } };
  }
  function esBindSide(p) {
    const host = document.getElementById("eshost"); if (!host) return;
    const rp = host.querySelector("#esrestplan");
    if (rp) rp.onclick = () => { ES.screen = "plan"; esSaveDraft(); esRender(); };
    const rj = host.querySelector("#esrejudge");
    if (rj) rj.onclick = () => { ES.ui.posOpen = true; ES.screen = "plan"; esSaveDraft(); esRender(); };
    esBindToolbelt(p);
    esBindDecode();
    const lo = host.querySelector("#eslopen");
    if (lo) lo.onclick = () => {
      ES.centre = ES.centre || { route: "choose", dock: "right" };
      ES.centre.open = true;
      // The drawer steps aside for the centre: a side swap, never a full render, so
      // the composer keeps its node, its text, its caret and its undo history.
      ES.ui.tool = null; ES.ui.contextView = null; esRenderKeepingPlace(p);
      eslMount(p);
    };
    esFitDrawer();
    if (!ES.ui.fitBound) {
      ES.ui.fitBound = true;
      window.addEventListener("resize", esFitDrawer);
    }
  }
  function esSwapSide(p) {
    const host = document.getElementById("eshost"); if (!host) return false;
    const cols = host.querySelector(".es-cols"); if (!cols) return false;
    const side = cols.querySelector(":scope > .es-drawer, :scope > .es-rest");
    if (!side) return false;
    const holder = document.createElement("div");
    holder.innerHTML = ES.ui.tool ? esDrawerHTML(p) : esRestHTML(p);
    const next = holder.firstElementChild; if (!next) return false;
    side.replaceWith(next);
    // The swap owns the layout state too. Toggling only the drawer class left the
    // context panel stacked in a single column grid, because nothing told the grid
    // it now had two children.
    cols.classList.toggle("withdrawer", !!ES.ui.tool);
    cols.classList.toggle("withctx", !ES.ui.tool && !!ES.ui.contextView);
    next.querySelectorAll("button:not([type])").forEach(b => b.type = "button");
    host.querySelectorAll("[data-estool]").forEach(b =>
      b.classList.toggle("on", b.dataset.estool === ES.ui.tool));
    esBindSide(p);
    return true;
  }
  // A tool opening or closing must not cost the student their place. The targeted
  // swap is the whole job on the writing screen; the full render is the fallback
  // for any screen that has no side column to swap.
  // Closing a tool hands the student back to the sentence they were writing.
  // The caret is already where they left it, so this only moves focus; opening
  // a tool deliberately leaves focus on the drawer so it stays keyboard-reachable.
  function esFocusComposer() {
    const line = document.getElementById("esline"); if (!line) return;
    const s = line.selectionStart, e = line.selectionEnd;
    line.focus({ preventScroll: true });
    if (s != null) { try { line.setSelectionRange(s, e); } catch (err) { /* older browsers */ } }
  }
  function esRenderKeepingPlace(p) {
    // A successful swap leaves the composer standing, so anything captured for it
    // was never needed and must not outlive the swap. Left set, it is restored into
    // the next empty input: accept a sentence at the same stage and the text comes
    // back, ready to be added a second time. The capture exists only for the paths
    // that genuinely replace the composer, which is the full render below.
    if (esSwapSide(p)) { ES.ui.ctx = null; return; }
    const keep = ES.ui.ctx;
    esRender();
    if (keep) { ES.ui.ctx = keep; esRestoreContext(); }
  }

  // ===========================================================================
  // PHASE C: the paragraph's argument and evidence.
  //
  // A pathway is a RELATIONSHIP the student chooses to argue, never a prewritten
  // topic sentence. Choosing one is an input to guidance and is NEVER written into
  // the response: the student still types every word. The choice then drives the
  // guide for each sentence, filters the evidence to what supports it, and tells
  // Understand which concept to open. All authored, so nothing here calls a model.
  // ===========================================================================
  function esQuestionDef() {
    const d = ES.draft, sc = esSubjectContent(ES.subject);
    if (!d || !sc) return null;
    const qs = sc.questions || [];
    if (d.questionId) { const byId = qs.find(x => x.id === d.questionId); if (byId) return byId; }
    return qs.find(x => x.text && d.question && x.text.trim() === d.question.trim()) || null;
  }
  // Pathways offered for THIS paragraph. Matched on the area the paragraph is about,
  // falling back to every pathway when the paragraph has not said yet.
  function esAreaForPara(p) {
    if (!p) return "";
    if (p.area) return p.area;
    if (!esAreasRequired()) return "";
    const d = ES.draft; if (!d) return "";
    const k = esBodyIndexes(d).indexOf(d.paras.indexOf(p));
    return k >= 0 ? (esQuestionAreas()[k] || "") : "";
  }
  function esPathwaysFor(p) {
    const q = esQuestionDef();
    const all = (q && q.pathways) || [];
    if (!all.length) return [];
    const hay = ((p.point || "") + " " + (p.role || "") + " " + esAreaForPara(p)).toLowerCase();
    const inArea = all.filter(x => x.area && hay.indexOf(x.area.toLowerCase()) >= 0);
    return inArea.length ? inArea : all;
  }
  function esPathway(p) {
    if (!p || !p.argumentId) return null;
    const q = esQuestionDef();
    return ((q && q.pathways) || []).find(x => x.id === p.argumentId) || null;
  }
  // Evidence compatible with the chosen argument. With a custom argument there is no
  // authored mapping, so nothing is claimed to be compatible: the student is told
  // plainly rather than shown the nearest authored set.
  function esEvidenceFor(p) {
    const store = esEvidenceBank();
    const bank = store.usable;
    if (!store.all.length) return { items: [], custom: false, none: "no-bank", withheld: 0 };
    if (!bank.length) return { items: [], custom: false, none: "unverified", withheld: store.withheld };
    const path = esPathway(p);
    if (p.argumentId && !path) return { items: [], custom: true, none: "custom", withheld: store.withheld };   // their own argument
    if (!path) return { items: bank.slice(0, 12), custom: false, none: null, withheld: store.withheld };       // nothing chosen yet
    const notes = esPathEvidence(path);
    const labels = notes.map(n => n.label);
    const items = bank.filter(e => labels.indexOf(e.label) >= 0)
      .sort((x, y) => labels.indexOf(x.label) - labels.indexOf(y.label))
      .map(e => esEvidenceWith(e, notes));
    return { items: items, custom: false, none: items.length ? null : (store.withheld ? "unverified" : "unlinked"), pathway: path, withheld: store.withheld };
  }
  // A pathway may list evidence as plain labels or as {label, why}. Both are read
  // the same way, so the authored files can deepen one pathway at a time.
  function esPathEvidence(path) {
    return ((path && path.evidence) || []).map(e => typeof e === "string"
      ? { label: e, why: "", limits: "" }
      : { label: e.label, why: e.why || "", limits: e.limits || "" });
  }
  // The bank item, plus what it is for in THIS argument. Nothing here is invented:
  // a source that was never recorded is shown as missing rather than filled in.
  function esEvidenceWith(e, notes) {
    const n = (notes || []).find(x => x.label === e.label);
    return { label: e.label, fact: e.fact, use: e.use, verify: !!e.verify,
             why: (n && n.why) || "", source: e.source || "", limits: (n && n.limits) || e.limits || "" };
  }
  // ---- the verification gate -------------------------------------------------
  // A student must be able to trust that anything in the evidence picker is safe
  // to put in an answer. So an item is a CANDIDATE, held internally and never
  // offered, until BOTH halves of verification are recorded. It is withheld rather
  // than shown with a warning, because a warning still puts an unverified claim in
  // front of someone who is about to be marked on it.
  //
  // Both halves, because finding a source and confirming it are different acts:
  //
  //   source   WHERE the claim can be checked, in words a teacher could follow
  //   checked  the date someone actually did check it
  //
  // A source without a checked date is the most dangerous state this bank can
  // hold: it looks complete, it reads as authoritative, and nobody has opened it.
  // A located URL is weaker still and never counted for anything on its own.
  function esEvidenceUsable(e) {
    return !!(e && String(e.source || "").trim() && String(e.checked || "").trim());
  }
  function esEvidenceBank() {
    const b = busContent(); const key = busTopicKey();
    const all = (b && key && b.evidence && b.evidence[key]) || [];
    const usable = all.filter(esEvidenceUsable);
    return { all: all, usable: usable, withheld: all.length - usable.length };
  }
  function esEvidenceByLabel(label) {
    const b = busContent(); const key = busTopicKey();
    return ((b && key && b.evidence && b.evidence[key]) || []).find(e => e.label === label) || null;
  }
  // The guide for the active sentence, now shaped by what the student chose. An
  // authored pathway guide for this slot wins; otherwise the slot's own job stands.
  // pathway guide -> area guide -> slot job. The last of those is scaffold
  // language written for no question in particular, so a chosen argument should
  // almost never reach it: the area knows what THIS question wants from it.
  function esAreaDef(p) {
    const q = esQuestionDef(); const bank = (q && q.areas) || null; if (!bank) return null;
    const path = esPathway(p);
    const key = (path && path.area) || p.area || "";
    return (key && bank[key]) || null;
  }
  function esSlotGuide(p, step) {
    if (!step) return "";
    const path = esPathway(p);
    const authored = path && path.guides && path.guides[step.key];
    if (authored) return authored;
    const area = esAreaDef(p);
    const byArea = area && area.guides && area.guides[step.key];
    return byArea || step.job || "";
  }
  // Whether this paragraph still needs its argument chosen before writing starts.
  // Two paragraphs arguing the identical relationship is usually a slip and
  // occasionally deliberate, so it is named and never blocked. Defined once
  // because it has to behave the same on the planning surface and on the
  // just-in-time picker, which is now the route most students take.
  function esTwinOf(d, i) {
    const id = d.paras[i] && d.paras[i].argumentId;
    if (!id) return undefined;
    return esBodyIndexes(d).find(j => j < i && d.paras[j].argumentId === id);
  }
  // keyed to the ARGUMENT, so keeping one repeat does not silence the next one
  function esTwinKey(d, i) { return i + "|" + ((d.paras[i] && d.paras[i].argumentId) || ""); }
  function esTwinHTML(d, i) {
    const twin = esTwinOf(d, i);
    if (twin === undefined || ES.ui.twinOk[esTwinKey(d, i)]) return "";
    return `<div class="es-twin">
      This is the same argument as ${esc(d.paras[twin].role)}. You can argue the same strategy twice if the point is genuinely different, but repeating the relationship narrows what your response covers.
      <span class="es-twinbtns"><button type="button" class="es-linkbtn" data-estwinok="${esc(esTwinKey(d, i))}">Keep it</button><button type="button" class="es-linkbtn" data-estwinother="${i}">See other arguments</button></span>
    </div>`;
  }
  // The same two buttons on both surfaces, so the warning behaves the same way
  // wherever the argument was chosen.
  function esBindTwin(host) {
    host.querySelectorAll("[data-estwinok]").forEach(b => b.onclick = () => {
      ES.ui.twinOk[b.dataset.estwinok] = true; esRender();
    });
    host.querySelectorAll("[data-estwinother]").forEach(b => b.onclick = () => {
      const i = Number(b.dataset.estwinother);
      if (ES.screen === "coached") { ES.draft.pos = i; ES.ui.setupStage = "argument"; }
      else { ES.ui.planOpen[i] = true; ES.ui.planAll = true; }
      esRender();
    });
  }
  // ---------------------------------------------------------------------------
  // DOES THE ARGUMENT RUN THE WAY THE QUESTION ASKS?
  //
  // The app knows which argument a student SELECTED and, for a judgement, whether
  // their arguments fit their position. It has never known whether an argument
  // the student wrote themselves actually answers the question. A student who
  // writes "profitability determines which cost control a business chooses" has
  // an argument, and it runs backwards, and until now that read to the app
  // exactly like knowing nothing.
  //
  // Three cases have to come apart, and only the middle one may speak:
  //
  //   knows nothing        names neither side of the relationship   SILENT
  //   misconception        names both, running the wrong way        ASK
  //   valid alternative    names both, running the right way, and   SILENT
  //                        not in the authored menu
  //
  // The third is why this can never be an authored-answer matcher. It reads the
  // question's own vocabulary for each side of the relationship and the ORDER
  // and VERB between them. Nothing here compares against a pathway id, so an
  // argument nobody thought of passes exactly as quietly as one that was.
  //
  // It is deliberately low-recall. A soft prompt that fires on a legitimate
  // sentence is worse than one that misses, so every rule below is written to
  // stay quiet unless the shape is unambiguous.
  // ---------------------------------------------------------------------------
  const ES_BACKWARD_VERB = /^(determines?|determined|decides?|dictates?|drives?|shapes?|influences?|governs?|controls?|explains?|is the reason)\b/;
  const ES_FORWARD_VERB = /^(affects?|improves?|increases?|raises?|reduces?|lowers?|lifts?|changes?|damages?|weakens?|strengthens?)\b/;
  // a subordinator after the verb means what follows is a condition, not the
  // object: "liquidity improves WHEN a business manages its cash flow" is a
  // perfectly good sentence and must never be flagged
  const ES_SUBORD = /^(when|where|if|because|since|as|after|once|through|by|whenever|provided|unless)$/;
  function esReasoningDef() { const q = esQuestionDef(); return (q && q.reasoning) || null; }
  // longest term first, so "working capital ratio" is never swallowed by
  // "working capital"
  function esFindTerm(text, terms) {
    let best = null;
    (terms || []).slice().sort((a, b) => b.length - a.length).forEach(t => {
      const at = text.indexOf(t);
      if (at < 0) return;
      if (!best || at < best.at) best = { at: at, term: t, end: at + t.length };
    });
    return best;
  }
  function esReasoningCheck(text, opts) {
    const r = esReasoningDef();
    const s = String(text || "").toLowerCase().replace(/[\u2019']/g, "'").replace(/\s+/g, " ").trim();
    if (!r || s.split(" ").filter(Boolean).length < 4) return null;
    const cause = esFindTerm(s, r.cause && r.cause.terms);
    const effect = esFindTerm(s, r.effect && r.effect.terms);
    // names neither side, or only one: this is not a direction problem, and
    // saying anything about direction here would be answering a question the
    // student has not asked yet
    if (!cause || !effect) {
      if (!(opts && opts.wantHalf)) return null;
      if (cause && !effect) return { kind: "half", missing: r.effect.label, has: r.cause.label, text: s };
      if (effect && !cause) return { kind: "half", missing: r.cause.label, has: r.effect.label, text: s };
      return null;
    }
    if (cause.at < effect.at) return esReasoningDegree(s, r, opts);   // runs the right way
    // the effect leads. That is only a fault when the effect is the SUBJECT of a
    // verb whose object is the cause.
    const head = s.slice(0, effect.at).replace(/^(a|an|the|this|that|good|strong|high|higher|better|poor|low)\s+/, "").trim();
    if (head.split(" ").filter(Boolean).length > 2) return esReasoningDegree(s, r, opts);
    const after = s.slice(effect.end).trim().split(" ").filter(Boolean);
    let verbAt = -1;
    for (let i = 0; i < Math.min(after.length, 4); i++) {
      const w = after.slice(i).join(" ");
      if (ES_BACKWARD_VERB.test(w) || ES_FORWARD_VERB.test(w)) { verbAt = i; break; }
    }
    if (verbAt < 0) return esReasoningDegree(s, r, opts);
    const rest = after.slice(verbAt + 1);
    for (let i = 0; i < rest.length; i++) {
      if (ES_SUBORD.test(rest[i].replace(/[^a-z]/g, ""))) return esReasoningDegree(s, r, opts);
      if (rest.slice(i).join(" ").indexOf(cause.term) === 0) {
        return { kind: "backwards", cause: r.cause.label, effect: r.effect.label,
                 ask: r.forward, saw: r.backward, text: s };
      }
    }
    return esReasoningDegree(s, r, opts);
  }
  // A judgement question asks how far, not whether. An argument that reaches its
  // measure and stops has not finished, and that is worth one quiet line.
  function esReasoningDegree(s, r, opts) {
    if (!esIsJudgement() || !r.degree || !(opts && opts.wantDegree)) return null;
    if (esFindTerm(s, r.degree.terms)) return null;
    return { kind: "degree", ask: r.degree.ask, text: s };
  }
  function esReasoningHTML(text, seen, opts) {
    const c = esReasoningCheck(text, opts);
    if (!c || seen === c.text) return "";
    const body = c.kind === "backwards"
      ? `<p class="es-corep">${esc(c.ask)}</p><p class="es-corep miss">${esc(c.saw)}</p>`
      : c.kind === "half"
      ? `<p class="es-corep">This names ${esc(c.has)} but not ${esc(c.missing)}. The relationship needs both ends.</p>`
      : `<p class="es-corep">${esc(c.ask)}</p>`;
    const head = c.kind === "backwards" ? "Check the direction of your argument"
      : c.kind === "half" ? "Only one end of the relationship is here"
      : "How far, not whether";
    return `<div class="es-drift dir" data-esdirfor="${esc(c.text)}">
      <div class="es-drifth">${esc(head)}</div>
      ${body}
      <div class="es-corebtns">
        <button type="button" class="es-btn sm" data-esdirfix>Revise my point</button>
        <button type="button" class="es-linkbtn" data-esdirkeep>Keep it</button>
      </div>
    </div>`;
  }
  // Acknowledgement belongs to the CLAIM that was acknowledged, never to the
  // press that dismissed it. Change the claim and the question is a new one.
  function esBindReasoning(host, p, field) {
    const wrap = host.querySelector("[data-esdirfor]");
    if (!wrap) return;
    const keep = wrap.querySelector("[data-esdirkeep]");
    if (keep) keep.onclick = () => { p.dirSeen = wrap.dataset.esdirfor; esSaveDraft(); esRender(); };
    const fix = wrap.querySelector("[data-esdirfix]");
    if (fix) fix.onclick = () => { const el = host.querySelector(field); if (el) { el.focus(); el.selectionStart = el.value.length; } };
  }
  function esNeedsSetup(p) {
    if (!p) return false;
    // The introduction and the conclusion argue the whole response, not one
    // relationship, so they never ask for a body pathway. They read the plan.
    if (esIsIntro(p) || esIsConcl(p)) return false;
    if (p.argumentId || p.setupDone) return false;
    if (!esPathwaysFor(p).length) return false;                 // nothing authored to choose from
    return !esBlocks(p).length;                                  // already writing: do not interrupt
  }
  // ---------------------------------------------------------------------------
  // THE PATHWAY IS THE LESSON
  //
  // A student who has chosen "convenience → processes" does not need a definition
  // drawer, then a relationship drawer, then a misconception drawer, then an
  // example drawer, then a quiz. That is the authoring architecture, and exposing
  // it to a student is what makes learning feel like leaving the essay.
  //
  // Underneath, everything stays modular. On screen it is one surface about one
  // argument: what you need to know, what the relationship looks like, one thing
  // to try, and a way back into the paragraph from anywhere on it.
  //
  // Know, See and Try are DEPTHS, not stages. Nothing is gated behind them: the
  // way back into the writing is at the top of the surface before the student has
  // read a word, and a student who never opens this never meets any of it.
  // ---------------------------------------------------------------------------
  // A pathway carries a learning STATE, and only one of the three is a lesson.
  // "unreviewed" means nobody has yet decided what this argument depends on; it
  // is never a claim that it depends on nothing, and it shows a student nothing.
  function esLearning(p) {
    const path = esPathway(p);
    const L = (path && path.learning) || null;
    return (L && L.status === "authored") ? L : null;
  }
  // The concept store for the subject, and the pathway's declared dependencies
  // on it. Referencing a concept does not show it: it makes it ELIGIBLE here.
  // Primary concepts are what this argument cannot be understood without, so
  // they are on the surface. Supporting ones sit behind "Still not clear?".
  // Optional ones are never shown unasked and exist so the deeper material can
  // reach them.
  function esConceptStore() {
    const sub = (window.ESSAY && window.ESSAY.subjects && window.ESSAY.subjects[ES.subject]) || null;
    return (sub && sub.concepts) || {};
  }
  function esConceptsFor(p, tier) {
    const L = esLearning(p);
    const ids = (L && L.concepts && L.concepts[tier]) || [];
    const store = esConceptStore();
    return ids.map(id => Object.assign({ id: id }, store[id])).filter(c => c.oneLine || c.quick);
  }
  // What the student was in the middle of writing, named the way they would say
  // it, so the lesson can hand them back to that and not to "the paragraph".
  const ES_SLOT_PHRASE = { explain: "explanation", define: "definition", topic: "topic sentence",
    demonstrate: "knowledge", connect: "connection", analysis: "analysis", point: "point",
    evidence: "evidence", effect: "effect", link: "link", cs: "case study" };
  function esSlotPhrase(p) {
    const s = esStepDef(p);
    return (s && (ES_SLOT_PHRASE[s.key] || s.label)) || "paragraph";
  }
  function esChoiceMeaning(o) { return (o && (o.choiceMeaning || o.meaning)) || ""; }
  function esLessonHTML(p) {
    const path = esPathway(p), L = esLearning(p);
    if (!L) return "";
    const pick = ES.ui.tryPick;
    const opts = (L.try && L.try.options) || [];
    const opt = pick == null ? null : opts[pick];
    const right = !!(opt && opt.right);
    const where = esSlotPhrase(p);
    const blocks = esBlocks(p).filter(b => String(b.text || "").trim());
    const last = blocks.length ? blocks[blocks.length - 1].text.trim() : "";
    const jump = ES.ui.lessonJump;
    const more = ES.ui.lessonMore || jump === "example";
    const use = t => `<button type="button" class="es-btn primary sm" data-eslessonuse>${esc(t)}</button>`;
    return `<div class="es-lesson">
      <div class="es-lessonctx">
        <div class="es-lessonctxl">
          <span class="es-corelbl">${esc(p.role)}${path.area ? " \u00b7 " + esc(path.area) : ""}</span>
          <span class="es-lessonarg">${esc(path.short || path.relationship)}</span>
          ${last ? `<span class="es-lessonwas">you were writing: \u201c${esc(last.length > 96 ? last.slice(0, 96) + "\u2026" : last)}\u201d</span>` : ""}
        </div>
        <button type="button" class="es-linkbtn" data-eslessonuse>\u2190 Return to my ${esc(where)}</button>
      </div>
      <div class="es-lessonjump"><span class="es-wanote">need help with</span>
        <button type="button" class="es-jump ${jump === "concept" ? "on" : ""}" data-esjump="concept">the concept</button>
        <button type="button" class="es-jump ${jump === "connection" ? "on" : ""}" data-esjump="connection">the connection</button>
        <button type="button" class="es-jump ${jump === "example" ? "on" : ""}" data-esjump="example">an example</button>
      </div>
      <div class="es-conceptset ${jump === "concept" ? "focus" : ""}">
        ${esConceptsFor(p, "primary").map(c => `<p class="es-concept"><b>${esc(c.title || c.id)}</b> \u2014 ${esc(c.oneLine || c.quick)}</p>`).join("")}
        <p class="es-lessonp lead">${esc(L.know)}</p>
      </div>
      ${(L.chain || []).length ? `<ol class="es-chain ${jump === "connection" ? "focus" : ""}">${L.chain.map((s, i) => `<li class="es-chainstep" style="animation-delay:${i * 130}ms">${esc(s)}</li>`).join("")}</ol>` : ""}
      ${L.try ? `<div class="es-lessonsec try">
        <div class="es-drawer-sub">check you have got it</div>
        <p class="es-lessonp">${esc(L.try.prompt)}</p>
        <div class="es-tryopts">${opts.map((o, i) => `<button type="button" class="es-try ${pick === i ? (o.right ? "right" : "wrong") : ""}" data-estry="${i}"${right ? " disabled" : ""}>${esc(o.text)}</button>`).join("")}</div>
        ${right ? `<div class="es-tryright">
          <div class="es-tryrighth">You have got the relationship</div>
          <p class="es-lessonp">${esc(L.try.onRight)}</p>${use("Use this in my " + where + " \u2192")}</div>` : ""}
        ${(opt && !right) ? `<div class="es-tryrepair"><p class="es-lessonp">${esc(opt.repair)}</p>
          <button type="button" class="es-linkbtn" id="estryagain">Try again</button></div>` : ""}
      </div>` : ""}
      <div class="es-lessonmore${more ? " open" : ""}">
        <button type="button" class="es-linkbtn" id="eslessonmore">${more ? "Hide" : "Still not clear?"}</button>
        ${more ? `
          ${L.misconception ? `<div class="es-contrast">
            <div class="es-contrasth">${esc(L.misconception.head)}</div>
            <div class="es-contrastrow"><b>${esc(L.misconception.a.term)}</b><span>${esc(L.misconception.a.line)}</span></div>
            <div class="es-contrastrow"><b>${esc(L.misconception.b.term)}</b><span>${esc(L.misconception.b.line)}</span></div>
          </div>` : ""}
          ${L.example ? `<div class="es-lessonsec ${jump === "example" ? "focus" : ""}">
            <div class="es-drawer-sub">the same shape, ${esc(L.example.context)}</div>
            <p class="es-lessonp">${esc(L.example.text)}</p>
            ${L.example.pattern ? `<p class="es-lessonnote">Notice: ${esc(L.example.pattern)}.</p>` : ""}
          </div>` : ""}
          ${esConceptsFor(p, "supporting").map(c => `<div class="es-lessonsec">
            <div class="es-drawer-sub">${esc(c.title || c.id)}</div>
            <p class="es-lessonp">${esc(c.quick || c.oneLine)}</p></div>`).join("")}
          ${L.explore ? `<button type="button" class="es-linkbtn" id="eslessonexplore">${esc(L.explore.label)}</button>` : ""}` : ""}
      </div>
    </div>`;
  }
  // ---- the setup card: argument first, then evidence, then writing -----------
  function esSetupHTML(p) {
    const stage = ES.ui.setupStage || (p.argumentId ? "evidence" : "argument");
    if (stage === "lesson") return esLessonHTML(p);
    if (stage === "argument") {
      const required = esAreasRequired();
      const areas = esQuestionAreas();
      const area = esAreaForPara(p);
      const askArea = !required && areas.length > 1 && !area;
      const opts = askArea ? [] : esPathwaysFor(p);
      const usedElsewhere = {};
      esBodyIndexes(ES.draft).forEach(j => { const q = ES.draft.paras[j]; if (q !== p && q.area) usedElsewhere[q.area] = q.role; });
      return `<div class="es-setup">
        <div class="es-setuph">${askArea ? "Which " + esc(esAreasLabel()) + " will " + esc(p.role) + " use?"
          : area ? "What will you argue about " + esc(area) + "?" : "Choose how you want to answer this part"}</div>
        <p class="es-setupsub">You are choosing a relationship to argue, not a sentence. You still write every word of it.</p>
        ${(areas.length > 1 && !required) ? `<div class="es-planareas">${areas.map(a => {
          const on = String(a).toLowerCase() === String(area).toLowerCase(), used = usedElsewhere[a];
          return `<button type="button" class="es-areachip ${on ? "on" : ""}" data-essetuparea="${esc(a)}">${esc(a)}${(used && !on) ? `<span class="es-areaused">used in ${esc(used)}</span>` : ""}</button>`;
        }).join("")}</div>` : ""}
        ${(required && area) ? `<div class="es-planareas">${areas.map(a => {
          const on = String(a).toLowerCase() === String(area).toLowerCase(), used = usedElsewhere[a];
          // not choices: the question fixed them. Shown so the student can see
          // which part this paragraph is answering and which are already done.
          return `<span class="es-areachip fixed ${on ? "on" : ""}">${esc(a)}${(used && !on) ? `<span class="es-areaused">done in ${esc(used)}</span>` : ""}</span>`;
        }).join("")}</div>` : ""}
        ${opts.map(o => `<button type="button" class="es-pick" data-espath="${esc(o.id)}">
          ${o.short ? `<span class="es-pickshort">${esc(o.short)}</span>` : ""}
          <span class="es-pickrel">${esc(o.relationship)}</span>
          ${esChoiceMeaning(o) ? `<span class="es-picksub">${esc(esChoiceMeaning(o))}</span>` : ""}</button>`).join("")}
        <button type="button" class="es-pick own" data-espathown>Write my own argument</button>
        <div class="es-ownwrap" data-ownwrap hidden>
          <input id="esownarg" class="es-input" placeholder="In one line, the relationship you want to argue">
          <button type="button" class="es-btn primary sm" id="esownok">Use this</button>
        </div>
      </div>`;
    }
    const ev = esEvidenceFor(p);
    const chosen = p.evidenceIds || [];
    // A selected item is not un-selected by clicking it again: removing evidence can
    // invalidate writing, so it is its own labelled action rather than a silent toggle.
    const rows = ev.items.map(e => {
      const on = chosen.indexOf(e.label) >= 0;
      return `<div class="es-pickwrap${on ? " on" : ""}">
        <button type="button" class="es-pick ev ${on ? "on" : ""}" data-esev="${esc(e.label)}" ${on ? "disabled" : ""}>
          <span class="es-pickrel">${esc(e.label)}</span>
          <span class="es-picksub">${esc(String(e.why || e.use || e.fact).slice(0, 150))}</span>
          ${e.limits ? `<span class="es-evlimit">${esc(e.limits)}</span>` : ""}
          ${e.verify ? `<span class="es-evflag">check a current figure yourself</span>` : ""}
        </button>
        ${on ? `<div class="es-pickon"><span class="es-pickchosen">chosen</span><button type="button" class="es-linkbtn es-del" data-esevremove="${esc(e.label)}">Remove</button></div>` : ""}
      </div>`;
    }).join("");
    const none = ev.none === "custom"
      ? `<p class="es-setupsub">No verified evidence has been linked to your own argument yet. You can still use your own evidence, and the Evidence tool stays open to you.</p>`
      : ev.none === "unlinked"
      ? `<p class="es-setupsub">No verified evidence has been linked to this argument yet. You can still use your own.</p>`
      : ev.none === "unverified"
      ? `<p class="es-setupsub">No verified evidence is available for this argument yet. You can still use your own, and everything else about this paragraph works as normal.</p>`
      : ev.none === "no-bank"
      ? `<p class="es-setupsub">No evidence bank has been written for this subject yet.</p>` : "";
    return `<div class="es-setup">
      ${esTwinHTML(ES.draft, ES.draft.paras.indexOf(p))}
      ${p.ownArgument ? esReasoningHTML(p.ownArgument, p.dirSeen, { wantHalf: true, wantDegree: true }) : ""}
      <div class="es-setuph">Choose evidence that could support this argument</div>
      <p class="es-setupsub">Only evidence that supports what you chose. Picking one does not write anything: you still use it in your own words.</p>
      ${rows}${none}
      <div class="es-setupbtns">
        <button type="button" class="es-linkbtn" id="esbackarg">Change the argument</button>
        ${esLearning(p) ? `<button type="button" class="es-btn" id="eslessonopen">Understand this argument</button>` : ""}
        <button type="button" class="es-btn primary" id="esstartwriting">Start writing</button>
      </div>
    </div>`;
  }
  // Swap the direction card in place. It must never re-render the screen: the
  // point field loses focus by the student clicking something else, and a full
  // render at that moment detaches whatever they clicked.
  function esRefreshDir(p) {
    const host = document.getElementById("eshost"); if (!host) return;
    const pin = host.querySelector(".es-pointpin"); if (!pin) return;
    const old = pin.querySelector(".es-drift.dir");
    const html = (esIsIntro(p) || esIsConcl(p)) ? "" : esReasoningHTML(p.point, p.dirSeen, { wantDegree: true });
    if (!html) { if (old) old.remove(); return; }
    const wrap = document.createElement("div");
    wrap.innerHTML = html;
    const fresh = wrap.firstElementChild; if (!fresh) return;
    if (old) old.replaceWith(fresh); else pin.appendChild(fresh);
    esBindReasoning(host, p, "#espoint");
  }
  // Replace just the setup card, keeping the point field and its cursor untouched.
  function esRefreshSetup(p) {
    const host = document.getElementById("eshost"); if (!host) return;
    const card = host.querySelector(".es-setup"); if (!card) return;
    const wrap = document.createElement("div");
    wrap.innerHTML = esSetupHTML(p);
    const fresh = wrap.firstElementChild; if (!fresh) return;
    card.replaceWith(fresh);
    esBindSetup(p);
  }
  function esBindSetup(p) {
    const host = document.getElementById("eshost"); if (!host) return;
    esBindTwin(host);
    host.querySelectorAll("[data-espath]").forEach(b => b.onclick = () => {
      const path = esPathwaysFor(p).find(x => x.id === b.dataset.espath);
      const flagged = esSetParagraphContext(p, b.dataset.espath, []);
      p.area = (path && path.area) || p.area || "";
      ES.ui.setupStage = "evidence"; esSaveDraft(); esRender();
      if (flagged) toast(flagged + " sentence" + (flagged === 1 ? "" : "s") + " to check against the new argument.");
    });
    host.querySelectorAll("[data-essetuparea]").forEach(b => b.onclick = () => {
      const a = b.dataset.essetuparea;
      if (p.argumentId && esPathway(p) && String(esPathway(p).area || "").toLowerCase() !== a.toLowerCase()) esSetParagraphContext(p, null, []);
      p.area = a; esSaveDraft(); esRender();
    });
    const own = host.querySelector("[data-espathown]");
    if (own) own.onclick = () => { const w = host.querySelector("[data-ownwrap]"); if (w) { w.hidden = false; const i = host.querySelector("#esownarg"); if (i) i.focus(); } };
    esBindReasoning(host, p, "#esownarg");
    const ok = host.querySelector("#esownok");
    if (ok) ok.onclick = () => {
      const v = (host.querySelector("#esownarg").value || "").trim(); if (!v) return;
      // Their own argument is first class: it is kept as written and never quietly
      // snapped to the nearest authored pathway.
      esSetParagraphContext(p, "own:" + v, []);
      p.ownArgument = v;
      ES.ui.setupStage = "evidence"; esSaveDraft(); esRender();
    };
    host.querySelectorAll("[data-esev]").forEach(b => b.onclick = () => {
      const label = b.dataset.esev, list = (p.evidenceIds || []).slice();
      if (list.indexOf(label) < 0) list.push(label);      // adding only; removal is its own action
      esSetParagraphContext(p, p.argumentId, list);
      esSaveDraft(); esRender();
    });
    host.querySelectorAll("[data-esevremove]").forEach(b => b.onclick = () => {
      const label = b.dataset.esevremove;
      const list = (p.evidenceIds || []).filter(x => x !== label);
      const n = esSetParagraphContext(p, p.argumentId, list);
      esSaveDraft(); esRender();
      // one signal, not three: the banner and the highlighted sentence say it already
      if (!n) toast("Removed. Nothing you have written rested on it.");
    });
    const back = host.querySelector("#esbackarg"); if (back) back.onclick = () => { ES.ui.setupStage = "argument"; esRender(); };
    const lo = host.querySelector("#eslessonopen");
    if (lo) lo.onclick = () => { ES.ui.setupStage = "lesson"; ES.ui.tryPick = null; esRender(); };
    // every route out of the lesson goes back to the paragraph, never to a menu
    host.querySelectorAll("[data-eslessonuse]").forEach(b => b.onclick = () => {
      p.setupDone = true; ES.ui.setupStage = null; ES.ui.tryPick = null;
      ES.ui.lessonJump = null; ES.ui.lessonMore = false; esSaveDraft(); esRender();
    });
    host.querySelectorAll("[data-estry]").forEach(b => b.onclick = () => {
      ES.ui.tryPick = Number(b.dataset.estry); esRender();
    });
    const again = host.querySelector("#estryagain");
    if (again) again.onclick = () => { ES.ui.tryPick = null; esRender(); };
    const lm = host.querySelector("#eslessonmore");
    if (lm) lm.onclick = () => { ES.ui.lessonMore = !ES.ui.lessonMore; ES.ui.lessonJump = null; esRender(); };
    // shortcuts into the same page, for a student coming back to one part of it
    host.querySelectorAll("[data-esjump]").forEach(b => b.onclick = () => {
      const k = b.dataset.esjump;
      ES.ui.lessonJump = ES.ui.lessonJump === k ? null : k;
      if (ES.ui.lessonJump === "example") ES.ui.lessonMore = true;
      esRender();
    });
    // Explore is secondary: it opens the fuller resource beside the lesson rather
    // than replacing it, so the student never loses their place
    const lx = host.querySelector("#eslessonexplore");
    if (lx) lx.onclick = () => { ES.ui.tool = ES.ui.tool === "understand" ? null : "understand"; esRender(); };
    const go = host.querySelector("#esstartwriting"); if (go) go.onclick = () => { p.setupDone = true; ES.ui.setupStage = null; esSaveDraft(); esRender(); };
  }
  // ---- the resting right rail: what this paragraph is arguing, and where it is
  // The rail has two states and one width, so opening a tool never shifts the page.
  function esRestHTML(p) {
    const d = ES.draft;
    const steps0 = slotsForRole(p.role), si0 = esStepIndex(p);
    const where = `<div class="es-restblk">
        <div class="es-restlbl">This paragraph</div>
        <ol class="es-reststeps">${steps0.map((st, i) => `<li class="${i < si0 ? "done" : i === si0 ? "now" : ""}">${esc(st.label)}</li>`).join("")}</ol>
      </div>`;
    // The introduction signposts a plan that already exists, and the conclusion
    // draws together arguments that have already been made. Both read the same
    // rows; neither is asked to choose a body relationship of its own.
    if (esIsIntro(p) || esIsConcl(p)) {
      // Empty of everything the student did not ask for, but NOT of the decoder:
      // the chips live on the question stem and this is the panel they open. An
      // aside with nothing in it takes no width, so the decoder costs nothing until
      // a word is pressed.
      // The rail renders the view that was asked for, and nothing when none was.
      if (!ES.ui.tool && !ES.ui.contextView) return `<aside class="es-rest quiet empty"></aside>`;
      const judging = esIsJudgement();
      const rows = (judging ? esJudgementRows(d) : esPlanRows(d)).filter(r => r.argument || r.words);
      const intro = esIsIntro(p);
      const pos = esPositionOf(d);
      return `<aside class="es-rest">
        <div data-esrestprogress>
        <div class="es-resth">${esc(p.role)}</div>
        ${(judging && pos) ? `<div class="es-restblk">
          <div class="es-restlbl">Your judgement</div>
          <div class="es-restval">${esc(pos.label)}</div>
          ${!intro ? `<div class="es-restnote">Weigh what your paragraphs established against this. If they do not support it, change the judgement rather than the evidence.</div>
            <button type="button" class="es-linkbtn" id="esrejudge">Does this still match what you argued?</button>` : ""}
        </div>` : ""}
        <div class="es-restblk">
          <div class="es-restlbl">${intro ? "Your plan" : judging ? "What your paragraphs established" : "Arguments you established"}</div>
          ${rows.length ? `<ol class="es-planlist">${rows.map(r => `<li><button type="button" class="es-planjump" data-esgo="${r.i}">
              <span class="es-planlrole">${esc(r.role)}${r.area ? " \u00b7 " + esc(r.area) : ""}</span>
              ${(!intro && r.wrote) ? `<span class="es-planlwrote">${esc(r.wrote)}</span>` : ""}
              <span class="es-planlarg${(!intro && r.wrote) ? " planned" : ""}">${(!intro && r.wrote) ? "planned: " : ""}${esc(r.argument || "not chosen yet")}</span>
              ${r.roleLabel ? `<span class="es-tprole ${esc(r.role)}">${esc(r.roleLabel)}</span>` : ""}
              ${r.words ? `<span class="es-planlw">${r.words} words</span>` : `<span class="es-planlw muted">not written yet</span>`}
            </button></li>`).join("")}</ol>`
            : `<div class="es-restnone">no body paragraphs planned yet</div>`}
          <div class="es-restnote">${intro
            ? "Signpost these in the order you will argue them. No evidence is needed here."
            : judging
            ? "Say how the support and the limitations balance out, and land on the degree you have argued for. Nothing new belongs in a conclusion."
            : "Draw these together into one judgement. Nothing new belongs in a conclusion."}</div>
          <button type="button" class="es-linkbtn" id="esrestplan">${intro ? "Change the plan" : "Open the plan"}</button>
        </div>
        ${where}
        </div>
      </aside>`;
    }
    // Argument and evidence live in the chips above the writing now, so the
    // resting rail is what the chips cannot carry: where this paragraph is up to.
    // When a drawer opens it becomes information-rich; at rest it recedes.
    // The stage list now sits above the writing as one compact line, so at rest
    // this rail carries only the decoder. With no decoder authored it holds
    // nothing, and a column holding nothing should not occupy the screen. The node
    // stays in the DOM either way, because esSwapSide swaps it on every tool press.
    return `<aside class="es-rest quiet empty"></aside>`;
  }
  // ===========================================================================
  // THE RESPONSE PLAN
  //
  // An essay is planned as an essay, once, before the introduction is written.
  // The student decides what each body paragraph will argue while they can see
  // all of them side by side, so the introduction is written with that plan in
  // front of them instead of signposting arguments that do not exist yet.
  //
  // Planning writes straight into the paragraphs, so arriving at a paragraph
  // later lands on the writing surface rather than back on a picker. It is a
  // recommendation, never a gate: a student can skip it and choose as they go,
  // and any row can be left unchosen.
  // ===========================================================================
  function esIsIntro(p) { return /^(introduction|intro)/i.test((p && p.role) || ""); }
  function esIsConcl(p) { return /^conclusion/i.test((p && p.role) || ""); }
  function esBodyIndexes(d) { return (d.paras || []).map((p, i) => i).filter(i => !esIsIntro(d.paras[i]) && !esIsConcl(d.paras[i])); }
  // The parts of the question its pathways are written against, in authored order.
  function esAreasRequired(q) { return (((q || esQuestionDef() || {}).requirements || {}).requiredAreas || []).length > 0; }
  function esQuestionAreas() {
    const q = esQuestionDef(); const out = [];
    ((q && q.pathways) || []).forEach(x => { if (x.area && out.indexOf(x.area) < 0) out.push(x.area); });
    return out;
  }
  function esAreasLabel() { const q = esQuestionDef(); return (q && q.areasLabel) || "area"; }
  function esPathwaysInArea(area) {
    const q = esQuestionDef(); const all = (q && q.pathways) || [];
    if (!area) return all;
    return all.filter(x => String(x.area || "").toLowerCase() === String(area).toLowerCase());
  }
  // One line of what a paragraph argues: the authored relationship, or the
  // student's own words, which are kept exactly as they wrote them.
  function esArgLine(p) { const path = esPathway(p); return path ? path.relationship : (p.ownArgument || ""); }
  function esWordsOf(t) { return String(t || "").trim().split(/\s+/).filter(Boolean).length; }
  function esResponseWords(d) { return (d.paras || []).reduce((n, pp) => n + esWordsOf(pp.text), 0); }
  function esPlanned(d) { const idx = esBodyIndexes(d); return idx.length > 0 && idx.every(i => !!d.paras[i].argumentId); }
  // One argument is enough to have something to say overall. Waiting for a
  // complete plan before the thesis box appears would put back the gate the
  // progressive route exists to remove.
  function esPartlyPlanned(d) { return esBodyIndexes(d).some(i => !!d.paras[i].argumentId); }
  // Every body argument the student has established, for the introduction to
  // signpost and for the conclusion to draw together.
  function esPlanRows(d) {
    return esBodyIndexes(d).map(i => ({
      i: i, role: d.paras[i].role, area: d.paras[i].area || "",
      argument: esArgLine(d.paras[i]), words: esWordsOf(d.paras[i].text),
      wrote: esWrittenClaim(d.paras[i]),
      evidence: (d.paras[i].evidenceIds || []).slice()
    }));
  }
  // A structure whose body count matches the number of parts in the question.
  function esStructureForBodies(n) {
    const S = (window.ESSAY && window.ESSAY.structures) || [];
    return S.find(x => (x.roles || []).filter(r => !/^(introduction|intro|conclusion)/i.test(r)).length === n) || null;
  }
  function esApplyStructure(key) {
    const d = ES.draft;
    d.structure = key; d.paras = esBuildParas(key, d.paras);
    d.pos = Math.min(d.pos || 0, d.paras.length - 1);
    esSaveDraft();
  }

  // ---- the core answer, and the thesis it eventually becomes ------------------
  function esCoreAnswer() { const q = esQuestionDef(); return (q && q.coreAnswer) || null; }
  // A question's MODE decides what its top-level answer has to contain. A causal
  // question needs a relationship; a judgement question needs a position, held
  // against criteria, that its body arguments add up to. Reading the mode rather
  // than layering conditions around the causal case is what lets both live here.
  function esCoreMode() { const c = esCoreAnswer(); return (c && c.mode) || "causal"; }
  function esIsJudgement() { return esCoreMode() === "judgement"; }
  function esCoreRelationship() {
    const c = esCoreAnswer(), q = esQuestionDef();
    return (c && c.statement) || (q && q.decode && q.decode.coreRelationship) || "";
  }
  function esPositions() { const c = esCoreAnswer(); return (c && c.positions) || []; }
  function esPositionOf(d) {
    const id = d && d.position;
    if (!id) return null;
    if (String(id).indexOf("own:") === 0) return { id: id, label: String(id).slice(4), own: true };
    return esPositions().find(x => x.id === id) || null;
  }
  // What each chosen argument does FOR the judgement, so the conclusion has
  // something to weigh instead of four topics to repeat.
  const ES_ROLES = { support: "supports it", conditional: "supports it, with a condition", limitation: "pushes against it" };
  function esContributionOf(p) {
    const path = esPathway(p);
    return (path && path.contribution) || null;
  }
  // ---------------------------------------------------------------------------
  // THE WORKING ANSWER
  //
  // What the arguments the student has CHOSEN add up to, rebuilt as they choose
  // them. It is derived, not written: assembled from phrases the question
  // authored, so it costs nothing and cannot drift from the student's choices.
  // It is NOT the student's thesis. It never touches their prose.
  //
  // Its source of truth is the plan, so it states intent, not achievement. A
  // student can select training raises productivity and then write a paragraph
  // that establishes nothing of the kind, and this would not know. Every label
  // on it therefore says "the arguments you have chosen", never "your
  // paragraphs argue". When paragraph diagnosis lands (P2), the written half of
  // each part can be sourced from what the diagnosis actually found, and only
  // then may the wording claim the response establishes anything.
  // ---------------------------------------------------------------------------
  function esWorkingParts(d) {
    return esBodyIndexes(d).map(i => {
      const p = d.paras[i], path = esPathway(p);
      if (!path) return null;
      // written is "there is prose here", NOT "this argument is established".
      // Nothing reads this paragraph. Do not let a label imply otherwise.
      return { i: i, role: p.role, adds: path.adds || "", short: path.short || "",
               role_: (path.contribution || {}).role || "", written: esWordsOf(p.text) > 0 };
    }).filter(x => x && x.adds);
  }
  // Two paragraphs may deliberately argue the same relationship. The plan shows
  // both, and warns about it, because they are two real paragraphs. The ANSWER
  // must say it once: a response does not argue something twice as hard for
  // having been written out twice, and listing a phrase twice reads as a fault
  // in the app rather than a choice by the student.
  function esDistinctParts(parts) {
    const out = [], at = {};
    parts.forEach(x => {
      const k = String(x.adds || "").toLowerCase().trim();
      if (!k) return;
      if (at[k] === undefined) { at[k] = out.length; out.push(x); return; }
      // keep the position of the first, but let a written paragraph win the
      // "written" flag: collapsing two paragraphs must not lose the prose
      if (x.written && !out[at[k]].written) out[at[k]] = Object.assign({}, out[at[k]], { written: true, i: x.i });
    });
    return out;
  }
  function esOwnArguments(d) {
    return esBodyIndexes(d).filter(i => String((d.paras[i] || {}).argumentId || "").indexOf("own:") === 0);
  }
  function esWorkingAnswer(d) {
    const q = esQuestionDef();
    const w = (q && q.workingAnswer) || null;
    if (!w) return null;
    const own = esOwnArguments(d).length;
    const parts = esDistinctParts(esWorkingParts(d));
    if (!parts.length) return { text: w.base, broad: true, from: 0, written: 0, own: own };
    const adds = parts.map(x => x.adds);
    const join = w.join || ", and";
    const list = adds.length === 1 ? adds[0]
      : adds.slice(0, -1).join(", ") + join + " " + adds[adds.length - 1];
    let text = (w.lead || w.base) + " " + list;
    // a judgement only picks up its qualifier once something qualifies it
    if (w.qualifier && parts.some(x => x.role_ === "conditional" || x.role_ === "limitation")) {
      text += ", " + w.qualifier;
    }
    return { text: text.replace(/\s+/g, " ").trim() + ".", broad: false, own: own,
             from: parts.length, written: parts.filter(x => x.written).length };
  }
  // ---------------------------------------------------------------------------
  // COVERAGE RECOVERY
  //
  // The review can name a required part the response has not addressed and offer
  // a way back to it. Finding "somewhere to put it" must never mean taking over
  // work the student has already done: a paragraph with a planned argument is
  // theirs, and a paragraph with prose in it is theirs even if nothing has been
  // declared about it. So this only ever labels a body that is BOTH unassigned
  // and empty. When there is no such body it either offers to add one, saying so
  // in the button, or simply navigates and changes nothing.
  // ---------------------------------------------------------------------------
  function esCoverPlan(d, area) {
    const bodies = esBodyIndexes(d);
    const already = bodies.find(k => d.paras[k].area === area);
    if (already != null) return { act: "go", i: already, label: "Go to " + area };
    const free = bodies.find(k => !d.paras[k].area && !esWordsOf(d.paras[k].text));
    if (free != null) return { act: "assign", i: free, label: "Go to " + area };
    const grow = esStructureForBodies(bodies.length + 1);
    if (grow) return { act: "grow", key: grow.key, label: "Add a paragraph for " + area };
    const unlabelled = bodies.find(k => !d.paras[k].area);
    return { act: "go", i: unlabelled != null ? unlabelled : bodies[bodies.length - 1], label: "Go to " + area };
  }
  function esList(xs) {
    const a = (xs || []).map(x => String(x));
    if (a.length <= 1) return a[0] || "";
    return a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
  }
  function esWrittenClaim(p) {
    const b = esBlocks(p)[0];
    const t = ((b && b.text) || "").trim();
    return t.length > 8 ? t : "";
  }
  function esJudgementRows(d) {
    return esPlanRows(d).map(r => {
      const c = esContributionOf(d.paras[r.i]);
      return Object.assign({}, r, { role: c && c.role, roleLabel: c && ES_ROLES[c.role], roleNote: c && c.note,
        wrote: esWrittenClaim(d.paras[r.i]) });
    });
  }
  // Rich while it is being read, one quiet line once it has been. Leaving the
  // teaching card open through the whole of planning would put back the density
  // the writing screen just lost.
  // One line saying what shape the answer takes, with the teaching one press
  // away. Understanding is not an action a student has to certify, so there is
  // nothing to confirm and nothing to collapse.
  function esCoreHTML(d) {
    const core = esCoreAnswer(); const rel = esCoreRelationship();
    if (!core && !rel) return "";
    const pattern = (core && core.pattern) || "";
    const open = ES.ui.coreExplain || ES.ui.coreIdea;
    return `<div class="es-core${open ? " open" : ""}">
      <div class="es-corerow">
        <span class="es-corelbl">How to build this answer</span>
        ${pattern ? `<span class="es-corepat">${esc(pattern)}</span>` : ""}
        <button type="button" class="es-linkbtn" id="escoreexplain">${ES.ui.coreExplain ? "Hide" : "Explain this"}</button>
        ${core && core.thesisIdea ? `<button type="button" class="es-linkbtn" id="escoreidea">${ES.ui.coreIdea ? "Hide" : "Thesis help"}</button>` : ""}
      </div>
      ${ES.ui.coreExplain ? `<div class="es-corebody">
        ${rel ? `<p class="es-corerel">${esc(rel)}</p>` : ""}
        ${(core && (core.explain || []).length) ? core.explain.map(x => `<p class="es-corep">${esc(x)}</p>`).join("") : ""}
      </div>` : ""}
      ${(ES.ui.coreIdea && core && core.thesisIdea) ? `<div class="es-corebody"><div class="es-drawer-sub">a thesis idea, not a sentence to copy</div><p class="es-corep">${esc(core.thesisIdea)}</p></div>` : ""}
    </div>`;
  }
  // Two decisions, not one: what do I think, and what will I use to prove it.
  // Offered before the body plan because the arguments are chosen to serve it.
  //
  // A position is a recommended orientation, never an entry requirement. A
  // student who cannot yet evaluate the question is allowed to start body 1,
  // learn something, build an argument and form the judgement afterwards, so
  // "I will decide as I go" is a first-class answer that closes this panel
  // rather than an unanswered question left sitting open above the plan.
  function esJudgementHTML(d) {
    if (!esIsJudgement()) return "";
    const core = esCoreAnswer();
    const chosen = esPositionOf(d);
    const open = ES.ui.posOpen || (!chosen && !d.posDefer);
    if (!open && chosen) return `<div class="es-judge done">
      <span class="es-corelbl">Your judgement</span>
      <span class="es-judgeline">${esc(chosen.label)}</span>
      <button type="button" class="es-linkbtn" id="esposopen">Change</button>
    </div>`;
    if (!open) return `<div class="es-judge done">
      <span class="es-corelbl">Your judgement</span>
      <span class="es-judgeline">deciding as you write</span>
      <button type="button" class="es-linkbtn" id="esposopen">Take a position</button>
    </div>`;
    return `<div class="es-judge">
      <div class="es-judgeh">What do you think overall?</div>
      <p class="es-plansub">${esc((core && core.judging) ? "You are judging " + core.judging + "." : "")} Take a position now if you have one. If you do not yet, start writing and decide once you have an argument in front of you. You can change it either way, and a one-sided judgement is still a judgement.</p>
      ${esPositions().map(o => `<button type="button" class="es-pick ${(chosen && chosen.id === o.id) ? "on" : ""}" data-espos="${esc(o.id)}">
          <span class="es-pickrel">${esc(o.label)}</span>${o.note ? `<span class="es-picksub">${esc(o.note)}</span>` : ""}</button>`).join("")}
      <button type="button" class="es-pick own" data-esposown>Write my own position</button>
      <div class="es-ownwrap" data-posownwrap hidden>
        <input id="esposown" class="es-input" value="${esc(chosen && chosen.own ? chosen.label : "")}" placeholder="In one line, how effective do you think they are?">
        <button type="button" class="es-btn primary sm" id="esposownok">Use this</button>
      </div>
      ${(core && (core.criteria || []).length) ? `<button type="button" class="es-linkbtn" id="escrit">${ES.ui.critOpen ? "Hide" : "What am I judging it against?"}</button>
        ${ES.ui.critOpen ? `<div class="es-corebody">${core.criteria.map(c => `<div class="es-drawer-sub">${esc(c.label)}</div><p class="es-corep">${esc(c.note)}</p>`).join("")}</div>` : ""}` : ""}
      <div class="es-corebtns">
        ${chosen ? `<button type="button" class="es-btn sm" id="esposdone">That is my position</button>` : ""}
        ${chosen ? "" : `<button type="button" class="es-linkbtn" id="esposdefer">I will decide as I go</button>`}
      </div>
    </div>`;
  }
  // ---------------------------------------------------------------------------
  // JUDGEMENT AGAINST ARGUMENT SHAPE
  //
  // A position and the arguments chosen under it can disagree, and that is
  // useful: it is the moment a student finds out what they actually think. What
  // it is NOT is arithmetic. Three limitations do not make "highly effective"
  // wrong, and this never downgrades a judgement, never reorders the positions
  // and never marks anything. It asks one question, once, and the student
  // answers it. Dismissal is remembered against the argument count, so it comes
  // back only if the shape moves again.
  //
  // The trigger reads the authored `lean` on the position, not the label text,
  // so a question can add positions without this guessing at their meaning. A
  // position the student wrote themselves has no lean, so it is left alone.
  // ---------------------------------------------------------------------------
  function esShapeKey(pos, n) {
    return [pos.id, n.support, n.conditional, n.limitation].join(":");
  }
  function esPositionTension(d) {
    if (!esIsJudgement()) return null;
    const pos = esPositionOf(d);
    if (!pos || pos.own || !pos.lean) return null;
    // distinct arguments, for the same reason the answer lists them once: a
    // relationship argued in two paragraphs is one thing the response says
    const parts = esDistinctParts(esWorkingParts(d)).filter(x => x.role_);
    if (parts.length < 2) return null;
    const n = { support: 0, conditional: 0, limitation: 0 };
    parts.forEach(x => { if (n[x.role_] != null) n[x.role_]++; });
    const qualifying = n.conditional + n.limitation;
    let ask = "";
    if (pos.lean === "positive" && qualifying > n.support) {
      ask = "Most of the arguments you have chosen qualify that judgement or push against it.";
    } else if (pos.lean === "negative" && n.support > qualifying) {
      ask = "Most of the arguments you have chosen support what you are judging rather than limiting it.";
    } else if (pos.lean === "qualified" && parts.length >= 3 && (n.support === parts.length || n.limitation === parts.length)) {
      ask = "Every argument you have chosen pulls the same way.";
    }
    if (!ask) return null;
    // Keyed to the SHAPE that was dismissed, not to how many arguments there were
    // when it was. Swapping a support for a limitation leaves the count identical
    // and changes everything the question is about, so a count would stay quiet
    // exactly when it should speak.
    if (d.posSeenShape === esShapeKey(pos, n)) return null;
    return { ask: ask, label: pos.label, n: parts.length, shape: esShapeKey(pos, n) };
  }
  function esPositionTensionHTML(d) {
    const t = esPositionTension(d);
    if (!t) return "";
    return `<div class="es-drift tension">
      <div class="es-drifth">Does your judgement still fit your arguments?</div>
      <p class="es-corep">You said <b>${esc(t.label)}</b>. ${esc(t.ask)}</p>
      <span class="es-wanote">A judgement is not a count of paragraphs, so this may be exactly right. It is worth knowing you can defend it.</span>
      <div class="es-corebtns">
        <button type="button" class="es-btn sm" id="espostension">Change my judgement</button>
        <button type="button" class="es-linkbtn" id="esposkeep">It still fits</button>
      </div>
    </div>`;
  }
  // The thesis can be written as soon as there is one argument to write it about.
  // It signposts what has been decided so far, not a finished design.
  // The working answer moves as arguments are added. The student's own thesis
  // sentence does not, and must not: it is theirs. When the two diverge, the
  // divergence is shown and the revision is left to them.
  function esThesisDriftHTML(d) {
    const yours = (d.thesis || "").trim(); if (!yours) return "";
    const wa = esWorkingAnswer(d); if (!wa || wa.broad) return "";
    if (d.thesisSeenText === wa.text) return "";
    return `<div class="es-drift">
      <div class="es-drifth">Your argument choices have moved on since you wrote your thesis</div>
      <div class="es-driftblk"><span class="es-corelbl">you wrote</span><p class="es-corep">${esc(yours)}</p></div>
      <div class="es-driftblk"><span class="es-corelbl">based on the arguments you have chosen</span><p class="es-corep model">${esc(wa.text)}</p>
        <span class="es-wanote">this comes from the arguments you picked, not from reading your paragraphs</span></div>
      <div class="es-corebtns">
        <button type="button" class="es-btn sm" id="esdriftrevise">Revise my thesis</button>
        <button type="button" class="es-linkbtn" id="esdriftkeep">Mine still stands</button>
      </div>
    </div>`;
  }
  function esThesisHTML(d) {
    if (!esPartlyPlanned(d)) return "";
    const judging = esIsJudgement();
    const rows = judging ? esJudgementRows(d) : esPlanRows(d);
    const pos = esPositionOf(d);
    const core = esCoreAnswer();
    const yours = (d.thesis || "").trim();
    return `<div class="es-thesis">
      <div class="es-planhh sm">${esPlanned(d) ? "Now turn your plan into an overall answer" : "What is your overall answer so far?"}</div>
      ${judging && pos ? `<div class="es-thesispos"><span class="es-corelbl">Your judgement</span><span>${esc(pos.label)}</span></div>` : ""}
      <ul class="es-thesisplan">${rows.map(r => `<li><span class="es-tparea">${esc(r.area || r.role)}</span><span class="es-tpargs">${esc(r.argument)}${r.roleLabel ? `<span class="es-tprole ${esc(r.role)}">${esc(r.roleLabel)}</span>` : ""}</span></li>`).join("")}</ul>
      <label class="es-pinlabel" for="esthesis">write your thesis</label>
      <textarea id="esthesis" class="es-input" rows="3" placeholder="One or two sentences giving the overall answer to the question.">${esc(d.thesis || "")}</textarea>
      <p class="es-thesisguide">${judging
        ? "Three things: how effective you think they are, the main reason you think it, and what it depends on if your evidence calls for a qualification. Do not add a limitation you cannot support."
        : "Give the overall answer to the question, and signpost the arguments you have chosen."}</p>
      <div class="es-corebtns">
        <button type="button" class="es-btn sm" id="esthesissave">Save thesis</button>
        ${(core && core.acceptableThesis) ? `<button type="button" class="es-linkbtn" id="escompare">${ES.ui.compare ? "Hide" : (yours ? "Compare with an acceptable thesis" : "I need to see an example first")}</button>` : ""}
      </div>
      ${esThesisDriftHTML(d)}
      ${(ES.ui.compare && core && core.acceptableThesis) ? `<div class="es-compare">
        ${yours ? `<div class="es-cmpblk"><div class="es-drawer-sub">yours</div><p class="es-corep">${esc(yours)}</p></div>` : ""}
        <div class="es-cmpblk"><div class="es-drawer-sub">one acceptable thesis</div><p class="es-corep model">${esc(core.acceptableThesis)}</p></div>
        ${(core.checklist || []).length ? `<div class="es-cmpblk"><div class="es-drawer-sub">check whether yours</div>
          <ul class="es-cmplist">${core.checklist.map(c => `<li>${esc(c)}</li>`).join("")}</ul></div>` : ""}
        <p class="es-drawer-note">Nothing here is written into your answer. It is here to calibrate against, not to copy.</p>
      </div>` : ""}
    </div>`;
  }
  function esBindCore() {
    const host = document.getElementById("eshost"); if (!host) return;
    const d = ES.draft;
    const ex = host.querySelector("#escoreexplain"); if (ex) ex.onclick = () => { ES.ui.coreExplain = !ES.ui.coreExplain; esRender(); };
    const id = host.querySelector("#escoreidea"); if (id) id.onclick = () => { ES.ui.coreIdea = !ES.ui.coreIdea; esRender(); };
    const th = host.querySelector("#esthesis");
    const save = host.querySelector("#esthesissave");
    if (th && save) save.onclick = () => {
      const was = d.thesis || "";
      d.thesis = th.value.trim();
      const wa0 = esWorkingAnswer(d); d.thesisSeenText = (wa0 && wa0.text) || "";
      const i = d.paras.findIndex(pp => esIsIntro(pp));
      let seeded = false;
      if (i >= 0) {
        const ip = d.paras[i];
        ip.point = d.thesis;                       // the plan the marker reads
        const blocks = esBlocks(ip);
        if (d.thesis && !blocks.length) {
          const nb = esNewBlock(d, d.thesis, (slotsForRole(ip.role)[0] || {}).key || null, "written");
          nb.fromThesis = true;
          ip.blocks = [nb]; esCommitBlocks(ip); seeded = true;
        } else if (d.thesis && blocks[0] && blocks[0].fromThesis && blocks[0].text === was) {
          blocks[0].text = d.thesis; esCommitBlocks(ip); seeded = true;   // still theirs, still in step
        }
      }
      esSaveDraft(); esRender();
      toast(!d.thesis ? "Thesis cleared."
        : seeded ? "Saved. Your introduction now opens with it."
        : "Saved as your introduction's overall line. The introduction you have already written is untouched.");
    };
    const dk = host.querySelector("#esdriftkeep");
    if (dk) dk.onclick = () => { const wa = esWorkingAnswer(d); d.thesisSeenText = (wa && wa.text) || ""; esSaveDraft(); esRender(); };
    const dr = host.querySelector("#esdriftrevise");
    if (dr) dr.onclick = () => { const el = host.querySelector("#esthesis"); if (el) { el.focus(); el.selectionStart = el.value.length; } };
    const cmp = host.querySelector("#escompare");
    if (cmp) cmp.onclick = () => { if (th) { d.thesis = th.value.trim(); esSaveDraft(); } ES.ui.compare = !ES.ui.compare; esRender(); };
  }

  // Where a response begins. It is not a planning exercise to be completed: it
  // shows what the response will be, offers three ways in, and lets the student
  // take any of them. Planning everything up front is one of the three.
  function esStartHTML(d) {
    const wa = esWorkingAnswer(d);
    const judging = esIsJudgement();
    const pos = esPositionOf(d);
    const req = esAreasRequired() ? esRequiredAreas(esQuestionDef()) : [];
    const used = {};
    esBodyIndexes(d).forEach(i => { if (d.paras[i].area) used[d.paras[i].area] = d.paras[i].role; });
    const rows = d.paras.map((pp, i) => {
      const w = esWordsOf(pp.text);
      const path = esPathway(pp);
      const state = w ? "written" : path ? "planned" : "";
      return `<button type="button" class="es-startrow ${state}" data-esgo="${i}">
        <span class="es-plandot"></span><span class="es-plann">${esc(pp.role)}</span>
        <span class="es-startwhat">${path ? esc(path.short || path.relationship) : (esIsIntro(pp) || esIsConcl(pp)) ? "" : "not planned yet"}</span>
        <span class="es-startstate">${w ? w + " words" : path ? "planned" : ""}</span>
      </button>`;
    }).join("");
    const firstBody = esBodyIndexes(d)[0];
    return `<div class="es-startwrap">
      ${wa ? `<div class="es-wa">
        <div class="es-warow"><span class="es-corelbl">${judging ? "Your answer so far" : "Working answer"}</span>
          ${wa.broad && !wa.own ? `<span class="es-wanote">this develops as you choose arguments</span>`
            : wa.broad ? `<span class="es-wanote">your ${wa.own === 1 ? "argument is" : wa.own + " arguments are"} in your own words, so this line stays broad</span>`
            : `<span class="es-wanote">from ${wa.from} argument${wa.from === 1 ? "" : "s"} you have chosen${wa.written ? ", " + wa.written + " written" : ", none written yet"}${wa.own ? ", and " + wa.own + " of your own that this line does not put into words for you" : ""}</span>`}</div>
        <p class="es-watext">${esc(wa.text)}</p>
        ${judging && pos ? `<div class="es-wapos"><span class="es-corelbl">Your current judgement</span><span>${esc(pos.label)}</span>
          <button type="button" class="es-linkbtn" id="esposopen">Change</button></div>`
          : ""}
      </div>` : ""}
      ${req.length ? `<div class="es-cover">
        <span class="es-corelbl">Required in your response</span>
        ${req.map(a => `<span class="es-covitem ${used[a] ? "on" : ""}">${esc(a)}${used[a] ? " \u00b7 " + esc(used[a]) : ""}</span>`).join("")}
        <span class="es-wanote">start anywhere; this is checked before you submit</span>
      </div>` : ""}
      <div class="es-startrows">${rows}</div>
      <div class="es-startbtns">
        <button class="es-btn primary" id="esstartintro">Write the introduction</button>
        ${firstBody != null ? `<button class="es-btn ghost" id="esstartbody">Start ${esc(d.paras[firstBody].role.toLowerCase())}</button>` : ""}
        <button class="es-linkbtn" id="esplanall">Plan all paragraphs first</button>
      </div>
    </div>`;
  }
  function esRenderPlan(host, sc) {
    const d = ES.draft;
    const areas = esQuestionAreas();
    const bodies = esBodyIndexes(d);
    ES.ui.planOpen = ES.ui.planOpen || {};
    // Only a question that FIXES its parts can imply how many paragraphs there
    // are. Four available strategies is not a demand for four paragraphs.
    const required = esAreasRequired();
    const suggest = required && areas.length && areas.length !== bodies.length ? esStructureForBodies(areas.length) : null;

    const cards = bodies.map((i, k) => {
      const p = d.paras[i];
      const area = p.area || (required ? (areas[k] || "") : "");
      const usedElsewhere = {};
      bodies.forEach(j => { if (j !== i && d.paras[j].area) usedElsewhere[d.paras[j].area] = d.paras[j].role; });
      const chosen = !!p.argumentId;
      // Two paragraphs arguing the identical relationship is usually a slip, and
      // occasionally deliberate. Say so and let the student decide; blocking it
      // would be the app asserting that reuse is never legitimate.
      const twin = chosen ? esTwinOf(d, i) : undefined;
      // Rich while deciding, compact once decided, and only one open at a time so
      // the page is a sequence of decisions rather than four panels stacked up.
      const firstUnchosen = bodies.find(j => !d.paras[j].argumentId);
      const open = ES.ui.planOpen[i] === true || (!chosen && i === firstUnchosen && ES.ui.planOpen[i] !== false);
      // Showing all eight relationships before the student has said which strategy
      // they are arguing is a list, not a choice. The area comes first.
      const opts = (!area && !required) ? [] : esPathwaysInArea(area);
      const judgeMode = esIsJudgement();
      const ev = chosen ? esEvidenceFor(p) : { items: [] };
      const picked = p.evidenceIds || [];
      const areaRow = areas.length > 1 ? `
        ${required ? "" : `<div class="es-planask">${area
          ? "What will you argue about " + esc(area) + "?"
          : "Which " + esc(esAreasLabel()) + " will " + esc(p.role) + " use?"}</div>`}
        <div class="es-planareas">${areas.map(a => {
          const on = String(a).toLowerCase() === String(area).toLowerCase();
          const used = usedElsewhere[a];
          // A badge, not a dimming. Pale grey reads as "you cannot pick this",
          // and picking it again with a different argument is legitimate.
          return `<button type="button" class="es-areachip ${on ? "on" : ""}" data-esplanarea="${i}|${esc(a)}"${used && !on ? ` title="already argued in ${esc(used)}, you can still argue something different here"` : ""}>${esc(a)}${(used && !on) ? `<span class="es-areaused">used in ${esc(used)}</span>` : ""}</button>`;
        }).join("")}</div>` : "";
      const body = open ? `
        ${areaRow}
        ${(!area && !required) ? "" : `<div class="es-planopts">
          ${opts.map(o => {
            const why = ES.ui.why === o.id;
            const deeper = o.whatToProve || o.commonMistake;
            return `<div class="es-optwrap${why ? " open" : ""}">
              <button type="button" class="es-pick ${p.argumentId === o.id ? "on" : ""}" data-esplanpick="${i}|${esc(o.id)}">
                ${o.short ? `<span class="es-pickshort">${esc(o.short)}</span>${(judgeMode && o.contribution) ? `<span class="es-tprole ${esc(o.contribution.role)}">${esc(ES_ROLES[o.contribution.role] || "")}</span>` : ""}` : ""}
                <span class="es-pickrel">${esc(o.relationship)}</span>
                ${esChoiceMeaning(o) ? `<span class="es-picksub">${esc(esChoiceMeaning(o))}</span>` : ""}
              </button>
              ${deeper ? `<button type="button" class="es-why ${why ? "on" : ""}" data-eswhy="${esc(o.id)}" aria-expanded="${why}">${why ? "Hide" : "Why?"}</button>` : ""}
              ${why ? `<div class="es-whybox">
                ${o.whatToProve ? `<div class="es-drawer-sub">what you would need to show</div><p class="es-corep chain">${esc(o.whatToProve)}</p>` : ""}
                ${o.commonMistake ? `<div class="es-drawer-sub">common mistake</div><p class="es-corep miss">${esc(o.commonMistake)}</p>` : ""}
                <button type="button" class="es-btn sm" data-esplanpick="${i}|${esc(o.id)}">Choose this argument</button>
              </div>` : ""}
            </div>`;
          }).join("")}
          <button type="button" class="es-pick own" data-esplanown="${i}">Write my own argument</button>
          <div class="es-ownwrap" data-ownwrap="${i}" hidden>
            <input class="es-input" data-esplanowninput="${i}" value="${esc(p.ownArgument || "")}" placeholder="In one line, the relationship this paragraph argues">
            <button type="button" class="es-btn primary sm" data-esplanownok="${i}">Use this</button>
          </div>
        </div>`}` : `
        ${(() => { const path = esPathway(p);
          return path && path.short ? `<div class="es-planshort">${esc(path.short)}</div>` : ""; })()}
        <div class="es-planval">${esc(esArgLine(p)) || `<span class="es-restnone">not chosen yet</span>`}</div>
        ${(() => { const path = esPathway(p);
          return path && path.meaning ? `<p class="es-planmeaning">${esc(path.meaning)}</p>` : ""; })()}
        <button type="button" class="es-linkbtn" data-esplanedit="${i}">${chosen ? "Change" : "Choose"}</button>`;
      const evRow = (chosen && !open) ? `
        <div class="es-planev">
          <span class="es-planevlbl">evidence</span>
          ${ev.items.length ? ev.items.map(e => `<button type="button" class="es-evchip ${picked.indexOf(e.label) >= 0 ? "on" : ""}" data-esplanev="${i}|${esc(e.label)}">${esc(e.label)}</button>`).join("")
            : `<span class="es-planevnote">${ev.none === "custom" ? "Nothing is linked to your own argument. The Evidence tool stays open to you."
                : ev.none === "unverified" ? "No verified examples are available for this argument yet. You can still use your own."
                : "No evidence has been linked to this argument yet."}</span>`}
          ${ev.items.length ? `<span class="es-planevnote">optional now, and you can change it when you get there</span>` : ""}
        </div>` : "";
      // Four full cards to say "not chosen yet" three times is a lot of screen to
      // spend on decisions nobody is making. Only the one in hand is a card.
      if (!chosen && !open) return `<div class="es-planrow">
        <span class="es-plandot"></span><span class="es-plann">${esc(p.role)}</span>
        <span class="es-planidle">not planned yet</span>
        <button type="button" class="es-linkbtn" data-esplanedit="${i}">Choose</button>
      </div>`;
      const twinNote = chosen ? esTwinHTML(d, i) : "";
      return `<div class="es-plancard ${chosen ? "done" : ""}${open ? " open" : ""}">
        <div class="es-planh"><span class="es-plandot"></span><span class="es-plann">${esc(p.role)}</span>${area ? `<span class="es-planarea">${esc(area)}</span>` : ""}</div>
        ${body}${twinNote}${evRow}
      </div>`;
    }).join("");

    const done = esPlanned(d);
    host.innerHTML = `
    <div class="es-scrim"><div class="es-shell"><div class="es-wrap es-canvas">
      ${esWritingHead(sc, "Planning", "full attempt", "full")}
      <div class="es-planwrap">
        <div class="es-planhead">
          <h3 class="es-planhh">${ES.ui.planAll ? "Plan your response" : "Your response"}</h3>
          <p class="es-plansub">${ES.ui.planAll
            ? "Choose the argument each paragraph will make. You are choosing relationships, not sentences."
            : "You do not have to plan it all first. Take a position if you have one, then start wherever is useful."}</p>
          ${suggest ? `<div class="es-plannote">This question has ${areas.length} parts and your structure has ${bodies.length} body paragraph${bodies.length === 1 ? "" : "s"}.
            <button type="button" class="es-linkbtn" id="esplanstruct">Use ${areas.length} body paragraphs</button></div>` : ""}
        </div>
        ${esCoreHTML(d)}
        ${(ES.ui.planAll || ES.ui.posOpen || (esIsJudgement() && !esPositionOf(d))) ? esJudgementHTML(d) : ""}
        ${esPositionTensionHTML(d)}
        ${ES.ui.planAll ? `<div class="es-plancards">${cards}</div>` : esStartHTML(d)}
        ${ES.ui.planAll ? esThesisHTML(d) : ""}
        ${ES.ui.planAll ? `<div class="es-planfoot">
          <button class="es-btn ${done ? "primary" : "ghost"}" id="esplango">${done ? "Write the introduction" : "Start writing anyway"}</button>
          <button class="es-linkbtn" id="esplanless">Back</button>
          <span class="es-planstate">${done ? "Your plan is set. You can change any of it while you write." : "You can leave any of these open and choose when you reach the paragraph."}</span>
        </div>` : ""}
      </div>
    </div></div></div>`;
    esBindWritingHead();
    esBindPlan();
    esBindCore();
  }
  function esBindPlan() {
    const host = document.getElementById("eshost"); if (!host) return;
    const d = ES.draft;
    const pair = v => { const k = String(v).indexOf("|"); return [Number(String(v).slice(0, k)), String(v).slice(k + 1)]; };
    host.querySelectorAll("[data-esplanarea]").forEach(b => b.onclick = () => {
      const [i, area] = pair(b.dataset.esplanarea);
      const p = d.paras[i];
      // switching the part of the question this paragraph covers clears an
      // argument that belonged to the old one, and says so through the same
      // precise rule the composer uses
      if (p.argumentId && esPathway(p) && String(esPathway(p).area || "").toLowerCase() !== area.toLowerCase()) esSetParagraphContext(p, null, []);
      p.area = area; ES.ui.planOpen[i] = true; esSaveDraft(); esRender();
    });
    host.querySelectorAll("[data-esplanpick]").forEach(b => b.onclick = () => {
      const [i, id] = pair(b.dataset.esplanpick);
      const p = d.paras[i], path = esPathwaysInArea("").find(x => x.id === id);
      const flagged = esSetParagraphContext(p, id, p.evidenceIds || []);
      p.area = (path && path.area) || p.area || ""; p.ownArgument = "";
      ES.ui.planOpen[i] = false; ES.ui.why = null; esSaveDraft(); esRender();
      if (flagged) toast(flagged + " sentence" + (flagged === 1 ? "" : "s") + " to check against the new argument.");
    });
    host.querySelectorAll("[data-esplanown]").forEach(b => b.onclick = () => {
      const i = Number(b.dataset.esplanown);
      const w = host.querySelector('[data-ownwrap="' + i + '"]');
      if (w) { w.hidden = false; const el = host.querySelector('[data-esplanowninput="' + i + '"]'); if (el) el.focus(); }
    });
    host.querySelectorAll("[data-esplanownok]").forEach(b => b.onclick = () => {
      const i = Number(b.dataset.esplanownok);
      const el = host.querySelector('[data-esplanowninput="' + i + '"]');
      const v = ((el && el.value) || "").trim(); if (!v) return;
      const p = d.paras[i];
      esSetParagraphContext(p, "own:" + v, p.evidenceIds || []);
      p.ownArgument = v; ES.ui.planOpen[i] = false; esSaveDraft(); esRender();
    });
    host.querySelectorAll("[data-esplanedit]").forEach(b => b.onclick = () => {
      ES.ui.planOpen[Number(b.dataset.esplanedit)] = true; esRender();
    });
    host.querySelectorAll("[data-esplanev]").forEach(b => b.onclick = () => {
      const [i, label] = pair(b.dataset.esplanev);
      const p = d.paras[i], list = (p.evidenceIds || []).slice();
      const k = list.indexOf(label);
      if (k >= 0) list.splice(k, 1); else list.push(label);
      const n = esSetParagraphContext(p, p.argumentId, list);
      esSaveDraft(); esRender();
      if (n) toast(n + " sentence" + (n === 1 ? "" : "s") + " used that evidence. Check " + (n === 1 ? "it" : "them") + ".");
    });
    esBindTwin(host);
    host.querySelectorAll("[data-eswhy]").forEach(b => b.onclick = () => {
      ES.ui.why = ES.ui.why === b.dataset.eswhy ? null : b.dataset.eswhy; esRender();
    });
    host.querySelectorAll("[data-espos]").forEach(b => b.onclick = () => {
      d.position = b.dataset.espos; d.positionOwn = ""; esSaveDraft(); esRender();
    });
    const pown = host.querySelector("[data-esposown]");
    if (pown) pown.onclick = () => { const w = host.querySelector("[data-posownwrap]"); if (w) { w.hidden = false; const el = host.querySelector("#esposown"); if (el) el.focus(); } };
    const pok = host.querySelector("#esposownok");
    if (pok) pok.onclick = () => {
      const v = ((host.querySelector("#esposown") || {}).value || "").trim(); if (!v) return;
      d.position = "own:" + v; ES.ui.posOpen = false; esSaveDraft(); esRender();
    };
    const pdone = host.querySelector("#esposdone"); if (pdone) pdone.onclick = () => { ES.ui.posOpen = false; esSaveDraft(); esRender(); };
    const popen = host.querySelector("#esposopen"); if (popen) popen.onclick = () => { ES.ui.posOpen = true; esRender(); };
    const pdef = host.querySelector("#esposdefer");
    if (pdef) pdef.onclick = () => { d.posDefer = true; ES.ui.posOpen = false; esSaveDraft(); esRender(); };
    const ptc = host.querySelector("#espostension"); if (ptc) ptc.onclick = () => { ES.ui.posOpen = true; esRender(); };
    const ptk = host.querySelector("#esposkeep");
    if (ptk) ptk.onclick = () => { const t = esPositionTension(d); if (t) d.posSeenShape = t.shape; esSaveDraft(); esRender(); };
    const crit = host.querySelector("#escrit"); if (crit) crit.onclick = () => { ES.ui.critOpen = !ES.ui.critOpen; esRender(); };
    const st = host.querySelector("#esplanstruct");
    if (st) st.onclick = () => { const def = esStructureForBodies(esQuestionAreas().length); if (def) { esApplyStructure(def.key); esRender(); } };
    const pa = host.querySelector("#esplanall"); if (pa) pa.onclick = () => { ES.ui.planAll = true; esRender(); };
    const pl = host.querySelector("#esplanless"); if (pl) pl.onclick = () => { ES.ui.planAll = false; esRender(); };
    const si = host.querySelector("#esstartintro");
    if (si) si.onclick = () => { esBodyIndexes(d).forEach(i => { if (d.paras[i].argumentId) d.paras[i].setupDone = true; });
      d.planned = true; d.pos = 0; ES.screen = "coached"; ES.ui.setupStage = null; esSaveDraft(); esRender(); };
    const sb = host.querySelector("#esstartbody");
    if (sb) sb.onclick = () => { const k = esBodyIndexes(d)[0]; d.planned = true; d.pos = k == null ? 0 : k;
      ES.screen = "coached"; ES.ui.setupStage = null; esSaveDraft(); esRender(); };
    host.querySelectorAll(".es-startrow[data-esgo]").forEach(b => b.onclick = () => {
      d.planned = true; d.pos = Number(b.dataset.esgo); ES.screen = "coached"; ES.ui.setupStage = null; esSaveDraft(); esRender();
    });
    const go = host.querySelector("#esplango");
    if (go) go.onclick = () => {
      // a planned paragraph never asks again
      esBodyIndexes(d).forEach(i => { if (d.paras[i].argumentId) d.paras[i].setupDone = true; });
      d.planned = true; d.pos = 0; ES.screen = "coached"; ES.ui.setupStage = null; esSaveDraft(); esRender();
    };
  }

  // ------------------------------ COACHED PRACTICE ------------------------------
  // One element at a time. Only the current paragraph renders: its planned point
  // pinned (muted) above, an editable box, that paragraph's feedback in the right
  // margin, and any toggled-open missing-element frames as ghosts beneath the box.
  // The stepper is a POSITION INDICATOR only; Back / Next move one paragraph.
  const ES_WHERE = { point: "as the opening sentence", analysis: "right after your point", evidence: "to back the point up", link: "at the end, tying back to the question", thesis: "as your opening line", methods: "right after your thesis", restate: "to open the conclusion", judgement: "as your final line" };
  function esRenderCoached(host, sc) {
    const d = ES.draft;
    if (d.pos < 0) d.pos = 0; if (d.pos > d.paras.length - 1) d.pos = d.paras.length - 1;
    const p = d.paras[d.pos];
    const total = d.paras.length, n = d.pos + 1;
    const blocks = esBlocks(p);
    const steps = slotsForRole(p.role);
    const si = esStepIndex(p);
    const step = steps[si] || null;
    const guide = esGuideFor(p, step);
    const editing = (ES.ui.editBlock != null && ES.ui.editBlock < blocks.length) ? ES.ui.editBlock : null;
    // While the paragraph is choosing its argument there is no writing surface at
    // all, so nothing hidden can take focus and nothing half-visible can confuse.
    const inSetup = esNeedsSetup(p) || !!ES.ui.setupStage;

    // The response map. It carries what each section ARGUES, not only its name,
    // and any written section can be read here without leaving the sentence being
    // written, so the student can look backwards while writing forwards.
    ES.ui.mapOpen = ES.ui.mapOpen || {};
    const map = d.paras.map((pp, i) => {
      const w = esWordsOf(pp.text);
      const cls = i === d.pos ? "on" : w ? "done" : "";
      // No argument text stands here. The current one is in the chip beside the
      // writing, and any other section is one click away through its own row.
      const open = !!ES.ui.mapOpen[i];
      const line = open ? ((esIsIntro(pp) || esIsConcl(pp)) ? (pp.point || "") : esArgLine(pp)) : "";
      return `<div class="es-mapwrap">
        <div class="es-maprow">
          <button type="button" class="es-mapitem ${cls}" data-esgo="${i}">
            <span class="es-mapdot"></span>
            <span class="es-maptext"><span class="es-maplbl">${esc(pp.role)}</span>${line ? `<span class="es-maparg">${esc(line)}</span>` : ""}</span>
          </button>
          ${w ? `<button type="button" class="es-mappeek ${open ? "on" : ""}" data-espeek="${i}" aria-expanded="${open}" title="${open ? "Hide" : "Read"} this section">${w}w</button>` : ""}
        </div>
        ${(open && w) ? `<div class="es-mapprev">${esc(pp.text)}</div>` : ""}
      </div>`;
    }).join("");

    // this paragraph's structural progress, small enough not to read as a form
    const prog = steps.map((st, k) => {
      const state = k < si ? "done" : k === si ? "now" : "";
      return `<span class="es-prog ${state}"><span class="es-progdot"></span>${esc(st.label)}</span>`;
    }).join("");

    // accepted sentences, as ordinary prose. Click one to reopen it.
    const prose = blocks.map((b, k) => editing === k
      ? `<div class="es-editrow"><textarea class="es-input es-linebox" data-esedit="${k}" rows="2">${esc(b.text)}</textarea>
         ${esEditGuideHTML(p, b)}
         <div class="es-linebtns"><button type="button" class="es-btn primary sm" data-essaveedit="${k}">Save</button><button type="button" class="es-linkbtn" data-escanceledit>Cancel</button><button type="button" class="es-linkbtn es-del" data-esdelblock="${k}">Delete sentence</button></div></div>`
      : `<span class="es-said ${(b.ambiguous || b.needsReview) ? "flagged" : ""}" data-esreopen="${k}" title="Click to rewrite this sentence">${esc(b.text)}</span>${(b.ambiguous || b.needsReview) ? `<span class="es-checkline">${esReviewWhy(b)} <button type="button" class="es-linkbtn" data-esreopen="${k}">Review sentence</button> <button type="button" class="es-linkbtn" data-esok="${k}">Still works</button></span>` : ""}`).join(" ");

    // Argument and evidence stop being cards and become chips once chosen. The
    // decision deserved a card while it was being made; carrying it at full size
    // through 800 words only competes with the paragraph.
    const chipArg = esArgLine(p);
    const chipEv = (p.evidenceIds || []).map(esEvidenceByLabel).filter(Boolean);
    const chips = (esIsIntro(p) || esIsConcl(p)) ? "" : `
      <div class="es-chips">
        ${chipArg ? `<button type="button" class="es-chip-arg" data-esrestchange="argument" title="Change what this paragraph argues">${esIcon("bulb")}<span>${esc(chipArg)}</span></button>`
                  : `<button type="button" class="es-chip-arg empty" data-esrestchange="argument">${esIcon("bulb")}<span>choose what this paragraph argues</span></button>`}
        ${chipEv.length ? chipEv.map(e => `<button type="button" class="es-chip-ev" data-esrestchange="evidence" title="Change your evidence">${esIcon("search")}<span>${esc(e.label)}</span></button>`).join("")
                  : `<button type="button" class="es-chip-ev empty" data-esrestchange="evidence">${esIcon("search")}<span>evidence</span></button>`}
        ${(p.point || "").trim() ? `<span class="es-chip-note" title="your note for this paragraph">${esc(p.point)}</span>` : ""}
        ${esLearning(p) ? `<button type="button" class="es-chip-more" data-eslessonchip title="what this argument means, and one thing to try">understand this argument</button>` : ""}
        <button type="button" class="es-chip-more" id="espointtoggle" title="a one line note of what this paragraph argues">${ES.ui.pointOpen ? "hide my point" : "edit my point"}</button>
      </div>`;
    const words = esWordsOf(p.text);
    const whole = esResponseWords(d);
    const target = esWordTarget(d);
    // the ladder follows whichever line is being written: the active one, or the
    // reopened block and the job IT was written to do
    const helpStep = editing != null
      ? (slotsForRole(p.role).find(x => x.key === (blocks[editing] || {}).slot) || step)
      : step;
    const rungs = esRungs(p, helpStep);
    const shown = Math.min(esHelpLevel(p, editing), rungs.length);
    const blanks = t => esc(t).replace(/\[[^\]]+\]/g, m => `<span class="es-hole">${m.slice(1, -1)}</span>`).replace(/_{3,}/g, '<span class="es-blank">____</span>');
    const helpRows = rungs.slice(0, shown).map(r => `
      <div class="es-rung ${r.kind || ""}">
        <span class="es-rungn">${r.level}</span>
        <div class="es-rungbody">
          <div class="es-runglbl">${esc(r.label)}${r.context ? ` <span class="es-rungctx">${esc(r.context)}</span>` : ""}</div>
          <div class="es-rungtext ${r.kind || ""}">${(r.kind === "frame") ? blanks(r.text) : esc(r.text)}</div>
          ${r.pattern ? `<div class="es-rungnote">Notice the pattern: ${esc(r.pattern)}. Now use the same reasoning on your own paragraph.</div>` : ""}
          ${r.kind === "example" ? `<div class="es-rungnote">Deliberately a different situation, so the shape transfers and the words cannot.</div>` : ""}
        </div>
      </div>`).join("");
    const next = rungs[shown];
    const help = !esGuidanceOn() || !rungs.length ? "" : `
      <div class="es-help">
        ${helpRows}
        <div class="es-helpbtns">
          ${next ? `<button type="button" class="es-helpask ${shown ? "on" : ""}" id="esmorehelp">${esc(shown === 0 ? "Help me" : (rungs[shown - 1].cta || "Show me more"))}</button>`
                 : `<span class="es-helpend">That is as far as the help goes. The sentence is yours to write.</span>`}
          ${shown ? `<button type="button" class="es-linkbtn" id="eshidehelp">Hide help</button>` : ""}
        </div>
      </div>`;

    // A paragraph is complete when every part of its structure has something in
    // it. That is a STATE, not a gate: writing more is one click away and nothing
    // is closed off, but the student is told they have built a whole argument
    // instead of being left in front of an empty box under the last label.
    const complete = steps.length > 0 && steps.every(st => blocks.some(bb => bb.slot === st.key)) && !ES.ui.moreLine;
    const nextPara = d.paras[d.pos + 1] || null;
    const doneCard = `
            <div class="es-done">
              <div class="es-doneh"><span class="es-donetick">${esIcon("check")}</span>Paragraph complete<span class="es-donew">${words} word${words === 1 ? "" : "s"}</span></div>
              <p class="es-donesub">Every part of this paragraph has something in it. Read it back before you move on: click any sentence above to rewrite it.</p>
              <div class="es-donebtns">
                <button type="button" class="es-btn primary" id="esdonenext">${nextPara ? "Continue to " + esc(nextPara.role.toLowerCase()) : "Review the whole response"}</button>
                <button type="button" class="es-linkbtn" id="esmoreline">Add another sentence</button>
                <button type="button" class="es-linkbtn" id="esdonecheck">Check this paragraph</button>
                <button type="button" class="es-linkbtn" id="esquizlink">Memorise it</button>
              </div>
            </div>`;
    const canAsk = (p.text || "").trim() && (!p.feedback || ((p.text || "").trim() !== (p.gradedText || "").trim()));
    const askLabel = ES.pending ? "Checking this paragraph…" : "Check this paragraph";

    host.innerHTML = `
    <div class="es-scrim"><div class="es-shell"><div class="es-wrap es-canvas">
      ${/* The writing screen owns the host itself, in the columns below, in every
            state including setup. The old flag made the stem render a second one
            whenever the argument picker was showing. */ ""}
      ${esWritingHead(sc, "Guided", "full attempt", "full", true)}
      ${esToolbeltHTML(p)}
      <div class="es-cols ${ES.ui.tool ? "withdrawer" : ES.ui.contextView ? "withctx" : esDecodeOf(esQuestionDef()) ? "withdec" : ""}">
        ${esDecodeHost(esQuestionDef())}
        <div class="es-compose">
          <div class="es-parahead">
            <button type="button" class="es-parapick" id="esmappop" aria-expanded="${ES.ui.mapPop ? "true" : "false"}">
              <span class="es-pararole">${esc(p.role)}</span><span class="es-parachev">\u25be</span></button>
            <aside class="es-map" ${ES.ui.mapPop ? "" : "hidden"}>
              <div class="es-maph">My response</div>
              ${(() => { const wa = esWorkingAnswer(d); if (!wa) return "";
                return `<button type="button" class="es-mapwa" id="esmapwa" title="What the arguments you have chosen add up to. It comes from your plan, not from reading your paragraphs.">
                  <span class="es-corelbl">${esIsJudgement() ? "current answer" : "working answer"}</span>
                  <span class="es-mapwatext">${esc(wa.text)}</span></button>`; })()}
              ${map}
              <div class="es-wordcount"${target ? ` title="Around ${target} words would be a full answer at ${esc(String(d.marks || 20))} marks. A guide, not a limit: write more if you have more to say."` : ""}>
                <span><b>${words}</b> here \u00b7 <b>${whole}</b> in all${target ? ` \u00b7 ~${target}` : ""}</span>
              </div>
            </aside>
            <span class="es-parameta">${words} words${target ? " \u00b7 ~" + esc(String(target)) : ""}</span>
            ${(() => { const st = esStepDef(p), all = slotsForRole(p.role);
              const i = all.findIndex(x => st && x.key === st.key);
              return ""; })()}
            <span class="es-headacts">
              ${(esIsIntro(p) || esIsConcl(p)) ? `<button type="button" class="es-linkbtn es-ctxbtn" id="esctx" data-esctxview="${esIsConcl(p) ? "judgement" : "plan"}" aria-expanded="${ES.ui.contextView ? "true" : "false"}">${esIsConcl(p) ? "Review my arguments" : "View plan"}</button>` : ""}
              <button type="button" class="es-linkbtn" data-esnbtoggle aria-expanded="${ES.ui.nbOpen ? "true" : "false"}">notebook</button>
              <button type="button" class="es-mapall" id="esreview">read all</button>
            </span>
          </div>
          ${inSetup ? "" : chips}
          ${(esIsIntro(p) || esIsConcl(p) || (chipArg && !ES.ui.pointOpen && !inSetup)) ? "" : `<div class="es-pointpin">
            <label class="es-pinlabel" for="espoint">your point for this paragraph</label>
            <input id="espoint" class="es-pointin" value="${esc(p.point)}" placeholder="In one line, what does this ${esc(p.role.toLowerCase())} argue?">
            ${(esIsIntro(p) || esIsConcl(p)) ? "" : esReasoningHTML(p.point, p.dirSeen, { wantDegree: true })}
          </div>`}
          ${inSetup ? esSetupHTML(p) : ""}
          ${inSetup ? "" : `<div class="es-flow">
            ${esReviewBannerHTML(blocks)}
            ${blocks.length ? `<p class="es-prose">${prose}</p>` : `<p class="es-prose empty">Your paragraph builds here, one sentence at a time.</p>`}
            ${editing != null ? help : ""}
            ${editing != null ? "" : complete ? doneCard : `
            <div class="es-active">
              <div class="es-guide">
                <div class="es-guidetop">
                  <span class="es-guideh">${esc(guide.head)}</span>
                  <span class="es-steps">
                    <button type="button" class="es-step" id="esbackstep" ${si === 0 && !blocks.length ? "disabled" : ""} title="Back a step" aria-label="Back a step">&lsaquo;</button>
                    <span class="es-stepn">${si + 1}/${steps.length}</span>
                    <button type="button" class="es-step" id="esnextguide" ${si >= steps.length - 1 ? "disabled" : ""} title="Next guide" aria-label="Next guide">&rsaquo;</button>
                  </span>
                </div>
                <div class="es-guidejob">${esc(guide.job)}</div>
                ${(() => {
                  // The shapes are authored per stage and are content free. They teach
                  // the grammar of the sentence, which is a different thing from the
                  // instruction telling the student what it has to say.
                  const st = esStepDef(p); if (!st) return "";
                  const all = esShapesFor(st.key);
                  if (!all.length) return "";
                  // Rendered once and revealed in place. Showing the shape is a
                  // disclosure inside one component, not a change of application
                  // state, so it must not re-enter the render pipeline: that is what
                  // made a two-word control feel like the page reloading.
                  const open = !!ES.ui.shapeOpen;
                  return `<button type="button" class="es-linkbtn es-shapebtn" id="esshape" aria-expanded="${open}">${open ? "Hide sentence shape" : "Show sentence shape"}</button>
                    <div class="es-shapes" id="esshapes"${open ? "" : " hidden"}>${all.map(x =>
                      `<p class="es-shape">${esc(x).replace(/\[[^\]]+\]/g, m => `<span class="es-hole">${m.slice(1, -1)}</span>`).replace(/_{2,}/g, '<span class="es-blank">____</span>')}</p>`).join("")}</div>`;
                })()}
              </div>
              <textarea id="esline" class="es-input es-linebox" rows="2" placeholder="Type your next sentence..."></textarea>
              ${help}
              <div class="es-linerow">
                <button type="button" class="es-btn primary" id="esaccept" disabled>Add this sentence</button>
                <button type="button" class="es-linkbtn es-whenwriting" id="essamestep" hidden>add another at this stage</button>
              </div>
            </div>`}
          </div>`}
          <div class="es-navrow">
            ${canAsk ? `<button class="es-btn ghost sm" id="esask" ${ES.pending ? "disabled" : ""}>${askLabel}</button>` : ""}

          </div>
          <div class="es-linehost" data-linehost>${esLinesBlock(p)}</div>
          <div class="es-seqhost">${esSeqNudge(p)}</div>
        </div>
        ${ES.ui.tool ? esDrawerHTML(p) : esRestHTML(p)}
      </div>
    </div></div></div>`;

    esBindWritingHead();
    esBindReasoning(host, p, "#espoint");
    const pt = $("#espoint");
    // checked when they stop typing, not on every keystroke, and never by
    // re-rendering the screen out from under the next thing they press
    if (pt) pt.onblur = () => { esSaveDraft(); esRefreshDir(p); };
    if (pt) pt.oninput = () => {
      p.point = pt.value; esSaveDraft();
      // While the paragraph is still choosing, saying what it is about must narrow
      // the options AS IT IS TYPED. Only the card is replaced, so the cursor stays.
      if (inSetup) { esRefreshBelt(p); esRefreshSetup(p); return; }
      // Which tools have something behind them depends on what the paragraph is
      // about, so the belt wakes up as the student says what they are arguing.
      // Only the belt is replaced, so the cursor never leaves the point field.
      esRefreshBelt(p);
    };
    host.querySelectorAll("[data-esgo]").forEach(b => b.onclick = () => {
      d.pos = Number(b.dataset.esgo); p.step = si; ES.ui.editBlock = null; esResetCoachUI(); esSaveDraft(); esRender();
    });
    // reopen an accepted sentence
    host.querySelectorAll("[data-esreopen]").forEach(b => b.onclick = () => { ES.ui.editBlock = Number(b.dataset.esreopen); esRender(); });
    host.querySelectorAll("[data-esok]").forEach(b => b.onclick = e => {
      e.stopPropagation();
      const k = Number(b.dataset.esok), blk = esBlocks(p)[k];
      if (blk) { blk.ambiguous = false; blk.needsReview = false; esSaveDraft(); esRender(); }
    });
    const ce = host.querySelector("[data-escanceledit]"); if (ce) ce.onclick = () => { ES.ui.editBlock = null; esRender(); };
    host.querySelectorAll("[data-essaveedit]").forEach(b => b.onclick = () => {
      const k = Number(b.dataset.essaveedit);
      const ta = host.querySelector('[data-esedit="' + k + '"]');
      const v = (ta && ta.value || "").trim();
      if (v) p.blocks[k].text = v; else p.blocks.splice(k, 1);
      esCommitBlocks(p); ES.ui.editBlock = null; esSaveDraft(); esRender();
    });
    host.querySelectorAll("[data-esdelblock]").forEach(b => b.onclick = () => {
      p.blocks.splice(Number(b.dataset.esdelblock), 1);
      esCommitBlocks(p); ES.ui.editBlock = null; esSaveDraft(); esRender();
    });

    // Escape closes whatever is open and returns the student to their sentence.
    const scrimEl = host.querySelector(".es-scrim");
    if (scrimEl) scrimEl.onkeydown = e => {
      if (e.key === "Escape" && ES.ui.tool) { e.preventDefault(); e.stopPropagation(); ES.ui.tool = null; esRenderKeepingPlace(p); esFocusComposer(); }
    };
    const line = $("#esline"), accept = $("#esaccept");
    if (line && accept) {
      // Some controls take the student off the writing screen entirely: choosing an
      // argument, picking evidence. The sentence they were part way through lives
      // only in this textarea, so it is carried on ES.ui.ctx and handed back when
      // the composer returns to the same paragraph and the same step. Anything else
      // would be resurrecting a sentence into a place it was not written for.
      const c = ES.ui.ctx;
      if (c && c.text && !line.value && ES.draft && c.paragraph === ES.draft.pos
          && c.slot === ((esStepDef(p) || {}).key || null)) {
        line.value = c.text;
        try { line.setSelectionRange(c.selStart, c.selEnd); } catch (e) { /* older browsers */ }
        ES.ui.ctx = null;
      }
      const same = $("#essamestep");
      const sync = () => {
        const has = !!line.value.trim();
        accept.disabled = !has;
        if (same) same.hidden = !has;
      };
      line.oninput = sync; sync();
      line.onkeydown = e => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (!accept.disabled) accept.click(); }
      };
      if (!inSetup) line.focus();
      accept.onclick = () => {
        const v = line.value.trim(); if (!v) return;
        const nb = esNewBlock(d, v, step ? step.key : null, "written");
        nb.helpLevel = esHelpLevel(p, null);
        nb.helpContextVersion = Number(p.contextVersion) || 0;
        // A sentence written at the evidence step rests on whatever was selected then,
        // so it carries that provenance and can be flagged precisely later.
        if (step && /evidence|example/i.test(step.key)) nb.evidenceIds = (p.evidenceIds || []).slice();
        p.blocks = esBlocks(p).concat([nb]);
        esCommitBlocks(p);
        // advance a step unless the student chose to stay
        const stayed = ES.ui.stayStep;
        if (!stayed && si < steps.length - 1) p.step = si + 1;
        ES.ui.stayStep = false;
        // A student who asked for another sentence at this stage has said they are
        // still writing, so completing the paragraph must not take the line away
        // from them mid-thought. They get the line they asked for; the completion
        // state returns after it, so it is deferred rather than suppressed.
        ES.ui.moreLine = stayed;
        esSaveDraft(); esRender();
      };
    }
    const ss = $("#essamestep");
    if (ss) ss.onclick = () => {
      ES.ui.stayStep = !ES.ui.stayStep;
      ss.classList.toggle("armed", ES.ui.stayStep);
      ss.textContent = ES.ui.stayStep ? "staying at this stage" : "add another at this stage";
      const el = $("#esline"); if (el) el.focus();
    };
    const ng = $("#esnextguide"); if (ng) ng.onclick = () => { p.step = Math.min(si + 1, steps.length - 1); esSaveDraft(); esRender(); };
    const bs = $("#esbackstep"); if (bs) bs.onclick = () => { p.step = Math.max(0, si - 1); esSaveDraft(); esRender(); };
    const mh = $("#esmorehelp"); if (mh) mh.onclick = () => { esSetHelpLevel(p, editing, esHelpLevel(p, editing) + 1); esRender(); };
    const hh = $("#eshidehelp"); if (hh) hh.onclick = () => { esSetHelpLevel(p, editing, 0); esRender(); };

    // Moving between sections is the response map's job, so the two buttons that
    // duplicated it are gone. These stay bound when something else renders them.
    const prev = $("#esprev"); if (prev) prev.onclick = () => { d.pos = Math.max(0, d.pos - 1); ES.ui.editBlock = null; esResetCoachUI(); esSaveDraft(); esRender(); };
    const nxt = $("#esnext"); if (nxt) nxt.onclick = () => { d.pos = Math.min(total - 1, d.pos + 1); ES.ui.editBlock = null; esResetCoachUI(); esSaveDraft(); esRender(); };
    const ask = $("#esask"); if (ask) ask.onclick = () => esGetFeedback(d.pos);
    const lchip = $("[data-eslessonchip]");
    if (lchip) lchip.onclick = () => { ES.ui.setupStage = "lesson"; ES.ui.tryPick = null; esRender(); };
    // These two rebuild the composer, because both change what is around it: the
    // point pin appears, or the setup stage opens. The sentence being typed lives
    // only in the textarea, so a bare render silently deleted it mid-word. Capture
    // and restore the way the tool path already does.
    // Toggling the shape rebuilds the composer, so the sentence in progress is
    // carried the way every other rebuilding control now carries it.
    const cx = $("#esctx");
    if (cx) cx.onclick = () => {
      const want = esIsConcl(p) ? "judgement" : "plan";
      ES.ui.contextView = ES.ui.contextView === want ? null : want;
      if (ES.ui.contextView) ES.ui.tool = null;
      esRenderKeepingPlace(p);
    };
    host.querySelectorAll("[data-esnbtoggle]").forEach(b => b.onclick = () => esNbToggle());
    const sh = $("#esshape");
    if (sh) sh.onclick = () => {
      // Touches its own button and its own panel. No capture, no render, no
      // restore: the composer, its caret, its scroll and its undo stack are not
      // involved in whether a hint is visible.
      ES.ui.shapeOpen = !ES.ui.shapeOpen;
      const box = document.getElementById("esshapes");
      if (box) box.hidden = !ES.ui.shapeOpen;
      sh.setAttribute("aria-expanded", ES.ui.shapeOpen ? "true" : "false");
      sh.textContent = ES.ui.shapeOpen ? "Hide sentence shape" : "Show sentence shape";
    };
    const mp = $("#esmappop");
    if (mp) mp.onclick = () => {
      ES.ui.mapPop = !ES.ui.mapPop;
      const aside = host.querySelector(".es-map");
      if (aside) aside.hidden = !ES.ui.mapPop;
      mp.setAttribute("aria-expanded", ES.ui.mapPop ? "true" : "false");
      // Closes the ways a menu closes: choosing, clicking away, Escape. Bound while
      // open and dropped on close, so nothing accumulates across renders.
      if (ES.ui.mapPop) {
        const shut = () => {
          ES.ui.mapPop = false;
          if (aside) aside.hidden = true;
          mp.setAttribute("aria-expanded", "false");
          document.removeEventListener("mousedown", away, true);
          document.removeEventListener("keydown", key, true);
        };
        const away = e => { if (aside && !aside.contains(e.target) && e.target !== mp && !mp.contains(e.target)) shut(); };
        const key = e => { if (e.key === "Escape") { e.preventDefault(); shut(); } };
        document.addEventListener("mousedown", away, true);
        document.addEventListener("keydown", key, true);
      }
      const cols = host.querySelector(".es-cols");
      if (cols) cols.classList.toggle("mapopen", !!ES.ui.mapPop);
    };
    const ptog = $("#espointtoggle"); if (ptog) ptog.onclick = () => {
      esCaptureContext(p); ES.ui.pointOpen = !ES.ui.pointOpen; esRender(); esRestoreContext();
      const el = $("#espoint"); if (el) el.focus();
    };
    const rv = $("#esreview"); if (rv) rv.onclick = () => { ES.screen = "review"; esSaveDraft(); esRender(); };
    const mw = $("#esmapwa"); if (mw) mw.onclick = () => { ES.ui.planAll = false; ES.screen = "plan"; esSaveDraft(); esRender(); };
    const ml = $("#esmoreline"); if (ml) ml.onclick = () => { ES.ui.moreLine = true; esRender(); };
    const dn = $("#esdonenext"); if (dn) dn.onclick = () => {
      if (d.pos < total - 1) { d.pos = d.pos + 1; ES.ui.editBlock = null; esResetCoachUI(); esSaveDraft(); esRender(); }
      else { ES.screen = "review"; esSaveDraft(); esRender(); }
    };
    const dc = $("#esdonecheck"); if (dc) dc.onclick = () => esGetFeedback(d.pos);
    // Finding, after writing four paragraphs, that the evidence supports a
    // different judgement is good evaluation, not a mistake to be prevented.
    // Bound through the same function the targeted swap uses, so the two paths
    // cannot drift into binding different things.
    esBindSide(p);
    host.querySelectorAll("[data-espeek]").forEach(b => b.onclick = () => {
      const i = Number(b.dataset.espeek);
      ES.ui.mapOpen[i] = !ES.ui.mapOpen[i]; esRender();
    });
    const qz = $("#esquizlink"); if (qz) qz.onclick = () => { ES.screen = "quiz"; esResetQuiz(); esRender(); };
    esBindSetup(p);
    host.querySelectorAll("[data-esrestchange]").forEach(b => b.onclick = () => {
      esCaptureContext(p);
      ES.ui.setupStage = b.dataset.esrestchange; ES.ui.tool = null; esRender();
      esRestoreContext();
    });
    esBindLines();
    esBindSeqNudge(p);
  }
  // Sentence guidance is a MODE. It is for a student who has nothing, not a
  // permanent fixture, and it never calls the model: every rung is content.
  function esGuidanceOn() {
    if (ES.draft && ES.draft.guidance === false) return false;
    return true;
  }
  // A recommended length for this kind of question. Guidance, never a gate: a
  // student who wants to write more is not stopped and nothing is truncated.
  function esWordTarget(d) {
    const marks = Number(d && d.marks) || 0;
    if (!marks) return 0;
    const perMark = (window.ESSAY && window.ESSAY.wordsPerMark) || 40;
    return Math.round(marks * perMark / 50) * 50;
  }

  // Toggle the ask button live as the student types (cooldown releases the moment
  // the paragraph differs from what was last sent), without a full re-render.
  function esRefreshAskButton(p) {
    const ask = $("#esask"); if (!ask) return;
    const canAsk = !p.feedback || ((p.text || "").trim() !== (p.gradedText || "").trim());
    ask.disabled = !canAsk || ES.pending;
    ask.classList.toggle("primary", canAsk); ask.classList.toggle("ghost", !canAsk);
    const cd = document.querySelector(".es-cooldown"); if (cd) cd.style.display = canAsk ? "none" : "";
  }
  // The margin. Substance first (note, missing-element cards, on-target questions,
  // the notes check), with expression and signposting polish plus word chips tucked
  // behind a quiet "polish the wording" reveal so it stays de-emphasised early.
  function esCoachMargin(p) {
    if (ES.pending) return `<div class="es-mempty">Asking the coach for suggestions on this paragraph…</div>`;
    const fb = p.feedback;
    if (!fb) return `<div class="es-mempty">Write the paragraph one sentence at a time. The guide under the line you are on says what that sentence has to do, and <b>Help me</b> takes you further only if you ask. When the paragraph is done, press <b>Check this paragraph</b> and suggestions appear here. Nothing is ever written into your draft for you.</div>`;
    const demo = fb.demoNote ? `<div class="es-demonote">${esc(fb.demoNote)}</div>` : "";
    const note = fb.note ? `<div class="es-mnote">${esc(fb.note)}</div>` : "";
    const scaff = fb.missing.length ? `<div class="es-scaffhint">the dashed rows under your paragraph show each of these in order, where it belongs.</div>` : "";
    const miss = fb.missing.length ? `<div class="es-mblock"><div class="es-mh">missing elements</div>${fb.missing.map(slot => esMissCard(p, slot)).join("")}${scaff}</div>` : "";
    const onTarget = fb.nudges.filter(n => n.category === "on_target");
    const polish = fb.nudges.filter(n => n.category !== "on_target");
    const onT = onTarget.length ? `<div class="es-mblock"><div class="es-mh">questions to push your thinking</div>${onTarget.map(n => `<div class="es-nudge">${esc(n.text)}</div>`).join("")}</div>` : "";
    const check = fb.check ? `<div class="es-check">${esc(fb.check)}</div>` : "";
    const polishCount = polish.length + fb.chips.length;
    let polishBlock = "";
    if (polishCount) {
      // The body is rendered once and shown/hidden via the hidden attribute, so the
      // reveal flips visibility on existing DOM rather than regenerating it.
      const bodyInner = polish.map(n => `<div class="es-nudge ${n.category === "expression" ? "expr" : "sign"}">${esc(n.text)}</div>`).join("") +
        (fb.chips.length ? `<div class="es-chipwrap">${fb.chips.map(c =>
          `<div class="es-chipline"><span class="es-chipfrom">instead of “${esc(c.from)}”</span><span class="es-chipopts">${c.options.map(o =>
            `<button class="es-chip" data-eschip="1" data-eschipfrom="${esc(c.from)}" data-eschipopt="${esc(o)}">${esc(o)}</button>`).join("")}</span></div>`).join("")}</div>` : "");
      polishBlock = `<div class="es-polish"><button class="es-polishtoggle" id="espolish"><span class="es-polishchev">${ES.ui.polishOpen ? "▾" : "▸"}</span> polish the wording (${polishCount})</button><div class="es-polishbody" data-polishbody${ES.ui.polishOpen ? "" : " hidden"}>${bodyInner}</div></div>`;
    }
    return demo + note + miss + onT + check + polishBlock;
  }
  // A missing-element card: names the element, its job, and where it goes (Tier 0).
  // "Show scaffold" reveals a simple blank frame (Tier 1); "more guidance" offers a
  // few richer frame TYPES (Tier 2). The frame itself renders in the ghost zone.
  // A worked example for this slot, ALWAYS on a different topic from the student's
  // (so the shape transfers but nothing is liftable). FIXED, pre-written. Picks the
  // topic that does not appear in the student's own topic/question.
  function esWorkedExample(slot) {
    const set = esWorkedExampleSet(); const ex = set.list;
    if (!ex.length) return null;
    const mine = ((ES.draft && (ES.draft.topic + " " + ES.draft.question)) || "").toLowerCase();
    // Never show an example whose topic OR label appears in the student's own
    // topic/question. No same-topic fallback: if nothing is genuinely different,
    // show no example rather than risk one the student could lift.
    const sameTopic = e => [e.topic, e.label].some(t => t && mine.indexOf(String(t).toLowerCase()) >= 0);
    const pick = ex.find(e => e.slots && e.slots[slot] && !sameTopic(e));
    return pick ? { label: pick.label, text: pick.slots[slot], placeholder: set.placeholder } : null;
  }
  // Each missing element is its OWN stacked card in the margin: it names the element,
  // its job and where it belongs, and offers an optional different-topic worked
  // example in a clearly separate reference panel. The card no longer carries a
  // frame: ALL frames live in the ordered skeleton beneath the paragraph (one global
  // "Show scaffold" toggle reveals them together, each in its true slot position).
  function esMissCard(p, slot) {
    const def = slotDef(p.role, slot); if (!def) return "";
    const m = ES.ui.miss[slot] || { example: false };
    const where = ES_WHERE[slot] || "";
    const article = /^[aeiou]/i.test(def.label) ? "an" : "a";
    const hide = cond => cond ? "" : " hidden";
    const ex = esWorkedExample(slot);
    const exBlock = ex ? `<button type="button" class="es-linkbtn" data-esmiss-ex="${esc(slot)}"${hide(!m.example)}>see a worked example</button>` +
      `<div class="es-example" data-example${hide(m.example)}><div class="es-exh">model to study, not to copy</div><div class="es-exsub">a different topic on purpose: ${esc(ex.label)}</div>${ex.placeholder ? `<div class="es-exph">Placeholder: a model from another subject, until your subject's own worked examples are added. The analytical shape still transfers.</div>` : ""}<div class="es-extext">${esc(ex.text)}</div><button type="button" class="es-linkbtn" data-esmiss-ex="${esc(slot)}">hide example</button></div>` : "";
    return `<div class="es-miss" data-slot="${esc(slot)}">
      <div class="es-missh">${article} ${esc(def.label)} sentence is missing</div>
      <div class="es-missjob">Its job: ${esc(def.job)}${where ? ", " + esc(where) : ""}.</div>
      ${exBlock}</div>`;
  }
  // The ORDERED skeleton, rendered once beneath the paragraph. It walks the slot
  // model in order (body: point, analysis, evidence, link); present slots show as
  // solid "in place" markers and missing slots show as dashed, tinted gap frames so
  // the PLACEMENT and ORDER are the lesson. One "Show/Hide scaffold" toggle flips the
  // whole block via the hidden attribute (all gaps appear or clear together, never
  // one at a time). Frames are content-free blanks, pre-rendered, never written to
  // the draft. Per-gap chips swap that gap's frame wording in place (the old "more
  // guidance" frame types), without revealing or hiding any gap.
  // The paragraph's shape, ALWAYS on screen, blank paragraph included. This is the
  // guidance that used to arrive only after marking: each row names one sentence and
  // the JOB that sentence has to do. It states the job, it never performs it, and the
  // student types every word. Frames stay behind a request, one slot at a time, so a
  // student who already knows what to write is never handed half a sentence they did
  // not ask for. Once the coach has replied, the rows it reported as missing open
  // their frame, because at that point the student HAS asked.
  function esSkeletonBlock(p) {
    const slots = slotsForRole(p.role); if (!slots.length) return "";
    const fb = p.feedback, graded = !!fb;
    const missing = {}; if (graded) (fb.missing || []).forEach(k => { missing[k] = true; });
    const blanks = t => esc(t).replace(/_{2,}/g, '<span class="es-blank">____</span>');
    const rows = slots.map(sdef => {
      const done = graded && !missing[sdef.key];
      const t = slotTemplates(sdef.key) || {};
      const tier2 = t.tier2 || [];
      const hasFrames = !!(t.tier1 || tier2.length);
      // opened by the student, or opened for a gap the coach just named
      const open = Object.prototype.hasOwnProperty.call(ES.ui.frameOpen, sdef.key)
        ? !!ES.ui.frameOpen[sdef.key] : (graded && !!missing[sdef.key]);
      const choice = ES.ui.frame[sdef.key] || 0;
      let frames = "";
      if (hasFrames) {
        let inner = "";
        if (t.tier1) inner += `<div class="es-skelframe" data-skf="${esc(sdef.key)}:0"${choice === 0 ? "" : " hidden"}>${blanks(t.tier1)}</div>`;
        tier2.forEach((tt, i) => { inner += `<div class="es-skelframe" data-skf="${esc(sdef.key)}:${i + 1}"${choice === i + 1 ? "" : " hidden"}>${blanks(tt.frame)}</div>`; });
        const chips = `<div class="es-skelchips">` +
          (t.tier1 ? `<button type="button" class="es-skelchip ${choice === 0 ? "on" : ""}" data-esframe="${esc(sdef.key)}" data-esframeidx="0">simple</button>` : "") +
          tier2.map((tt, i) => `<button type="button" class="es-skelchip ${choice === i + 1 ? "on" : ""}" data-esframe="${esc(sdef.key)}" data-esframeidx="${i + 1}">${esc(tt.type)}</button>`).join("") +
          `</div>`;
        frames = `<div class="es-skelframes" data-frames="${esc(sdef.key)}"${open ? "" : " hidden"}>${inner}${chips}<div class="es-skelnote">type over the blanks in your own words. This is a shape, not a sentence.</div></div>`;
      }
      const ask = hasFrames
        ? `<button type="button" class="es-skelask" data-esaskframe="${esc(sdef.key)}">${open ? "hide the frame" : "show me a frame"}</button>` : "";
      return `<div class="es-skelrow ${done ? "have" : "gap"}">
        <div class="es-skeltop"><span class="es-skellabel">${esc(sdef.label)}</span>${done ? `<span class="es-skelhave">your sentence sits here</span>` : ask}</div>
        <div class="es-skeljob">${esc(sdef.job || "")}</div>
        ${done ? "" : frames}
      </div>`;
    }).join("");
    const head = graded
      ? "Your paragraph in order. Solid rows are sentences you already have, dashed rows are still to write. Nothing here is written into your draft."
      : "What this paragraph has to do, in order. Each row is one sentence and the job that sentence does. You write every word of it. Nothing here is written into your draft.";
    // Before the coach has replied every row is simply "still to write", so the block
    // stays quiet. After it replies, a real gap is marked as one.
    return `<div class="es-skel ${graded ? "graded" : "plain"}" data-skel><div class="es-skelh">${esc(head)}</div>${rows}</div>`;
  }
  function esApplyExampleDom(slot) {
    const card = document.querySelector('.es-miss[data-slot="' + slot + '"]'); if (!card) return;
    const open = !!(ES.ui.miss[slot] && ES.ui.miss[slot].example);
    // the "see a worked example" button is the one NOT inside the example panel
    const exShow = Array.from(card.querySelectorAll('[data-esmiss-ex]')).find(el => !el.closest('[data-example]'));
    const exPanel = card.querySelector('[data-example]');
    if (exShow) exShow.hidden = open;
    if (exPanel) exPanel.hidden = !open;
  }
  // Margin handlers flip visibility on the existing DOM (hidden attribute), never
  // rebuild the margin. State is stored on ES.ui so a later full render (e.g.
  // paragraph nav) reproduces the same open/closed state. The single scaffold toggle
  // lives here in the margin but flips the skeleton block in the writing column.
  function esBindCoachMargin(p) {
    const host = document.getElementById("eshost"); if (!host) return;
    const pol = $("#espolish");
    if (pol) pol.onclick = () => {
      ES.ui.polishOpen = !ES.ui.polishOpen;
      const body = host.querySelector("[data-polishbody]"); if (body) body.hidden = !ES.ui.polishOpen;
      const chev = pol.querySelector(".es-polishchev"); if (chev) chev.textContent = ES.ui.polishOpen ? "▾" : "▸";
    };
    host.querySelectorAll("[data-eschip]").forEach(b => b.onclick = () => esApplyChip(ES.draft.pos, b.dataset.eschipfrom, b.dataset.eschipopt));
    host.querySelectorAll("[data-esmiss-ex]").forEach(b => b.onclick = () => {
      const s = b.dataset.esmissEx;
      ES.ui.miss[s] = Object.assign({ example: false }, ES.ui.miss[s]);
      ES.ui.miss[s].example = !ES.ui.miss[s].example;
      esApplyExampleDom(s);
    });
  }
  // Skeleton handlers (writing column): per-gap chips swap that gap's frame wording
  // in place by flipping hidden among the pre-rendered frames. No gap is revealed or
  // hidden here, so the all-at-once skeleton stays intact.
  // ============================ STUDY HINTS (essay) ============================
  // A floating hint widget for the writing screens. Three tabs, all rendered once
  // and flipped with the hidden attribute so opening one never rebuilds the panel:
  //   Know      core syllabus content for this topic, so a student who does not yet
  //             know the material can learn it here instead of guessing.
  //   Plan      the essay's relationship and its paragraph angles. The student LOCKS
  //             their picks once, and every later paragraph shows the same locked
  //             plan, which is what keeps a long response consistent.
  //   Evidence  their case study bank (McDonald's), with how to deploy each item.
  // Content comes from window.BUSCONTENT; the widget hides itself when none is loaded.
  function busContent() { return window.BUSCONTENT || null; }
  function busTopics() { const b = busContent(); return (b && b.topics) || {}; }
  // Resolve which syllabus topic this essay sits in: the student's locked choice
  // first, then the tag on a picked question bank item, then a keyword match on the
  // question itself, then null (the widget asks them to choose).
  function busTopicKey() {
    const d = ES.draft; if (!d) return null;
    if (d.plan && d.plan.topic && busTopics()[d.plan.topic]) return d.plan.topic;
    const hay = ((d.topic || "") + " " + (d.question || "")).toLowerCase();
    const tags = { operations: ["operation", "production", "supply chain", "quality", "logistic", "inventory"],
                   marketing: ["marketing", "target market", "promotion", "e-marketing", "consumer"],
                   finance: ["financial", "finance", "liquidity", "profitab", "cash flow", "solvency", "ratio"],
                   human_resources: ["human resource", "employee", "staff", "industrial", "union", "workforce"] };
    for (const k of Object.keys(tags)) if (busTopics()[k] && tags[k].some(w => hay.indexOf(w) >= 0)) return k;
    return null;
  }
  function busTopicLabel(k) { const t = busTopics()[k]; return (t && t.label) || ""; }
  // The plan a student locks. Kept on the DRAFT, so it persists with the essay and
  // every paragraph is written against the same agreed line of argument.
  function esPlan() {
    const d = ES.draft;
    if (!d.plan) d.plan = { topic: null, picks: [], locked: false };
    if (!Array.isArray(d.plan.picks)) d.plan.picks = [];
    return d.plan;
  }
  // Candidate paragraph angles: the exemplar plan on a question bank item when the
  // student picked one, otherwise the syllabus sections for the resolved topic.
  function esPlanOptions() {
    const d = ES.draft, sc = esSubjectContent(ES.subject);
    const qs = (sc && sc.questions) || [];
    const q = qs.find(x => x.text && d.question && x.text.trim() === d.question.trim());
    if (q && Array.isArray(q.plan) && q.plan.length) return q.plan.slice();
    const t = busTopics()[busTopicKey()];
    if (t) return (t.sections || []).flatMap(sec => (sec.points || []).map(pt => pt.point)).slice(0, 12);
    return [];
  }
  function esHintHTML() {
    if (!busContent()) return "";
    const d = ES.draft, plan = esPlan(), tab = ES.hint.tab, key = busTopicKey();
    const topic = busTopics()[key];
    const on = t => tab === t ? " on" : "";
    const hide = t => tab === t ? "" : " hidden";
    // --- Know: core content for the topic ---
    let know;
    if (!topic) {
      know = `<p class="es-hintlead">Pick the syllabus topic this essay sits in and the core content will load here.</p>
        <div class="es-hintpicks">${Object.keys(busTopics()).map(k =>
          `<button class="es-hintpick" data-eshinttopic="${esc(k)}">${esc(busTopicLabel(k))}</button>`).join("")}</div>`;
    } else {
      know = `<p class="es-hintlead">${esc(topic.label)} core content. Read the piece you are unsure of, then keep writing.</p>` +
        (topic.sections || []).map(sec => `<details class="es-hintsec"><summary>${esc(sec.name)}</summary>` +
          (sec.points || []).map(pt => `<div class="es-hintpt">
              <div class="es-hintpth">${esc(pt.point)}</div>
              <p class="es-hintwhat">${esc(pt.what)}</p>
              <p class="es-hintwhy"><b>Why it matters:</b> ${esc(pt.why)}</p>
              ${(pt.terms || []).length ? `<div class="es-hintterms">${pt.terms.map(x => `<span class="es-hintterm">${esc(x)}</span>`).join("")}</div>` : ""}
              ${pt.exam ? `<p class="es-hintexam"><b>In the exam:</b> ${esc(pt.exam)}</p>` : ""}
            </div>`).join("") + `</details>`).join("");
    }
    // --- Plan: pick the angles, then lock them ---
    const opts = esPlanOptions();
    const plan_ = plan.locked
      ? `<p class="es-hintlead">Your plan is locked, so every paragraph argues the same line.</p>
         <ol class="es-hintlocked">${plan.picks.map(x => `<li>${esc(x)}</li>`).join("")}</ol>
         <button class="es-linkbtn" id="eshintunlock">Unlock and change the plan</button>`
      : `<p class="es-hintlead">Choose the angles this essay will argue, then lock them in. Locking keeps every paragraph consistent as you move through the sections.</p>
         <div class="es-hintopts">${opts.map((o, i) =>
            `<button class="es-hintopt${plan.picks.indexOf(o) >= 0 ? " on" : ""}" data-eshintpick="${i}">${esc(o)}</button>`).join("")}</div>
         ${opts.length ? "" : `<p class="es-help">Pick a topic on the Know tab first.</p>`}
         <div class="es-hintlockrow"><span class="es-help" id="eshintcount">${plan.picks.length} chosen</span>
           <button class="es-btn primary" id="eshintlock" ${plan.picks.length ? "" : "disabled"}>Lock in this plan</button></div>`;
    // --- Evidence: the case study bank ---
    const ev = (busContent().evidence || {})[key] || [];
    const evidence = !key
      ? `<p class="es-hintlead">Pick a topic on the Know tab and your case study evidence loads here.</p>`
      : ev.length
        ? `<p class="es-hintlead">McDonald's evidence for ${esc(busTopicLabel(key))}. Markers reward evidence that is applied, so use the "how to use it" line.</p>` +
          ev.map(e => `<div class="es-hintev">
              <div class="es-hintevh">${esc(e.label)}${e.verify ? `<span class="es-hintcheck">check a current figure yourself</span>` : ""}</div>
              <p class="es-hintevf">${esc(e.fact)}</p>
              <p class="es-hintevu"><b>How to use it:</b> ${esc(e.use)}</p>
            </div>`).join("")
        : `<p class="es-hintlead">No evidence yet for this topic.</p>`;
    return `
      <button class="es-hintfab" id="eshintfab" aria-expanded="${ES.hint.open}" title="Study hints">${ES.hint.open ? "close hints" : "hints"}</button>
      <aside class="es-hintpanel" data-hintpanel${ES.hint.open ? "" : " hidden"} aria-label="Study hints">
        <div class="es-hinttabs">
          <button class="es-hinttab${on("know")}" data-eshinttab="know">Know</button>
          <button class="es-hinttab${on("plan")}" data-eshinttab="plan">Plan</button>
          <button class="es-hinttab${on("evidence")}" data-eshinttab="evidence">Evidence</button>
        </div>
        <div class="es-hintbody" data-hintpane="know"${hide("know")}>${know}</div>
        <div class="es-hintbody" data-hintpane="plan"${hide("plan")}>${plan_}</div>
        <div class="es-hintbody" data-hintpane="evidence"${hide("evidence")}>${evidence}</div>
      </aside>`;
  }
  // Re-render just the panel in place (used after a pick, lock or topic choice, all
  // of which change what the panel should show).
  function esHintRefresh() {
    const host = document.getElementById("eshost"); if (!host) return;
    const wrap = host.querySelector("[data-hinthost]"); if (!wrap) return;
    wrap.innerHTML = esHintHTML();
    host.querySelectorAll("button:not([type])").forEach(b => b.type = "button");
    esBindHint();
  }
  function esBindHint() {
    const host = document.getElementById("eshost"); if (!host) return;
    const fab = host.querySelector("#eshintfab");
    if (fab) fab.onclick = () => {
      ES.hint.open = !ES.hint.open;
      const panel = host.querySelector("[data-hintpanel]"); if (panel) panel.hidden = !ES.hint.open;
      fab.textContent = ES.hint.open ? "close hints" : "hints";
      fab.setAttribute("aria-expanded", String(ES.hint.open));
    };
    host.querySelectorAll("[data-eshinttab]").forEach(b => b.onclick = () => {
      ES.hint.tab = b.dataset.eshinttab;
      host.querySelectorAll("[data-hintpane]").forEach(x => x.hidden = x.dataset.hintpane !== ES.hint.tab);
      host.querySelectorAll("[data-eshinttab]").forEach(x => x.classList.toggle("on", x.dataset.eshinttab === ES.hint.tab));
    });
    host.querySelectorAll("[data-eshinttopic]").forEach(b => b.onclick = () => {
      esPlan().topic = b.dataset.eshinttopic; esSaveDraft(); esHintRefresh();
    });
    host.querySelectorAll("[data-eshintpick]").forEach(b => b.onclick = () => {
      const opts = esPlanOptions(), v = opts[Number(b.dataset.eshintpick)];
      const plan = esPlan(), i = plan.picks.indexOf(v);
      if (i >= 0) plan.picks.splice(i, 1); else plan.picks.push(v);
      esSaveDraft(); esHintRefresh();
    });
    const lock = host.querySelector("#eshintlock");
    if (lock) lock.onclick = () => { esPlan().locked = true; esSaveDraft(); esHintRefresh(); toast("Plan locked. Every paragraph now argues this line."); };
    const unlock = host.querySelector("#eshintunlock");
    if (unlock) unlock.onclick = () => { esPlan().locked = false; esSaveDraft(); esHintRefresh(); };
  }

  // ---- line-by-line guidance, docked under the typing box ----
  // You cannot render markers INSIDE a textarea, so the guidance sits directly under
  // it as a list of the student's own sentences. Clicking a row SELECTS that exact
  // sentence in the textarea, so the box itself shows which line is meant. The coach
  // gives a direct diagnosis plus a blank frame; it never writes the sentence.
  function esSplitSentences(text) {
    const out = []; const re = /[^.!?]+[.!?]*/g; let m;
    while ((m = re.exec(text || "")) !== null) {
      const raw = m[0]; const t = raw.trim();
      if (t) out.push({ text: t, start: m.index + (raw.length - raw.replace(/^\s+/, "").length), end: m.index + raw.length });
    }
    return out;
  }
  // Locate the sentence a line refers to: match the coach's verbatim quote against
  // the student's current text, then fall back to position so demo data still lands.
  function esLocateLine(text, line, i) {
    const sents = esSplitSentences(text);
    const q = (line.quote || "").trim().toLowerCase();
    if (q) {
      const hit = sents.find(sn => sn.text.toLowerCase().indexOf(q.slice(0, 40)) >= 0)
               || sents.find(sn => q.indexOf(sn.text.toLowerCase().slice(0, 30)) >= 0);
      if (hit) return hit;
    }
    return sents[i] || sents[0] || null;
  }
  function esLinesBlock(p) {
    const fb = p.feedback; if (!fb || !(fb.lines || []).length) return "";
    const text = p.text || "";
    const rows = fb.lines.map((l, i) => {
      const loc = esLocateLine(text, l, i);
      const blanks = x => esc(x).replace(/_{2,}/g, '<span class="es-blank">____</span>');
      return `<div class="es-line ${esc(l.severity)}" data-esline="${i}"${loc ? ` data-lstart="${loc.start}" data-lend="${loc.end}"` : ""}>
        <div class="es-linetop"><span class="es-linesev">${l.severity === "critical" ? "loses marks" : l.severity === "should" ? "lifts the band" : "polish"}</span>
          ${loc ? `<button type="button" class="es-linefind" data-esline="${i}">show me this line</button>` : ""}</div>
        ${loc ? `<div class="es-linequote">${esc(loc.text.slice(0, 120))}${loc.text.length > 120 ? "…" : ""}</div>` : ""}
        <div class="es-lineissue">${esc(l.issue)}</div>
        <div class="es-linefix"><span class="es-linefixh">type over the blanks</span> ${blanks(l.fix)}</div>
      </div>`;
    }).join("");
    return `<div class="es-lines"><div class="es-linesh">line by line</div>${rows}</div>`;
  }
  function esBindLines() {
    const host = document.getElementById("eshost"); if (!host) return;
    const ta = document.getElementById("espara"); if (!ta) return;
    host.querySelectorAll("[data-esline]").forEach(el => el.onclick = () => {
      const row = el.closest(".es-line") || el;
      const a = Number(row.getAttribute("data-lstart")), b = Number(row.getAttribute("data-lend"));
      if (!Number.isFinite(a) || !Number.isFinite(b)) return;
      ta.focus(); ta.setSelectionRange(a, b);
      host.querySelectorAll(".es-line").forEach(x => x.classList.toggle("on", x === row));
    });
  }

  function esBindSkeleton(p) {
    const host = document.getElementById("eshost"); if (!host) return;
    const skel = host.querySelector("[data-skel]"); if (!skel) return;
    // Reveal ONE slot's frame, on request. Visibility flip, no rebuild, no flash.
    skel.querySelectorAll("[data-esaskframe]").forEach(b => b.onclick = () => {
      const slot = b.dataset.esaskframe;
      const box = skel.querySelector('[data-frames="' + slot + '"]'); if (!box) return;
      const open = box.hidden;
      box.hidden = !open;
      ES.ui.frameOpen[slot] = open;
      b.textContent = open ? "hide the frame" : "show me a frame";
    });
    skel.querySelectorAll("[data-esframe]").forEach(b => b.onclick = () => {
      const slot = b.dataset.esframe, idx = Number(b.dataset.esframeidx);
      ES.ui.frame[slot] = idx;
      const row = b.closest(".es-skelrow"); if (!row) return;
      row.querySelectorAll(".es-skelframe").forEach(f => { f.hidden = f.getAttribute("data-skf") !== slot + ":" + idx; });
      row.querySelectorAll("[data-esframe]").forEach(c => c.classList.toggle("on", Number(c.dataset.esframeidx) === idx));
    });
  }
  // Soft boundary nudges (never hard locks). Order: complete -> memorise; mastered
  // -> polish wording; all mastered -> full attempt. All modes stay openable.
  function esSeqNudge(p) {
    const d = ES.draft;
    const allMastered = d.paras.every(x => x.mastered);
    // "complete" must reflect the CURRENT text, not a stale submission: the feedback
    // is only trustworthy while the paragraph still matches what was reviewed.
    const cur = (p.text || "").trim();
    const complete = cur && cur === (p.gradedText || "").trim() && p.feedback && p.feedback.missing.length === 0;
    if (allMastered) return `<div class="es-seq">Every paragraph is mastered. <button class="es-inlinelink" id="esseqfull">try a full attempt</button>.</div>`;
    if (p.mastered) return `<div class="es-seq">Mastered. Want to polish the wording now? <button class="es-inlinelink" id="esseqpolish">polish the wording</button>.</div>`;
    if (complete) return `<div class="es-seq">This paragraph looks complete. Ready to memorise it? <button class="es-inlinelink" id="esseqquiz">quiz this paragraph</button>.</div>`;
    return "";
  }
  function esBindSeqNudge() {
    const f = $("#esseqfull"); if (f) f.onclick = () => { ES.draft.mode = "full"; ES.screen = "full"; esSaveDraft(); esRender(); };
    const q = $("#esseqquiz"); if (q) q.onclick = () => { ES.screen = "quiz"; esResetQuiz(); esRender(); };
    const po = $("#esseqpolish"); if (po) po.onclick = () => { ES.ui.polishOpen = true; esRender(); };
  }

  // ------------------------------ MASTERY (QUIZ) MODE ------------------------------
  // A per-paragraph recall loop reusing the flashcard/SRS DNA: cue = the paragraph's
  // point/topic sentence, hidden answer = the student's OWN saved paragraph, Reveal
  // shows it as a crutch. Closeness reuses rvOverlap AGAINST THE STUDENT'S OWN
  // paragraph (legitimate recall of their own work, the opposite of coaching's
  // no-substitute rule). Mastered = a clean recall with no reveal that attempt.
  // Pure recall, no API, no stylistic judgement. Always targets the current draft.
  const ES_MASTERY_THRESHOLD = 0.6;
  function esRenderQuiz(host, sc) {
    const d = ES.draft;
    if (d.pos < 0) d.pos = 0; if (d.pos > d.paras.length - 1) d.pos = d.paras.length - 1;
    const p = d.paras[d.pos];
    const total = d.paras.length, n = d.pos + 1;
    const head = `
      <div class="es-top">
        <div class="es-brand">Marginal · essay practice ${sc.label ? `<span class="es-subj">${esc(sc.label)}</span>` : ""}${ES.demo ? `<span class="es-demobadge">demo</span>` : ""}</div>
        <div class="es-topbtns">
          <button class="es-linkbtn" id="esquizcoach">back to coaching</button>
          <button class="es-x" id="esx" aria-label="Back to setup">setup</button>
        </div>
      </div>
      <div class="es-qbar"><div><div class="es-qbar-mode">memorise</div><div class="es-qbar-q">${esc(d.question)}</div></div>${d.topic ? `<span class="es-restag">${esc(d.topic)}</span>` : ""}</div>`;
    if (!(p.text || "").trim()) {
      host.innerHTML = `<div class="es-scrim"><div class="es-shell"><div class="es-wrap es-wide">${head}
        <div class="es-empty"><h2 class="es-h1">Nothing to memorise yet</h2><p class="es-lead">Write this ${esc(p.role.toLowerCase())} in coaching first, then come back to memorise it.</p><button class="es-btn primary" id="esquizwrite">Go to coaching</button></div>
      </div></div></div>`;
      esBindWritingHead();
      $("#esquizcoach").onclick = () => { ES.screen = "coached"; esRender(); };
      $("#esquizwrite").onclick = () => { ES.screen = "coached"; esRender(); };
      return;
    }
    const cue = (p.point || "").trim() || `Recall your ${p.role.toLowerCase()} from memory.`;
    const q = ES.quiz;
    const res = q.result;
    const resultBlock = res ? `<div class="es-qres ${res.state}">${esc(res.msg)}</div>` : "";
    const answer = `<div class="es-quizanswer" data-quizanswer${q.revealed ? "" : " hidden"}><div class="es-mh">your saved paragraph</div><div class="es-quizanswertext">${esc(p.text)}</div></div>`;
    const seq = p.mastered
      ? (d.paras.every(x => x.mastered)
          ? `<div class="es-seq">Every paragraph is mastered. <button class="es-inlinelink" id="esquizfull">try a full attempt</button>.</div>`
          : `<div class="es-seq">Mastered. Want to polish the wording? <button class="es-inlinelink" id="esquizpolish">polish the wording</button>.</div>`)
      : "";
    host.innerHTML = `
    <div class="es-scrim"><div class="es-shell"><div class="es-wrap es-wide">
      ${head}
      <div class="es-stepper">
        <div class="es-steps">${d.paras.map((pp, i) => `<span class="es-step ${i === d.pos ? "on" : ""} ${pp.mastered ? "mastered" : ""}"><span class="es-stepn">${pp.mastered ? "✓" : i + 1}</span><span class="es-steplbl">${esc(pp.role)}</span></span>`).join("")}</div>
        <div class="es-ring" title="paragraph ${n} of ${total}"><span>${n}/${total}</span></div>
      </div>
      <div class="es-quizwrap">
        <div class="es-quizcue"><div class="es-mh">your cue${p.mastered ? ` · <span class="es-masteredtag">mastered</span>` : ""}</div><div class="es-quizcuetext">${esc(cue)}</div></div>
        <p class="es-help">From memory, write this paragraph back out. Reveal is a crutch for early practice. To master it, recall it without revealing.</p>
        <textarea id="esquizinput" class="es-input es-parabox" rows="9" placeholder="Write the paragraph from memory.">${esc(q.attempt)}</textarea>
        ${resultBlock}
        ${answer}
        <div class="es-navrow">
          <button class="es-btn ghost" id="esquizreveal">${q.revealed ? "Hide answer" : "Reveal answer"}</button>
          <button class="es-btn primary" id="esquizcheck">Check recall</button>
          <button class="es-btn ghost" id="esquizagain">Try again</button>
          <button class="es-btn ghost" id="esquiznext" ${d.pos === total - 1 ? "disabled" : ""}>Next paragraph</button>
        </div>
        ${seq}
      </div>
    </div></div></div>`;
    esBindWritingHead();
    $("#esquizcoach").onclick = () => { ES.screen = "coached"; esResetCoachUI(); esRender(); };
    const ta = $("#esquizinput"); ta.oninput = () => { q.attempt = ta.value; };
    $("#esquizreveal").onclick = () => {
      if (!q.revealed) q.peeked = true;            // peeking ever this attempt disqualifies mastery
      q.revealed = !q.revealed;
      const ans = document.querySelector("[data-quizanswer]"); if (ans) ans.hidden = !q.revealed;
      $("#esquizreveal").textContent = q.revealed ? "Hide answer" : "Reveal answer";
    };
    $("#esquizcheck").onclick = () => esQuizCheck(p);
    $("#esquizagain").onclick = () => { esResetQuiz(); esRender(); };
    $("#esquiznext").onclick = () => { d.pos = Math.min(total - 1, d.pos + 1); esResetQuiz(); esResetCoachUI(); esSaveDraft(); esRender(); };
    const pf = $("#esquizfull"); if (pf) pf.onclick = () => { ES.draft.mode = "full"; ES.screen = "full"; esSaveDraft(); esRender(); };
    const pp = $("#esquizpolish"); if (pp) pp.onclick = () => { ES.screen = "coached"; esResetCoachUI(); ES.ui.polishOpen = true; esRender(); };
  }
  function esQuizCheck(p) {
    const q = ES.quiz;
    const attempt = (q.attempt || "").trim();
    if (!attempt) { toast("Write the paragraph from memory first."); return; }
    const score = rvOverlap(attempt, p.text); // fraction of the student's OWN paragraph recalled
    const pct = Math.round(score * 100);
    if (q.peeked) {
      q.result = { state: "revealed", msg: "Revealing is fine for practice, but it does not count toward mastery. Try again without peeking." };
    } else if (score >= ES_MASTERY_THRESHOLD) {
      p.mastered = true; esSaveDraft();
      q.result = { state: "mastered", msg: "Mastered. You recalled about " + pct + "% of it without peeking." };
    } else {
      q.result = { state: "close", msg: "Close. You recalled about " + pct + "%. Try again from memory, or reveal it once as a crutch." };
    }
    esRender();
  }

  // ===========================================================================
  // REVIEW THE WHOLE RESPONSE
  //
  // Guided practice ends where a real answer ends: reading the whole thing, going
  // back into any paragraph, and submitting it. A student who builds an essay
  // here never has to leave for another mode to see it or to have it marked.
  // ===========================================================================
  function esRenderReview(host, sc) {
    const d = ES.draft;
    const rows = d.paras.map((pp, i) => {
      const w = esWordsOf(pp.text);
      const line = (esIsIntro(pp) || esIsConcl(pp)) ? (pp.point || "") : esArgLine(pp);
      return `<section class="es-rvsec ${w ? "" : "empty"}">
        <div class="es-rvsech">
          <span class="es-rvrole">${esc(pp.role)}</span>
          ${line ? `<span class="es-rvarg">${esc(line)}</span>` : ""}
          <span class="es-rvw">${w ? w + " word" + (w === 1 ? "" : "s") : "not written yet"}</span>
          <button type="button" class="es-linkbtn" data-esrvedit="${i}">${w ? "Edit this paragraph" : "Write this paragraph"}</button>
        </div>
        ${w ? `<p class="es-rvtext">${esc(pp.text)}</p>` : `<p class="es-rvempty">Nothing here yet.</p>`}
      </section>`;
    }).join("");
    const whole = esResponseWords(d);
    const target = esWordTarget(d);
    const written = d.paras.filter(pp => esWordsOf(pp.text)).length;
    const guided = esAllBlocks(d).length > 0;
    const firstGap = d.paras.findIndex(pp => !esWordsOf(pp.text));
    host.innerHTML = `
    <div class="es-scrim"><div class="es-shell"><div class="es-wrap es-canvas">
      ${esWritingHead(sc, "Review", "Write a full attempt instead", "full")}
      <div class="es-rvwrap">
        <div class="es-rvhead">
          <h3 class="es-rvh">Your response, read straight through</h3>
          <p class="es-rvsub">${written} of ${d.paras.length} sections written, ${whole} word${whole === 1 ? "" : "s"}${target ? `. Around ${target} would be a full answer at ${esc(String(d.marks || 20))} marks, as a guide.` : "."}</p>
        </div>
        ${rows}
        ${(() => {
          const req = esAreasRequired() ? esRequiredAreas(esQuestionDef()) : [];
          if (!req.length) return "";
          const used = {}; esBodyIndexes(d).forEach(i => { if (esWordsOf(d.paras[i].text) && d.paras[i].area) used[d.paras[i].area] = d.paras[i].role; });
          const missing = req.filter(a => !used[a]);
          if (!missing.length) return `<div class="es-cover done"><span class="es-corelbl">Required coverage</span>
            <span>all ${req.length} parts of the question are addressed</span></div>`;
          // Checked hard here, and nowhere used to block writing. An incomplete
          // response is still a response a student may deliberately want marked,
          // so this names the cost and offers the way back; submitting anyway is
          // the button that was always there.
          return `<div class="es-cover missing"><span class="es-corelbl">Not yet addressed</span>
            <span class="es-wanote">Your response does not yet address ${esc(esList(missing))}, which the question names. Submitting now is likely to limit your mark substantially. You can submit anyway.</span>
            <div class="es-coverbtns">${missing.map(a => { const plan = esCoverPlan(d, a);
              return `<button type="button" class="es-btn ghost sm" data-escover="${esc(a)}">${esc(plan.label.toLowerCase().replace(/^./, c => c.toUpperCase()))}</button>`;
            }).join("")}</div></div>`;
        })()}
        <div class="es-completion">
          <p class="es-completemsg">${guided
            ? "You built this in guided practice, one sentence at a time. Read it through, then send it to the marker."
            : "Read it through, then send it to the marker."}${firstGap >= 0 ? ` ${esc(d.paras[firstGap].role)} is still empty; you can submit anyway.` : ""}</p>
          <div class="es-actions">
            <button class="es-btn ghost" id="esrvback">${firstGap >= 0 ? "Write " + esc(d.paras[firstGap].role.toLowerCase()) : "Keep revising"}</button>
            <button class="es-btn primary" id="essubmit">Submit for marking</button>
          </div>
        </div>
      </div>
    </div></div></div>`;
    esBindWritingHead();
    host.querySelectorAll("[data-esrvedit]").forEach(b => b.onclick = () => esGoCoached(Number(b.dataset.esrvedit)));
    host.querySelectorAll("[data-escover]").forEach(b => b.onclick = () => {
      const a = b.dataset.escover;
      const plan = esCoverPlan(d, a);
      if (plan.act === "grow") {
        esApplyStructure(plan.key);
        const added = esBodyIndexes(d).find(k => !d.paras[k].area && !esWordsOf(d.paras[k].text));
        if (added == null) return;
        d.paras[added].area = a; esSaveDraft(); esGoCoached(added);
        return;
      }
      if (plan.i == null) return;
      if (plan.act === "assign") { d.paras[plan.i].area = a; esSaveDraft(); }
      else if (!d.paras[plan.i].area) {
        toast("Every paragraph is already spoken for, so nothing has been changed. Use Change beside an argument to cover " + a + ".");
      }
      esGoCoached(plan.i);
    });
    const back = $("#esrvback");
    if (back) back.onclick = () => esGoCoached(firstGap >= 0 ? firstGap : d.pos);
    const sub = $("#essubmit"); if (sub) sub.onclick = () => esSubmitFull();
  }

  // -------------------------------- FULL ATTEMPT --------------------------------
  // The other mode: write cold, like an exam. One continuous surface, NO feedback
  // margin. Three escape hatches so practice is never silently skipped, all into
  // the SAME draft (no fork): a standing switch line, a per-paragraph coach link,
  // and a gentle declinable completion check above Submit.
  function esRenderFull(host, sc) {
    const d = ES.draft;
    const text = d.paras.map(pp => pp.text || "").join("\n\n").replace(/\n{3,}/g, "\n\n").replace(/^\n+/, "").replace(/\n+$/, "");
    // Links index off the canonical paragraph SLOTS (not a filtered chunk list),
    // so "Coach paragraph n" always carries that exact slot's text into the same
    // draft. esGoCoached uses the same slot index: no fork, no off-by-one.
    const filled = d.paras.map((pp, i) => ({ i, has: !!(pp.text || "").trim() })).filter(x => x.has);
    const coachLinks = filled.length ? filled.map(x =>
      `<button class="es-linkbtn" data-escoachpara="${x.i}">Coach ${esc(d.paras[x.i].role.toLowerCase())}</button>`).join("") : `<span class="es-help">Start writing, then you can take any paragraph into practice.</span>`;
    host.innerHTML = `
    <div class="es-scrim"><div class="es-shell"><div class="es-wrap es-wide">
      ${esWritingHead(sc, "Full attempt", "Switch to coached practice", "coached")}
      <p class="es-standing">Writing cold to build exam stamina. Prefer guidance on a paragraph? <button class="es-inlinelink" id="esstanding">switch to practice</button>.</p>
      <textarea id="esfull" class="es-input es-fullbox" rows="18" placeholder="Write your whole essay here, in one go. Separate paragraphs with a blank line.">${esc(text)}</textarea>
      <div class="es-coachstrip"><span class="es-help">Take a paragraph into practice without losing it from here:</span> ${coachLinks}</div>
      <div class="es-completion">
        <p class="es-completemsg">${esAllBlocks(d).length ? "You built part of this in guided practice. Take any paragraph back in before you submit? You can decline." : "You wrote this without feedback. Take any paragraph into practice first? You can decline."}</p>
        <div class="es-actions">
          <button class="es-btn ghost" id="estopractice">Take a paragraph into practice</button>
          <button class="es-btn primary" id="essubmit">Submit anyway</button>
        </div>
      </div>
      <div data-hinthost>${esHintHTML()}</div>
    </div></div></div>`;
    esBindWritingHead();
    esBindHint();
    const firstFilled = () => { const k = d.paras.findIndex(pp => (pp.text || "").trim()); return k < 0 ? 0 : k; };
    const ta = $("#esfull"); ta.oninput = () => { esFullSync(ta.value); };
    $("#esstanding").onclick = () => { esFullSync($("#esfull").value); esGoCoached(firstFilled()); };
    $("#estopractice").onclick = () => { esFullSync($("#esfull").value); esGoCoached(firstFilled()); };
    $("#essubmit").onclick = () => esSubmitFull();
    host.querySelectorAll("[data-escoachpara]").forEach(b => b.onclick = () => { esFullSync($("#esfull").value); esGoCoached(Number(b.dataset.escoachpara)); });
  }
  function esSplitParas(text) { return String(text || "").split(/\n\s*\n/).map(s => s.trim()).filter(s => s.length); }
  // Sync the one continuous surface back into the single draft. Aligns chunks to
  // paragraph slots by index, preserves each slot's planned point, and clears stale
  // feedback when a slot's text changed. Structure slots are kept even when empty,
  // so the coached stepper stays intact; extra chunks append as Body slots.
  function esFullSync(value) {
    const d = ES.draft, chunks = String(value).split(/\n\s*\n/).map(s => s.replace(/\s+$/,""));
    const trimmed = chunks.map(c => c.trim());
    // Never shrink below the structure's own paragraph count (keep the scaffold),
    // but DO drop extra slots the student deleted so empty Body N steps don't
    // linger in coached mode. The textarea compacts internal blanks, so trimmed
    // is already a compact list and truncating is safe.
    const baseLen = esStructureDef(d.structure).roles.length;
    const keep = Math.max(baseLen, trimmed.filter(Boolean).length);
    for (let i = 0; i < keep; i++) {
      const incoming = trimmed[i] != null ? trimmed[i] : "";
      if (!d.paras[i]) d.paras[i] = { role: "Body " + (i + 1), point: "", text: "", feedback: null, gradedText: null };
      if ((d.paras[i].text || "") !== incoming) {
        d.paras[i].text = incoming;
        if (d.paras[i].feedback && (d.paras[i].gradedText || "") !== incoming) { d.paras[i].feedback = null; d.paras[i].gradedText = null; }
      }
    }
    if (d.paras.length > keep) d.paras.length = keep;
    // Keep the conclusion as the LAST paragraph: when a student exceeds the
    // scaffold, the extra paragraphs become bodies inserted before the conclusion,
    // never after it, so the final paragraph is never mislabelled as a body.
    const roles = esStructureDef(d.structure).roles, concl = roles[roles.length - 1];
    d.paras.forEach((pp, i) => {
      pp.role = (i < roles.length - 1) ? roles[i]
              : (i === d.paras.length - 1) ? concl
              : "Body " + i;
    });
    esSaveDraft();
  }
  function esGoCoached(pos) {
    ES.draft.mode = "coached"; ES.draft.pos = Math.max(0, Math.min(pos, ES.draft.paras.length - 1));
    ES.screen = "coached"; esSaveDraft(); esRender();
  }
  // Sending a full attempt for marking is the newest part of essay mode, so it
  // carries its own switch while it is being walked, exactly like review mode.
  // CONFIG.essayMarking promotes it; ?essaymark=1 (or ?essaydemo=1) tries it alone.
  function essayMarkingEnabled() {
    if (ES.demo) return true;
    if (CONFIG.essayMarking === true) return true;
    if (/[?&]essaymark=1/.test(location.search)) return true;
    try { if (localStorage.getItem("marginal.essaymark") === "1") return true; } catch (e) { /* sandboxed */ }
    return false;
  }
  // The HSC directive verb the question opens with, read off the question text
  // itself. That means it works on a question the student typed, and on a question
  // in an imported paper that never tagged one.
  const ES_COMMANDS = ["account for", "to what extent", "assess", "evaluate", "analyse", "analyze", "discuss", "explain",
                       "examine", "describe", "outline", "compare", "contrast", "distinguish", "justify", "propose",
                       "recommend", "how can", "identify", "demonstrate", "why"].sort((a, b) => b.length - a.length);
  function commandOf(q) {
    // An imported paper keeps its numbering in the prompt ("Question 21 (a) Outline
    // the..."), so strip a leading question label before looking for the verb.
    const t = String(q || "").trim().toLowerCase()
      .replace(/^(?:question\s*)?\d+\s*(?:\([a-z0-9]+\)\s*)*[.:)\-]?\s*/i, "");
    const hit = ES_COMMANDS.find(c => t.indexOf(c) === 0);
    return hit ? hit.replace(/\b\w/g, ch => ch.toUpperCase()) : "";
  }
  // The draft IS the plan: the point the student wrote for each paragraph, and the
  // overall line from the introduction. Sent as context for READING the response.
  // The worker routes it to the diagnosis pass only, so it can never award a mark.
  function esPlanFromDraft(d) {
    const intro = d.paras.find(pp => /introduction|intro/i.test(pp.role || ""));
    return {
      argument: (intro && intro.point) || "",
      paragraphs: d.paras.map(pp => ({ role: pp.role, point: pp.point || "", evidence: [] })),
    };
  }
  // A marking card built from the draft. Nothing is invented: there is no reference
  // answer, no metalanguage list and no anticipated faults for a question the
  // student brought, so those go across empty and the marker marks the writing.
  function esMarkCard(d) {
    const sc = esSubjectContent(ES.subject);
    // When the student started from one of our questions, its definition travels
    // with the response: what the question requires, and which bands to judge it
    // against. On their own question there is no definition, and the marker marks
    // the writing against the general expectations. Both cases are first class.
    const def = (d.questionId && sc && (sc.questions || []).find(x => x.id === d.questionId)) || null;
    return {
      id: "es-" + d.id, type: "essay",
      prompt: d.question, command: d.command || commandOf(d.question),
      marks: d.marks || (def && def.marks) || 20,
      topic: d.topic || (def && def.topic) || "",
      subject: esSubjectLabel() || undefined,
      markingCriteria: (sc && sc.markingCriteria) || undefined,
      requirements: (def && def.requirements) || undefined,
      criteria: (def && def.criteria) || undefined,
      rubric: d.rubric || "",
      model: "", vocab: [], scaffold: [], faults: [],
    };
  }
  async function esSubmitFull() {
    const d = ES.draft;
    const answer = d.paras.map(pp => (pp.text || "").trim()).filter(Boolean).join("\n\n");
    if (!answer.trim()) { toast("Write your essay before submitting."); return; }
    const host = document.getElementById("eshost");
    const box = host.querySelector(".es-completion");
    if (!essayMarkingEnabled()) {
      box.innerHTML = `
      <div class="es-submitted">
        <div class="es-submittedh">Saved. Your full attempt is kept as one draft.</div>
        <p class="es-help">When marking is switched on for ${esc(esSubjectLabel() || "your subject")}, Submit will send this for a grade. Coaching and marking stay separate, so connecting one never changes the other.</p>
        <button class="es-linkbtn" id="esbacksetup">Back to setup</button>
      </div>`;
      const b = $("#esbacksetup"); if (b) b.onclick = () => { ES.screen = "setup"; esRender(); };
      return;
    }
    box.innerHTML = `<div class="es-submitted"><div class="es-submittedh">Marking your response…</div><p class="es-help">The marker reads what you actually wrote, paragraph by paragraph. This takes a moment.</p></div>`;
    const g = await gradeWritten(esMarkCard(d), answer, { plan: esPlanFromDraft(d), responseType: "extended", blocks: esAllBlocks(d) });
    d.mark = { score: g.score, max: g.max, at: new Date().toISOString() };
    esSaveDraft();
    esRenderMarked(g, answer);
  }
  // The result: the mark, then the ONE thing to do next, then a way back into the
  // writing. Reading the full feedback is the secondary action on purpose, because
  // the cycle is write, feedback, revise, not write, mark, done.
  function esRenderMarked(g, answer) {
    const host = document.getElementById("eshost");
    const box = host && host.querySelector(".es-completion");
    if (!box) return;
    const rv = g.fb && Array.isArray(g.fb.paragraphs) && g.fb.paragraphs.length ? g.fb : null;
    if (rv) rvEnsureFocus(rv);
    const f = rv && rv.focus;
    const where = f && rv.paragraphs[f.index] && rv.paragraphs[f.index].name
      ? rv.paragraphs[f.index].name : (f ? "paragraph " + (f.index + 1) : "");
    box.innerHTML = `
      <div class="es-marked">
        <div class="es-markhead"><span class="es-markscore">${g.score}<small>/${g.max}</small></span><span class="es-markwhat">marked on what you wrote</span></div>
        ${g.kind === "demo" ? `<p class="es-help">${esc((g.fb && g.fb.overall && g.fb.overall.summary) || "")}</p>` : ""}
        ${f ? `<div class="es-markfocus">
          <div class="es-markarea"><span class="es-marktag">start here</span>${esc(f.area)}</div>
          ${f.why ? `<p class="es-markwhy">${esc(f.why)}</p>` : ""}
          ${f.quote ? `<p class="es-markquote">${esc(f.quote)}</p>` : ""}
        </div>` : ""}
        <div class="es-actions">
          ${f ? `<button class="es-btn primary" id="esrevise">Revise ${esc(String(where).toLowerCase())}</button>` : ""}
          ${rv ? `<button class="es-btn ghost" id="esseemark">See the full marking</button>` : ""}
          <button class="es-linkbtn" id="esbacksetup">Back to setup</button>
        </div>
      </div>`;
    const bk = $("#esbacksetup"); if (bk) bk.onclick = () => { ES.screen = "setup"; esRender(); };
    const rvb = $("#esrevise"); if (rvb && f) rvb.onclick = () => { ES.reviseBlockId = f.targetBlockId || ""; esReviseParagraph(f.index, f.quote); };
    const see = $("#esseemark"); if (see && rv) see.onclick = () => openReview(rv, null, {
      onRevise: (idx, quote) => { ES.reviseBlockId = (rv.focus && rv.focus.targetBlockId) || ""; esReviseParagraph(idx, quote); },
    });
  }
  // Feedback hands the student back to WRITING. Open the coached screen on that
  // paragraph and put the cursor on the line the marker pointed at, so the next
  // action is typing rather than reading more feedback.
  // The marker numbers the paragraphs it was SENT, and an empty structure slot is
  // never sent. Map its numbering back through the filled slots, or "revise your
  // second paragraph" lands on slot 2 rather than on the paragraph the student
  // actually wrote second.
  function esFilledSlots(d) { return d.paras.map((pp, i) => i).filter(i => (d.paras[i].text || "").trim()); }
  function esSlotForMarked(idx) {
    const d = ES.draft; if (!d) return 0;
    const filled = esFilledSlots(d);
    if (!filled.length) return 0;
    const at = filled[Math.max(0, Number(idx) || 0)];
    return at == null ? filled[filled.length - 1] : at;
  }
  function esReviseParagraph(idx, quote) {
    const d = ES.draft; if (!d) return;
    const slot = esSlotForMarked(idx);
    const p = d.paras[slot];
    // Open the exact SENTENCE the marker pointed at, as an editable block, rather
    // than dropping the student into a paragraph with a selection they can lose on
    // the first keystroke. Falls back to the paragraph when the line cannot be found.
    ES.ui.editBlock = p ? esBlockTarget(p, quote, ES.reviseBlockId) : null;
        esGoCoached(slot);
    const box = ES.ui.editBlock != null && document.querySelector('[data-esedit="' + ES.ui.editBlock + '"]');
    if (box) { box.focus(); try { box.setSelectionRange(box.value.length, box.value.length); } catch (e) { /* older browsers */ } }
    toast(ES.ui.editBlock != null ? "Rewrite this sentence, then Save." : "Rewrite this paragraph, then check it again.");
  }
  // Which sentence the marker meant. A verified block id is exact; the quote is the
  // fallback for an older worker that does not return one.
  function esBlockTarget(p, quote, blockId) {
    if (blockId) {
      const k = esBlocks(p).findIndex(b => b.id === blockId);
      if (k >= 0) return k;
    }
    return esBlockForQuote(p, quote);
  }
  // A quotation only names a sentence when it names exactly one. Two sentences that
  // both match means we do not know which, so the student is returned to the
  // paragraph rather than sent to a guess.
  function esBlockForQuote(p, quote) {
    const q = String(quote || "").trim().toLowerCase();
    if (!q) return null;
    const blocks = esBlocks(p);
    const head = q.split(/\s+/).slice(0, 6).join(" ");
    const hits = [];
    for (let i = 0; i < blocks.length; i++) {
      const t = blocks[i].text.toLowerCase();
      if (t.indexOf(q) >= 0 || (head.length > 8 && t.indexOf(head) >= 0) || q.indexOf(t) >= 0) hits.push(i);
    }
    return hits.length === 1 ? hits[0] : null;
  }
  // Where the marker's line sits inside the paragraph. Exact match first, then the
  // opening few words. Returns null rather than guessing, so a miss just leaves the
  // cursor at the start of the paragraph.
  function esLocateQuote(text, quote) {
    const q = String(quote || "").trim();
    if (!q) return null;
    const i = text.indexOf(q);
    if (i >= 0) return { start: i, end: i + q.length };
    const head = q.split(/\s+/).slice(0, 6).join(" ");
    const j = head.length > 8 ? text.indexOf(head) : -1;
    if (j < 0) return null;
    const dot = text.indexOf(".", j + head.length);
    return { start: j, end: dot >= 0 ? dot + 1 : Math.min(text.length, j + q.length) };
  }

  function esBindWritingHead() {
    esBindDecode();
    const x = $("#esx"); if (x) x.onclick = () => { ES.screen = "setup"; esRender(); };
    const sw = $("#esmodeswitch"); if (sw) sw.onclick = () => {
      ES.draft.mode = ES.draft.mode === "full" ? "coached" : "full";
      ES.screen = ES.draft.mode; esSaveDraft(); esRender();
    };
  }

  // The coaching call. Real Haiku feedback when the worker is connected; otherwise
  // the labelled demo fallback (coachSample), mirroring demoEssay. The rubric rides
  // along only when present: an empty rubric is simply not sent, and the worker
  // falls back to generic HSC band expectations.
  async function esGetFeedback(idx) {
    const d = ES.draft, p = d.paras[idx];
    if (!p || !(p.text || "").trim()) { toast("Write something in this paragraph first."); return; }
    // Snapshot the paragraph as submitted: the textarea stays editable while the
    // request is in flight, so feedback (and the cooldown anchor) must tie to the
    // version actually reviewed, not whatever the student typed meanwhile.
    const submittedText = p.text;
    // Show the pending state WITHOUT collapsing the margin: replacing the margin with
    // a short "Asking..." shrinks the page and clamps the scroll, which then reads as
    // a jump. Instead, just disable/relabel the ask button and drop a small banner at
    // the top of the existing margin, so height (and scroll) stay put. Feedback then
    // arrives via one scroll-preserving esRender.
    ES.pending = true;
    const askBtn = $("#esask");
    if (askBtn) { askBtn.disabled = true; askBtn.textContent = "Asking the coach…"; askBtn.classList.remove("primary"); askBtn.classList.add("ghost"); }
    const marginEl = document.querySelector(".es-margin");
    if (marginEl && !marginEl.querySelector(".es-asking")) marginEl.insertAdjacentHTML("afterbegin", '<div class="es-asking">asking the coach…</div>');
    let fb;
    const useWorker = state.endpoint && !ES.demo;
    if (useWorker) {
      try {
        const payload = {
          action: "coach",
          paragraph_text: submittedText, paragraph_role: p.role, planned_point: p.point || "",
          question: d.question, topic: d.topic || "",
          structure: esStructureLabel(d.structure), subject: ES.subject || undefined,
          paragraph_model: d.paraModel || undefined,
          // Tell the coach the exact slots expected for THIS paragraph (key + label +
          // job). Lets the worker detect absent elements for any scaffold (TEEEC/
          // TDECC included) without a per-subject worker change. Backward compatible:
          // an older worker ignores it and falls back to its built-in slot keys.
          slots: slotsForRole(p.role).map(s => ({ key: s.key, label: s.label, job: s.job })),
          code: state.code || undefined
        };
        if ((d.rubric || "").trim()) payload.rubric = d.rubric.trim(); // omit when skipped -> generic bands
        const res = await fetch(state.endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error("coach " + res.status);
        fb = esNormalizeCoach(await res.json(), "", p.role);
      } catch (e) {
        fb = esNormalizeCoach(esDemoRaw(p.role), "Could not reach coaching (" + e.message + "). Showing demo suggestions instead.", p.role);
      }
    } else {
      fb = esNormalizeCoach(esDemoRaw(p.role), ES.demo
        ? "Demo coaching. Real Haiku feedback switches on once the worker is re-pasted."
        : "Demo coaching. Real feedback switches on once your teacher connects coaching.", p.role);
    }
    p.feedback = fb; p.gradedText = submittedText; // cooldown anchor: must revise before re-asking
    esResetCoachUI(); // fresh feedback: missing-element cards start collapsed (Tier 0), polish tucked
    ES.pending = false; esSaveDraft();
    // Update ONLY the parts that changed, in place: the margin gets the new result,
    // the ask button returns to its cooldown state, the stepper marks this paragraph
    // done, and the sequencing nudge refreshes. No full esRender, so nothing flashes.
    if (ES.screen === "coached" && ES.draft && ES.draft.pos === idx) {
      const host = document.getElementById("eshost");
      const m = host && host.querySelector(".es-margin");
      if (m) { m.innerHTML = esCoachMargin(p); host.querySelectorAll("button:not([type])").forEach(b => b.type = "button"); esBindCoachMargin(p); }
      // The missing set changed, so rebuild the ordered shape and rebind it. It stays
      // on screen either way; what changes is which rows read as done and which gaps
      // open their frame.
      const lh = host && host.querySelector("[data-linehost]");
      if (lh) { lh.innerHTML = esLinesBlock(p); host.querySelectorAll("button:not([type])").forEach(b => b.type = "button"); esBindLines(); }
      esRefreshAskButton(p);
      const step = host && host.querySelectorAll(".es-step")[idx]; if (step) step.classList.add("done");
      const seqHost = host && host.querySelector(".es-seqhost"); if (seqHost) { seqHost.innerHTML = esSeqNudge(p); esBindSeqNudge(p); }
    } else {
      esRender(); // not on this paragraph any more (rare) -> safe full render
    }
  }
  // Apply a word-level chip: the STUDENT picks it, the app swaps the word in their
  // own text. The coach never substitutes the paragraph. Changing the text also
  // releases the cooldown (a revision happened), so they can ask again.
  function esApplyChip(idx, from, option) {
    const p = ES.draft.paras[idx];
    const re = new RegExp("\\b" + String(from).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i");
    if (!re.test(p.text || "")) { toast("That word is not in your paragraph now."); return; }
    // Function replacer so $&, $1, $' etc. in a chip option are inserted literally,
    // not interpreted as replacement tokens.
    p.text = p.text.replace(re, () => option);
    p.mastered = false; esResetQuiz(); // the student's text changed: unmaster, like an edit
    // Update the textarea in place (no full re-render, no scroll jump); the cooldown
    // releases because the text now differs from what was last reviewed.
    // Update the textarea in place. Do NOT focus or move the caret: that scrolls the
    // textarea into view and jumps the page away from the chip the student just used.
    const ta = $("#espara"); if (ta) ta.value = p.text;
    esSaveDraft(); esRefreshAskButton(p);
  }

  // ?essaydemo=1 dev entry. Respects the gate exactly like ?reviewdemo: only opens
  // once we know the student is allowed in. Forces an 11Anc1 Ancient History
  // context so all three screens are walkable on the real student page.
  function maybeOpenEssayDemo() {
    if (gated()) return;
    try {
      if (/[?&]essaydemo=1/.test(location.search)) { esOpen({ demo: true, subject: "ancient_history", code: "11Anc1" }); return; }
      // A per-browser opt-in (the ?essay=1 URL flag OR localStorage marginal.essay)
      // opens essay mode for one tester. The global CONFIG.essayMode flag does NOT
      // auto-open it, so flipping the promotion switch never forces a full-screen
      // takeover on every student; its in-app entry point is the go-live step.
      let ls = false; try { ls = localStorage.getItem("marginal.essay") === "1"; } catch (e) { /* sandboxed */ }
      if (/[?&]essay=1/.test(location.search) || ls) esOpen({});
    } catch (e) { /* demo entry is best-effort */ }
  }

  // Boot. When cloud auth is configured, the app is gated: recover any persisted
  // session first (no flash), then either land in the app (returning student) or
  // show the sign-in gate. When unconfigured, the app opens normally.
  Cloud.init();
  if (cloudConfigured()) {
    app.innerHTML = `<div class="authgate"><div class="authcard"><div class="authbrand">Marginal</div><p class="bhint">Loading…</p></div></div>`;
    Cloud.restore()
      .then(() => { if (Cloud.session()) { home(); maybeOpenReviewDemo(); maybeOpenEssayDemo(); } else authScreen(); })
      .catch(() => authScreen());
  } else {
    home();
    maybeOpenReviewDemo();
    maybeOpenEssayDemo();
  }
})();
