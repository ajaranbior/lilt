# Step 2: synthesise every item with each Kokoro voice, with per-phoneme timings.
# Uses a copy of the Kokoro ONNX graph that also outputs the predicted durations
# (see make_dur_model.py). Output: work/raw/<voice>/<file>.wav + <file>.json
# usage: python tts.py <work dir> <kokoro-dur.onnx> <voices.bin>
import json, os, sys
import numpy as np, onnxruntime as ort, soundfile as sf
from kokoro_onnx import Kokoro
work, model, voices = sys.argv[1:4]
VOICES = {"f": "af_heart", "m": "am_michael"}
SR, HOP = 24000, 600  # Kokoro: 24 kHz, one duration frame = 600 samples (25 ms)
k = Kokoro(model, voices)  # only used for its phonemizer/tokenizer and voice styles
sess = ort.InferenceSession(model)
items = json.load(open(os.path.join(work, "items.json")))
for key, voice in VOICES.items():
    out = os.path.join(work, "raw", key); os.makedirs(out, exist_ok=True)
    styles = k.get_voice_style(voice)
    for i, it in enumerate(items):
        p = os.path.join(out, it["file"])
        if os.path.exists(p + ".json"): continue
        text = (it["carrier"] + " " + it["tts"]) if it.get("carrier") else it["tts"]
        ph = k.tokenizer.phonemize(text, "en-us")
        toks = k.tokenizer.tokenize(ph)
        res = sess.run(None, {"tokens": np.array([[0, *toks, 0]], dtype=np.int64),
                              "style": np.array(styles[len(toks)], dtype=np.float32).reshape(1, 256),
                              "speed": np.ones(1, dtype=np.float32)})
        audio, dur = res[0].ravel(), res[1].ravel().astype(int).tolist()
        # token i (1..len) <-> character i-1 of the phoneme string (Kokoro tokenises per character)
        chars = [c for c in ph if c in k.tokenizer.vocab] if hasattr(k.tokenizer, "vocab") else list(ph)
        start = 0
        if it.get("carrier"):  # drop "the "/"to " (whatever its pronunciation) using the predicted timing
            c = ph[: ph.index(" ") + 1] if " " in ph else ""
            if c:
                start = sum(dur[: 1 + len(c)]) * HOP - int(0.02 * SR)
                dur = [dur[0] - 0] + dur[1 + len(c):]  # keep lead pad, drop carrier tokens
                ph = ph[len(c):]; chars = chars[len(c):]
                # recompute lead so timings stay aligned with the cut audio
                dur[0] = max(0, int(round(0.02 * SR / HOP)))
            else:
                print("carrier mismatch", text, ph)
        audio = audio[max(0, start):]
        sf.write(p + ".wav", audio, SR)
        json.dump({"ph": ph, "chars": chars, "dur": dur, "hop": HOP / SR}, open(p + ".json", "w"))
        if i % 100 == 0: print(key, i, "/", len(items), flush=True)
print("done")
