import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiT } from "@/lib/api-i18n";
import { requireAdminApi } from "@/lib/admin-guard";
import { updateUserAccount, deleteUserAccount, type UserMutationErrorKey } from "@/lib/admin-user-actions";
import { revalidateContentList } from "@/lib/revalidate";

const userUpdateSchema = z.object({
  role: z.enum(["USER", "ADMIN"]).optional(),
  banned: z.boolean().optional(),
  banReason: z.string().max(300).nullable().optional(),
});

function errorResponse(errorKey: UserMutationErrorKey, status: number, t: Awaited<ReturnType<typeof getApiT>>) {
  const message =
    errorKey === "notFound"
      ? t("notFound", { entity: t("entity.user") })
      : errorKey === "invalidParams"
        ? t("invalidParams")
        : t(errorKey);
  return NextResponse.json({ error: message }, { status });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const t = await getApiT("api");
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  const parsed = userUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: t("validationFailed") }, { status: 400 });
  }

  try {
    const result = await updateUserAccount(guard.user, params.id, parsed.data, req);
    if (!result.ok) return errorResponse(result.errorKey, result.status, t);
    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error("Admin user update failed", error);
    return NextResponse.json({ error: t("updateFailed", { entity: t("entity.user") }) }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const t = await getApiT("api");
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  try {
    const result = await deleteUserAccount(guard.user, params.id, req);
    if (!result.ok) return errorResponse(result.errorKey, result.status, t);

    for (const type of ["articles", "questions", "software"] as const) {
      revalidateContentList(type);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin user delete failed", error);
    return NextResponse.json({ error: t("deleteFailed", { entity: t("entity.user") }) }, { status: 500 });
  }
}
