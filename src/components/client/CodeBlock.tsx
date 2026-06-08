"use client";

import { useEffect, useRef } from "react";
import { highlightCode } from "@/lib/highlight";

interface CodeBlockProps {
  code: string;
  language?: string;
}

export function CodeBlock({ code, language }: CodeBlockProps) {
  const codeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (codeRef.current) {
      const highlighted = highlightCode(code.trim(), language);
      codeRef.current.innerHTML = highlighted;
    }
  }, [code, language]);

  return (
    <div className="code-block-wrapper my-4">
      {language && (
        <div className="code-language-label rounded-t-md border border-b-0 bg-muted px-4 py-1.5 text-xs font-medium text-muted-foreground">
          {language}
        </div>
      )}
      <pre className={`overflow-x-auto rounded-md border bg-gray-950 p-4 ${language ? "rounded-t-none" : ""}`}>
        <code
          ref={codeRef}
          className="hljs text-sm leading-relaxed"
        />
      </pre>
    </div>
  );
}