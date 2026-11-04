// Step 3: for every raw take, try the natural version plus several prosody corrections,
// score each with Lilt's own analyzer, keep the best, encode MP3 -> audio/<voice>/<file>.mp3
// usage: node build.js <work dir>
const fs = require("fs"), path = require("path"), cp = require("child_process");
const { readWav, writeWav, root } = require("./load");
const { sylSpans } = require("./syll");
const work = process.argv[2] || path.join(__dirname, "work");
const items = JSON.parse(fs.readFileSync(path.join(work, "items.json"), "utf8"));
const byId = new Map(Coach.allItems().map((it) => [it.id, it]));
const VOICES = { f: "af_heart", m: "am_michael" };
const CANDIDATES = [
  { name: "natural", cost: 0 },
  { name: "fix 0.8", cost: 2, amount: 0.8, micro: 1 },
  { name: "fix 1.0", cost: 3, amount: 1.0, micro: 1 },
  { name: "fix 1.25", cost: 5, amount: 1.25, micro: 0.8 },
];

function pad(x, sr, s = 0.2) {
  const n = Math.round(sr * s), y = new Float32Array(x.length + 2 * n);
  for (let i = 0; i < y.length; i++) y[i] = (Math.random() - 0.5) * 0.0005; // faint noise floor, like a real mic
  y.set(x.map((v, i) => v + y[n + i]), n);
  return y;
}
const PAD = 0.2;
function quality(r, item) {
  if (r.error) return { score: 0, dims: {} };
  const d = r.dims, keys = item.kind === "word" ? ["wordstress"] : ["melody", "focus", "range", "rhythm"];
  const vals = keys.filter((k) => d[k] && d[k].score != null).map((k) => d[k].score);
  if (!vals.length) return { score: 0, dims: d };
  // the weakest dimension matters most: a model must not get anything badly wrong
  const score = 0.6 * (vals.reduce((a, b) => a + b, 0) / vals.length) + 0.4 * Math.min(...vals);
  return { score, dims: d };
}

const manifest = { v: 2, voices: VOICES, items: {} };
const warnings = [];
const report = [];
for (const [vk] of Object.entries(VOICES)) {
  const out = path.join(root, "audio", vk);
  fs.mkdirSync(out, { recursive: true });
  for (const meta of items) {
    const item = byId.get(meta.id);
    const raw = path.join(work, "raw", vk, meta.file + ".wav");
    if (!item || !fs.existsSync(raw)) continue;
    const { x, sr } = readWav(raw);
    const tm = JSON.parse(fs.readFileSync(raw.replace(/\.wav$/, ".json"), "utf8"));
    const map = sylSpans(tm, item);
    if (map.warn) warnings.push(`${vk} ${meta.text} ${tm.ph} :: ${map.warn}`);
    const spans0 = map.spans.map((p) => ({ a: p.a + PAD, b: p.b + PAD }));
    const base = pad(x, sr, PAD);
    const r0 = Analyze.analyze(base, sr, item, { syl: spans0 });
    let best = null;
    for (const c of CANDIDATES) {
      let y = base, spans = spans0;
      if (c.amount != null) {
        if (r0.error) continue;
        y = Resynth.fix(base, sr, r0, item, { amount: c.amount, micro: c.micro });
        const pl = Resynth.plan(r0, item, c.amount, c.micro);
        spans = spans0.map((p) => ({ a: pl.inToOut(p.a), b: pl.inToOut(p.b) }));
      }
      const q = quality(Analyze.analyze(y, sr, item, { syl: spans }), item);
      const val = q.score - c.cost;
      if (!best || val > best.val) best = { val, q, c, y, spans };
      if (c.name === "natural" && q.score >= 92) break; // already ideal: keep it untouched
    }
    // trim to speech + 80 ms, normalise peak
    const y = best.y; let a = 0, b = y.length - 1, pk = 0;
    for (let i = 0; i < y.length; i++) pk = Math.max(pk, Math.abs(y[i]));
    const thr = pk * 0.02;
    while (a < b && Math.abs(y[a]) < thr) a++; while (b > a && Math.abs(y[b]) < thr) b--;
    a = Math.max(0, a - Math.round(sr * 0.08)); b = Math.min(y.length, b + Math.round(sr * 0.12));
    const z = y.slice(a, b).map((v) => (v / (pk || 1)) * 0.89);
    const off = a / sr, syl = best.spans.map((p) => [+(p.a - off).toFixed(3), +(p.b - off).toFixed(3)]);
    const xz = Analyze.extract(z, sr);
    fs.mkdirSync(path.join(work, "final", vk), { recursive: true });
    const tmp = path.join(work, "final", vk, meta.file + ".wav");
    writeWav(tmp, z, sr);
    fs.writeFileSync(tmp.replace(/\.wav$/, ".json"), JSON.stringify({ syl }));
    cp.execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", tmp, "-ac", "1", "-ar", "24000", "-b:a", "40k", path.join(out, meta.file + ".mp3")]);
    const e = (manifest.items[meta.id] ||= { file: meta.file });
    e[vk] = { q: Math.round(best.q.score), t0: xz ? +xz.t0.toFixed(3) : 0, syl };
    report.push({ v: vk, id: meta.id, text: meta.text, how: best.c.name, score: Math.round(best.q.score),
      dims: Object.fromEntries(Object.entries(best.q.dims).map(([k, d]) => [k, d && d.score])) });
  }
}
fs.writeFileSync(path.join(root, "audio", "manifest.json"), JSON.stringify(manifest));
fs.writeFileSync(path.join(work, "report.json"), JSON.stringify(report, null, 1));
const s = report.map((r) => r.score).sort((a, b) => a - b);
const how = {}; report.forEach((r) => (how[r.how] = (how[r.how] || 0) + 1));
fs.writeFileSync(path.join(work, "warnings.txt"), warnings.join("\n"));
console.log("syllable-count mismatches:", warnings.length);
console.log("takes", report.length, "| median score", s[s.length >> 1], "| <70:", s.filter((v) => v < 70).length, "| chosen:", JSON.stringify(how));
