"use client"

import { useState } from "react"
import { Link } from "@/i18n/routing"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { MoreHorizontal, ShieldOff, ShieldCheck, Trash2, Eye } from "lucide-react"

// Keep in sync with the zod enum in api/admin/users/[id]/route.ts:
// AUTHOR/MODERATOR were offered here once but always rejected with 400.
const ROLES = ["USER", "ADMIN"] as const

interface UserRowActionsProps {
  userId: string
  email: string
  currentRole: string
  banned: boolean
  /** Server-computed: the acting admin cannot modify their own account here. */
  isSelf: boolean
  /** Server-computed: target is the only usable administrator. */
  isLastAdmin: boolean
}

export function UserRowActions({
  userId,
  email,
  currentRole,
  banned,
  isSelf,
  isLastAdmin,
}: UserRowActionsProps) {
  const router = useRouter()
  const t = useTranslations("admin")
  const tu = useTranslations("admin.usersUi")
  const [role, setRole] = useState(currentRole)
  const [loading, setLoading] = useState(false)
  const [banOpen, setBanOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [confirmEmail, setConfirmEmail] = useState("")

  const roleLocked = isSelf || isLastAdmin

  async function request(body: Record<string, unknown>, successMessage: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => null)
      if (res.ok) {
        toast.success(successMessage)
        router.refresh()
        return true
      }
      toast.error(data?.error || tu("actionFailed"))
      return false
    } catch {
      toast.error(tu("actionFailedNetwork"))
      return false
    } finally {
      setLoading(false)
    }
  }

  async function handleRoleChange(newRole: string) {
    if (newRole === role) return
    if (!window.confirm(t("roleConfirm", { role: newRole }))) return
    const previous = role
    setRole(newRole)
    const ok = await request({ role: newRole }, t("roleUpdated"))
    if (!ok) setRole(previous)
  }

  async function handleBanToggle() {
    const success = await request(
      { banned: !banned, banReason: banned ? null : reason || null },
      banned ? tu("unbanDone") : tu("banDone")
    )
    if (success) {
      setBanOpen(false)
      setReason("")
    }
  }

  async function handleDelete() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" })
      const data = await res.json().catch(() => null)
      if (res.ok) {
        toast.success(tu("deleteDone"))
        setDeleteOpen(false)
        router.refresh()
      } else {
        toast.error(data?.error || tu("actionFailed"))
      }
    } catch {
      toast.error(tu("actionFailedNetwork"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Select value={role} onValueChange={handleRoleChange} disabled={loading || roleLocked}>
        <SelectTrigger
          className="h-8 w-[110px] text-xs"
          aria-label={tu("changeRole")}
          title={isLastAdmin ? tu("lastAdminHint") : undefined}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROLES.map((value) => (
            <SelectItem key={value} value={value} className="text-xs">
              {value}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button variant="ghost" size="icon" asChild title={tu("viewDetails")}>
        <Link href={`/admin/users/${userId}`} aria-label={tu("viewDetails")}>
          <Eye className="h-4 w-4" />
        </Link>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={tu("moreActions")} title={tu("moreActions")}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem disabled={isSelf} onSelect={() => setBanOpen(true)}>
            {banned ? (
              <>
                <ShieldCheck className="mr-2 h-4 w-4" />
                {tu("unban")}
              </>
            ) : (
              <>
                <ShieldOff className="mr-2 h-4 w-4" />
                {tu("ban")}
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={isSelf || isLastAdmin}
            className="text-destructive focus:text-destructive"
            onSelect={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {tu("deleteUser")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Ban / unban */}
      <Dialog open={banOpen} onOpenChange={setBanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{banned ? tu("unbanTitle") : tu("banTitle")}</DialogTitle>
            <DialogDescription>
              {banned ? tu("unbanDesc", { email }) : tu("banDesc", { email })}
            </DialogDescription>
          </DialogHeader>
          {!banned && (
            <div className="space-y-2 py-2">
              <Label htmlFor={`ban-reason-${userId}`}>{tu("banReason")}</Label>
              <Input
                id={`ban-reason-${userId}`}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={tu("banReasonPlaceholder")}
                maxLength={300}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanOpen(false)} disabled={loading}>
              {tu("cancel")}
            </Button>
            <Button variant={banned ? "default" : "destructive"} onClick={handleBanToggle} disabled={loading}>
              {banned ? tu("unban") : tu("ban")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tu("deleteTitle")}</DialogTitle>
            <DialogDescription>{tu("deleteDesc", { email })}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor={`confirm-email-${userId}`}>{tu("deleteConfirmLabel")}</Label>
            <Input
              id={`confirm-email-${userId}`}
              value={confirmEmail}
              onChange={(event) => setConfirmEmail(event.target.value)}
              placeholder={email}
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={loading}>
              {tu("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading || confirmEmail.trim().toLowerCase() !== email.toLowerCase()}
            >
              {tu("deleteUser")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
