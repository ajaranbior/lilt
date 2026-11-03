# lilt ↗↘

**▶ Try it: https://ajaranbior.github.io/lilt/**

Fast, keyboard-driven drills for English **prosody**: word stress, rhythm, focus and intonation.
It's a static web app with no build step and no dependencies.

## Run

Open `index.html` in Chrome, Edge or Firefox, or serve the folder:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

The microphone (Shadow mode) needs `localhost`, `https://` or `file://`. Every push to `main` deploys through `.github/workflows/pages.yml`.

## Modes

| Key | Mode | What you train |
|---|---|---|
| 1 | **Word stress** | Pick the stressed syllable (PHOtograph / phoTOGrapher / photoGRAPHic, REcord vs reCORD). |
| 2 | **Rhythm** | Choose the natural stress pattern of a sentence (which words are strong vs. weak). |
| 3 | **Focus** | Given a question, choose which word in the answer carries the main stress. |
| 4 | **Tune** | Pick fall / rise / fall-rise / rise-fall for a context, then read why. |
| 5 | **Ear training** | Hear only the hummed melody and identify the tune or the focus word. |
| 6 | **Shadow** | Say or hum the sentence into the mic. Your pitch is tracked live and scored against the target contour. |

Each round has 20 items (8 in Shadow). Fast, correct answers and streaks earn more points.
Items you miss come back more often; that history is stored in `localStorage`.

## Keys

`1`–`9` answer · `Space` replay hum · `Enter`/`→` next · `T` natural voice · `C` hear the tune you picked ·
`R` record (Shadow) · `Esc` menu · `?` help · on the menu: `V` low/high hum voice, `A` toggle auto-advance.

## How it works

- **Hum synthesis** (`js/prosody.js`): sentences are written in a small markup
  (`I 'left my 'keys in the *kitch-en.`, where `'` is stressed and `*` is the nucleus). They become timed
  syllables (stressed syllables are longer and louder) and a pitch contour (declining pre-nuclear accents plus a
  tune shape over the nucleus and tail). A filtered sawtooth plays it back as a "mm-MM-mm" hum.
  Removing the words makes melody and rhythm much easier to hear.
- **Pitch tracking** (`js/pitch.js`): McLeod normalized square difference on the mic signal, followed by a
  median filter and octave-error rejection.
- **Scoring**: your contour is time-normalized and median-normalized (so voice range doesn't matter), then
  compared to the target by correlation, ending direction (rising vs. falling) and pitch range.

## Add content

Edit `js/data.js`. Words use CAPS for the stressed syllable (`pho-TOG-ra-pher`). Sentences use the markup above.

The tune model is a teaching simplification: it is closer to British-style nuclear tones than to American
ToBI. Real speech is more varied, but these four tunes cover most of the meaning contrasts.
