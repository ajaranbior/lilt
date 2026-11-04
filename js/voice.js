// Pre-recorded model voice (natural TTS, prosody-corrected offline by tools/voices).
(function () {
  const V = {};
  let manifest = null;
  const cache = new Map();

  V.ready = fetch("audio/manifest.json").then((r) => (r.ok ? r.json() : null)).then((m) => { manifest = m; }).catch(() => {});
  V.voice = () => Coach.store.get("voice", "f");
  V.has = (item) => !!(manifest && manifest.items[item.id] && manifest.items[item.id][V.voice()] != null);

  V.buffer = function (item) {
    const vk = V.voice(), key = vk + "|" + item.id;
    if (!cache.has(key)) {
      const p = fetch(`audio/${vk}/${manifest.items[item.id].file}.mp3`)
        .then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then((b) => Prosody.audio().decodeAudioData(b));
      p.catch(() => cache.delete(key));
      cache.set(key, p);
    }
    return cache.get(key);
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
