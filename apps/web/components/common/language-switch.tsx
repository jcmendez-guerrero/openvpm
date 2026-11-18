"use client";

import { useId } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "use-intl";
import {
  LANGUAGE_COOKIE,
  SUPPORTED_LANGUAGES,
  isSupportedLanguage,
  type Language,
} from "@/i18n/config";
import { useLanguageSelectionEnabled } from "./intl-provider";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const CLINIC_DEFAULT = "";

/** Writes the explicit choice, or deletes it for "clinic default". */
export function writeLanguageCookie(language: Language | null): void {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = language
    ? `${LANGUAGE_COOKIE}=${language}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`
    : `${LANGUAGE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

/**
 * Language picker. Refreshes server components in place, so unsaved form
 * input survives (FR-005). Renders nothing while the release flag is off.
 */
export function LanguageSwitch({
  value,
  allowClinicDefault = false,
  onChange,
  className,
}: {
  /** Saved choice (null = clinic default); defaults to the active language. */
  value?: Language | null;
  allowClinicDefault?: boolean;
  /** Persist the choice (e.g. settings.setMyLanguage); runs after the cookie is written. */
  onChange?: (language: Language | null) => Promise<void> | void;
  className?: string;
}) {
  const enabled = useLanguageSelectionEnabled();
  const active = useLocale();
  const router = useRouter();
  const t = useTranslations("language");
  const id = useId();
  if (!enabled) return null;

  const current = value === undefined ? active : value ?? CLINIC_DEFAULT;

  async function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = isSupportedLanguage(event.target.value) ? event.target.value : null;
    // This browser switches even if saving to the account is refused (e.g.
    // read-only roles); onChange reports its own errors.
    writeLanguageCookie(next);
    try {
      await onChange?.(next);
    } finally {
      router.refresh();
    }
  }

  return (
    <div className={className}>
      <label htmlFor={id} className="sr-only">
        {t("label")}
      </label>
      <select
        id={id}
        value={current}
        onChange={handleChange}
        className="max-w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
      >
        {allowClinicDefault && <option value={CLINIC_DEFAULT}>{t("clinicDefault")}</option>}
        {SUPPORTED_LANGUAGES.map((language) => (
          <option key={language} value={language} lang={language}>
            {t(`names.${language}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
