// Pre-recorded model voice (natural TTS, prosody-corrected offline by tools/voices).
(function () {
  const V = {};
  let manifest = null;
  const cache = new Map();

  V.ready = fetch("audio/manifest.json").then((r) => (r.ok ? r.json() : null)).then((m) => { manifest = m; }).catch(() => {});
  V.voice = () => Coach.store.get("voice", "f");
  V.has = (item) => !!item.real || !!(manifest && manifest.items[item.id] && manifest.items[item.id][V.voice()] != null);

  V.buffer = function (item) {
    const vk = item.real ? "real" : V.voice(), key = vk + "|" + item.id;
    if (!cache.has(key)) {
      const url = item.real ? `audio/real/${item.real.aid}.mp3` : `audio/${vk}/${manifest.items[item.id].file}.mp3`;
      const p = fetch(url)
        .then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then((b) => Prosody.audio().decodeAudioData(b));
      p.catch(() => cache.delete(key));
      cache.set(key, p);
    }
    return cache.get(key);
  };
  // the speaker's recording with its syllable times, for aligning the learner's attempt to it
  const models = new Map();
  V.model = async function (item) {
    if (!item.real) return null;
    if (models.has(item.id)) return models.get(item.id);
    const buf = await V.buffer(item);
    const samples = buf.getChannelData(0), sr = buf.sampleRate;
    const x = Analyze.extract(samples, sr);
    const sh = x ? x.t0 - item.real.t0 : 0; // decoders can shift MP3 audio slightly
    const m = { samples, sr, syl: item.real.syl.map(([a, b]) => ({ a: a + sh, b: b + sh })) };
    models.set(item.id, m);
    return m;
  };
  V.prefetch = (item) => { if (V.has(item)) V.buffer(item).catch(() => {}); };

  V.play = async function (item) {
    const buf = await V.buffer(item);
    const a = Prosody.audio();
    if (a.state === "suspended") await a.resume();
    Prosody.stop();
    const s = a.createBufferSource();
    s.buffer = buf; s.connect(a.destination);
    const t0 = a.currentTime + 0.02;
    s.start(t0);
    Prosody.setCurrent({ osc: s, t0 });
    return { t0, dur: buf.duration };
  };

  window.Voice = V;
})();
