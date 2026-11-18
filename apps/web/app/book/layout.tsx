import type { Metadata } from "next";
import { LanguageSwitch } from "@/components/common/language-switch";
import { getTranslatorFor } from "@/i18n/messages";
import { getRequestLanguage } from "@/i18n/request";

export async function generateMetadata(): Promise<Metadata> {
  const t = getTranslatorFor(await getRequestLanguage());
  return {
    title: t("meta.book.title"),
    description: t("meta.book.description"),
  };
}

export default async function BookingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = getTranslatorFor(await getRequestLanguage());
  return (
    <div className="min-h-screen bg-gray-50">
      <LanguageSwitch className="mx-auto flex max-w-2xl justify-end px-4 pt-4" />
      <main className="mx-auto max-w-2xl px-4 py-8">{children}</main>
      <footer className="mt-12 border-t border-gray-100 bg-white">
        <div className="mx-auto max-w-2xl px-4 py-6 text-center text-sm text-gray-400">
          {t.rich("booking.footer.poweredBy", {
            link: (chunks) => (
              <a
                href="https://openvpm.com"
                className="underline-offset-2 hover:text-gray-600 hover:underline"
              >
                {chunks}
              </a>
            ),
          })}
          <span className="mx-2" aria-hidden="true">
            ·
          </span>
          <a
            href="/legal/privacy"
            className="underline-offset-2 hover:text-gray-600 hover:underline"
          >
            {t("booking.footer.privacy")}
          </a>
        </div>
      </footer>
    </div>
  );
}
