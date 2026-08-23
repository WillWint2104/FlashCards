# Evidence layer

McDonald's is the student-facing case study. This directory holds the working
records behind the evidence bank in `business-content.js`.

`EVIDENCE-SOURCES.md` at the repo root states the rule this layer serves:

> Evidence with no recorded source is a candidate, not evidence.

Enforced in code: `esEvidenceUsable(e)` is true only when `e.source` is a
non-empty string, and every route into the picker goes through it. Nothing here
changes that. **A record only becomes student-visible when `source` is filled in
`evidence-sources.json`, so that file is the live switch and must not be filled
on anything less than a genuine confirmation.**

## Record format

Every evidence record works toward this shape. The three-part split is the same
discipline the reference notes use, for the same reason: what the source
establishes must never be confused with what we reason from it.

```
claim               one factual assertion, as narrow as it can be made
source              the reference in words, as a student could cite it
source title        the title of the document or page
source url          where it can be confirmed
date checked        YYYY-MM-DD, the date it was actually confirmed
verification        see the status table below
business area       operations / marketing / finance / human resources
syllabus concepts   the syllabus terms it speaks to
pathways supported  only the pathways it genuinely proves
SOURCE FACT         what the source explicitly establishes
DERIVED RELATIONSHIP  the Business Studies reasoning drawn from it
STUDENT USE         the kind of Explain / Analyse / Evaluate argument it supports
limits              what the evidence does not prove
```

## One claim per record

An evidence record must be **narrower than the case study section it came from**.
Not "McDonald's global operations". Instead: McDonald's operates N restaurants;
approximately X per cent are franchised; the app awards points at a stated rate.

The reason is the mapping. A compound record can only be attached to a pathway at
the strength of its weakest claim, and a student citing it inherits every part,
including the parts nobody checked. `EVIDENCE-SOURCES.md` already requires this:

> If part of an item is checkable and part is not, split the item or cut the
> unverifiable part; do not source the easy half and leave the rest riding on it.

## Verification status

| status | meaning | may fill `source` in evidence-sources.json |
| --- | --- | --- |
| `verified-primary` | the primary source was opened and the claim read in it | yes |
| `verified-secondary` | a reliable independent source was opened and read | yes, with the limitation recorded |
| `candidate-primary` | a primary source containing the claim was located, but could not be opened from this session | **no** |
| `candidate-secondary` | as above, independent source | **no** |
| `unsupported` | no source located | **no** |
| `split-required` | the record bundles claims of differing status | **no**, until split |

Source preference: McDonald's corporate, annual, investor and sustainability
material and regulator publications first; strong independent sources after.

## Do not fill gaps by analogy

Where a relationship has no McDonald's evidence, it is recorded as a gap. It is
never filled by assuming McDonald's does something because a comparable business
does, or because it is the sort of thing a large business does. A smaller
verified bank is worth more than a complete-looking one, because the student is
marked on what they assert.

## Current environment limitation

This session's network policy blocks direct page fetches to every relevant
domain, including `corporate.mcdonalds.com`, `mcdonalds.com.au`, `www.sec.gov`
and `www.foodauthority.nsw.gov.au` (403 at the egress proxy). Web *search* works
and returns content from those domains.

That is enough to locate sources and read claims out of search results. It is not
enough to reach `verified-primary`, because that status means the page was
opened and the wording read. So this pass produces `candidate-primary` records
with exact URLs, and **nothing is written into `evidence-sources.json`**.

A session with fetch access, or Will opening the recorded URLs, converts them.
The URLs are chosen so that confirmation is a single click each.
