import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { getRegisterSchema } from "@/lib/validations";
import { getApiT } from "@/lib/api-i18n";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const t = await getApiT("api");
  const tv = await getApiT("validation");
  try {
    const { allowed } = checkRateLimit(getRateLimitKey(req, "register"), { windowMs: 60000, maxRequests: 5 });
    if (!allowed) {
      return NextResponse.json({ error: t("rateLimitedRegister") }, { status: 429 });
    }
    const body = await req.json();
    const parsed = getRegisterSchema(tv).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { name, email, password } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: t("registerInvalid") }, { status: 400 });
    }

    const passwordHash = await hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, passwordHash },
    });

    return NextResponse.json({ id: user.id, name: user.name, email: user.email }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: t("registerFailed") }, { status: 500 });
  }
}
