# Supabase setup — student logins + durable custom sets

This is **optional** and **off by default**. With `supabaseUrl`/`supabaseAnonKey`
left blank in `index.html`, the app behaves exactly as before — built-in modules,
grading, progress, SRS, and localStorage custom sets all work untouched. Turn this
on only after the Phase-2 security tests below pass.

**Security model in one line:** the browser only ever holds the *public anon key*,
protected by Row Level Security; the `service_role` key and your `TEACHER_SECRET`
live only in Edge-Function secrets — never in the repo, never in the browser.

---

## 1. Create the project
1. Go to https://supabase.com → New project. Pick a name + a strong DB password (you won't need the DB password again for this).
2. Project Settings → **API**. Copy:
   - **Project URL** (e.g. `https://abcd1234.supabase.co`)
   - **anon public** key (a long `eyJ…` token) — this one is safe to commit/serve.
   - Do **NOT** copy or use the `service_role` key anywhere in the app or repo.

## 2. Create the tables + Row Level Security
SQL editor → New query → paste **all** of this → Run:

```sql
-- profiles: maps a Supabase user to (class, number) + a password_set flag
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  class_code text not null,
  student_number text not null,
  password_set boolean not null default true,
  created_at timestamptz not null default now(),
  unique (class_code, student_number)
);
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select using (user_id = auth.uid());
-- (inserts/updates to profiles happen only via the Edge Function, which uses
--  the service_role key and bypasses RLS — so no other policies are needed.)

-- sets: the durable custom flashcard sets
create table public.sets (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  cards jsonb not null default '[]',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_studied_at timestamptz
);
alter table public.sets enable row level security;
create policy "own sets select" on public.sets for select using (owner = auth.uid());
create policy "own sets insert" on public.sets for insert with check (owner = auth.uid());
create policy "own sets update" on public.sets for update using (owner = auth.uid()) with check (owner = auth.uid());
create policy "own sets delete" on public.sets for delete using (owner = auth.uid());

-- pending_resets: forgot-password requests (created by anyone, read only via service_role)
create table public.pending_resets (
  id uuid primary key default gen_random_uuid(),
  class_code text not null,
  student_number text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
-- one pending request per student (re-requests are harmless no-ops -> rate limit)
create unique index pending_one_per_student on public.pending_resets (class_code, student_number) where status = 'pending';
alter table public.pending_resets enable row level security;
create policy "anyone may request a reset" on public.pending_resets
  for insert to anon, authenticated with check (status = 'pending');
-- NO select/update/delete policies: only the Edge Function (service_role) can read/clear them.
```

## 3. Auth settings
Authentication → **Providers / Sign In** (or "Auth settings"):
- **Turn OFF "Allow new users to sign up."** Accounts are created only by the Edge
  Function (which uses the admin API). This stops anyone self-registering.
- Email confirmation: not required — the function creates users with
  `email_confirm: true`, so admin-created accounts are usable immediately.
- (No email provider/SMTP is needed; the synthetic `…@….marginal.local` addresses
  are internal handles and never receive mail.)

## 4. Deploy the Edge Function
The function code is in this repo at `supabase/functions/marginal-admin/index.ts`.

Install the CLI once: https://supabase.com/docs/guides/cli  (`npm i -g supabase` or brew).

```bash
supabase login
supabase link --project-ref <your-project-ref>      # the abcd1234 part of the URL
supabase functions deploy marginal-admin
# Set YOUR teacher secret (separate from the class code; pick something long):
supabase secrets set TEACHER_SECRET="choose-a-long-random-teacher-secret"
```
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected into functions
automatically — you do **not** set those yourself, and they never leave Supabase.

## 5. Point the app at the project
In `index.html`, fill the two fields in `MARGINAL_CONFIG`:
```js
supabaseUrl: "https://abcd1234.supabase.co",
supabaseAnonKey: "eyJhbGciOi…your anon public key…"
```
Then rebuild and (when ready) deploy:
```bash
node build.js
```
Also set the **same two values** at the top of `teacher.html` (the `SUPABASE_URL`
and `SUPABASE_ANON_KEY` variables) so the reset queue can reach the function.

## 6. Hand me the keys for Phase-2 verification
Send me the **Project URL** + **anon public key** (both public-safe). I'll run the
live verification through the preview browser and report the results — including the
two gating security tests — before any student uses this:

- **Cross-student RLS:** sign in as student 7, attempt to read AND update student 8's
  set by id → must be blocked. I'll show the actual output.
- **Reset-changes-nothing:** a pending request alone grants no access and changes no
  password until you approve it in `teacher.html`. I'll show the before/after.
- Plus: create account → create/import a set with tags → log out/in → set persists;
  fresh session loads the same sets; full reset round-trip.

---

## How it works (reference)
- **Login** = class code + student number + password. The app maps each
  (class, number) to a synthetic identity `s<number>@<class>.marginal.local`.
  First login (or first login after a reset) sets the password via the Edge
  Function; later logins are a normal Supabase password sign-in. Passwords are
  only ever stored **hashed** by Supabase Auth — there's no way to read them back.
- **Forgot password** → the student creates a *pending* request (no access, no
  change). You open `teacher.html`, enter your teacher secret, and **Approve** →
  the student's password is cleared (their sets are kept) → they set a new one on
  next login. **Dismiss** drops the request, changing nothing.
- **Sets** live in the `sets` table, one row per set, owned by `auth.uid()`. RLS
  guarantees a student can only see/modify their own rows. Built-in modules,
  grades, and SRS never touch Supabase — they stay in the browser.
