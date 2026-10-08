# Marker diagnosis, 8 October 2026 (after bots Run 1)

Run 1 of the live Test Mode bots found two marker faults on Question 11(b) of the
synthetic Business Studies paper (`tests/fixtures/bus-practice-paper.json`):

- a causally complete answer in ordinary language (`sa11b-unusual`) was marked
  1/3 because it "reads as informal reasoning rather than an economics
  explanation". Sent again on its own for this capture it was marked 2/3, still
  as "informal commentary rather than an economics explanation": the same words
  move across the corpus's minimum of 2 from one call to the next;
- a Business Studies question was described as Economics.

This folder holds the evidence for both, captured before any change to the
marker. Nothing here contains a key, a secret or a class code.

## What is deployed

The deployed worker (`marginal-grader.williamwinter2104.workers.dev`) is not the
worker in this repository. It is a version from `9265ec9` (29 June) to `31ed8d9`
(18 August) inclusive:

- its replies carry the four hard-coded Economics criteria (thesis and sustained
  judgement, use of evidence and data, economic terminology, cohesion) instead of
  the criteria the app sends;
- its replies lack `checks` and `credited`, which every version since `2b41373`
  (30 August) always returns;
- it has the essay coach (`paragraph_text is required`), which `5b23bfb` lacks.

The three candidate versions send the model byte-identical instructions for
this request, so the rebuilt request below is exact whichever one is live.

## What that version does with the app's request

The app sends the subject (Business Studies), Business criteria, the format
(short answer), the directive (explain), the Kerbside case study and the three
authored mark points. The deployed version sends the model none of them. It
opens with "You are an experienced HSC Economics marker building a
paragraph-by-paragraph review that teaches a student to improve their extended
response", requires a four-criterion Economics rubric (including "economic
terminology") for a 3-mark answer, and asks for a three-rung ladder on every
issue. The repository worker (`69c9fd2`) sends all of them, says nothing about
Economics, and tells the marker to mark a short answer as a short answer with an
empty rubric.

## Files

- `instructions.json`: the system prompt and tool schema of the deployed-era
  worker (one pass), and of the repository worker (two passes).
- `sa11b-partial.json`, `sa11b-strong.json`, `sa11b-unusual.json`: per profile,
  the exact question and response, everything the app sent (class code removed),
  the deployed-era model request rebuilt offline, the deployed worker's reply,
  final mark and duration, and the repository worker's pass-1 and pass-2
  requests rebuilt offline.

## How it was captured

- Replies: one request at a time to the deployed worker, from the request body
  the app itself sent during Run 1, with only the answer changed per profile.
- Model requests: each worker version was run offline with `fetch` replaced, so
  the request it would send the model was recorded and nothing left the machine.
- Per-pass timing and the repository worker's model responses are not here: the
  repository worker is not deployed, and no model key is available to this
  environment.

## Repeating it after a redeploy

Send the three request bodies again (they are in each profile file, add the
class code), compare the reply with the one stored here, and check that the
reply carries `checks` (proof the current worker answered) and never the word
Economics on a Business Studies question.
