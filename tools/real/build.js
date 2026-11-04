// Step 4: turn human recordings into Lilt "mirror" items.
// For each sentence: align the human recording to Kokoro's reading of the same text (whose syllable
// timings are known), measure the speaker's main stress and tune, and store their pitch curve as the target.
// usage: node build.js <work dir> <mp3 dir>
const fs = require("fs"), path = require("path"), cp = require("child_process");
const { readWav, root } = require("../voices/load");
const { sylSpans } = require("../voices/syll");
const [work, mp3dir] = process.argv.slice(2);
const items = JSON.parse(fs.readFileSync(path.join(work, "items.json"), "utf8"));
const outDir = path.join(root, "audio", "real");
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(path.join(work, "human"), { recursive: true });
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);

function classifyTune(st) { // st: voiced semitone values from the nucleus to the end
  const n = st.length;
  if (n < 6) return null;
  const k = Math.max(2, Math.floor(n * 0.15));
  const head = mean(st.slice(0, k)), end = mean(st.slice(n - k));
  let mn = Infinity, mx = -Infinity, imn = 0, imx = 0;
  st.forEach((v, i) => { if (v < mn) { mn = v; imn = i; } if (v > mx) { mx = v; imx = i; } });
  const pmn = imn / (n - 1), pmx = imx / (n - 1);
  const early = st.slice(0, Math.max(2, Math.ceil(n * 0.35)));
  const earlyMax = Math.max(...early);
  // the phrase ends high: a rise, or a fall-rise if there was a big fall from the main stress first
  if (end - mn >= 2.5 && end >= mx - 1.5) return earlyMax - mn >= 4 && pmn > 0.25 && pmn < 0.85 ? "fallrise" : "rise";
  // a clear swoop up inside the main stress, then a steep drop
  if (mx - head >= 4 && pmx > 0.1 && pmx < 0.45 && mx - end >= 6) return "risefall";
  if (mx - end >= 2 || head - end >= 1.5) return "fall";
  return end > head + 1 ? "rise" : "fall";
}

// keep every syllable at least 40 ms long, borrowing from its neighbours
function widen(syl) {
  const s = syl.map((p) => ({ ...p }));
  for (let j = 0; j < s.length; j++) {
    const need = 0.04 - (s[j].b - s[j].a);
    if (need <= 0) continue;
    if (j + 1 < s.length && s[j + 1].b - s[j + 1].a > 0.04 + need / 2) { s[j].b += need / 2; s[j + 1].a = s[j].b; }
    else s[j].b += need / 2;
    if (j > 0 && s[j - 1].b - s[j - 1].a > 0.04 + need / 2) { s[j].a -= need / 2; s[j - 1].b = s[j].a; }
    else s[j].a -= need / 2;
  }
  return s;
}

// sentences with errors in the source text (the recording may not match what is written)
const BLOCK = new Set(["6244187"]); // "What do you think we should about that?"
const out = [], rejected = [], stats = {};
for (const it of items) {
  const mp3 = path.join(mp3dir, it.aid + ".mp3");
  const ttsWav = path.join(work, "raw", "f", it.file + ".wav");
  if (!fs.existsSync(mp3) || !fs.existsSync(ttsWav)) continue;
  if (BLOCK.has(it.sid)) continue;
  const hw = path.join(work, "human", it.aid + ".wav");
  if (!fs.existsSync(hw)) cp.execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", mp3, "-ac", "1", "-ar", "24000", hw]);
  const H = readWav(hw), T = readWav(ttsWav);
  const tm = JSON.parse(fs.readFileSync(ttsWav.replace(/\.wav$/, ".json"), "utf8"));
  const words0 = Prosody.parse(it.markup);
  const item0 = { kind: "sentence", contour: Prosody.contour(words0, "fall") };
  const reject = (why) => rejected.push(`${it.text} :: ${why}`);
  const ttsSyl = sylSpans(tm, item0).spans;
  const syl0 = Align.userSyllables(H.x, H.sr, { samples: T.x, sr: T.sr, syl: ttsSyl });
  if (!syl0) { reject("alignment failed"); continue; }
  const syl = widen(syl0);
  const r = Analyze.analyze(H.x, H.sr, item0, { syl });
  if (r.error) { reject("analysis: " + r.error); continue; }
  const x = r.x, exp = item0.contour.syls;
  // sanity: the syllables should cover the speech, and most should be voiced
  const voicedSyl = r.det.filter((d) => d.voiced >= 2).length / exp.length;
  const off = [syl[0].a - x.t0, syl[syl.length - 1].b - x.t1];
  if (Math.abs(off[0]) > 0.35 || Math.abs(off[1]) > 0.5) { reject(`alignment off the speech span (${off.map((v) => v.toFixed(2))})`); continue; }
  if (voicedSyl < 0.6) { reject(`only ${Math.round(voicedSyl * 100)}% voiced syllables`); continue; }

  // main stress: the most prominent lexically stressed syllable; the default (last stress) wins near-ties
  const prom = new Map(r.det.map((d) => [d.exp, d.prom]));
  const S = exp.map((s, j) => j).filter((j) => exp[j].stress);
  if (!S.length) { reject("no stressed syllable"); continue; }
  const best = S.reduce((a, j) => ((prom.get(j) ?? -9) > (prom.get(a) ?? -9) ? j : a), S[0]);
  const last = S[S.length - 1];
  const nuc = (prom.get(last) ?? -9) >= (prom.get(best) ?? -9) - 0.35 ? last : best;
  // tune: pitch from the main stress to the end
  const seg = []; for (let f = Math.round(syl[nuc].a * 100); f <= Math.round(syl[syl.length - 1].b * 100); f++) if (x.st[f] != null) seg.push(x.st[f]);
  const tune = classifyTune(seg);
  if (!tune) { reject("no pitch after the main stress"); continue; }

  // final markup with the nucleus
  let g = 0;
  const markup = words0.map((w) => w.syls.map((s) => { const m = g === nuc ? "*" : s.stress ? "'" : ""; g++; return m + s.t; }).join("-")).join(" ");
  // the speaker's pitch per syllable (semitones re. their median), times relative to the first syllable
  const z0 = syl[0].a;
  const pts = syl.map((p) => {
    const v = []; for (let f = Math.round(p.a * 100); f <= Math.round(p.b * 100); f++) if (x.st[f] != null) v.push([f / 100, x.st[f]]);
    const step = Math.max(1, Math.ceil(v.length / 8));
    return v.filter((_, i) => i % step === 0 || i === v.length - 1).map(([t, s]) => [+(t - z0).toFixed(3), +s.toFixed(1)]);
  });
  fs.copyFileSync(mp3, path.join(outDir, it.aid + ".mp3")); // unmodified (licence: no derivatives)
  const span = Math.max(...x.st.filter((v) => v != null)) - Math.min(...x.st.filter((v) => v != null));
  out.push({ id: it.id, sid: it.sid, aid: it.aid, text: it.text, type: it.type, markup, tune,
    t0: +x.t0.toFixed(3), syl: syl.map((p) => [+p.a.toFixed(3), +p.b.toFixed(3)]), pts,
    // the speaker's stress profile (prominence per syllable) and pitch span, for mirror scoring
    prom: exp.map((_, j) => (prom.has(j) ? +prom.get(j).toFixed(2) : null)), span: +span.toFixed(1) });
  (stats[it.type] ||= {})[tune] = ((stats[it.type] || {})[tune] || 0) + 1;
}
fs.writeFileSync(path.join(root, "audio", "real.json"), JSON.stringify({
  source: "Tatoeba (tatoeba.org), recordings by user CK",
  license: "CC BY-NC-ND 3.0 (https://creativecommons.org/licenses/by-nc-nd/3.0/)", items: out,
}));
fs.writeFileSync(path.join(work, "rejected.txt"), rejected.join("\n"));
console.log("kept", out.length, "| rejected", rejected.length);
console.log("tune by sentence type:", JSON.stringify(stats));
