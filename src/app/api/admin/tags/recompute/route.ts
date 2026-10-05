import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-guard";
import { logAdminAction } from "@/lib/audit";
import { revalidateTags } from "@/lib/revalidate";
import { recomputeTagUsage } from "@/lib/tags";

/**
 * Rebuild every Tag.usageCount from the actual relations.
 *
 * The counter is denormalized and drifts whenever content is written outside
 * the normal paths (bulk edits, direct DB changes, legacy rows). The admin tag
 * page shows stored vs actual counts, so this is the one-click repair.
 */
export async function POST(req: Request) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  try {
    const result = await recomputeTagUsage();

    await logAdminAction({
      actor: guard.user,
      action: "tag.recompute",
      targetType: "tag",
      metadata: result,
      req,
    });
    revalidateTags();

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Tag recompute failed", error);
    return NextResponse.json({ success: false, error: "recomputeFailed" }, { status: 500 });
  }
}
