# Sign-in diagnosis kit, 8 October 2026

Production sign-in shows "Couldn't reach the server. Try again." for class code
`12Ec126`, student `11`. This kit finds out why without changing anything, and
records the fix proposed for the class-code casing bug. It is meant to be run by
someone who can reach the Supabase project (this cloud environment cannot).

Nothing here deletes, recreates or resets an account, and nothing here asks for
a password to be written down.

## What the app does when a student signs in

`Cloud.signIn` in `app.js`:

1. **Normal sign-in.** `auth.signInWithPassword` for the identity
   `s<number>@<class>.marginal.local`, where the class code and the number are
   lowercased and stripped to letters and digits. `12Ec126` and `12ec126` are the
   same identity: `s11@12ec126.marginal.local`.
2. **If that fails, set the password.** The `marginal-admin` Edge Function,
   action `set-password`, with the class code and number **exactly as typed**.
3. **Inside that function, the profile lookup.** `profiles` is searched for
   `class_code = '<as typed>'` and `student_number = '<as typed>'`:
   - no profile: it creates the auth user, then the profile (`created`);
   - a profile with `password_set = false`: it sets the password (`set`);
   - a profile with `password_set = true`: `already_set`, and the student sees
     "Wrong password".

The casing bug is in step 3. The identity is case-blind and the profile lookup is
case-sensitive. A student whose profile was stored as `12ec126`, who types
`12Ec126`, gets no profile back, so the function tries to create an auth user
that already exists, fails with a 400, and the app shows that 400 as "Couldn't
reach the server" (every non-2xx reply from the function is shown that way).

## Step 1: what exists (read-only SQL)

Supabase dashboard, SQL editor. These only read.

```sql
-- 1. The identity the app signs student 11 in as.
select id, email, created_at, last_sign_in_at, email_confirmed_at, banned_until
from auth.users
where email = 's11@12ec126.marginal.local';

-- 2. Every profile for student 11 in that class, however it was cased or punctuated.
select user_id, class_code, student_number, password_set, created_at
from public.profiles
where lower(regexp_replace(class_code, '[^a-zA-Z0-9]', '', 'g')) = '12ec126'
  and lower(regexp_replace(student_number, '[^a-zA-Z0-9]', '', 'g')) = '11';

-- 3. Does the profile point at that identity?
select u.id as auth_user, p.user_id as profile_user, p.class_code, p.password_set
from auth.users u
full join public.profiles p on p.user_id = u.id
where u.email = 's11@12ec126.marginal.local'
   or (lower(regexp_replace(p.class_code, '[^a-zA-Z0-9]', '', 'g')) = '12ec126'
       and lower(regexp_replace(p.student_number, '[^a-zA-Z0-9]', '', 'g')) = '11');

-- 4. Across the whole table: students whose profiles differ only in case or
--    punctuation, which share one sign-in identity.
select lower(regexp_replace(class_code, '[^a-zA-Z0-9]', '', 'g')) as class_key,
       lower(regexp_replace(student_number, '[^a-zA-Z0-9]', '', 'g')) as student_key,
       count(*), array_agg(class_code), array_agg(password_set)
from public.profiles group by 1, 2 having count(*) > 1;

-- 5. Which spellings of class codes are in use.
select class_code, count(*) from public.profiles group by class_code order by 1;

-- 6. Any reset request for student 11.
select id, class_code, student_number, status, created_at
from public.pending_resets
where lower(regexp_replace(class_code, '[^a-zA-Z0-9]', '', 'g')) = '12ec126'
  and lower(regexp_replace(student_number, '[^a-zA-Z0-9]', '', 'g')) = '11';
```

## Step 2: what the sign-in request gets back (browser)

On the live site, open DevTools, Network tab, then sign in as `12Ec126` / `11`
once, as normal. Copy only the **Status** and the **Response** of:

- the request to `.../auth/v1/token?grant_type=password`;
- the request to `.../functions/v1/marginal-admin` (if there is one).

Do not copy the request **Payload**: it contains the password. The responses do
not.

## Reading the results

| Step 1 shows | Step 2 shows | Cause |
|---|---|---|
| identity, and a profile with class code exactly `12Ec126`, `password_set` true | token 400, function 200 `already_set` | Wrong password. The app would say so. |
| identity, and a profile cased differently (e.g. `12ec126`) | token 400, function 400 "already registered" | **The casing bug.** |
| identity, and no profile at all | token 400, function 400 "already registered" | A half-created account: the user was created, the profile insert failed. Same 400, same message. |
| no identity, no profile | token 400, function 200 `created` and sign-in works | A first sign-in that works. |
| a profile with `password_set` false | function 200 `set` | A reset that completes on sign-in. |
| anything | token and function both fail to connect, or 5xx | The project is unreachable, paused or unhealthy. |
| anything | function 404, or 401 | The function is not deployed, or rejects the key. |

## The fix proposed (not applied)

Canonical identity everywhere: a class code and a student number are compared
lowercased, stripped to letters and digits, exactly as `emailFor` already does on
both sides. Backward-compatible, with no rewrite of stored data:

1. **Database, additive.** Generated columns on `profiles` and `pending_resets`:

   ```sql
   alter table public.profiles
     add column class_key text generated always as (lower(regexp_replace(class_code, '[^a-zA-Z0-9]', '', 'g'))) stored,
     add column student_key text generated always as (lower(regexp_replace(student_number, '[^a-zA-Z0-9]', '', 'g'))) stored;
   -- Only once query 4 above returns no rows: two profiles that differ only in
   -- case are one identity and have to be resolved by hand first, never merged
   -- automatically.
   create unique index profiles_canonical on public.profiles (class_key, student_key);
   ```

   The same two columns on `pending_resets`, with the one-pending-request index
   moved onto them.

2. **Edge Function.** `set-password` and `reset-approve` look a profile up by
   `class_key` and `student_key` (the function's own `sanitize`), not by the
   class code as typed. The class code is still stored as the student typed it,
   for display.

3. **A half-created account says so.** When `createUser` fails because the
   identity already exists and there is no profile, the function returns a
   distinct error (`identity_without_profile`), not a bare 400, so it can be told
   apart from an outage and repaired by a teacher.

4. **The app tells failures apart.** `functions.invoke` never throws; a non-2xx
   reply comes back as `{ data: null, error }`. The app should read `error` and,
   in development and test builds, log which of these it was: sign-in rejected,
   function unreachable, function HTTP error (with its status and error text), or
   an invalid reply. Students keep the one simple message.

Students never have to remember the exact casing: any casing reaches the same
identity and the same profile.
