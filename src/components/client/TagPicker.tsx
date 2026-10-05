"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { X, Plus, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface TagOption {
  id: string
  name: string
  slug: string
  color: string
  usageCount: number
}

interface TagPickerProps {
  id?: string
  /** Selected tag names (the API resolves them to tags on save). */
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  /** Maximum number of tags; matches MAX_TAGS_PER_ITEM on the server. */
  max?: number
  className?: string
}

const MAX_SUGGESTIONS = 20
const DEBOUNCE_MS = 200

/**
 * Tag input with typeahead.
 *
 * Replaces the comma-separated text field, which had no suggestions and made
 * near-duplicate tags ("react" / "reactjs") easy to create by accident.
 * Selected tags are chips; typing filters existing tags and offers to create a
 * new one when nothing matches.
 */
export function TagPicker({
  id,
  value,
  onChange,
  placeholder,
  max = 20,
  className,
}: TagPickerProps) {
  const t = useTranslations("tags")
  const [query, setQuery] = useState("")
  const [options, setOptions] = useState<TagOption[]>([])
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const [loading, setLoading] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const listId = `${id ?? "tag-picker"}-listbox`

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const handle = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/tags?q=${encodeURIComponent(query.trim())}&limit=${MAX_SUGGESTIONS}`
        )
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && Array.isArray(data)) setOptions(data)
      } catch {
        // suggestions are a convenience; ignore network errors
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [query, open])

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [])

  const selected = useMemo(
    () => new Set(value.map((name) => name.toLowerCase())),
    [value]
  )

  const suggestions = options.filter((option) => !selected.has(option.name.toLowerCase()))
  const trimmed = query.trim()
  const exactMatch = suggestions.some((option) => option.name.toLowerCase() === trimmed.toLowerCase())
  const canCreate = trimmed.length > 0 && !exactMatch && !selected.has(trimmed.toLowerCase()) && value.length < max

  function addTag(name: string) {
    const clean = name.replace(/,/g, " ").trim()
    if (!clean || value.length >= max) return
    if (selected.has(clean.toLowerCase())) {
      setQuery("")
      return
    }
    onChange([...value, clean])
    setQuery("")
    setHighlight(0)
  }

  function removeTag(name: string) {
    onChange(value.filter((item) => item !== name))
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault()
      if (canCreate) addTag(trimmed)
      else if (suggestions[highlight]) addTag(suggestions[highlight].name)
      else addTag(trimmed)
      return
    }
    if (event.key === "Backspace" && query.length === 0 && value.length > 0) {
      removeTag(value[value.length - 1])
      return
    }
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setOpen(true)
      setHighlight((current) => Math.min(current + 1, Math.max(suggestions.length - 1, 0)))
      return
    }
    if (event.key === "ArrowUp") {
      event.preventDefault()
      setHighlight((current) => Math.max(current - 1, 0))
      return
    }
    if (event.key === "Escape") setOpen(false)
  }

  const showList = open && (suggestions.length > 0 || canCreate || loading)

  return (
    <div ref={boxRef} className={cn("relative", className)}>
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-xl border bg-background px-2 py-1.5 transition-all focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/20">
        {value.map((name) => (
          <span
            key={name}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium"
          >
            {name}
            <button
              type="button"
              onClick={() => removeTag(name)}
              aria-label={t("remove", { name })}
              className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          value={query}
          placeholder={value.length === 0 ? placeholder : undefined}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
            setHighlight(0)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="min-w-[8rem] flex-1 bg-transparent px-1 py-1 text-sm outline-none"
        />
        {loading && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />}
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border bg-popover p-1 shadow-lg"
        >
          {suggestions.map((option, index) => (
            <li key={option.id} role="option" aria-selected={index === highlight}>
              <button
                type="button"
                // Keep focus in the input so the list does not close on blur.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => addTag(option.name)}
                onMouseEnter={() => setHighlight(index)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                  index === highlight ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"
                )}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full border"
                  style={{ backgroundColor: option.color }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate">{option.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{option.usageCount}</span>
              </button>
            </li>
          ))}
          {canCreate && (
            <li role="option" aria-selected={false}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => addTag(trimmed)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-primary transition-colors hover:bg-accent"
              >
                <Plus className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{t("createOption", { name: trimmed })}</span>
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
