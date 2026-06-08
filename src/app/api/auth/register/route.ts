import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { registerSchema } from "@/lib/validations";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { name, email, password } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "该邮箱已被注册" }, { status: 409 });
    }

    const passwordHash = await hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, passwordHash },
    });

    return NextResponse.json({ id: user.id, name: user.name, email: user.email }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "注册失败，请稍后重试" }, { status: 500 });
  }
}
