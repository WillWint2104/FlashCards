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
// PASS 1 of marking (the diagnosis) runs on the fast model. Pass 1 does not mark:
// it only reports what is on the page, and every observation it makes is checked
// against the student's own words in code before the marker sees it. The
// JUDGEMENT (pass 2) stays on MODEL above. Set DIAG_MODEL to MODEL if you would
// rather spend the latency.
const DIAG_MODEL = "claude-haiku-4-5-20251001";
const DIAG_MAX_TOKENS = 3000;
// Pass 1 is optional, so it is allowed to be slow but never allowed to hold the
// whole request open. Past this, the marker runs on the writing alone.
const DIAG_TIMEOUT_MS = 20000;
// COACHING (essay practice) runs on the cheaper, faster Haiku. Marking above is
// left on its current model on purpose. Output is capped short (suggestions only).
const COACH_MODEL = "claude-haiku-4-5-20251001"; // dated pin: the alias claude-haiku-4-5 is rejected on this account
const COACH_MAX_TOKENS = 700;
const WINDOW_MS = 10 * 60 * 1000, MAX_PER_WINDOW = 20;
const hits = new Map(); // in-memory per-isolate limiter (fine for a small trial)
const SEVRANK = { critical: 0, should: 1, optional: 2 };
// Marking criteria are SUBJECT-DRIVEN: the client sends the four dimensions from the
// subject's own namespace. These neutral defaults apply only when a subject ships
// none, so no subject is ever marked against another subject's criteria.
const DEFAULT_CRITERIA = [
  "knowledge and understanding of course content",
  "application of relevant evidence or examples",
  "subject terminology and concepts",
  "sustained, logical and cohesive response",
];
function markCriteria(raw) {
  const c = (Array.isArray(raw) ? raw : [])
    .map(x => String(x || "").trim()).filter(Boolean).slice(0, 4);
  return c.length === 4 ? c : DEFAULT_CRITERIA;
}

// =============================================================================
// TWO-PASS MARKING.
//
// PASS 1 DIAGNOSES. It describes what is actually on the page and assigns no
// marks: submit_diagnosis has no numeric field anywhere, so it is structurally
// incapable of scoring. Every observation must carry a verbatim quote, and
// normalizeDiagnosis() checks each quote against the student's own text, so an
// observation the response does not support is dropped before the marker sees it.
//
// PASS 2 JUDGES. It receives the question, the criteria, the band expectations,
// the VERIFIED diagnosis and the full response, and returns the review.
//
// The student's PLAN and our authored argument pathways go to PASS 1 ONLY. Pass 2,
// the pass that assigns marks, never receives them. That is the structural
// guarantee behind "the plan is context, not marks": it holds even if this prompt
// is edited, and the only way to break it is to add a field to PASS2_FIELDS.
// =============================================================================
const DIAG_SYSTEM = `You are reading one student's extended response and describing exactly what is on the page. You are not the marker. You give no marks, no band, no grade and no overall verdict, and you never say whether the response is good.

Report only what the student actually wrote, and quote them. Every observation must carry a short verbatim quote copied exactly from the response, because an observation you cannot quote is discarded before the marker sees it. Copy the words as they appear. Never quote the question, the plan, the scaffold or your own paraphrase.

Read the writing as written, not as intended. If the student planned an argument but the response does not carry it out, say it is not present. Never credit understanding that the words on the page do not show.

A student may argue something we did not anticipate. Record it as a real argument and mark it valid when it is defensible for this question. Deviating from the supplied pathways is not a fault, and those pathways are never the only correct answers.

Separate explaining from describing. Describing says what happened. Explaining says why it happened or what follows from it. Say which one each sentence does.

Separate evidence that is used from evidence that is only mentioned. Evidence is used when the response shows what it demonstrates. It is mentioned when it appears as a name, a figure or a case study and does no work.

Write in plain Year 12 English. Do not use em-dashes anywhere. Return the diagnosis only through the submit_diagnosis tool.`;

// Pass 1 must be structurally incapable of marking. This walks the tool schema at
// module load and refuses to start if a mark could ever fit in it: no mark-shaped
// property name, no band or grade enum, and no numeric field except the paragraph
// locators, which point at a place in the response and carry no value.
const MARK_KEY = /^(scores?|marks?|bands?|grades?|totals?|points?|rating|rank|level|percent|percentage|out_of|worth|weight|value)$/i;
const MARK_ENUM = /\b(band|mark|grade)\b|^\s*\d+\s*(\/\s*\d+)?\s*$/i;
const NUMERIC_LOCATORS = new Set(["paragraph"]);
function assertScoreFree(node, path) {
  path = path || "input_schema";
  if (!node || typeof node !== "object") return;
  const t = Array.isArray(node.type) ? node.type : [node.type];
  if (t.some(x => x === "number" || x === "integer") && !NUMERIC_LOCATORS.has(path.split(".").pop())) {
    throw new Error("pass 1 could score: numeric field at " + path);
  }
  if (Array.isArray(node.enum) && node.enum.some(v => MARK_ENUM.test(String(v)))) throw new Error("pass 1 could score: mark-like enum at " + path);
  if (node.properties) for (const k in node.properties) {
    if (MARK_KEY.test(k)) throw new Error("pass 1 could score: mark-like property " + k + " at " + path);
    assertScoreFree(node.properties[k], path + "." + k);
  }
  if (node.items) assertScoreFree(node.items, path + "[]");
}

const QUOTE_FIELD = { type: "string", description: "A short verbatim quote from the student's response, copied exactly. An observation whose quote does not appear in the response is discarded." };

const DIAG_TOOL = {
  name: "submit_diagnosis",
  description: "Describe what is actually in the student's response. Report only: no marks, no bands, no verdict.",
  input_schema: {
    type: "object",
    properties: {
      coverage: {
        type: "array",
        description: "One entry per part the question requires.",
        items: {
          type: "object",
          properties: {
            required: { type: "string", description: "The required concept, element or relationship, in the question's own terms." },
            state: { type: "string", enum: ["addressed", "partial", "absent"] },
            paragraph: { type: "number", description: "1-based paragraph where it is addressed, or 0 when absent." },
            quote: QUOTE_FIELD,
          },
          required: ["required", "state", "paragraph", "quote"],
        },
      },
      arguments: {
        type: "array",
        description: "The argument each paragraph actually makes, in the student's own words.",
        items: {
          type: "object",
          properties: {
            paragraph: { type: "number", description: "1-based paragraph number." },
            argument: { type: "string", description: "What this paragraph actually argues as written, not as intended." },
            onPathway: { type: "boolean", description: "True when it matches a supplied pathway. False is not a fault." },
            valid: { type: "boolean", description: "True when the argument is defensible for this question, whether or not it is one of ours." },
            quote: QUOTE_FIELD,
          },
          required: ["paragraph", "argument", "onPathway", "valid", "quote"],
        },
      },
      explanation: {
        type: "array",
        description: "Where the writing explains, and where it only describes or asserts.",
        items: {
          type: "object",
          properties: {
            paragraph: { type: "number", description: "1-based paragraph number." },
            mode: { type: "string", enum: ["explained", "descriptive", "asserted"] },
            note: { type: "string", description: "One sentence on what this sentence does or fails to do." },
            quote: QUOTE_FIELD,
          },
          required: ["paragraph", "mode", "note", "quote"],
        },
      },
      evidence: {
        type: "array",
        description: "Every example, source, case study or figure, and whether it does any work. The FACT and the CLAIM it supports are separate quotes, and they must be different words: a detail that is never turned into a claim has only been mentioned.",
        items: {
          type: "object",
          properties: {
            paragraph: { type: "number", description: "1-based paragraph number." },
            use: { type: "string", enum: ["used", "mentioned", "misused"] },
            note: { type: "string", description: "One sentence on what it shows, or on what it was left to show." },
            quote: { type: "string", description: "The FACT: the exact words carrying the detail, figure, source or case study. Copied verbatim." },
            claimQuote: { type: "string", description: "The CLAIM: a DIFFERENT run of the student's words saying what that fact demonstrates. Empty when they never say. Never the same words as the fact." },
          },
          required: ["paragraph", "use", "note", "quote", "claimQuote"],
        },
      },
      terminology: {
        type: "array",
        description: "Subject terms the student used, and whether each is used accurately.",
        items: {
          type: "object",
          properties: {
            term: { type: "string" },
            accurate: { type: "boolean" },
            note: { type: "string" },
            quote: QUOTE_FIELD,
          },
          required: ["term", "accurate", "note", "quote"],
        },
      },
      repetition: {
        type: "array",
        description: "Places where the response repeats itself without adding anything.",
        items: {
          type: "object",
          properties: {
            paragraph: { type: "number", description: "1-based paragraph number." },
            note: { type: "string" },
            quote: QUOTE_FIELD,
          },
          required: ["paragraph", "note", "quote"],
        },
      },
      missing: {
        type: "array",
        description: "What the question asks for that the response never does. No quote, because it is absent.",
        items: {
          type: "object",
          properties: {
            what: { type: "string" },
            where: { type: "string", description: "Where it belongs, e.g. the introduction, or the paragraph on processes." },
          },
          required: ["what", "where"],
        },
      },
      planVsResponse: {
        type: "array",
        description: "For each item the student planned, whether the response actually carries it out. Presence needs a verbatim quote: the worker forces present to false when the quote does not appear in the response.",
        items: {
          type: "object",
          properties: {
            planned: { type: "string" },
            present: { type: "boolean" },
            quote: { type: "string", description: "Verbatim quote showing it carried out. Empty when it is not present." },
          },
          required: ["planned", "present", "quote"],
        },
      },
      firstToFix: { type: "string", description: "The one paragraph or sentence that would gain most from a rewrite, named plainly. No marks." },
    },
    required: ["coverage", "arguments", "explanation", "evidence", "terminology", "repetition", "missing", "planVsResponse", "firstToFix"],
  },
};
// A Pass 1 that could score must never run. Throwing at module load would guarantee
// that, but this worker is deployed by hand-pasting the file, so a schema slip would
// take the whole app down with no visible error. Instead the check disables PASS 1
// and marking carries on single-pass: the guarantee holds, the app stays up, and the
// reason is visible in the response under checks.
let DIAG_SAFE = true, DIAG_UNSAFE_WHY = "";
try { assertScoreFree(DIAG_TOOL.input_schema); }
catch (e) { DIAG_SAFE = false; DIAG_UNSAFE_WHY = String(e.message || e); }

// The grading prompt. Every model sentence, starter, reason, descriptor and
// explanation must be in writable Year 12 English with NO em-dashes, so it
// reads as something a student could actually write.
const SYSTEM = `You are an experienced HSC marker for the SUBJECT named in the request, building a paragraph-by-paragraph review that teaches a student to improve their extended response. Mark as a specialist in that subject: use its terminology, its conventions and the kind of evidence it expects, never another subject's.

Mark honestly. Flag every real fault, even if that means most of a paragraph is marked, because leniency teaches a student that a flawed answer is nearly perfect. The marks must be consistent with what you flag: a paragraph with several weak sentences cannot score near full marks, and the total is the sum of the paragraph marks.

Scale your depth to the band. For a weaker response, surface fewer and more foundational issues, fixing the thesis before piling on refinements. For a stronger response, give the sophisticated polish. Never overwhelm.

Break each paragraph into its sentences in order. Keep a strong sentence with an empty issues array. For each weak sentence, attach one issue per distinct fault. Where a key sentence is absent, such as a missing thesis or a missing link to the next paragraph, add a sentence with text set to null, set link to true when it is a connective, and give a short missing_label naming what belongs there.

Each issue has a severity: critical when it loses marks, should when it lifts the band, optional for an add-a-term suggestion. Give each issue a short head and a why of one to three sentences. Mark any key term inside why with {{term|definition|page}} so the app can make it tappable. Use 0 for page when you do not know it.

Each issue carries a three-rung ladder: Clear, Better, Band 6. Every rung must be creditworthy. Clear is the simplest sentence that still earns the mark, never a failing strawman. Better is solid mid-band. Band 6 is exceptional. Give only the sentence for each rung. Do not write practice starters: the app derives those from each rung's sentence.

Build every rung out of what is already in this student's response and in the question. Never lift a sentence from the reference answer, the scaffold or any material supplied with the request. A rung is a better version of what THEY wrote, not a model answer for them to memorise.

Return the rubric exactly as the RESPONSE TYPE in the request directs. For an extended response that means one entry per MARKING CRITERION named in the request, in the order given, using those exact criterion names, each with marks, a one-line descriptor and band descriptors, setting here to true on the band the response sits in, and the rubric marks consistent with the paragraph marks. For a short answer it means an empty rubric, because band criteria describe an extended response and say nothing useful about a three-mark answer.

A DIAGNOSIS of this response comes with the request. It lists what the student actually wrote, quoted from their own page, and every quote in it has already been checked against their response. Use it as your evidence. It carries no marks and no verdict, so the judgement is entirely yours, but do not contradict a quoted observation without saying why.

Every reason you give and every issue you raise must point at this student's own words. Quote them, or name the exact place. Never write a comment that would fit any response, such as saying the explanation could be more detailed or the argument could be clearer. Say what THIS student wrote and what it does not yet do: for example, that a paragraph names a strategy but does not say why the cause named in the question led to it. If you cannot ground a comment in something on the page, do not make it.

Credit what the student argued, not what you would have argued. A defensible argument that is not the one our materials anticipated earns full marks. Never mark a response down for taking a different valid path, and never treat a reference answer or scaffold as a checklist. Equally, never infer understanding the words do not show.

Return a FOCUS: the single place the student should rewrite first, the improvement area it belongs to, one or two sentences saying what that paragraph does and does not do, and a short verbatim quote from it. One place only, and it must be the one that gains the most marks.

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
      focus: {
        type: "object",
        description: "Where the student should go back and rewrite FIRST. Exactly one place.",
        properties: {
          area: { type: "string", description: "The improvement area, two or three words, e.g. Explanation, Use of evidence, Judgement." },
          paragraph: { type: "number", description: "1-based number of the paragraph to revise first." },
          why: { type: "string", description: "One or two sentences on what this paragraph does and what it does not yet do, pointing at the student's own words. No em-dashes." },
          quote: { type: "string", description: "A short verbatim quote from that paragraph, copied exactly." },
          targetBlockId: { type: "string", description: "The id of the ONE sentence to rewrite, from the sentence list in the request. Empty when the issue is the paragraph as a whole rather than one line." },
        },
        required: ["area", "paragraph", "why", "quote", "targetBlockId"],
      },
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
              maxItems: 3,
              description: "Brief score-open status list, strongest first, at most three.",
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
                    maxItems: 2,
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
        maxItems: 4,
        description: "For an extended response, one entry per marking criterion named in the request, in that order, using those exact names. For a short answer, an empty array.",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            score: { type: "number" },
            max: { type: "number" },
            descriptor: { type: "string", description: "One line on what the criterion rewards." },
            bands: {
              type: "array",
              maxItems: 3,
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
    required: ["summary", "paragraphs", "rubric", "focus"],
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
// The paragraph slot model. The CLIENT now sends the exact slots expected for the
// paragraph in each request (key + label + job), so the coach adapts to any subject
// and paragraph structure (e.g. Business Studies TEEEC/TDECC) with no per-subject
// worker change. DEFAULT_SLOTS is the backward-compatible fallback used only when an
// older client sends no slots. The coach reports which slots are ABSENT by key only;
// the app supplies all human-facing label/job/frame text, so the coach never emits a
// frame, a worked example, or any real content for a missing element.
const DEFAULT_SLOTS = [
  { key: "point",     label: "point",       job: "state the argument this paragraph makes" },
  { key: "analysis",  label: "analysis",    job: "explain the effect or why it matters" },
  { key: "evidence",  label: "evidence",    job: "ground the point in a specific source or detail" },
  { key: "link",      label: "link",        job: "connect the point back to the question" },
  { key: "thesis",    label: "thesis",      job: "state the overall line of argument" },
  { key: "methods",   label: "approach",    job: "signpost how the essay will get there" },
  { key: "restate",   label: "restatement", job: "draw the argument together without simply repeating" },
  { key: "judgement", label: "judgement",   job: "land a clear, weighed judgement" }
];
const COACH_SLOT_KEYS = DEFAULT_SLOTS.map(s => s.key);
// Sanitise a client-sent slots spec: array of {key,label,job} with bounded lengths
// and a sane cap. Returns null when nothing usable is provided (caller falls back).
function sanitizeSlots(raw) {
  if (!Array.isArray(raw)) return null;
  const out = [];
  const seen = new Set();
  for (const s of raw) {
    const key = String((s && s.key) || "").trim().slice(0, 40);
    if (!key || seen.has(key)) continue;
    if (!/^[a-z0-9_]+$/i.test(key)) continue; // keys are simple identifiers
    seen.add(key);
    out.push({ key, label: String((s && s.label) || key).trim().slice(0, 60), job: String((s && s.job) || "").trim().slice(0, 200) });
    if (out.length >= 8) break;
  }
  return out.length ? out : null;
}

const COACH_SYSTEM = `You are an HSC essay-writing coach working with one student on one paragraph at a time. You coach the craft of writing; you never write for the student.

Absolute rules, in order of importance:
1. Suggest, never substitute. Never rewrite the paragraph. Never return a model sentence, a paste-ready line, or a full replacement the student could copy. If you are tempted to write the better sentence, turn it into a question instead.
2. Never supply content. Never write a frame, template, example sentence, or any real history, names, dates or model analysis, not even to illustrate a missing element. For a missing element you report only which element is missing; the app shows the student a blank frame, not you.
3. Paragraph-level and argument-level feedback is given only as short questions that make the student think. Questions, not answers.
4. Word-level help may offer a few alternative words or very short phrases the student can pick from, for a word they already used. Each alternative is at most a few words. Never a clause, never a sentence.
5. If the student seems to have a factual point that may be wrong, do not correct it and do not assert the right fact. Say that they should check it against their own notes.
6. Coach to HSC marking bands: analysis over description, cohesion and signposting, integrating evidence, register, and syntax. Be honest and specific, never flattering.

The paragraph slot model. The elements this paragraph should contain are listed in the user message under EXPECTED ELEMENTS, each with a key, a label and its job. Different subjects and paragraph structures use different elements (for example a Business Studies TEEEC or TDECC body paragraph), so always work from the elements given for THIS paragraph, not a fixed list.

Detect a GENUINELY ABSENT element, which is different from one that is present but weak. Report an absent element in "missing" using only its key from the EXPECTED ELEMENTS given for this paragraph. Do not list an element that is present but thin; for those, raise a question in "nudges" instead. Only report elements that belong to this paragraph.

LINE BY LINE guidance in "lines". Pick up to five of the student's own sentences that can be improved, weakest first. For each one:
- "quote" is the first six to twelve words of THEIR sentence, copied exactly, so the app can find it in their paragraph. Never paraphrase it.
- "issue" is a DIRECT diagnosis of what is wrong with that sentence. State it, do not ask it. Name the fault plainly, for example that the sentence describes instead of analysing, makes a claim with no evidence, never links back to the question, or leans on a vague verb. This is the one place you are direct rather than Socratic.
- "fix" is a CONTENT-FREE FRAME the student types over. Every frame must contain ____ blanks and must be useless on its own until they fill it. Never write their improved sentence, never fill a blank with real content, and never include any subject content, names, dates or figures in the frame.
Rule 1 still holds absolutely: you diagnose the problem precisely and hand them a blank frame, and the student writes the sentence.

Categorise each nudge so the app can surface substance first and tuck wording polish away:
- on_target: substance and analysis, the heart of answering the question.
- signposting: cohesion, ordering, and clear topic sentences.
- expression: register, word choice and syntax.

If a rubric or marking guide is provided, target your feedback at that rubric and its bands. If none is provided, use general HSC band expectations: top bands sustain a reasoned judgement with integrated, specific evidence and clear signposting; middle bands have a line of argument but slip into description; lower bands are mostly description with thin evidence.

Keep everything short. Writable register, no em-dashes anywhere, sentence case. Return your feedback only through the submit_coaching tool.`;

// The tool schema, with the "missing" slot enum locked to THIS paragraph's keys so
// the model can only report an absent element that actually belongs to the paragraph.
function coachTool(slotKeys) {
  return {
  name: "submit_coaching",
  description: "Return short coaching for one paragraph: a note, the absent elements (by key only), categorised question-nudges, and word-level alternatives. Never a rewritten paragraph, sentence, frame, or any content.",
  input_schema: {
    type: "object",
    properties: {
      note: { type: "string", description: "One or two honest sentences on where this paragraph sits against the bands. Not a rewrite." },
      missing: {
        type: "array",
        description: "Elements that are GENUINELY ABSENT from this paragraph (not merely weak). Report the KEY only; the app writes the guidance and shows a blank frame.",
        items: {
          type: "object",
          properties: {
            slot: { type: "string", enum: slotKeys, description: "Which element is missing." },
          },
          required: ["slot"],
        },
      },
      nudges: {
        type: "array",
        description: "Up to four short QUESTIONS that push the student's thinking. Questions only, never answers, never model sentences.",
        items: {
          type: "object",
          properties: {
            text: { type: "string", description: "A short question. Never an answer or a model sentence." },
            category: { type: "string", enum: ["on_target", "signposting", "expression"], description: "on_target for substance, signposting for cohesion, expression for wording." },
          },
          required: ["text", "category"],
        },
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
      lines: {
        type: "array",
        description: "LINE BY LINE guidance. Up to five of the student's own sentences that can be improved, weakest first. Diagnose directly, then give a blank frame. NEVER write the improved sentence for them.",
        items: {
          type: "object",
          properties: {
            quote: { type: "string", description: "The FIRST FEW WORDS of the student's sentence, copied verbatim from their paragraph so the app can locate it. Six to twelve words. Never your own wording." },
            issue: { type: "string", description: "What is wrong with this specific sentence, stated DIRECTLY as a diagnosis, not as a question. One sentence, at most 30 words. Name the fault, for example describing instead of analysing, no link to the question, a claim with no evidence, or a vague verb." },
            fix: { type: "string", description: "A CONTENT-FREE FRAME the student types over, using ____ for every blank. It must contain at least one ____ and must never be a usable sentence on its own. For example: This shows ____ because ____, which addresses ____. Never fill a blank with real content, and never restate their sentence improved." },
            severity: { type: "string", enum: ["critical", "should", "optional"], description: "critical loses marks, should lifts the band, optional is polish." },
          },
          required: ["quote", "issue", "fix", "severity"],
        },
      },
    },
    required: ["note", "nudges"],
  },
  };
}

// Belt-and-braces server-side enforcement of the suggest-never-substitute rule on
// EVERY field, not just chips: nudges must read as questions and stay short, note
// and check are dropped when long enough to be a paste-ready sentence/paragraph,
// and chips stay word-level. So a misbehaving model can never return a
// substitution through any field. (The client enforces the same limits.)
function shortPhrase(s, maxWords) { return String(s || "").trim().split(/\s+/).filter(Boolean).length <= maxWords; }
// A frame is meant to be CONNECTIVE TISSUE: blanks joined by structural words. The
// model could otherwise smuggle real content into the words around the blanks, for
// example "Factoring improves liquidity because ____", which hands the student half
// the sentence. So the words outside the blanks must all come from this structural
// vocabulary. Anything subject-specific fails, and the line is dropped rather than
// shown. Failing closed loses a hint, which is far better than leaking an answer.
const FRAME_WORDS = new Set(("a an and as at because been be but by can could for from had has have how however " +
  "if in into is it its led leads mean means more most of on one only or over shows show shown since so such than " +
  "that the their then there therefore these this those through to was were what when which while who why will with " +
  "addresses affect affects allowed allows applies argues assess balance change changed compare demonstrates effect " +
  "evidence example explains front further gives helps illustrates impact improves increases indicates influence " +
  "instead judgement key later link linked makes matters method overall point produces reason reduces reveals " +
  "result results significant significance shows source suggests supported supports term therefore thus way ways " +
  "whereas whether although despite consider considered addressing meaning matter compared contrast").split(/\s+/));
function isFrame(fix) {
  const words = String(fix || "").replace(/_{2,}/g, " ").toLowerCase().replace(/[^a-z ]/g, " ").split(/\s+/).filter(Boolean);
  return words.every(w => FRAME_WORDS.has(w));
}
function normalizeCoaching(c, slotKeys) {
  // missing: keep only keys valid FOR THIS PARAGRAPH (by key alone, no model-written
  // text), deduped. Falls back to the default keys when none were provided.
  const valid = new Set(Array.isArray(slotKeys) && slotKeys.length ? slotKeys : COACH_SLOT_KEYS);
  const seen = new Set();
  const missing = (Array.isArray(c.missing) ? c.missing : [])
    .map(m => ({ slot: String((m && m.slot) || "").trim() }))
    .filter(m => valid.has(m.slot) && !seen.has(m.slot) && seen.add(m.slot))
    .slice(0, 6);
  // nudges are objects {text, category}; keep only short questions, default category on_target.
  const CATS = ["on_target", "signposting", "expression"];
  const nudges = (Array.isArray(c.nudges) ? c.nudges : [])
    .map(n => (typeof n === "string" ? { text: n, category: "on_target" } : { text: String((n && n.text) || "").trim(), category: String((n && n.category) || "").trim() }))
    .filter(n => n.text && /\?\s*$/.test(n.text) && shortPhrase(n.text, 40)) // must END as a question
    .map(n => ({ text: n.text, category: CATS.includes(n.category) ? n.category : "on_target" }))
    .slice(0, 4);
  const chips = (Array.isArray(c.chips) ? c.chips : [])
    .map(x => ({
      from: String((x && x.from) || "").trim(),
      options: (Array.isArray(x && x.options) ? x.options : []).map(o => String(o || "").trim()).filter(Boolean).slice(0, 4),
    }))
    .filter(x => x.from && shortPhrase(x.from, 4) && x.options.length && x.options.every(o => shortPhrase(o, 6)))
    .slice(0, 6);
  // lines: DIRECT per-sentence diagnosis plus a CONTENT-FREE frame. The frame is the
  // one place the model could smuggle in a paste-ready sentence, so it is enforced
  // here in code, not just asked for in the prompt: a fix must carry blanks, must
  // stay short, and must not be usable prose once the blanks are removed.
  const lines = (Array.isArray(c.lines) ? c.lines : [])
    .map(l => ({
      quote: String((l && l.quote) || "").trim(),
      issue: String((l && l.issue) || "").trim(),
      fix: String((l && l.fix) || "").trim(),
      severity: String((l && l.severity) || "should").trim(),
    }))
    .filter(l => l.issue && l.fix)                          // quote is only a locator hint
    .filter(l => shortPhrase(l.quote, 14) && shortPhrase(l.issue, 34) && shortPhrase(l.fix, 26))
    .filter(l => /_{2,}/.test(l.fix))                       // a frame MUST have blanks
    .filter(l => l.fix.replace(/_{2,}/g, " ").split(/\s+/).filter(Boolean).length <= 12) // and stay a frame, not a sentence
    .filter(l => isFrame(l.fix))                            // structural words only: no smuggled content
    .map(l => ({ ...l, severity: ["critical", "should", "optional"].includes(l.severity) ? l.severity : "should" }))
    .slice(0, 5);
  const note = String(c.note || "").trim();
  const check = String(c.check || "").trim();
  return {
    note: shortPhrase(note, 60) ? note : "",
    missing, nudges, chips, lines,
    check: (check && shortPhrase(check, 30)) ? check : "",
  };
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

  // The expected elements for THIS paragraph, from the client (adapts to TEEEC/TDECC
  // etc.), or the default slot model for an older client.
  const paragraph_model = String((body && body.paragraph_model) || "").trim().slice(0, 40);
  const slots = sanitizeSlots(body && body.slots) || DEFAULT_SLOTS;
  const slotKeys = slots.map(s => s.key);
  const slotBlock = "EXPECTED ELEMENTS FOR THIS PARAGRAPH (report any that are genuinely absent, by key):\n" +
    slots.map(s => `- ${s.key} (${s.label})${s.job ? ": " + s.job : ""}`).join("\n");

  const rubricBlock = String(rubric || "").trim()
    ? `RUBRIC OR MARKING GUIDE (target your feedback at this):\n${rubric}`
    : `RUBRIC: (none provided, use general HSC band expectations)`;

  const userMsg = `SUBJECT: ${subject || "(unspecified)"}
ESSAY QUESTION:
${question || "(not given)"}
${topic ? "CHOSEN TOPIC OR OPTION: " + topic + "\n" : ""}PLANNED STRUCTURE: ${structure || "(not given)"}${paragraph_model ? "\nPARAGRAPH STRUCTURE: " + paragraph_model : ""}
THIS PARAGRAPH'S ROLE: ${paragraph_role || "(unspecified)"}
THE STUDENT'S PLANNED POINT FOR THIS PARAGRAPH: ${planned_point || "(none written)"}

${slotBlock}

${rubricBlock}

THE STUDENT'S CURRENT PARAGRAPH:
${paragraph_text}

Coach this paragraph now. Remember: suggest, never substitute. Nudges are questions. Chips are word-level only.`;

  // Wrap the upstream call and parse so a transport or JSON failure still resolves
  // through the shaped 502 (json + cors), not a bare worker exception the browser
  // would see as a generic failure.
  let data;
  try {
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
        tools: [coachTool(slotKeys)],
        tool_choice: { type: "tool", name: "submit_coaching" },
        messages: [{ role: "user", content: userMsg }],
      }),
    });
    if (!res.ok) return json({ error: "upstream " + res.status }, 502, cors);
    data = await res.json();
  } catch (e) {
    return json({ error: "coach upstream failed" }, 502, cors);
  }
  const block = (data.content || []).find(b => b.type === "tool_use");
  if (!block || !block.input) return json({ error: "coach returned nothing", stop_reason: data.stop_reason || null }, 502, cors);
  return json(normalizeCoaching(block.input, slotKeys), 200, cors);
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
    const markSubject = String((body && body.subject) || "").trim().slice(0, 80);
    const criteria = markCriteria(body && body.criteria);
    // The richer marking context. Every field is optional and bounded, so an older
    // client (or a hand-rolled request) still marks, just with less to go on.
    const ctx = markingInput(body);
    // optional shared class code: set secret CLASS_CODE on the worker and only
    // requests carrying it are graded — stops strangers spending your credits.
    if (env.CLASS_CODE && code !== env.CLASS_CODE) return json({ error: "Class code missing or wrong — check Settings in the app." }, 403, cors);
    // Essay-practice coaching is a separate, Haiku-backed path with its own short
    // output. It shares the rate limit and class-code gate above, then returns.
    if (body && body.action === "coach") return await handleCoach(body, env, cors);
    if (!prompt || !answer || !marks) return json({ error: "prompt, marks and answer are required" }, 400, cors);
    // One bad mark value would otherwise turn every number in the review into NaN.
    const markTotal = Math.round(Number(marks));
    if (!Number.isFinite(markTotal) || markTotal < 1 || markTotal > 200) return json({ error: "marks must be a whole number between 1 and 200" }, 400, cors);
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

    // ---- PASS 1: diagnose what is actually on the page (no marks) -----------
    const diagnosis = await diagnose({
      subject: markSubject, prompt, command, marks, topic: ctx.topic, responseType: ctx.responseType,
      requirements: ctx.requirements, validContent: ctx.validContent, plan: ctx.plan,
      response: paras, answer,
    }, env);

    // ---- PASS 2: judge, from the verified diagnosis and the response ---------
    let userMessage;
    try {
      userMessage = pass2Message({
        subject: markSubject, criteria, bands: ctx.bands, bandsSource: ctx.bandsSource,
        command, marks, prompt, topic: ctx.topic, requirements: ctx.requirements,
        responseType: ctx.responseType, stimulus: ctx.stimulus, blocks: ctx.blocks,
        reference: String(model_answer || "").slice(0, 1600), vocab, scaffold: scaffoldText, faults: faultsText, rubric: ctx.rubric,
        diagnosis: diagnosisText(diagnosis),
        offPathway: offPathwayCount(diagnosis, ctx.validContent.pathways.length > 0),
        response: paras,
      });
    } catch (e) {
      return json({ error: String(e.message || e) }, 500, cors);
    }

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
        messages: [{ role: "user", content: userMessage }],
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
    // A review cut off part way through is worse than no review: finalize() sums the
    // paragraph marks, so a response truncated after paragraph four of six would
    // report a total several marks below what was actually awarded, and the student
    // would read it as their grade. Fail loudly instead. The app already falls back
    // to a labelled demo grade on a non-ok response, so nothing silently understates.
    const chunkCount = String(answer).split(/\n\s*\n/).filter(x => x.trim()).length;
    if (data.stop_reason === "max_tokens" && r.paragraphs.length < chunkCount) {
      return json({ error: "grading ran long and was cut off before it finished. Try again.", stop_reason: "max_tokens" }, 502, cors);
    }
    return json(finalize(r, markTotal, String(answer), diagnosis, criteria, ctx.validContent.pathways.length > 0, ctx.responseType, ctx.blocks), 200, cors);
  },
};

const asArray = v => (Array.isArray(v) ? v : []);
const asObject = v => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

// =============================================================================
// MARKING ENFORCEMENT. The house rule is that guarantees live in code, not in the
// prompt: a prompt can be edited or ignored, these cannot.
// =============================================================================

// ---- 1. NO EM-DASHES, enforced ---------------------------------------------
// A student would not write one, so none may reach the page. Punctuation dashes
// become commas; hyphenated words and numeric ranges (1-2, 2019-20) are left alone.
const DASHES = /[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]|--+/;
function deDash(s) {
  if (typeof s !== "string" || !DASHES.test(s)) return s;
  // 1. these are always hyphens or minus signs, never punctuation
  let t = s.replace(/[\u2010\u2011\u2012\u2212]/g, "-");
  // 2. a dash between two digits is a RANGE: 1-2, 3-4, 2019-20, band labels
  t = t.replace(/(\d) ?(?:[\u2013\u2014\u2015]|--+) ?(\d)/g, "$1-$2");
  // 3. a dash sitting tight between two word characters stands in for a hyphen,
  //    so cost-benefit and e-marketing survive intact
  t = t.replace(/(\w)(?:[\u2013\u2014\u2015]|--+)(\w)/g, "$1-$2");
  // 4. everything left is punctuation. Replace it in ONE pass, deciding from what
  //    precedes it, so a doubled comma is never created and never has to be undone.
  t = t.replace(/\s*(?:[\u2013\u2014\u2015]|--+)\s*/g, (m, at, whole) => {
    const before = whole.slice(0, at).replace(/\s+$/, "");
    if (!before) return "";                       // opened with a dash: drop it
    if (/[,;:.!?]$/.test(before)) return " ";     // already punctuated: just a space
    const after = whole.slice(at + m.length);
    if (!after.trim()) return "";                 // ended with a dash: drop it
    return ", ";
  });
  return t.replace(/\s+([,;:.!?])/g, "$1").replace(/\s{2,}/g, " ").trim();
}
// Apply it to every string in a returned object, however deeply nested, so a new
// field can never quietly reintroduce a dash. Quotes are skipped: they are the
// student's own words, given back to them exactly as they wrote them.
const QUOTE_KEYS = new Set(["quote", "claimQuote"]);
function sweepDashes(node) {
  if (typeof node === "string") return deDash(node);
  if (Array.isArray(node)) return node.map(sweepDashes);
  if (node && typeof node === "object") { for (const k in node) node[k] = QUOTE_KEYS.has(k) ? node[k] : sweepDashes(node[k]); return node; }
  return node;
}

// ---- 2. QUOTE VERIFICATION -------------------------------------------------
// Feedback has to be grounded in what the student actually wrote, so anything
// claiming to quote them is checked against their text. Normalises case, curly
// quotes, dashes and whitespace, then accepts either an exact run of words or the
// same words in order inside a bounded span (which tolerates a light elision but
// not an invented sentence). Fewer than three words proves nothing, so it fails.
// Tokenise, keeping each token's position in the ORIGINAL string. Positions are what
// let a verified quote be snapped back to the exact characters the student typed.
const QUOTE_TOKEN = /[a-z0-9]+(?:[.,][0-9]+)*(?:'[a-z]+)*/g;
function quoteTokens(s) {
  const src = String(s == null ? "" : s).replace(/[‘’ʼ]/g, "'").toLowerCase();
  const out = [];
  let m;
  QUOTE_TOKEN.lastIndex = 0;
  // The token keeps its span in the original string, but its comparison key drops
  // apostrophes, so McDonald's and McDonalds are the same word and customers'
  // matches customers. Punctuation never decides whether two quotes match.
  while ((m = QUOTE_TOKEN.exec(src))) {
    const w = m[0].replace(/'/g, "");
    if (w) out.push({ w, at: m.index, to: m.index + m[0].length });
  }
  return out;
}
function quoteWords(s) { return quoteTokens(s).map(t => t.w); }
// Words that prove nothing on their own: a "quote" made only of these is not evidence.
const QUOTE_STOP = new Set("the a an of to and or but in on at for with as by from into onto that this these those it its is are was were be been being has have had do does did will would can could should may might not no so such more most less than then there here they them their he she we you i".split(" "));
// The tokenised answer, built once per request and reused for every quote. Paragraph
// markers ([1], [2]) are stripped: the model is shown them, so a quote copied with
// one must not be rejected for carrying it.
function answerIndex(answer) {
  const raw = String(answer == null ? "" : answer);
  // One index per paragraph as well as one for the whole response, so an observation
  // that names a paragraph can be checked against THAT paragraph. Otherwise a quote
  // lifted from anywhere verifies, and the marker is pointed at the wrong place.
  const paras = [];
  let at = 0;
  raw.split(/\n\s*\n/).forEach(chunk => {
    const start = raw.indexOf(chunk, at);
    if (start < 0 || !chunk.trim()) { at += chunk.length; return; }
    at = start + chunk.length;
    paras.push({ raw: chunk, toks: quoteTokens(chunk) });
  });
  return { raw, toks: quoteTokens(raw), paras };
}
// The index to check an observation against: the paragraph it names when that
// paragraph exists, otherwise the whole response.
function scopeFor(idx, paragraph) {
  const n = Math.round(Number(paragraph));
  const ps = (idx && idx.paras) || [];
  return (n >= 1 && n <= ps.length) ? ps[n - 1] : idx;
}
function stripMarkers(q) { return String(q == null ? "" : q).replace(/\[\s*\d+\s*\]/g, " "); }

// Where a quote sits in the response, as a word range, or null when it is not there.
// TOLERANCE, stated exactly. A quote must be 3 to 60 words and contain at least one
// word that is not a function word. Under six words it must match contiguously. From
// six words up it may skip at most a quarter of its own length, inside a window no
// wider than the quote plus that slack. So a light elision passes and a sentence
// stitched together out of scattered words does not.
function quoteSpan(idx, quote, maxWords) {
  const q = quoteWords(stripMarkers(quote));
  if (q.length < 3 || q.length > (maxWords || 60)) return null;
  if (!q.some(w => !QUOTE_STOP.has(w))) return null;
  const a = idx && idx.toks;
  if (!a || !a.length) return null;
  // contiguous run first
  for (let k = 0; k + q.length <= a.length; k++) {
    let hit = true;
    for (let j = 0; j < q.length; j++) if (a[k + j].w !== q[j]) { hit = false; break; }
    if (hit) return { first: k, last: k + q.length - 1 };
  }
  if (q.length < 6) return null;
  const slack = Math.floor(q.length / 4), width = q.length + slack;
  for (let k = 0; k < a.length; k++) {
    if (a[k].w !== q[0]) continue;
    let qi = 1, last = k;
    for (let j = k + 1; j < a.length && j - k < width && qi < q.length; j++) {
      if (a[j].w === q[qi]) { qi++; last = j; }
    }
    if (qi === q.length) return { first: k, last };
  }
  return null;
}
function verifyQuote(idx, quote) { return !!quoteSpan(idx, quote); }
function spansOverlap(a, b) { return !!a && !!b && a.first <= b.last && b.first <= a.last; }
// The student's OWN characters for a verified span. This is what makes it impossible
// for a paraphrase to be shown back to them as their own line.
function spanText(idx, span) {
  if (!span || !idx || !idx.toks.length) return "";
  const a = idx.toks[span.first], b = idx.toks[span.last];
  return idx.raw.slice(a.at, b.to);
}

// ---- 3. THE DIAGNOSIS, VERIFIED --------------------------------------------
// Drops every observation whose quote the student's response does not support,
// and forces present:false on any planned item claimed as done without a quote
// that verifies. This is what stops the PLAN from standing in for the writing.
// Pass 1 is the only pass that sees the plan, and its own prose travels to pass 2.
// So a phrase the student PLANNED but never wrote could reach the marker through a
// note rather than through a field. Build the plan's distinctive phrases, minus
// anything the student actually wrote, and drop any observation that repeats one.
function planEcho(planText, idx) {
  const plan = quoteWords(planText);
  const grams = new Set();
  for (let n = 4; n <= 6; n++) {
    for (let i = 0; i + n <= plan.length; i++) {
      const g = plan.slice(i, i + n);
      if (!g.some(w => !QUOTE_STOP.has(w))) continue;
      if (verifyQuote(idx, g.join(" "))) continue;   // they wrote it: not an echo
      grams.add(g.join(" "));
    }
  }
  return grams;
}
function echoesPlan(text, grams) {
  if (!grams || !grams.size) return false;
  const w = quoteWords(text);
  for (let n = 4; n <= 6; n++) {
    for (let i = 0; i + n <= w.length; i++) if (grams.has(w.slice(i, i + n).join(" "))) return true;
  }
  return false;
}
function normalizeDiagnosis(raw, answer, planText) {
  const idx = (answer && answer.toks) ? answer : answerIndex(answer);
  const grams = planEcho(planText || "", idx);
  const d = asObject(raw);
  const out = { kept: 0, dropped: 0 };
  const quoted = (key, prose, scoped) => {
    const rows = asArray(d[key]).map(asObject);
    const ok = [];
    rows.forEach(r => {
      const where = scoped ? scopeFor(idx, r.paragraph) : idx;
      const at = quoteSpan(where, r.quote);
      if (!at) return;
      if ((prose || []).some(fl => echoesPlan(r[fl], grams))) return;
      // Snap to the student's literal characters. Everything downstream, the
      // marking prompt and the credited list the student reads, then carries their
      // words exactly, never a near-copy the model tidied on the way through.
      r.quote = spanText(where, at);
      ok.push(r);
    });
    out.kept += ok.length; out.dropped += rows.length - ok.length;
    return ok;
  };
  // INVARIANT: a fact and a claim never live in the same record. Evidence counts as
  // USED only when the response carries the detail in one run of words and what it
  // demonstrates in a DIFFERENT run. Same words, overlapping words, or no claim at
  // all, and it was only mentioned. Checked on word ranges, because in real writing
  // both halves often sit inside one sentence.
  const evidence = quoted("evidence", ["note"], true).map(r => {
    const where = scopeFor(idx, r.paragraph);
    const factAt = quoteSpan(where, r.quote);
    const claimAt = r.claimQuote ? quoteSpan(where, r.claimQuote) : null;
    const distinct = !!claimAt && !spansOverlap(factAt, claimAt);
    return {
      paragraph: r.paragraph, note: r.note, quote: r.quote,
      claimQuote: distinct ? spanText(where, claimAt) : "",
      use: r.use === "misused" ? "misused" : (distinct ? "used" : "mentioned"),
    };
  });
  const clean = {
    coverage: quoted("coverage", ["required"], true),
    arguments: quoted("arguments", ["argument"], true),
    explanation: quoted("explanation", ["note"], true),
    evidence: evidence,
    terminology: quoted("terminology", ["term", "note"]),
    repetition: quoted("repetition", ["note"], true),
    // absent things cannot be quoted, so these pass through as written
    // An absence cannot be quoted, so nothing here has been checked. It is capped
    // and labelled as unchecked where it is handed on, because an unverified claim
    // of absence is the cheapest possible route to an unearned penalty.
    missing: asArray(d.missing).map(asObject).filter(m => m.what && !echoesPlan(m.what + " " + m.where, grams)).slice(0, 6),
    planVsResponse: asArray(d.planVsResponse).map(asObject).map(m => {
      const at = m.present ? quoteSpan(idx, m.quote) : null;
      return { planned: String(m.planned || ""), present: !!at, quote: at ? spanText(idx, at) : "" };
    }).filter(m => m.planned),
    firstToFix: echoesPlan(d.firstToFix, grams) ? "" : String(d.firstToFix || ""),
  };
  clean.verified = out;
  // CIRCUIT BREAKER. A reader who invents two quotes in five is not describing this
  // response, so the diagnosis is discarded whole rather than half trusted, and the
  // marker works from the writing alone. Half-trusted evidence is worse than none.
  const seen = out.kept + out.dropped;
  if (seen >= 6 && out.dropped / seen > 0.4) return { verified: { kept: 0, dropped: out.dropped, discarded: true } };
  return sweepDashes(clean);
}

// Render the verified diagnosis as short labelled lines. Compact on purpose: it
// rides in every pass 2 request and the review output is already near the limit.
// planVsResponse is DELIBERATELY not in this list. Pass 2 never learns what was
// planned, only what is on the page. Adding a key here is the only way to change
// that, and it would be a one-line reviewable diff.
const DIAG_TO_PASS2 = ["coverage", "arguments", "explanation", "evidence", "terminology", "repetition", "missing", "firstToFix"];
function diagnosisText(d) {
  if (!d || !d.coverage) return "(not available for this response, mark from the writing alone)";
  const L = [];
  const push = (head, key, fmt) => {
    if (DIAG_TO_PASS2.indexOf(key) < 0) throw new Error("diagnosis field not cleared for the marking pass: " + key);
    const rows = d[key];
    if (rows && rows.length) L.push(head + "\n" + rows.map(fmt).join("\n"));
  };
  const at = n => (Number(n) > 0 ? "P" + Number(n) : "?");
  push("COVERAGE OF WHAT THE QUESTION ASKS", "coverage", r => `- ${r.required}: ${r.state} (${at(r.paragraph)}) "${r.quote}"`);
  push("THE ARGUMENT ACTUALLY MADE", "arguments", r => `- ${at(r.paragraph)} ${r.argument}${r.valid && !r.onPathway ? " [an argument of the student's own: credit it in full]" : ""} "${r.quote}"`);
  push("EXPLAINING VS DESCRIBING", "explanation", r => `- ${at(r.paragraph)} ${r.mode}: ${r.note} "${r.quote}"`);
  push("EVIDENCE, USED OR ONLY MENTIONED", "evidence", r => `- ${at(r.paragraph)} ${r.use}: ${r.note}\n    the fact: "${r.quote}"\n    what they say it shows: ${r.claimQuote ? '"' + r.claimQuote + '"' : "nothing, the detail is left to speak for itself"}`);
  push("TERMINOLOGY", "terminology", r => `- ${r.term}: ${r.accurate ? "accurate" : "not accurate"}, ${r.note}`);
  push("REPETITION", "repetition", r => `- ${at(r.paragraph)} ${r.note}`);
  push("REPORTED AS NEVER DONE, NOT CHECKED (an absence cannot be quoted, so confirm each of these against the response before you act on it)", "missing", r => `- ${r.what} (belongs ${r.where})`);
  if (d.firstToFix) L.push("WEAKEST PLACE\n- " + d.firstToFix);
  return L.join("\n\n") || "(the diagnosis found nothing to report)";
}

// Pass 1's message. This is the ONLY place the student's plan and our authored
// argument pathways appear. Pass 1 cannot award a mark, so nothing here can.
function diagMessage(f) {
  const req = f.requirements || {};
  const listOr = (a, none) => (Array.isArray(a) && a.length ? a.map((x, i) => `${i + 1}. ${x}`).join("\n") : none);
  const pl = f.plan || {};
  const planRows = (pl.paragraphs || []).map((x, i) =>
    `${i + 1}. ${x.role || "paragraph " + (i + 1)}: ${x.point || "(nothing written down)"}${(x.evidence || []).length ? " | evidence chosen: " + x.evidence.join("; ") : ""}`);
  const planText = (pl.argument || planRows.length)
    ? [pl.argument ? "overall line: " + pl.argument : "", planRows.join("\n")].filter(Boolean).join("\n")
    : "(the student did not record a plan)";
  const vc = f.validContent || {};
  const pathways = (vc.pathways || []).map((x, i) => `${i + 1}. ${x.area ? x.area + ": " : ""}${x.argument}`).join("\n");
  const concepts = (vc.concepts || []).map(x => `- ${x.term}: ${x.explain}`).join("\n");
  const evidence = (vc.evidence || []).map(x => `- ${x.label}: ${x.fact}`).join("\n");
  return [
    `SUBJECT: ${f.subject || "(unspecified)"}`,
    `RESPONSE TYPE: ${f.responseType === "short" ? "short answer" : "extended response"}, worth ${f.marks} marks. Describe it as what it is. A short answer has no introduction or conclusion to be missing.`,
    `QUESTION${f.command ? " (" + f.command + ")" : ""} (${f.marks} marks)${f.topic ? " [" + f.topic + "]" : ""}:\n${f.prompt}`,
    `WHAT THIS QUESTION REQUIRES:\nconcepts: ${listOr(req.concepts, "(not specified)")}\nrelationships to demonstrate: ${listOr(req.relationships, "(not specified)")}\nwhat a strong response accomplishes: ${listOr(req.accomplish, "(not specified)")}${req.syllabus ? "\nsyllabus scope: " + req.syllabus : ""}`,
    `ARGUMENT PATHWAYS WE ANTICIPATED (a menu, NOT the correct answers. A different defensible argument is valid and you must record it as valid):\n${pathways || "(none provided)"}`,
    `CONCEPTS:\n${concepts || "(none provided)"}`,
    `VERIFIED EVIDENCE AVAILABLE TO THE STUDENT:\n${evidence || "(none provided)"}`,
    `THE STUDENT'S PLAN (what they intended. It is NOT proof they wrote it. Only the response can show that):\n${planText}`,
    `STUDENT RESPONSE (numbered paragraphs):\n${f.response}`,
  ].join("\n\n");
}

// Everything the plan says, as one string, so its phrases can be kept out of pass 2.
function planProse(pl) {
  pl = asObject(pl);
  return [pl.argument].concat(asArray(pl.paragraphs).map(x => asObject(x).point || "")).filter(Boolean).join(" ");
}

// A timeout the worker cannot fail to start on. AbortSignal.timeout is present in
// workerd, but this file is pasted into a dashboard by hand, so an older runtime
// must degrade to "no timeout" rather than throw at the call site.
function timeoutSignal(ms) {
  try {
    if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") return AbortSignal.timeout(ms);
    if (typeof AbortController === "function") {
      const c = new AbortController();
      setTimeout(() => c.abort(), ms);
      return c.signal;
    }
  } catch (e) { /* fall through: slow is better than broken */ }
  return undefined;
}

// Pass 1. Never fatal: if the diagnosis fails, times out or returns nothing, the
// worker marks from the writing alone rather than failing the whole request. The
// abort is what makes "times out" true: without it a stalled pass 1 would hold
// pass 2 open behind it and the student would see nothing at all.
async function diagnose(f, env) {
  if (!DIAG_SAFE) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: timeoutSignal(DIAG_TIMEOUT_MS),
      headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: DIAG_MODEL,
        max_tokens: DIAG_MAX_TOKENS,
        system: [{ type: "text", text: DIAG_SYSTEM, cache_control: { type: "ephemeral" } }],
        tools: [DIAG_TOOL],
        tool_choice: { type: "tool", name: "submit_diagnosis" },
        messages: [{ role: "user", content: diagMessage(f) }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const block = (data.content || []).find(b => b.type === "tool_use");
    if (!block || !block.input) return null;
    return normalizeDiagnosis(block.input, answerIndex(f.answer), planProse(f.plan));
  } catch (e) {
    return null;
  }
}

// ---- 4. THE PLAN CAN NEVER REACH THE PASS THAT MARKS -----------------------
// Pass 2 is built from this allowlist and nothing else. The student's plan and our
// authored argument pathways are absent by construction, so no prompt edit can let
// them score. Adding a key here is the only way to change that, and it throws
// loudly rather than leaking quietly.
const PASS2_FIELDS = ["subject", "criteria", "bands", "bandsSource", "rubric", "command", "marks", "prompt", "topic", "requirements", "reference", "vocab", "scaffold", "faults", "diagnosis", "offPathway", "responseType", "stimulus", "blocks", "response"];

// How to mark THIS kind of response. A short answer is not a miniature essay: it
// earns its marks by doing what the directive verb asks at the depth the mark
// value implies, and asking it for a thesis and a conclusion is marking it against
// a genre it was never written in. The instruction rides in the user message so
// the system prompt stays static and keeps prompt-caching.
function responseTypeRule(f) {
  const marks = Math.max(1, Math.round(Number(f.marks) || 1));
  if (f.responseType !== "short") {
    return `RESPONSE TYPE: extended response, worth ${marks} marks. Mark it against the marking criteria and the band expectations above, and return one rubric entry per criterion.`;
  }
  const verb = f.command ? `The directive verb is "${f.command}", so mark whether the response does THAT.` : "Mark whether the response does what the question actually asks.";
  return [
    `RESPONSE TYPE: short answer, worth ${marks} marks.`,
    `Mark it as a short answer, not a miniature essay. ${verb} Do not ask for an introduction, a thesis, a signposted structure or a conclusion unless the directive verb asks for one, and do not penalise their absence.`,
    `At this mark value there are roughly ${marks} distinct creditworthy things to do, so look for about that many and no more. Depth is set by the marks, not by how much could be said.`,
    f.stimulus ? `A stimulus was provided with the question. Judge whether the response actually uses it, rather than answering from general knowledge alongside it.` : "",
    `Return an EMPTY rubric. Keep the whole review short: flag only what actually costs a mark here, at most three issues in total.`,
  ].filter(Boolean).join(" ");
}
// Pass 2's message is CONSTRUCTED from the allowlist, never passed through. A field
// we know must never appear throws loudly, so the mistake is caught in test. Any
// other unrecognised field is simply ignored, because ignoring is already the safe
// direction and no student's marking should die over a stray key.
const PASS2_FORBIDDEN = ["plan", "validContent", "pathways", "concepts", "evidence", "evidenceBank", "planVsResponse"];
function pickPass2(bag) {
  bag = asObject(bag);
  const leaked = Object.keys(bag).filter(k => PASS2_FORBIDDEN.indexOf(k) >= 0);
  if (leaked.length) throw new Error("pass 2 payload leak: " + leaked.join(", "));
  const out = {};
  PASS2_FIELDS.forEach(k => { if (bag[k] !== undefined) out[k] = bag[k]; });
  return out;
}
function pass2Message(bag) {
  const f = pickPass2(bag);
  const req = f.requirements || {};
  const listOr = (a, none) => (Array.isArray(a) && a.length ? a.map((x, i) => `${i + 1}. ${x}`).join("\n") : none);
  return [
    `SUBJECT: ${f.subject || "(unspecified)"}`,
    f.responseType === "short" ? "" :
      `MARKING CRITERIA (return one rubric entry per criterion, in this order, using these exact names):\n${(f.criteria || []).map((c, i) => `${i + 1}. ${c}`).join("\n")}`,
    f.responseType === "short" ? "" :
      `BAND EXPECTATIONS (${f.bandsSource || "general HSC band expectations"}):\n${(f.bands || []).map(b => `${b.range}: ${b.text}`).join("\n") || "(none provided)"}`,
    f.rubric ? `THE MARKING GUIDE THE STUDENT SUPPLIED (aim the judgement at this where it differs from the general expectations):\n${f.rubric}` : "",
    `QUESTION${f.command ? " (" + f.command + ")" : ""} (${f.marks} marks)${f.topic ? " [" + f.topic + "]" : ""}:\n${f.prompt}`,
    `WHAT THIS QUESTION REQUIRES:\nconcepts: ${listOr(req.concepts, "(not specified)")}\nrelationships to demonstrate: ${listOr(req.relationships, "(not specified)")}\nwhat a strong response accomplishes: ${listOr(req.accomplish, "(not specified)")}${req.syllabus ? "\nsyllabus scope: " + req.syllabus : ""}`,
    responseTypeRule(f),
    `REFERENCE, WHAT A TOP ANSWER CAN COVER (a guide, never a checklist, and never the only valid answer):\n${f.reference || "(none provided)"}`,
    `REQUIRED METALANGUAGE: ${(f.vocab || []).join(", ") || "(none provided)"}`,
    `SCAFFOLD THE ANSWER CAN FOLLOW (a shape, not a requirement: credit a different valid structure):\n${f.scaffold || "(none provided)"}`,
    `ANTICIPATED FAULTS (if one appears, flag it at the given severity and base its ladder on the one below, adapted to the student's wording):\n${f.faults || "(none provided)"}`,
    `DIAGNOSIS OF THIS RESPONSE (already checked against the student's own words, carries no marks):\n${f.diagnosis}`,
    `HOW TO READ THE DIAGNOSIS:\nThe reader who wrote it was not told the marks, the criteria or the bands, and awarded nothing. Every quote in it has been checked and does appear in the response. Where it is silent, read the response yourself: silence is not a fault. Nothing in it tells you what the student meant to write, so judge only what they wrote.${f.offPathway ? "\n\nTHIS RESPONSE MAKES " + f.offPathway + " ARGUMENT" + (f.offPathway > 1 ? "S" : "") + " THAT OUR MATERIALS DID NOT ANTICIPATE. Our list is a menu that removes the blank page, not the set of correct answers. Judge those arguments on the reasoning actually written, exactly as you judge the rest. Never take a mark off because an argument was not on our list." : ""}`,
    `STUDENT RESPONSE (numbered paragraphs):\n${f.response}`,
    f.blocks && f.blocks.length
      ? `THE SAME RESPONSE, SENTENCE BY SENTENCE, WITH IDS.\nThis list is NAVIGATION AND CONTEXT ONLY. Award marks solely for the knowledge, reasoning, application and communication in the written response above. A slot name, a chosen argument, a chosen piece of evidence or a concept the student selected while writing is a statement of what they INTENDED, never evidence that they did it. If the sentence does not communicate it, it does not earn it. Use these only to understand what a line was for and to say which line to fix: when an issue belongs to one sentence, put that sentence's id in targetBlockId so the student is taken straight back to it.\n${f.blocks.map(b => `${b.id}${b.slot ? " [" + b.slot + "]" : ""} P${b.paragraph}: ${b.text}`).join("\n")}`
      : "",
  ].filter(Boolean).join("\n\n");
}

// How many arguments the student made that our materials never anticipated. Counted
// in code and injected into pass 2, so the instruction to credit them appears only
// when it applies and cannot be lost in a long prompt.
function offPathwayCount(d, pathwaysSupplied) {
  if (!pathwaysSupplied) return 0;   // with no list to be off, "off the list" says nothing
  return asArray(d && d.arguments).filter(a => a && a.valid && !a.onPathway).length;
}

// The paragraph the student reads back in the review is built by concatenating
// sentences[].text, so whatever the marker returns there IS what they see as their
// own writing. Snap every sentence that verifies back to the exact characters they
// typed, and count the ones that do not. A paraphrase can then never be handed back
// to a student as their own line.
function snapSentences(r, idx) {
  let total = 0, snapped = 0, unplaced = 0;
  (r.paragraphs || []).forEach(p => (p.sentences || []).forEach(sn => {
    if (typeof sn.text !== "string" || !sn.text.trim()) return;   // a missing-sentence slot
    total++;
    // A sentence is not a pointer, it is the student's own line, and a run-on can
    // be long. The 60-word cap that keeps a "quote" useful would drop those, so
    // locating a sentence gets a wider limit.
    const at = quoteSpan(idx, sn.text, 250);
    if (!at) { unplaced++; sn.unplaced = true; return; }
    const exact = spanText(idx, at);
    if (exact && exact !== sn.text) { sn.text = exact; snapped++; } else snapped++;
  }));
  return { total, snapped, unplaced };
}

// ---- 6. MARK ARITHMETIC ----------------------------------------------------
// The mark a student reads has to be the mark the marking supports, on the scale
// the question is actually worth. Never trust the model to add up, and never let a
// mis-split denominator turn an imperfect response into full marks.

// Share `total` across `n` slots using each slot's weight, so the parts sum to the
// whole exactly. Largest remainder, which is deterministic and loses nothing.
function shareOut(weights, total) {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!sum) { // no usable weights: an even split, remainder to the earliest slots
    const base = Math.floor(total / (weights.length || 1));
    const out = weights.map(() => base);
    let left = total - base * weights.length;
    for (let i = 0; i < out.length && left > 0; i++, left--) out[i]++;
    return out;
  }
  const exact = weights.map(w => (w * total) / sum);
  const out = exact.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = exact.map((v, i) => ({ i, frac: v - Math.floor(v) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; k < order.length && left > 0; k++, left--) out[order[k].i]++;
  return out;
}
// Move a set of scores onto an exact target without breaking any ceiling.
function fitScores(scores, caps, target) {
  const out = scores.map((v, i) => clamp(Math.round(v), 0, caps[i]));
  let sum = out.reduce((a, b) => a + b, 0);
  const capTotal = caps.reduce((a, b) => a + b, 0);
  target = clamp(Math.round(target), 0, capTotal);
  // take from the largest first, give to the one with the most headroom first
  while (sum > target) {
    let pick = -1;
    out.forEach((v, i) => { if (v > 0 && (pick < 0 || v > out[pick])) pick = i; });
    if (pick < 0) break;
    out[pick]--; sum--;
  }
  while (sum < target) {
    let pick = -1;
    out.forEach((v, i) => { if (v < caps[i] && (pick < 0 || caps[i] - v > caps[pick] - out[pick])) pick = i; });
    if (pick < 0) break;
    out[pick]++; sum++;
  }
  return out;
}
// Paragraph marks: whole numbers, no paragraph worth zero taking the whole question,
// and the maxima reconciled to what the question is actually worth. The marker's
// PROPORTION is the judgement, so it is preserved and only the scale is corrected.
function reconcileParagraphs(r, marks) {
  const ps = asArray(r.paragraphs);
  if (!ps.length) { r.total = 0; r.max = marks; return; }
  ps.forEach(p => {
    p.max = Math.max(0, Math.round(Number(p.max) || 0));
    p.score = clamp(Math.round(Number(p.score) || 0), 0, p.max);
  });
  const sumMax = ps.reduce((a, p) => a + p.max, 0);
  if (sumMax !== marks) {
    const ratios = ps.map(p => (p.max ? p.score / p.max : 0));
    const fresh = shareOut(ps.map(p => p.max), marks);
    ps.forEach((p, i) => { p.max = fresh[i]; p.score = clamp(Math.round(ratios[i] * p.max), 0, p.max); });
  }
  r.total = clamp(ps.reduce((a, p) => a + p.score, 0), 0, marks);
  r.max = marks;
}
// The rubric is the SAME response seen a second way, so it must land on the same
// mark and use this subject's criterion names. A renamed, short or long rubric is
// rebuilt against the names that were asked for, rather than shown as if the
// response had been marked against something else.
function reconcileRubric(r, marks, criteria) {
  const given = asArray(r.rubric).map(asObject);
  const names = (Array.isArray(criteria) && criteria.length) ? criteria : given.map(c => String(c.name || ""));
  const rows = names.map((name, i) => {
    const hit = given.find(c => String(c.name || "").toLowerCase().trim() === String(name).toLowerCase().trim()) || given[i] || {};
    let seenHere = false;
    const bands = asArray(hit.bands).map(asObject).slice(0, 3).map(b => {
      const here = !!b.here && !seenHere;      // exactly one "you are here", never three
      if (here) seenHere = true;
      return { range: String(b.range || ""), text: String(b.text || ""), here };
    });
    return { name: String(name), score: Math.max(0, Math.round(Number(hit.score) || 0)),
             max: Math.max(0, Math.round(Number(hit.max) || 0)), descriptor: String(hit.descriptor || ""), bands };
  });
  const caps = shareOut(rows.map(c => c.max), marks);
  const fitted = fitScores(rows.map(c => c.score), caps, r.total);
  rows.forEach((c, i) => { c.max = caps[i]; c.score = fitted[i]; });
  r.rubric = rows;
}

// The feedback the student reads is prose, and prose quotes them: "you say mobile
// ordering but never say why". A quotation mark is a claim that these are their
// words. Check every quoted run, and where it is not in their response, take the
// quotation marks off. The point stands, it just stops claiming to be a quotation.
function groundProse(r, idx) {
  let quoted = 0, unquoted = 0;
  const fix = t => {
    if (typeof t !== "string" || t.indexOf('"') < 0 && t.indexOf("“") < 0) return t;
    return t.replace(/["“]([^"“”]{3,240})["”]/g, (m, inner) => {
      if (verifyQuote(idx, inner)) { quoted++; return '"' + inner + '"'; }
      unquoted++; return inner;
    });
  };
  r.summary = fix(r.summary);
  if (r.focus) r.focus.why = fix(r.focus.why);
  (r.paragraphs || []).forEach(p => {
    (p.reasons || []).forEach(rs => { rs.text = fix(rs.text); });
    (p.sentences || []).forEach(sn => (sn.issues || []).forEach(iss => { iss.why = fix(iss.why); iss.head = fix(iss.head); }));
  });
  return { quoted, unquoted };
}

// ---- 5. THE REVIEW, GROUNDED ----------------------------------------------
// focus is where the student goes back to WRITE, so it has to land somewhere real.
// Clamp it to a paragraph that exists, verify its quote, and locate the sentence it
// points at so the app can open that exact line. Fall back to the worst open issue
// rather than dropping the student back on a summary with nowhere to go.
function groundFocus(r, answer, blocks) {
  const words = (answer && answer.toks) ? answer : answerIndex(answer);
  const ids = new Set(asArray(blocks).map(b => asObject(b).id).filter(Boolean));
  const paras = r.paragraphs || [];
  const f = asObject(r.focus);
  let idx = Math.round(Number(f.paragraph)) - 1;
  if (!(idx >= 0 && idx < paras.length)) idx = -1;
  let area = String(f.area || "").trim();
  let why = String(f.why || "").trim();
  // The quote is snapped back to the student's own characters, or blanked.
  const qAt = quoteSpan(words, f.quote);
  let quote = qAt ? spanText(words, qAt) : "";
  if (idx < 0 || !area || !why) {
    // derive from the most severe open issue, so there is always somewhere to go
    let best = null;
    paras.forEach((p, pi) => (p.sentences || []).forEach((sn, si) => (sn.issues || []).forEach(iss => {
      const rank = SEVRANK[iss.severity] != null ? SEVRANK[iss.severity] : 1;
      if (!best || rank < best.rank) best = { rank, pi, si, iss, text: sn.text };
    })));
    if (best) {
      if (idx < 0) idx = best.pi;
      if (!area) area = best.iss.head || "Where to start";
      if (!why) why = best.iss.why || "";
      if (!quote && typeof best.text === "string") quote = best.text;
    }
  }
  if (idx < 0) idx = 0;
  // which sentence in that paragraph the quote sits in, so the app can open the line
  // A quotation names a sentence only when it names EXACTLY one. Two sentences that
  // both match means we do not know which, so the student is returned to the
  // paragraph rather than sent to a guess. The block id is the reliable route; this
  // is only the fallback for a client that sent no blocks.
  let sentence = null;
  const sents = (paras[idx] && paras[idx].sentences) || [];
  if (quote) {
    const qw = quoteWords(quote).join(" ");
    const hits = [];
    for (let i = 0; i < sents.length; i++) {
      const t = sents[i] && sents[i].text;
      if (typeof t !== "string") continue;
      const tw = quoteWords(t).join(" ");
      if (tw && (tw.indexOf(qw) >= 0 || qw.indexOf(tw) >= 0)) hits.push(i);
    }
    if (hits.length === 1) sentence = hits[0];
  }
  // A block id is only useful if it exists. A made-up one would send the student
  // nowhere, so it is checked against the list we sent and dropped otherwise; the
  // quote fallback already covers that case.
  let targetBlockId = String(f.targetBlockId || "");
  if (!ids.has(targetBlockId)) targetBlockId = "";
  return { area: area || "Where to start", paragraph: idx + 1, index: idx, sentence, why, quote, targetBlockId };
}

// Read the optional marking context off the request, bounded so a large or hostile
// payload cannot blow the prompt out. Shapes are documented in review-model.md.
function markingInput(body) {
  const b = asObject(body);
  const str = (v, n) => String(v == null ? "" : v).trim().slice(0, n);
  const strs = (v, n, max) => asArray(v).slice(0, max).map(x => str(x, n)).filter(Boolean);
  const rq = asObject(b.requirements);
  const vc = asObject(b.validContent);
  const pl = asObject(b.plan);
  return {
    // The student's own sentences, each with a stable id. Marking targets an id
    // rather than hunting for a quotation, which stops mattering the moment two
    // sentences look alike or a comma moves.
    blocks: asArray(b.blocks).slice(0, 200).map(asObject).map(x => ({
      id: str(x.id, 24), slot: str(x.slot, 24), paragraph: Math.max(0, Math.round(Number(x.paragraph) || 0)), text: str(x.text, 600),
    })).filter(x => x.id && x.text),
    // A short answer is marked as a short answer. Anything else is an extended
    // response, which keeps every older client on exactly its current behaviour.
    responseType: b.responseType === "short" ? "short" : "extended",
    stimulus: !!b.stimulus,
    topic: str(b.topic, 120),
    rubric: str(b.rubric, 3000),
    bandsSource: str(b.bandsSource, 80),
    bands: asArray(b.bands).slice(0, 8).map(asObject)
      .map(x => ({ range: str(x.range, 40), text: str(x.text, 400) }))
      .filter(x => x.range && x.text),
    requirements: {
      concepts: strs(rq.concepts, 160, 12),
      relationships: strs(rq.relationships, 200, 12),
      accomplish: strs(rq.accomplish, 300, 10),
      syllabus: str(rq.syllabus, 600),
    },
    validContent: {
      pathways: asArray(vc.pathways).slice(0, 20).map(asObject)
        .map(x => ({ area: str(x.area, 60), argument: str(x.argument, 300) })).filter(x => x.argument),
      concepts: asArray(vc.concepts).slice(0, 12).map(asObject)
        .map(x => ({ term: str(x.term, 60), explain: str(x.explain, 400) })).filter(x => x.term && x.explain),
      evidence: asArray(vc.evidence).slice(0, 20).map(asObject)
        .map(x => ({ label: str(x.label, 80), fact: str(x.fact, 300) })).filter(x => x.label && x.fact),
    },
    plan: {
      argument: str(pl.argument, 400),
      paragraphs: asArray(pl.paragraphs).slice(0, 12).map(asObject).map(x => ({
        role: str(x.role, 40), point: str(x.point, 300), evidence: strs(x.evidence, 120, 6),
      })),
    },
  };
}

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
// three-rung ladder (Clear/Better/Band 6, levels fixed by position). The app
// derives the practice starters from each rung's text, so they are not part of
// this payload. Every nested node is rebuilt through asArray/asObject, so a
// malformed payload (e.g. sentences:[null] or issues:["bad"]) is normalized
// rather than throwing.
function normalizeReview(r) {
  r.paragraphs = asArray(r.paragraphs).map(rawP => {
    const p = asObject(rawP);
    // Schema maxItems is guidance to the model, not a rule the API enforces, so the
    // caps are applied here as well. Sentences are NEVER capped: the review rebuilds
    // the student's paragraph out of them, and dropping one would delete their writing.
    p.reasons = asArray(p.reasons).slice(0, 3).map(rawR => {
      const rs = asObject(rawR);
      return { kind: rs.kind === "good" ? "good" : "weak", text: String(rs.text || "") };
    });
    p.sentences = asArray(p.sentences).map(rawS => {
      const s = asObject(rawS);
      s.issues = asArray(s.issues).slice(0, 3).map(rawIss => {
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
function finalize(r, marks, answer, diagnosis, criteria, creditable, responseType, blocks) {
  answer = String(answer == null ? "" : answer);
  marks = Math.round(Number(marks));
  if (!Number.isFinite(marks) || marks < 1) marks = 1;   // never render NaN as a mark
  normalizeReview(r);
  reconcileParagraphs(r, marks);
  // Band criteria describe an extended response. On a three-mark short answer they
  // are noise at best and a misleading second mark at worst, so there is no rubric
  // and the review's rubric tab does not appear.
  if (responseType === "short") r.rubric = [];
  else reconcileRubric(r, marks, criteria);

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

  // ---- grounding: where the student goes back to write, and how we know ----
  const idx = answerIndex(answer);
  const snap = snapSentences(r, idx);
  r.focus = groundFocus(r, idx, blocks);
  const prose = groundProse(r, idx);
  if (diagnosis) {
    r.diagnosis = diagnosis;
    // A valid argument that was not one of our pathways is CREDITED, not penalised,
    // and saying so out loud is how the student sees that thinking for themselves paid.
    r.credited = (creditable ? asArray(diagnosis.arguments) : [])
      .filter(a => a && a.valid && !a.onPathway)
      .map(a => ({ paragraph: Math.max(0, Math.round(Number(a.paragraph) || 0)), argument: String(a.argument || ""), quote: String(a.quote || "") }));
  } else {
    r.credited = [];
  }
  // How much of the review is verifiably drawn from this student's page. Reported,
  // never silently swallowed: a low figure means the marking drifted generic.
  r.checks = {
    passes: diagnosis ? 2 : 1,
    sentences: snap.total,
    sentencesVerified: snap.snapped,
    sentencesUnplaced: snap.unplaced,
    grounded: snap.total ? Math.round(100 * snap.snapped / snap.total) / 100 : 1,
    focusQuoted: !!(r.focus && r.focus.quote),
    focusBlock: !!(r.focus && r.focus.targetBlockId),
    prose: prose,
    diagnosis: diagnosis ? diagnosis.verified : null,
  };

  // Our writing loses its dashes; the student's sentences are handed back exactly
  // as they wrote them, so their own words are never quietly edited.
  const mine = (r.paragraphs || []).map(p => (p.sentences || []).map(sn => sn.text));
  sweepDashes(r);
  (r.paragraphs || []).forEach((p, pi) => (p.sentences || []).forEach((sn, si) => { sn.text = mine[pi][si]; }));
  return r;
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, "content-type": "application/json" } });
}
