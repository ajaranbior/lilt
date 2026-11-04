// Align a learner's recording to the model recording of the same phrase, sound by sound:
// MFCC features + dynamic time warping. The model's known syllable boundaries are then
// carried over to the learner's audio, so every syllable is measured where it really is.
(function () {
  const G = {};
  const SR = 16000, WIN = 400, HOP = 160, NFFT = 512, NMEL = 26, NCEP = 13;

  function fft(re, im) { // in-place radix-2
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
      if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const a = i + k, b = a + len / 2;
          const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
          re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
          const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
        }
      }
    }
  }

  const mel = (f) => 2595 * Math.log10(1 + f / 700), imel = (m) => 700 * (10 ** (m / 2595) - 1);
  const FB = (() => { // triangular mel filterbank, 80–7600 Hz
    const lo = mel(80), hi = mel(7600), pts = [];
    for (let i = 0; i < NMEL + 2; i++) pts.push(Math.floor(((NFFT + 1) * imel(lo + ((hi - lo) * i) / (NMEL + 1))) / SR));
    return Array.from({ length: NMEL }, (_, m) => {
      const w = new Float32Array(NFFT / 2 + 1);
      for (let k = pts[m]; k < pts[m + 1]; k++) w[k] = (k - pts[m]) / (pts[m + 1] - pts[m] || 1);
      for (let k = pts[m + 1]; k < pts[m + 2]; k++) w[k] = (pts[m + 2] - k) / (pts[m + 2] - pts[m + 1] || 1);
      return w;
    });
  })();
  const HAMM = Float32Array.from({ length: WIN }, (_, i) => 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (WIN - 1)));

  // MFCC (c1..c12) + deltas, cepstral-mean normalised. Frame f covers samples f*HOP..f*HOP+WIN at 16 kHz,
  // i.e. the same 10 ms frame grid as Analyze.extract.
  G.features = function (samples, sr) {
    const x = Analyze.resample(samples, sr);
    const nF = Math.max(0, Math.floor((x.length - WIN) / HOP));
    const C = [];
    const re = new Float32Array(NFFT), im = new Float32Array(NFFT), lm = new Float32Array(NMEL);
    for (let f = 0; f < nF; f++) {
      re.fill(0); im.fill(0);
      const s = f * HOP;
      for (let i = 0; i < WIN; i++) re[i] = (x[s + i] - 0.97 * (s + i > 0 ? x[s + i - 1] : 0)) * HAMM[i];
      fft(re, im);
      for (let m = 0; m < NMEL; m++) {
        let e = 0; const w = FB[m];
        for (let k = 0; k <= NFFT / 2; k++) if (w[k]) e += w[k] * (re[k] * re[k] + im[k] * im[k]);
        lm[m] = Math.log(e + 1e-10);
      }
      const c = new Float32Array(NCEP - 1);
      for (let q = 1; q < NCEP; q++) { let a = 0; for (let m = 0; m < NMEL; m++) a += lm[m] * Math.cos((Math.PI * q * (m + 0.5)) / NMEL); c[q - 1] = a; }
      C.push(c);
    }
    const D = NCEP - 1;
    const mu = new Float32Array(D); C.forEach((c) => c.forEach((v, i) => (mu[i] += v / C.length)));
    C.forEach((c) => c.forEach((v, i) => (c[i] = v - mu[i])));
    return C.map((c, f) => {
      const o = new Float32Array(2 * D); o.set(c);
      const a = C[Math.max(0, f - 2)], b = C[Math.min(C.length - 1, f + 2)];
      for (let i = 0; i < D; i++) o[D + i] = (b[i] - a[i]) * 0.5;
      return o;
    });
  };

  // DTW between feature sequences over the speech spans [ua, ub] (user) and [ma, mb] (model), in frames.
  // Returns a function: model time (s) -> user time (s).
  G.warp = function (U, ua, ub, M, ma, mb) {
    const n = ub - ua + 1, m = mb - ma + 1;
    if (n < 5 || m < 5) return null;
    const band = Math.max(15, Math.round(0.35 * Math.max(n, m)));
    const INF = 1e30, D = new Float32Array(n * m).fill(INF), B = new Uint8Array(n * m);
    const dist = (i, j) => { const u = U[ua + i], v = M[ma + j]; let s = 0; for (let k = 0; k < u.length; k++) { const d = u[k] - v[k]; s += d * d; } return Math.sqrt(s); };
    for (let i = 0; i < n; i++) {
      const jc = Math.round((i * (m - 1)) / Math.max(1, n - 1));
      for (let j = Math.max(0, jc - band); j <= Math.min(m - 1, jc + band); j++) {
        const d = dist(i, j);
        if (!i && !j) { D[0] = d; continue; }
        let best = INF, bk = 0;
        if (i && j && D[(i - 1) * m + j - 1] + 2 * d < best) { best = D[(i - 1) * m + j - 1] + 2 * d; bk = 1; }
        if (i && D[(i - 1) * m + j] + d < best) { best = D[(i - 1) * m + j] + d; bk = 2; }
        if (j && D[i * m + j - 1] + d < best) { best = D[i * m + j - 1] + d; bk = 3; }
        D[i * m + j] = best; B[i * m + j] = bk;
      }
    }
    if (D[n * m - 1] >= INF) return null;
    // for each model frame, the mean user frame it was matched to
    const acc = new Float32Array(m), cnt = new Float32Array(m);
    for (let i = n - 1, j = m - 1; ;) {
      acc[j] += i; cnt[j]++;
      const b = B[i * m + j];
      if (!b) break;
      if (b === 1) { i--; j--; } else if (b === 2) i--; else j--;
    }
    const map = Array.from(acc, (a, j) => ua + a / cnt[j]);
    for (let j = 1; j < m; j++) map[j] = Math.max(map[j], map[j - 1]); // keep it monotonic
    return (t) => {
      const fj = t * 100 - ma;
      if (fj <= 0) return (map[0] + fj) / 100;
      if (fj >= m - 1) return (map[m - 1] + (fj - (m - 1))) / 100;
      const j0 = Math.floor(fj), r = fj - j0;
      return (map[j0] * (1 - r) + map[j0 + 1] * r) / 100;
    };
  };

  // Map model syllable spans onto the user's recording. model = { samples, sr, syl: [{a,b}] }.
  G.userSyllables = function (userSamples, userSr, model) {
    const xu = Analyze.extract(userSamples, userSr), xm = Analyze.extract(model.samples, model.sr);
    if (!xu || !xm) return null;
    model.F ||= G.features(model.samples, model.sr);
    const U = G.features(userSamples, userSr);
    const pad = 5;
    const w = G.warp(U, Math.max(0, xu.s - pad), Math.min(U.length - 1, xu.e + pad), model.F, Math.max(0, xm.s - pad), Math.min(model.F.length - 1, xm.e + pad));
    if (!w) return null;
    return model.syl.map((p) => ({ a: w(p.a), b: w(p.b) }));
  };

  window.Align = G;
})();
