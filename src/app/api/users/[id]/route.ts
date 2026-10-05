import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getProfileSchema } from "@/lib/validations";
import { getApiT } from "@/lib/api-i18n";
import { getSessionUser, isActiveAdmin } from "@/lib/admin-guard";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const t = await getApiT("api");
  try {
    const session = await auth();
    const viewer = session ? await getSessionUser() : null;
    const isOwner = viewer?.id === params.id;
    // Admin status is re-read from the database instead of trusting the role
    // baked into the JWT at sign-in.
    const isAdmin = isActiveAdmin(viewer);

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        email: !!(isOwner || isAdmin), // Only return email to owner or admin
        image: true,
        role: true,
        bio: true,
        createdAt: true,
        _count: {
          select: { articles: true, questions: true, answers: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: t("notFound", { entity: t("entity.user") }) },
        { status: 404 }
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json(
      { error: t("getFailed", { entity: t("entity.user") }) },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const t = await getApiT("api");
  const tv = await getApiT("validation");
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: t("unauthorized") }, { status: 401 });
    }

    const userId = (session.user as any).id;
    if (params.id !== userId) {
      return NextResponse.json({ error: t("profileUpdateSelfOnly") }, { status: 403 });
    }

    const body = await req.json();
    const parsed = getProfileSchema(tv).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { name, bio, image } = parsed.data;

    const updated = await prisma.user.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(bio !== undefined && { bio }),
        ...(image !== undefined && { image }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        bio: true,
        createdAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: t("updateFailed", { entity: t("entity.user") }) },
      { status: 500 }
    );
  }
}
