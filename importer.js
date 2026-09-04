// THE IMPORTER, SLICE 1: THE READ ONLY PIPELINE.
//
// Choose -> Parse -> Validate -> Resolve references -> Review, wired to the real
// contract modules through window.MarginalContract. Review is as far as this
// build goes. There is no store, no write adapter and no publish call anywhere
// in this file, and the Publish step is drawn as unreachable rather than
// disabled, because it does not exist yet.
//
// THE ONE RULE THIS FILE IS WRITTEN AROUND: it decides nothing. Every verdict,
// severity, capability, reference outcome and admission state comes from
// validate(), admit() and plan(). This file arranges what they return. When a
// question here is "is this valid", the answer is a field on a report; it is
// never a condition written in this file. That is what keeps the importer and
// the rest of Marginal from drifting into two sets of rules.
//
// State is one object. Going back does not re-read the files and does not
// re-run anything: the batch is parsed once and the reports are computed once,
// so the screens are views of the same result rather than five chances to get a
// different answer.
(function () {
  "use strict";
  var C = window.MarginalContract;
  var D = window.MarginalImportData; // the generated manifest and registries

  var STEPS = ["Choose files", "Parse", "Validate", "Resolve references", "Review changes", "Publish"];
  // The rail is a short label per step; the page heading is the frozen wording
  // from the design. They are different lengths on purpose and are not derived
  // from each other.
  var HEADINGS = ["Choose the packages to import", "Parse packages", "Validate packages",
                  "Resolve references", "Review changes", "Publish"];
  var state = { step: 0, files: [], reports: null, plan: null, reached: 0 };

  // ---- helpers -------------------------------------------------------------
  var $ = function (sel) { return document.querySelector(sel); };
  var el = function (tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  // Everything from a file is untrusted text. It is put in the page as TEXT,
  // never as markup, so a package cannot script the importer.
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var plural = function (n, one, many) { return n + " " + (n === 1 ? one : (many || one + "s")); };
  var row = function (mark, title, sub) {
    return '<div class="w"><span class="k ' + mark + '">' +
      { add: "+", same: "=", stop: "x", warn: "!" }[mark] + '</span><span class="t">' + esc(title) +
      (sub ? "<small>" + esc(sub) + "</small>" : "") + "</span></div>";
  };

  // ---- the pipeline, run once per batch ------------------------------------
  // Parse and validate happen together because a file that does not parse has no
  // report, and the screens after Parse have to account for it either way.
  function runPipeline() {
    state.reports = state.files.map(function (f) {
      var r = { source: f.name, bytes: f.bytes, pkg: null, parseError: null, report: null };
      try { r.pkg = JSON.parse(f.text); }
      catch (e) { r.parseError = e.message; return r; }
      if (!r.pkg || typeof r.pkg !== "object" || Array.isArray(r.pkg)) {
        r.parseError = "the file parsed to " + (Array.isArray(r.pkg) ? "a list" : typeof r.pkg) +
          ", and a package is an object";
        r.pkg = null;
        return r;
      }
      r.report = C.validate(r.pkg, D.manifest, { registry: D.directives });
      return r;
    });
    // The admission plan. Built from the packages that parsed, against the real
    // question registry. Nothing else in this file may decide what is
    // publishable, so nothing else in this file asks.
    var entries = state.reports.filter(function (r) { return r.pkg; })
      .map(function (r) { return { source: r.source, pkg: r.pkg, report: r.report }; });
    state.plan = entries.length ? C.plan(entries, D.questions, D.manifest, { registry: D.directives }) : null;
  }
  var entryFor = function (source) {
    if (!state.plan) return null;
    for (var i = 0; i < state.plan.entries.length; i++)
      if (state.plan.entries[i].source === source) return state.plan.entries[i];
    return null;
  };

  // ---- the rail ------------------------------------------------------------
  function rail() {
    var r = $("#rail");
    r.innerHTML = "";
    STEPS.forEach(function (name, i) {
      var cls = "step" + (i === state.step ? " on" : i < state.step ? " done" : "") +
        (i === 5 ? " write" : "");
      var n = el("div", cls);
      n.innerHTML = '<b>' + (i < state.step ? "&check;" : i + 1) + "</b> " + esc(name);
      // Going back is free and re-runs nothing. Going forward past where the
      // batch has reached is not offered, because the later screens would be
      // describing a batch that has not been read.
      if (i < state.step) n.addEventListener("click", function () { go(i); });
      r.appendChild(n);
    });
  }
  function go(i) { state.step = i; state.reached = Math.max(state.reached, i); render(); }

  // ---- screens -------------------------------------------------------------
  var SCREENS = [choose, parsed, validated, resolved, review, publishStub];

  function render() {
    rail();
    $("#h1").textContent = HEADINGS[state.step];
    var s = $("#screen");
    s.innerHTML = "";
    SCREENS[state.step](s);
  }

  // 1 ------------------------------------------------------------------------
  function choose(s) {
    $("#lede").textContent = "Choosing a file reads its first two fields, so this list can say what " +
      "each one is. Nothing else is read until the next step.";
    var left = el("div");
    var card = el("div", "card");
    card.innerHTML = '<h2>Package files</h2><p class="sub">One question per file. ' +
      'JSON only, and each file is read where it sits.</p>';
    var drop = el("div", "drop");
    drop.innerHTML = "<p>Choose the package files to import</p><small>Or drop them here</small>";
    var input = el("input");
    input.type = "file"; input.multiple = true; input.accept = ".json,application/json";
    input.id = "filepick";
    input.style.marginTop = "14px";
    drop.appendChild(input);
    card.appendChild(drop);

    if (state.files.length) {
      var list = el("div");
      list.style.marginTop = "16px";
      state.files.forEach(function (f) {
        list.innerHTML += row("add", f.name, f.head);
      });
      card.appendChild(list);
    }
    left.appendChild(card);

    var right = el("div");
    var go1 = el("div", "card");
    go1.innerHTML = '<h2>What happens next</h2>' +
      '<p class="quiet">Parse reads each file and says whether it is a package Marginal can read at ' +
      'all. Nothing is checked against your question bank until Review.</p>';
    var btn = el("button", "btn primary", state.files.length ?
      "Continue with " + plural(state.files.length, "package") : "Continue");
    btn.id = "continue";
    btn.disabled = !state.files.length;
    var brow = el("div", "btnrow");
    brow.appendChild(btn);
    go1.appendChild(brow);
    go1.innerHTML += '<p class="note">This build is read only. It stops at Review and cannot write.</p>';
    right.appendChild(go1);

    var cols = el("div", "cols");
    cols.appendChild(left); cols.appendChild(right);
    s.appendChild(cols);

    // Re-query: innerHTML above replaced the node held in `btn`.
    $("#continue").addEventListener("click", function () { runPipeline(); go(1); });
    input.addEventListener("change", function () { take(input.files); });
    drop.addEventListener("dragover", function (e) { e.preventDefault(); });
    drop.addEventListener("drop", function (e) {
      e.preventDefault();
      take(e.dataTransfer && e.dataTransfer.files);
    });
  }

  function take(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;
    var read = files.map(function (f) {
      return f.text().then(function (text) {
        // The two fields the list shows, and only those. Reading more here would
        // make the claim on the screen false.
        var head = "";
        try {
          var j = JSON.parse(text);
          head = (j && j.schema ? j.schema : "no schema field") +
            (j && j.contractVersion ? " · contract " + j.contractVersion : " · no version");
        } catch (e) { head = "not readable as JSON"; }
        return { name: f.name, text: text, bytes: text.length, head: head };
      });
    });
    Promise.all(read).then(function (loaded) {
      state.files = state.files.concat(loaded);
      state.reports = null; state.plan = null;
      render();
    });
  }

  // 2 ------------------------------------------------------------------------
  function parsed(s) {
    $("#lede").textContent = "Whether each file is a package Marginal can read. Nothing here has been " +
      "checked against your question bank.";
    var okd = state.reports.filter(function (r) { return r.pkg; });
    var bad = state.reports.filter(function (r) { return !r.pkg; });
    var left = el("div");
    var c = el("div", "card");
    // Both counts, always. Showing only the failures when there are failures
    // makes the batch look smaller than it is, which is the thing every screen
    // in this importer is written not to do.
    c.innerHTML = '<p class="count"><span>' + plural(okd.length, "package") + "</span> read" +
      (bad.length ? ', <em>' + plural(bad.length, "file") + " could not be read</em>" : "") + "</p>" +
      '<p class="sub">Read means parsed and identified. It does not mean valid.</p>' +
      okd.map(function (r) {
        return row("add", r.pkg.question && r.pkg.question.id ? String(r.pkg.question.id) : "(no question id)",
          r.source + " · " + (r.pkg.schema || "no schema") + " · contract " + (r.pkg.contractVersion || "none"));
      }).join("") +
      bad.map(function (r) { return row("stop", r.source, r.parseError); }).join("");
    left.appendChild(c);
    var right = el("div");
    var n = el("div", "card");
    n.innerHTML = '<h2>Next</h2><p class="quiet">Validate checks each package against the contract: ' +
      'required fields, values, references inside the file. It does not look at your bank.</p>';
    var b = el("button", "btn primary", "Continue to Validate");
    b.id = "next"; b.disabled = !okd.length;
    var br = el("div", "btnrow"); br.appendChild(b); n.appendChild(br);
    right.appendChild(n);
    var cols = el("div", "cols"); cols.appendChild(left); cols.appendChild(right);
    s.appendChild(cols);
    $("#next").addEventListener("click", function () { go(2); });
    back(s, 0);
  }

  // 3 ------------------------------------------------------------------------
  function validated(s) {
    $("#lede").textContent = "Every package against the contract. A package is rejected or it is not, " +
      "and the reason is always a rule with a name.";
    var left = el("div");
    var head = el("div", "card");
    var okd = state.reports.filter(function (r) { return r.report; });
    var rejected = okd.filter(function (r) { return r.report.counts.error; });
    head.innerHTML = '<h2>Verdicts</h2><p class="sub">One line per package, from the validator.</p>' +
      okd.map(function (r) {
        var v = r.report;
        var tag = v.counts.error ? '<span class="tag badt">' + plural(v.counts.error, "error") + "</span>"
          : v.counts.warning ? '<span class="tag warnt">' + plural(v.counts.warning, "warning") + "</span>"
          : '<span class="tag good">valid</span>';
        return '<div class="w"><span class="k ' + (v.counts.error ? "stop" : "add") + '">' +
          (v.counts.error ? "x" : "+") + '</span><span class="t">' + esc(v.package) +
          "<small>" + esc(r.source) + " · " + esc(v.verdict) + "</small></span>" + tag + "</div>";
      }).join("");
    left.appendChild(head);

    // Grouped by what to do about them, not by which check found them. The
    // grouping is tools/contract/diagnostics.js, so the screen cannot invent a
    // category and a new validator code cannot silently stop being described.
    rejected.forEach(function (r) {
      var c = el("div", "card");
      var errs = r.report.findings.filter(function (f) { return f.severity === "error"; });
      var codes = {};
      errs.forEach(function (f) { codes[f.code] = 1; });
      var groups = C.groupErrors(r.report.findings);
      var warns = r.report.findings.filter(function (f) { return f.severity === "warning"; });
      c.innerHTML = "<h2>" + esc(r.source) + "</h2>" +
        '<p class="sub">' + plural(errs.length, "error") + " across " +
        plural(Object.keys(codes).length, "rule") + ". Grouped by what to do about them, " +
        "not by which check found them.</p>";
      groups.forEach(function (g) {
        var grp = el("div", "grp");
        // The explanation is the primary line. The code and the path sit under
        // it, small, because they are how you find the field and not what is
        // wrong with it.
        var body = g.findings.map(function (f) {
          return '<div class="ex"><span class="msg">' + esc(f.message) + "</span>" +
            '<span class="at">' + esc(f.code) + (f.path ? " · " + esc(f.path) : "") + "</span></div>";
        });
        grp.innerHTML = '<div class="grph"><span class="n">' + esc(g.title) +
          '</span><span class="c">' + g.findings.length + "</span></div>" +
          '<p class="grpw">' + esc(g.says) + "</p>" +
          '<div class="exlist">' + body.slice(0, 2).join("") + "</div>";
        if (body.length > 2) {
          var more = el("button", "more", "Show all " + body.length);
          var open = false;
          more.addEventListener("click", function () {
            // Expands IN PLACE. The scroll position is restored around the
            // change, so the rows a teacher was reading do not move under them.
            var y = window.scrollY;
            open = !open;
            grp.querySelector(".exlist").innerHTML = (open ? body : body.slice(0, 2)).join("");
            more.textContent = open ? "Show fewer" : "Show all " + body.length;
            window.scrollTo(0, y);
          });
          grp.appendChild(more);
        }
        c.appendChild(grp);
      });
      if (warns.length) {
        var wg = el("div", "grp");
        wg.innerHTML = '<div class="grph"><span class="n">Worth checking, and not blocking</span>' +
          '<span class="c w">' + warns.length + "</span></div>" +
          '<p class="grpw">Recorded on the import and does not stop it.</p>' +
          warns.map(function (f) {
            return '<div class="ex"><span class="msg">' + esc(f.message) + "</span>" +
              '<span class="at">' + esc(f.code) + (f.path ? " · " + esc(f.path) : "") + "</span></div>";
          }).join("");
        c.appendChild(wg);
      }
      left.appendChild(c);
    });

    var right = el("div");
    var n = el("div", "card");
    var goers = okd.filter(function (r) { return !r.report.counts.error; });
    n.innerHTML = '<h2>Next</h2><p class="quiet">Resolve references checks that everything each ' +
      'package names already exists in the shared libraries.</p>' +
      '<p class="quiet">' + plural(goers.length, "package") + " continue" + (goers.length === 1 ? "s" : "") +
      ". " + (rejected.length ? plural(rejected.length, "package") + " stops here and stays visible." : "") + "</p>";
    var b = el("button", "btn primary", "Continue to Resolve references");
    b.id = "next"; b.disabled = !goers.length;
    var br = el("div", "btnrow"); br.appendChild(b); n.appendChild(br);
    right.appendChild(n);
    var cols = el("div", "cols"); cols.appendChild(left); cols.appendChild(right);
    s.appendChild(cols);
    $("#next").addEventListener("click", function () { go(3); });
    back(s, 1);
  }

  // 4 ------------------------------------------------------------------------
  function resolved(s) {
    $("#lede").textContent = "What each package names, and whether it is there. A reference that names " +
      "nothing is never matched to something similar.";
    var left = el("div");
    state.reports.filter(function (r) { return r.report && !r.report.counts.error; }).forEach(function (r) {
      var c = el("div", "card");
      var req = r.pkg.requires || {};
      var kinds = Object.keys(req).filter(function (k) { return (req[k] || []).length; });
      var total = kinds.reduce(function (n, k) { return n + req[k].length; }, 0);
      var blocked = r.report.findings.filter(function (f) { return f.severity === "blocked"; });
      c.innerHTML = "<h2>" + esc(r.report.package) + "</h2>" +
        '<p class="sub">' + (total ? plural(total, "reference") + " across " + plural(kinds.length, "library")
          : "This package names no shared record.") + "</p>" +
        (blocked.length ? '<div class="w"><span class="k same">-</span><span class="t">' +
          plural(blocked.length, "declared dependency", "declared dependencies") +
          " not in the library yet<small>The package is right and the library is not ready. " +
          "There is nothing to fix in the file.</small></span>" +
          '<span class="tag blockt">waiting</span></div>' : "") +
        kinds.map(function (k) {
          return row("same", k.charAt(0).toUpperCase() + k.slice(1) + ", " + plural(req[k].length, "record"),
            "all found");
        }).join("") +
        (total && !blocked.length ? '<div class="rule">Every reference resolved. Nothing was matched by ' +
          "resemblance: a reference is an id or it is a finding.</div>" : "");
      left.appendChild(c);
    });
    var right = el("div");
    var n = el("div", "card");
    n.innerHTML = '<h2>Next</h2><p class="quiet">Review changes is the first step that looks at your ' +
      'question bank. It shows exactly what publishing would add.</p>';
    var b = el("button", "btn primary", "Continue to Review changes");
    b.id = "next";
    var br = el("div", "btnrow"); br.appendChild(b); n.appendChild(br);
    right.appendChild(n);
    var cols = el("div", "cols"); cols.appendChild(left); cols.appendChild(right);
    s.appendChild(cols);
    $("#next").addEventListener("click", function () { go(4); });
    back(s, 2);
  }

  // 5 ------------------------------------------------------------------------
  // Everything on this screen is a field of the plan. Nothing is counted here.
  function review(s) {
    $("#lede").textContent = "Everything Publish would write, listed one by one. Nothing has been " +
      "written, and this build cannot write.";
    var p = state.plan;
    var ch = p.changes;
    var left = el("div");
    var sum = el("div", "card");
    sum.innerHTML = '<p class="count">' + (p.empty ? "<em>Nothing would be written</em>"
      : "<span>" + plural(ch.questionsAdded, "question") + "</span> would be added") + "</p>" +
      '<p class="sub">Checked against the ' + plural(p.checkedAgainst.questions, "question") +
      " this bank holds now.</p>" +
      row("add", plural(ch.questionsAdded, "question") + " added") +
      row("add", plural(ch.sharedAdded, "shared record") + " added") +
      // Same number, same meaning: the shared records the PUBLISHABLE questions
      // name. When nothing is publishable it is zero because there is nothing to
      // name them, and the line says which of those two it is.
      row("same", p.questions.length
        ? plural(ch.sharedReferenced, "existing shared record") + " used by the " +
          plural(p.questions.length, "publishable question")
        : "0 existing shared records used, because nothing here is publishable") +
      (ch.questionsHeld ? row("stop", plural(ch.questionsHeld, "question") + " cannot be published",
        "Ids already in the bank") : "") +
      (ch.packagesDeferred ? row("same", plural(ch.packagesDeferred, "package") + " waiting on the library") : "") +
      (ch.packagesRejected ? row("stop", plural(ch.packagesRejected, "package") + " not included",
        "Rejected at Validate") : "");
    left.appendChild(sum);

    var q = el("div", "card");
    q.innerHTML = "<h2>Questions</h2>" +
      '<p class="sub">Every question the import would add, and every one it cannot.</p>' +
      '<div class="grp"><div class="grph"><span class="n">New</span><span class="tag ' +
      (p.questions.length ? "good" : "neutral") + '">' +
      (p.questions.length ? String(p.questions.length) : "none") + "</span></div>" +
      (p.questions.length ? p.questions.map(function (x) {
        return row("add", x.id, "New question, from " + x.source);
      }).join("") : '<p class="grpw">No question in this import has an id that is free.</p>') + "</div>" +
      (p.held.length ? '<div class="grp"><div class="grph"><span class="n">Already exists</span>' +
        '<span class="tag badt">' + p.held.length + ", cannot publish</span></div>" +
        '<p class="grpw">An id already in the bank is import blocking and never an implicit overwrite. ' +
        "The existing questions stay exactly as they are.</p>" +
        p.held.map(function (h) {
          var why = h.reasons.filter(function (x) { return x.code === "QUESTION_ID_ALREADY_EXISTS"; })[0];
          return row("stop", h.id, why ? why.message : "");
        }).join("") + "</div>" : "");
    left.appendChild(q);

    if (p.rejected.length || p.deferred.length) {
      var ni = el("div", "card");
      ni.innerHTML = "<h2>Not included</h2>" +
        '<p class="sub">Still listed, so the set you chose does not appear to have shrunk.</p>' +
        p.rejected.map(function (r) {
          var why = r.reasons.filter(function (x) { return x.stage === "validate"; })[0];
          return row("stop", r.source || r.id, why ? why.message : "Rejected at Validate");
        }).join("") +
        p.deferred.map(function (d) { return row("same", d.source || d.id, "Waiting on the library"); }).join("") +
        state.reports.filter(function (r) { return !r.pkg; })
          .map(function (r) { return row("stop", r.source, "Could not be read: " + r.parseError); }).join("");
      left.appendChild(ni);
    }

    var inv = el("div", "invariant");
    inv.textContent = "Nothing has been written yet. Publish will perform exactly the additions shown " +
      "above and will not modify existing records.";
    left.appendChild(inv);

    var right = el("div");
    var n = el("div", "card");
    n.innerHTML = "<h2>What happens next</h2>" +
      '<p class="quiet">' + (p.empty ? "There is nothing to publish, so the next step has nothing to do."
        : "Publish performs the additions above and nothing else.") + "</p>";
    var b = el("button", "btn primary", "Continue to Publish");
    b.id = "next";
    // The enable rule, and the only place it is written: at least one publishable
    // addition. It is read from the plan, not recomputed.
    b.disabled = p.empty;
    var br = el("div", "btnrow"); br.appendChild(b); n.appendChild(br);
    right.appendChild(n);

    var marks = el("div", "card");
    marks.innerHTML = "<h2>What each mark means</h2>" +
      '<p class="quiet"><b>+ new.</b> Does not exist yet. Publish creates it.</p>' +
      '<p class="quiet"><b>= already exists.</b> Publish reads it and leaves it exactly as it is.</p>' +
      '<p class="quiet"><b>x not published.</b> Either the package was rejected, or its id is taken.</p>' +
      '<div class="rule">There is no fourth mark, because there is no overwrite.</div>';
    right.appendChild(marks);

    var readiness = p.entries.filter(function (e) { return e.publishable && e.capability; });
    if (readiness.length) {
      var rd = el("div", "card");
      rd.innerHTML = "<h2>Readiness is not a change</h2>" +
        readiness.map(function (e) {
          return '<p class="quiet"><b>' + esc(e.id) + "</b> reaches " +
            esc(String(e.capability.headline).split(" - ")[0].toLowerCase()) +
            (e.capability.missing.length ? " and does not reach " +
              plural(e.capability.missing.length, "capability", "capabilities") + ": " +
              esc(e.capability.missing.join(", ")) : "") + ".</p>";
        }).join("") +
        '<p class="quiet">None of that is a write, so none of it appears in the list on the left.</p>';
      right.appendChild(rd);
    }

    var cols = el("div", "cols"); cols.appendChild(left); cols.appendChild(right);
    s.appendChild(cols);
    $("#next").addEventListener("click", function () { go(5); });
    back(s, 3);
  }

  // 6 ------------------------------------------------------------------------
  // Drawn, and not reachable. Slice 1 has no store, so a Publish button here
  // would be a button that lies about what it does.
  function publishStub(s) {
    $("#lede").textContent = "This build stops here.";
    var c = el("div", "card");
    c.innerHTML = "<h2>Publish is not built yet</h2>" +
      '<p class="sub">This is the read only importer. Everything before this step is real: the ' +
      'verdicts, the references and the plan all came from the contract modules.</p>' +
      '<p class="quiet">There is no store underneath this build and no write path in it. A Publish ' +
      'button here would be a button that does not do what it says, so there is not one.</p>' +
      '<div class="rule">The plan above is what Publish will be given when it exists. It is not ' +
      "recomputed at that point and it is not rebuilt from the files.</div>";
    s.appendChild(c);
    back(s, 4);
  }

  function back(s, to) {
    var row2 = el("div", "btnrow");
    var b = el("button", "btn", "Back");
    b.id = "back";
    b.addEventListener("click", function () { go(to); });
    row2.appendChild(b);
    s.appendChild(row2);
  }

  // ---- boot ----------------------------------------------------------------
  function boot() {
    if (!C || !D) {
      document.getElementById("screen").innerHTML =
        '<div class="card"><h2>The contract did not load</h2><p class="sub">The importer applies the ' +
        "contract modules and will not run without them, rather than falling back to rules of its own.</p></div>";
      return;
    }
    render();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  // Exposed for the test harness only. It reads state; it cannot change it.
  window.__importer = { state: function () { return state; }, go: go, take: take };
})();
