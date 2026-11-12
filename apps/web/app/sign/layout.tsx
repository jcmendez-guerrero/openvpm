import type { Metadata } from "next";
import { PawMark } from "@/components/brand/paw-mark";
import { LanguageSwitch } from "@/components/common/language-switch";
import {
  TokenPageLanguage,
  TokenPageText,
} from "@/components/common/token-page-language";
import { getTranslatorFor } from "@/i18n/messages";
import { getRequestLanguage } from "@/i18n/request";

export async function generateMetadata(): Promise<Metadata> {
  const t = getTranslatorFor(await getRequestLanguage());
  return {
    title: t("meta.sign.title"),
    description: t("meta.sign.description"),
    referrer: "no-referrer",
    robots: { index: false, follow: false, nocache: true },
  };
}

/**
 * Standalone shell for the no-login e-sign page (mirrors the capture
 * layout). The consent content itself comes from the token-gated API; this
 * shell shows no practice or patient details of its own.
 */
export default function SignLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TokenPageLanguage>
      <div className="min-h-screen bg-white">
        <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
          <div className="mx-auto max-w-lg px-4 py-3 flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-teal-600 flex items-center justify-center">
                <PawMark className="h-4 w-4 text-white" />
              </div>
              <div>
                <span className="font-semibold text-gray-900 text-sm">
                  OpenVPM
                </span>
                <span className="text-teal-600 text-sm ml-1.5 font-medium">
                  <TokenPageText id="sign.header" />
                </span>
              </div>
            </div>
            <LanguageSwitch className="ml-auto" />
          </div>
        </header>
        <main className="mx-auto max-w-lg px-4 py-6">{children}</main>
        <footer className="border-t border-gray-100 mt-12">
          <div className="mx-auto max-w-lg px-4 py-6 text-center text-sm text-gray-400">
            <TokenPageText id="sign.poweredBy" />
          </div>
        </footer>
      </div>
    </TokenPageLanguage>
  );
}
