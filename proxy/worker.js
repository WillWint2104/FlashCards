// =============================================================================
// Marginal trial — essay grading proxy (Cloudflare Worker)
// Deploy free at workers.cloudflare.com:
//   1. Create a Worker, paste this file.
//   2. Settings → Variables → add secret ANTHROPIC_API_KEY.
//   3. Copy the worker URL into the app's Settings panel.
// The key never leaves the worker. Rate-limited to 20 grades / 10 min per IP.
// =============================================================================
const MODEL = "claude-sonnet-4-6"; // sharper essay feedback; swap to "claude-haiku-4-5-20251001" for cheaper (~1c) grading
const WINDOW_MS = 10 * 60 * 1000, MAX_PER_WINDOW = 20;
const hits = new Map(); // in-memory per-isolate limiter (fine for a 12-student trial)

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
        max_tokens: 1024,
        system: [{
          type: "text",
          text: "You are an experienced HSC Economics marker. Grade the student's answer out of the marks available, against the reference answer and required metalanguage. Reward correct reasoning in the student's own words; never require exact wording. Be specific and encouraging — feedback should name the single highest-impact improvement first. Return the grade ONLY via the tool.",
          cache_control: { type: "ephemeral" },
        }],
        tools: [{
          name: "submit_grade",
          description: "Return the structured grade.",
          input_schema: {
            type: "object",
            properties: {
              score: { type: "number", description: "0 to max marks" },
              overall: { type: "object", properties: { summary: { type: "string" } }, required: ["summary"] },
              criteria: { type: "array", items: { type: "object", properties: {
                name: { type: "string" },
                status: { type: "string", enum: ["met", "partial", "missing"] },
                comment: { type: "string" } }, required: ["name", "status"] } },
              missing_vocabulary: { type: "array", items: { type: "string" } },
              next_steps: { type: "array", items: { type: "string" } },
            },
            required: ["score", "overall", "criteria"],
          },
        }],
        tool_choice: { type: "tool", name: "submit_grade" },
        messages: [{
          role: "user",
          content: `QUESTION (${marks} marks):\n${prompt}\n\nREFERENCE — WHAT A TOP ANSWER COVERS:\n${model_answer || "—"}\n\nREQUIRED METALANGUAGE: ${vocab.join(", ") || "—"}\n\nSTUDENT ANSWER (numbered paragraphs):\n${paras}`,
        }],
      }),
    });

    if (!res.ok) return json({ error: "upstream " + res.status }, 502, cors);
    const data = await res.json();
    const block = (data.content || []).find(b => b.type === "tool_use");
    const g = block?.input || { score: 0, overall: { summary: "Could not grade." }, criteria: [] };
    g.score = Math.max(0, Math.min(Number(g.score) || 0, marks));
    return json(g, 200, cors);
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, "content-type": "application/json" } });
}
