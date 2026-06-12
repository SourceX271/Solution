"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"

interface CodeBlockProps {
  code: string
  language?: string
  className?: string
}

export function CodeBlock({ code, language, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="code-block-wrapper group relative my-4 rounded-xl border bg-gray-950 shadow-lg">
      {/* Header */}
      {language && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            {language}
          </span>
        </div>
      )}
      {/* Copy Button */}
      <button
        onClick={handleCopy}
        className="copy-button absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-lg bg-gray-800/80 px-2.5 py-1.5 text-xs text-gray-400 opacity-0 group-hover:opacity-100 hover:text-white hover:bg-gray-700 transition-all backdrop-blur-sm"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 text-emerald-400" />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" />
            Copy
          </>
        )}
      </button>
      {/* Code */}
      <pre className="overflow-x-auto p-4">
        <code
          className={`hljs ${language ? `language-${language}` : ""} text-sm leading-relaxed`}
          dangerouslySetInnerHTML={{ __html: code }}
        />
      </pre>
    </div>
  )
}
