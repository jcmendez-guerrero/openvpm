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
    title: t("meta.treatmentPlan.title"),
    description: t("meta.treatmentPlan.description"),
    referrer: "no-referrer",
    robots: { index: false, follow: false, nocache: true },
  };
}

export default function TreatmentPlanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TokenPageLanguage>
      <div className="min-h-screen bg-gray-50">
        <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
          <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600">
              <PawMark className="h-4 w-4 text-white" />
            </div>
            <div className="text-sm font-semibold text-gray-900">
              OpenVPM{" "}
              <span className="text-teal-600">
                <TokenPageText id="treatmentPlan.header" />
              </span>
            </div>
            <LanguageSwitch className="ml-auto" />
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-4 py-6">{children}</main>
      </div>
    </TokenPageLanguage>
  );
}
