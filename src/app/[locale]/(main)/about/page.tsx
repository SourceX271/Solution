import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("about");
  return { title: t("title") };
}

export default async function AboutPage() {
  const t = await getTranslations("about");
  return (
    <div className="container mx-auto max-w-2xl px-4 py-16 animate-fade-in">
      <h1 className="text-3xl font-bold gradient-text mb-6">{t("title")}</h1>
      <div className="prose-custom max-w-none">
        <p>{t("intro")}</p>
        <p>{t("mission")}</p>
        <h2>{t("featuresTitle")}</h2>
        <ul>
          <li>{t("featureSolutions")}</li>
          <li>{t("featureQuestions")}</li>
          <li>{t("featureSoftware")}</li>
          <li>{t("featureI18n")}</li>
        </ul>
      </div>
    </div>
  )
}
