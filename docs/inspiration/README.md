# Inspiration and reference documents

Where briefs, mockups, extracted notes and settled decisions live so that any
session, local or in the cloud, can read them without you re-explaining anything.

## Getting a document in here without a local session

You do **not** need to run Claude Code locally to hand me a file. Three routes,
easiest first:

1. **GitHub web upload.** Open the repo on github.com, go to
   `docs/inspiration/<folder>`, press **Add file → Upload files**, drag the file
   in, and commit to `claude/marking-everywhere`. Then tell me it is there and I
   will `git pull`. This works from a phone.
2. **Local session.** `git pull`, drop the file in the folder, `git add`, commit,
   push.
3. **A link.** If it already lives on a stable public page, paste the URL and I
   can fetch it.

Tell me the filename after you add it. I do not watch the repo.

## What goes where

| Folder | What belongs | What does not |
| --- | --- | --- |
| `briefs/` | direction you have written: acceptance criteria, phase briefs, feedback rounds worth keeping | passing chat messages |
| `mockups/` | images of interfaces you want to work toward, plus a `.md` beside each saying what it is showing | screenshots of the app as built (those go in `tests/out/`) |
| `references/` | **notes taken from** a source, in your words or mine: structure, terminology, the shape of an explanation | the source itself |
| `decisions/` | one file per settled question, so nothing gets re-litigated | anything still open |

## The rule about copyrighted sources

**Do not commit textbooks, past papers, marking guides or any other licensed
material.** Not scans, not PDFs, not pasted chapters. The repo is not the right
home for them and the app's content rule is unchanged: use the substance of a
source in original wording, never reproduce or reword it.

When you want me to work from a textbook, hand me the file in a session and I
will write notes into `references/` in original wording. The notes are what gets
committed; the source stays with you.

## Naming and headers

Filenames: `YYYY-MM-DD-short-slug.md`, so order is obvious. Mockups take the same
stem as the note that describes them.

Every document starts with this block, which is how `index.md` stays honest:

```
---
title:     Guided composition redesign brief
date:      2026-08-18
status:    active            # active | superseded | archived
governs:   guided mode, essay practice
supersedes: 2026-08-12-composer-notes.md
---
```

`status: superseded` is better than deleting. A superseded brief explains why the
current one says what it says.

## index.md

`index.md` is the manifest and the first thing I read. One row per document, with
what it governs and whether it is still live. When you add a file, add a row, or
tell me and I will. A document that is not in the index will still be found by a
search, but it will not be found by a session that is only orienting itself.

## Size

Keep images under about 1 MB and prefer PNG. Git stores every version of a binary
forever, so a 12 MB mockup re-uploaded five times is 60 MB in the history of a
repo that GitHub Pages serves. If something is genuinely large, put a link in a
note instead of the file.
