import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { routing } from "@/i18n/routing";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SessionProvider } from "@/components/SessionProvider";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { FooterClient } from "@/components/layout/FooterClient";
import { HtmlLang } from "@/components/HtmlLang";
import { Toaster } from "sonner";
import { BackToTop } from "@/components/client/BackToTop";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isEn = locale === "en";
  const t = await getTranslations({ locale, namespace: "common" });
  const siteName = t("siteName");
  const description = t("siteDescription");
  const keywords = t("metaKeywords")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  return {
    title: {
      default: siteName,
      template: `%s | ${siteName}`,
    },
    description,
    // The root layout cannot know the locale, so every localized field is set
    // here — otherwise the Chinese defaults leak into /en's <head>.
    keywords,
    openGraph: {
      type: "website",
      siteName,
      description,
      url: "/",
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: siteName }],
      locale: isEn ? "en_US" : "zh_CN",
      alternateLocale: isEn ? ["zh_CN"] : ["en_US"],
    },
    twitter: {
      card: "summary_large_image",
      title: siteName,
      description,
      images: ["/og-image.png"],
    },
    alternates: {
      languages: {
        zh: "/",
        en: "/en",
      },
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as any)) notFound();

  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <HtmlLang />
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <SessionProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <FooterClient>
            <Footer />
          </FooterClient>
          <BackToTop />
          <Toaster
            position="top-center"
            richColors
            closeButton
            toastOptions={{
              classNames: {
                toast: "rounded-xl border shadow-lg",
                title: "text-sm font-medium",
                description: "text-xs",
              },
            }}
          />
        </SessionProvider>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
