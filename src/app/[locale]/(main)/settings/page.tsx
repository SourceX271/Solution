import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SettingsForm } from "./SettingsForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("title") };
}

export default async function SettingsPage() {
  const t = await getTranslations("settings");
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
      <h1 className="mb-8 text-3xl font-bold gradient-text">{t("title")}</h1>
      <SettingsForm user={user} />
    </div>
  );
}
