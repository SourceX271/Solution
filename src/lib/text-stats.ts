/**
 * Character/word counts for the editor's status bar.
 *
 * Counted the way Chinese and English authors expect at the same time: every CJK
 * ideograph/kana/hangul syllable is one word, and runs of letters/digits/other
 * scripts separated by whitespace are one word each. `characters` excludes
 * whitespace, i.e. the "不计空格" figure word processors report.
 */

const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/g;

export interface TextStats {
  /** Non-whitespace character count. */
  characters: number;
  /** CJK characters + whitespace-separated words. */
  words: number;
}

export function countTextStats(text: string): TextStats {
  if (!text) return { characters: 0, words: 0 };

  const characters = text.replace(/\s+/g, "").length;
  const cjkCount = text.match(CJK)?.length ?? 0;
  const words = text
    .replace(CJK, " ")
    .split(/\s+/)
    .filter(Boolean).length;

  return { characters, words: cjkCount + words };
}
