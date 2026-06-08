import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const source = await prisma.crawlSource.findUnique({ where: { id: params.id } })
  if (!source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 })
  }

  // Create a log entry - actual crawling would be triggered here
  try {
    await prisma.crawlLog.create({
      data: {
        sourceId: source.id,
        sourceName: source.name,
        status: "running",
        itemsFound: 0,
        itemsAdded: 0,
        message: "Crawl initiated from admin panel",
      },
    })

    await prisma.crawlSource.update({
      where: { id: params.id },
      data: { lastRun: new Date() },
    })

    return NextResponse.json({ success: true, message: "Crawl triggered" })
  } catch {
    return NextResponse.json({ error: "Trigger failed" }, { status: 500 })
  }
}