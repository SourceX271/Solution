"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface StatusFilterProps {
  type: string
  currentStatus: string
  options: string[]
}

export function StatusFilter({ type, currentStatus, options }: StatusFilterProps) {
  const router = useRouter()

  function handleChange(value: string) {
    router.push(`/admin/content?type=${type}&status=${value}`)
  }

  return (
    <Select value={currentStatus} onValueChange={handleChange}>
      <SelectTrigger className="w-[140px]">
        <SelectValue placeholder="Filter status" />
      </SelectTrigger>
      <SelectContent>
        {options.map((s) => (
          <SelectItem key={s} value={s}>
            {s === "all" ? "All Statuses" : s.charAt(0).toUpperCase() + s.slice(1)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}