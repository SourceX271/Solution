"use client"

import { useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export type BaseParams = Record<string, string | undefined>

function buildQuery(base: BaseParams, key: string, value?: string) {
  const params = new URLSearchParams()
  for (const [name, current] of Object.entries(base)) {
    if (name === key || name === "page") continue
    if (current) params.set(name, current)
  }
  if (value) params.set(key, value)
  return params.toString()
}

interface SearchInputProps {
  /** Query parameter this input writes to. */
  paramKey?: string
  defaultValue?: string
  placeholder: string
  label: string
  /** Other active filters, preserved when the search is applied. */
  base: BaseParams
}

export function SearchInput({
  paramKey = "search",
  defaultValue = "",
  placeholder,
  label,
  base,
}: SearchInputProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [value, setValue] = useState(defaultValue)
  const t = useTranslations("common")

  function submit(next: string) {
    const query = buildQuery(base, paramKey, next.trim() || undefined)
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault()
        submit(value)
      }}
      className="flex items-center gap-2"
    >
      <label className="sr-only" htmlFor={`admin-search-${paramKey}`}>
        {label}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={`admin-search-${paramKey}`}
          type="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          className="h-9 w-56 pl-9 pr-8"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              setValue("")
              submit("")
            }}
            aria-label={t("clear")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <Button type="submit" size="sm" variant="outline">
        {t("search")}
      </Button>
    </form>
  )
}

export interface FilterOption {
  value: string
  label: string
  count?: number
}

interface FilterSelectProps {
  paramKey: string
  value: string
  options: FilterOption[]
  label: string
  className?: string
  base: BaseParams
}

export function FilterSelect({ paramKey, value, options, label, className, base }: FilterSelectProps) {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <Select
      value={value}
      onValueChange={(next) => {
        const query = buildQuery(base, paramKey, next)
        router.push(query ? `${pathname}?${query}` : pathname)
      }}
    >
      <SelectTrigger className={className ?? "h-9 w-40"} aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
            {option.count !== undefined ? ` (${option.count})` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
