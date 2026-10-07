/**
 * The inline-style vocabulary shared by the editor, the preview panes and the
 * server-side sanitiser.
 *
 * Rich-text content is stored as HTML, so whatever the sanitiser refuses to
 * keep is silently lost on the way to the reader. That makes this file the
 * contract between three places at once:
 *
 *   1. `@/lib/sanitize` filters stored/received HTML with `filterStyleDeclarations`
 *      and `filterClassAttribute` (the only place CSS is accepted at all);
 *   2. the editor's `TextStyle` mark and the paragraph alignment attribute render
 *      exactly these properties, so a style set in rich-text mode survives a trip
 *      through HTML source mode and back;
 *   3. the toolbar builds its font/size/colour pickers from the presets below.
 *
 * The list is deliberately presentational: no `position`, `top`, `z-index`,
 * `display`, `float` or `url()` values, so content cannot be turned into an
 * overlay that intercepts clicks on the real UI. Values are matched against a
 * per-property pattern as well, which is stricter than "does it parse as CSS".
 */

/** Length with an explicit unit (or unitless `0`). */
const LENGTH = "-?\\d+(?:\\.\\d+)?(?:px|pt|pc|em|rem|ex|ch|vw|vh|%)";
const LEN = `(?:0|${LENGTH})`;
const COLOR_BODY =
  "#[0-9a-f]{3,8}|rgba?\\([^()]*\\)|hsla?\\([^()]*\\)|[a-z]{3,20}|currentcolor|transparent|inherit";
const COLOR = `(?:${COLOR_BODY})`;
const FONT_SIZE =
  `(?:${LENGTH}|xx-small|x-small|small|medium|large|x-large|xx-large|smaller|larger)`;
const BORDER_TOKEN =
  `(?:none|hidden|dotted|dashed|solid|double|groove|ridge|inset|outset|thin|medium|thick|${COLOR}|${LENGTH})`;
const BORDER = `^${BORDER_TOKEN}(?:\\s+${BORDER_TOKEN}){0,3}$`;
const DECORATION = `(?:underline|overline|line-through|blink)(?:\\s+(?:solid|double|dotted|dashed|wavy|${COLOR_BODY}))*`;

export interface StyleRule {
  /** Lower-case CSS property name. */
  property: string;
  /** The whole (trimmed) value must match. */
  pattern: RegExp;
}

export const STYLE_RULES: readonly StyleRule[] = [
  { property: "color", pattern: new RegExp(`^${COLOR}$`, "i") },
  { property: "background-color", pattern: new RegExp(`^${COLOR}$`, "i") },
  // Font stacks contain quotes, commas and dots: `"PingFang SC", sans-serif`.
  { property: "font-family", pattern: /^[\w\s,'".-]{1,120}$/i },
  { property: "font-size", pattern: new RegExp(`^${FONT_SIZE}$`, "i") },
  { property: "font-weight", pattern: /^(?:normal|bold|bolder|lighter|[1-9]00)$/i },
  { property: "font-style", pattern: /^(?:normal|italic|oblique)$/i },
  { property: "line-height", pattern: /^(?:normal|\d{0,3}(?:\.\d+)?(?:px|pt|em|rem|%)?)$/i },
  { property: "letter-spacing", pattern: new RegExp(`^(?:normal|${LEN})$`, "i") },
  { property: "text-align", pattern: /^(?:left|right|center|justify|start|end)$/i },
  { property: "text-decoration", pattern: new RegExp(`^(?:none|${DECORATION})$`, "i") },
  { property: "text-indent", pattern: new RegExp(`^${LEN}$`, "i") },
  { property: "text-transform", pattern: /^(?:none|capitalize|uppercase|lowercase)$/i },
  { property: "margin-left", pattern: new RegExp(`^${LEN}$`, "i") },
  { property: "margin-right", pattern: new RegExp(`^${LEN}$`, "i") },
  { property: "padding-left", pattern: new RegExp(`^${LEN}$`, "i") },
  { property: "padding-right", pattern: new RegExp(`^${LEN}$`, "i") },
  {
    property: "vertical-align",
    pattern: new RegExp(
      `^(?:baseline|sub|super|top|middle|bottom|text-top|text-bottom|${LEN})$`,
      "i"
    ),
  },
  { property: "white-space", pattern: /^(?:normal|pre|pre-wrap|pre-line|nowrap)$/i },
  {
    property: "list-style-type",
    pattern:
      /^(?:disc|circle|square|decimal|lower-alpha|upper-alpha|lower-roman|upper-roman|none)$/i,
  },
  { property: "border-collapse", pattern: /^(?:collapse|separate)$/i },
  { property: "border", pattern: new RegExp(BORDER, "i") },
  { property: "border-top", pattern: new RegExp(BORDER, "i") },
  { property: "border-right", pattern: new RegExp(BORDER, "i") },
  { property: "border-bottom", pattern: new RegExp(BORDER, "i") },
  { property: "border-left", pattern: new RegExp(BORDER, "i") },
  { property: "border-width", pattern: new RegExp(`^(?:thin|medium|thick|${LEN})$`, "i") },
  {
    property: "border-style",
    pattern: /^(?:none|hidden|dotted|dashed|solid|double|groove|ridge|inset|outset)$/i,
  },
  { property: "border-color", pattern: new RegExp(`^${COLOR}$`, "i") },
];

export const ALLOWED_STYLE_PROPERTIES: readonly string[] = STYLE_RULES.map((r) => r.property);

/**
 * Anything that can reach outside the document: remote fetches, script URLs and
 * IE's `expression()`. A value matching this is dropped even if its property is
 * allow-listed, so a future property cannot open the door by accident.
 */
const FORBIDDEN_VALUE = /url\s*\(|expression\s*\(|@import|javascript:|[\\<>]|\/\*|[\u0000-\u001f]/i;

/**
 * Keep only allow-listed declarations from a `style` attribute.
 *
 * Unknown properties, malformed declarations and dangerous values are dropped
 * individually; the surviving declarations are re-serialised from parsed pieces
 * (never copied through), so nothing can smuggle a second declaration past the
 * checks. `!important` is stripped: user content should not be able to override
 * the application's own styles.
 */
export function filterStyleDeclarations(css: string): string {
  if (!css) return "";
  const kept: string[] = [];

  for (const raw of css.split(";")) {
    const declaration = raw.trim();
    if (!declaration) continue;
    const separator = declaration.indexOf(":");
    if (separator <= 0) continue;

    const property = declaration.slice(0, separator).trim().toLowerCase();
    const value = declaration
      .slice(separator + 1)
      .replace(/!important\s*$/i, "")
      .trim();

    if (!value || FORBIDDEN_VALUE.test(value)) continue;
    const rule = STYLE_RULES.find((r) => r.property === property);
    if (!rule || !rule.pattern.test(value)) continue;

    kept.push(`${property}: ${value}`);
  }

  return kept.join("; ");
}

/**
 * Class names the app itself produces for stored content: syntax highlighting
 * (`highlightHtmlContent`), code blocks and media/maths nodes serialised by the
 * editor. Everything else is dropped.
 *
 * Tailwind ships hundreds of utility classes to the browser, so an unrestricted
 * `class` lets content recreate real UI (`fixed inset-0 z-50`) on top of the
 * page. Anything a user actually wants visually is expressible with the style
 * allow-list above, which is why the editor offers formatting controls instead
 * of class names.
 */
export const CLASS_RULES: readonly RegExp[] = [
  /^hljs$/,
  /^hljs-[\w-]{1,32}$/,
  /^language-[\w+#.-]{1,24}$/,
  /^code-block$/,
  /^media-video$/,
  /^attachment-inline$/,
  /^math-inline$/,
  /^math-block$/,
];

export function filterClassAttribute(value: string): string {
  return value
    .split(/\s+/)
    .filter((token) => token && CLASS_RULES.some((rule) => rule.test(token)))
    .join(" ");
}

export interface StylePreset {
  /** Stable id; the toolbar uses it to build an i18n key. */
  id: string;
  /** The CSS value applied to the selection. */
  value: string;
}

/** Web-safe stacks that render the same on Windows, macOS and Linux. */
export const FONT_FAMILY_PRESETS: readonly StylePreset[] = [
  {
    id: "system",
    value:
      'system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
  },
  { id: "serif", value: '"Songti SC", SimSun, "Times New Roman", Georgia, serif' },
  { id: "kai", value: "KaiTi, STKaiti, Kai, serif" },
  { id: "hei", value: '"Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", sans-serif' },
  { id: "mono", value: 'ui-monospace, SFMono-Regular, Consolas, "Courier New", monospace' },
  { id: "cursive", value: '"Segoe Script", "Comic Sans MS", cursive' },
];

export const FONT_SIZE_PRESETS: readonly StylePreset[] = [
  { id: "12", value: "12px" },
  { id: "14", value: "14px" },
  { id: "16", value: "16px" },
  { id: "18", value: "18px" },
  { id: "20", value: "20px" },
  { id: "24", value: "24px" },
  { id: "30", value: "30px" },
  { id: "36", value: "36px" },
];

export const LINE_HEIGHT_PRESETS: readonly StylePreset[] = [
  { id: "1", value: "1" },
  { id: "1_25", value: "1.25" },
  { id: "1_5", value: "1.5" },
  { id: "1_75", value: "1.75" },
  { id: "2", value: "2" },
];

/** Text colours (contrast-checked against a white background). */
export const TEXT_COLOR_PRESETS: readonly string[] = [
  "#111827",
  "#6b7280",
  "#dc2626",
  "#ea580c",
  "#ca8a04",
  "#16a34a",
  "#0d9488",
  "#2563eb",
  "#7c3aed",
  "#db2777",
];

/** Highlight backgrounds (light enough to keep dark text readable). */
export const HIGHLIGHT_COLOR_PRESETS: readonly string[] = [
  "#fef08a",
  "#fed7aa",
  "#fecaca",
  "#e9d5ff",
  "#bfdbfe",
  "#a7f3d0",
  "#e5e7eb",
  "#bbf7d0",
  "#fbcfe8",
  "#f5f5f4",
];

/** Inline horizontal alignment values, in the order the toolbar shows them. */
export const TEXT_ALIGN_VALUES = ["left", "center", "right", "justify"] as const;

export type TextAlignValue = (typeof TEXT_ALIGN_VALUES)[number];

/**
 * Languages offered for code blocks. Ids are highlight.js ids (the same ones
 * `src/lib/highlight.ts` registers), so picking one here is what makes the
 * published code block actually highlighted. `""` means "no language": the
 * highlighter then guesses.
 */
export interface CodeLanguage {
  id: string;
  label: string;
}

export const CODE_LANGUAGES: readonly CodeLanguage[] = [
  { id: "javascript", label: "JavaScript" },
  { id: "typescript", label: "TypeScript" },
  { id: "python", label: "Python" },
  { id: "java", label: "Java" },
  { id: "go", label: "Go" },
  { id: "rust", label: "Rust" },
  { id: "c", label: "C" },
  { id: "cpp", label: "C++" },
  { id: "csharp", label: "C#" },
  { id: "php", label: "PHP" },
  { id: "ruby", label: "Ruby" },
  { id: "kotlin", label: "Kotlin" },
  { id: "swift", label: "Swift" },
  { id: "scala", label: "Scala" },
  { id: "shell", label: "Shell" },
  { id: "bash", label: "Bash" },
  { id: "sql", label: "SQL" },
  { id: "json", label: "JSON" },
  { id: "yaml", label: "YAML" },
  { id: "xml", label: "HTML / XML" },
  { id: "css", label: "CSS" },
  { id: "markdown", label: "Markdown" },
  { id: "graphql", label: "GraphQL" },
  { id: "nginx", label: "Nginx" },
  { id: "dockerfile", label: "Dockerfile" },
];
