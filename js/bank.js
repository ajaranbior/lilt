// Extra practice content, appended to the base banks in data.js.
// Same markup: CAPS = stressed syllable in words; ' = stressed, * = main stress in sentences.
(function () {
  WORDS.push(
    "a-BIL-i-ty", "ac-CEPT-a-ble", "ac-COM-mo-date", "ac-com-mo-DA-tion", "ad-MIN-is-ter", "ad-min-is-TRA-tion",
    "AD-ver-tise", "AG-ri-cul-ture", "ag-ri-CUL-tur-al", "AL-co-hol", "al-co-HOL-ic", "an-ni-VER-sa-ry",
    "a-POL-o-gize", "AP-pli-cant", "ap-pli-CA-tion", "AR-chi-tect", "AR-chi-tec-ture", "ath-LET-ic", "AT-mos-phere",
    "AV-er-age", "bi-OL-o-gy", "bi-o-LOG-i-cal", "CAL-en-dar", "CAP-i-tal", "CEL-e-brate", "cel-e-BRA-tion",
    "CHAR-ac-ter", "char-ac-ter-IS-tic", "CHEM-is-try", "CIR-cum-stance", "COL-league", "com-MIT-tee",
    "com-PAR-i-son", "com-PET-i-tive", "com-pe-TI-tion", "com-PLETE-ly", "CON-cen-trate", "con-cen-TRA-tion",
    "CON-fi-dence", "con-SID-er", "con-sid-er-A-tion", "con-TRIB-ute", "con-tri-BU-tion", "con-VEN-ient",
    "DAN-ger-ous", "de-CI-sion", "DEF-i-nite-ly", "def-i-NI-tion", "DEL-i-cate", "de-LI-cious", "DEM-on-strate",
    "dem-on-STRA-tion", "DIF-fi-cult", "dis-ap-PEAR", "dis-ap-POINT-ed", "ED-u-cate", "ed-u-CA-tion", "ef-FEC-tive",
    "EL-e-gant", "em-BAR-rassed", "e-MER-gen-cy", "en-thu-si-AS-tic", "e-QUIP-ment", "es-PE-cial-ly",
    "ex-AG-ger-ate", "ex-ag-ger-A-tion", "ex-PE-ri-ence", "ex-PER-i-ment", "ex-pla-NA-tion", "fan-TAS-tic",
    "fi-NAN-cial", "FOR-tu-nate-ly", "un-FOR-tu-nate-ly", "FRE-quent-ly", "GEN-er-al", "gen-er-A-tion", "GEN-er-ous",
    "ge-OG-ra-phy", "HAP-pi-ness", "HON-est-ly", "hu-MAN-i-ty", "i-MAG-ine", "i-mag-i-NA-tion", "IM-mi-grant",
    "im-POR-tant", "im-PRES-sive", "in-CRED-i-ble", "IN-flu-ence", "in-for-MA-tion", "in-GRE-di-ent", "IN-ter-view",
    "in-tro-DUCE", "in-tro-DUC-tion", "in-VEST-ment", "in-vi-TA-tion", "LAN-guage", "LI-brar-y", "MAN-age-ment",
    "MED-i-cine", "me-MO-ri-al", "MEM-o-ry", "MES-sage", "MYS-ter-y", "mys-TE-ri-ous", "NAT-u-ral", "NEC-es-sar-y",
    "ne-CES-si-ty", "of-FI-cial", "OP-er-ate", "op-er-A-tion", "op-por-TU-ni-ty", "OR-gan-ize", "or-gan-i-ZA-tion",
    "PAR-ent", "pa-REN-tal", "par-TIC-u-lar", "per-FOR-mance", "PHAR-ma-cy", "POL-i-tics", "po-LIT-i-cal",
    "pol-i-TI-cian", "POP-u-lar", "pop-u-LAR-i-ty", "PRAC-ti-cal", "pri-OR-i-ty", "PROB-a-bly", "PROD-uct",
    "pro-DUC-tion", "pro-DUC-tive", "pro-FES-sion-al", "pro-FES-sor", "QUAL-i-ty", "rec-om-MEND",
    "rec-om-men-DA-tion", "REG-u-lar", "re-LA-tion-ship", "REL-a-tive", "re-MARK-a-ble", "RES-tau-rant",
    "SAT-is-fied", "sat-is-FAC-tion", "sci-en-TIF-ic", "SEC-re-tar-y", "sig-NIF-i-cant", "SIM-i-lar",
    "sit-u-A-tion", "so-CI-e-ty", "sta-TIS-tics", "STRAT-e-gy", "stra-TE-gic", "suc-CESS-ful", "sug-GEST",
    "sur-PRISE", "sus-PI-cious", "SYM-pa-thy", "sym-pa-THET-ic", "TEL-e-phone", "TEL-e-vi-sion", "TEM-per-a-ture",
    "to-GETH-er", "tra-DI-tion-al", "un-der-STAND", "u-ni-VER-si-ty", "VAL-u-a-ble", "va-RI-e-ty",
    "veg-e-TAR-i-an", "vo-CAB-u-lar-y", "WON-der-ful", "YES-ter-day", "BED-room", "AIR-port", "BIRTH-day",
    "FOOT-ball", "SUN-glass-es",
    "PER-fect|adjective", "per-FECT|verb", "PROG-ress|noun", "pro-GRESS|verb", "EX-port|noun", "ex-PORT|verb",
    "IM-port|noun", "im-PORT|verb", "IN-sult|noun", "in-SULT|verb", "PRO-test|noun", "pro-TEST|verb",
    "SUS-pect|noun", "sus-PECT|verb", "CON-flict|noun", "con-FLICT|verb", "PRO-ject|noun", "pro-JECT|verb",
  );

  FOCUS.push(
    { s: "I 'bought a 'new 'phone 'yes-ter-day.", items: [
      ["When did you buy a new phone?", 5], ["Did you buy a second-hand phone yesterday?", 3],
      ["Did you sell a new phone yesterday?", 1], ["Did your brother buy a new phone yesterday?", 0]] },
    { s: "'James is 'driv-ing to 'Par-is to-'mor-row.", items: [
      ["Where is James driving tomorrow?", 4], ["When is James driving to Paris?", 5],
      ["Is James flying to Paris tomorrow?", 2], ["Who is driving to Paris tomorrow?", 0]] },
    { s: "The 'train 'leaves at 'sev-en 'thir-ty.", items: [
      ["Does the train leave at eight thirty?", 4], ["Does the train leave at seven fifteen?", 5],
      ["Does the bus leave at seven thirty?", 1], ["Does the train arrive at seven thirty?", 2]] },
    { s: "We 'had 'pas-ta for 'din-ner.", items: [
      ["What did you have for dinner?", 2], ["Did you have pasta for lunch?", 4],
      ["Did THEY have pasta for dinner?", 0], ["Did you cook pasta for dinner?", 1]] },
    { s: "'An-na 'works at the 'hos-pi-tal.", items: [
      ["Where does Anna work?", 4], ["Who works at the hospital?", 0], ["Does Anna volunteer at the hospital?", 1]] },
    { s: "I 'need a 'big-ger 'bag.", items: [
      ["Do you need a smaller bag?", 3], ["Do you need a bigger box?", 4],
      ["Do you just WANT a bigger bag?", 1], ["Does Sam need a bigger bag?", 0]] },
    { s: "The 'kids are 'play-ing in the 'gar-den.", items: [
      ["Where are the kids playing?", 6], ["Are the kids fighting in the garden?", 3], ["Are the dogs playing in the garden?", 1]] },
    { s: "She 'called me 'last 'night.", items: [
      ["Did she text you last night?", 1], ["Did she call your brother last night?", 2],
      ["Did HE call you last night?", 0], ["Did she call you last week?", 4]] },
    { s: "My 'flight was 'can-celled a-'gain.", items: [
      ["Was your flight delayed again?", 3], ["Was your train cancelled again?", 1], ["Was HIS flight cancelled again?", 0]] },
    { s: "I 'love I-'tal-ian 'food.", items: [
      ["Do you like Italian food?", 1], ["Do you love Mexican food?", 2], ["Do you love Italian wine?", 3]] },
    { s: "He 'lost his 'keys at 'work.", items: [
      ["Where did he lose his keys?", 5], ["Did he find his keys at work?", 1],
      ["Did he lose his wallet at work?", 3], ["Did he lose YOUR keys at work?", 2]] },
    { s: "We're 'mov-ing to Ber-'lin in 'June.", items: [
      ["When are you moving to Berlin?", 5], ["Where are you moving in June?", 3], ["Are you visiting Berlin in June?", 1]] },
  );

  TUNES.push(
    // falls
    { ctx: "Giving information: the time.", s: "It's 'half past *three.", t: "fall", why: "Information statements fall." },
    { ctx: "Wh-question asking for new information.", s: "What 'time does the 'shop *close?", t: "fall", why: "Neutral wh-questions fall." },
    { ctx: "Ordering at a café.", s: "I'll 'have a *lat-te, please.", t: "fall", why: "A clear request falls; 'please' stays low in the tail." },
    { ctx: "Telling someone your decision.", s: "I've de-'cid-ed to *leave.", t: "fall", why: "A firm decision falls." },
    { ctx: "Thanking someone sincerely.", s: "'Thank you so *much.", t: "fall", why: "A sincere thank-you falls." },
    { ctx: "Saying goodbye.", s: "See you on *Mon-day.", t: "fall", why: "Final, settled: fall." },
    { ctx: "Neutral wh-question.", s: "How 'long have you 'lived *here?", t: "fall", why: "Wh-questions fall." },
    { ctx: "Stating a firm opinion.", s: "That's a 'ter-ri-ble i-*de-a.", t: "fall", why: "Certain opinions fall." },
    // rises
    { ctx: "Yes/no question, neutral.", s: "Have you 'fin-ished your *home-work?", t: "rise", why: "Open yes/no questions rise." },
    { ctx: "Polite request phrased as a question.", s: "Could you 'o-pen the *win-dow?", t: "rise", why: "A rise makes a request sound polite rather than an order." },
    { ctx: "Checking something you're unsure of.", s: "Is 'this the 'bus to the *cen-tre?", t: "rise", why: "A genuine check rises." },
    { ctx: "Checking a time you think you heard.", s: "At *sev-en?", t: "rise", why: "Echoing to confirm: rise." },
    { ctx: "Prompting someone to continue their story.", s: "*And?", t: "rise", why: "A rise invites the speaker to go on." },
    { ctx: "Offering something.", s: "'More *cof-fee?", t: "rise", why: "Offers rise." },
    { ctx: "Friendly interest.", s: "Did you 'have a 'good *week-end?", t: "rise", why: "A yes/no question showing interest rises." },
    { ctx: "Opening clause: more is coming.", s: "When I 'got *home,", t: "rise", why: "Non-final: rise to show you're not finished." },
    { ctx: "Asking permission.", s: "'Can I 'sit *here?", t: "rise", why: "Permission questions rise." },
    { ctx: "Surprised: you didn't expect that.", s: "She *said that?", t: "rise", why: "A surprised check rises." },
    // fall-rises
    { ctx: "Partly correcting: not every one of them.", s: "'Not *all of them…", t: "fallrise", why: "Fall-rise: 'some, but not all'." },
    { ctx: "A friendly warning.", s: "'Mind the *step…", t: "fallrise", why: "Fall-rise makes a warning sound concerned and friendly." },
    { ctx: "Polite disagreement.", s: "I'm 'not *sure about that…", t: "fallrise", why: "Fall-rise softens disagreement." },
    { ctx: "Introducing a contrasting topic.", s: "As for *me,", t: "fallrise", why: "Fall-rise marks a contrast: 'as for me (unlike the others)'." },
    { ctx: "Reluctant agreement.", s: "I sup-*pose so…", t: "fallrise", why: "Fall-rise adds reluctance." },
    { ctx: "Saturday works, but other days don't.", s: "'Sat-ur-day is *fine…", t: "fallrise", why: "The implied 'but…' is about the other days." },
    { ctx: "A hesitant answer.", s: "*May-be…", t: "fallrise", why: "Fall-rise: unsure, not committing." },
    { ctx: "Partial praise.", s: "His 'Eng-lish is *good…", t: "fallrise", why: "Implies something else isn't good." },
    { ctx: "A soft refusal.", s: "'Not to-*day…", t: "fallrise", why: "Fall-rise softens the no and hints at another time." },
    { ctx: "Reassuring someone.", s: "'Don't *wor-ry…", t: "fallrise", why: "Fall-rise sounds warm and reassuring." },
    // rise-falls
    { ctx: "Very impressed.", s: "That's in-*cred-i-ble!", t: "risefall", why: "Rise-fall carries strong emotion." },
    { ctx: "Strong agreement.", s: "Ab-so-*lute-ly!", t: "risefall", why: "Emphatic agreement: rise-fall." },
    { ctx: "Shocked disbelief.", s: "You *did-n't!", t: "risefall", why: "Rise-fall shows shock." },
    { ctx: "Delighted surprise.", s: "What a 'love-ly sur-*prise!", t: "risefall", why: "Warm, emphatic exclamation." },
    { ctx: "Emphatic: it really was great.", s: "It was *bril-liant!", t: "risefall", why: "Rise-fall intensifies." },
    { ctx: "An enthusiastic yes.", s: "Of *course!", t: "risefall", why: "Rise-fall: 'obviously, yes!'" },
    { ctx: "Disgusted.", s: "That's dis-*gust-ing!", t: "risefall", why: "Strong feeling: rise-fall." },
    { ctx: "Exasperated.", s: "Not a-*gain!", t: "risefall", why: "Rise-fall shows exasperation." },
    { ctx: "Knowing, a bit smug.", s: "I *told you!", t: "risefall", why: "Rise-fall: 'I was right!'" },
  );

  RHYTHM.push(
    { s: "I'm 'go-ing to the 'su-per-mar-ket to 'buy some *bread.", t: "fall" },
    { s: "She was 'look-ing for a 'place to *park.", t: "fall" },
    { s: "We 'got there at a-'bout 'half past *nine.", t: "fall" },
    { s: "Do you 'want to 'go for a *walk?", t: "rise" },
    { s: "It's the 'kind of 'thing that 'hap-pens to *ev-er-y-one.", t: "fall" },
    { s: "I've been 'wait-ing for an *hour.", t: "fall" },
    { s: "There were 'lots of 'peo-ple at the *par-ty.", t: "fall" },
    { s: "He 'said he would 'call me in the *morn-ing.", t: "fall" },
    { s: "I can't be-'lieve it's al-'read-y *Fri-day.", t: "fall" },
    { s: "What would you 'like to 'have for *lunch?", t: "fall" },
    { s: "Could you 'pass me the *salt, please?", t: "rise" },
    { s: "We should have 'left a bit *ear-li-er.", t: "fall" },
    { s: "The 'meet-ing has been 'moved to *Thurs-day.", t: "fall" },
    { s: "I'll 'see you at the 'end of the *week.", t: "fall" },
    { s: "Have you 'had a 'chance to *read it?", t: "rise" },
    { s: "It de-'pends on the *weath-er.", t: "fall" },
    { s: "I was 'go-ing to 'tell you a-'bout it to-*day.", t: "fall" },
    { s: "They're 'think-ing of 'mov-ing to the *coun-try.", t: "fall" },
    { s: "Is there a 'phar-ma-cy a-'round *here?", t: "rise" },
    { s: "It's 'eas-i-er than it *looks.", t: "fall" },
    { s: "I for-'got to 'turn off the *lights.", t: "fall" },
    { s: "She's been 'work-ing on it for *weeks.", t: "fall" },
    { s: "Would you 'mind if I 'o-pened the *win-dow?", t: "rise" },
    { s: "A 'cup of 'tea and a 'piece of *cake.", t: "fall" },
    { s: "I 'don't 'know what to *do.", t: "fall" },
    { s: "We 'need to 'talk a-'bout the *bud-get.", t: "fall" },
    { s: "He's 'one of my 'old-est *friends.", t: "fall" },
    { s: "Let me 'know if you 'need an-y *help.", t: "fall" },
    { s: "How 'much does it 'cost to 'get to the *air-port?", t: "fall" },
    { s: "Are you 'com-ing to the 'cin-e-ma to-*night?", t: "rise" },
  );
})();
