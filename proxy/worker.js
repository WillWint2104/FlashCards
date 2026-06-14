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

Each issue carries a three-rung ladder: Clear, Better, Band 6. Every rung must be creditworthy. Clear is the simplest sentence that still earns the mark, never a failing strawman. Better is solid mid-band. Band 6 is exceptional. Each rung carries its own three fading starters for spaced practice, derived from that rung's own sentence: rep 1 is the rung sentence with one key word blanked, rep 2 blanks more, rep 3 is just the blank. Write each blank as the literal string ____________ and wrap the word the student must recall as <b>____________</b>.

Return the four rubric criteria (thesis and sustained judgement, use of evidence and data, economic terminology, cohesion) with marks, a one-line descriptor, and band descriptors, setting here to true on the band the response sits in. Keep the rubric marks consistent with the paragraph marks.

Register: use commas, colons and because, since or as clauses, and full stops. Do not use em-dashes anywhere in your output, because a student would not write them. Return the review only through the submit_review tool.`;

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
      starters: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        description: "Exactly three fading starters derived from THIS rung's sentence: rep 1 most scaffolded, rep 3 nearly blank.",
        items: { type: "string" },
      },
    },
    required: ["level", "text", "starters"],
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
    const { prompt, marks, model_answer, vocab = [], answer, code } = body || {};
    // optional shared class code: set secret CLASS_CODE on the worker and only
    // requests carrying it are graded — stops strangers spending your credits.
    if (env.CLASS_CODE && code !== env.CLASS_CODE) return json({ error: "Class code missing or wrong — check Settings in the app." }, 403, cors);
    if (!prompt || !answer || !marks) return json({ error: "prompt, marks and answer are required" }, 400, cors);
    if (answer.length > 12000) return json({ error: "answer too long" }, 400, cors);

    const paras = String(answer).split(/\n\s*\n/).map((p, i) => `[${i + 1}] ${p.trim()}`).join("\n\n");

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8000,
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        tools: [REVIEW_TOOL],
        tool_choice: { type: "tool", name: "submit_review" },
        messages: [{
          role: "user",
          content: `QUESTION (${marks} marks):\n${prompt}\n\nREFERENCE, WHAT A TOP ANSWER COVERS:\n${model_answer || "(none provided)"}\n\nREQUIRED METALANGUAGE: ${vocab.join(", ") || "(none provided)"}\n\nSTUDENT ANSWER (numbered paragraphs):\n${paras}`,
        }],
      }),
    });

    if (!res.ok) return json({ error: "upstream " + res.status }, 502, cors);
    const data = await res.json();
    const block = (data.content || []).find(b => b.type === "tool_use");
    const r = block?.input;
    if (!r || !Array.isArray(r.paragraphs) || !r.paragraphs.length) {
      return json({ error: "grader returned no review" }, 502, cors);
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

// Guarantee the rendering contract the review UI assumes: every issue has a
// three-rung ladder (Clear/Better/Band 6, levels fixed by position) and every
// rung has three fading starters. The schema asks for this; this enforces it so
// a stray model response cannot break downstream rendering.
function normalizeReview(r) {
  (r.paragraphs || []).forEach(p => {
    (p.sentences || []).forEach(s => {
      s.issues = (s.issues || []).map(iss => {
        iss.kind = iss.kind === "term" ? "term" : "fix";
        iss.severity = SEVS.includes(iss.severity) ? iss.severity : "should";
        const fallback = (s.text || iss.head || "");
        const rungs = exactly3(iss.ladder, (i, a) => a[a.length - 1] ? { ...a[a.length - 1] } : { text: fallback, starters: [] });
        iss.ladder = rungs.map((rg, i) => ({
          level: LEVELS[i],
          text: String((rg && rg.text) || fallback),
          starters: exactly3(rg && rg.starters, () => "____________").map(x => String(x)),
        }));
        return iss;
      });
    });
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
