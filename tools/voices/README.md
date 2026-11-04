# Model voices

Builds `audio/` (the natural model voice for every phrase) from the content in `js/data.js` + `js/bank.js`.
Re-run it after adding phrases.

1. **Synthesis.** [Kokoro-82M](https://github.com/hexgrad/kokoro) (Apache-2.0) via `kokoro-onnx`, with voices
   `af_heart` (female) and `am_michael` (male). A copy of the ONNX graph also outputs Kokoro's per-phoneme
   durations, which give exact syllable timings for every recording.
2. **Prosody correction.** Each take is analysed with Lilt's own analyzer, using those timings. The natural take
   and three correction strengths (TD-PSOLA re-synthesis toward the target tune, focus and rhythm) are scored,
   and the best one is kept. Natural takes win when they already match.
3. **Encoding.** 40 kbps mono MP3, plus `audio/manifest.json` (file, quality score and syllable times per voice).

```bash
python3 -m venv venv && venv/bin/pip install kokoro-onnx soundfile onnx
curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
venv/bin/python make_dur_model.py kokoro-v1.0.onnx kokoro-dur.onnx
node items.js work
venv/bin/python tts.py work kokoro-dur.onnx voices-v1.0.bin
node build.js work        # needs ffmpeg
```

Noun/verb pairs (REcord / reCORD) are synthesised in context ("the record" / "to record") so the phonemizer picks
the right stress, and the carrier word is cut off using the predicted timings.
