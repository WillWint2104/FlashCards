# Study resources

What the Learn button opens, and what it deliberately does not.

## The model

A resource is a label somebody wrote and a link somebody supplied. It is held
once in `window.ESSAY.resources`, keyed by a stable id, and referenced from
questions, areas and pathways by `studyRefs`. Changing where a resource lives is
one edit, not one edit per question.

    resources: {
      "business.operations.strategies": {
        id: "business.operations.strategies",
        label: "Operations strategies",
        url: "https://drive.google.com/file/d/…/view",
        provider: "Google Drive PDF",
        note: "Chapter 6",          // optional, authored, never derived
      }
    }

    question.studyRefs  = ["business.operations.strategies"]
    pathway.studyRefs   = ["business.operations.technology"]
    area.studyRefs      = [...]

The field is `studyRefs` and the type is generic on purpose. A resource may be a
chapter in a school's licensed copy, a page in a learning management system, or
notes written for this app later. Nothing in the schema says "textbook".

**No resource bytes live in this repository.** The repo is public; a licensed
textbook committed to it would be published to the open internet and would stay
in git history after deletion. Resources are links to material the school
already holds, behind whatever access that platform applies.

## Nothing is authored yet

`resources` is empty and no question carries `studyRefs`. Every surface that
reads them is written to say so:

- no resources at all → "No study resources have been added for this question yet."
- resources, no argument chosen → the question's reading, and a line saying that
  choosing an argument reveals reading for it
- an argument with none authored → "Nothing has been added for this argument yet."

None of those states borrows another section's list to look populated, and a
`studyRef` that resolves to nothing is not shown as a resource the student
cannot open.

## Opening a resource

Every row is an ordinary link: new tab, `rel="noopener noreferrer"`. That route
is guaranteed and never depends on anything the host allows.

`preview` opens the resource inside Marginal, using Drive's `/preview` form of a
share link where it recognises one. This is an enhancement. A workspace policy
that refuses framing, or a file the student is not signed in for, fails in a way
the parent page cannot detect: a cross-origin frame still fires `load` and its
document cannot be read. So there is no failure detection. A standing line under
the frame says the resource may not open here and offers the tab instead, which
costs one line and is correct in every case.

## What this replaced, and what became unreachable

Learn used to open the Learning Centre. The Centre is out of the student route
while it is rebuilt. Its code and content are preserved, not deleted.

Unreachable to a student in essay mode until it returns:

- the concept explanations routed from a pathway's `concept` (the syllabus
  `what` and `why` in `business-content.js`)
- the four authored pathway lessons on `mkt-01`
- the "how they connect" card and the directive explainer inside the Centre

The syllabus terms themselves still reach the student through Vocabulary,
Structure and Evidence. The explanations do not.

`?eslegacy=1` is the only remaining route to the Centre. It is not a student
route and is linked from nowhere. It exists so that `ui13`, `ui16` and `ui38`
keep proving the Centre's teaching is correct while its surface is out; a
preserved thing that no test covers rots.
