import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getApiT } from "@/lib/api-i18n";
import { requireAdminApi } from "@/lib/admin-guard";
import { logAdminAction } from "@/lib/audit";
import { revalidateSiteConfig } from "@/lib/revalidate";
import { readJson } from "@/lib/request";

/**
 * Every optional text field has to accept `null`: the settings form sends an
 * explicit null when a box is cleared, and a plain `.optional()` rejects null —
 * which made the whole form fail with 400 as soon as one field was empty.
 */
const optionalText = (max: number) => z.string().max(max).nullable().optional();

const settingsSchema = z.object({
  siteName: z.string().min(1).max(100).optional(),
  siteDescription: z.string().max(500).optional(),
  logo: optionalText(500),
  keywords: optionalText(500),
  contactEmail: z
    .union([z.string().email().max(200), z.literal("")])
    .nullable()
    .optional(),
  githubUrl: optionalText(500),
  twitterUrl: optionalText(500),
  footerText: optionalText(500),
  icpNumber: optionalText(100),
  enableSolutions: z.boolean().optional(),
  enableQuestions: z.boolean().optional(),
  enableSoftware: z.boolean().optional(),
  // The featured pickers store `__none__` when the admin clears a selection;
  // normalise it to null so the sentinel never reaches the database.
  featuredArticle: z.string().max(64).nullable().optional(),
  featuredQuestion: z.string().max(64).nullable().optional(),
  featuredSoftware: z.string().max(64).nullable().optional(),
});

const NONE_SENTINEL = "__none__";

function normalizeFeatured(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null || value === "" || value === NONE_SENTINEL) return null;
  return value;
}

export async function GET() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const config = await prisma.siteConfig.upsert({
    where: { id: "main" },
    update: {},
    create: { id: "main" },
  });
  return NextResponse.json(config);
}

export async function PUT(req: Request) {
  const t = await getApiT("api");
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const body = await readJson(req);
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: `${t("validationFailed")}: ${parsed.error.errors[0]?.path.join(".")}` },
      { status: 400 }
    );
  }

  const { featuredArticle, featuredQuestion, featuredSoftware, ...rest } = parsed.data;
  const data = {
    ...rest,
    featuredArticle: normalizeFeatured(featuredArticle),
    featuredQuestion: normalizeFeatured(featuredQuestion),
    featuredSoftware: normalizeFeatured(featuredSoftware),
  };

  // Drop undefined so an omitted key never overwrites a stored value with null.
  const cleaned = Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  );

  try {
    const config = await prisma.siteConfig.upsert({
      where: { id: "main" },
      update: cleaned,
      create: { id: "main", ...cleaned },
    });

    await logAdminAction({
      actor: guard.user,
      action: "settings.update",
      targetType: "settings",
      targetId: "main",
      targetLabel: config.siteName,
      metadata: { fields: Object.keys(cleaned) },
      req,
    });
    revalidateSiteConfig();

    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    console.error("Admin settings update failed", error);
    return NextResponse.json({ error: t("updateFailed", { entity: t("entity.settings") }) }, { status: 500 });
  }
}
