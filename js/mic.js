// Microphone capture with voice-activity auto-stop, plus optional speech recognition.
(function () {
  const M = {};
  let ac, stream, src, proc, chunks = [], state = "idle", floor = 0.004, cb = {}, speechBlocks = 0, silentBlocks = 0, started = false, t0 = 0;
  let recog = null, recogText = null, recogDone = null;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  M.canRecognize = !!SR;

  M.ready = () => !!proc;

  M.init = async function () {
    if (proc) return;
    ac = Prosody.audio();
    if (ac.state === "suspended") await ac.resume();
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: true, channelCount: 1 },
    });
    src = ac.createMediaStreamSource(stream);
    proc = ac.createScriptProcessor(2048, 1, 1);
    const mute = ac.createGain(); mute.gain.value = 0;
    src.connect(proc); proc.connect(mute); mute.connect(ac.destination);
    proc.onaudioprocess = (e) => {
      const x = e.inputBuffer.getChannelData(0);
      let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * x[i];
      const rms = Math.sqrt(s / x.length);
      const blk = x.length / ac.sampleRate;
      if (state !== "rec") { floor = floor * 0.95 + Math.min(rms, floor * 3) * 0.05; return; }
      chunks.push(new Float32Array(x));
      const on = Math.max(floor * 4, 0.008);
      cb.level && cb.level(rms, on);
      if (rms > on) { speechBlocks++; silentBlocks = 0; if (speechBlocks >= 3) started = true; }
      else { speechBlocks = 0; silentBlocks++; }
      const el = chunks.length * blk;
      if ((started && silentBlocks * blk > 0.85) || el > cb.maxSec || (!started && el > 7)) M.stop();
    };
  };

  M.start = function (opts) {
    cb = opts; chunks = []; speechBlocks = 0; silentBlocks = 0; started = false; state = "rec"; t0 = performance.now();
    recogText = null;
    if (SR && opts.recognize) {
      try {
        recog = new SR(); recog.lang = "en-US"; recog.interimResults = false; recog.maxAlternatives = 3; recog.continuous = true;
        const alts = [];
        recogDone = new Promise((res) => {
          recog.onresult = (e) => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) for (const a of e.results[i]) alts.push(a.transcript); };
          recog.onend = () => res(alts.length ? alts : []);
          recog.onerror = () => res(null);
        });
        recog.start();
      } catch (e) { recog = null; recogDone = null; }
    }
  };

  M.stop = function () {
    if (state !== "rec") return;
    state = "idle";
    const n = chunks.reduce((a, c) => a + c.length, 0), x = new Float32Array(n);
    let o = 0; for (const c of chunks) { x.set(c, o); o += c.length; }
    let rp = null;
    if (recog) {
      try { recog.stop(); } catch (e) {}
      rp = Promise.race([recogDone, new Promise((r) => setTimeout(() => r(null), 2500))]);
      recog = null;
    }
    cb.done && cb.done({ samples: x, sr: ac.sampleRate, heard: started, recognition: rp });
  };

  M.cancel = function () { if (state === "rec") { cb = {}; state = "idle"; try { recog && recog.abort(); } catch (e) {} recog = null; } };
  M.recording = () => state === "rec";

  M.play = function (samples, sr) {
    Prosody.stop();
    const a = Prosody.audio();
    const buf = a.createBuffer(1, samples.length, sr);
    buf.copyToChannel(samples, 0);
    const s = a.createBufferSource(); s.buffer = buf; s.connect(a.destination); s.start();
    Prosody.setCurrent({ osc: s, t0: a.currentTime });
  };

  window.Mic = M;
})();
