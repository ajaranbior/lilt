// Step 1: list every phrase to record -> work/items.json
const fs = require("fs"), path = require("path");
const { hash } = require("./load");
const work = process.argv[2] || path.join(__dirname, "work");
fs.mkdirSync(work, { recursive: true });
const items = Coach.allItems().map((it) => {
  const o = { id: it.id, kind: it.kind, text: it.text, file: hash(it.id) };
  // noun/verb pairs: let context pick the pronunciation ("the record" vs "to record"), then drop the carrier
  if (it.kind === "word" && it.hint) {
    const h = it.hint.toLowerCase();
    o.carrier = h.startsWith("verb") ? "to" : h.startsWith("adjective") ? "a" : "the";
  }
  o.tts = it.kind === "word" ? it.text : it.text.replace(/…/g, "...");
  return o;
});
fs.writeFileSync(path.join(work, "items.json"), JSON.stringify(items, null, 1));
console.log(items.length, "items ->", path.join(work, "items.json"));
