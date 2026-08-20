---
title:      Interface optimisation, O1 to O4
date:       2026-08-19
status:     active
governs:    guided mode, all screens
---

## The target is not fewer words

Some interface language is necessary because this is a teaching tool. The
measurement that matters is not the ratio of interface words to student words
but **permanent cognitive competition**. At the default writing state the
student's eye should mostly meet four things:

1. what am I answering
2. what have I already written
3. what sentence am I writing now
4. what does this sentence need to accomplish

Everything else can be available without being continuously visible.

## The ideal default screen

```
question / current paragraph
argument chip     evidence chip

the student's existing prose...

[ CURRENT SENTENCE INPUT ]

Explain the relationship
Why would a digitally engaged target market encourage digital marketing?
[Help me]                                   [Next guide]

Understand · Ideas · Evidence · Structure · Vocabulary
```

That is nearly all of it.

## Keep permanently visible

Current question and paragraph; argument and evidence as compact chips;
accumulated prose; the active input; a one-line guide for the current slot;
`Help me`; `Next guide`; the compact toolbelt; minimal section progress.

## Move behind interaction

Long explanations of what guided mode is; TDECC explanations; full structure
descriptions; help rungs 2 to 5; alternate arguments; alternate evidence; source
details; textbook explanations; vocabulary lists; detailed progress commentary;
editing controls on every completed sentence; delete and rewrite buttons
permanently attached to every sentence.

Clicking the prose should reveal edit actions for that sentence. The screen
gains controls when the student asks for them and loses them again when the task
is done.

## The control budget

Roughly **12 or fewer immediately actionable controls**, against 27 today. Not
because twelve is magic, but because several current controls can be contextual.
A student actively writing needs about: response map, argument, evidence,
Understand, Ideas, Evidence tool, Structure, Vocabulary, `Help me`, `Another
sentence`, `Next guide`, submit or review.

Even there, `Another sentence` need not appear until something has been entered,
`Previous` can be handled by clicking existing prose, and saving should be
passive rather than visually prominent.

## The guide should be extremely economical

Today the slot heading and the guide say almost the same thing twice. Collapse
them. Two lines is enough:

```
Explain the relationship
Why would a digitally engaged target market encourage digital marketing?
```

The more authored context exists behind a question, the shorter the guide can be.

## Argument and evidence become chips after selection

Setup can be visually rich because the student is making a real decision. After
that, a chip preserves the context without competing with the paragraph:

```
💡 Digital engagement → e-marketing        ◉ MyMacca's app
```

Not a large card carried through 800 words. The rail holds the expanded version
for anyone who wants it.

## The resting rail recedes

If the chips already carry argument and evidence, the rail is mostly paragraph
progress:

```
Argument ✓   Knowledge ✓   Explain ●   Evidence ○   Connect ○
```

plus, at most, the selected evidence with a `View`. When a drawer opens the rail
becomes information-rich; when it closes it should visually recede.

## Order

* **O1** extended response, active writing state
* **O2** extended response, drawer-open state, preserving the composer geometry exactly
* **O3** setup state, which can afford more density because it is temporary
* **O4** review, mark and revise, which has a different goal and is optimised separately

Only once those feel right do the visual rules carry into short answer and
business report. Propagating today's density across three modes first would be
the expensive mistake.

## Preview evidence safety

The preview build is a sensible development mechanism, but a QA convenience left
unguarded becomes a production mistake. Preview evidence must be
development-only, a production build must fail if any record carries
`previewOnly: true` or the PREVIEW ONLY provenance marker, and the preview build
must be visually unmistakable with a banner at the top rather than only a note
under each item.

*(Implemented 2026-08-19: `build.js` refuses such a build; the preview file
carries a fixed banner.)*

## When real sources arrive

Each evidence record should carry at least `id`, `fact`, `studentSummary`,
`sourceTitle`, `publisher`, `sourceUrl`, `verifiedAt`, `compatibleArgumentIds`,
`compatibleConceptIds`, and ideally `supportNote` recording exactly what the
source verifies, so a verified source cannot be stretched to support a claim it
never makes.

## Test mode boundary

Guided mode may provide content, argument pathways, evidence and sentence
scaffolding. Test mode should provide only the question interpretation and
answer-shape support deliberately allowed, and no answer-specific content while
an assessed attempt is underway. Today's behaviour should be made deliberate
rather than inherited.
