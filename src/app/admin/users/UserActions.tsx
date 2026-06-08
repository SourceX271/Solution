"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { MoreHorizontal } from "lucide-react"

const roles = ["USER", "AUTHOR", "MODERATOR", "ADMIN"]

interface UserActionsProps {
  userId: string
  currentRole: string
}

export function UserActions({ userId, currentRole }: UserActionsProps) {
  const router = useRouter()
  const [role, setRole] = useState(currentRole)
  const [loading, setLoading] = useState(false)

  async function handleRoleChange(newRole: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      })
      if (res.ok) {
        setRole(newRole)
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Select value={role} onValueChange={handleRoleChange} disabled={loading}>
      <SelectTrigger className="w-[130px] h-8 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {roles.map((r) => (
          <SelectItem key={r} value={r} className="text-xs">
            {r}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}