"use client";

import { useLanguageSelectionEnabled } from "@/components/common/intl-provider";
import type { Language } from "@/i18n/config";
import { resolveLanguage } from "@/i18n/resolve";
import { trpc } from "@/lib/trpc";

/**
 * Language for a document printed for a client: the client's saved
 * language, else the clinic default. English while the release flag is off.
 */
export function useDocumentLanguage(): (clientLanguage?: string | null) => Language {
  const enabled = useLanguageSelectionEnabled();
  const mine = trpc.settings.getMyLanguage.useQuery(undefined, {
    enabled,
    staleTime: 60_000,
  });
  const clinicDefault = mine.data?.clinicDefault;
  return (clientLanguage) =>
    resolveLanguage({ enabled, surface: "message", clientLanguage, clinicDefault });
}
