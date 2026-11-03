// Drill content.
//
// Sentence markup:
//   words separated by spaces, syllables by "-"
//   'syl  = stressed syllable (an accent can land here)
//   *syl  = nucleus (main stress of the phrase, where the tune happens)
// Punctuation stays attached to the word.

// Word stress: stressed syllable in CAPS, optional "|hint".
window.WORDS = [
  "PHO-to-graph", "pho-TOG-ra-pher", "pho-to-GRAPH-ic",
  "e-CON-o-my", "ec-o-NOM-ic", "e-CON-o-mist",
  "DEM-o-crat", "de-MOC-ra-cy", "dem-o-CRAT-ic",
  "tech-NIQUE", "tech-NOL-o-gy", "tech-no-LOG-i-cal",
  "phi-LOS-o-phy", "phil-o-SOPH-i-cal",
  "HIS-to-ry", "his-TOR-i-cal",
  "e-LEC-tric", "e-lec-TRIC-i-ty",
  "PER-son-al", "per-son-AL-i-ty",
  "a-CAD-e-my", "ac-a-DEM-ic",
  "AN-a-lyze", "a-NAL-y-sis", "an-a-LYT-i-cal",
  "IN-dus-try", "in-DUS-tri-al",
  "HOR-i-zon", "hor-i-ZON-tal",
  "com-MU-ni-cate", "com-mu-ni-CA-tion",
  "pos-si-BIL-i-ty", "re-spon-si-BIL-i-ty",
  "in-ter-NA-tion-al", "GOV-ern-ment", "EN-vi-ron-ment",
  "COM-for-ta-ble", "IN-ter-est-ing", "BEAU-ti-ful", "FAM-i-ly",
  "EV-er-y-thing", "HOS-pi-tal", "SAT-ur-day", "CAT-e-go-ry",
  "AC-cu-rate", "in-TEL-li-gent", "ap-PAR-ent", "al-TER-na-tive",
  "a-VAIL-a-ble", "ma-TE-ri-al", "de-TER-mine", "ex-AM-ine",
  "e-NOR-mous", "de-VEL-op", "de-VEL-op-ment", "com-PU-ter",
  "ba-NA-na", "to-MA-to", "po-TA-to", "gui-TAR", "ho-TEL", "ca-REER",
  "ca-NAL", "de-SIGN", "pre-FER", "PREF-er-ence", "i-DE-a",
  "EN-gine", "en-gi-NEER", "Jap-a-NESE", "chim-pan-ZEE", "em-ploy-EE",
  "ref-er-EE", "vol-un-TEER", "MU-sic", "mu-SI-cian",
  "ca-TAS-tro-phe", "cat-a-STROPH-ic", "pho-NOL-o-gy",
  "PRES-ent|noun", "pre-SENT|verb",
  "REC-ord|noun", "re-CORD|verb",
  "OB-ject|noun", "ob-JECT|verb",
  "PRO-duce|noun", "pro-DUCE|verb",
  "CON-tract|noun", "con-TRACT|verb",
  "IN-crease|noun", "in-CREASE|verb",
  "REB-el|noun", "re-BEL|verb",
  "PER-mit|noun", "per-MIT|verb",
  "CON-duct|noun", "con-DUCT|verb",
  "DE-sert|noun (sand)", "des-SERT|noun (sweet)",
];

// Focus / contrastive stress. `f` = index of the word that carries the nucleus.
window.FOCUS = [
  { s: "'Ma-ry 'bought a 'red 'car.", items: [
    ["Who bought a red car?", 0],
    ["Did Mary rent a red car?", 1],
    ["Did Mary buy a blue car?", 3],
    ["Did Mary buy a red bike?", 4],
  ]},
  { s: "I 'left my 'keys in the 'kitch-en.", items: [
    ["Did you leave your phone in the kitchen?", 3],
    ["Where did you leave your keys?", 6],
    ["Did you leave HIS keys in the kitchen?", 2],
    ["Did your brother leave his keys in the kitchen?", 0],
  ]},
  { s: "She's 'meet-ing us at 'six.", items: [
    ["When is she meeting us?", 4],
    ["Is she calling us at six?", 1],
    ["Is she meeting THEM at six?", 2],
  ]},
  { s: "We 'need 'three 'tick-ets for 'Fri-day.", items: [
    ["How many tickets do we need?", 2],
    ["Do we need three tickets for Saturday?", 5],
    ["Do we need three seats for Friday?", 3],
    ["Do we just WANT three tickets?", 1],
  ]},
  { s: "'Tom 'plays the pi-'a-no.", items: [
    ["Who plays the piano?", 0],
    ["Does Tom play the guitar?", 3],
    ["Does Tom teach the piano?", 1],
  ]},
  { s: "The 'meet-ing is on 'Tues-day 'morn-ing.", items: [
    ["Is the meeting on Tuesday afternoon?", 5],
    ["Is the meeting on Wednesday morning?", 4],
    ["Is the party on Tuesday morning?", 1],
  ]},
  { s: "My 'sis-ter 'lives in 'Lon-don.", items: [
    ["Where does your sister live?", 4],
    ["Does your brother live in London?", 1],
    ["Does your sister work in London?", 2],
    ["Does HER sister live in London?", 0],
  ]},
  { s: "He 'drank 'two 'cups of 'cof-fee.", items: [
    ["How many cups of coffee did he drink?", 2],
    ["Did he drink two cups of tea?", 5],
    ["Did he spill two cups of coffee?", 1],
    ["Did SHE drink two cups of coffee?", 0],
  ]},
];

// Tunes: fall, rise, fallrise, risefall
window.TUNES = [
  { ctx: "Neutral statement of fact.", s: "I 'live in *Lon-don.", t: "fall",
    why: "Statements normally end with a fall: it signals 'finished, this is certain'." },
  { ctx: "Genuine yes/no question — you don't know the answer.", s: "Are you 'com-ing to the *par-ty?", t: "rise",
    why: "Neutral yes/no questions typically rise: the answer is open." },
  { ctx: "Ordinary wh-question (where, what, who…).", s: "Where do you *work?", t: "fall",
    why: "Wh-questions usually fall, even though they're questions. A rise sounds extra-polite or like a repeat request." },
  { ctx: "Surprised echo: you can't believe what you heard.", s: "You're *mov-ing?", t: "rise",
    why: "A statement with a rise becomes a question asking for confirmation." },
  { ctx: "Partial agreement — the food was good, but something else wasn't.", s: "Well, the 'food was *good…", t: "fallrise",
    why: "Fall-rise signals reservation: 'this part is true… but'. The listener hears an implied contrast." },
  { ctx: "You are genuinely impressed.", s: "That's a-*maz-ing!", t: "risefall",
    why: "Rise-fall is the strongly emotional, impressed (or sometimes sarcastic) version of a fall." },
  { ctx: "First item of a list — more items are coming.", s: "We need *eggs,", t: "rise",
    why: "Non-final list items tend to rise (or fall-rise): 'not finished yet'." },
  { ctx: "Last item of a list.", s: "…and *bread.", t: "fall",
    why: "The final item falls to close the list." },
  { ctx: "Tag question: you're sure, and just expect agreement.", s: "It's 'cold, *is-n't it?", t: "fall",
    why: "A falling tag means 'I'm confident, agree with me'. It's barely a question." },
  { ctx: "Tag question: you really don't know.", s: "You're 'not 'bus-y, *are you?", t: "rise",
    why: "A rising tag is a real question: you want information." },
  { ctx: "'I don't mind… (but I'm not thrilled).'", s: "I 'don't *mind…", t: "fallrise",
    why: "Fall-rise adds an unspoken 'but…'." },
  { ctx: "A conditional clause at the start: the sentence continues.", s: "If it *rains,", t: "fallrise",
    why: "Fall-rise (or rise) on a leading clause signals 'more to come'." },
  { ctx: "A direct instruction.", s: "'Close the *door.", t: "fall",
    why: "Commands fall. A rise would sound like a request or a question." },
  { ctx: "Asking for confirmation, surprised: 'Really?'", s: "*Real-ly?", t: "rise",
    why: "Rising 'really?' asks: is that true?" },
  { ctx: "Emphatic, impressed agreement.", s: "Oh, *yes!", t: "risefall",
    why: "Rise-fall carries strong feeling: 'absolutely!'." },
  { ctx: "Closed choice: tea, or coffee — pick one.", s: "Would you like 'tea or *cof-fee?", t: "fall",
    why: "In a closed choice, the list rises then the final option falls: 'these are the only options'." },
  { ctx: "Open offer: would you like a drink of some kind?", s: "Would you like a *drink?", t: "rise",
    why: "A genuine yes/no offer rises." },
  { ctx: "You didn't hear what they said.", s: "*Sor-ry?", t: "rise",
    why: "Rising 'sorry?' = 'pardon, say again'. Falling 'sorry.' = an apology." },
  { ctx: "A sincere apology.", s: "I'm *sor-ry.", t: "fall",
    why: "Falling: sincere and complete." },
  { ctx: "'In theory, yes (in practice, no).'", s: "In *the-o-ry…", t: "fallrise",
    why: "Fall-rise implies a contrast that isn't said aloud." },
  { ctx: "Strong protest.", s: "That's ri-*dic-u-lous!", t: "risefall",
    why: "Rise-fall adds intensity to the exclamation." },
  { ctx: "You didn't catch the place they mentioned.", s: "You went *where?", t: "rise",
    why: "An echo wh-question rises: it asks them to repeat." },
  { ctx: "Hedging, not committing.", s: "*Prob-a-bly…", t: "fallrise",
    why: "Fall-rise softens: 'probably… but don't hold me to it'." },
  { ctx: "Delighted exclamation.", s: "How *won-der-ful!", t: "risefall",
    why: "Rise-fall sounds warm and emphatic." },
  { ctx: "Wrapping up, final statement.", s: "It's 'time to *go.", t: "fall",
    why: "Final statements fall." },
  { ctx: "Neutral yes/no question about taste.", s: "Do you 'like *jazz?", t: "rise",
    why: "Open yes/no question: rise." },
];

window.TUNE_INFO = {
  fall:     { key: "1", name: "Fall",      sym: "↘",  desc: "finished · certain" },
  rise:     { key: "2", name: "Rise",      sym: "↗",  desc: "open · questioning" },
  fallrise: { key: "3", name: "Fall-rise", sym: "↘↗", desc: "reservation · 'but…'" },
  risefall: { key: "4", name: "Rise-fall", sym: "↗↘", desc: "strong feeling" },
};
window.TUNE_ORDER = ["fall", "rise", "fallrise", "risefall"];
