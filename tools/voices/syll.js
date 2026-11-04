// Turn Kokoro's per-phoneme durations into time spans for the app's syllables.
// meta = { ph, chars, dur, hop } from tts.py; item = coach item (its contour.syls).
const VOWEL = new Set([..."aeiouæɑɐɒəɚɛɜɝɪɨʊʉʌɔᵻɘɵøœɤɯyʏᵊ"]);
const DIPH = new Set(["aɪ", "eɪ", "oʊ", "aʊ", "ɔɪ", "əʊ"]);
const STRESS = new Set(["ˈ", "ˌ"]);
const SEP = new Set([" ", ",", ".", "?", "!", ";", ":", "…", "—", "-", "\"", "“", "”"]);

// Kokoro's audio runs ~75 ms ahead of its predicted durations (measured over all 948 takes).
const LEAD = -0.075;
function charTimes(meta) { // token i+1 <-> chars[i]; dur[0] = lead-in pad
  const t = []; let acc = meta.dur[0] * meta.hop + LEAD;
  meta.chars.forEach((c, i) => { const d = (meta.dur[i + 1] || 0) * meta.hop; t.push([acc, acc + d]); acc += d; });
  return t;
}

// Vowel nuclei over the whole phrase: [first char, last char]. Long marks join their vowel,
// diphthongs are one nucleus, any other adjacent vowels are separate syllables (go-ing, i-de-a).
function nuclei(ch) {
  const out = [];
  for (let i = 0; i < ch.length; i++) {
    const syllabic = ch[i + 1] === "̩";
    if (!VOWEL.has(ch[i]) && !syllabic) continue;
    let j = i;
    if (syllabic) j = i + 1;
    else {
      if (ch[j + 1] === "ː") j++;
      if (VOWEL.has(ch[j + 1]) && DIPH.has(ch[i] + ch[j + 1])) { j++; if (ch[j + 1] === "ː") j++; }
      else if (ch[j + 1] === "ɚ" && ch[i] !== "ɚ" && false) j++;
    }
    out.push([i, j]);
    i = j;
  }
  return out;
}

function sylSpans(meta, item) {
  const ch = meta.chars, T = charTimes(meta);
  const nuc = nuclei(ch);
  // boundary char index between consecutive nuclei
  const bounds = [];
  for (let q = 1; q < nuc.length; q++) {
    const lo = nuc[q - 1][1] + 1, hi = nuc[q][0];
    let b = -1;
    for (let k = lo; k < hi; k++) if (SEP.has(ch[k])) { b = k + 1; break; }           // word / phrase boundary
    if (b < 0) for (let k = lo; k < hi; k++) if (STRESS.has(ch[k])) { b = k; break; } // stress mark = syllable onset
    if (b < 0) b = hi - lo >= 1 ? hi - 1 : hi;                                         // maximal onset (1 consonant)
    bounds.push(b);
  }
  // first/last real chars
  let first = 0; while (first < ch.length && SEP.has(ch[first])) first++;
  let last = ch.length - 1; while (last > 0 && SEP.has(ch[last])) last--;
  const edges = [first, ...bounds, last + 1];
  const tAt = (k) => (k <= last ? T[k][0] : T[last][1]);
  const segs = nuc.map((_, q) => {
    let a = edges[q], b = edges[q + 1];
    // don't let a syllable span a pause: stop at the separator before the boundary
    let e = b; while (e - 1 > a && SEP.has(ch[e - 1])) e--;
    return { a: tAt(a), b: e - 1 >= a ? T[e - 1][1] : tAt(b) };
  });

  const exp = item.contour.syls;
  if (segs.length === exp.length) return { spans: segs, warn: null };
  // counts differ (e.g. "hour" = 1 syllable in the app, 2 vowels here): monotone alignment by position,
  // merging or splitting neighbours
  const warn = `syllables ${segs.length}/${exp.length}`;
  const a0 = segs[0].a, b0 = segs[segs.length - 1].b;
  const tot = exp.reduce((s, x) => s + x.dur, 0);
  let acc = 0;
  const expPos = exp.map((x) => { const c = (acc + x.dur / 2) / tot; acc += x.dur; return c; });
  const segPos = segs.map((s) => ((s.a + s.b) / 2 - a0) / (b0 - a0 || 1));
  const owner = expPos.map((p) => { let k = 0; segPos.forEach((q, i) => { if (Math.abs(q - p) < Math.abs(segPos[k] - p)) k = i; }); return k; });
  const out = [];
  exp.forEach((_, j) => {
    const k = owner[j], same = owner.map((o, jj) => [o, jj]).filter(([o]) => o === k).map(([, jj]) => jj);
    const s = segs[k], idx = same.indexOf(j), n = same.length;
    out.push({ a: s.a + ((s.b - s.a) * idx) / n, b: s.a + ((s.b - s.a) * (idx + 1)) / n });
  });
  for (let j = 1; j < out.length; j++) if (out[j].a < out[j - 1].b) out[j].a = out[j - 1].b;
  return { spans: out, warn };
}

module.exports = { sylSpans, charTimes, nuclei };
