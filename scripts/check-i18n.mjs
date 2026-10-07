#!/usr/bin/env node
/**
 * i18n guard for this repo.
 *
 * 1. `messages/zh.json` and `messages/en.json` must define exactly the same keys.
 * 2. Every translation key used in `src/` must exist in both catalogs
 *    (including `getApiT("api")` keys and keys built by the schema factories).
 * 3. Reports hardcoded CJK left in `src/`, ignoring comments — useful to spot
 *    UI strings that were never moved into the catalog.
 * 4. Rejects ICU hazards inside message *values*: a literal `<`/`>` (the ICU
 *    parser reads it as a rich-text tag and throws `UNCLOSED_TAG` at render
 *    time — `<section>` in a hint was exactly that) and braces that are not
 *    placeholders (`\frac{1}{2}` throws `MALFORMED_ARGUMENT`).
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

/* ── ICU value checks ──────────────────────────────────────────────────────
   next-intl parses every message with an ICU parser before rendering. Two
   characters are therefore hazardous inside a *value*:

     - `<` / `>` open a rich-text tag and must be paired (`<link>…</link>`, read
       back with `t.rich`). A bare `<section>` in a hint threw UNCLOSED_TAG.
     - `{` / `}` open an argument. Only `{name}` / `{name, format}` /
       `{name, plural, …}` are valid; prose like `\frac{1}{2}` threw
       MALFORMED_ARGUMENT.
   Both are silent until the message is actually rendered. */

const TAG_RE = /<(\/?)([a-zA-Z][\w-]*)(\s*\/?)>/g;
const ICU_ARG_RE = /^\{([a-zA-Z_$][\w$]*)(?:\s*,[^{}]*(?:\{[^{}]*\})*)?\}$/;

function icuProblems(value) {
  const found = [];

  // Rich-text tags: every `<`/`>` must belong to a balanced, well-formed tag.
  const stack = [];
  let leftover = value;
  for (const match of value.matchAll(TAG_RE)) {
    const [whole, closing, name, selfClosing] = match;
    leftover = leftover.replace(whole, "");
    if (selfClosing) continue;
    if (closing) {
      if (stack.pop() !== name) found.push(`unbalanced rich-text tag </${name}>`);
    } else {
      stack.push(name);
    }
  }
  if (stack.length) found.push(`unclosed rich-text tag <${stack[stack.length - 1]}>`);
  if (/[<>]/.test(leftover)) {
    found.push("literal '<' or '>' — ICU reads it as a rich-text tag (use full-width 〈〉 or a paired <link>…</link>)");
  }

  // Braces: walk the value and validate every top-level argument.
  for (let i = 0; i < value.length; i++) {
    if (value[i] !== "{") {
      if (value[i] === "}") found.push("stray '}'");
      continue;
    }
    let depth = 0;
    let end = -1;
    for (let j = i; j < value.length; j++) {
      if (value[j] === "{") depth++;
      else if (value[j] === "}") {
        depth--;
        if (depth === 0) {
          end = j;
          break;
        }
      }
    }
    if (end === -1) {
      found.push("unclosed '{'");
      break;
    }
    const group = value.slice(i, end + 1);
    if (!ICU_ARG_RE.test(group)) {
      found.push(`'{${group.slice(1, -1)}}' is not an ICU placeholder or format`);
    }
    i = end;
  }

  return found;
}

function walkValues(obj, prefix = "") {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object") walkValues(value, path);
    else {
      // Self-test: the guard must reject the two shapes that shipped as bugs.
      for (const problem of icuProblems(String(value))) {
        problems.push(`ICU in ${path}: ${problem}  <-  ${String(value).slice(0, 80)}`);
      }
    }
  }
}
walkValues(zh);
walkValues(en);

for (const sample of ["hint with <section> tag", "formula \\frac{1}{2} here"]) {
  if (icuProblems(sample).length === 0) {
    problems.push(`checker self-test failed: '${sample}' should be rejected`);
  }
}

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
