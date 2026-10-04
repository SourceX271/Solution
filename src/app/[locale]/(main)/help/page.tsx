import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("help");
  return { title: t("title") };
}

export default async function HelpPage() {
  const t = await getTranslations("help");
  // Rich text keeps the link inside the sentence, so each locale controls its
  // own word order (Chinese needs "在…中" around the link).
  const link = (href: string) =>
    function LinkChunk(chunks: React.ReactNode) {
      return (
        <Link href={href} className="text-primary hover:underline">
          {chunks}
        </Link>
      );
    };

  return (
    <div className="container mx-auto max-w-2xl px-4 py-16 animate-fade-in">
      <h1 className="text-3xl font-bold gradient-text mb-6">{t("title")}</h1>
      <div className="prose-custom max-w-none">
        <h2>{t("gettingStarted")}</h2>
        <ol>
          <li>{t.rich("step1", { link: link("/register") })}</li>
          <li>{t.rich("step2", { link: link("/docs") })}</li>
          <li>{t.rich("step3", { link: link("/questions") })}</li>
          <li>{t.rich("step4", { link: link("/software") })}</li>
        </ol>
        <h2>{t("publishing")}</h2>
        <p>{t("publishingText")}</p>
        <h2>{t("guidelines")}</h2>
        <ul>
          <li>{t("rule1")}</li>
          <li>{t("rule2")}</li>
          <li>{t("rule3")}</li>
        </ul>
        <p>{t.rich("moreQuestions", { link: link("/contact") })}</p>
      </div>
    </div>
  )
}
