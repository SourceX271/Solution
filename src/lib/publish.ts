/**
 * Shared helpers for the publishing forms.
 *
 * The limits mirror `src/lib/validations.ts` (the server is still the source of
 * truth); the point of duplicating them here is to tell the user about a
 * too-short title *before* they submit and get a 400 back.
 */

export const PUBLISH_LIMITS = {
  solutionTitle: 200,
  solutionExcerpt: 500,
  solutionProblem: 2000,
  solutionContent: 100000,
  questionTitle: 200,
  softwareName: 100,
  softwareDescription: 5000,
  softwareUrl: 500,
} as const

/** Minimum lengths enforced by the zod schemas on the server. */
export const PUBLISH_MIN = {
  solutionTitle: 2,
  solutionContent: 10,
  questionTitle: 5,
  questionContent: 20,
  softwareDescription: 10,
} as const

/**
 * Length of the readable text in an HTML string.
 *
 * Tags are stripped, but the text a reader actually sees in generated markup
 * counts: the LaTeX source of formulas and the filenames of attachments. A post
 * whose body is "here is the log" plus a file is real content, and without this
 * the "at least N characters" rule rejected it.
 */
export function plainTextLength(html: string): number {
  return html
    .replace(/<[^>]*\bdata-latex="([^"]*)"[^>]*>[\s\S]*?<\/[a-z0-9]+>/gi, " $1 ")
    .replace(/<[^>]*\bdata-filename="([^"]*)"[^>]*>[\s\S]*?<\/a>/gi, " $1 ")
    .replace(/<img[^>]*\balt="([^"]*)"[^>]*>/gi, " $1 ")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim().length
}

/**
 * Rich text counts as filled in when it has enough prose *or* at least one
 * image: a screenshot-only solution is legitimate content.
 */
export function hasRichTextContent(html: string, minLength: number): boolean {
  if (/<img\b/i.test(html)) return true
  return plainTextLength(html) >= minLength
}

/** Only http(s) links are accepted; the schema uses `z.string().url()`. */
export function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}
