import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getSoftwareSchema } from "@/lib/validations";
import { getApiT } from "@/lib/api-i18n";
import { generateSlug } from "@/lib/utils";
import { resolveTags, parseTagInput, bumpTagUsage } from "@/lib/tags";
import { toPositiveInt } from "@/lib/errors";

export async function GET(req: NextRequest) {
  const t = await getApiT("api");
  try {
    const { searchParams } = new URL(req.url);
    const page = toPositiveInt(searchParams.get("page"), 1);
    const limit = toPositiveInt(searchParams.get("limit"), 10, 100);
    const category = searchParams.get("category");
    const skip = (page - 1) * limit;

    const where: any = { status: "published" };
    if (category) where.category = category;

    const [data, total] = await Promise.all([
      prisma.software.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          author: { select: { id: true, name: true, image: true } },
          _count: { select: { comments: true } },
        },
      }),
      prisma.software.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, limit });
  } catch (error) {
    return NextResponse.json(
      { error: t("getFailed", { entity: t("entity.software") }) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const t = await getApiT("api");
  const tv = await getApiT("validation");
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: t("unauthorized") }, { status: 401 });
    }

    const body = await req.json();
    const parsed = getSoftwareSchema(tv).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { name, description, url, category, tags } = parsed.data;
    const slug = generateSlug();

    const tagConnections = await resolveTags(parseTagInput(tags));
    const software = await prisma.software.create({
      data: {
        tags: {
          connectOrCreate: tagConnections.map((t) => ({
            where: { slug: t.slug },
            create: { name: t.name, slug: t.slug },
          })),
        },
        name,
        slug,
        description,
        url: url || null,
        category,
        authorId: (session.user as any).id,
      },
      include: {
        author: { select: { id: true, name: true, image: true } },
      },
    });

    await bumpTagUsage(tagConnections.map((t) => t.slug), 1);

    return NextResponse.json(software, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: t("createFailed", { entity: t("entity.software") }) },
      { status: 500 }
    );
  }
}
