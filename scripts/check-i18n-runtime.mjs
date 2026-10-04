#!/usr/bin/env node
/**
 * Runtime i18n verification — run against a live server.
 *
 *   npm run build && npx next start -p 3103
 *   CHECK_BASE=http://127.0.0.1:3103 npm run i18n:check:runtime
 *
 * - Pages without user content must contain zero CJK (except the intentional
 *   language autonym "中文" in the language switcher).
 * - Data-driven pages contain Chinese *content* from the database, so instead
 *   we assert the English UI markers are present and Chinese UI markers are not.
 *
 * This catches leaks that the static check cannot see: metadata inherited from
 * the root layout, database-driven strings (site description), and page copy.
 */
const BASE = process.env.CHECK_BASE || "http://127.0.0.1:3103";

const CJK = /[\u4e00-\u9fff]/g;
const autonym = (html) => html.replace(/中文/g, "").replace(/&amp;/g, "&");

const CLEAN_PAGES = ["/en/login", "/en/register", "/en/about", "/en/help", "/en/privacy", "/en/contact"];

// page -> { expect: English UI markers, forbid: Chinese UI markers }
const DATA_PAGES = {
  "/en": { expect: ["Popular tags", "Discover solutions"], forbid: ["首页", "查看更多", "热门标签", "发布方案"] },
  "/en/docs": { expect: ["Solutions"], forbid: ["暂无解决方案", "发布方案", "分类筛选"] },
  "/en/questions": { expect: ["Q&A"], forbid: ["暂无问题", "提出问题"] },
  "/en/software": { expect: ["Software"], forbid: ["暂无软件", "提交软件"] },
  "/en/search": { expect: ["Search"], forbid: ["搜索结果", "请输入关键词"] },
};

async function get(path) {
  const res = await fetch(BASE + path, { redirect: "manual" });
  return { status: res.status, body: await res.text() };
}

let failures = 0;
const report = (ok, label) => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
};

console.log("== English pages without user content (expect zero CJK) ==");
for (const p of CLEAN_PAGES) {
  const { status, body } = await get(p);
  const hits = autonym(body).match(CJK) || [];
  report(status === 200 && hits.length === 0, `${p}  status=${status}  cjk=${hits.length} ${[...new Set(hits)].join("").slice(0, 30)}`);
}

console.log("\n== English data pages (expect English UI, no Chinese UI) ==");
for (const [p, spec] of Object.entries(DATA_PAGES)) {
  const { status, body } = await get(p);
  const clean = autonym(body);
  const missing = spec.expect.filter((s) => !clean.includes(s));
  const leaked = spec.forbid.filter((s) => clean.includes(s));
  report(status === 200 && missing.length === 0 && leaked.length === 0,
    `${p}  status=${status}${missing.length ? "  missing:" + missing.join(",") : ""}${leaked.length ? "  leaked:" + leaked.join(",") : ""}`);
}

console.log("\n== Chinese locale still Chinese ==");
for (const [p, marker] of [["/login", "欢迎回来"], ["/about", "关于我们"], ["/docs", "解决方案"]]) {
  const { body } = await get(p);
  report(body.includes(marker), `${p}  expects "${marker}"`);
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
