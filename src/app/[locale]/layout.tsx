import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SessionProvider } from "@/components/SessionProvider";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { FooterClient } from "@/components/layout/FooterClient";
import { Toaster } from "sonner";
import { BackToTop } from "@/components/client/BackToTop";

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
