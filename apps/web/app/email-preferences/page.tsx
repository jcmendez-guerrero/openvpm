import { useTranslations } from "use-intl";
import type { Metadata } from "next";
import { createTranslator } from "use-intl/core";
import { getTranslatorFor, messagesFor } from "@/i18n/messages";
import { getPublicRequestLanguage } from "@/i18n/public-request";
import Link from "next/link";
import { EmailPreferenceForm } from "./preference-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = getTranslatorFor(await getPublicRequestLanguage());
  return {
    title: t("meta.emailPreferences.title"),
    description: t("meta.emailPreferences.description"),
    robots: { index: false, follow: false },
  };
}

export default async function EmailPreferencesPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const language = await getPublicRequestLanguage();
  const t = createTranslator({ locale: language, messages: messagesFor(language), namespace: "emailPreferences" });

  return (
    <main
      id="main-content"
      className="flex min-h-screen items-center justify-center bg-surface px-4 py-12"
    >
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <Link href="/" className="font-heading text-lg font-semibold">
          OpenVPM
        </Link>
        <div className="mt-8 space-y-3">
          <h1 className="font-heading text-2xl font-semibold">
            {t("emailPreferences")}
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            {t("stopOptionalOpenvpmProductTrial")}
          </p>
        </div>

        <EmailPreferenceForm token={token} />

        <div className="mt-6 rounded-lg bg-muted/50 p-4 text-xs leading-5 text-muted-foreground">
          {t("thisPreferenceDoesNotApply")}
        </div>
      </div>
    </main>
  );
}
