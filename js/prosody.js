// Prosody engine: parse markup -> syllables -> pitch contour -> hummed audio + drawing.
(function () {
  const P = {};

  // ---------- parsing ----------
  P.parse = function (markup) {
    return markup.trim().split(/\s+/).map((tok) => {
      const syls = tok.split("-").map((raw) => {
        let stress = 0, nuc = false, t = raw;
        if (t[0] === "*") { nuc = true; stress = 1; t = t.slice(1); }
        else if (t[0] === "'") { stress = 1; t = t.slice(1); }
        return { t, stress, nuc };
      });
      return { syls, text: syls.map((s) => s.t).join("") };
    });
  };

  P.clone = (words) => words.map((w) => ({ text: w.text, syls: w.syls.map((s) => ({ ...s })) }));

  // Put the nucleus on word wi; deaccent everything after it.
  P.setFocus = function (words, wi) {
    const w2 = P.clone(words);
    w2.forEach((w, i) => w.syls.forEach((s) => { s.nuc = false; if (i > wi) s.stress = 0; }));
    const syl = w2[wi].syls.find((s) => s.stress) || w2[wi].syls[0];
    syl.stress = 1; syl.nuc = true;
    return w2;
  };

  P.ensureNucleus = function (words) {
    const flat = words.flatMap((w) => w.syls);
    if (flat.some((s) => s.nuc)) return words;
    const w2 = P.clone(words);
    const f2 = w2.flatMap((w) => w.syls);
    const last = [...f2].reverse().find((s) => s.stress) || f2[f2.length - 1];
    last.stress = 1; last.nuc = true;
    return w2;
  };

  P.wordStressMarkup = function (entry) {
    const [w, hint] = entry.split("|");
    const syls = w.split("-");
    const idx = syls.findIndex((s) => s === s.toUpperCase() && /[A-Z]/.test(s));
    return { syls: syls.map((s) => s.toLowerCase()), idx, hint: hint || "", text: syls.join("").toLowerCase() };
  };

  // ---------- contour ----------
  // Pitch in semitones relative to the speaker's base. Returns timed syllables with pitch points.
  const SHAPES = {
    // [position across nucleus+tail (0..1, f = end of nucleus), semitones]
    fall: (f, tail) => tail ? [[0, 5], [f * 0.35, 5.5], [f, -1.5], [1, -4.5]] : [[0, 5], [0.3, 5.5], [1, -4.5]],
    rise: (f, tail) => tail ? [[0, -2.5], [f * 0.6, -2], [f, 0.5], [1, 6.5]] : [[0, -2.5], [0.35, -2.5], [1, 6]],
    fallrise: (f, tail) => tail ? [[0, 5], [f, -2], [f + (1 - f) * 0.45, -2.5], [1, 4]] : [[0, 5], [0.5, -2.5], [1, 3.5]],
    risefall: (f, tail) => tail ? [[0, -0.5], [f * 0.6, 7], [f, 1], [1, -4.5]] : [[0, -1], [0.45, 7.5], [1, -4.5]],
  };

  function interp(pts, u) {
    if (u <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      if (u <= pts[i][0]) {
        const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
        return y0 + (y1 - y0) * ((u - x0) / (x1 - x0 || 1));
      }
    }
    return pts[pts.length - 1][1];
  }
  P.interp = interp;

  P.contour = function (wordsIn, tune = "fall", opts = {}) {
    const rate = opts.rate || 1;
    const words = P.ensureNucleus(wordsIn);
    const syls = [];
    words.forEach((w, wi) => w.syls.forEach((s, si) => syls.push({ ...s, wi, si, label: s.t })));
    const n = syls.length;
    const gap = 0.03 / rate;
    let t = 0.05;
    syls.forEach((s, i) => {
      let d = s.nuc ? 0.32 : s.stress ? 0.24 : 0.13;
      if (i === n - 1) d += 0.1; // final lengthening
      s.dur = d / rate; s.start = t; t += s.dur + gap;
      s.amp = s.nuc ? 1 : s.stress ? 0.85 : 0.45;
    });
    const total = t + 0.05;
    const ni = syls.findIndex((s) => s.nuc);

    // Pre-nuclear: declining stepped accents
    let lastStress = null, k = 0;
    for (let i = 0; i < ni; i++) {
      const s = syls[i];
      let a, b;
      if (s.stress) { a = 3.5 - k * 0.9; b = a - 0.6; lastStress = a; k++; }
      else if (lastStress === null) { a = 0.3; b = 0.6; }
      else { a = lastStress - 1.8; b = a - 0.3; }
      s.pts = [[s.start, a], [s.start + s.dur, b]];
    }
    // Nucleus + tail
    const span0 = syls[ni].start, span1 = syls[n - 1].start + syls[n - 1].dur;
    const spanD = span1 - span0;
    const f = (syls[ni].dur) / spanD;
    const shape = SHAPES[tune](f, ni < n - 1);
    for (let i = ni; i < n; i++) {
      const s = syls[i];
      s.pts = [];
      const steps = 8;
      for (let j = 0; j <= steps; j++) {
        const tt = s.start + (s.dur * j) / steps;
        s.pts.push([tt, interp(shape, (tt - span0) / spanD)]);
      }
    }
    return { syls, total, tune, words };
  };

  // Target pitch at time t (null between syllables).
  P.valueAt = function (c, t) {
    const s = c.syls.find((s) => t >= s.start && t <= s.start + s.dur);
    return s ? interp(s.pts, t) : null;
  };

  // ---------- audio ----------
  let ctx = null, current = null;
  P.audio = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());
  P.settings = { base: 120 };

  P.stop = function () {
    if (current) { try { current.osc.stop(); } catch (e) {} current = null; }
    if (window.speechSynthesis) speechSynthesis.cancel();
  };

  P.hum = function (c) {
    P.stop();
    const ac = P.audio();
    if (ac.state === "suspended") ac.resume();
    const t0 = ac.currentTime + 0.05;
    const base = P.settings.base;
    const hz = (st) => base * Math.pow(2, st / 12);
    const osc = ac.createOscillator(); osc.type = "sawtooth";
    const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900; lp.Q.value = 0.7;
    const form = ac.createBiquadFilter(); form.type = "peaking"; form.frequency.value = 300; form.gain.value = 8; form.Q.value = 1.5;
    const g = ac.createGain(); g.gain.value = 0;
    osc.connect(lp); lp.connect(form); form.connect(g); g.connect(ac.destination);
    const all = c.syls.flatMap((s) => s.pts);
    osc.frequency.setValueAtTime(hz(all[0][1]), t0);
    all.forEach(([t, st]) => osc.frequency.linearRampToValueAtTime(hz(st), t0 + t));
    g.gain.setValueAtTime(0, t0);
    c.syls.forEach((s) => {
      const a = t0 + s.start, e = a + s.dur, A = 0.22 * s.amp;
      g.gain.setValueAtTime(0, a);
      g.gain.linearRampToValueAtTime(A, a + 0.025);
      g.gain.setValueAtTime(A, Math.max(a + 0.03, e - 0.035));
      g.gain.linearRampToValueAtTime(0, e);
    });
    osc.start(t0); osc.stop(t0 + c.total + 0.1);
    current = { osc, t0, c };
    return { t0, ac };
  };

  P.playing = () => current;

  let voice = null;
  function pickVoice() {
    const vs = speechSynthesis.getVoices().filter((v) => /^en[-_]/i.test(v.lang));
    voice = vs.find((v) => /natural|neural|google us|samantha|daniel/i.test(v.name)) || vs[0] || null;
  }
  if (window.speechSynthesis) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

  P.say = function (text) {
    if (!window.speechSynthesis) return;
    P.stop();
    const u = new SpeechSynthesisUtterance(text.replace(/[…]/g, ""));
    if (voice) u.voice = voice;
    u.lang = voice ? voice.lang : "en-US";
    u.rate = 0.9;
    speechSynthesis.speak(u);
  };

  // ---------- drawing ----------
  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

  P.draw = function (canvas, c, opts = {}) {
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (canvas.width !== W * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; }
    const g = canvas.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    if (!c) return;
    const padL = 12, padR = 12, padT = 14, padB = 30;
    const lo = -6, hi = 9;
    const X = (t) => padL + (t / c.total) * (W - padL - padR);
    const Y = (st) => padT + (1 - (st - lo) / (hi - lo)) * (H - padT - padB);

    // baseline grid
    g.strokeStyle = css("--grid"); g.lineWidth = 1;
    [-4, 0, 4, 8].forEach((st) => { g.beginPath(); g.moveTo(padL, Y(st)); g.lineTo(W - padR, Y(st)); g.stroke(); });

    // syllable labels + target
    g.font = "600 13px ui-sans-serif, system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "alphabetic";
    c.syls.forEach((s) => {
      const mid = X(s.start + s.dur / 2);
      g.fillStyle = s.nuc ? css("--accent") : s.stress ? css("--fg") : css("--muted");
      g.font = (s.nuc ? "800 " : s.stress ? "700 " : "400 ") + "13px ui-sans-serif, system-ui, sans-serif";
      g.fillText(s.stress ? s.label.toUpperCase() : s.label.toLowerCase(), mid, H - 9);
      g.strokeStyle = s.nuc ? css("--accent") : css("--target");
      g.lineCap = "round";
      g.lineWidth = 4 + s.amp * 7;
      g.globalAlpha = opts.user ? 0.55 : 1;
      g.beginPath();
      s.pts.forEach(([t, st], i) => (i ? g.lineTo(X(t), Y(st)) : g.moveTo(X(t), Y(st))));
      g.stroke();
      g.globalAlpha = 1;
    });

    // user pitch (already mapped to target time + semitones)
    if (opts.user && opts.user.length) {
      g.fillStyle = css("--user");
      opts.user.forEach(([t, st]) => { g.beginPath(); g.arc(X(t), Y(Math.max(lo, Math.min(hi, st))), 2.6, 0, 7); g.fill(); });
    }
    // playhead
    if (opts.head != null && opts.head >= 0 && opts.head <= c.total) {
      g.strokeStyle = css("--muted"); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(X(opts.head), padT - 6); g.lineTo(X(opts.head), H - padB + 4); g.stroke();
    }
  };

  window.Prosody = P;
})();
