// "Hear it fixed": re-synthesise the learner's own recording with target prosody.
// TD-PSOLA: pitch-synchronous grains are re-spaced to a new pitch contour while the
// time axis is warped (stressed syllables stretched, weak ones squeezed) and stresses
// get louder. Words, voice and accent stay the speaker's own.
(function () {
  const R = {};
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };

  function pw(xs, ys) { // piecewise-linear map with linear extrapolation
    return (v) => {
      let i = 1; while (i < xs.length - 1 && v > xs[i]) i++;
      const x0 = xs[i - 1], x1 = xs[i], y0 = ys[i - 1], y1 = ys[i];
      return y0 + ((v - x0) / (x1 - x0 || 1)) * (y1 - y0);
    };
  }

  // Build the target plan (time warp, pitch, gain) from an analysis result.
  R.plan = function (r, item, amount = 0.9) {
    const x = r.x, c = item.contour, exp = c.syls;
    const det = [...r.det].sort((a, b) => a.a - b.a);
    const str = (d) => d.exp >= 0 && exp[d.exp].stress, nuc = (d) => d.exp >= 0 && exp[d.exp].nuc;
    const weak = (d) => d.exp >= 0 && !exp[d.exp].stress;
    // durations: weak syllables ×0.8; stressed stretched so they are ~1.75× the weak ones
    let fS = 1.15, fU = 0.85;
    const S = det.filter(str), U = det.filter(weak);
    if (S.length && U.length) {
      fU = 0.8;
      const mS = mean(S.map((d) => d.dur)), mU = mean(U.map((d) => d.dur));
      fS = Math.max(1, Math.min(1.9, (1.75 * mU * fU) / (mS || 1)));
    }
    const fac = (d) => (d.exp < 0 ? 1 : nuc(d) ? fS * 1.12 : str(d) ? fS : fU);
    const xin = [0], xout = [0];
    let ti = 0, to = 0;
    det.forEach((d) => {
      if (d.a > ti) { to += d.a - ti; ti = d.a; xin.push(ti); xout.push(to); }
      const a = Math.max(d.a, ti);
      to += (d.b - a) * fac(d); ti = d.b; xin.push(ti); xout.push(to);
    });
    const end = x.nF / 100 + 0.05;
    if (end > ti) { to += end - ti; xin.push(end); xout.push(to); }
    const inToOut = pw(xin, xout), outToIn = pw(xout, xin);

    // pitch: model contour (continuous), around the speaker's own median, plus their micro-prosody
    const all = exp.flatMap((s) => s.pts).sort((a, b) => a[0] - b[0]);
    const tgt = (mt) => Prosody.interp(all, mt);
    const frameOf = (t) => Math.round((t - 0.0125) * 100);
    const stU = (f) => x.st[f];
    const micro = (f) => {
      const v = stU(f); if (v == null) return 0;
      const w = []; for (let k = f - 4; k <= f + 4; k++) if (stU(k) != null) w.push(stU(k));
      return Math.max(-1, Math.min(1, v - mean(w)));
    };
    const hzAt = (u) => {
      const f = frameOf(u);
      const st = (tgt(r.toT(u)) - r.tMed) * amount + 0.6 * micro(f);
      return Math.max(60, Math.min(500, x.med * Math.pow(2, st / 12)));
    };
    const gainAt = (u) => {
      const d = det.find((d) => u >= d.a && u < d.b);
      if (!d || d.exp < 0) return 1;
      return nuc(d) ? 1.5 : str(d) ? 1.3 : 0.7;
    };
    return { inToOut, outToIn, hzAt, gainAt, fS, fU, frameOf };
  };

  R.fix = function (samples, sr, r, item) {
    const x = r.x, N = samples.length;
    const pl = R.plan(r, item);
    // input f0 per frame with short gaps bridged
    const F0 = Float32Array.from(x.hz);
    for (let f = 0; f < F0.length;) {
      if (F0[f]) { f++; continue; }
      let g = f; while (g < F0.length && !F0[g]) g++;
      if (f > 0 && g < F0.length && g - f <= 5) for (let k = f; k < g; k++) F0[k] = F0[f - 1] + ((F0[g] - F0[f - 1]) * (k - f + 1)) / (g - f + 1);
      f = g;
    }
    const f0At = (t) => { const f = pl.frameOf(t); return f >= 0 && f < F0.length ? F0[f] : 0; };

    // analysis marks: pitch-synchronous in voiced parts (aligned to waveform peaks), every 5 ms elsewhere
    const lpN = Math.max(1, Math.round(sr / 2000));
    const lp = new Float32Array(N); let acc = 0;
    for (let i = 0; i < N; i++) { acc += samples[i]; if (i >= lpN) acc -= samples[i - lpN]; lp[i] = acc / lpN; }
    const marks = [];
    let pos = 0;
    while (pos < N) {
      const f0 = f0At(pos / sr);
      if (f0 > 0) {
        const T = sr / f0;
        let best = Math.round(pos), bv = -Infinity;
        const lo = Math.max(0, Math.round(pos - 0.25 * T)), hi = Math.min(N - 1, Math.round(pos + 0.25 * T));
        for (let i = lo; i <= hi; i++) if (lp[i] > bv) { bv = lp[i]; best = i; }
        const last = marks.length ? marks[marks.length - 1].p : -Infinity;
        if (best <= last + 0.5 * T) best = Math.round(last + T);
        marks.push({ p: best, T, v: true });
        pos = best + T;
      } else {
        marks.push({ p: Math.round(pos), T: sr * 0.005, v: false });
        pos += sr * 0.005;
      }
    }
    const nearest = (ui) => {
      let lo = 0, hi = marks.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (marks[m].p < ui) lo = m; else hi = m; }
      return Math.abs(marks[lo].p - ui) <= Math.abs(marks[hi].p - ui) ? marks[lo] : marks[hi];
    };

    const outN = Math.round(pl.inToOut(N / sr) * sr);
    const out = new Float32Array(outN + sr);
    let ts = 0;
    while (ts < outN) {
      const u = pl.outToIn(ts / sr);
      const m = nearest(u * sr);
      const half = Math.max(8, Math.round(m.T));
      const g = pl.gainAt(m.p / sr);
      for (let k = -half; k < half; k++) {
        const si = m.p + k, oi = Math.round(ts) + k;
        if (si < 0 || si >= N || oi < 0) continue;
        out[oi] += samples[si] * g * (0.5 + 0.5 * Math.cos((Math.PI * k) / half));
      }
      ts += m.v ? sr / pl.hzAt(m.p / sr) : sr * 0.005;
    }
    // match the original peak level
    let p0 = 0, p1 = 0;
    for (let i = 0; i < N; i++) p0 = Math.max(p0, Math.abs(samples[i]));
    for (let i = 0; i < out.length; i++) p1 = Math.max(p1, Math.abs(out[i]));
    const k = p1 ? Math.min(0.95, p0 * 1.05) / p1 : 1;
    for (let i = 0; i < out.length; i++) out[i] *= k;
    return out.subarray(0, outN);
  };

  window.Resynth = R;
})();
