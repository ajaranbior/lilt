// Load the app's browser scripts into Node (no DOM needed for data/analysis/resynthesis).
const fs = require("fs"), vm = require("vm"), path = require("path");
global.window = global;
global.Mic = { canRecognize: false };
global.localStorage = { getItem: () => null, setItem: () => {} };
global.getComputedStyle = () => ({ getPropertyValue: () => "" });
const root = path.join(__dirname, "..", "..");
for (const f of ["data", "bank", "prosody", "analyze", "resynth", "coach", "align"]) vm.runInThisContext(fs.readFileSync(path.join(root, "js", f + ".js"), "utf8"), { filename: f + ".js" });

function readWav(p) {
  const b = fs.readFileSync(p); let o = 12, sr = 0, bits = 16, fmt = 1, data;
  while (o < b.length) {
    const id = b.toString("ascii", o, o + 4), sz = b.readUInt32LE(o + 4);
    if (id === "fmt ") { fmt = b.readUInt16LE(o + 8); sr = b.readUInt32LE(o + 12); bits = b.readUInt16LE(o + 22); }
    if (id === "data") { data = b.subarray(o + 8, o + 8 + Math.min(sz, b.length - o - 8)); break; }
    o += 8 + sz + (sz & 1);
  }
  let x;
  if (fmt === 3 && bits === 32) { x = new Float32Array(data.length / 4); for (let i = 0; i < x.length; i++) x[i] = data.readFloatLE(i * 4); }
  else { x = new Float32Array(data.length >> 1); for (let i = 0; i < x.length; i++) x[i] = data.readInt16LE(i * 2) / 32768; }
  return { x, sr };
}
function writeWav(p, x, sr) {
  const b = Buffer.alloc(44 + x.length * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + x.length * 2, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(x.length * 2, 40);
  for (let i = 0; i < x.length; i++) b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(x[i] * 32767))), 44 + i * 2);
  fs.writeFileSync(p, b);
}
// short stable file id
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
module.exports = { readWav, writeWav, hash, root };
