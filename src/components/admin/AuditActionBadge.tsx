"use client"

import { useTranslations } from "next-intl"
import { Badge } from "@/components/ui/badge"

type Variant = "default" | "secondary" | "destructive" | "warning" | "success" | "outline"

/**
 * One explicit case per audited action keeps every translation key statically
 * reachable for `npm run i18n:check` (dynamic keys cannot be verified).
 */
export function AuditActionBadge({ action }: { action: string }) {
  const t = useTranslations("admin.auditActions")

  const render = (label: string, variant: Variant) => <Badge variant={variant}>{label}</Badge>

  switch (action) {
    case "content.update":
      return render(t("contentUpdate"), "secondary")
    case "content.delete":
      return render(t("contentDelete"), "destructive")
    case "content.bulkPublish":
      return render(t("contentBulkPublish"), "success")
    case "content.bulkUnpublish":
      return render(t("contentBulkUnpublish"), "warning")
    case "content.bulkDelete":
      return render(t("contentBulkDelete"), "destructive")
    case "comment.delete":
      return render(t("commentDelete"), "destructive")
    case "user.role.update":
      return render(t("userRoleUpdate"), "default")
    case "user.ban":
      return render(t("userBan"), "destructive")
    case "user.unban":
      return render(t("userUnban"), "success")
    case "user.delete":
      return render(t("userDelete"), "destructive")
    case "crawler.source.create":
      return render(t("crawlerSourceCreate"), "success")
    case "crawler.source.update":
      return render(t("crawlerSourceUpdate"), "secondary")
    case "crawler.source.delete":
      return render(t("crawlerSourceDelete"), "destructive")
    case "crawler.run":
      return render(t("crawlerRun"), "outline")
    case "tag.update":
      return render(t("tagUpdate"), "secondary")
    case "tag.delete":
      return render(t("tagDelete"), "destructive")
    case "tag.merge":
      return render(t("tagMerge"), "warning")
    case "tag.recompute":
      return render(t("tagRecompute"), "outline")
    case "settings.update":
      return render(t("settingsUpdate"), "default")
    default:
      return render(action, "outline")
  }
}
