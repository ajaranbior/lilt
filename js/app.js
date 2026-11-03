// Lilt: speak → instant prosody feedback → next. The coach picks what you practise.
(function () {
  const $ = (s) => document.querySelector(s);
  const P = Prosody, C = Coach;
  const SESSION = 10;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const DIM_NAMES = { melody: "Melody", focus: "Main stress", wordstress: "Word stress", rhythm: "Rhythm", range: "Pitch range", clarity: "Clarity" };

  let screen = "home", S = null;
  const opt = { autoModel: C.store.get("autoModel", true), autoNext: C.store.get("autoNext", true) };

  // ---------- rendering helpers ----------
  function sentenceHTML(item, hide) {
    return item.words.map((w) => `<span class="w">${w.syls.map((s) => {
      if (hide) return esc(s.t);
      return s.nuc ? `<span class="nuc">${esc(s.t)}</span>` : s.stress ? `<span class="str">${esc(s.t)}</span>` : esc(s.t);
    }).join(item.kind === "word" && !hide ? "<i>·</i>" : "")}</span>`).join(" ");
  }

  function bar(v) { const c = v >= 80 ? "good" : v >= 55 ? "ok" : "bad"; return `<span class="bar ${c}"><i style="width:${Math.max(3, v)}%"></i></span>`; }

  function renderHome() {
    const prof = C.profile();
    const seen = C.order.filter((k) => C.enabled(k) && prof[k] && prof[k].n);
    const weak = C.weakest(2);
    $("#profile").innerHTML = seen.length ? `
      <h3>Your profile</h3>
      <div class="skills">${C.order.filter(C.enabled).map((k) => {
        const s = prof[k];
        if (!s || !s.n) return `<div class="skill pending"><span>${C.SKILLS[k].name}</span><span class="bar"><i style="width:0"></i></span><em>–</em></div>`;
        const m = Math.round(s.mu);
        return `<div class="skill ${weak.includes(k) ? "weak" : ""}"><span>${C.SKILLS[k].name}${s.n >= 4 && m >= 85 ? " ✓" : ""}</span>${bar(m)}<em>${m}</em></div>`;
      }).join("")}</div>
      ${weak.length ? `<p class="coachnote">Coach focus: <b>${weak.map((k) => C.SKILLS[k].name.toLowerCase()).join("</b> and <b>")}</b>.</p>` : ""}`
      : `<p class="coachnote">Your first ~10 phrases are a placement check. After that the coach keeps serving what you find hardest.</p>`;
    $("#o-model").textContent = opt.autoModel ? "on" : "off";
    $("#o-next").textContent = opt.autoNext ? "on" : "off";
    $("#o-voice").textContent = P.settings.base < 150 ? "low" : "high";
    $("#o-recog").textContent = Mic.canRecognize ? (C.useRecognition() ? "on" : "off") : "n/a in this browser";
  }

  function show(name) {
    screen = name;
    ["home", "drill", "end"].forEach((n) => ($("#" + n).hidden = n !== name));
    if (name === "home") renderHome();
  }

  function renderTop() {
    const it = S.item;
    $("#top").innerHTML = `<span class="chip">${esc(C.SKILLS[it.primary].name)}</span><span class="reason">${esc(it.reason)}</span>
      <span class="prog"><i style="width:${(S.done / SESSION) * 100}%"></i></span><span>${S.done}/${SESSION}</span>`;
  }

  function renderCard() {
    const it = S.item;
    const hide = it.challenge && !S.result;
    const ti = it.kind === "sentence" ? TUNE_INFO[it.tune] : null;
    $("#card").innerHTML = `
      ${it.ctx ? `<div class="ctx">${esc(it.ctx)}</div>` : ""}
      <div class="prompt ${it.kind === "word" ? "big" : ""} words">${sentenceHTML(it, hide)}</div>
      ${ti ? `<div class="tune"><span class="tag">${ti.sym} ${ti.name}</span><span>${esc(ti.how)} <span class="muted">${esc(ti.means)}</span></span></div>` : ""}
      ${hide ? `<span class="tag ghost">from memory: you've mastered this</span>` : ""}
      ${it.primary.startsWith("melody:") ? "" : `<p class="how">${esc(C.SKILLS[it.primary].how)}</p>`}`;
  }

  function drawContour(extra = {}) {
    const it = S.item, cv = $("#contour");
    const hide = it.challenge && !S.result;
    cv.classList.toggle("hidden-contour", hide);
    P.draw(cv, it.contour, { user: S.result && S.result.pts, marks: S.result && S.result.marks, ...extra });
  }

  function keys(html) { $("#keys").innerHTML = html; }
  const K_IDLE = `<kbd>Space</kbd> speak &nbsp; <kbd>M</kbd> model hum &nbsp; <kbd>T</kbd> natural voice &nbsp; <kbd>Enter</kbd> skip &nbsp; <kbd>Esc</kbd> menu`;
  const K_DONE = `<kbd>Space</kbd> try again &nbsp; <kbd>Enter</kbd> next &nbsp; <kbd>P</kbd> hear yourself &nbsp; <kbd>M</kbd> model &nbsp; <kbd>T</kbd> voice`;

  // ---------- flow ----------
  function startSession() {
    S = { done: 0, scores: [], before: JSON.parse(JSON.stringify(C.profile())), skills: new Set() };
    show("drill");
    nextItem();
  }

  function nextItem() {
    clearTimeout(S.auto);
    Mic.cancel(); P.stop();
    if (S.done >= SESSION) return endSession();
    S.item = C.next(); S.result = null; S.attempts = 0; S.rec = null;
    S.skills.add(S.item.primary);
    renderTop(); renderCard(); drawContour();
    $("#feedback").innerHTML = "";
    keys(K_IDLE);
    if (opt.autoModel && !S.item.challenge) setTimeout(() => { if (S && !Mic.recording() && !S.result) playModel(); }, 200);
  }

  let animId = 0;
  function playModel() {
    const it = S.item;
    const { t0 } = P.hum(it.contour);
    const id = ++animId;
    const step = () => {
      if (id !== animId) return;
      const t = P.audio().currentTime - t0;
      drawContour({ head: t });
      if (t < it.contour.total + 0.1) requestAnimationFrame(step); else drawContour();
    };
    step();
  }

  async function speak() {
    if (Mic.recording()) { Mic.stop(); return; }
    animId++; P.stop();
    try { if (!Mic.ready()) { $("#feedback").innerHTML = `<p class="muted">Allow microphone access…</p>`; await Mic.init(); } }
    catch (e) { $("#feedback").innerHTML = `<p class="bad">Microphone unavailable: ${esc(e.message)}. Lilt needs a mic. Check the browser's permission settings.</p>`; return; }
    clearTimeout(S.auto);
    $("#drill").classList.add("recording");
    $("#feedback").innerHTML = `<div class="listening"><span class="rec-dot"></span> Listening… it stops when you pause. <span class="meter"><i></i></span></div>`;
    keys(`<kbd>Space</kbd> stop`);
    const meter = () => $(".meter i");
    Mic.start({
      maxSec: Math.max(4, S.item.contour.total * 2.5 + 1.5),
      recognize: C.useRecognition(),
      level: (rms, on) => { const m = meter(); if (m) m.style.width = Math.min(100, (rms / (on * 4)) * 100) + "%"; },
      done: (rec) => { $("#drill").classList.remove("recording"); finish(rec); },
    });
  }

  function finish(rec) {
    S.rec = rec;
    if (!rec.heard) { $("#feedback").innerHTML = `<p class="bad">I didn't hear anything. Check your mic and speak up a bit.</p>`; keys(K_IDLE); return; }
    const r = Analyze.analyze(rec.samples, rec.sr, S.item);
    if (r.error) { $("#feedback").innerHTML = `<p class="bad">${esc(r.error)}</p>`; keys(K_IDLE); return; }
    S.attempts++;
    S.result = r;
    renderCard(); drawContour();
    const dims = r.dims;
    if (rec.recognition) dims.clarity = { score: null, pending: true };
    renderFeedback(dims);
    keys(K_DONE);
    if (rec.recognition) rec.recognition.then((alts) => {
      if (S.result !== r) return;
      if (alts && alts.length) {
        const best = alts.map((a) => ({ a, ...Analyze.wordAccuracy(S.item.text, a) })).sort((x, y) => y.acc - x.acc)[0];
        dims.clarity = { score: Math.round(best.acc * 100), detail: `heard: “${best.a.trim()}”`, tip: best.missed.length ? `Not recognised: ${best.missed.map((w) => `“${w}”`).join(", ")}.` : "" };
      } else dims.clarity = null; // recognizer unavailable or returned nothing: don't guess
      if (!dims.clarity) delete dims.clarity;
      commit(dims, true);
    });
    else commit(dims, false);
  }

  function commit(dims, final) {
    const it = S.item;
    const overall = C.overall(it, dims);
    // only the first attempt updates the profile (retries are practice); best attempt counts for the session
    if (S.attempts === 1 && !S.committed) { C.update(it, dims); S.committed = true; }
    if (overall != null) {
      C.recordItem(it, overall);
      if (S.attempts === 1) { S.scores[S.done] = overall; } else S.scores[S.done] = Math.max(S.scores[S.done] || 0, overall);
    }
    renderFeedback(dims, overall);
    if (opt.autoNext && overall >= 85) S.auto = setTimeout(() => { if (screen === "drill" && !Mic.recording()) advance(); }, 2200);
  }

  function advance() { if (S.result) S.done++; S.committed = false; nextItem(); }

  function renderFeedback(dims, overall) {
    const rows = Object.entries(dims).filter(([, v]) => v).sort(([a], [b]) => (C.skillOf(S.item, b) === S.item.primary) - (C.skillOf(S.item, a) === S.item.primary));
    const ov = overall ?? C.overall(S.item, dims);
    const ovc = ov >= 80 ? "good" : ov >= 55 ? "ok" : "bad";
    $("#feedback").innerHTML = `
      <div class="overall"><b class="${ovc}">${ov ?? "–"}</b><span>${ov >= 85 ? "Great!" : ov >= 65 ? "Getting there" : "Try again: listen to the model first (M)"}${S.attempts > 1 ? ` · attempt ${S.attempts}` : ""}</span></div>
      ${rows.map(([d, v]) => `<div class="dim ${C.skillOf(S.item, d) === S.item.primary ? "primary" : ""}">
        <span class="dn">${DIM_NAMES[d]}</span>${v.pending ? `<span class="muted">checking…</span>` : `${bar(v.score ?? 0)}<em>${v.score ?? "–"}</em>`}
        <span class="dd">${esc(v.detail || "")}</span>${v.tip ? `<div class="tip">${esc(v.tip)}</div>` : ""}</div>`).join("")}`;
  }

  function endSession() {
    P.stop(); Mic.cancel();
    show("end");
    const prof = C.profile();
    const avg = S.scores.length ? Math.round(S.scores.reduce((a, b) => a + b, 0) / S.scores.filter((x) => x != null).length) : 0;
    const changes = [...new Set([...S.skills, ...Object.keys(prof)])].filter((k) => prof[k] && C.SKILLS[k]).map((k) => {
      const b = S.before[k], a = prof[k];
      return { k, from: b && b.n ? Math.round(b.mu) : null, to: Math.round(a.mu) };
    }).filter((c) => c.from !== c.to);
    const weak = C.weakest(2);
    $("#end").innerHTML = `
      <h2>Session done</h2>
      <div class="stats"><div><b>${avg}</b><span>average score</span></div><div><b>${S.done}</b><span>phrases</span></div></div>
      ${changes.length ? `<h3>Skill changes</h3><div class="skills">${changes.map((c) => `<div class="skill"><span>${C.SKILLS[c.k].name}</span>${bar(c.to)}<em>${c.from == null ? "new" : c.from} → ${c.to}</em></div>`).join("")}</div>` : ""}
      ${weak.length ? `<p class="coachnote">Next session focuses on <b>${weak.map((k) => C.SKILLS[k].name.toLowerCase()).join("</b> and <b>")}</b>.</p>` : ""}
      <p class="keys"><kbd>Space</kbd> next session &nbsp; <kbd>Esc</kbd> menu</p>`;
  }

  // ---------- keyboard ----------
  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const help = $("#help");
    if (k === "?") { help.hidden = !help.hidden; return; }
    if (!help.hidden) { if (k === "Escape") help.hidden = true; return; }
    if (screen === "home") {
      if (k === " " || k === "Enter") { e.preventDefault(); startSession(); }
      else if (k === "m") { opt.autoModel = !opt.autoModel; C.store.set("autoModel", opt.autoModel); renderHome(); }
      else if (k === "n") { opt.autoNext = !opt.autoNext; C.store.set("autoNext", opt.autoNext); renderHome(); }
      else if (k === "v") { P.settings.base = P.settings.base < 150 ? 200 : 120; C.store.set("base", P.settings.base); renderHome(); P.hum(P.contour(P.parse("'hel-lo"), "fall")); }
      else if (k === "r" && Mic.canRecognize) { C.store.set("recog", !C.useRecognition()); renderHome(); }
      else if (k === "x") { if (confirm("Reset your skill profile?")) { C.reset(); renderHome(); } }
      return;
    }
    if (screen === "end") {
      if (k === " " || k === "Enter") { e.preventDefault(); startSession(); }
      if (k === "Escape") show("home");
      return;
    }
    if (k === "g") { const on = !C.store.get("legend", true); C.store.set("legend", on); $("#legend").hidden = !on; return; }
    // drill
    if (k === "Escape") { clearTimeout(S.auto); Mic.cancel(); P.stop(); $("#drill").classList.remove("recording"); show("home"); return; }
    if (k === " ") { e.preventDefault(); speak(); return; }
    if (Mic.recording()) return;
    if (k === "Enter" || k === "ArrowRight") { e.preventDefault(); advance(); return; }
    if (k === "m") { clearTimeout(S.auto); playModel(); return; }
    if (k === "t") { clearTimeout(S.auto); P.say(S.item.text); return; }
    if (k === "p" && S.rec) { clearTimeout(S.auto); Mic.play(S.rec.samples, S.rec.sr); return; }
  });

  $("#start").addEventListener("click", startSession);
  window.addEventListener("resize", () => { if (screen === "drill" && S && S.item) drawContour(); });

  P.settings.base = C.store.get("base", 120);
  $("#legend").hidden = !C.store.get("legend", true);
  // tiny tune diagrams in the help, drawn from the same model as the hum
  document.querySelectorAll("svg[data-tune]").forEach((svg) => {
    const c = P.contour(P.parse("*main word is here"), svg.dataset.tune);
    const pts = c.syls.flatMap((s) => s.pts).map(([t, st]) => `${4 + (t / c.total) * 112},${38 - ((st + 5.5) / 14) * 36}`);
    svg.innerHTML = `<polyline points="${pts.join(" ")}" fill="none" stroke="var(--accent)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
  });
  show("home");
  if (!C.store.get("seenHelp", false)) { $("#help").hidden = false; C.store.set("seenHelp", true); }
})();
