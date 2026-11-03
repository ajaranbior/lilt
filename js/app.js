// App: modes, rounds, scoring, keyboard control.
(function () {
  const $ = (s) => document.querySelector(s);
  const P = Prosody;
  const ROUND = 20, SHADOW_ROUND = 8;

  // ---------- storage (best scores + miss history for weighting) ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem("pd:" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("pd:" + k, JSON.stringify(v)); } catch (e) {} },
  };
  let hist = store.get("hist", {});
  const record = (id, ok) => { const h = (hist[id] ||= [0, 0]); h[ok ? 0 : 1]++; store.set("hist", hist); };
  const weight = (id) => { const h = hist[id] || [0, 0]; return 1 + (3 * h[1]) / (1 + h[0]); };

  let recent = [];
  function pick(pool, idOf) {
    const avail = pool.filter((x) => !recent.includes(idOf(x)));
    const list = avail.length ? avail : pool;
    const ws = list.map((x) => weight(idOf(x)));
    let r = Math.random() * ws.reduce((a, b) => a + b, 0);
    let i = 0; while ((r -= ws[i]) > 0 && i < list.length - 1) i++;
    const it = list[i];
    recent.push(idOf(it)); if (recent.length > Math.min(6, pool.length - 1)) recent.shift();
    return it;
  }
  const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const rand = (a) => a[(Math.random() * a.length) | 0];
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ---------- item generators ----------
  const focusPool = WINDOW_FOCUS();
  function WINDOW_FOCUS() { const out = []; FOCUS.forEach((g) => g.items.forEach(([q, f]) => out.push({ s: g.s, q, f, id: "f:" + g.s + "|" + q }))); return out; }

  function wordsHTML(words, opts = {}) {
    return words.map((w, i) => {
      const syl = w.syls.map((s) => {
        const cls = s.nuc && opts.showNuc ? "nuc" : s.stress && opts.showStress ? "str" : "";
        return cls ? `<span class="${cls}">${esc(s.t)}</span>` : esc(s.t);
      }).join(opts.dots ? "<i>·</i>" : "");
      const num = opts.numbers ? `<kbd>${i + 1}</kbd>` : "";
      const st = opts.state && opts.state[i] ? " " + opts.state[i] : "";
      return `<span class="w${st}">${num}${syl}</span>`;
    }).join(" ");
  }

  const MODES = {
    stress: {
      key: "1", name: "Word stress", blurb: "Which syllable is stressed?",
      make() {
        const e = pick(WORDS, (x) => x);
        const w = P.wordStressMarkup(e);
        const words = [{ text: w.text, syls: w.syls.map((t, i) => ({ t, stress: i === w.idx ? 1 : 0, nuc: i === w.idx })) }];
        return {
          id: "w:" + e, answer: w.idx, n: w.syls.length,
          contour: P.contour(words, "fall", { rate: 0.85 }),
          say: w.text,
          render(state) {
            const chips = w.syls.map((s, i) => {
              let c = "opt syl"; if (state) { if (i === w.idx) c += " right"; else if (i === state.choice) c += " wrong"; }
              return `<button class="${c}" data-a="${i}"><kbd>${i + 1}</kbd>${esc(state && i === w.idx ? s.toUpperCase() : s)}</button>`;
            }).join("");
            return `<div class="prompt big">${esc(w.text)}${w.hint ? ` <small>(${esc(w.hint)})</small>` : ""}</div><div class="opts">${chips}</div>`;
          },
        };
      },
      onReveal(item) { P.say(item.say); setTimeout(() => P.hum(item.contour) && animate(item.contour), 900); },
    },

    rhythm: {
      key: "2", name: "Rhythm", blurb: "Pick the natural stress pattern.",
      make() {
        const pool = [...FOCUS.map((g) => g.s), ...TUNES.map((t) => t.s)];
        const s = pick(pool, (x) => "r:" + x);
        const words = P.ensureNucleus(P.parse(s)).map((w) => ({ ...w, syls: w.syls.map((x) => ({ ...x, nuc: false })) }));
        const sig = (ws) => ws.map((w) => w.syls.map((x) => x.stress).join("")).join(" ");
        const opts = [words]; const seen = new Set([sig(words)]);
        let guard = 0;
        while (opts.length < 3 && guard++ < 200) {
          const m = P.clone(words);
          const muts = 1 + (Math.random() < 0.5 ? 1 : 0);
          for (let k = 0; k < muts; k++) {
            const w = rand(m);
            if (w.syls.length > 1) { const cur = w.syls.findIndex((x) => x.stress); w.syls.forEach((x) => (x.stress = 0)); let j; do { j = (Math.random() * w.syls.length) | 0; } while (j === cur && w.syls.length > 1); w.syls[j].stress = 1; }
            else w.syls[0].stress ^= 1;
          }
          if (!m.some((w) => w.syls.some((x) => x.stress))) continue;
          const g = sig(m); if (!seen.has(g)) { seen.add(g); opts.push(m); }
        }
        const order = shuffle(opts.map((_, i) => i));
        const answer = order.indexOf(0);
        const text = words.map((w) => w.text).join(" ");
        const show = (ws) => ws.map((w) => w.syls.map((x) => x.stress ? `<b>${esc(x.t.toUpperCase())}</b>` : esc(x.t.toLowerCase())).join("<i>·</i>")).join(" &nbsp;");
        return {
          id: "r:" + s, answer, n: opts.length, say: text,
          contour: P.contour(P.ensureNucleus(P.parse(s)), (TUNES.find((t) => t.s === s) || {}).t || "fall"),
          render(state) {
            return `<div class="prompt">${esc(text)}</div><div class="opts col">${order.map((oi, i) => {
              let c = "opt"; if (state) { if (i === answer) c += " right"; else if (i === state.choice) c += " wrong"; }
              return `<button class="${c}" data-a="${i}"><kbd>${i + 1}</kbd><span class="pat">${show(opts[oi])}</span></button>`;
            }).join("")}</div>`;
          },
        };
      },
      onReveal(item) { P.hum(item.contour); animate(item.contour); },
    },

    focus: {
      key: "3", name: "Focus", blurb: "Which word carries the main stress in the answer?",
      make() {
        const it = pick(focusPool, (x) => x.id);
        const words = P.parse(it.s);
        const fw = P.setFocus(words, it.f);
        return {
          id: it.id, answer: it.f, n: words.length, contour: P.contour(fw, "fall"),
          render(state) {
            const st = {}; if (state) { st[it.f] = "right"; if (state.choice !== it.f) st[state.choice] = "wrong"; }
            return `<div class="ctx">“${esc(it.q)}”</div><div class="prompt words">${wordsHTML(state ? fw : words, { numbers: true, state: st, showNuc: !!state })}</div>`;
          },
          clickable: ".w",
        };
      },
      onReveal(item) { P.hum(item.contour); animate(item.contour); },
    },

    tune: {
      key: "4", name: "Tune", blurb: "Choose the intonation that fits the context.",
      make() {
        const it = pick(TUNES, (x) => "t:" + x.s);
        const words = P.parse(it.s);
        const answer = TUNE_ORDER.indexOf(it.t);
        return {
          id: "t:" + it.s, answer, n: 4, contour: P.contour(words, it.t), words,
          render(state) {
            return `<div class="ctx">${esc(it.ctx)}</div><div class="prompt words">${wordsHTML(words, { showNuc: true, showStress: true })}</div>${tuneOpts(answer, state)}${state ? `<div class="why">${esc(it.why)}</div>` : ""}`;
          },
        };
      },
      onReveal(item) { P.hum(item.contour); animate(item.contour); },
      compare(item, state) { if (state && state.choice !== item.answer) { const c = P.contour(item.words, TUNE_ORDER[state.choice]); P.hum(c); animate(c); } },
    },

    ear: {
      key: "5", name: "Ear training", blurb: "Listen to the hum. Identify the tune or the focus word.",
      autoplay: true,
      make() {
        if (Math.random() < 0.5) {
          const it = pick(TUNES, (x) => "e:" + x.s);
          const t = rand(TUNE_ORDER);
          const words = P.parse(it.s);
          const answer = TUNE_ORDER.indexOf(t);
          return {
            id: "et:" + it.s + t, answer, n: 4, contour: P.contour(words, t),
            render(state) { return `<div class="ctx">Which tune?</div><div class="prompt words">${wordsHTML(words, { showNuc: true, showStress: true })}</div>${tuneOpts(answer, state)}`; },
          };
        }
        const g = rand(FOCUS);
        const words = P.parse(g.s);
        const cands = words.map((w, i) => i).filter((i) => words[i].syls.some((s) => s.stress));
        const f = rand(cands);
        const fw = P.setFocus(words, f);
        return {
          id: "ef:" + g.s + f, answer: f, n: words.length, contour: P.contour(fw, "fall"), clickable: ".w",
          render(state) {
            const st = {}; if (state) { st[f] = "right"; if (state.choice !== f) st[state.choice] = "wrong"; }
            return `<div class="ctx">Which word is focused?</div><div class="prompt words">${wordsHTML(state ? fw : words, { numbers: true, state: st, showNuc: !!state })}</div>`;
          },
        };
      },
      onShow(item) { setTimeout(() => { P.hum(item.contour); animate(item.contour, { hidden: true }); }, 250); },
      onReveal(item) { P.hum(item.contour); animate(item.contour); },
    },

    shadow: {
      key: "6", name: "Shadow", blurb: "Hum or say it into the mic. Match the melody.",
      production: true,
      make() {
        const pool = [...TUNES.map((t) => ({ s: t.s, t: t.t, ctx: t.ctx, id: "s:" + t.s })), ...focusPool.map((x) => ({ s: x.s, f: x.f, t: "fall", ctx: "Answer: “" + x.q + "”", id: "s:" + x.id }))];
        const it = pick(pool, (x) => x.id);
        let words = P.parse(it.s);
        if (it.f != null) words = P.setFocus(words, it.f);
        const c = P.contour(words, it.t);
        return {
          id: it.id, contour: c, say: words.map((w) => w.text).join(" "),
          render() {
            const ti = TUNE_INFO[it.t];
            return `<div class="ctx">${esc(it.ctx)}</div><div class="prompt words">${wordsHTML(c.words, { showNuc: true, showStress: true })}</div><div class="tag">${ti.sym} ${ti.name}</div>`;
          },
        };
      },
      onShow(item) { setTimeout(() => { P.hum(item.contour); animate(item.contour); }, 250); },
    },
  };

  function tuneOpts(answer, state) {
    return `<div class="opts">${TUNE_ORDER.map((t, i) => {
      const ti = TUNE_INFO[t];
      let c = "opt tune"; if (state) { if (i === answer) c += " right"; else if (i === state.choice) c += " wrong"; }
      return `<button class="${c}" data-a="${i}"><kbd>${ti.key}</kbd><span class="sym">${ti.sym}</span><span>${ti.name}<small>${ti.desc}</small></span></button>`;
    }).join("")}</div>`;
  }

  // ---------- state ----------
  let S = null; // current round
  let screen = "home";
  let rec = null, micBusy = false;

  const canvas = () => $("#contour");

  let animId = 0;
  function animate(c, opts = {}) {
    const id = ++animId;
    const cur = P.playing();
    const cv = canvas();
    const user = opts.user || (S && S.user);
    if (opts.hidden) { cv.classList.add("hidden-contour"); } else cv.classList.remove("hidden-contour");
    const step = () => {
      if (id !== animId) return;
      const t = P.audio().currentTime - (cur ? cur.t0 : 0);
      P.draw(cv, c, { head: t, user });
      if (t < c.total + 0.1) requestAnimationFrame(step); else P.draw(cv, c, { user });
    };
    step();
  }

  function startRound(modeKey) {
    const mode = MODES[modeKey];
    P.audio().resume?.();
    recent = [];
    S = { modeKey, mode, i: 0, n: mode.production ? SHADOW_ROUND : ROUND, score: 0, streak: 0, best: 0, correct: 0, misses: [], times: [], scores: [] };
    show("drill");
    nextItem();
  }

  function nextItem() {
    stopRec();
    if (S.i >= S.n) return endRound();
    S.item = S.mode.make();
    S.state = null; S.user = null; S.t0 = performance.now();
    S.i++;
    renderDrill();
    const cv = canvas();
    if (S.mode.production) P.draw(cv, S.item.contour);
    else { P.draw(cv, null); cv.classList.add("hidden-contour"); }
    S.mode.onShow && S.mode.onShow(S.item);
  }

  function answer(a) {
    if (!S || S.state || S.mode.production) return;
    const it = S.item;
    if (a < 0 || a >= it.n) return;
    const ok = a === it.answer;
    const dt = (performance.now() - S.t0) / 1000;
    S.times.push(dt);
    record(it.id, ok);
    if (ok) {
      S.correct++; S.streak++; S.best = Math.max(S.best, S.streak);
      const speed = Math.max(0, Math.round(10 - dt * 2));
      S.gain = Math.round((10 + speed) * Math.min(2, 1 + S.streak * 0.1));
      S.score += S.gain;
    } else { S.streak = 0; S.gain = 0; S.misses.push(it); }
    S.state = { choice: a, ok };
    renderDrill();
    canvas().classList.remove("hidden-contour");
    S.mode.onReveal && S.mode.onReveal(it);
  }

  function endRound() {
    P.stop(); stopRec();
    const k = "best:" + S.modeKey;
    const prev = store.get(k, 0);
    S.newBest = S.score > prev;
    if (S.newBest) store.set(k, S.score);
    show("end");
    const avg = S.times.length ? (S.times.reduce((a, b) => a + b, 0) / S.times.length).toFixed(1) : "–";
    const prod = S.mode.production;
    const avgScore = S.scores.length ? Math.round(S.scores.reduce((a, b) => a + b, 0) / S.scores.length) : 0;
    $("#end").innerHTML = `
      <h2>${esc(S.mode.name)} — round done</h2>
      <div class="stats">
        <div><b>${S.score}</b><span>points${S.newBest ? " · new best!" : ""}</span></div>
        ${prod ? `<div><b>${avgScore}</b><span>avg match</span></div>` :
        `<div><b>${S.correct}/${S.n}</b><span>correct</span></div><div><b>${avg}s</b><span>avg answer</span></div><div><b>${S.best}</b><span>best streak</span></div>`}
      </div>
      ${S.misses.length ? `<h3>Missed (these come back more often)</h3><ul class="misses">${S.misses.map((m) => `<li>${missText(m)}</li>`).join("")}</ul>` : prod ? "" : `<p class="muted">Perfect round.</p>`}
      <p class="keys"><kbd>Enter</kbd> again &nbsp; <kbd>Esc</kbd> menu</p>`;
  }

  function missText(m) {
    const c = m.contour;
    return c.syls.map((s, i) => {
      const sep = i && c.syls[i - 1].wi !== s.wi ? " " : "";
      const t = esc(s.t);
      return sep + (s.nuc ? `<span class="nuc">${t.toUpperCase()}</span>` : s.stress ? `<b>${t}</b>` : t);
    }).join("");
  }

  // ---------- shadow / mic ----------
  async function toggleRec() {
    if (!S || !S.mode.production) return;
    if (rec) return stopRec(true);
    if (micBusy) return;
    try {
      micBusy = true;
      if (!Pitch.ready()) { setStatus("Allow microphone access…"); await Pitch.init(); }
    } catch (e) { setStatus("Microphone unavailable: " + e.message); micBusy = false; return; }
    micBusy = false;
    P.stop();
    const c = S.item.contour;
    setStatus(`<span class="rec-dot"></span> Recording… <kbd>R</kbd> to stop`);
    $("#drill").classList.add("recording");
    rec = Pitch.record(Math.max(3, c.total * 2 + 1.2), (frames) => {
      // live preview: plot last frames on a rolling axis
      const pts = Pitch.clean(frames);
      if (pts.length > 3) { const sc = Pitch.score(c, pts); if (sc) P.draw(canvas(), c, { user: sc.user }); }
    }, (frames) => finishRec(frames));
  }
  function stopRec(finish) { if (rec) { const r = rec; if (finish) r.stop(); else { rec = null; r.cancel(); } } $("#drill")?.classList.remove("recording"); }

  function finishRec(frames) {
    rec = null; $("#drill").classList.remove("recording");
    const c = S.item.contour;
    const pts = Pitch.clean(frames);
    const sc = Pitch.score(c, pts);
    if (!sc) { setStatus("Couldn't hear enough voice — try again, a bit louder. <kbd>R</kbd>"); return; }
    S.user = sc.user;
    P.draw(canvas(), c, { user: sc.user });
    const first = !S.state;
    if (first || sc.score > S.state.score) {
      if (S.state) S.score -= S.state.score;
      S.score += sc.score;
      S.state = { score: sc.score };
      if (first) S.scores.push(sc.score); else S.scores[S.scores.length - 1] = sc.score;
    }
    record(S.item.id, sc.score >= 60);
    const tips = [];
    if (sc.end === false) tips.push(`ending should ${c.tune === "rise" || c.tune === "fallrise" ? "go up" : "go down"}`);
    if (!sc.rangeOk) tips.push("use more pitch range — exaggerate!");
    if (sc.r < 0.5) tips.push("the overall shape is off; hum it first, then add words");
    setStatus(`<b class="sc ${sc.score >= 75 ? "good" : sc.score >= 50 ? "ok" : "bad"}">${sc.score}</b> match` +
      (tips.length ? ` · ${tips.join(" · ")}` : " · nice!") + `<br><span class="muted">R retry · Space model · Enter next</span>`);
    renderTop();
  }

  function setStatus(html) { $("#status").innerHTML = html; }

  // ---------- rendering ----------
  function show(name) {
    screen = name;
    ["home", "drill", "end"].forEach((n) => ($("#" + n).hidden = n !== name));
    if (name === "home") renderHome();
  }

  function renderHome() {
    $("#modes").innerHTML = Object.entries(MODES).map(([k, m]) =>
      `<button class="mode" data-mode="${k}"><kbd>${m.key}</kbd><span><b>${m.name}</b><small>${m.blurb}</small></span><em>${store.get("best:" + k, 0) || ""}</em></button>`).join("");
    $("#voice").textContent = P.settings.base < 150 ? "low" : "high";
  }

  function renderTop() {
    $("#top").innerHTML = `<span>${esc(S.mode.name)}</span><span class="prog"><i style="width:${((S.i - (S.state ? 0 : 1)) / S.n) * 100}%"></i></span><span>${S.i}/${S.n}</span><span class="pts">${S.score}</span>${S.mode.production ? "" : `<span class="streak ${S.streak >= 3 ? "hot" : ""}">×${S.streak}</span>`}`;
  }

  function renderDrill() {
    renderTop();
    const st = S.state;
    $("#card").innerHTML = S.item.render(st);
    $("#card").querySelectorAll("[data-a]").forEach((b) => b.addEventListener("click", () => answer(+b.dataset.a)));
    if (S.item.clickable) $("#card").querySelectorAll(S.item.clickable).forEach((el, i) => el.addEventListener("click", () => answer(i)));
    let html = "";
    if (S.mode.production) html = `<kbd>Space</kbd> hear model hum &nbsp; <kbd>R</kbd> record/stop &nbsp; <kbd>T</kbd> natural voice &nbsp; <kbd>Enter</kbd> next`;
    else if (!st) html = S.mode.autoplay ? `<kbd>Space</kbd> replay` : "";
    else if (st.ok) html = `<b class="good">+${S.gain}</b> &nbsp; <kbd>Enter</kbd> next &nbsp; <kbd>Space</kbd> replay`;
    else html = `<b class="bad">✗</b> &nbsp; <kbd>Enter</kbd> next &nbsp; <kbd>Space</kbd> replay${S.mode.compare ? " &nbsp; <kbd>C</kbd> hear your choice" : ""}`;
    if (S.item.say && st && !S.mode.production) html += ` &nbsp; <kbd>T</kbd> say it`;
    setStatus(html);
    clearTimeout(S.auto);
    if (st && st.ok && autoAdvance) S.auto = setTimeout(() => { if (S && S.state === st && screen === "drill") nextItem(); }, S.modeKey === "stress" ? 2200 : 1600);
  }

  let autoAdvance = store.get("auto", true);

  // ---------- keyboard ----------
  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k === "?") { $("#help").hidden = !$("#help").hidden; return; }
    if (!$("#help").hidden && (k === "Escape" || k === "?")) { $("#help").hidden = true; return; }
    if (screen === "home") {
      const m = Object.entries(MODES).find(([, m]) => m.key === k);
      if (m) { e.preventDefault(); startRound(m[0]); }
      else if (k === "v" || k === "V") { P.settings.base = P.settings.base < 150 ? 200 : 120; store.set("base", P.settings.base); renderHome(); P.hum(P.contour(P.parse("'hel-lo"), "fall")); }
      else if (k === "a" || k === "A") { autoAdvance = !autoAdvance; store.set("auto", autoAdvance); $("#auto").textContent = autoAdvance ? "on" : "off"; }
      return;
    }
    if (screen === "end") {
      if (k === "Enter" || k === " ") { e.preventDefault(); startRound(S.modeKey); }
      if (k === "Escape") show("home");
      return;
    }
    // drill
    if (k === "Escape") { P.stop(); stopRec(); clearTimeout(S.auto); show("home"); return; }
    if (/^[1-9]$/.test(k)) { e.preventDefault(); answer(+k - 1); return; }
    if (k === " ") {
      e.preventDefault();
      if (rec) return;
      if (S.mode.production || S.state || S.mode.autoplay) { P.hum(S.item.contour); animate(S.item.contour, { hidden: !S.state && !S.mode.production }); }
      return;
    }
    if (k === "Enter" || k === "ArrowRight") {
      e.preventDefault();
      if (S.state || S.mode.production) { clearTimeout(S.auto); nextItem(); }
      return;
    }
    if ((k === "r" || k === "R") && S.mode.production) { e.preventDefault(); toggleRec(); return; }
    if ((k === "t" || k === "T") && S.item.say && (S.state || S.mode.production)) { P.say(S.item.say); return; }
    if ((k === "c" || k === "C") && S.mode.compare) { S.mode.compare(S.item, S.state); return; }
  });

  $("#modes").addEventListener("click", (e) => { const b = e.target.closest("[data-mode]"); if (b) startRound(b.dataset.mode); });
  window.addEventListener("resize", () => { if (screen === "drill" && S && S.item) P.draw(canvas(), S.state || S.mode.production ? S.item.contour : null, { user: S.user }); });

  P.settings.base = store.get("base", 120);
  $("#auto").textContent = autoAdvance ? "on" : "off";
  show("home");
})();
