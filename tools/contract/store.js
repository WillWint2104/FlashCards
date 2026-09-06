// THE PERSISTENCE ADAPTER. One write boundary, underneath publication.
//
// publish.js decides WHAT is written. This decides HOW it is kept. Nothing else
// in Marginal may write an imported question, and in particular the importer UI
// may not: a second write path is how the thing a teacher approved and the thing
// that lands stop being the same thing.
//
// THE STORAGE LAYOUT IS THE ATOMICITY RULE, WRITTEN DOWN.
// The atomic unit is the package together with the records it provides, so a
// published package is ONE key holding one object. There is no arrangement of
// several keys that leaves half a package behind, because there are never
// several keys to get half way through. A backend that cannot write one key
// atomically is not a backend this can use.
//
//   marginal.import.pkg.<question id>   one published package, whole
//   marginal.import.index               the ids, so a reader need not scan keys
//
// The index is a convenience and never the authority. It is rebuilt from the
// package keys on load, so an index that disagrees with what is stored loses:
// a question is present because its package is present.
//
// The backend is injected. In a browser it is localStorage; in a test it is an
// object; nothing here knows which, so the rules are tested without a browser
// and are the same rules in one.
const PREFIX = "marginal.import.pkg.";
const INDEX = "marginal.import.index";

// A backend is four functions over strings. Anything meeting this can be one.
function memoryBackend(seed) {
  const m = Object.assign({}, seed || {});
  return {
    name: "memory",
    get: k => (k in m ? m[k] : null),
    set: (k, v) => { m[k] = String(v); },
    remove: k => { delete m[k]; },
    keys: () => Object.keys(m),
  };
}

function localStorageBackend(ls) {
  return {
    name: "localStorage",
    get: k => ls.getItem(k),
    set: (k, v) => ls.setItem(k, String(v)),
    remove: k => ls.removeItem(k),
    keys: () => { const out = []; for (let i = 0; i < ls.length; i++) out.push(ls.key(i)); return out; },
  };
}

// A backend that fails on a named package, so the failure path can be exercised
// against the real adapter rather than against a mock of it. It fails on SET,
// which is the only place a write happens, and after every check has passed.
function failingBackend(inner, failOnKey) {
  return {
    name: inner.name + " (failing on " + failOnKey + ")",
    get: inner.get, remove: inner.remove, keys: inner.keys,
    set: (k, v) => {
      if (k === PREFIX + failOnKey) throw new Error("the store refused the write");
      return inner.set(k, v);
    },
  };
}

function createStore(backend) {
  const B = backend;

  // Everything that has been published here, read back from the package keys.
  // The index is not consulted, because it is a cache of this.
  function load() {
    const questions = {}, shared = {}, broken = [];
    B.keys().filter(k => k.indexOf(PREFIX) === 0).forEach(k => {
      let unit = null;
      try { unit = JSON.parse(B.get(k)); } catch (e) { broken.push({ key: k, why: e.message }); return; }
      if (!unit || !unit.question || !unit.question.id) { broken.push({ key: k, why: "no question in the stored unit" }); return; }
      questions[unit.question.id] = unit.question;
      (unit.shared || []).forEach(r => {
        shared[r.kind] = shared[r.kind] || {};
        shared[r.kind][r.id] = { id: r.id, suppliedBy: unit.question.id };
      });
    });
    // A key that will not parse is reported and never silently skipped: a
    // question that has quietly stopped existing is worse than one that has
    // loudly failed to.
    return { questions: questions, shared: shared, broken: broken };
  }

  // The one write. A whole package in a single set, so it lands or it does not.
  // It refuses an id that is already stored rather than replacing it, which is
  // the same rule admission applies, enforced again at the last possible moment.
  function writeUnit(unit) {
    if (!unit || !unit.question || !unit.question.id) throw new Error("a unit must carry a question");
    const key = PREFIX + unit.question.id;
    if (B.get(key) != null)
      throw new Error("QUESTION_ID_ALREADY_EXISTS: " + unit.question.id + " is already stored");
    // Serialise first. A unit that cannot be serialised must fail BEFORE the
    // write rather than during it.
    const text = JSON.stringify(unit);
    if (JSON.parse(text).question.id !== unit.question.id)
      throw new Error("the stored unit would not read back as itself");
    B.set(key, text);
    // The package key is the atomic act and it has happened. The index is a
    // convenience that load() never consults, so a failure to update it must not
    // turn a write that SUCCEEDED into one reported as failed: that would leave
    // a stored question the caller believes is absent, which is the one state
    // this whole design exists to prevent.
    let indexed = true;
    try { reindex(); } catch (e) { indexed = false; }
    return { key: key, indexed: indexed };
  }

  function reindex() {
    const ids = B.keys().filter(k => k.indexOf(PREFIX) === 0).map(k => k.slice(PREFIX.length)).sort();
    B.set(INDEX, JSON.stringify({ schema: "marginal.import.index", version: 1, ids: ids }));
  }

  // The destination publish.js writes into: the questions that shipped, plus the
  // ones published here, plus the one function that persists a package.
  function destination(bundledRegistry) {
    const persisted = load();
    const questions = {};
    Object.keys(bundledRegistry.questions).forEach(id => {
      const q = bundledRegistry.questions[id];
      questions[id] = { id: id, subject: q.subject, subjectLabel: q.subjectLabel, document: null };
    });
    Object.keys(persisted.questions).forEach(id => { questions[id] = persisted.questions[id]; });
    return {
      schema: "marginal.destination", questions: questions, shared: persisted.shared, log: [],
      broken: persisted.broken,
      // The persistence hook publish.js calls inside the atomic unit. Present
      // here and absent on an in memory destination, which is the whole
      // difference between a rehearsal and a publication.
      write: writeUnit,
      backend: B.name,
    };
  }

  function clear() {
    B.keys().filter(k => k.indexOf(PREFIX) === 0 || k === INDEX).forEach(k => B.remove(k));
  }

  return { load: load, destination: destination, writeUnit: writeUnit, clear: clear,
           index: () => { try { return JSON.parse(B.get(INDEX)); } catch (e) { return null; } },
           backend: B };
}

module.exports = { createStore, memoryBackend, localStorageBackend, failingBackend, PREFIX, INDEX };
