// Step 2: markup + item list for the selected sentences -> <work>/items.json (format of tools/voices/tts.py)
// usage: node prep.js <selected.json> <work dir>
const fs = require("fs"), path = require("path");
const { toMarkup } = require("./markup");
const [sel, work] = process.argv.slice(2);
fs.mkdirSync(work, { recursive: true });
const items = JSON.parse(fs.readFileSync(sel, "utf8")).map((s) => ({
  id: "r:" + s.sid, kind: "sentence", text: s.text, tts: s.text, file: "r" + s.aid,
  markup: toMarkup(s.text), sid: s.sid, aid: s.aid, type: s.kind, authored: s.authored,
}));
fs.writeFileSync(path.join(work, "items.json"), JSON.stringify(items, null, 1));
console.log(items.length, "items");
