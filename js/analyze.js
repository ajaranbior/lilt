// Offline analysis of a recorded utterance: pitch, intensity, syllable nuclei,
// alignment to the expected syllables, and per-skill assessment with feedback.
(function () {
  const A = {};
  const SR = 16000, HOP = 160; // 10 ms frames
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const pct = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
  const median = (a) => pct(a, 0.5);
  const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))) || 1; };

  A.resample = function (x, sr) {
    if (sr === SR) return x;
    const ratio = sr / SR, win = Math.max(1, Math.round(ratio));
    const sm = new Float32Array(x.length);
    let acc = 0;
    for (let i = 0; i < x.length; i++) { acc += x[i]; if (i >= win) acc -= x[i - win]; sm[i] = acc / Math.min(i + 1, win); }
    const n = Math.floor(x.length / ratio), y = new Float32Array(n);
    for (let i = 0; i < n; i++) { const p = i * ratio, j = Math.floor(p), f = p - j; y[i] = sm[j] * (1 - f) + (sm[j + 1] || 0) * f; }
    return y;
  };

  // McLeod NSDF pitch on an 800-sample (50 ms) window at 16 kHz.
  function pitchAt(x, c) {
    const N = 800, s0 = c - N / 2;
    if (s0 < 0 || s0 + N > x.length) return { hz: 0, cl: 0 };
    const minLag = Math.floor(SR / 450), maxLag = Math.floor(SR / 65), W = N - maxLag;
    const nsdf = new Float32Array(maxLag + 2);
    for (let tau = minLag; tau <= maxLag; tau++) {
      let ac = 0, m = 0;
      for (let i = 0; i < W; i++) { const a = x[s0 + i], b = x[s0 + i + tau]; ac += a * b; m += a * a + b * b; }
      nsdf[tau] = m > 0 ? (2 * ac) / m : 0;
    }
    const peaks = [];
    let pos = false, best = -1, bt = -1;
    for (let tau = minLag + 1; tau < maxLag; tau++) {
      if (!pos && nsdf[tau] > 0 && nsdf[tau - 1] <= 0) { pos = true; best = -1; }
      if (pos) {
        if (nsdf[tau] > best) { best = nsdf[tau]; bt = tau; }
        if (nsdf[tau] <= 0) { peaks.push([bt, best]); pos = false; }
      }
    }
    if (pos && bt > 0) peaks.push([bt, best]);
    if (!peaks.length) return { hz: 0, cl: 0 };
    const top = Math.max(...peaks.map((p) => p[1]));
    const [tau] = peaks.find((p) => p[1] >= 0.88 * top);
    const a = nsdf[tau - 1], b = nsdf[tau], cc = nsdf[tau + 1];
    const den = a - 2 * b + cc, sh = den ? (a - cc) / (2 * den) : 0;
    return { hz: SR / (tau + (Math.abs(sh) < 1 ? sh : 0)), cl: top };
  }

  // Live (per animation frame) pitch for the recording display.
  A.livePitch = function (buf, sr) {
    let e = 0; for (let i = 0; i < buf.length; i++) e += buf[i] * buf[i];
    const rms = Math.sqrt(e / buf.length);
    const x = A.resample(buf, sr);
    const r = pitchAt(x, x.length >> 1);
    return { hz: r.cl >= 0.6 ? r.hz : 0, rms };
  };

  // ---------- low level: frames, pitch, nuclei ----------
  A.extract = function (samples, sr) {
    const x = A.resample(samples, sr);
    const nF = Math.floor((x.length - 400) / HOP);
    if (nF < 20) return null;
    const dB = new Float32Array(nF);
    for (let f = 0; f < nF; f++) {
      let e = 0; const s = f * HOP;
      for (let i = 0; i < 400; i++) e += x[s + i] * x[s + i];
      dB[f] = 10 * Math.log10(e / 400 + 1e-12);
    }
    const all = Array.from(dB);
    const p99 = pct(all, 0.99), floor = pct(all, 0.1);
    const thr = Math.max(p99 - 30, floor + 6);
    if (p99 - floor < 10 && p99 < -45) return null; // nothing above the noise
    // speech span: first/last run of >=5 frames above threshold
    let s = -1, e = -1;
    for (let f = 0, run = 0; f < nF; f++) { run = dB[f] > thr ? run + 1 : 0; if (run >= 5) { if (s < 0) s = f - 4; e = f; } }
    if (s < 0) return null;
    s = Math.max(0, s - 3); e = Math.min(nF - 1, e + 3);

    // pitch
    const raw = new Float32Array(nF), cand = new Float32Array(nF), cla = new Float32Array(nF);
    for (let f = s; f <= e; f++) {
      if (dB[f] < thr - 6) continue;
      const r = pitchAt(x, f * HOP + 200);
      cand[f] = r.hz; cla[f] = r.cl;
      if (r.cl >= 0.5 && r.hz > 0 && dB[f] >= thr) raw[f] = r.hz;
    }
    // Continue confident pitch tracks into weaker frames (creaky or quiet phrase endings) as long
    // as the pitch stays continuous; creak often reads as half the real frequency.
    const near = (h, ref) => {
      if (!h) return 0;
      for (const k of [1, 2, 0.5]) { const v = h * k; if (Math.abs(Math.log2(v / ref)) < 0.2) return v; }
      return 0;
    };
    for (let pass = 0; pass < 2; pass++) {
      for (let f = s + 1; f <= e; f++) if (!raw[f] && raw[f - 1] && cla[f] >= 0.25) raw[f] = near(cand[f], raw[f - 1]);
      for (let f = e - 1; f >= s; f--) if (!raw[f] && raw[f + 1] && cla[f] >= 0.25) raw[f] = near(cand[f], raw[f + 1]);
    }
    const voicedHz = Array.from(raw).filter((h) => h > 0);
    if (voicedHz.length < 8) return null;
    const med0 = median(voicedHz);
    for (let f = s; f <= e; f++) {
      let h = raw[f]; if (!h) continue;
      if (h > med0 * 1.8) h /= 2; else if (h < med0 * 0.58) h *= 2;
      raw[f] = h > med0 * 0.5 && h < med0 * 2 ? h : 0;
    }
    // median filter + drop short voiced runs
    const hz = new Float32Array(nF);
    for (let f = s; f <= e; f++) {
      if (!raw[f]) continue;
      const w = []; for (let k = f - 2; k <= f + 2; k++) if (raw[k] > 0) w.push(raw[k]);
      hz[f] = median(w);
    }
    for (let f = s; f <= e;) {
      if (!hz[f]) { f++; continue; }
      let g = f; while (g <= e && hz[g]) g++;
      if (g - f < 4) for (let k = f; k < g; k++) hz[k] = 0;
      f = g;
    }
    const vHz = Array.from(hz).filter((h) => h > 0);
    if (vHz.length < 8) return null;
    const med = median(vHz);
    const st = Array.from(hz, (h) => (h > 0 ? 12 * Math.log2(h / med) : null));

    // smoothed intensity
    const I = new Float32Array(nF);
    for (let f = 0; f < nF; f++) { let a = 0, c = 0; for (let k = f - 2; k <= f + 2; k++) if (k >= 0 && k < nF) { a += dB[k]; c++; } I[f] = a / c; }

    // syllable nuclei: intensity peaks, voiced, >=2 dB dips between them
    const pthr = Math.max(thr, p99 - 25);
    let peaks = [];
    for (let f = s + 1; f < e; f++) {
      if (I[f] >= I[f - 1] && I[f] > I[f + 1] && I[f] > pthr) {
        let voiced = false; for (let k = f - 4; k <= f + 4; k++) if (hz[k] > 0) voiced = true;
        if (voiced) peaks.push(f);
      }
    }
    let changed = true;
    while (changed && peaks.length > 1) {
      changed = false;
      for (let i = 0; i < peaks.length - 1; i++) {
        const a = peaks[i], b = peaks[i + 1];
        let dip = Infinity; for (let k = a; k <= b; k++) dip = Math.min(dip, I[k]);
        if (Math.min(I[a], I[b]) - dip < 2 || b - a < 8) {
          peaks.splice(I[a] >= I[b] ? i + 1 : i, 1); changed = true; break;
        }
      }
    }
    if (!peaks.length) return null;
    // syllable intervals at intensity minima between peaks
    let v0 = s, v1 = e; while (v0 < e && !hz[v0]) v0++; while (v1 > v0 && !hz[v1]) v1--;
    const bounds = [Math.max(s, v0 - 6)];
    for (let i = 0; i < peaks.length - 1; i++) {
      let m = peaks[i]; for (let k = peaks[i]; k <= peaks[i + 1]; k++) if (I[k] < I[m]) m = k;
      bounds.push(m);
    }
    bounds.push(Math.min(e, v1 + 8));
    const nuclei = peaks.map((p, i) => {
      const a = bounds[i], b = bounds[i + 1];
      const sts = []; for (let k = a; k <= b; k++) if (st[k] != null) sts.push(st[k]);
      return {
        f: p, t: p / 100, a: a / 100, b: b / 100, dur: (b - a) / 100, dB: I[p],
        stMax: sts.length ? Math.max(...sts) : 0, stMin: sts.length ? Math.min(...sts) : 0, voiced: sts.length,
      };
    });
    // speech timing reference = the voiced part (clicks, breaths and trailing noise are unvoiced)
    return { nF, s, e, t0: v0 / 100, t1: v1 / 100, dB, I, hz, st, med, nuclei: nuclei.filter((n) => n.voiced >= 3), thr };
  };

  // ---------- alignment of detected nuclei to expected syllables ----------
  // Neutral timing model (independent of where the focus is supposed to be),
  // positions normalized over the whole speech span.
  function align(det, exp, t0, t1) {
    const n = exp.length, k = det.length;
    const durs = exp.map((s, i) => (s.stress ? 0.22 : 0.13) + (i === n - 1 ? 0.08 : 0));
    const tot = durs.reduce((a, b) => a + b, 0);
    let acc = 0;
    const ce = durs.map((d) => { const c = acc + d / 2; acc += d; return c; });
    const pe = ce.map((c) => c / tot);
    const pd0 = det.map((d) => (d.t - t0) / (t1 - t0 || 1));
    // try small shifts/stretches of the speaker's timing and keep the best fit
    let best = null;
    for (let off = -0.12; off <= 0.121; off += 0.04) for (let sc = 0.8; sc <= 1.251; sc += 0.075) {
      const pd = pd0.map((p) => 0.5 + (p - 0.5) * sc + off);
      const r = dp(pd, pe, exp);
      if (!best || r.cost < best.cost) best = r;
    }
    return best.map;
  }

  function dp(pd, pe, exp) {
    const k = pd.length, n = pe.length;
    const skipE = (j) => (exp[j].stress ? 2.5 : 0.6), skipD = 2;
    const D = Array.from({ length: k + 1 }, () => new Float32Array(n + 1).fill(Infinity));
    const B = Array.from({ length: k + 1 }, () => new Int8Array(n + 1));
    D[0][0] = 0;
    for (let i = 0; i <= k; i++) for (let j = 0; j <= n; j++) {
      if (i && j) { const c = D[i - 1][j - 1] + Math.abs(pd[i - 1] - pe[j - 1]) * 4; if (c < D[i][j]) { D[i][j] = c; B[i][j] = 1; } }
      if (j) { const c = D[i][j - 1] + skipE(j - 1); if (c < D[i][j]) { D[i][j] = c; B[i][j] = 2; } }
      if (i) { const c = D[i - 1][j] + skipD; if (c < D[i][j]) { D[i][j] = c; B[i][j] = 3; } }
    }
    const map = new Array(k).fill(-1);
    for (let i = k, j = n; i || j;) {
      const b = B[i][j];
      if (b === 1) { map[i - 1] = j - 1; i--; j--; } else if (b === 2) j--; else i--;
    }
    return { map, cost: D[k][n] };
  }

  function prominence(nuclei, med) {
    const k = nuclei.length;
    if (k === 1) return [1];
    const last = k - 1;
    const fdB = nuclei.map((n) => n.dB);
    const fDur = nuclei.map((n, i) => n.dur * (i === last ? 0.85 : 1));
    const fP = nuclei.map((n) => n.stMax + 0.5 * (n.stMax - n.stMin));
    const z = (a) => { const m = mean(a), s = sd(a); return a.map((x) => (x - m) / s); };
    const a = z(fdB), b = z(fDur), c = z(fP);
    return nuclei.map((_, i) => 0.35 * a[i] + 0.3 * b[i] + 0.35 * c[i]);
  }

  // Where in the word is the prominence peak? Frame-level loudness + pitch, mapped onto
  // equal-length syllable slots. Used when syllable nuclei can't be counted reliably.
  function framePeakSyllable(x, n) {
    const fr = []; for (let f = x.s; f <= x.e; f++) if (x.st[f] != null) fr.push(f);
    if (fr.length < 5) return -1;
    const zi = fr.map((f) => x.I[f]), zp = fr.map((f) => x.st[f]);
    const mi = mean(zi), si = sd(zi), mp = mean(zp), sp = sd(zp);
    const sc = fr.map((f, i) => (zi[i] - mi) / si + (zp[i] - mp) / sp);
    // smooth and take the centre of the best 60 ms
    let best = -Infinity, bf = fr[0];
    for (let i = 0; i < fr.length; i++) { let a = 0, c = 0; for (let k = i - 3; k <= i + 3; k++) if (sc[k] != null) { a += sc[k]; c++; } if (a / c > best) { best = a / c; bf = fr[i]; } }
    // voiced region of the word (ignore leading/trailing unvoiced consonants)
    const a = fr[0], b = fr[fr.length - 1];
    return Math.min(n - 1, Math.max(0, Math.floor(((bf - a) / (b - a || 1)) * n)));
  }

  // Force-split the voiced span into exactly n syllables at the deepest loudness dips
  // (unvoiced consonants count as extra-deep). Fluent speech often has no clear dip between
  // syllables joined by n, l, m, r, so peak-counting alone under-counts them.
  A.cfg = { wordForced: "mismatch" };
  A._forced = (x, n) => forcedSegments(x, n);
  function forcedSegments(x, n) {
    let v0 = x.s, v1 = x.e; while (v0 < x.e && !x.hz[v0]) v0++; while (v1 > v0 && !x.hz[v1]) v1--;
    const a0 = Math.max(x.s, v0 - 3), b0 = Math.min(x.e, v1 + 5);
    if (b0 - a0 < n * 5) return null;
    const I = x.I, cands = [];
    for (let f = a0 + 4; f <= b0 - 4; f++) {
      if (!(I[f] <= I[f - 1] && I[f] <= I[f + 1])) continue;
      let l = -Infinity, r = -Infinity;
      for (let k = Math.max(a0, f - 15); k < f; k++) l = Math.max(l, I[k]);
      for (let k = f + 1; k <= Math.min(b0, f + 15); k++) r = Math.max(r, I[k]);
      let unv = 0; for (let k = f - 2; k <= f + 2; k++) if (!x.hz[k]) unv++;
      cands.push({ f, depth: Math.min(l, r) - I[f] + (unv >= 2 ? 4 : 0) });
    }
    cands.sort((p, q) => q.depth - p.depth);
    const cuts = [];
    for (const c of cands) {
      if (cuts.length >= n - 1) break;
      if (c.f - a0 < 5 || b0 - c.f < 5 || cuts.some((u) => Math.abs(u - c.f) < 6)) continue;
      cuts.push(c.f);
    }
    let bounds = [a0, ...cuts.sort((p, q) => p - q), b0];
    while (bounds.length - 1 < n) { // not enough dips: split the longest segment
      let w = 0; for (let i = 1; i < bounds.length - 1; i++) if (bounds[i + 1] - bounds[i] > bounds[w + 1] - bounds[w]) w = i;
      bounds.splice(w + 1, 0, Math.round((bounds[w] + bounds[w + 1]) / 2));
    }
    return bounds.slice(0, -1).map((a, i) => {
      const b = bounds[i + 1];
      const sts = []; let pk = -Infinity, pf = a;
      for (let k = a; k <= b; k++) { if (x.st[k] != null) sts.push(x.st[k]); if (I[k] > pk) { pk = I[k]; pf = k; } }
      return { a: a / 100, b: b / 100, t: pf / 100, dur: (b - a) / 100, dB: pk, voiced: sts.length,
        stMax: sts.length ? Math.max(...sts) : 0, stMin: sts.length ? Math.min(...sts) : 0 };
    });
  }

  // ---------- full analysis against an item ----------
  // item: { kind: 'word'|'sentence', contour, words, tune, stressIdx (word), focusWord }
  // Syllable segment measured over a known time span [a, b] (seconds).
  function segment(x, a, b, j) {
    const fa = Math.max(0, Math.round(a * 100)), fb = Math.min(x.nF - 1, Math.round(b * 100));
    const sts = []; let pk = -Infinity, pf = fa;
    for (let k = fa; k <= fb; k++) { if (x.st[k] != null) sts.push(x.st[k]); if (x.I[k] > pk) { pk = x.I[k]; pf = k; } }
    return { a, b, t: pf / 100, dur: b - a, dB: pk, voiced: sts.length, exp: j,
      stMax: sts.length ? Math.max(...sts) : 0, stMin: sts.length ? Math.min(...sts) : 0 };
  }

  // opts.syl: known time span {a, b} of every expected syllable in this recording (from aligning
  // it to the model voice). Without it, syllables are found from loudness peaks and guessed.
  A.analyze = function (samples, sr, item, opts = {}) {
    const x = A.extract(samples, sr);
    if (!x) return { error: "I couldn't hear enough voiced speech. Speak a bit louder and closer to the mic." };
    const c = item.contour, exp = c.syls;
    const known = !!(opts.syl && opts.syl.length === exp.length);
    const det = known ? opts.syl.map((p, j) => segment(x, p.a, p.b, j)).filter((d) => d.dur >= 0.025) : x.nuclei;
    const map = known ? det.map((d) => d.exp) : align(det, exp, x.t0, x.t1);
    const prom = prominence(det, x.med);
    det.forEach((d, i) => { d.exp = map[i]; d.prom = prom[i]; d.wi = map[i] >= 0 ? exp[map[i]].wi : -1; });
    const order = det.map((_, i) => i).sort((a, b) => prom[b] - prom[a]);
    const top = det[order[0]];

    // pitch points mapped onto target time for display/correlation
    const tA = exp[0].start, tB = exp[exp.length - 1].start + exp[exp.length - 1].dur;
    // anchors: speech start/end + every matched syllable nucleus -> its target syllable centre
    const anc = known ? [] : [[x.t0, tA]];
    if (known) det.forEach((d) => { const s = exp[d.exp]; anc.push([d.a, s.start], [d.b, s.start + s.dur]); });
    else det.forEach((d) => { if (d.exp >= 0) { const s = exp[d.exp]; anc.push([d.t, s.start + s.dur / 2]); } });
    if (!known) anc.push([x.t1, tB]);
    anc.sort((a, b) => a[0] - b[0]);
    const A2 = anc.filter((p, i) => i === 0 || (p[0] > anc[i - 1][0] + 0.01 && p[1] > anc[i - 1][1]));
    const toT = (t) => {
      if (A2.length < 2) return tA + ((t - x.t0) / (x.t1 - x.t0 || 1)) * (tB - tA);
      let i = 1; while (i < A2.length - 1 && t > A2[i][0]) i++;
      const [a0, b0] = A2[i - 1], [a1, b1] = A2[i];
      return b0 + ((t - a0) / (a1 - a0 || 1)) * (b1 - b0);
    };
    const tv = []; for (let i = 0; i <= 60; i++) { const v = Prosody.valueAt(c, tA + ((tB - tA) * i) / 60); if (v != null) tv.push(v); }
    const tMed = median(tv);
    const pts = []; for (let f = x.s; f <= x.e; f++) if (x.st[f] != null) pts.push([toT(f / 100), x.st[f] + tMed, f / 100]);
    const marks = det.map((d) => ({ t: toT(d.t), prom: d.prom, top: d === top }));

    const res = { x, det, pts, marks, dims: {}, toT, tMed, known };
    const words = c.words;
    const wordText = (wi) => (wi >= 0 ? words[wi].text.replace(/[^\w'’-]/g, "") : "?");
    const nucExp = exp.findIndex((s) => s.nuc);

    // ---- range
    const vst = x.st.filter((v) => v != null);
    const span = pct(vst, 0.92) - pct(vst, 0.08);
    res.span = span;
    if (item.kind === "sentence") {
      const sc = clamp01((span - 3) / (8 - 3));
      const tvs = [...tv].sort((a, b) => a - b);
      const aimSpan = tvs[Math.floor(tvs.length * 0.92)] - tvs[Math.floor(tvs.length * 0.08)];
      const usts = pts.map((p) => p[1]).sort((a, b) => a - b);
      res.range = { you: [usts[Math.floor(usts.length * 0.08)], usts[Math.floor(usts.length * 0.92)]], aim: [tvs[Math.floor(tvs.length * 0.08)], tvs[Math.floor(tvs.length * 0.92)]] };
      const nw = wordText(exp[nucExp].wi);
      const end = { fall: "drop all the way down at the end", rise: "glide all the way up at the end", fallrise: "dip low, then curl back up", risefall: "swoop up high, then drop" }[c.tune];
      res.dims.range = { score: Math.round(sc * 100), detail: `you ${span.toFixed(1)} · aim 7+ semitones`,
        tip: sc < 0.6 ? `Your voice moved only ${span.toFixed(1)} semitones (aim for 7+, ${span < 1.5 ? "several times" : `about ${(7 / span).toFixed(1).replace(/\.0$/, "")}×`} as much). Jump clearly higher on “${nw}”, then ${end}. Think “telling exciting news”, not “reading a list”.`
          : sc < 0.9 ? `${span.toFixed(1)} semitones: close. Make the jump on “${nw}” a bit bigger.` : "" };
    }

    // ---- word stress
    if (item.kind === "word") {
      const want = item.stressIdx;
      const syls = exp.map((s) => s.t);
      let got = top.exp;
      if (!known && syls.length > 1 && (A.cfg.wordForced === "always" || det.length !== syls.length)) {
        const seg = forcedSegments(x, syls.length);
        if (seg) { const pr = prominence(seg, x.med); got = pr.indexOf(Math.max(...pr)); res.wordSegs = seg.map((g, i) => ({ ...g, prom: pr[i] })); }
        else got = framePeakSyllable(x, syls.length);
      }
      const show = (j) => syls.map((s, i) => (i === j ? s.toUpperCase() : s)).join("-");
      let score, tip = "";
      if (got === want) { score = 100; }
      else {
        const wantDet = det.findIndex((d) => d.exp === want);
        const close = det.length === syls.length && wantDet >= 0 && prom[order[0]] - prom[wantDet] < 0.3;
        score = close ? 55 : 15;
        tip = got >= 0 ? `It sounded like ${show(got)}. Aim for ${show(want)}: make “${syls[want]}” louder, longer and higher.` : `Aim for ${show(want)}: make “${syls[want]}” louder, longer and higher.`;
        if (close) tip = `Close, but not clear enough. Make “${syls[want]}” stand out more than “${syls[got] || "?"}”.`;
      }
      if (score != null) res.dims.wordstress = { score, detail: got >= 0 ? show(got) : "", tip };
    }

    // ---- focus (sentence stress)
    if (item.kind === "sentence" && words.length > 1) {
      const fw = exp[nucExp].wi;
      const wp = words.map(() => -Infinity);
      det.forEach((d) => { if (d.wi >= 0) wp[d.wi] = Math.max(wp[d.wi], d.prom); });
      let tw = 0; wp.forEach((p, i) => { if (p > wp[tw]) tw = i; });
      let score, tip = "";
      if (tw === fw) score = 100;
      else {
        const close = wp[fw] > -Infinity && wp[tw] - wp[fw] < 0.3;
        score = close ? 55 : 15;
        tip = close ? `“${wordText(fw)}” and “${wordText(tw)}” sounded equally strong. Make “${wordText(fw)}” the clear peak and say the words after it more quietly.`
          : `Your main stress landed on “${wordText(tw)}”. Put it on “${wordText(fw)}”: louder, longer, with the big pitch move there.`;
      }
      res.dims.focus = { score, detail: `peak: ${wordText(tw)}`, tip };
    }

    // ---- melody (tune after the nucleus)
    if (item.kind === "sentence") {
      let nd = det.find((d) => d.exp === nucExp);
      if (!nd) { const want = exp[nucExp].start + exp[nucExp].dur / 2; nd = det.reduce((a, d) => (Math.abs(toT(d.t) - want) < Math.abs(toT(a.t) - want) ? d : a), det[0]); }
      const seg = []; for (let f = Math.round(nd.a * 100); f <= x.e; f++) if (x.st[f] != null) seg.push(x.st[f]);
      if (seg.length < 6) res.dims.melody = { score: null, tip: `I couldn't track your pitch on “${wordText(nd.wi)}”. Keep voicing through to the end.` };
      else {
        const n = seg.length, q = Math.max(2, Math.floor(n * 0.2));
        const head = mean(seg.slice(0, q)), end = mean(seg.slice(n - q));
        const mx = Math.max(...seg), mn = Math.min(...seg);
        const imx = seg.indexOf(mx), imn = seg.indexOf(mn);
        const early = Math.max(...seg.slice(0, Math.ceil(n * 0.5)));
        let sh, dir;
        switch (c.tune) {
          case "fall": { const d = early - end, back = end - mn; sh = clamp01((d - 1) / 4) * (back > 2 ? 0.4 : 1); dir = d > 1 ? (back > 2 ? "fell then rose" : "fell") : end - head > 1 ? "rose" : "stayed flat"; break; }
          case "rise": { const u = end - Math.min(...seg.slice(0, n - q)); sh = clamp01((u - 1) / 4); dir = u > 1 ? "rose" : head - end > 1 ? "fell" : "stayed flat"; break; }
          case "fallrise": { const dn = Math.max(...seg.slice(0, imn + 1)) - mn, up = end - mn; sh = imn > n - 2 ? 0 : clamp01((Math.min(dn, up) - 0.5) / 2.5); dir = sh > 0.4 ? "fell then rose" : end > head ? "only rose" : "only fell"; break; }
          case "risefall": { const up = mx - head, dn = mx - end; sh = imx > n - 3 ? 0 : clamp01((Math.min(up, dn) - 0.5) / 3); dir = sh > 0.4 ? "rose then fell" : end < head ? "only fell" : "only rose"; break; }
        }
        // whole-contour correlation
        const pairs = []; pts.forEach(([t, s]) => { const v = Prosody.valueAt(c, t); if (v != null) pairs.push([v, s]); });
        let r = 0;
        if (pairs.length > 6) {
          const xs = pairs.map((p) => p[0]), ys = pairs.map((p) => p[1]), mx2 = mean(xs), my = mean(ys);
          let sxy = 0, sxx = 0, syy = 0;
          for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx2) * (ys[i] - my); sxx += (xs[i] - mx2) ** 2; syy += (ys[i] - my) ** 2; }
          r = sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
        }
        const score = Math.round((0.7 * sh + 0.3 * Math.max(0, r)) * 100);
        const ti = TUNE_INFO[c.tune];
        const want = { fall: "fall clearly", rise: "rise at the end", fallrise: "fall, then rise again at the very end", risefall: "go up and then fall steeply" }[c.tune];
        res.dims.melody = { score, detail: `${ti.sym} you ${dir}`,
          tip: sh < 0.6 ? (({ fall: "fell", rise: "rose", fallrise: "fell then rose", risefall: "rose then fell" })[c.tune] === dir ? `Right direction, but too small. From “${wordText(nd.wi)}” onward, make it a big, obvious ${ti.name.toLowerCase()}: ${want}.` : `From “${wordText(nd.wi)}” onward your pitch ${dir}. It should ${want} (${ti.name.toLowerCase()}).`) : sh < 0.9 ? `Right shape. Make the ${ti.name.toLowerCase()} bigger.` : "" };
      }
    }

    // ---- rhythm (stress-timing): stressed long and loud, weak syllables short and reduced
    const nSyl = exp.length;
    if (item.kind === "sentence" && nSyl >= 5) {
      const S = det.filter((d) => d.exp >= 0 && exp[d.exp].stress);
      const U = det.filter((d) => d.exp >= 0 && !exp[d.exp].stress);
      const durS = mean(S.map((d) => (d.exp === nSyl - 1 ? d.dur * 0.75 : d.dur))), durU = mean(U.map((d) => d.dur));
      const ratio = U.length ? durS / (durU || 1) : 1.8;
      const dbd = U.length ? mean(S.map((d) => d.dB)) - mean(U.map((d) => d.dB)) : 4;
      const sc = 0.6 * clamp01((ratio - 1.05) / 0.55) + 0.4 * clamp01((dbd - 0.5) / 3.5);
      const rate = det.length / (x.t1 - x.t0);
      let tip = "";
      const strong = exp.filter((s) => s.stress).map((s) => s.t.replace(/[^\w'’]/g, "").toUpperCase());
      const small = [...new Set(words.filter((w) => !w.syls.some((s) => s.stress)).map((w) => w.text.replace(/[^\w'’]/g, "").toLowerCase()))].slice(0, 4);
      const smallTxt = small.length ? `rush through “${small.join("”, “")}”` : "squeeze the unstressed syllables";
      if (sc < 0.6) tip = ratio < 1.3
        ? `Your syllables were all about the same length: stressed ones only ${ratio.toFixed(1)}× the weak ones (aim for 1.6×+). Stretch ${strong.join(" · ")} and ${smallTxt}. Compare the two rows of boxes below.`
        : `Length is OK; now make ${strong.join(" · ")} louder and keep ${small.length ? `“${small.join("”, “")}”` : "the rest"} quiet.`;
      else if (sc < 0.9) tip = `Nearly there (${ratio.toFixed(1)}×). Squeeze ${small.length ? `“${small.join("”, “")}”` : "the weak syllables"} even more.`;
      if (rate < 2.6 && sc < 0.9) tip += " You're also speaking slowly. Rush through the weak syllables.";
      res.dims.rhythm = { score: Math.round(sc * 100), detail: `stressed ${ratio.toFixed(1)}× longer`, tip };
    }
    return res;
  };

  // ---------- mirror scoring: compare with a real speaker, syllable by syllable ----------
  // item.real = { prom: [speaker prominence per syllable], ... }; item.contour holds the speaker's pitch.
  // syl = the learner's syllable spans (from aligning their recording to the speaker's).
  const corr = (xs, ys) => {
    const n = xs.length; if (n < 3) return 0;
    const mx = mean(xs), my = mean(ys); let a = 0, b = 0, c = 0;
    for (let i = 0; i < n; i++) { a += (xs[i] - mx) * (ys[i] - my); b += (xs[i] - mx) ** 2; c += (ys[i] - my) ** 2; }
    return b && c ? a / Math.sqrt(b * c) : 0;
  };
  A.mirror = function (samples, sr, item, syl) {
    const r = A.analyze(samples, sr, item, { syl });
    if (r.error) return r;
    const c = item.contour, exp = c.syls, words = c.words, real = item.real;
    const wordText = (wi) => words[wi].text.replace(/[^\w'’-]/g, "");
    const dims = {};
    // melody: your pitch curve against theirs (same time axis), plus the direction of the ending
    const pairs = []; r.pts.forEach(([t, st]) => { const v = Prosody.valueAt(c, t); if (v != null) pairs.push([v, st]); });
    const rc = corr(pairs.map((p) => p[0]), pairs.map((p) => p[1]));
    const nucJ = exp.findIndex((x) => x.nuc), tEnd = exp[exp.length - 1].start + exp[exp.length - 1].dur;
    const tail = (arr) => { const n = arr.length; if (n < 4) return 0; const k = Math.max(2, Math.floor(n / 3)); return mean(arr.slice(n - k)) - mean(arr.slice(0, k)); };
    const theirs = exp.slice(nucJ).flatMap((x) => x.pts.map((p) => p[1]));
    const yours = r.pts.filter(([t]) => t >= exp[nucJ].start && t <= tEnd + 0.2).map((p) => p[1]);
    const dT = tail(theirs), dY = tail(yours);
    const same = yours.length >= 4 && Math.sign(dT) === Math.sign(dY) && Math.abs(dY) >= Math.min(2, Math.abs(dT) * 0.5);
    const dir = (d) => (d > 1 ? "up" : d < -1 ? "down" : "flat");
    const msc = Math.round(100 * (0.6 * clamp01((rc - 0.3) / 0.55) + 0.4 * (same ? 1 : 0)));
    dims.melody = { score: msc, detail: `match ${Math.round(Math.max(0, rc) * 100)}% · end ${dir(dY)}`,
      tip: !same && yours.length >= 4 ? `After “${wordText(exp[nucJ].wi)}” their voice goes ${dir(dT)}; yours went ${dir(dY)}. Listen again (M) and copy the ending.`
        : msc < 70 ? "Your pitch shape differs from theirs. Listen (M), then copy where their voice goes high and where it drops." : "" };
    // stress: do the same syllables stand out?
    const up = exp.map((_, j) => { const d = r.det.find((q) => q.exp === j); return d ? d.prom : null; });
    const idx = exp.map((_, j) => j).filter((j) => up[j] != null && real.prom[j] != null);
    const pc = corr(idx.map((j) => real.prom[j]), idx.map((j) => up[j]));
    const topWord = (pr) => { let bj = idx[0]; idx.forEach((j) => { if (pr[j] > pr[bj]) bj = j; }); return exp[bj].wi; };
    const wT = exp[nucJ].wi;
    // same rule as when the speaker's main stress was measured: near-ties go to their main word
    const maxY = Math.max(...idx.map((j) => up[j])), onT = Math.max(...idx.filter((j) => exp[j].wi === wT).map((j) => up[j]), -Infinity);
    const wY = onT >= maxY - 0.35 ? wT : topWord(up);
    const ssc = Math.round(100 * (0.5 * clamp01((pc - 0.1) / 0.6) + 0.5 * (wY === wT ? 1 : 0)));
    dims.focus = { score: ssc, detail: `your peak: ${wordText(wY)}`,
      tip: wY !== wT ? `Their main stress is on “${wordText(wT)}”; yours was on “${wordText(wY)}”.` : ssc < 70 ? "Right main word. Now match which other syllables are strong and which are weak." : "" };
    // rhythm: long and short syllables in the same places
    if (exp.length >= 4) {
      const dj = exp.map((_, j) => j).filter((j) => r.det.find((q) => q.exp === j));
      const rr = corr(dj.map((j) => Math.log(exp[j].dur)), dj.map((j) => Math.log(r.det.find((q) => q.exp === j).dur)));
      const rsc = Math.round(100 * clamp01((rr - 0.2) / 0.6));
      const longest = dj.reduce((a, j) => (exp[j].dur > exp[a].dur ? j : a), dj[0]);
      dims.rhythm = { score: rsc, detail: `timing match ${Math.round(Math.max(0, rr) * 100)}%`,
        tip: rsc < 70 ? `Copy their timing: they stretch “${exp[longest].t.replace(/[^\w'’]/g, "")}” and rush the small words.` : "" };
    }
    // range: your pitch span against theirs
    const tv = exp.flatMap((x) => x.pts.map((p) => p[1])).sort((a, b) => a - b);
    const theirSpan = tv[Math.floor(tv.length * 0.92)] - tv[Math.floor(tv.length * 0.08)];
    const ratio = r.span / (theirSpan || 1);
    dims.range = { score: Math.round(100 * clamp01((ratio - 0.4) / 0.45)), detail: `you ${r.span.toFixed(1)} · them ${theirSpan.toFixed(1)} semitones`,
      tip: ratio < 0.85 ? `Their voice moves ${theirSpan.toFixed(0)} semitones; yours moved ${r.span.toFixed(0)}. Go higher on the stressed words and lower at the end.` : "" };
    r.dims = dims;
    r.mirror = true;
    return r;
  };

  // ---------- word-level comparison for recognized speech ----------
  // Recognizers write numbers as digits ("10") and may pick US or UK spellings; normalize both sides.
  const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
    "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  const ORD = { one: "first", two: "second", three: "third", five: "fifth", eight: "eighth", nine: "ninth", twelve: "twelfth" };
  function numWords(n) {
    if (n < 20) return ONES[n];
    if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
    if (n < 1000) return ONES[Math.floor(n / 100)] + " hundred" + (n % 100 ? " " + numWords(n % 100) : "");
    if (n < 1e6) return numWords(Math.floor(n / 1000)) + " thousand" + (n % 1000 ? " " + numWords(n % 1000) : "");
    return String(n);
  }
  function ordinal(n) {
    const w = numWords(n).split(" "), last = w.pop();
    return [...w, ORD[last] || (last.endsWith("y") ? last.slice(0, -1) + "ieth" : last + "th")].join(" ");
  }
  const SPELL = { center: "centre", theater: "theatre", color: "colour", favorite: "favourite", realize: "realise", ok: "okay", "o.k.": "okay" };
  A.normWords = function (s) {
    return s.toLowerCase().replace(/[’‘]/g, "'")
      .replace(/(\d+)(st|nd|rd|th)\b/g, (_, d) => " " + ordinal(+d) + " ")
      .replace(/\d+/g, (d) => " " + numWords(+d) + " ")
      .replace(/-/g, " ").replace(/[^a-z' ]+/g, " ").trim().split(/\s+/).filter(Boolean)
      .map((w) => SPELL[w] || w);
  };

  A.wordAccuracy = function (target, heard) {
    const norm = A.normWords;
    const a = norm(target), b = norm(heard);
    const D = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) D[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
      D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    const missed = a.filter((w) => !b.includes(w));
    return { acc: Math.max(0, 1 - D[a.length][b.length] / Math.max(1, a.length)), missed };
  };

  window.Analyze = A;
})();
