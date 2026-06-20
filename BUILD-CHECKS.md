# BUILD-CHECKS — run before EVERY pull request

These are bugs that have already happened more than once in this build. The
process rule: when you fix a bug, ask "is this an instance of a class?" If yes,
fix every instance now AND add a check here so it never gets fixed twice.

CodeRabbit is a SECONDARY check. This list plus your own render-and-inspect is
the PRIMARY gate. Never block forward progress on CodeRabbit; never treat its
silence as approval.

## Standing checklist (tick every item, every PR)

1. **CONTRAST (recurred ~5x).** Audit the WHOLE stylesheet for muted text
   (`--ink-2` / `--ink-3`) on a tinted or grey background (`--bg`, `*-soft`) on
   any body-text element. Body text a student reads must be strong `--ink` on
   white. Soft tints / grey are only ever backgrounds for 1-2 word pills, never
   behind sentences. Fix ALL instances in this PR, never one element at a time.
   - Quick grep starting point: search the new CSS for `*-soft` and `var(--bg)`
     backgrounds, then check every text colour rendered on them.

2. **PARSES-BUT-LOOKS-WRONG (broadest net — most bugs were visual).** A passing
   `node --check` is necessary but NOT sufficient. RENDER every new/changed
   screen to an image and INSPECT the pixels. Attach the screenshot to the PR.
   If you did not look at a rendered image, the step is not verified. Known past
   instances: an all-black chart fill, an angular Lorenz curve, label
   collisions, grey-on-grey text, a FileReader reading `r.target.result` instead
   of `r.result` and failing silently.
   - **If the screenshot tool is unavailable** (it has timed out for whole
     sessions), do NOT claim a visual eyeball you didn't do. Verify via DOM
     instead — `getComputedStyle` for sizes/colours, `scrollHeight > clientHeight`
     for clipping/overflow, class/attribute state for behaviour — and say plainly
     in the PR that verification was DOM-measurement only, no image captured.
   - **Device-class bugs (e.g. smartboard 3D-transform snap) can't be reproduced
     in the headless preview.** Verify the code/CSS is correct and the fallback
     fires by feature query, and flag that real confirmation is on the device.

3. **PER-RUNG STARTER MATCH.** Any practice scaffold must derive from the CHOSEN
   rung's OWN text. Starters are computed by `deriveStarters(rung.text)` at the
   point of use (see review-model.md), so a mismatch is impossible by
   construction — but still render each chosen rung's rep-1 starter and confirm
   it scaffolds THAT rung's sentence, not another's.

4. **TARGETED JUMPS.** Any "fix it now" / "jump to issue" control must land on
   the SPECIFIC named issue (e.g. the missing-link chip opens the link issue,
   not the first weak line). Test each jump path; confirm the destination
   matches the label.

5. **MARK CONSISTENCY.** Whenever marks are shown, assert in code, on every
   render, that `total = sum(paragraph scores)` and the rubric sums match the
   total. The worker's `finalize()` enforces this server-side; the UI must not
   re-derive an inconsistent number.

6. **NO EM-DASHES** in any model/feedback text, derived starter, or grading
   prompt output. Grep before each PR: a student would not write them, so a
   model that contains them fails as a model. (Number ranges like 1-2 and your
   own dev comments are exempt.)

7. **CSS: no duplicate property as "prefix fallback" (recurred, PR #32).** Writing
   `transition:-webkit-transform .85s; transition:transform .85s;` does NOT keep
   both — the second declaration wins and the prefixed one is dead. Put prefixed
   + unprefixed in ONE declaration as a comma list:
   `transition:-webkit-transform .85s ease, transform .85s ease;`. Same trap for
   any property where you add a `-webkit-`/unprefixed pair on the SAME selector.
   (Separate-property prefixes like `transform:` and `-webkit-transform:` on their
   own lines are fine — this is only about the SAME property declared twice.)

8. **CSS: an override must come AFTER what it overrides (recurred, PR #32).**
   `@supports`, fallback, and "reset" rules do NOT add specificity, so a later
   same-specificity rule wins. A fallback block placed ABOVE the rules it negates
   is dead code. After writing any fallback/override, confirm it sits later in the
   source than its target (or it genuinely out-specifies it).

9. **One source of truth for a value used on two paths (recurred, PR #30/#31).**
   If two code paths classify or size the same thing, derive both from ONE
   expression — never hardcode the value twice. Examples seen: SRS "mastered" vs
   the progress bar's "Got it" must use the same threshold off the same `r` (watch
   rounding: `Math.round(0.5*1)=1` silently flipped a half-rating to a full mark);
   card question + answer font size both read one `--card-scale` var, not two
   hardcoded sizes.

10. **Fail CLOSED on security gates (recurred, PR #29).** Gate on the DECLARED
    intent (config present), not on a runtime success flag that can be false when
    a dependency fails. The auth gate must key off `CONFIG.supabaseUrl` being set,
    not `Cloud.enabled()` (false if the supabase-js CDN fails to load) — otherwise
    a CDN hiccup silently disables the gate. Also: make EVERY entry point respect
    the gate (e.g. `?reviewdemo`, deep links), and add `for`/`id` to form labels.

## Mechanical gate (every PR)

- `node --check app.js content.js proxy/worker.js` (all pass).
- `node build.js` twice; `marginal-preview.html` is byte-identical and in sync.
- No API key literal anywhere; the key is only ever `env.ANTHROPIC_API_KEY` in
  `proxy/worker.js`. `.env` is gitignored.
- Render the changed screen(s), screenshot, inspect, attach to the PR.

## Build lessons recorded so they are not relived

- **Worker output budget vs Cloudflare timeout.** A full review with model-authored
  per-rung starters could not generate within Cloudflare's ~100s worker limit on
  Sonnet: 8000 tokens truncated (502 "grader returned no review"), 16000 timed
  out (`upstream 524`). Fix: the model emits only rung sentences; the app derives
  starters. Keep `max_tokens` sized so a real review completes in time; if you
  ever see 502/524, check `stop_reason` (surfaced in the 502 body) before raising
  the limit.
- **Any change to `proxy/worker.js` requires a manual Cloudflare redeploy** to go
  live. The repo does not deploy the worker. Pages config (index.html etc.) goes
  live automatically; the worker never does.
- **CRLF / `.gitattributes`.** `core.autocrlf=true` globally would make
  `build.js` output non-deterministic across machines; `.gitattributes` forces
  LF. Do not remove it.
- **Generated artifact.** `marginal-preview.html` is generated by `build.js`.
  Never hand-edit it; edit the three sources and rebuild.
