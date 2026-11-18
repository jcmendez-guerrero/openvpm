"use client";

import { useTranslations } from "use-intl";
import { SUPPORTED_LANGUAGES, isSupportedLanguage, type Language } from "@/i18n/config";
import { useLanguageSelectionEnabled } from "@/components/common/intl-provider";

/** Staff-set language for this client's portal and messages. Hidden while the release flag is off. */
export function ClientLanguageSelect({
  value,
  onChange,
}: {
  value: Language | null;
  onChange: (language: Language | null) => void;
}) {
  const t = useTranslations("clients.form.preferredLanguage");
  const names = useTranslations("language.names");
  if (!useLanguageSelectionEnabled()) return null;
  return (
    <div className="rounded-md border border-border p-3">
      <label className="text-sm font-medium" htmlFor="preferredLanguage">
        {t("label")}
      </label>
      <select
        id="preferredLanguage"
        value={value ?? ""}
        onChange={(event) => onChange(isSupportedLanguage(event.target.value) ? event.target.value : null)}
        className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        <option value="">{t("clinicDefault")}</option>
        {SUPPORTED_LANGUAGES.map((language) => (
          <option key={language} value={language} lang={language}>
            {names(language)}
          </option>
        ))}
      </select>
      <p className="mt-2 text-xs text-muted-foreground">{t("help")}</p>
    </div>
  );
}
