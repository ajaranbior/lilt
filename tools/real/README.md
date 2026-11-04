# Real recordings (mirror items)

Builds `audio/real/` + `audio/real.json`: 449 everyday sentences recorded by a native US English speaker
(Tatoeba user **CK**), for "mirror a real speaker" practice.

- **Source and licence:** [Tatoeba](https://tatoeba.org), recordings by CK, licensed
  [CC BY-NC-ND 3.0](https://creativecommons.org/licenses/by-nc-nd/3.0/). The MP3s are shipped **unmodified**,
  with attribution shown in the app next to each phrase. Non-commercial use only: if the app is ever sold or
  monetised, these recordings must be removed or replaced.
- **Selection** (`select.py`): CK sentences of 3–9 words without names, balanced across statements, wh-questions,
  yes/no questions, exclamations, tag and choice questions, plus every phrase from Lilt's own bank that CK recorded.
- **Markup** (`markup.js`): syllables and lexical stress from the CMU Pronouncing Dictionary, spelling splits from
  hyphenation patterns, and function words unstressed.
- **Analysis** (`build.js`): each recording is aligned (MFCC + DTW, `js/align.js`) to a Kokoro reading of the same
  text, whose syllable timings are known (see `tools/voices`). That gives the syllables in the human recording.
  From them the build measures the speaker's main stress, the tune they used and their pitch curve, which becomes
  the target line in the app. Recordings whose alignment doesn't fit the speech are rejected.

```bash
# Tatoeba exports: sentences_with_audio.tar.bz2 and per_language/eng/eng_sentences.tsv.bz2 from downloads.tatoeba.org
python3 select.py <tatoeba dir> ours.json work/selected.json 400
node prep.js work/selected.json work
# download https://tatoeba.org/audio/download/<audio id> for each item into mp3/
python ../voices/tts.py work kokoro-dur.onnx voices-v1.0.bin f
npm install && node build.js work mp3
```
