"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search } from "lucide-react"

interface UserSearchProps {
  defaultValue: string
}

export function UserSearch({ defaultValue }: UserSearchProps) {
  const router = useRouter()
  const [value, setValue] = useState(defaultValue)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    router.push(`/admin/users?search=${encodeURIComponent(value)}`)
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Input
        placeholder="Search by name or email..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-64"
      />
      <Button type="submit" size="sm" variant="outline">
        <Search className="h-4 w-4" />
      </Button>
    </form>
  )
}