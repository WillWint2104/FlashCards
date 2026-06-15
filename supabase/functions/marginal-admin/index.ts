// =============================================================================
// marginal-admin — the ONLY privileged surface for Marginal's auth + resets.
//
// Holds the service_role key (auto-injected as SUPABASE_SERVICE_ROLE_KEY) and a
// TEACHER_SECRET, both from Edge-Function secrets — NEVER in client code/repo.
//
// Actions (POST JSON { action, ... }):
//   set-password   (public)        create-or-set a password, only when the
//                                   profile is unset/reset. Never reveals or
//                                   returns a password; Supabase Auth hashes it.
//   reset-list     (teacher-gated) list pending password-reset requests
//   reset-approve  (teacher-gated) clear a student's password (back to "unset")
//   reset-dismiss  (teacher-gated) drop a request, changing nothing else
//
// Deploy:  supabase functions deploy marginal-admin
// Secret:  supabase secrets set TEACHER_SECRET=<your-teacher-secret>
// =============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });
}

// MUST match the client's emailFor() exactly so sign-in finds the same identity.
function sanitize(s: unknown): string {
  return String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
function emailFor(classCode: unknown, num: unknown): string | null {
  const cls = sanitize(classCode), n = sanitize(num);
  if (!cls || !n) return null;
  return `s${n}@${cls}.marginal.local`;
}

// Length-aware constant-time compare for the teacher secret.
function safeEqual(a: unknown, b: unknown): boolean {
  const x = String(a ?? ""), y = String(b ?? "");
  if (x.length !== y.length) return false;
  let r = 0;
  for (let i = 0; i < x.length; i++) r |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return r === 0;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TEACHER_SECRET = Deno.env.get("TEACHER_SECRET") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const action = String(body.action ?? "");

  try {
    // ---- public: set-or-create a password (first login or after a teacher reset) ----
    if (action === "set-password") {
      const email = emailFor(body.class_code, body.student_number);
      const password = String(body.password ?? "");
      if (!email) return json({ error: "Missing class code or student number." }, 400);
      if (password.length < 6) return json({ error: "Password must be at least 6 characters." }, 400);

      const { data: prof, error: selErr } = await admin
        .from("profiles").select("user_id, password_set")
        .eq("class_code", String(body.class_code)).eq("student_number", String(body.student_number))
        .maybeSingle();
      if (selErr) return json({ error: selErr.message }, 400);

      if (!prof) {
        const { data: created, error: cErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
        if (cErr || !created?.user) return json({ error: cErr?.message ?? "Could not create account." }, 400);
        const { error: pErr } = await admin.from("profiles").insert({
          user_id: created.user.id, class_code: String(body.class_code), student_number: String(body.student_number), password_set: true,
        });
        if (pErr) return json({ error: pErr.message }, 400);
        return json({ status: "created" });
      }
      if (prof.password_set === false) {
        const { error: uErr } = await admin.auth.admin.updateUserById(prof.user_id as string, { password });
        if (uErr) return json({ error: uErr.message }, 400);
        await admin.from("profiles").update({ password_set: true }).eq("user_id", prof.user_id);
        return json({ status: "set" });
      }
      // Password already set — sign-in failed for another reason (wrong password).
      return json({ status: "already_set" });
    }

    // ---- teacher-gated: password-reset queue ----
    if (action === "reset-list" || action === "reset-approve" || action === "reset-dismiss") {
      if (!TEACHER_SECRET || !safeEqual(body.teacher_secret, TEACHER_SECRET)) return json({ error: "unauthorized" }, 401);

      if (action === "reset-list") {
        const { data, error } = await admin
          .from("pending_resets").select("id, class_code, student_number, created_at")
          .eq("status", "pending").order("created_at", { ascending: true });
        if (error) return json({ error: error.message }, 400);
        return json({ requests: data ?? [] });
      }

      if (action === "reset-approve") {
        const id = String(body.id ?? "");
        const { data: pr, error: prErr } = await admin
          .from("pending_resets").select("class_code, student_number").eq("id", id).maybeSingle();
        if (prErr || !pr) return json({ error: "Request not found." }, 404);
        const { data: prof } = await admin
          .from("profiles").select("user_id")
          .eq("class_code", pr.class_code).eq("student_number", pr.student_number).maybeSingle();
        if (prof) {
          // Invalidate the current password and mark it unset so the student
          // chooses a new one on next login. The user row (and their sets) stay.
          const rnd = crypto.randomUUID() + crypto.randomUUID();
          await admin.auth.admin.updateUserById(prof.user_id as string, { password: rnd });
          await admin.from("profiles").update({ password_set: false }).eq("user_id", prof.user_id);
        }
        await admin.from("pending_resets").update({ status: "done" }).eq("id", id);
        return json({ status: "approved", existed: !!prof });
      }

      if (action === "reset-dismiss") {
        const id = String(body.id ?? "");
        const { error } = await admin.from("pending_resets").update({ status: "dismissed" }).eq("id", id);
        if (error) return json({ error: error.message }, 400);
        return json({ status: "dismissed" });
      }
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
