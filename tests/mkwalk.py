# Build the zero-setup walkthrough file: the current branch, no login gate, essay
# marking on, and one paper preloaded so Test mode is not an empty list. Nothing
# here is deployed; it is a build of the branch for walking only.
import io, json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT  = os.path.join(HERE, "out")
os.makedirs(OUT, exist_ok=True)

raw = io.open(os.path.join(ROOT, "marginal-preview.html"), encoding="utf-8").read()

# Two builds come out of here.
#
#   test.html                  the SHIPPED DEFAULTS, with only the login gate
#                              removed so a headless run can reach the app. Suites
#                              that assert default behaviour (marking switch off,
#                              no preloaded paper) must use this one.
#   marginal-walkthrough.html  the same build with essay marking switched on and
#                              one paper seeded, for walking the whole app.
plain = re.sub(r'supabaseUrl: "[^"]*"', 'supabaseUrl: ""', raw, count=1)
plain = re.sub(r'supabaseAnonKey: "[^"]*"', 'supabaseAnonKey: ""', plain, count=1)
io.open(os.path.join(OUT, "test.html"), "w", encoding="utf-8").write(plain)
print("plain build:", os.path.join(OUT, "test.html"), len(plain), "bytes")

src = plain.replace("essayMarking: false,", "essayMarking: true,", 1)

# A preloaded paper, if one is available. Without it Test mode simply starts empty.
paper_path = os.environ.get("WALK_PAPER", os.path.join(HERE, "fixtures", "hsc-bus-2025.json"))
exams = []
if os.path.exists(paper_path):
    paper = json.load(open(paper_path, encoding="utf-8"))
    paper["id"] = "walk-2025-bus"
    exams = [paper]
else:
    print("no paper fixture at %s: Test mode will start empty" % paper_path, file=sys.stderr)

seed = {"cards": {}, "endpoint": "", "code": "12Ec126", "log": [],
        "customSets": [], "lessons": {}, "exams": exams}
boot = """
<script>
// ---- walkthrough seed -------------------------------------------------------
// Boots to the HUB so every access point is reachable: Study, Create, Test mode.
(function(){
  try{
    var KEY="marginal.trial.v1";
    var cur=null; try{ cur=JSON.parse(localStorage.getItem(KEY)||"null"); }catch(e){}
    if(!cur||!cur.exams||!cur.exams.length){ localStorage.setItem(KEY, JSON.stringify(SEED)); }
  }catch(e){/* private mode: the app still runs, Test mode is just empty */}
})();
</script>
""".replace("SEED", json.dumps(seed))
i = src.index("<script>\n// =")
src = src[:i] + boot + src[i:]
dest = os.path.join(OUT, "marginal-walkthrough.html")
io.open(dest, "w", encoding="utf-8").write(src)
print("walkthrough:", dest, len(src), "bytes")

# A second build for walking the Evidence layer before real sources exist. Every
# item is stamped with a source that SAYS it is not verified, and the app prints
# it under each piece of evidence, so nothing here can be mistaken for checked
# work. Never deploy this file; it exists to let the layer be judged.
stamp = """
<script>
(function(){
  var S="PREVIEW ONLY, not a verified source";
  function mark(){ try{
    var E=(window.BUSCONTENT||{}).evidence||{};
    Object.keys(E).forEach(function(k){ E[k].forEach(function(e){ if(!e.source) e.source=S; }); });
  }catch(err){} }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",mark); else mark();
})();
</script>
"""
prev = src.replace("</body>", stamp + "</body>", 1) if "</body>" in src else src + stamp
dest2 = os.path.join(OUT, "marginal-walkthrough-evidence-preview.html")
io.open(dest2, "w", encoding="utf-8").write(prev)
print("evidence preview:", dest2, len(prev), "bytes")
