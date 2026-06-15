# Importing flashcards / question sets by JSON

Where: **Create** tab → "Import a set (JSON)" textarea → **Import set**.
What it does: creates a **standalone custom set** that appears on the Study map
under **"Your sets"**. It does NOT merge into a built-in module (Measuring,
Income, …) — those live in `content.js` and can only be changed in the repo.
So a set's *module* is the set itself; its `name` is the label you see.

The importer re-ids every card (`custom-<timestamp>-<i>`) so imported cards
never clash with existing progress.

---

## 1. Simplest input — a flashcard list (front/back)

Both of these import successfully:

```json
[
  { "front": "What does a Lorenz curve plot?", "back": "Cumulative income share against cumulative population share." },
  { "front": "What is the Gini coefficient?",  "back": "A single-number inequality measure from the Lorenz curve, 0 to 1." }
]
```

```json
{
  "name": "Measuring — Lorenz & Gini flashcards",
  "cards": [
    { "front": "...", "back": "..." }
  ]
}
```

The importer maps each card onto the app's shape:

| You write | Becomes | Notes |
|---|---|---|
| `front` | `prompt` | also accepts `q`, `question`, `term`, or `prompt` |
| `back`  | `model`  | also accepts `a`, `answer`, `def`, `definition`, or `model` |
| *(omitted)* | `type: "define"` | front/back cards default to a define card |
| *(omitted)* | `marks: 1` | |

A `define` card flips correctly in **Flashcards** mode (front = question,
back = answer) and is also typeable in **Short answer** mode.

A bare array gets the name **"Imported set"** — wrap it in `{ "name": ... }`
to label it.

---

## 2. Canonical full template (all types)

```jsonc
{
  "format": "marginal-set@1",          // optional, ignored by the importer
  "name": "My set name",               // optional (label on the Study map; default "Imported set")
  "glossary": {                        // optional: term -> definition, adds tap-to-define popovers
    "lorenz curve": "A graph of cumulative income share vs cumulative population share."
  },
  "cards": [

    // FLASHCARD / DEFINITION  (front+back, or prompt+model)
    {
      "type": "define",                // optional for front/back cards (defaults to define)
      "marks": 1,                      // optional (defaults to 1)
      "front": "What is the Gini coefficient?",   // REQUIRED text (front | q | question | term | prompt)
      "back":  "A 0–1 inequality measure from the Lorenz curve.", // REQUIRED text (back | a | answer | def | definition | model)
      "vocab": ["lorenz","equality"],  // optional: key terms; used to grade Short-answer mode and as a hint
      "hint":  "Think area ratios.",   // optional
      "context": "Why it matters …"    // optional: shown under "Why — the concept"
    },

    // SHORT ANSWER  (typed, graded on key terms)
    {
      "type": "short",
      "marks": 3,
      "prompt": "Explain why the ABS uses equivalised disposable income.",  // REQUIRED
      "model":  "Because it adjusts for tax and household size …",          // REQUIRED
      "vocab": ["tax","household","needs"]
    },

    // MULTIPLE CHOICE
    {
      "type": "mc",
      "marks": 1,
      "prompt": "A rising Gini coefficient indicates:",   // REQUIRED
      "choices": [                                         // REQUIRED: 2+, exactly one "ok": true
        { "t": "Rising inequality", "ok": true,  "why": "Moves toward 1." },
        { "t": "Falling inequality", "ok": false, "why": "That would be a fall toward 0." }
      ]
    },

    // CALCULATION
    {
      "type": "calc",
      "marks": 2,
      "prompt": "If A = 0.2 and B = 0.3, find the Gini (1 dp).",
      "expected": 0.4,                 // REQUIRED numeric
      "tolerance": 0.01,               // optional (default tolerance applies if omitted)
      "working": "Gini = A/(A+B) = 0.2/0.5 = 0.4",  // optional, shown on the back / after grading
      "model": "0.4"
    },

    // EXTENDED RESPONSE (essay) — see content.js lr1..lr12 for full faults/scaffold shape
    {
      "type": "essay",
      "marks": 8,
      "prompt": "Analyse what the Lorenz curve shows about the tax-transfer system.",
      "model":  "A strong response defines the Lorenz curve, reads the two curves …",  // REQUIRED
      "vocab": ["Lorenz curve","disposable income"],
      "scaffold": ["Define the tool.", "Read the stimulus.", "Conclude with a judgement."]
    }

  ]
}
```

### Validation rules (what the importer rejects)
Every card must have:
- a **prompt** (or front/q/question/term),
- **marks ≥ 1** (auto-filled to 1 for front/back cards),
- a valid **type**: `mc` | `calc` | `define` | `short` | `essay`.

Per type:
- `mc` → `choices` with **2+** options and **exactly one** `"ok": true`.
- `calc` → numeric `expected`.
- `define` / `short` / `essay` → a `model` (or back/answer/def/definition).

---

## 3. Converter (if you'd rather transform before pasting)

The importer already accepts `{front, back}` directly, so you usually don't
need this. But to pre-convert an array of `{front, back}` into explicit cards:

```js
function toMarginalSet(name, pairs) {
  return {
    format: "marginal-set@1",
    name,
    cards: pairs.map(p => ({
      type: "define",
      marks: 1,
      prompt: p.front ?? p.q ?? p.question ?? p.term,
      model:  p.back  ?? p.a ?? p.answer   ?? p.definition,
    })),
  };
}

// Example:
// const json = JSON.stringify(toMarginalSet("Measuring — Lorenz & Gini", pairs), null, 2);
```

---

## 4. Which module do imported cards attach to?

They become **their own set** on the Study map ("Your sets"), labelled by
`name`. The JSON does **not** carry a built-in module, and you do **not** import
"inside" a module — pick a clear `name` (e.g. `"Measuring — Lorenz & Gini
flashcards"`) so it reads as belonging with that topic.

To put cards *literally inside* a built-in module's tile, they must be added to
that area's `cards: []` in `content.js` (a repo change + rebuild), not imported.
