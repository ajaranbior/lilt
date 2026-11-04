// Turn a plain sentence into Lilt markup ("I 'left my 'keys in the 'kitch-en.") using the CMU
// pronouncing dictionary for syllable counts and lexical stress, and hyphenation for spelling.
const { dictionary } = require("cmu-pronouncing-dictionary");
const hyph = require("hyphen/en-us");

// words that are normally unstressed in connected speech
const FUNCTION = new Set(("a an the and but or nor so of to in on at by for from with as than that this these those " +
  "i me my you your he him his she her it its we us our they them their there here " +
  "is am are was were be been being do does did have has had will would shall should can could may might must " +
  "i'm i'll i've i'd you're you'll you've you'd he's she's it's we're we'll we've they're they'll they've " +
  "there's that's what's who's let's if when then just up out about into some any").split(" "));
// auxiliaries/negatives that keep their stress
const KEEP = new Set("not no don't doesn't didn't can't won't isn't aren't wasn't weren't haven't hasn't shouldn't wouldn't couldn't".split(" "));

function pron(w) {
  const k = w.toLowerCase().replace(/’/g, "'");
  const p = dictionary[k];
  if (p) return p.split(" ").filter((x) => /\d$/.test(x)).map((x) => +x.slice(-1));
  // unknown: one syllable per vowel group, stress on the first
  const g = k.replace(/e$/, "").match(/[aeiouy]+/g) || ["x"];
  return g.map((_, i) => (i === 0 ? 1 : 0));
}

// split a spelled word into exactly n pieces, preferring hyphenation points, else vowel groups
function orth(word, n) {
  if (n <= 1) return [word];
  let parts = hyph.hyphenateSync(word, { hyphenChar: "\u0001" }).split("\u0001");
  while (parts.length > n) { // merge the shortest piece into a neighbour
    let i = 0; parts.forEach((p, k) => { if (p.length < parts[i].length) i = k; });
    const j = i === 0 ? 1 : i === parts.length - 1 ? i - 1 : (parts[i - 1].length <= parts[i + 1].length ? i - 1 : i + 1);
    const [a, b] = [Math.min(i, j), Math.max(i, j)];
    parts.splice(a, 2, parts[a] + parts[b]);
  }
  while (parts.length < n) { // split the longest piece between two vowel groups (one consonant goes right)
    let i = 0; parts.forEach((p, k) => { if (p.length > parts[i].length) i = k; });
    const p = parts[i], m = [...p.matchAll(/[aeiouy]+/gi)];
    let cut;
    if (m.length >= 2) {
      const end = m[0].index + m[0][0].length, next = m[1].index;
      cut = next - end >= 2 ? next - 1 : end + Math.floor((next - end) / 2);
      // keep letter pairs together: kit-chen, fa-ther (pair starts the next syllable); sing-er, tick-et (pair ends this one)
      const pair = next - end >= 2 ? p.slice(next - 2, next).toLowerCase() : "";
      if (/^(ch|sh|th|ph|wh|gh)$/.test(pair)) cut = next - 2;
      else if (/^(ck|ng)$/.test(pair)) cut = next;
    }
    else cut = Math.ceil(p.length / 2);
    cut = Math.max(1, Math.min(p.length - 1, cut));
    parts.splice(i, 1, p.slice(0, cut), p.slice(cut));
    if (p.length < 2) break;
  }
  return parts;
}

// returns markup without a nucleus (Prosody picks the last stressed syllable by default)
function toMarkup(text) {
  return text.split(/\s+/).map((tok) => {
    const m = tok.match(/^([^A-Za-z']*)([A-Za-z'’]+)([^A-Za-z']*)$/);
    if (!m) return tok;
    const [, pre, w, post] = m;
    const st = pron(w);
    const fn = FUNCTION.has(w.toLowerCase().replace(/’/g, "'")) && !KEEP.has(w.toLowerCase());
    const pieces = orth(w, st.length);
    return pre + pieces.map((p, i) => (st[i] === 1 && !fn ? "'" : "") + p).join("-") + post;
  }).join(" ");
}

module.exports = { toMarkup, pron, orth };
