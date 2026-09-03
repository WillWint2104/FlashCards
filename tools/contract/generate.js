// The generators. One field definition in, four artefacts out, so the schema a
// machine validates against, the guide a person authors from and the templates
// they start from cannot disagree with each other.
//
//   docs/contract/question-package.schema.json
//   docs/contract/authoring-guide.md
//   docs/contract/template-{causal,judgement,write-only}.json
//
// Called by build.js above the promotion block, so a fault here refuses the
// build rather than publishing from one that failed, and by tests/t18.mjs,
// which regenerates and compares: drift fails a gate rather than a person.
const { FIELDS, ENUMS, LIBRARIES, CAPABILITIES, CONTAINERS } = require("./fields.js");
const directives = require("./directives.js");
const capabilities = require("./capabilities.js");

let REG = null;
const ID_PATTERN = "^[a-z0-9]+([.-][a-z0-9]+)*$";
const QID_PATTERN = "^[a-z0-9]+(-[a-z0-9]+)*$";

// Enum values come from the manifest where a library defines them, so the schema
// is generated against the content that exists rather than against a copy of it
// somebody remembered to update.
function enumValues(name, manifest) {
  const e = ENUMS[name];
  if (!e) throw new Error("unknown enum: " + name);
  if (e.values) return e.values.slice();
  const v = ((manifest || {}).enums || {})[e.key];
  if (!v) throw new Error("enum " + name + " wanted manifest.enums." + e.key + " and it is not there");
  return v.slice();
}

function leafSchema(f, manifest) {
  const d = { description: f.means };
  switch (f.type) {
    case "const": return Object.assign(d, { const: f.value });
    case "integer": {
      const s = Object.assign(d, { type: "integer" });
      if (f.range) { s.minimum = f.range[0]; s.maximum = f.range[1]; }
      return s;
    }
    case "boolean": return Object.assign(d, { type: "boolean" });
    case "date": return Object.assign(d, { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" });
    case "url": return Object.assign(d, { type: "string", format: "uri" });
    case "id": return Object.assign(d, { type: "string", pattern: f.pattern || QID_PATTERN });
    case "enum": return Object.assign(d, { enum: enumValues(f.enumName, manifest) });
    case "string": return Object.assign(d, { type: "string", minLength: 1 });
    case "string[]": return Object.assign(d, { type: "array", items: { type: "string", minLength: 1 } });
    case "ref": return Object.assign(d, { type: "string", pattern: ID_PATTERN,
      description: f.means + " Names a record in the " + f.refTo + " library." });
    case "ref[]": return Object.assign(d, { type: "array",
      items: { type: "string", pattern: ID_PATTERN },
      description: f.means + " Each names a record in the " + f.refTo + " library." });
    case "vocabRef[]": return Object.assign(d, { type: "array", items: { $ref: "#/$defs/VocabRef" } });
    case "band[]": return Object.assign(d, { type: "array", items: { $ref: "#/$defs/Band" } });
    case "record map": return Object.assign(d, { type: "object", additionalProperties: true });
    default: throw new Error("unknown type " + f.type + " on " + f.path);
  }
}

// A path like pathways[].guidance.<slot>.ladder[].rung is a tree instruction:
// [] descends into array items, <x> descends into a free-keyed map.
function place(root, path, leaf, required) {
  const parts = path.split(".");
  let node = root;
  parts.forEach((raw, i) => {
    const last = i === parts.length - 1;
    const isArr = /\[\]$/.test(raw);
    const key = raw.replace(/\[\]$/, "");
    const free = /^<.*>$/.test(key);
    let holder;
    if (free) {
      node.type = "object";
      node.additionalProperties = node.additionalProperties && typeof node.additionalProperties === "object"
        ? node.additionalProperties : {};
      holder = node.additionalProperties;
    } else {
      node.type = "object";
      node.properties = node.properties || {};
      node.properties[key] = node.properties[key] || {};
      holder = node.properties[key];
      if (last && required) { node.required = node.required || []; if (node.required.indexOf(key) < 0) node.required.push(key); }
    }
    if (isArr) {
      holder.type = "array";
      holder.items = holder.items || {};
      holder = holder.items;
    }
    if (last) { Object.keys(leaf).forEach(k => { if (holder[k] === undefined) holder[k] = leaf[k]; }); return; }
    node = holder;
  });
}

function jsonSchema(manifest) {
  const root = { $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://marginal.app/contract/question-package-v1.json",
    title: "Marginal QuestionPackage v1",
    description: "Generated from tools/contract/fields.js. Structural validity only: " +
      "capability is measured by the validator and reported by name, never enforced here, " +
      "because a package that honestly sits at a lower capability is valid.",
    type: "object", properties: {}, required: CONTAINERS.required.slice(), $defs: {} };
  root.$defs.VocabRef = { type: "object", required: ["id"],
    description: "A term asked for by name. A bare term string here is the pattern the format replaced.",
    properties: { id: { type: "string", pattern: ID_PATTERN },
      role: { enum: enumValues("vocabularyRole", manifest) } }, additionalProperties: false };
  root.$defs.Band = { type: "object", required: ["range", "text"],
    properties: { range: { type: "string" }, text: { type: "string" } } };

  FIELDS.filter(f => !/^shared:/.test(f.owner)).forEach(f => {
    place(root, f.path, leafSchema(f, manifest), f.required && f.omission === "invalid");
  });
  // A container that may honestly be absent says so once, at the top, rather
  // than every leaf inside it carrying a null alternative.
  CONTAINERS.nullable.forEach(k => {
    const p = root.properties[k]; if (!p) return;
    root.properties[k] = { anyOf: [p, { type: "null" }],
      description: "May be null. Absent is a capability fact, reported by name, not a silent gap." };
  });
  // Shared records are defined once and referenced, because a package that
  // provides one and a library that holds one must be the same shape.
  Object.keys(LIBRARIES).forEach(lib => {
    const name = LIBRARIES[lib].record;
    const own = FIELDS.filter(f => f.owner === "shared:" + lib);
    if (!own.length) return;
    const def = { type: "object", title: name,
      description: "Lives in the " + lib + " library. Resolvable from: " + LIBRARIES[lib].scope + ".",
      properties: { id: { type: "string", pattern: ID_PATTERN } }, required: ["id"] };
    own.forEach(f => place({ properties: { root: def } , type: "object" },
      "root." + f.path.split(".").slice(1).join("."), leafSchema(f, manifest),
      f.required && f.omission === "invalid"));
    root.$defs[name] = def;
  });
  return root;
}

// ---- the authoring guide ----------------------------------------------------
const esc = s => String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");
const OWNER_ORDER = ["package", "question", "area", "pathway"];
const ownerCell = f => ({ package: "the package envelope", question: "the question's own content",
  area: "an area, which is question-local", pathway: "a pathway, which is question-local" })[f.owner]
  || ("the " + f.owner.replace("shared:", "") + " shared library");
const OWNER_TITLE = {
  package: "The envelope",
  question: "The question",
  area: "Areas",
  pathway: "Pathways, one per authored argument",
};

function requiredCell(f) {
  if (f.required && f.omission === "invalid") return "**yes**";
  if (/^capability:/.test(f.omission)) return "for " + f.omission.replace("capability:", "`") + "`";
  if (/^level:/.test(f.omission)) return "for " + f.omission.replace("level:", "`") + "`";
  return "no";
}
// What leaving it out, or getting it wrong, actually costs. Four outcomes, and
// an author needs to be able to tell them apart before they write anything.
function omissionCell(f) {
  const out = [];
  if (f.required && f.omission === "invalid") out.push("**invalid** - the package does not import");
  else if (/^capability:/.test(f.omission)) out.push("**capability shortfall** - imports, and does not reach `" + f.omission.replace("capability:", "") + "`");
  else if (/^level:/.test(f.omission)) out.push("**level** - the record exists and the `" + f.omission.replace("level:", "") + "` surface will not use it");
  else out.push("**acceptable** - nothing depends on it");
  if (f.refTo && f.refTo !== "any" && f.refTo !== "areas in this package")
    out.push("naming a record the `" + f.refTo + "` library does not have is **blocked**, not invalid: declare it in `requires` and the report says the library is not ready, with nothing in the package to fix");
  return out.join("; ");
}
function allowed(f, manifest) {
  if (f.type === "const") return "`" + JSON.stringify(f.value) + "`";
  if (f.type === "enum" && f.enumName === "directive")
    return "any command in the directive registry below. " +
      REG.counts.supported + " of " + REG.counts.known + " are supported in guided writing";
  if (f.type === "enum") return enumValues(f.enumName, manifest).map(v => "`" + v + "`").join(", ");
  if (f.type === "integer" && f.range) return "whole number, " + f.range[0] + " to " + f.range[1];
  if (f.type === "id") return "lower case, hyphens";
  if (f.type === "ref" || f.type === "ref[]") return "id in `" + f.refTo + "`";
  if (f.type === "vocabRef[]") return "`{ id, role }`, role one of " + enumValues("vocabularyRole", manifest).map(v => "`" + v + "`").join(", ");
  return f.type;
}

function guide(manifest) {
  const L = [];
  REG = directives.registry();
  L.push("# Authoring a question outside Marginal");
  L.push("");
  L.push("**Generated from `tools/contract/fields.js`. Do not edit this file.** It is");
  L.push("regenerated by `node build.js` and compared by `tests/t18.mjs`, so a change here");
  L.push("that is not a change to the field definition fails a gate.");
  L.push("");
  L.push("The goal this document exists to serve: a question can be authored as JSON");
  L.push("outside the application, validated, reviewed as a coherent set, and imported,");
  L.push("without anyone reading the application's source.");
  L.push("");
  L.push("## How to read the tables");
  L.push("");
  L.push("**required** is the question of what happens if you leave it out. `yes` means the");
  L.push("package will not import. A capability name means it imports and does not reach");
  L.push("that capability, and the readiness report says which one by name. Nothing is");
  L.push("silently downgraded: publishing below the capability you claimed is an explicit");
  L.push("action somebody takes.");
  L.push("");
  L.push("**prose** says whether a student reads these words. Where it is yes, the house");
  L.push("rules apply: sentence case, no em dashes, original wording, and nothing that a");
  L.push("student could paste into their own answer.");
  L.push("");
  L.push("## The six capabilities");
  L.push("");
  L.push("| capability | what it means a student can be given |");
  L.push("| --- | --- |");
  CAPABILITIES.forEach(c => L.push("| `" + c.id + "` | " + esc(c.means) + " |"));
  L.push("");
  L.push("A question climbs these independently. `mkt-01` is `pathway-guided` and is not");
  L.push("`evidence-complete`, and one score would average that away.");
  L.push("");
  L.push("## Shared libraries");
  L.push("");
  L.push("A package references shared content by id and never copies it. These are the");
  L.push("libraries and the scope each is resolvable from, which is also the only scope the");
  L.push("readiness report may inspect: a report that walks a scope the engine never reaches");
  L.push("is measuring something no student can be given.");
  L.push("");
  L.push("| library | record | resolvable from |");
  L.push("| --- | --- | --- |");
  Object.keys(LIBRARIES).forEach(k =>
    L.push("| `" + k + "` | `" + LIBRARIES[k].record + "` | " + LIBRARIES[k].scope + " |"));
  L.push("");

  L.push("## The directive registry");
  L.push("");
  L.push("Every command the content recognises. There is no fallback: a command outside");
  L.push("this table is `DIRECTIVE_UNKNOWN` and does not import, and a command in it that");
  L.push("assigns no family gives a valid question whose family-dependent guidance is");
  L.push("**withheld**. The engine's own resolver returns `causal` when nothing matches,");
  L.push("which is how a Compare question came to be scaffolded as a cause; imported");
  L.push("content may not depend on that.");
  L.push("");
  L.push("| command | family | guided writing | sentence shapes | note |");
  L.push("| --- | --- | --- | --- | --- |");
  REG.commands.forEach(c => L.push("| `" + c.command + "` | " + (c.family ? "`" + c.family + "`" : "none") +
    " | " + (c.supportedInGuidedWriting ? "supported" : "**not supported**") +
    " | " + (c.sentenceShapeCoverage.length || "none") + " | " + esc(c.notes || "") + " |"));
  L.push("");

  L.push("## What earns each capability");
  L.push("");
  L.push("One definition, in `tools/contract/capabilities.js`, evaluated by the validator");
  L.push("and by the coverage report. Each capability is a **conjunction of named rules**,");
  L.push("so there is no score anywhere and a strong dimension cannot average away a weak");
  L.push("one. A failed rule reports the sentence below, not a number.");
  L.push("");
  capabilities.ORDER.forEach(cap => {
    L.push("### `" + cap + "`");
    L.push("");
    L.push("| rule | fails when |");
    L.push("| --- | --- |");
    capabilities.RULES[cap].forEach(r => L.push("| `" + r.id + "` | " + esc(r.says) + " |"));
    L.push("");
  });

  OWNER_ORDER.forEach(owner => {
    const own = FIELDS.filter(f => f.owner === owner);
    if (!own.length) return;
    L.push("## " + OWNER_TITLE[owner]);
    L.push("");
    own.forEach(f => {
      L.push("### `" + f.path + "`");
      L.push("");
      L.push("| | |");
      L.push("| --- | --- |");
      L.push("| required | " + requiredCell(f) + " |");
      L.push("| type | `" + f.type + "` |");
      L.push("| allowed | " + esc(allowed(f, manifest)) + " |");
      L.push("| belongs to | " + esc(ownerCell(f)) + " |");
      L.push("| leaving it out | " + esc(omissionCell(f)) + " |");
      if (f.refTo) L.push("| references | ids in `" + f.refTo + "` |");
      if (f.appliesTo) L.push("| applies to | " + esc(f.appliesTo) + " |");
      L.push("| student surface | " + esc(f.surface) + " |");
      L.push("| student reads it | " + (f.studentProse ? "yes" : "no") + " |");
      L.push("| may be answer specific | " + (f.answerSpecific ? "yes, and it is shown only on request" :
        "**no** - it must be about a different context, because scaffolding is not answer assembly") + " |");
      L.push("");
      L.push(f.means);
      L.push("");
      L.push("- good: " + f.good);
      L.push("- bad: " + f.bad);
      L.push("");
    });
  });

  L.push("## Shared library records");
  L.push("");
  Object.keys(LIBRARIES).forEach(lib => {
    const own = FIELDS.filter(f => f.owner === "shared:" + lib);
    if (!own.length) return;
    L.push("### `" + LIBRARIES[lib].record + "`");
    L.push("");
    L.push("| field | type | required | leaving it out | student reads it | what it is for |");
    L.push("| --- | --- | --- | --- | --- | --- |");
    own.forEach(f => L.push("| `" + f.path.split(".").slice(1).join(".") + "` | `" + f.type + "` | " + requiredCell(f) +
      " | " + esc(omissionCell(f)) + " | " + (f.studentProse ? "yes" : "no") + " | " + esc(f.means) + " |"));
    L.push("");
    own.forEach(f => {
      L.push("- `" + f.path.split(".").slice(1).join(".") + "` good: " + f.good);
      L.push("- `" + f.path.split(".").slice(1).join(".") + "` bad: " + f.bad);
    });
    L.push("");
  });
  return L.join("\n") + "\n";
}

// ---- templates --------------------------------------------------------------
// Generated from the same definition, because a hand-maintained template is
// exactly the drift the contract exists to prevent.
const BLANK = { const: v => v, integer: 20, boolean: false, date: "", url: "", id: "", string: "",
  enum: null, ref: null, "ref[]": [], "string[]": [], "vocabRef[]": [], "band[]": null, "record map": {} };
function templateValue(f, manifest) {
  if (f.type === "const") return f.value;
  if (f.type === "enum") return enumValues(f.enumName, manifest)[0];
  if (f.type === "integer") return f.range ? f.range[1] : 0;
  const v = BLANK[f.type];
  return Array.isArray(v) ? v.slice() : (v && typeof v === "object" ? {} : v);
}
function put(obj, path, value) {
  const parts = path.split(".");
  let node = obj;
  parts.forEach((raw, i) => {
    const last = i === parts.length - 1;
    const isArr = /\[\]$/.test(raw);
    const key = raw.replace(/\[\]$/, "");
    if (/^<.*>$/.test(key)) { node[key.replace(/[<>]/g, "")] = node[key.replace(/[<>]/g, "")] || {}; node = node[key.replace(/[<>]/g, "")]; return; }
    if (last && !isArr) { node[key] = value; return; }
    if (isArr) { node[key] = node[key] || [{}]; node = node[key][0]; if (last) { /* array of leaves */ } return; }
    node[key] = node[key] || {}; node = node[key];
  });
}
function template(kind, manifest) {
  const out = {};
  FIELDS.filter(f => !/^shared:/.test(f.owner)).forEach(f => {
    if (f.appliesTo === "judgement questions" && kind !== "judgement") return;
    if (kind === "write-only" && (f.owner === "pathway" || f.owner === "area")) return;
    if (kind === "write-only" && /^capability:(pathway-guided|learning-complete|evidence-complete)$/.test(f.omission)) return;
    put(out, f.path, templateValue(f, manifest));
  });
  if (kind === "write-only") { out.areas = []; out.pathways = []; }
  if (kind !== "write-only") out.question.directive = kind === "judgement" ? "evaluate" : "explain";
  return out;
}

module.exports = { jsonSchema, guide, template, enumValues, ID_PATTERN, QID_PATTERN };
