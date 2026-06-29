// =============================================================================
// Marginal — long-response review proxy (Cloudflare Worker)
// Deploy free at workers.cloudflare.com:
//   1. Create a Worker, paste this file.
//   2. Settings -> Variables and Secrets -> add SECRETS ANTHROPIC_API_KEY and CLASS_CODE.
//   3. Copy the worker URL into the TEACHER SETUP block in index.html.
// The key never leaves the worker. Rate-limited to 20 grades / 10 min per IP.
//
// Returns the structured REVIEW contract consumed by review mode (see
// review-model.md). Legacy fields (score/overall/criteria/...) are derived in
// code in finalize(), so the current essay sheet keeps rendering until the
// review UI ships. Changing this prompt in the repo does NOT update the live
// worker: re-paste and redeploy it in Cloudflare for changes to take effect.
// =============================================================================
const MODEL = "claude-sonnet-4-6"; // sharper essay feedback; swap to "claude-haiku-4-5-20251001" for cheaper grading
// COACHING (essay practice) runs on the cheaper, faster Haiku. Marking above is
// left on its current model on purpose. Output is capped short (suggestions only).
const COACH_MODEL = "claude-haiku-4-5"; // dated pin if needed: claude-haiku-4-5-20251001
const COACH_MAX_TOKENS = 700;
const WINDOW_MS = 10 * 60 * 1000, MAX_PER_WINDOW = 20;
const hits = new Map(); // in-memory per-isolate limiter (fine for a small trial)
const SEVRANK = { critical: 0, should: 1, optional: 2 };

// The grading prompt. Every model sentence, starter, reason, descriptor and
// explanation must be in writable Year 12 English with NO em-dashes, so it
// reads as something a student could actually write.
const SYSTEM = `You are an experienced HSC Economics marker building a paragraph-by-paragraph review that teaches a student to improve their extended response.

Mark honestly. Flag every real fault, even if that means most of a paragraph is marked, because leniency teaches a student that a flawed answer is nearly perfect. The marks must be consistent with what you flag: a paragraph with several weak sentences cannot score near full marks, and the total is the sum of the paragraph marks.

Scale your depth to the band. For a weaker response, surface fewer and more foundational issues, fixing the thesis before piling on refinements. For a stronger response, give the sophisticated polish. Never overwhelm.

Break each paragraph into its sentences in order. Keep a strong sentence with an empty issues array. For each weak sentence, attach one issue per distinct fault. Where a key sentence is absent, such as a missing thesis or a missing link to the next paragraph, add a sentence with text set to null, set link to true when it is a connective, and give a short missing_label naming what belongs there.

Each issue has a severity: critical when it loses marks, should when it lifts the band, optional for an add-a-term suggestion. Give each issue a short head and a why of one to three sentences. Mark any key term inside why with {{term|definition|page}} so the app can make it tappable. Use 0 for page when you do not know it.

Each issue carries a three-rung ladder: Clear, Better, Band 6. Every rung must be creditworthy. Clear is the simplest sentence that still earns the mark, never a failing strawman. Better is solid mid-band. Band 6 is exceptional. Give only the sentence for each rung. Do not write practice starters: the app derives those from each rung's sentence.

Return the four rubric criteria (thesis and sustained judgement, use of evidence and data, economic terminology, cohesion) with marks, a one-line descriptor, and band descriptors, setting here to true on the band the response sits in. Keep the rubric marks consistent with the paragraph marks.

Register: use commas, colons and because, since or as clauses, and full stops. Do not use em-dashes anywhere in your output, because a student would not write them. Return the review only through the submit_review tool.`;

// Rungs carry only the sentence. The app derives the three fading practice
// starters from each rung's text (see review-model.md), which keeps the model
// output small enough to finish within the worker timeout and makes the
// rung/starter mismatch impossible by construction.
const LADDER_SCHEMA = {
  type: "array",
  minItems: 3,
  maxItems: 3,
  description: "Exactly three creditworthy rungs in order: Clear, Better, Band 6.",
  items: {
    type: "object",
    properties: {
      level: { type: "string", enum: ["Clear", "Better", "Band 6"] },
      text: { type: "string", description: "The full model sentence at this level, writable register, no em-dashes." },
    },
    required: ["level", "text"],
  },
};

const REVIEW_TOOL = {
  name: "submit_review",
  description: "Return the structured paragraph-by-paragraph review.",
  input_schema: {
    type: "object",
    properties: {
      summary: { type: "string", description: "One or two sentences overall, writable register, no em-dashes." },
      paragraphs: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Short role label, e.g. Introduction, Income redistribution, Judgement." },
            score: { type: "number", description: "Marks earned by this paragraph." },
            max: { type: "number", description: "Marks available for this paragraph." },
            reasons: {
              type: "array",
              description: "Brief score-open status list, strongest first.",
              items: {
                type: "object",
                properties: {
                  kind: { type: "string", enum: ["good", "weak"] },
                  text: { type: "string" },
                },
                required: ["kind", "text"],
              },
            },
            sentences: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  text: { type: ["string", "null"], description: "The sentence verbatim, or null for a key sentence that is missing." },
                  link: { type: "boolean", description: "True when a missing sentence is a forward or back link between paragraphs." },
                  missing_label: { type: "string", description: "For a missing sentence (text null), the short label shown on the chip." },
                  issues: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        kind: { type: "string", enum: ["fix", "term"] },
                        severity: { type: "string", enum: ["critical", "should", "optional"] },
                        head: { type: "string", description: "Short issue title." },
                        why: { type: "string", description: "One to three sentences, writable register, no em-dashes. Mark key terms with {{term|definition|page}}." },
                        ladder: LADDER_SCHEMA,
                      },
                      required: ["kind", "severity", "head", "why", "ladder"],
                    },
                  },
                },
                required: ["issues"],
              },
            },
          },
          required: ["name", "score", "max", "reasons", "sentences"],
        },
      },
      rubric: {
        type: "array",
        minItems: 4,
        maxItems: 4,
        description: "Exactly four criteria: thesis and sustained judgement, use of evidence and data, economic terminology, cohesion.",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            score: { type: "number" },
            max: { type: "number" },
            descriptor: { type: "string", description: "One line on what the criterion rewards." },
            bands: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  range: { type: "string", description: "Band range label, e.g. 1-2, 3-4, 5-6." },
                  text: { type: "string" },
                  here: { type: "boolean", description: "True for the band the response sits in." },
                },
                required: ["range", "text", "here"],
              },
            },
          },
          required: ["name", "score", "max", "descriptor", "bands"],
        },
      },
    },
    required: ["summary", "paragraphs", "rubric"],
  },
};

// =============================================================================
// COACHING — essay practice mode (separate from marking above).
// HARD RULE, enforced here AND in the app UX: SUGGEST, NEVER SUBSTITUTE. The
// coach never rewrites the paragraph and never returns a paste-ready sentence.
// Paragraph-level help is NUDGES PHRASED AS QUESTIONS. Word-level help is a few
// pickable alternatives the student applies themselves. Meaning, argument and
// structure stay the student's. The coach never supplies the argument or the
// content, and never asserts a factual correction (it says check your notes),
// the same hallucination guard as charts-from-real-data-only.
// The system prompt is prompt-cached because it repeats on every call.
// =============================================================================
const COACH_SYSTEM = `You are an HSC essay-writing coach working with one student on one paragraph at a time. You coach the craft of writing; you never write for the student.

Absolute rules, in order of importance:
1. Suggest, never substitute. Never rewrite the paragraph. Never return a model sentence, a paste-ready line, or a full replacement the student could copy. If you are tempted to write the better sentence, turn it into a question instead.
2. Paragraph-level and argument-level feedback is given only as short questions that make the student think, for example asking what a piece of evidence lets them claim, or how this paragraph links to their thesis. Questions, not answers.
3. Word-level help may offer a few alternative words or very short phrases the student can pick from, for a word they already used. Each alternative is at most a few words. Never a clause, never a sentence.
4. Never supply the argument, the evidence or the content. If the student seems to have a factual point that may be wrong, do not correct it and do not assert the right fact. Say that they should check it against their own notes.
5. Coach to HSC marking bands: analysis over description, cohesion and signposting, integrating evidence, register, and syntax. Be honest and specific, never flattering.

If a rubric or marking guide is provided, target your feedback at that rubric and its bands. If none is provided, use general HSC band expectations: top bands sustain a reasoned judgement with integrated, specific evidence and clear signposting; middle bands have a line of argument but slip into description; lower bands are mostly description with thin evidence.

Keep everything short. Writable register, no em-dashes anywhere, sentence case. Return your feedback only through the submit_coaching tool.`;

const COACH_TOOL = {
  name: "submit_coaching",
  description: "Return short coaching for one paragraph: a note, question-nudges, and word-level alternatives. Never a rewritten paragraph or sentence.",
  input_schema: {
    type: "object",
    properties: {
      note: { type: "string", description: "One or two honest sentences on where this paragraph sits against the bands. Not a rewrite." },
      nudges: {
        type: "array",
        description: "Up to four short QUESTIONS that push the student's thinking. Questions only, never answers, never model sentences.",
        items: { type: "string" },
      },
      chips: {
        type: "array",
        description: "Up to six word-level swaps for words the student already used. Each option is at most a few words. Never a clause or sentence.",
        items: {
          type: "object",
          properties: {
            from: { type: "string", description: "A word or very short phrase the student used." },
            options: { type: "array", items: { type: "string" }, description: "A few stronger alternatives, each at most a few words." },
          },
          required: ["from", "options"],
        },
      },
      check: { type: "string", description: "Optional. If a factual point looks shaky, tell the student to check it against their notes. Never assert the correct fact." },
    },
    required: ["note", "nudges"],
  },
};

// Belt-and-braces server-side enforcement of rule 1 and 3: drop any chip whose
// alternative is long enough to be a sentence rather than a word-level swap.
function shortPhrase(s, maxWords) { return String(s || "").trim().split(/\s+/).filter(Boolean).length <= maxWords; }
function normalizeCoaching(c) {
  const nudges = (Array.isArray(c.nudges) ? c.nudges : []).map(s => String(s || "").trim()).filter(Boolean).slice(0, 4);
  const chips = (Array.isArray(c.chips) ? c.chips : [])
    .map(x => ({
      from: String((x && x.from) || "").trim(),
      options: (Array.isArray(x && x.options) ? x.options : []).map(o => String(o || "").trim()).filter(Boolean).slice(0, 4),
    }))
    .filter(x => x.from && shortPhrase(x.from, 4) && x.options.length && x.options.every(o => shortPhrase(o, 6)))
    .slice(0, 6);
  return { note: String(c.note || "").trim(), nudges, chips, check: String(c.check || "").trim() };
}

async function handleCoach(body, env, cors) {
  const { paragraph_text, paragraph_role = "", planned_point = "", question = "", topic = "", rubric = "", structure = "", subject = "" } = body || {};
  if (!paragraph_text || !String(paragraph_text).trim()) return json({ error: "paragraph_text is required" }, 400, cors);
  if (String(paragraph_text).length > 6000) return json({ error: "paragraph too long" }, 400, cors);
  // Bound the other free-text fields too, not just the paragraph: with CLASS_CODE
  // unset, an unbounded rubric or question could inflate token usage and spend.
  if (String(rubric).length > 6000) return json({ error: "rubric too long" }, 400, cors);
  if (String(question).length > 4000) return json({ error: "question too long" }, 400, cors);
  if (String(planned_point).length > 2000) return json({ error: "planned point too long" }, 400, cors);
  if (String(topic).length > 500 || String(structure).length > 200 || String(subject).length > 100 || String(paragraph_role).length > 100) {
    return json({ error: "a field is too long" }, 400, cors);
  }

  const rubricBlock = String(rubric || "").trim()
    ? `RUBRIC OR MARKING GUIDE (target your feedback at this):\n${rubric}`
    : `RUBRIC: (none provided, use general HSC band expectations)`;

  const userMsg = `SUBJECT: ${subject || "(unspecified)"}
ESSAY QUESTION:
${question || "(not given)"}
${topic ? "CHOSEN TOPIC OR OPTION: " + topic + "\n" : ""}PLANNED STRUCTURE: ${structure || "(not given)"}
THIS PARAGRAPH'S ROLE: ${paragraph_role || "(unspecified)"}
THE STUDENT'S PLANNED POINT FOR THIS PARAGRAPH: ${planned_point || "(none written)"}

${rubricBlock}

THE STUDENT'S CURRENT PARAGRAPH:
${paragraph_text}

Coach this paragraph now. Remember: suggest, never substitute. Nudges are questions. Chips are word-level only.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: COACH_MODEL,
      max_tokens: COACH_MAX_TOKENS,
      system: [{ type: "text", text: COACH_SYSTEM, cache_control: { type: "ephemeral" } }],
      tools: [COACH_TOOL],
      tool_choice: { type: "tool", name: "submit_coaching" },
      messages: [{ role: "user", content: userMsg }],
    }),
  });
  if (!res.ok) return json({ error: "upstream " + res.status }, 502, cors);
  const data = await res.json();
  const block = (data.content || []).find(b => b.type === "tool_use");
  if (!block || !block.input) return json({ error: "coach returned nothing", stop_reason: data.stop_reason || null }, 502, cors);
  return json(normalizeCoaching(block.input), 200, cors);
}

export default {
  async fetch(req, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
    };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST") return json({ error: "POST only" }, 405, cors);

    // crude rate limit
    const ip = req.headers.get("cf-connecting-ip") || "unknown";
    const now = Date.now();
    const rec = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
    if (rec.length >= MAX_PER_WINDOW) return json({ error: "Slow down — try again in a few minutes." }, 429, cors);
    rec.push(now); hits.set(ip, rec);

    let body;
    try { body = await req.json(); } catch { return json({ error: "bad json" }, 400, cors); }
    const { prompt, marks, model_answer, vocab = [], answer, code, scaffold = [], faults = [], command } = body || {};
    // optional shared class code: set secret CLASS_CODE on the worker and only
    // requests carrying it are graded — stops strangers spending your credits.
    if (env.CLASS_CODE && code !== env.CLASS_CODE) return json({ error: "Class code missing or wrong — check Settings in the app." }, 403, cors);
    // Essay-practice coaching is a separate, Haiku-backed path with its own short
    // output. It shares the rate limit and class-code gate above, then returns.
    if (body && body.action === "coach") return await handleCoach(body, env, cors);
    if (!prompt || !answer || !marks) return json({ error: "prompt, marks and answer are required" }, 400, cors);
    if (answer.length > 12000) return json({ error: "answer too long" }, 400, cors);

    const paras = String(answer).split(/\n\s*\n/).map((p, i) => `[${i + 1}] ${p.trim()}`).join("\n\n");

    // Marking scheme for this question (the approved scaffold + anticipated
    // faults). Grade against it: reward the scaffold and key terms, and when an
    // anticipated fault appears, flag it at the given severity and base its
    // ladder on the one provided, adapted to the student's actual wording.
    const scaffoldText = (Array.isArray(scaffold) && scaffold.length)
      ? scaffold.map((s, i) => `${i + 1}. ${s}`).join("\n") : "(none provided)";
    const faultsText = (Array.isArray(faults) && faults.length)
      ? faults.map(f => `- [${f.severity || "should"}] ${f.head || ""}: ${f.why || ""}\n    ladder -> ${(f.ladder || []).map(r => `${r.level}: ${r.text}`).join(" | ")}`).join("\n")
      : "(none provided)";

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        // The review (paragraphs -> sentences -> issues, each with a 3-rung
        // ladder, plus the rubric) must finish within Cloudflare's worker
        // timeout. Starters are derived in the app, not generated here, which
        // roughly halves the output and keeps generation comfortably in time.
        max_tokens: 8000,
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        tools: [REVIEW_TOOL],
        tool_choice: { type: "tool", name: "submit_review" },
        messages: [{
          role: "user",
          content: `QUESTION${command ? " (" + command + ")" : ""} (${marks} marks):\n${prompt}\n\nREFERENCE, WHAT A TOP ANSWER COVERS:\n${model_answer || "(none provided)"}\n\nREQUIRED METALANGUAGE: ${vocab.join(", ") || "(none provided)"}\n\nSCAFFOLD THE ANSWER SHOULD FOLLOW:\n${scaffoldText}\n\nANTICIPATED FAULTS (grade against the marking scheme; if one appears, flag it at the given severity and base its ladder on the one below, adapted to the student's wording):\n${faultsText}\n\nSTUDENT ANSWER (numbered paragraphs):\n${paras}`,
        }],
      }),
    });

    if (!res.ok) return json({ error: "upstream " + res.status }, 502, cors);
    const data = await res.json();
    const block = (data.content || []).find(b => b.type === "tool_use");
    const r = block?.input;
    if (!r || !Array.isArray(r.paragraphs) || !r.paragraphs.length) {
      // stop_reason "max_tokens" here means the review truncated; raise max_tokens.
      return json({ error: "grader returned no review", stop_reason: data.stop_reason || null }, 502, cors);
    }
    return json(finalize(r, Number(marks)), 200, cors);
  },
};

function clamp(n, lo, hi) { n = Number(n) || 0; return Math.max(lo, Math.min(n, hi)); }

const LEVELS = ["Clear", "Better", "Band 6"];
const SEVS = ["critical", "should", "optional"];

// Coerce an array to exactly three entries (slice extras, pad shortfalls).
function exactly3(arr, fill) {
  const a = Array.isArray(arr) ? arr.slice(0, 3) : [];
  while (a.length < 3) a.push(fill(a.length, a));
  return a;
}
const asArray = v => (Array.isArray(v) ? v : []);
const asObject = v => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

// Guarantee the rendering contract the review UI assumes: every issue has a
// three-rung ladder (Clear/Better/Band 6, levels fixed by position). The app
// derives the practice starters from each rung's text, so they are not part of
// this payload. Every nested node is rebuilt through asArray/asObject, so a
// malformed payload (e.g. sentences:[null] or issues:["bad"]) is normalized
// rather than throwing.
function normalizeReview(r) {
  r.paragraphs = asArray(r.paragraphs).map(rawP => {
    const p = asObject(rawP);
    p.reasons = asArray(p.reasons).map(rawR => {
      const rs = asObject(rawR);
      return { kind: rs.kind === "good" ? "good" : "weak", text: String(rs.text || "") };
    });
    p.sentences = asArray(p.sentences).map(rawS => {
      const s = asObject(rawS);
      s.issues = asArray(s.issues).map(rawIss => {
        const iss = asObject(rawIss);
        iss.kind = iss.kind === "term" ? "term" : "fix";
        iss.severity = SEVS.includes(iss.severity) ? iss.severity : "should";
        iss.head = String(iss.head || "");
        iss.why = String(iss.why || "");
        const fallback = (typeof s.text === "string" && s.text) || iss.head || "";
        const rungs = exactly3(iss.ladder, (i, a) => (a[a.length - 1] ? { ...a[a.length - 1] } : { text: fallback }));
        iss.ladder = rungs.map((rawRg, i) => {
          const rg = asObject(rawRg);
          return { level: LEVELS[i], text: String(rg.text || fallback) };
        });
        return iss;
      });
      return s;
    });
    return p;
  });
  r.rubric = asArray(r.rubric).map(rawC => {
    const c = asObject(rawC);
    c.bands = asArray(c.bands).map(rawB => {
      const b = asObject(rawB);
      return { range: String(b.range || ""), text: String(b.text || ""), here: !!b.here };
    });
    return c;
  });
  return r;
}

// Enforce the honest-marking invariants in code (never trust the model to add
// up), and derive the legacy grade fields the current essay sheet still reads.
function finalize(r, marks) {
  normalizeReview(r);
  let total = 0;
  (r.paragraphs || []).forEach(p => {
    const pmax = Math.max(0, Number(p.max) || 0);
    p.max = pmax;
    p.score = clamp(p.score, 0, pmax || marks);
    total += p.score;
  });
  r.total = clamp(total, 0, marks);
  r.max = marks;
  (r.rubric || []).forEach(c => { c.score = clamp(c.score, 0, Math.max(0, Number(c.max) || 0)); });

  // ---- legacy fields (derived, not asked of the model) ----
  r.score = r.total;
  r.overall = { summary: r.summary || "" };
  r.criteria = (r.rubric || []).map(c => ({
    name: c.name,
    status: c.max && c.score >= c.max ? "met" : c.score > 0 ? "partial" : "missing",
    comment: c.descriptor || "",
  }));
  r.next_steps = (r.paragraphs || [])
    .flatMap(p => (p.sentences || []).flatMap(s => s.issues || []))
    .filter(i => i && i.severity !== "optional")
    .sort((a, b) => (SEVRANK[a.severity] ?? 1) - (SEVRANK[b.severity] ?? 1))
    .slice(0, 3)
    .map(i => i.head);
  r.missing_vocabulary = [];
  return r;
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, "content-type": "application/json" } });
}
