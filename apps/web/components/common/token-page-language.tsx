"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { IntlProvider, useLocale, useMessages, useTranslations } from "use-intl";
import { isSupportedLanguage, type Language } from "@/i18n/config";

type Override = { language: Language; messages: Record<string, unknown> };
type ApiLanguage = { language?: unknown; messages?: unknown };

const ApplyLanguage = createContext<(payload: object) => void>(() => undefined);

/**
 * Lets a token page switch to the language its API returned (the client's
 * saved language). The provider always renders, so children keep their state
 * when the language changes.
 */
export function TokenPageLanguage({ children }: { children: React.ReactNode }) {
  const parentLocale = useLocale();
  const parentMessages = useMessages();
  const [override, setOverride] = useState<Override | null>(null);

  const apply = useCallback((response: object) => {
    const payload = response as ApiLanguage;
    if (!isSupportedLanguage(payload.language) || !payload.messages || typeof payload.messages !== "object") return;
    const language = payload.language;
    const messages = payload.messages as Record<string, unknown>;
    setOverride((current) => (current?.language === language ? current : { language, messages }));
  }, []);

  useEffect(() => {
    if (!override) return;
    document.documentElement.lang = override.language;
    // The skip link lives in the root layout, outside this provider.
    const skip = (override.messages.common as { skipToContent?: unknown } | undefined)?.skipToContent;
    const link = document.getElementById("skip-to-content");
    if (link && typeof skip === "string") link.textContent = skip;
  }, [override]);

  return (
    <IntlProvider
      locale={override?.language ?? parentLocale}
      messages={override ? { ...parentMessages, ...override.messages } : parentMessages}
    >
      <ApplyLanguage.Provider value={apply}>{children}</ApplyLanguage.Provider>
    </IntlProvider>
  );
}

/** Layout text (header, footer) that follows the language the token API returned. */
export function TokenPageText({ id }: { id: "sign.header" | "sign.poweredBy" | "treatmentPlan.header" }) {
  return <>{useTranslations()(id)}</>;
}

/** Pass each token API response through this; it ignores responses without a language. */
export function useApplyTokenPageLanguage() {
  return useContext(ApplyLanguage);
}
