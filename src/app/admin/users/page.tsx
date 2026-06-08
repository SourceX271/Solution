import { prisma } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Users } from "lucide-react"
import { UserActions } from "./UserActions"
import { UserSearch } from "./UserSearch"

export const dynamic = "force-dynamic"

const roleColors: Record<string, "default" | "secondary" | "success" | "warning" | "destructive" | "outline"> = {
  USER: "secondary",
  AUTHOR: "default",
  MODERATOR: "warning",
  ADMIN: "destructive",
}

const PAGE_SIZE = 15

export default async function UsersPage({
  searchParams,
}: {
  searchParams: { search?: string; page?: string }
}) {
  const search = searchParams.search || ""
  const page = Math.max(1, parseInt(searchParams.page || "1"))
  const skip = (page - 1) * PAGE_SIZE

  const where: any = {}
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
    ]
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        _count: { select: { articles: true, questions: true, software: true } },
      },
    }),
    prisma.user.count({ where }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Users</h2>
          <p className="text-muted-foreground">Manage user accounts and roles</p>
        </div>
        <UserSearch defaultValue={search} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <Users className="h-5 w-5" />
          <CardTitle className="text-lg">{total} Users</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Content</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name || "Unnamed"}</TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={roleColors[user.role] || "secondary"}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {user._count.articles + user._count.questions + user._count.software} items
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString("zh-CN")}
                    </TableCell>
                    <TableCell className="text-right">
                      <UserActions userId={user.id} currentRole={user.role} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Showing {skip + 1}-{Math.min(page * PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex items-center gap-2">
                {page > 1 && (
                  <a
                    href={`/admin/users?search=${encodeURIComponent(search)}&page=${page - 1}`}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-3 border border-input bg-background hover:bg-accent"
                  >
                    Previous
                  </a>
                )}
                <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                {page < totalPages && (
                  <a
                    href={`/admin/users?search=${encodeURIComponent(search)}&page=${page + 1}`}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-3 border border-input bg-background hover:bg-accent"
                  >
                    Next
                  </a>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}