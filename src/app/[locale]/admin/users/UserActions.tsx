"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { MoreHorizontal } from "lucide-react"
import { toast } from "sonner"

// Keep in sync with z.enum(["USER","ADMIN"]) in api/admin/users/[id]/route.ts:
// AUTHOR/MODERATOR were offered but always rejected with 400.
const roles = ["USER", "ADMIN"]

interface UserActionsProps {
  userId: string
  currentRole: string
}

export function UserActions({ userId, currentRole }: UserActionsProps) {
  const router = useRouter()
  const [role, setRole] = useState(currentRole)
  const [loading, setLoading] = useState(false)

  async function handleRoleChange(newRole: string) {
    if (newRole === role) return
    if (!window.confirm(`确定将用户角色修改为 ${newRole} 吗？`)) return

    setLoading(true)
    const previous = role
    setRole(newRole)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      })
      if (res.ok) {
        toast.success("角色已更新")
        router.refresh()
      } else {
        const data = await res.json().catch(() => null)
        setRole(previous)
        toast.error(data?.error || "角色更新失败")
      }
    } catch {
      setRole(previous)
      toast.error("角色更新失败，请检查网络")
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