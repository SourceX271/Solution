#!/usr/bin/env node
/**
 * i18n guard for this repo.
 *
 * 1. `messages/zh.json` and `messages/en.json` must define exactly the same keys.
 * 2. Every translation key used in `src/` must exist in both catalogs
 *    (including `getApiT("api")` keys and keys built by the schema factories).
 * 3. Reports hardcoded CJK left in `src/`, ignoring comments — useful to spot
 *    UI strings that were never moved into the catalog.
 *
 * Run with `npm run i18n:check`. Exits non-zero on problems.
 */
import fs from "fs";
import path from "path";

const root = process.cwd();
const zh = JSON.parse(fs.readFileSync(path.join(root, "messages/zh.json"), "utf8"));
const en = JSON.parse(fs.readFileSync(path.join(root, "messages/en.json"), "utf8"));

function flatten(obj, prefix = "") {
  const out = new Set();
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") for (const s of flatten(v, key)) out.add(s);
    else out.add(key);
  }
  return out;
}
const zhKeys = flatten(zh);
const enKeys = flatten(en);
const problems = [];

for (const k of zhKeys) if (!enKeys.has(k)) problems.push(`messages/en.json is missing: ${k}`);
for (const k of enKeys) if (!zhKeys.has(k)) problems.push(`messages/zh.json is missing: ${k}`);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.(tsx|ts)$/.test(e.name) ? [p] : [];
  });
}
const files = walk(path.join(root, "src"));

// Files whose CJK is intentional: DB/log data, comments in libs, the dev-only
// API docs page that lives outside the locale routing.
const CJK_ALLOWED = new Set([
  "src/app/api-docs/page.tsx",
  "src/app/layout.tsx",
  "src/lib/auth.ts",
  "src/lib/crawler-ingest.ts",
  "src/lib/utils.ts",
]);

const usedKeys = new Set();
for (const f of files) {
  const rel = path.relative(root, f).replace(/\\/g, "/");
  const src = fs.readFileSync(f, "utf8");

  const nsMap = new Map();
  const addNs = (id, ns) => {
    if (!nsMap.has(id)) nsMap.set(id, new Set());
    nsMap.get(id).add(ns);
  };
  for (const m of src.matchAll(/(?:const|let)\s+(\w+)\s*(?::[^=]+)?=\s*(?:await\s+)?(?:useTranslations|getTranslations|getApiT)\(\s*["']([^"']+)["']/g)) addNs(m[1], m[2]);
  for (const m of src.matchAll(/(?:const|let)\s+(\w+)\s*(?::[^=]+)?=\s*(?:await\s+)?getTranslations\(\s*\{[^}]*namespace:\s*["']([^"']+)["']/g)) addNs(m[1], m[2]);
  for (const m of src.matchAll(/(?:const|let)\s+(\w+)\s*(?::[^=]+)?=\s*(?:await\s+)?(?:useTranslations|getTranslations|getApiT)\(\s*\)/g)) addNs(m[1], "");

  for (const [id, namespaces] of nsMap) {
    for (const m of src.matchAll(new RegExp(`\\b${id}\\(\\s*["']([^"']+)["']`, "g"))) {
      const candidates = [...namespaces].map((ns) => (ns ? `${ns}.${m[1]}` : m[1]));
      const hit = candidates.find((full) => zhKeys.has(full) && enKeys.has(full));
      if (!hit) problems.push(`unknown key ${candidates.join(" | ")}  <- ${rel}`);
      else usedKeys.add(hit);
    }
  }

  // hardcoded CJK (ignore comments and the allow-listed files)
  if (!CJK_ALLOWED.has(rel)) {
    src.split(/\r?\n/).forEach((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
      if (/[\u4e00-\u9fff]/.test(line)) {
        problems.push(`hardcoded CJK ${rel}:${i + 1}: ${trimmed.slice(0, 80)}`);
      }
    });
  }
}

const unused = [...zhKeys].filter((k) => !usedKeys.has(k));

console.log(`catalog: ${zhKeys.size} keys (zh) / ${enKeys.size} keys (en)`);
console.log(`referenced statically: ${usedKeys.size} keys`);
if (unused.length) console.log(`not referenced statically (${unused.length}): ${unused.slice(0, 12).join(", ")}${unused.length > 12 ? ", …" : ""}`);

if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n` + problems.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("\nNo i18n problems found.");
