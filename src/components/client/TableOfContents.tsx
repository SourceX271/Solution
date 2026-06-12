"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface TocHeading {
  id: string
  text: string
  level: number
}

interface TableOfContentsProps {
  headings: TocHeading[]
  title?: string
}

export function TableOfContents({ headings, title = "目录" }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>("")

  useEffect(() => {
    if (headings.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        }
      },
      { rootMargin: "-80px 0px -80% 0px", threshold: 0 }
    )

    for (const heading of headings) {
      const el = document.getElementById(heading.id)
      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [headings])

  if (headings.length === 0) {
    return (
      <div className="glass-card rounded-xl p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">暂无目录</p>
      </div>
    )
  }

  return (
    <div className="glass-card rounded-xl p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <nav className="space-y-0.5">
        {headings.map((h) => (
          <a
            key={h.id}
            href={`#${h.id}`}
            onClick={(e) => {
              e.preventDefault()
              document.getElementById(h.id)?.scrollIntoView({ behavior: "smooth" })
              history.pushState(null, "", `#${h.id}`)
            }}
            className={cn(
              "toc-link block py-1 text-xs transition-all",
              h.level === 2 && "pl-0",
              h.level === 3 && "pl-3",
              h.level === 4 && "pl-6",
              activeId === h.id
                ? "text-primary font-medium border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            {h.text}
          </a>
        ))}
      </nav>
    </div>
  )
}
