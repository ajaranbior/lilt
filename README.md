# lilt ↗↘

**▶ Try it: https://ajaranbior.github.io/lilt/**

A speaking coach for English **intonation, stress and rhythm**. You say a phrase, Lilt measures how you said it
and gives you instant, concrete feedback. It builds a profile of your weak spots and keeps giving you more practice on them.
Everything is keyboard-driven and fast.

## How a session works

1. Press `Space` on the menu to start a 10-phrase session.
2. Each phrase shows its stress marks (**bold** = stressed, orange = main stress) and the target melody line.
   A hummed model plays first, so you hear only the melody.
3. Press `Space` and speak. Recording stops on its own when you pause.
4. You get a score plus feedback lines like *"Your main stress landed on 'Mary'. Put it on 'red'"* or
   *"From 'party' onward your pitch fell. It should rise at the end."* Your pitch appears over the target,
   and circles show where your stresses actually landed.
5. `Space` to retry, `Enter` for the next phrase.

## What it measures

| Skill | How it's measured |
|---|---|
| Melody: falls, rises, fall-rises, rise-falls | Pitch shape from the main stress to the end of the phrase, plus overall contour correlation |
| Sentence stress / contrastive stress | Which word had the strongest syllable (loudness + length + pitch movement) |
| Word stress | Which syllable of the word was most prominent |
| Rhythm & weak syllables | How much longer and louder the stressed syllables are than the weak ones |
| Pitch range | Your pitch span in semitones (flat speech is the most common problem) |
| Clarity | Whether the browser's speech recognition understood the words (Chrome/Edge; sends audio to the browser vendor; toggle with `R`) |

## Adaptive coach

The first ~10 phrases are a placement check covering every skill. After that, each phrase targets the skill
with the lowest score, with some variety. Your profile and per-phrase history are saved in `localStorage`
(this browser only). Once a skill is mastered (85+), its stress marks are hidden, so you produce the stress from memory.

## Keys

`Space` speak / restart while recording / retry · `Enter` finish recording or next phrase · `M` model hum · `T` natural voice (text-to-speech) · `P` hear yourself · `Esc` menu · `?` help
Menu: `M` auto-play model · `N` auto-next on 85+ · `V` low/high hum voice · `R` clarity check · `X` reset profile

## Run locally

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

The mic needs `localhost` or `https://`. Use Chrome or Edge for the clarity check; everything else works in Firefox too.
Every push to `main` deploys to GitHub Pages via `.github/workflows/pages.yml`.

## How it works

- `js/analyze.js`: all analysis runs in the browser. Audio is resampled to 16 kHz, then pitch is tracked with the
  McLeod NSDF method (median-filtered, with octave errors corrected). Syllable nuclei are taken from intensity peaks
  with dips between them (after de Jong & Wempe). The nuclei are aligned to the expected syllables with dynamic
  programming, and each syllable gets a prominence score from loudness, duration and pitch.
- `js/coach.js`: skill profile (exponential moving average per skill), item pools per skill, and next-item selection.
- `js/prosody.js`: sentence markup → timed syllables → target pitch contour → hummed model audio and drawing.
- `js/mic.js`: capture with voice-activity auto-stop, plus optional Web Speech recognition.
- `js/data.js`: words, focus pairs, tunes and rhythm sentences. Add your own: `I 'left my 'keys in the *kitch-en.`
  (`'` = stressed syllable, `*` = main stress, `-` between syllables).

Limits: the analysis is a heuristic, not a trained model. It judges prosody (melody, stress, timing), not individual
vowel and consonant sounds. Use headphones or a quiet room for the most reliable results.
