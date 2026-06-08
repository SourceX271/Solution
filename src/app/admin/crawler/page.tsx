import { prisma } from "@/lib/db"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Radio } from "lucide-react"
import { CrawlerActions } from "./CrawlerActions"
import { AddSourceForm } from "./AddSourceForm"

export const dynamic = "force-dynamic"

export default async function CrawlerPage() {
  const sources = await prisma.crawlSource.findMany({
    orderBy: { createdAt: "desc" },
  })

  const crawlLogs = await prisma.crawlLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Crawler</h2>
        <p className="text-muted-foreground">Manage content crawler sources and monitor logs</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sources */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <Radio className="h-5 w-5" />
              <CardTitle className="text-lg">Crawl Sources ({sources.length})</CardTitle>
            </div>
            <AddSourceForm />
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No crawl sources configured. Add one to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  sources.map((source) => (
                    <TableRow key={source.id}>
                      <TableCell className="font-medium">{source.name}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">
                        {source.url}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{source.category}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={source.enabled ? "success" : "secondary"}>
                          {source.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {source.lastRun
                          ? new Date(source.lastRun).toLocaleDateString("zh-CN")
                          : "Never"}
                      </TableCell>
                      <TableCell className="text-right">
                        <CrawlerActions sourceId={source.id} enabled={source.enabled} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Crawl Logs */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <Radio className="h-5 w-5" />
            <CardTitle className="text-lg">Crawl Logs</CardTitle>
            <CardDescription>Recent 20 crawl attempts</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Items Found</TableHead>
                  <TableHead>Items Added</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {crawlLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No crawl logs yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  crawlLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">{log.sourceName}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            log.status === "success" ? "success"
                            : log.status === "error" ? "destructive"
                            : "warning"
                          }
                        >
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{log.itemsFound}</TableCell>
                      <TableCell>{log.itemsAdded}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">
                        {log.message || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(log.createdAt).toLocaleDateString("zh-CN")}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}