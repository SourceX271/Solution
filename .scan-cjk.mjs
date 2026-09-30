// Temporary scan: list source files containing user-facing CJK text.
import fs from "fs";
import path from "path";

const root = process.cwd();
function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.(tsx|ts)$/.test(e.name)) out.push(p);
  }
  return out;
}

const files = walk(path.join(root, "src"));
const rows = [];
for (const f of files) {
  const rel = path.relative(root, f).replace(/\\/g, "/");
  const lines = fs.readFileSync(f, "utf8").split(/\r?\n/);
  let count = 0;
  const samples = [];
  for (const line of lines) {
    // CJK characters
    if (/[\u4e00-\u9fff]/.test(line)) {
      count++;
      if (samples.length < 2) samples.push(line.trim().slice(0, 70));
    }
  }
  if (count > 0) rows.push({ rel, count, samples });
}
rows.sort((a, b) => b.count - a.count);
let total = 0;
for (const r of rows) {
  total += r.count;
  console.log(String(r.count).padStart(3), r.rel);
}
console.log("\nfiles:", rows.length, " lines:", total);
