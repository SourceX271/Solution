import { prisma } from "@/lib/db"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { FileText, HelpCircle, Package } from "lucide-react"
import { ContentActions } from "./ContentActions"
import { StatusFilter } from "./StatusFilter"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 10

type ContentType = "articles" | "questions" | "software"

const typeLabels: Record<ContentType, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  articles: { label: "Articles", icon: FileText },
  questions: { label: "Questions", icon: HelpCircle },
  software: { label: "Software", icon: Package },
}

const statusColors: Record<string, "default" | "secondary" | "success" | "warning" | "destructive" | "outline"> = {
  published: "success",
  draft: "warning",
  open: "success",
  closed: "secondary",
  resolved: "default",
  pending: "warning",
}

const statusOptions: Record<ContentType, string[]> = {
  articles: ["all", "published", "draft"],
  questions: ["all", "open", "closed", "resolved"],
  software: ["all", "published", "pending"],
}

async function getContent(type: ContentType, status: string, page: number) {
  const skip = (page - 1) * PAGE_SIZE
  const where: any = {}
  if (status && status !== "all") where.status = status

  if (type === "articles") {
    const [items, total] = await Promise.all([
      prisma.article.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: PAGE_SIZE, include: { author: { select: { id: true, name: true } } } }),
      prisma.article.count({ where }),
    ])
    return { items, total }
  } else if (type === "questions") {
    const [items, total] = await Promise.all([
      prisma.question.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: PAGE_SIZE, include: { author: { select: { id: true, name: true } } } }),
      prisma.question.count({ where }),
    ])
    return { items, total }
  } else {
    const [items, total] = await Promise.all([
      prisma.software.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: PAGE_SIZE, include: { author: { select: { id: true, name: true } } } }),
      prisma.software.count({ where }),
    ])
    return { items, total }
  }
}

export default async function ContentPage({
  searchParams,
}: {
  searchParams: { type?: string; status?: string; page?: string }
}) {
  const type = (searchParams.type as ContentType) || "articles"
  const status = searchParams.status || "all"
  const page = Math.max(1, parseInt(searchParams.page || "1"))
  const { items, total } = await getContent(type, status, page)
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const Icon = typeLabels[type].icon

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Content Management</h2>
        <p className="text-muted-foreground">Manage articles, questions, and software</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        {(Object.entries(typeLabels) as [ContentType, typeof typeLabels[ContentType]][]).map(([key, { label, icon: TabIcon }]) => (
          <Link
            key={key}
            href={`/admin/content?type=${key}&status=${status}`}
            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              type === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <TabIcon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg flex items-center gap-2">
            <Icon className="h-5 w-5" />
            {typeLabels[type].label}
          </CardTitle>
          <div className="flex items-center gap-3">
            <StatusFilter type={type} currentStatus={status} options={statusOptions[type]} />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No {typeLabels[type].label.toLowerCase()} found.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium max-w-[300px] truncate">
                      {item.title || item.name}
                    </TableCell>
                    <TableCell>{item.author?.name || "Unknown"}</TableCell>
                    <TableCell>
                      <Badge variant={statusColors[item.status] || "secondary"}>
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString("zh-CN")}
                    </TableCell>
                    <TableCell className="text-right">
                      <ContentActions type={type} id={item.id} status={item.status} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex items-center gap-2">
                {page > 1 && (
                  <Link
                    href={`/admin/content?type=${type}&status=${status}&page=${page - 1}`}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-3 border border-input bg-background hover:bg-accent"
                  >
                    Previous
                  </Link>
                )}
                <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                {page < totalPages && (
                  <Link
                    href={`/admin/content?type=${type}&status=${status}&page=${page + 1}`}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-3 border border-input bg-background hover:bg-accent"
                  >
                    Next
                  </Link>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}