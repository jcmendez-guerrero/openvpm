import type { Metadata } from "next";
import { Inter, DM_Sans } from "next/font/google";
import { Providers } from "@/lib/providers";
import { AppIntlProvider } from "@/components/common/intl-provider";
import { isLanguageSelectionEnabled } from "@/i18n/config";
import { getTranslatorFor, messagesFor } from "@/i18n/messages";
import { getRequestLanguage } from "@/i18n/request";
import "@/styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: "OpenVPM: Open-Source Veterinary Practice Management",
  description:
    "The first modern, open-source, API-first practice management system built for the veterinary community. Beautiful, fast, and free.",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const language = await getRequestLanguage();
  const t = getTranslatorFor(language);
  return (
    <html lang={language} suppressHydrationWarning>
      <body
        className={`${inter.variable} ${dmSans.variable} font-sans antialiased`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          {t("common.skipToContent")}
        </a>
        <Providers analyticsEnabled={process.env.VERCEL === "1"}>
          <AppIntlProvider
            language={language}
            messages={messagesFor(language)}
            selectionEnabled={isLanguageSelectionEnabled()}
          >
            {children}
          </AppIntlProvider>
        </Providers>
      </body>
    </html>
  );
}
