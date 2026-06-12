import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SettingsForm } from "./SettingsForm";

export const metadata: Metadata = { title: "账户设置" };

export default async function SettingsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const userId = session.user?.id as string;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, image: true, bio: true },
  });

  if (!user) redirect("/login");

  return (
    <div className="container mx-auto max-w-2xl px-4 py-10 animate-fade-in">
      <h1 className="mb-8 text-3xl font-bold gradient-text">账户设置</h1>
      <SettingsForm user={user} />
    </div>
  );
}
