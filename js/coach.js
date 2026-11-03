// Adaptive coach: tracks a skill profile from your attempts and picks what to practise next.
(function () {
  const P = Prosody;
  const C = {};

  C.SKILLS = {
    "melody:fall":     { name: "Falling tunes",        how: "After the main word, let your voice drop clearly to the bottom of your range." },
    "focus:late":      { name: "Sentence stress",      how: "Put the main stress on the last important word, not on small words." },
    "wordstress":      { name: "Word stress",          how: "One syllable per word wins: louder, longer, higher. The others shrink." },
    "melody:rise":     { name: "Rising tunes",         how: "Start the main word low and glide up to the end of the phrase." },
    "rhythm":          { name: "Rhythm & weak syllables", how: "Stretch the stressed syllables and squeeze a, the, to, of, for… in between." },
    "focus:early":     { name: "Contrastive stress",   how: "Hit the contrast word hard, then say everything after it low and quiet." },
    "range":           { name: "Pitch range",          how: "Exaggerate. Go higher on stresses and lower at the end than feels natural." },
    "melody:fallrise": { name: "Fall-rise tunes",      how: "Fall on the main word, then curl up at the very end (‘…but’)." },
    "melody:risefall": { name: "Rise-fall tunes",      how: "Swoop up on the main word, then drop steeply." },
    "clarity":         { name: "Clarity",              how: "Speech recognition should understand every word." },
  };
  const ORDER = Object.keys(C.SKILLS);

  const store = {
    get(k, d) { try { const v = localStorage.getItem("lilt:" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("lilt:" + k, JSON.stringify(v)); } catch (e) {} },
  };
  C.store = store;
  let prof = store.get("profile", {});
  let itemHist = store.get("items", {});
  let recent = [], lastSkills = [];
  C.profile = () => prof;
  C.reset = () => { prof = {}; itemHist = {}; store.set("profile", prof); store.set("items", itemHist); };
  C.enabled = (k) => k !== "clarity" || C.useRecognition();
  C.useRecognition = () => Mic.canRecognize && store.get("recog", true);

  // ---------- item construction ----------
  function sentenceItem(src, primary) {
    let words = P.parse(src.s);
    const base = P.ensureNucleus(words);
    if (src.f != null) words = P.setFocus(words, src.f);
    words = P.ensureNucleus(words);
    const contour = P.contour(words, src.t);
    const nucW = contour.syls.find((s) => s.nuc).wi;
    let lastStressW = 0; base.forEach((w, i) => { if (w.syls.some((s) => s.stress)) lastStressW = i; });
    const focusKind = nucW < lastStressW ? "focus:early" : "focus:late";
    return {
      kind: "sentence", id: "s:" + src.s + "|" + (src.f ?? "") + "|" + src.t, primary, contour, words: contour.words,
      text: contour.words.map((w) => w.text).join(" "), ctx: src.ctx || (src.q ? `Answer: “${src.q}”` : ""),
      tune: src.t, focusKind, nSyl: contour.syls.length,
    };
  }
  function wordItem(e, primary) {
    const w = P.wordStressMarkup(e);
    const words = [{ text: w.text, syls: w.syls.map((t, i) => ({ t, stress: i === w.idx ? 1 : 0, nuc: i === w.idx })) }];
    return { kind: "word", id: "w:" + e, primary, contour: P.contour(words, "fall", { rate: 0.85 }), words, text: w.text, hint: w.hint, stressIdx: w.idx, ctx: w.hint ? `(${w.hint})` : "" };
  }

  const FOCUS_ITEMS = []; FOCUS.forEach((g) => g.items.forEach(([q, f]) => FOCUS_ITEMS.push({ s: g.s, q, f, t: "fall" })));
  const sylCount = (s) => P.parse(s.s).reduce((a, w) => a + w.syls.length, 0);
  const ALL_SENT = [...TUNES, ...RHYTHM];

  function pool(skill) {
    if (skill.startsWith("melody:")) { const t = skill.split(":")[1]; return ALL_SENT.filter((x) => x.t === t).map((x) => () => sentenceItem(x, skill)); }
    if (skill === "focus:early" || skill === "focus:late") {
      return [...FOCUS_ITEMS, ...(skill === "focus:late" ? RHYTHM : [])].map((x) => () => sentenceItem(x, skill)).filter((mk) => mk().focusKind === skill);
    }
    if (skill === "wordstress") return WORDS.map((e) => () => wordItem(e, skill));
    if (skill === "rhythm") return ALL_SENT.filter((x) => sylCount(x) >= 6).map((x) => () => sentenceItem(x, skill));
    if (skill === "range") return TUNES.filter((x) => x.t !== "fall").map((x) => () => sentenceItem(x, skill));
    return [...ALL_SENT, ...FOCUS_ITEMS].map((x) => () => sentenceItem(x, skill));
  }

  // ---------- choosing ----------
  C.priority = function (k) {
    const s = prof[k];
    if (!s || !s.n) return 1000 - ORDER.indexOf(k); // placement: each skill once, in order
    let p = 100 - s.mu + (s.n < 3 ? 10 : 0) + Math.random() * 12;
    if (lastSkills.slice(-2).every((x) => x === k) && lastSkills.length >= 2) p -= 25; // don't hammer one thing forever
    return p;
  };

  C.next = function () {
    const ks = ORDER.filter(C.enabled);
    const skill = ks.reduce((a, k) => (C.priority(k) > C.priority(a) ? k : a), ks[0]);
    lastSkills.push(skill);
    const mks = pool(skill).map((mk) => mk());
    const fresh = mks.filter((it) => !recent.includes(it.id));
    const list = fresh.length ? fresh : mks;
    const w = list.map((it) => { const h = itemHist[it.id]; return h == null ? 1.5 : 1 + (100 - h) / 30; });
    let r = Math.random() * w.reduce((a, b) => a + b, 0), i = 0;
    while ((r -= w[i]) > 0 && i < list.length - 1) i++;
    const item = list[i];
    recent.push(item.id); if (recent.length > 8) recent.shift();
    const s = prof[skill];
    item.reason = !s || !s.n ? "placement check" : `your score: ${Math.round(s.mu)}`;
    item.challenge = !!(s && s.n >= 4 && s.mu >= 85); // mastered: do it from memory
    return item;
  };

  // ---------- updating ----------
  C.skillOf = (item, dim) => ({ melody: "melody:" + item.tune, focus: item.focusKind, wordstress: "wordstress", rhythm: "rhythm", range: "range", clarity: "clarity" })[dim];

  C.update = function (item, dims) {
    const before = {};
    Object.entries(dims).forEach(([d, v]) => {
      if (!v || v.score == null) return;
      const k = C.skillOf(item, d); if (!k || !C.SKILLS[k]) return;
      const s = (prof[k] ||= { mu: 0, n: 0 });
      before[k] = s.n ? s.mu : null;
      const a = k === item.primary ? 0.35 : 0.2;
      s.mu = s.n ? s.mu + a * (v.score - s.mu) : v.score;
      s.n++;
    });
    store.set("profile", prof);
    return before;
  };

  C.overall = function (item, dims) {
    let a = 0, w = 0;
    Object.entries(dims).forEach(([d, v]) => { if (!v || v.score == null) return; const k = C.skillOf(item, d); const wt = k === item.primary ? 2 : 1; a += v.score * wt; w += wt; });
    return w ? Math.round(a / w) : null;
  };

  C.recordItem = (item, score) => { itemHist[item.id] = itemHist[item.id] == null ? score : Math.round(itemHist[item.id] * 0.5 + score * 0.5); store.set("items", itemHist); };

  C.weakest = function (n = 2) {
    return ORDER.filter((k) => C.enabled(k) && prof[k] && prof[k].n).sort((a, b) => prof[a].mu - prof[b].mu).slice(0, n);
  };
  C.order = ORDER;

  window.Coach = C;
})();
