import { cookies, headers } from "next/headers";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_COOKIE,
  isLanguageSelectionEnabled,
  type Language,
} from "./config";
import { resolveLanguage } from "./resolve";

/**
 * Language for pages that must not reach the staff session (secret-independent
 * paths like /email-preferences): the switch cookie, then the browser.
 */
export async function getPublicRequestLanguage(): Promise<Language> {
  if (!isLanguageSelectionEnabled()) return DEFAULT_LANGUAGE;
  return resolveLanguage({
    enabled: true,
    surface: "public",
    cookie: (await cookies()).get(LANGUAGE_COOKIE)?.value,
    acceptLanguage: (await headers()).get("accept-language"),
  });
}
