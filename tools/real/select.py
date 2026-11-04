# Pick everyday sentences recorded by Tatoeba user CK (CC BY-NC-ND 3.0), balanced by type.
# usage: python select.py <tatoeba dir with eng.tsv + sentences_with_audio.csv> <ours.json> <out.json> [n]
import json, os, random, re, sys
D, ours_path, out_path = sys.argv[1:4]
N = int(sys.argv[4]) if len(sys.argv) > 4 else 400
norm = lambda s: re.sub(r"[^a-z' ]", "", s.lower().replace("’", "'").replace("…", "")).strip()
eng = {}
for row in open(os.path.join(D, "eng.tsv"), encoding="utf8"):
    p = row.rstrip("\n").split("\t")
    if len(p) >= 3: eng[p[0]] = p[2]
rec = {}
for row in open(os.path.join(D, "sentences_with_audio.csv"), encoding="utf8"):
    p = row.rstrip("\n").split("\t")
    if p[0] in eng and p[2] == "CK": rec.setdefault(p[0], p[1])
ours = {norm(s) for s in json.load(open(ours_path))}
OK = re.compile(r"^[A-Z][A-Za-z' ,]*[a-z][.?!]$")
YN = re.compile(r"^(Do|Does|Did|Is|Are|Was|Were|Can|Could|Will|Would|Have|Has|Should|May|Shall)\b")
WH = re.compile(r"^(What|Where|When|Why|Who|How|Which|Whose)\b")
TAG = re.compile(r", (isn't|aren't|doesn't|don't|didn't|won't|can't|wasn't|weren't|haven't|hasn't|is|are|do|does|did|will|can) (it|he|she|they|you|we|there|I)\?$")
def kind(s):
    if TAG.search(s): return "tag"
    if s.endswith("?") and " or " in s: return "choice"
    if s.endswith("?") and YN.match(s): return "yn"
    if s.endswith("?") and WH.match(s): return "wh"
    if s.endswith("!"): return "excl"
    if s.endswith("."): return "stmt"
    return None
pools, picked = {}, []
for sid, aid in rec.items():
    s = eng[sid]
    if not OK.match(s) or "  " in s: continue
    w = s.split()
    if norm(s) in ours: picked.append((sid, aid, s, kind(s) or "stmt", True)); continue
    if not 3 <= len(w) <= 9 or any(x[0].isupper() for x in w[1:] if x not in ("I", "I'm", "I'll", "I've", "I'd")): continue  # no names
    k = kind(s)
    if k: pools.setdefault(k, []).append((sid, aid, s, k, False))
random.seed(7)
quota = {"stmt": 0.30, "wh": 0.18, "yn": 0.20, "excl": 0.10, "tag": 0.12, "choice": 0.10}
have = {norm(p[2]) for p in picked}
for k, q in quota.items():
    cand = pools.get(k, []); random.shuffle(cand)
    for c in cand[: int(N * q)]:
        if norm(c[2]) not in have: picked.append(c); have.add(norm(c[2]))
json.dump([{"sid": a, "aid": b, "text": c, "kind": d, "authored": e} for a, b, c, d, e in picked], open(out_path, "w"), indent=0)
from collections import Counter
print(len(picked), "sentences", Counter(p[3] for p in picked), "| pool sizes", {k: len(v) for k, v in pools.items()})
