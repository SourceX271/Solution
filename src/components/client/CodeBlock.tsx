"use client";

import { useEffect, useRef } from "react";

// Simple code syntax highlighting using regex-based tokenization
function highlightCode(code: string, language: string): string {
  // Escape HTML
  let html = code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Keywords
  const keywords = [
    "const", "let", "var", "function", "return", "if", "else", "for", "while",
    "class", "export", "import", "from", "default", "async", "await", "try", "catch",
    "throw", "new", "this", "super", "extends", "static", "get", "set",
    "interface", "type", "enum", "implements", "abstract", "public", "private", "protected",
    "def", "True", "False", "None", "and", "or", "not", "in", "is",
  ].join("|");

  // Strings
  html = html.replace(/([^]*|"[^"]*"|'[^']*')/g, '<span class="code-string"></span>');

  // Single-line comments
  html = html.replace(/(\/\/.*$|\#.*$)/gm, '<span class="code-comment"></span>');

  // Numbers
  html = html.replace(/\b(\d+\.?\d*)\b/g, '<span class="code-number"></span>');

  // Keywords (after strings/comments to avoid matching inside them)
  const keywordRegex = new RegExp(
    '\\b(' + keywords + ')\\b(?![^<]*>|[^<>]*<\\/)',
    "g"
  );
  html = html.replace(keywordRegex, '<span class="code-keyword"></span>');

  // Function/method names
  html = html.replace(/\b([a-zA-Z_$][\w$]*)(?=\s*\()/g, '<span class="code-function"></span>');

  return html;
}

interface CodeBlockProps {
  code: string;
  language?: string;
}

export function CodeBlock({ code, language }: CodeBlockProps) {
  const highlighted = highlightCode(code.trim(), language || "text");

  return (
    <div className="code-block-wrapper">
      {language && (
        <div className="code-language-label">{language}</div>
      )}
      <pre className="code-block">
        <code dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
    </div>
  );
}
