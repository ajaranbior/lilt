// Microphone pitch tracking (McLeod normalized square difference) + contour scoring.
(function () {
  const M = {};
  let stream = null, analyser = null, buf = null;

  M.ready = () => !!analyser;

  M.init = async function () {
    if (analyser) return true;
    const ac = Prosody.audio();
    if (ac.state === "suspended") await ac.resume();
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    const src = ac.createMediaStreamSource(stream);
    analyser = ac.createAnalyser();
    analyser.fftSize = 2048;
    src.connect(analyser);
    buf = new Float32Array(analyser.fftSize);
    return true;
  };

  M.detect = function (x, sr) {
    const N = x.length;
    let rms = 0;
    for (let i = 0; i < N; i++) rms += x[i] * x[i];
    rms = Math.sqrt(rms / N);
    if (rms < 0.012) return { hz: 0, rms };
    const minLag = Math.floor(sr / 450), maxLag = Math.min(Math.floor(sr / 65), N >> 1);
    const W = N - maxLag;
    const nsdf = new Float32Array(maxLag + 1);
    for (let tau = minLag; tau <= maxLag; tau++) {
      let ac = 0, m = 0;
      for (let i = 0; i < W; i++) { const a = x[i], b = x[i + tau]; ac += a * b; m += a * a + b * b; }
      nsdf[tau] = m > 0 ? (2 * ac) / m : 0;
    }
    // collect peaks between positive zero crossings
    const peaks = [];
    let pos = false, best = -1, bestTau = -1;
    for (let tau = minLag + 1; tau < maxLag; tau++) {
      if (!pos && nsdf[tau] > 0 && nsdf[tau - 1] <= 0) { pos = true; best = -1; }
      if (pos) {
        if (nsdf[tau] > best) { best = nsdf[tau]; bestTau = tau; }
        if (nsdf[tau] <= 0) { peaks.push([bestTau, best]); pos = false; }
      }
    }
    if (pos && bestTau > 0) peaks.push([bestTau, best]);
    if (!peaks.length) return { hz: 0, rms };
    const top = Math.max(...peaks.map((p) => p[1]));
    if (top < 0.6) return { hz: 0, rms };
    const [tau] = peaks.find((p) => p[1] >= 0.88 * top);
    const a = nsdf[tau - 1], b = nsdf[tau], c = nsdf[tau + 1] || b;
    const shift = (a - c) / (2 * (a - 2 * b + c) || 1);
    return { hz: sr / (tau + (Math.abs(shift) < 1 ? shift : 0)), rms, clarity: top };
  };

  // Record until stop() or maxSec. onFrame(frames) called each animation frame.
  M.record = function (maxSec, onFrame, onDone) {
    const ac = Prosody.audio();
    const frames = [];
    const t0 = performance.now();
    let running = true, raf = 0;
    const tick = () => {
      if (!running) return;
      analyser.getFloatTimeDomainData(buf);
      const r = M.detect(buf, ac.sampleRate);
      frames.push({ t: (performance.now() - t0) / 1000, hz: r.hz, rms: r.rms });
      onFrame && onFrame(frames);
      if (frames[frames.length - 1].t > maxSec) return stop();
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (!running) return;
      running = false; cancelAnimationFrame(raf);
      onDone && onDone(frames);
    };
    raf = requestAnimationFrame(tick);
    return { stop, cancel: () => { running = false; cancelAnimationFrame(raf); } };
  };

  const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };

  // Clean raw frames -> voiced points [{t, st}] in semitones relative to the speaker's median.
  M.clean = function (frames) {
    let v = frames.filter((f) => f.hz > 0);
    if (v.length < 5) return [];
    // median filter on hz
    const hz = v.map((f, i) => median(v.slice(Math.max(0, i - 2), i + 3).map((x) => x.hz)));
    const med = median(hz);
    const pts = [];
    v.forEach((f, i) => {
      const h = hz[i];
      if (h > med * 1.9 || h < med * 0.55) return; // octave errors
      pts.push({ t: f.t, st: 12 * Math.log2(h / med) });
    });
    // drop isolated blips (voiced runs shorter than 3 frames)
    return pts.filter((p, i) => {
      const near = pts.filter((q) => Math.abs(q.t - p.t) < 0.06).length;
      return near >= 3;
    });
  };

  // Map user points onto the target's time axis and pitch level; score the match.
  M.score = function (target, pts) {
    if (pts.length < 8) return null;
    const syls = target.syls;
    const tA = syls[0].start, tB = syls[syls.length - 1].start + syls[syls.length - 1].dur;
    const uA = pts[0].t, uB = pts[pts.length - 1].t;
    const map = (t) => tA + ((t - uA) / (uB - uA || 1)) * (tB - tA);

    // target values at its own voiced times, relative to median
    const tvals = [];
    for (let i = 0; i <= 60; i++) {
      const t = tA + ((tB - tA) * i) / 60;
      const v = Prosody.valueAt(target, t);
      if (v != null) tvals.push(v);
    }
    const tMed = median(tvals);
    const user = pts.map((p) => [map(p.t), p.st + tMed]);

    // pair: for each user point that lands inside a target syllable
    const pairs = [];
    user.forEach(([t, st]) => { const v = Prosody.valueAt(target, t); if (v != null) pairs.push([v, st]); });
    if (pairs.length < 6) return { user, score: 0, r: 0, end: null };
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const xs = pairs.map((p) => p[0]), ys = pairs.map((p) => p[1]);
    const mx = mean(xs), my = mean(ys);
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
    const r = sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;

    // ending direction: compare the last 25% of the nucleus+tail span
    const nuc = syls.find((s) => s.nuc);
    const endDir = (series) => {
      const n = series.length; if (n < 4) return 0;
      const k = Math.max(2, Math.floor(n * 0.3));
      const a = mean(series.slice(n - 2 * k, n - k).map((p) => p[1]));
      const b = mean(series.slice(n - k).map((p) => p[1]));
      return b - a;
    };
    const tSeries = [];
    for (let i = 0; i <= 40; i++) {
      const t = nuc.start + ((tB - nuc.start) * i) / 40;
      const v = Prosody.valueAt(target, t);
      if (v != null) tSeries.push([t, v]);
    }
    const uSeries = user.filter(([t]) => t >= nuc.start);
    const td = endDir(tSeries), ud = endDir(uSeries);
    const end = uSeries.length >= 4 ? Math.sign(td) === Math.sign(ud) && Math.abs(ud) > 0.4 : null;
    // pitch range: flat speech is a common problem
    const range = Math.max(...ys) - Math.min(...ys);
    const tRange = Math.max(...xs) - Math.min(...xs);
    const rangeOk = range >= tRange * 0.45;
    const score = Math.round(Math.max(0, r) * 70 + (end ? 20 : 0) + (rangeOk ? 10 : 0));
    return { user, score: Math.min(100, score), r, end, range, tRange, rangeOk };
  };

  window.Pitch = M;
})();
