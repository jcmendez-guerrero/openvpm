import en from "@/messages/en.json";
import {
  DEFAULT_LANGUAGE,
  isLanguageSelectionEnabled,
  languageCookieFromHeader,
  type Language,
} from "./config";
import { getTranslatorFor } from "./messages";
import { resolveLanguage } from "./resolve";

/**
 * Routers keep throwing their English text; the tRPC error formatter swaps an
 * exact catalog match for the request language. Unknown or dynamic messages
 * stay as thrown, and the error code never changes.
 */
const KEY_BY_ENGLISH = new Map<string, string>(
  Object.entries(en.errors as Record<string, string>).map(([key, text]) => [text, key]),
);

export function translateServerMessage(message: string, language: Language): string {
  if (language === DEFAULT_LANGUAGE) return message;
  const key = KEY_BY_ENGLISH.get(message);
  if (!key) return message;
  return getTranslatorFor(language)(`errors.${key}` as never);
}

/**
 * Language for a tRPC request: staff resolve cookie → clinic default, and
 * signed-out callers (portal, public booking) cookie → browser. A failed
 * clinic-default lookup falls back to English rather than failing the request.
 */
export async function resolveRequestLanguage(input: {
  cookieHeader: string | null | undefined;
  acceptLanguage: string | null | undefined;
  practiceId: string | null | undefined;
  loadClinicDefault: (practiceId: string) => Promise<Language>;
}): Promise<Language> {
  if (!isLanguageSelectionEnabled()) return DEFAULT_LANGUAGE;
  const cookie = languageCookieFromHeader(input.cookieHeader);
  if (cookie) return cookie;
  if (input.practiceId) {
    const clinicDefault = await input
      .loadClinicDefault(input.practiceId)
      .catch(() => DEFAULT_LANGUAGE);
    return resolveLanguage({ enabled: true, surface: "staff", clinicDefault });
  }
  return resolveLanguage({ enabled: true, surface: "public", acceptLanguage: input.acceptLanguage });
}
