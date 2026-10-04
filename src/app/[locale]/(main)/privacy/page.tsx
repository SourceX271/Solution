import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("privacy");
  return { title: t("title") };
}

export default async function PrivacyPage() {
  const t = await getTranslations("privacy");
  return (
    <div className="container mx-auto max-w-2xl px-4 py-16 animate-fade-in">
      <h1 className="text-3xl font-bold gradient-text mb-6">{t("title")}</h1>
      <div className="prose-custom max-w-none">
        <p>{t("intro")}</p>
        <h2>{t("collectTitle")}</h2>
        <ul>
          <li>{t("collect1")}</li>
          <li>{t("collect2")}</li>
          <li>{t("collect3")}</li>
        </ul>
        <h2>{t("usageTitle")}</h2>
        <ul>
          <li>{t("usage1")}</li>
          <li>{t("usage2")}</li>
          <li>{t("usage3")}</li>
        </ul>
        <h2>{t("securityTitle")}</h2>
        <p>{t("securityText")}</p>
        <h2>{t("contactTitle")}</h2>
        <p>{t("contactText")}</p>
      </div>
    </div>
  )
}
